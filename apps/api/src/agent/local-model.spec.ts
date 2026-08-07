import { generateText } from 'ai';
import { z } from 'zod';
import {
  createLlamaCppFetch,
  createLocalGemmaModel,
  loadLocalModelConfig,
  normalizeOpenAiToolArguments,
} from './local-model';

describe('local Gemma model', () => {
  it('loads bounded, reproducible defaults', () => {
    expect(loadLocalModelConfig({})).toEqual({
      baseUrl: 'http://127.0.0.1:8080/v1',
      modelId: 'standup-gemma-4-26b-a4b-q4',
      contextSize: 131_072,
      maxOutputTokens: 4_096,
      temperature: 0,
      topP: 0.95,
      topK: 64,
      thinking: false,
    });
  });

  it('rejects invalid environment values', () => {
    expect(() =>
      loadLocalModelConfig({ LOCAL_LLM_CONTEXT_SIZE: '5' }),
    ).toThrow();
  });

  it('normalizes object tool arguments in complete responses', () => {
    const payload = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: { name: 'getTeamPulse', arguments: { rangeDays: 7 } },
              },
            ],
          },
        },
      ],
    };

    expect(normalizeOpenAiToolArguments(payload)).toEqual({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'getTeamPulse',
                  arguments: '{"rangeDays":7}',
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('normalizes object tool arguments in server-sent events', async () => {
    const encoder = new TextEncoder();
    const responseBody = [
      'data: {"choices":[{"delta":{"tool_calls":[{"function":{"arguments":{"status":"open"}}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');
    const upstreamFetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(responseBody));
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    );

    const response = await createLlamaCppFetch(upstreamFetch)(
      'http://127.0.0.1:8080/v1/chat/completions',
    );

    const firstLine = (await response.text()).split('\n').at(0);
    if (firstLine === undefined) throw new Error('Expected one SSE event');
    const firstEvent = firstLine.slice('data: '.length);
    const normalizedEvent = z
      .object({
        choices: z.tuple([
          z.object({
            delta: z.object({
              tool_calls: z.tuple([
                z.object({
                  function: z.object({ arguments: z.string() }),
                }),
              ]),
            }),
          }),
        ]),
      })
      .parse(JSON.parse(firstEvent));
    expect(
      normalizedEvent.choices[0].delta.tool_calls[0].function.arguments,
    ).toBe('{"status":"open"}');
  });

  it('sends llama.cpp-specific tool and thinking options through the provider', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const upstreamFetch = vi.fn<typeof fetch>(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        id: 'response-1',
        model: 'standup-gemma-4-26b-a4b-q4',
        choices: [
          {
            message: { role: 'assistant', content: 'Ready.' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
      });
    });
    const config = loadLocalModelConfig({});
    const model = createLocalGemmaModel(config, upstreamFetch);

    await generateText({ model, prompt: 'hello' });

    expect(requestBody).toMatchObject({
      model: config.modelId,
      temperature: 0,
      top_p: 0.95,
      top_k: 64,
      chat_template_kwargs: { enable_thinking: false },
      reasoning_effort: 'none',
      parallel_tool_calls: false,
      max_tokens: 4_096,
    });
  });
});
