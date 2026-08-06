#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

if (process.env.RUN_LOCAL_MODEL_TESTS !== '1') {
  console.log(
    'SKIP: set RUN_LOCAL_MODEL_TESTS=1 to run against an already-running local model.',
  );
  process.exit(0);
}

const baseUrl = (
  process.env.LOCAL_LLM_BASE_URL ?? 'http://127.0.0.1:8080/v1'
).replace(/\/$/, '');
const modelId = process.env.LOCAL_LLM_MODEL_ID ?? 'standup-gemma-4-26b-a4b-q4';
const timeoutMs = Number(process.env.LOCAL_LLM_REQUEST_TIMEOUT_MS ?? 30_000);

async function request(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok)
    throw new Error(
      `${new URL(url).pathname} returned ${response.status}: ${await response.text()}`,
    );
  return response.json();
}

const startedAt = performance.now();
const serverRoot = new URL(baseUrl);
serverRoot.pathname = serverRoot.pathname.replace(/\/v1$/, '/');
const health = await request(new URL('health', serverRoot));
const models = await request(`${baseUrl}/models`);
const propsUrl = new URL('props', serverRoot);
const propsResponse = await fetch(propsUrl, {
  signal: AbortSignal.timeout(timeoutMs),
});
if (!propsResponse.ok)
  throw new Error(`/props returned ${propsResponse.status}`);
const props = await propsResponse.json();

if (health.status !== 'ok')
  throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
if (!models.data?.some((model) => model.id === modelId))
  throw new Error(`Model alias ${modelId} is not loaded`);
if (props.default_generation_settings?.n_ctx !== 16_384) {
  throw new Error(
    `Expected a 16384-token context, got ${props.default_generation_settings?.n_ctx}`,
  );
}

const completion = await request(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model: modelId,
    messages: [{ role: 'user', content: 'Show the team pulse for today.' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'getTeamPulse',
          description:
            'Get aggregate standup participation for the authenticated team.',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: 'auto',
    temperature: 1,
    top_p: 0.95,
    top_k: 64,
    parallel_tool_calls: false,
    chat_template_kwargs: { enable_thinking: false },
    reasoning_effort: 'none',
  }),
});

const toolCall = completion.choices?.[0]?.message?.tool_calls?.[0];
if (toolCall?.function?.name !== 'getTeamPulse') {
  throw new Error(
    `Expected getTeamPulse, got ${toolCall?.function?.name ?? 'no tool'}`,
  );
}

console.log(
  JSON.stringify(
    {
      status: 'passed',
      modelId,
      elapsedMs: Math.round(performance.now() - startedAt),
      usage: completion.usage ?? null,
      timings: completion.timings ?? null,
    },
    null,
    2,
  ),
);
