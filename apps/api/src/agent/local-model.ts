import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { LanguageModel } from 'ai';
import { z } from 'zod';

export const DEFAULT_LOCAL_MODEL_ID = 'standup-gemma-4-26b-a4b-q4';
export const DEFAULT_LOCAL_MODEL_BASE_URL = 'http://127.0.0.1:8080/v1';

const localModelEnvironmentSchema = z.object({
  LOCAL_LLM_BASE_URL: z.string().url().default(DEFAULT_LOCAL_MODEL_BASE_URL),
  LOCAL_LLM_MODEL_ID: z.string().min(1).default(DEFAULT_LOCAL_MODEL_ID),
  LOCAL_LLM_API_KEY: z.string().min(1).optional(),
  LOCAL_LLM_CONTEXT_SIZE: z.coerce
    .number()
    .int()
    .min(4_096)
    .max(262_144)
    .default(131_072),
  LOCAL_LLM_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(256)
    .max(32_768)
    .default(4_096),
});

export interface LocalModelConfig {
  readonly baseUrl: string;
  readonly modelId: string;
  readonly apiKey?: string;
  readonly contextSize: number;
  readonly maxOutputTokens: number;
  readonly temperature: 0;
  readonly topP: 0.95;
  readonly topK: 64;
  readonly thinking: false;
}

export type LocalLanguageModel = Extract<MastraModelConfig, LanguageModel>;

export function loadLocalModelConfig(
  environment: Record<string, string | undefined> = process.env,
): LocalModelConfig {
  const parsed = localModelEnvironmentSchema.parse(environment);

  return {
    baseUrl: parsed.LOCAL_LLM_BASE_URL.replace(/\/$/, ''),
    modelId: parsed.LOCAL_LLM_MODEL_ID,
    ...(parsed.LOCAL_LLM_API_KEY ? { apiKey: parsed.LOCAL_LLM_API_KEY } : {}),
    contextSize: parsed.LOCAL_LLM_CONTEXT_SIZE,
    maxOutputTokens: parsed.LOCAL_LLM_MAX_OUTPUT_TOKENS,
    temperature: 0,
    topP: 0.95,
    topK: 64,
    thinking: false,
  };
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * llama.cpp briefly returned function.arguments as an object instead of the
 * OpenAI-compatible JSON string. Normalize both full and streaming response
 * shapes before the AI SDK validates them.
 */
export function normalizeOpenAiToolArguments(payload: unknown): unknown {
  if (!isJsonObject(payload) || !Array.isArray(payload['choices'])) {
    return payload;
  }

  for (const choice of payload['choices']) {
    if (!isJsonObject(choice)) continue;

    for (const responsePartName of ['message', 'delta'] as const) {
      const responsePart = choice[responsePartName];
      if (
        !isJsonObject(responsePart) ||
        !Array.isArray(responsePart['tool_calls'])
      )
        continue;

      for (const toolCall of responsePart['tool_calls']) {
        if (!isJsonObject(toolCall) || !isJsonObject(toolCall['function']))
          continue;

        const argumentsValue = toolCall['function']['arguments'];
        if (isJsonObject(argumentsValue) || Array.isArray(argumentsValue)) {
          toolCall['function']['arguments'] = JSON.stringify(argumentsValue);
        }
      }
    }
  }

  return payload;
}

function normalizedResponseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return headers;
}

function normalizeServerSentEventLine(line: string): string {
  if (!line.startsWith('data:')) return line;

  const prefix = line.startsWith('data: ') ? 'data: ' : 'data:';
  const data = line.slice(prefix.length);
  if (data === '[DONE]' || data.trim() === '') return line;

  try {
    return `${prefix}${JSON.stringify(normalizeOpenAiToolArguments(JSON.parse(data)))}`;
  } catch {
    return line;
  }
}

function normalizeEventStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = '';

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffered += decoder.decode(chunk, { stream: true });
        const lines = buffered.split('\n');
        buffered = lines.pop() ?? '';

        for (const line of lines) {
          controller.enqueue(
            encoder.encode(`${normalizeServerSentEventLine(line)}\n`),
          );
        }
      },
      flush(controller) {
        buffered += decoder.decode();
        if (buffered !== '') {
          controller.enqueue(
            encoder.encode(normalizeServerSentEventLine(buffered)),
          );
        }
      },
    }),
  );
}

export function createLlamaCppFetch(
  fetchImplementation: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input, init) => {
    const response = await fetchImplementation(input, init);
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const text = await response.text();
      try {
        const normalized = normalizeOpenAiToolArguments(JSON.parse(text));
        return new Response(JSON.stringify(normalized), {
          status: response.status,
          statusText: response.statusText,
          headers: normalizedResponseHeaders(response),
        });
      } catch {
        return new Response(text, {
          status: response.status,
          statusText: response.statusText,
          headers: normalizedResponseHeaders(response),
        });
      }
    }

    if (contentType.includes('text/event-stream') && response.body) {
      return new Response(normalizeEventStream(response.body), {
        status: response.status,
        statusText: response.statusText,
        headers: normalizedResponseHeaders(response),
      });
    }

    return response;
  };
}

export function createLocalGemmaModel(
  config: LocalModelConfig = loadLocalModelConfig(),
  fetchImplementation: typeof fetch = globalThis.fetch,
): LocalLanguageModel {
  const provider = createOpenAICompatible({
    name: 'llamaCpp',
    baseURL: config.baseUrl,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    includeUsage: true,
    supportsStructuredOutputs: true,
    fetch: createLlamaCppFetch(fetchImplementation),
    transformRequestBody: (body) => ({
      ...body,
      temperature:
        typeof body['temperature'] === 'number'
          ? body['temperature']
          : config.temperature,
      top_p: config.topP,
      top_k: config.topK,
      chat_template_kwargs: { enable_thinking: config.thinking },
      reasoning_effort: 'none',
      parallel_tool_calls: false,
      max_tokens:
        typeof body['max_tokens'] === 'number'
          ? body['max_tokens']
          : config.maxOutputTokens,
    }),
  });

  return provider.chatModel(config.modelId);
}
