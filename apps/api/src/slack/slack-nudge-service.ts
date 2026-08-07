import type { IsoDate, NudgeResponse } from '@standup-pulse/shared-contracts';
import type { StandupRepository, TeamScope } from '../domain';
import { setTimeout as delay } from 'node:timers/promises';
import pMap from 'p-map';
import { z } from 'zod';
import {
  deliveryFromExistingClaim,
  reminderText,
  stableClientMessageId,
  unavailableResponse,
  type NudgeDelivery,
} from './nudge-delivery';
import { SlackApiError, SlackWebClient } from './slack-web-client';

const REQUIRED_SCOPES = ['chat:write', 'im:write'] as const;
const MAX_MEMBERS_PER_REQUEST = 50;

const ConversationOpenSchema = z.object({
  channel: z.object({ id: z.string() }).passthrough(),
});

type NudgeRepository = Pick<
  StandupRepository,
  'listActiveMembers' | 'claimDelivery' | 'completeDelivery'
>;

type ActiveMember = Awaited<
  ReturnType<NudgeRepository['listActiveMembers']>
>[number];

export interface ProactiveNudgeService {
  readonly available: boolean;
  requestNudges(
    memberIds: string[],
    date: IsoDate,
    requestId: string,
    now?: Date,
  ): Promise<NudgeResponse>;
}

export interface SlackNudgeServiceOptions {
  repository: NudgeRepository;
  scope: TeamScope;
  token: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
  maxConcurrency?: number;
  authenticationRetryMs?: number;
  authenticationRefreshMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class SlackNudgeService implements ProactiveNudgeService {
  private ready = false;
  private readonly slack: SlackWebClient;
  private readonly maxConcurrency: number;
  private authenticationController: AbortController | undefined;
  private authenticationLoop: Promise<void> | undefined;

  constructor(private readonly options: SlackNudgeServiceOptions) {
    this.slack = new SlackWebClient(options);
    this.maxConcurrency = options.maxConcurrency ?? 3;
  }

  get available(): boolean {
    return this.ready;
  }

  start(): void {
    if (this.authenticationLoop) return;
    this.authenticationController = new AbortController();
    this.authenticationLoop = this.runAuthenticationLoop(
      this.authenticationController.signal,
    );
  }

  async stop(): Promise<void> {
    this.authenticationController?.abort();
    await this.authenticationLoop;
    this.authenticationController = undefined;
    this.authenticationLoop = undefined;
    this.ready = false;
  }

  async initialize(): Promise<void> {
    this.ready = false;
    const scopes = await this.slack.authTest();
    if (REQUIRED_SCOPES.some((scope) => !scopes.has(scope))) {
      throw new Error('Slack bot is missing proactive delivery scopes');
    }
    this.ready = true;
  }

  async requestNudges(
    memberIds: string[],
    date: IsoDate,
    requestId: string,
    now = new Date(),
  ): Promise<NudgeResponse> {
    const uniqueMemberIds = [...new Set(memberIds)].slice(
      0,
      MAX_MEMBERS_PER_REQUEST,
    );
    if (!this.ready) return unavailableResponse(uniqueMemberIds, now);

    const members = await this.options.repository.listActiveMembers(
      this.options.scope,
    );
    const memberById = new Map(members.map((member) => [member.id, member]));
    const deliveries = await pMap(
      uniqueMemberIds,
      (memberId) =>
        this.deliverNudge(
          memberId,
          memberById.get(memberId),
          date,
          requestId,
          now,
        ),
      { concurrency: this.maxConcurrency },
    );

    return { deliveries, completedAt: now.toISOString() };
  }

  private async deliverNudge(
    memberId: string,
    member: ActiveMember | undefined,
    date: IsoDate,
    requestId: string,
    now: Date,
  ): Promise<NudgeDelivery> {
    const idempotencyKey = `${this.options.scope.teamId}:standup-nudge:${date}:${memberId}`;
    const claim = await this.options.repository.claimDelivery(
      this.options.scope,
      idempotencyKey,
      JSON.stringify({ requestId, memberId, date }),
      now,
    );
    if (!claim.claimed) {
      return deliveryFromExistingClaim(memberId, claim.status);
    }
    if (!member) {
      return this.completeUnavailable(
        idempotencyKey,
        memberId,
        'Member is not in the active roster.',
        now,
      );
    }
    if (!member.slackUserId) {
      return this.completeUnavailable(
        idempotencyKey,
        memberId,
        'Slack account is not linked.',
        now,
      );
    }

    try {
      const channelId = await this.openDirectMessage(member.slackUserId);
      await this.slack.api('chat.postMessage', {
        channel: channelId,
        client_msg_id: stableClientMessageId(idempotencyKey),
        text: reminderText(date),
      });
      await this.options.repository.completeDelivery(
        idempotencyKey,
        'sent',
        now,
      );
      return { memberId, status: 'sent' };
    } catch (error) {
      if (error instanceof SlackApiError && error.isAuthenticationError) {
        this.ready = false;
      }
      await this.options.repository.completeDelivery(
        idempotencyKey,
        'failed',
        now,
        error instanceof Error ? error.name : 'UnknownError',
      );
      return {
        memberId,
        status: 'failed',
        message: 'Slack could not deliver the reminder.',
      };
    }
  }

  private async openDirectMessage(slackUserId: string): Promise<string> {
    const conversation = await this.slack.api('conversations.open', {
      users: slackUserId,
    });
    const parsed = ConversationOpenSchema.safeParse(conversation);
    if (!parsed.success) {
      throw new Error('Slack did not return a DM channel');
    }
    return parsed.data.channel.id;
  }

  private async completeUnavailable(
    idempotencyKey: string,
    memberId: string,
    message: string,
    now: Date,
  ): Promise<NudgeDelivery> {
    await this.options.repository.completeDelivery(
      idempotencyKey,
      'unavailable',
      now,
      message,
    );
    return { memberId, status: 'unavailable', message };
  }

  private async runAuthenticationLoop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.initialize();
      } catch (error) {
        if (!signal.aborted) {
          console.warn('Proactive Slack authentication is unavailable', {
            name: error instanceof Error ? error.name : 'UnknownError',
          });
        }
      }
      try {
        await delay(
          this.ready
            ? (this.options.authenticationRefreshMs ?? 60_000)
            : (this.options.authenticationRetryMs ?? 5_000),
          undefined,
          { signal },
        );
      } catch {
        // Aborted while sleeping; the loop condition ends the loop.
      }
    }
  }
}
