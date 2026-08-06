import { randomUUID } from 'node:crypto';
import {
  AbstractAgent,
  EventType,
  type BaseEvent,
  type Message,
  type RunAgentInput,
  type TextMessageChunkEvent,
  type ToolCallArgsEvent,
  type ToolCallEndEvent,
  type ToolCallStartEvent,
} from '@ag-ui/client';
import { BuiltInAgent } from '@copilotkit/runtime/v2';
import type { TeamPulseViewModel } from '@standup-pulse/shared-contracts';
import { createLlamaCppFetch, type LocalModelConfig } from './local-model';

export const STANDUP_OPEN_GENERATIVE_UI_TRIGGER = 'Open Generative UI showcase';

const GENERATE_SANDBOXED_UI_TOOL_NAME = 'generateSandboxedUi';

export const standupSandboxResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'standup_pulse_sandbox',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'initialHeight',
        'placeholderMessages',
        'css',
        'html',
        'jsFunctions',
        'jsExpressions',
      ],
      properties: {
        initialHeight: { type: 'number' },
        placeholderMessages: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: { type: 'string' },
        },
        css: { type: 'string' },
        html: { type: 'string' },
        jsFunctions: { type: 'string' },
        jsExpressions: {
          type: 'array',
          minItems: 1,
          maxItems: 1,
          items: { type: 'string' },
        },
      },
    },
  },
} as const;

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (part): part is { type: 'text'; text: string } =>
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string',
    )
    .map(({ text }) => text)
    .join('\n');
}

function latestUserText(messages: readonly Message[]): string {
  const latestUser = [...messages]
    .reverse()
    .find(({ role }) => role === 'user');
  return textFromContent(latestUser?.content);
}

export function isStandupOpenGenerativeUiPrompt(
  messages: readonly Message[],
): boolean {
  const latest = messages.at(-1);
  if (!latest || (latest.role !== 'user' && latest.role !== 'tool')) {
    return false;
  }
  return latestUserText(messages)
    .toLocaleLowerCase()
    .includes(STANDUP_OPEN_GENERATIVE_UI_TRIGGER.toLocaleLowerCase());
}

function isToolContinuation(messages: readonly Message[]): boolean {
  return messages.at(-1)?.role === 'tool';
}

function textChunk(messageId: string, delta: string): TextMessageChunkEvent {
  return {
    type: EventType.TEXT_MESSAGE_CHUNK,
    role: 'assistant',
    messageId,
    delta,
  };
}

function compactPulseForPrompt(pulse: TeamPulseViewModel): unknown {
  return {
    team: pulse.team.name,
    date: pulse.date,
    totals: pulse.totals,
    trend: pulse.trend,
    members: pulse.standups.map(
      ({ memberId, displayName, status, preview }) => ({
        displayName,
        status,
        preview: preview ?? '',
        blockerCount: pulse.blockers.filter(
          ({ owner }) => owner.memberId === memberId,
        ).length,
      }),
    ),
    blockers: pulse.blockers.map(({ title, ageDays, owner }) => ({
      title,
      ageDays,
      owner: owner.displayName,
    })),
  };
}

export function buildStandupSandboxPrompt(
  userPrompt: string,
  pulse: TeamPulseViewModel,
): string {
  return [
    'You generate one compact, polished Open Generative UI widget for an async-standup dashboard. Return JSON only.',
    'The JSON must contain exactly these keys in this exact order: initialHeight, placeholderMessages, css, html, jsFunctions, jsExpressions.',
    'Use only the trusted data below. Copy its values literally; never invent members, dates, blockers, or metrics.',
    'Build a responsive widget for a 380px-wide chat drawer with:',
    '- four compact KPI cards for participation, posted, missing, and blockers;',
    '- an accessible seven-day participation bar chart made with inline HTML/CSS or inline SVG;',
    '- a concise missing-update list and blocker summary;',
    '- All / Missing filter buttons with aria-pressed state that actually filter member rows.',
    "The html root must be <section data-testid='standup-pulse-generated'> and every HTML attribute must use single quotes.",
    'Put markup literally in html. Do not construct the interface from JavaScript.',
    'Put reusable helpers in jsFunctions. Put one immediately executed listener/setup expression in jsExpressions; do not wait for DOMContentLoaded or a timer.',
    'Use off-white surfaces, navy text, amber attention, red blockers, and green healthy states. No gradients, shadows, external scripts, images, fonts, fetch, storage, or cookies.',
    'Keep initialHeight between 420 and 620. Keep the combined CSS, HTML, and JavaScript under 7,500 characters.',
    `Trusted standup data:\n${JSON.stringify(compactPulseForPrompt(pulse))}`,
    `User request: ${userPrompt}`,
  ].join('\n');
}

async function* streamCompletionContent(
  response: Response,
): AsyncGenerator<string> {
  if (!response.ok || !response.body) {
    throw new Error(
      `Local model request failed: ${response.status} ${await response.text()}`,
    );
  }

  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let newlineIndex = buffer.indexOf('\n');

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');

      if (!line.startsWith('data:')) continue;
      const data = line.slice('data:'.length).trim();
      if (data === '[DONE]') return;

      const payload = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: unknown } }>;
      };
      const delta = payload.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) yield delta;
    }
  }
}

async function* streamSandboxToolEvents(options: {
  parentMessageId: string;
  prompt: string;
  modelConfig: LocalModelConfig;
  abortSignal: AbortSignal;
  fetchImplementation?: typeof fetch;
}): AsyncGenerator<ToolCallStartEvent | ToolCallArgsEvent | ToolCallEndEvent> {
  const modelFetch = createLlamaCppFetch(
    options.modelConfig.requestTimeoutMs,
    options.fetchImplementation,
  );
  const response = await modelFetch(
    `${options.modelConfig.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${options.modelConfig.apiKey ?? 'local-llama'}`,
      },
      body: JSON.stringify({
        model: options.modelConfig.modelId,
        messages: [{ role: 'user', content: options.prompt }],
        max_tokens: 6_144,
        temperature: 0,
        response_format: standupSandboxResponseFormat,
        stream: true,
      }),
      signal: options.abortSignal,
    },
  );
  const modelStream = streamCompletionContent(response);
  const iterator = modelStream[Symbol.asyncIterator]();
  const first = await iterator.next();

  if (first.done || !first.value) {
    throw new Error('Local model returned no sandbox UI arguments.');
  }

  const toolCallId = randomUUID();
  yield {
    type: EventType.TOOL_CALL_START,
    parentMessageId: options.parentMessageId,
    toolCallId,
    toolCallName: GENERATE_SANDBOXED_UI_TOOL_NAME,
  };
  yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: first.value };

  for (;;) {
    const next = await iterator.next();
    if (next.done) break;
    if (next.value) {
      yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: next.value };
    }
  }

  yield { type: EventType.TOOL_CALL_END, toolCallId };
}

export interface CreateStandupDashboardAgentOptions {
  readonly fallbackAgent: AbstractAgent;
  readonly modelConfig: LocalModelConfig;
  readonly getTeamPulse: () => Promise<TeamPulseViewModel>;
  readonly fetchImplementation?: typeof fetch;
}

class StandupDashboardAgent extends AbstractAgent {
  readonly #visualAgent: BuiltInAgent;

  constructor(
    private readonly options: CreateStandupDashboardAgentOptions,
    visualAgent?: BuiltInAgent,
  ) {
    super({
      agentId: options.fallbackAgent.agentId,
      description: options.fallbackAgent.description,
    });
    this.#visualAgent =
      visualAgent ??
      new BuiltInAgent({
        type: 'custom',
        factory: ({ input, abortSignal }) =>
          this.#runVisualAgent(input, abortSignal) as AsyncIterable<never>,
      });
  }

  run(input: RunAgentInput): ReturnType<AbstractAgent['run']> {
    const stream = isStandupOpenGenerativeUiPrompt(input.messages)
      ? this.#visualAgent.run(input)
      : this.options.fallbackAgent.run(input);
    return stream as unknown as ReturnType<AbstractAgent['run']>;
  }

  async getCapabilities() {
    return (await this.options.fallbackAgent.getCapabilities?.()) ?? {};
  }

  clone(): StandupDashboardAgent {
    return new StandupDashboardAgent(
      {
        ...this.options,
        fallbackAgent: this.options.fallbackAgent.clone() as AbstractAgent,
      },
      this.#visualAgent.clone(),
    );
  }

  override abortRun(): void {
    this.options.fallbackAgent.abortRun();
    this.#visualAgent.abortRun();
    super.abortRun();
  }

  async *#runVisualAgent(
    input: RunAgentInput,
    abortSignal: AbortSignal,
  ): AsyncGenerator<BaseEvent> {
    const messageId = randomUUID();

    if (isToolContinuation(input.messages)) {
      yield textChunk(messageId, 'The interactive team-pulse view is ready.');
      return;
    }

    yield textChunk(
      messageId,
      'Generating an interactive team-pulse view with local Gemma…',
    );

    const pulse = await this.options.getTeamPulse();
    const prompt = buildStandupSandboxPrompt(
      latestUserText(input.messages),
      pulse,
    );

    try {
      yield* streamSandboxToolEvents({
        parentMessageId: messageId,
        prompt,
        modelConfig: this.options.modelConfig,
        abortSignal,
        fetchImplementation: this.options.fetchImplementation,
      });
    } catch (error) {
      yield textChunk(
        messageId,
        `\nI could not generate the interactive view: ${error instanceof Error ? error.message : 'unknown model error'}`,
      );
    }
  }
}

export function createStandupDashboardAgent(
  options: CreateStandupDashboardAgentOptions,
): AbstractAgent {
  return new StandupDashboardAgent(options);
}
