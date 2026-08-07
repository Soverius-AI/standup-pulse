import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { createTool } from '@mastra/core/tools';
import type { A2UIInjectConfig } from '@ag-ui/mastra';
import type { LanguageModel } from 'ai';
import {
  type IsoDate,
  type TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { z } from 'zod';
import { createStructuredA2UITool } from './structured-a2ui-tool';
import { recordA2UIToolResult } from './a2ui-tool-results';

export const STANDUP_PULSE_AGENT_ID = 'standupPulse';

export const STANDUP_PULSE_INSTRUCTIONS = `You are Standup Pulse, a concise async-standup assistant.

Use data tools whenever the user asks for stored standup, team pulse, or blocker information. For a standard visual summary, retrieve the relevant stored data first and call generate_a2ui exactly once; a model authors the complete A2UI Basic Catalog surface from trusted tool results and chooses its components and layout. Use generateSandboxedUi instead only when the user explicitly asks for a bespoke interactive interface, simulation, or custom chart that needs sandboxed HTML, CSS, or behavior. Never call both UI tools for one response, and stop after either UI tool returns. Never invent stored data or a calendar date. Current-date tools resolve today's work date from trusted server context; repeat only the date returned by a tool. If required details are missing, ask one brief follow-up question instead of guessing. Treat the authenticated actor, team, current date, and timezone as trusted server context; never ask the user to provide or override those identifiers. Never include actorId, teamId, timezone, channelId, threadId, or localDate in tool arguments. Keep normal answers short and action-oriented.`;

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
  readonly localDate: IsoDate;
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
    input: { readonly localDate?: IsoDate },
  ): Promise<MyStandupView | null>;
  getTeamPulse(
    context: TrustedAgentContext,
    input: { readonly localDate?: IsoDate; readonly rangeDays?: number },
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
    execute: async (input, { requestContext }) => {
      const result = await readService.getMyStandup(
        getTrustedContext(requestContext),
        input,
      );
      recordA2UIToolResult(requestContext, 'getMyStandup', result);
      return result;
    },
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
    execute: async (input, { requestContext }) => {
      const result = await readService.getTeamPulse(
        getTrustedContext(requestContext),
        {
          ...(input.rangeDays === undefined
            ? {}
            : { rangeDays: input.rangeDays }),
        },
      );
      recordA2UIToolResult(requestContext, 'getTeamPulse', result);
      return result;
    },
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
    execute: async (input, { requestContext }) => {
      const result = await readService.listBlockers(
        getTrustedContext(requestContext),
        {
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.limit === undefined ? {} : { limit: input.limit }),
        },
      );
      recordA2UIToolResult(requestContext, 'listBlockers', result);
      return result;
    },
  });

  return {
    getMyStandup,
    getTeamPulse,
    listBlockers,
  };
}

export interface CreateStandupPulseAgentOptions {
  readonly model: MastraModelConfig;
  readonly readService: StandupPulseReadService;
  readonly includePersonalTools?: boolean;
  readonly a2ui?: Omit<A2UIInjectConfig, 'injectA2UITool' | 'model'>;
}

function hasGeneratedVisualUI({
  steps,
}: {
  readonly steps: readonly {
    readonly toolCalls: readonly { readonly toolName: string }[];
  }[];
}): boolean {
  return steps.some((step) =>
    step.toolCalls.some(({ toolName }) =>
      ['generate_a2ui', 'generateSandboxedUi'].includes(toolName),
    ),
  );
}

export function createStandupPulseAgent({
  model,
  readService,
  includePersonalTools = true,
  a2ui,
}: CreateStandupPulseAgentOptions) {
  const readTools = createStandupPulseReadTools(readService);
  const teamTools = {
    getTeamPulse: readTools.getTeamPulse,
    listBlockers: readTools.listBlockers,
  };
  const tools = includePersonalTools ? readTools : teamTools;
  return new Agent({
    id: STANDUP_PULSE_AGENT_ID,
    name: 'Standup Pulse',
    description: 'Answers async-standup, participation, and blocker questions.',
    instructions: STANDUP_PULSE_INSTRUCTIONS,
    model,
    maxRetries: 0,
    ...(a2ui
      ? {
          defaultOptions: {
            stopWhen: hasGeneratedVisualUI,
          },
        }
      : {}),
    requestContextSchema: trustedAgentContextSchema,
    tools: {
      ...tools,
      ...(a2ui
        ? {
            generate_a2ui: createStructuredA2UITool({
              model: model as LanguageModel,
              ...a2ui,
            }),
          }
        : {}),
    },
  });
}
