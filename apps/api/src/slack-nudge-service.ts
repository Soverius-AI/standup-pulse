import type { IsoDate, NudgeResponse } from '@standup-pulse/shared-contracts';
import type {
  StandupRepository,
  TeamScope,
} from '@standup-pulse/standups-domain';

const REQUIRED_SCOPES = ['chat:write', 'im:write'] as const;

type NudgeRepository = Pick<StandupRepository, 'listActiveMembers'>;

export interface ProactiveNudgeService {
  readonly available: boolean;
  requestNudges(
    memberIds: string[],
    date: IsoDate,
    now?: Date,
  ): Promise<NudgeResponse>;
}

interface SlackNudgeServiceOptions {
  repository: NudgeRepository;
  scope: TeamScope;
  token: string;
  fetch?: typeof fetch;
}

export class SlackNudgeService implements ProactiveNudgeService {
  private ready = false;
  private readonly fetch: typeof fetch;

  constructor(private readonly options: SlackNudgeServiceOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  get available(): boolean {
    return this.ready;
  }

  async initialize(): Promise<void> {
    const response = await this.fetch('https://slack.com/api/auth.test', {
      headers: this.headers(),
    });
    const payload = await readSlackPayload(response);
    if (!response.ok || payload['ok'] !== true) {
      throw new Error('Slack bot authentication failed');
    }

    const scopes = new Set(
      (response.headers.get('x-oauth-scopes') ?? '')
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean),
    );
    if (REQUIRED_SCOPES.some((scope) => !scopes.has(scope))) {
      throw new Error('Slack bot is missing proactive delivery scopes');
    }

    this.ready = true;
  }

  async requestNudges(
    memberIds: string[],
    date: IsoDate,
    now = new Date(),
  ): Promise<NudgeResponse> {
    if (!this.ready) {
      return unavailableResponse(memberIds, now);
    }

    const members = await this.options.repository.listActiveMembers(
      this.options.scope,
    );
    const memberById = new Map(members.map((member) => [member.id, member]));
    const deliveries = await Promise.all(
      memberIds.map(async (memberId) => {
        const member = memberById.get(memberId);
        if (!member) {
          return {
            memberId,
            status: 'unavailable' as const,
            message: 'Member is not in the active roster.',
          };
        }
        if (!member.slackUserId) {
          return {
            memberId,
            status: 'unavailable' as const,
            message: 'Slack account is not linked.',
          };
        }

        try {
          const conversation = await this.slackApi('conversations.open', {
            users: member.slackUserId,
          });
          const channel = conversation['channel'];
          const channelId =
            isRecord(channel) && typeof channel['id'] === 'string'
              ? channel['id']
              : undefined;
          if (!channelId) throw new Error('Slack did not return a DM channel');

          await this.slackApi('chat.postMessage', {
            channel: channelId,
            text: `Standup reminder for ${date}: please share what you completed, what you are doing today, and any blockers.`,
          });
          return { memberId, status: 'sent' as const };
        } catch {
          return {
            memberId,
            status: 'failed' as const,
            message: 'Slack could not deliver the reminder.',
          };
        }
      }),
    );

    return { deliveries, completedAt: now.toISOString() };
  }

  private async slackApi(
    method: string,
    body: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const payload = await readSlackPayload(response);
    if (!response.ok || payload['ok'] !== true) {
      throw new Error(`Slack API call failed: ${method}`);
    }
    return payload;
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.options.token}`,
      'content-type': 'application/json; charset=utf-8',
    };
  }
}

function unavailableResponse(memberIds: string[], now: Date): NudgeResponse {
  return {
    deliveries: memberIds.map((memberId) => ({
      memberId,
      status: 'unavailable',
      message: 'Proactive Slack delivery is unavailable.',
    })),
    completedAt: now.toISOString(),
  };
}

async function readSlackPayload(
  response: Response,
): Promise<Record<string, unknown>> {
  const payload: unknown = await response.json();
  if (!isRecord(payload)) throw new Error('Slack returned an invalid response');
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
