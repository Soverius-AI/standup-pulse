import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { createTool } from '@mastra/core/tools';
import {
  blockerDigestSurface,
  missingStandupsSurface,
  type TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { z } from 'zod';

export const STANDUP_PULSE_AGENT_ID = 'standupPulse';

export const STANDUP_PULSE_INSTRUCTIONS = `You are Standup Pulse, a concise async-standup assistant.

Use tools whenever the user asks for stored standup, team pulse, or blocker data. Use the fixed render tools when a missing-standup list or blocker digest is best shown visually. Use renderStandupWhatIf for an interactive participation what-if or typed Generative UI demo when that frontend tool is available. When the user explicitly asks for a free-form custom dashboard UI and the generateSandboxedUi frontend tool is available, call generateSandboxedUi; retrieve stored data first only when the requested UI depends on real team data, and do not substitute a markdown-only answer. Never invent stored data or a calendar date. Current-date tools resolve today's work date from trusted server context; repeat only the date returned by a tool. If required details are missing, ask one brief follow-up question instead of guessing. Treat the authenticated actor, team, current date, and timezone as trusted server context; never ask the user to provide or override those identifiers. Never include actorId, teamId, timezone, channelId, threadId, or localDate in tool arguments. Keep normal answers short and action-oriented.`;

export const trustedAgentContextSchema = z.object({
  actorId: z.string().min(1),
  teamId: z.string().min(1),
  timezone: z.string().min(1),
  channelId: z.string().min(1).optional(),
  threadId: z.string().min(1).optional(),
});

export type TrustedAgentContext = z.infer<typeof trustedAgentContextSchema>;

export class TrustedAgentContextError extends Error {
  readonly code = 'TRUSTED_AGENT_CONTEXT_INVALID';

  constructor() {
    super('Trusted agent context is unavailable.');
    this.name = 'TrustedAgentContextError';
  }
}

export interface MyStandupView {
  readonly localDate: string;
  readonly submitted: boolean;
  readonly yesterday?: string;
  readonly today?: string;
  readonly blockers: readonly string[];
}

export interface BlockerView {
  readonly id: string;
  readonly summary: string;
  readonly ownerDisplayName: string;
  readonly status: 'open' | 'resolved';
  readonly ageDays: number;
}

export interface StandupPulseReadService {
  getMyStandup(
    context: TrustedAgentContext,
    input: { readonly localDate?: string },
  ): Promise<MyStandupView | null>;
  getTeamPulse(
    context: TrustedAgentContext,
    input: { readonly localDate?: string; readonly rangeDays?: number },
  ): Promise<TeamPulseViewModel>;
  listBlockers(
    context: TrustedAgentContext,
    input: { readonly status?: 'open' | 'resolved'; readonly limit?: number },
  ): Promise<readonly BlockerView[]>;
}

function getTrustedContext(requestContext: {
  get(key: string): unknown;
}): TrustedAgentContext {
  const result = trustedAgentContextSchema.safeParse({
    actorId: requestContext.get('actorId'),
    teamId: requestContext.get('teamId'),
    timezone: requestContext.get('timezone'),
    channelId: requestContext.get('channelId'),
    threadId: requestContext.get('threadId'),
  });
  if (!result.success) throw new TrustedAgentContextError();
  return result.data;
}

export function createStandupPulseReadTools(
  readService: StandupPulseReadService,
) {
  const getMyStandup = createTool({
    id: 'getMyStandup',
    description:
      "Get the authenticated actor's standup for today's trusted local work date.",
    inputSchema: z.object({}).strict(),
    execute: async (input, { requestContext }) =>
      readService.getMyStandup(getTrustedContext(requestContext), input),
  });

  const getTeamPulse = createTool({
    id: 'getTeamPulse',
    description:
      "Get aggregate participation and blocker metrics for the authenticated team's trusted current work date.",
    inputSchema: z
      .object({
        rangeDays: z.number().int().min(1).max(30).optional(),
      })
      .strict(),
    execute: async (input, { requestContext }) =>
      readService.getTeamPulse(getTrustedContext(requestContext), input),
  });

  const listBlockers = createTool({
    id: 'listBlockers',
    description: 'List open or resolved blockers for the authenticated team.',
    inputSchema: z
      .object({
        status: z.enum(['open', 'resolved']).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    execute: async (input, { requestContext }) =>
      readService.listBlockers(getTrustedContext(requestContext), input),
  });

  const renderMissingStandups = createTool({
    id: 'renderMissingStandups',
    description:
      "Render today's stored missing-standup roster as a fixed A2UI card. Use for who has not posted or missing-update questions.",
    inputSchema: z.object({}).strict(),
    execute: async (input, { requestContext }) => {
      const pulse = await readService.getTeamPulse(
        getTrustedContext(requestContext),
        input,
      );
      return {
        a2ui_operations: missingStandupsSurface({
          team: pulse.team,
          date: pulse.date,
          members: pulse.standups
            .filter(({ status }) => status === 'missing')
            .map(({ memberId, displayName, avatarUrl }) => ({
              memberId,
              displayName,
              ...(avatarUrl ? { avatarUrl } : {}),
            })),
        }),
      };
    },
  });

  const renderBlockerDigest = createTool({
    id: 'renderBlockerDigest',
    description:
      "Render today's stored open blockers as a fixed A2UI digest. Use when the user asks to see blockers visually.",
    inputSchema: z.object({}).strict(),
    execute: async (input, { requestContext }) => {
      const pulse = await readService.getTeamPulse(
        getTrustedContext(requestContext),
        input,
      );
      return {
        a2ui_operations: blockerDigestSurface({
          team: pulse.team,
          date: pulse.date,
          blockers: pulse.blockers,
        }),
      };
    },
  });

  return {
    getMyStandup,
    getTeamPulse,
    listBlockers,
    renderMissingStandups,
    renderBlockerDigest,
  };
}

export interface CreateStandupPulseAgentOptions {
  readonly model: MastraModelConfig;
  readonly readService: StandupPulseReadService;
}

export function createStandupPulseAgent({
  model,
  readService,
}: CreateStandupPulseAgentOptions) {
  return new Agent({
    id: STANDUP_PULSE_AGENT_ID,
    name: 'Standup Pulse',
    description: 'Answers async-standup, participation, and blocker questions.',
    instructions: STANDUP_PULSE_INSTRUCTIONS,
    model,
    maxRetries: 0,
    requestContextSchema: trustedAgentContextSchema,
    tools: createStandupPulseReadTools(readService),
  });
}
