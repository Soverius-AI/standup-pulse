import type {
  AbstractAgent,
  BaseEvent,
  Message,
  RunAgentInput,
} from '@ag-ui/client';
import type { TeamPulseViewModel } from '@standup-pulse/shared-contracts';
import {
  buildStandupSandboxPrompt,
  createStandupDashboardAgent,
  isStandupOpenGenerativeUiPrompt,
  standupSandboxResponseFormat,
  STANDUP_OPEN_GENERATIVE_UI_TRIGGER,
} from './open-generative-ui-agent';

const pulse: TeamPulseViewModel = {
  team: { id: 'team-1', name: 'Platform', timeZone: 'Europe/Vienna' },
  date: '2026-08-07',
  generatedAt: '2026-08-07T08:00:00.000Z',
  totals: {
    roster: 3,
    posted: 2,
    missing: 1,
    blocked: 1,
    participationPct: 67,
  },
  deltas: {
    posted: 1,
    missing: -1,
    blocked: 1,
    participationPoints: 17,
  },
  standups: [
    {
      memberId: 'ada',
      displayName: 'Ada Lovelace',
      status: 'blocked',
      preview: 'Shipping the renderer',
    },
    {
      memberId: 'grace',
      displayName: 'Grace Hopper',
      status: 'posted',
      preview: 'Testing the API',
    },
    {
      memberId: 'murat',
      displayName: 'Murat Sari',
      status: 'missing',
    },
  ],
  trend: [
    { date: '2026-08-06', participationPct: 50 },
    { date: '2026-08-07', participationPct: 67 },
  ],
  blockers: [
    {
      id: 'blocker-1',
      title: 'Waiting for access',
      owner: { memberId: 'ada', displayName: 'Ada Lovelace' },
      ageDays: 2,
    },
  ],
};

function userMessage(content: string): Message {
  return { id: 'user-1', role: 'user', content };
}

function inputFor(content: string): RunAgentInput {
  return {
    threadId: 'thread-1',
    runId: 'run-1',
    state: {},
    messages: [userMessage(content)],
    tools: [],
    context: [],
  };
}

function sseResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const content of chunks) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
            ),
          );
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

async function collectEvents(agent: AbstractAgent, input: RunAgentInput) {
  return new Promise<BaseEvent[]>((resolve, reject) => {
    const events: BaseEvent[] = [];
    agent.run(input).subscribe({
      next: (event) => events.push(event),
      error: reject,
      complete: () => resolve(events),
    });
  });
}

describe('Standup Open Generative UI agent', () => {
  it('routes only explicitly marked showcase prompts', () => {
    expect(
      isStandupOpenGenerativeUiPrompt([
        userMessage(`${STANDUP_OPEN_GENERATIVE_UI_TRIGGER}: show the pulse`),
      ]),
    ).toBe(true);
    expect(
      isStandupOpenGenerativeUiPrompt([
        userMessage('How many standups are missing?'),
      ]),
    ).toBe(false);
  });

  it('uses a strict, stable sandbox argument shape', () => {
    expect(standupSandboxResponseFormat.json_schema.strict).toBe(true);
    expect(standupSandboxResponseFormat.json_schema.schema.required).toEqual([
      'initialHeight',
      'placeholderMessages',
      'css',
      'html',
      'jsFunctions',
      'jsExpressions',
    ]);
  });

  it('grounds the generation prompt in the stored pulse', () => {
    const prompt = buildStandupSandboxPrompt('Make it interactive', pulse);

    expect(prompt).toContain('Ada Lovelace');
    expect(prompt).toContain('Murat Sari');
    expect(prompt).toContain('Waiting for access');
    expect(prompt).toContain('"participationPct":67');
    expect(prompt).toContain('"blockerCount":1');
    expect(prompt).toContain('Make it interactive');
  });

  it('streams model JSON as generateSandboxedUi tool arguments', async () => {
    const uiJson = JSON.stringify({
      initialHeight: 460,
      placeholderMessages: ['Building the team pulse'],
      css: 'section{color:#14213d}',
      html: "<section data-testid='standup-pulse-generated'>Pulse</section>",
      jsFunctions: 'function setFilter(){}',
      jsExpressions: ['setFilter()'],
    });
    const fetchImplementation = vi.fn<typeof fetch>(async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as {
        response_format?: unknown;
      };
      expect(request.response_format).toEqual(standupSandboxResponseFormat);
      return sseResponse([uiJson.slice(0, 80), uiJson.slice(80)]);
    });
    const fallbackAgent = {
      description: 'fallback',
      run: vi.fn(),
      clone: vi.fn(),
      abortRun: vi.fn(),
      getCapabilities: vi.fn(async () => ({})),
    } as unknown as AbstractAgent;
    const agent = createStandupDashboardAgent({
      fallbackAgent,
      modelConfig: {
        baseUrl: 'http://127.0.0.1:8080/v1',
        modelId: 'local-gemma',
        requestTimeoutMs: 5_000,
        contextSize: 131_072,
        temperature: 1,
        topP: 0.95,
        topK: 64,
        thinking: false,
      },
      getTeamPulse: async () => pulse,
      fetchImplementation,
    });

    const events = await collectEvents(
      agent,
      inputFor(`${STANDUP_OPEN_GENERATIVE_UI_TRIGGER}: show the pulse`),
    );
    const toolStart = events.find(({ type }) => type === 'TOOL_CALL_START');
    const streamedArguments = events
      .filter(({ type }) => type === 'TOOL_CALL_ARGS')
      .map((event) => ('delta' in event ? event.delta : ''))
      .join('');

    expect(toolStart).toMatchObject({
      type: 'TOOL_CALL_START',
      toolCallName: 'generateSandboxedUi',
    });
    expect(streamedArguments).toBe(uiJson);
    expect(events.some(({ type }) => type === 'TOOL_CALL_END')).toBe(true);
    expect(fallbackAgent.run).not.toHaveBeenCalled();
  });
});
