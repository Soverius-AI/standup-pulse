import { z } from 'zod';

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string() }).passthrough()),
});

const modelPropertiesSchema = z.object({
  default_generation_settings: z.object({ n_ctx: z.number().int().positive() }),
});

export async function modelIsReady(
  baseUrl: string,
  modelId: string,
  contextSize: number,
  fetchImplementation: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  try {
    const serverRoot = new URL(baseUrl);
    serverRoot.pathname = serverRoot.pathname.replace(/\/v1\/?$/, '/');
    const [healthResponse, modelsResponse, propsResponse] = await Promise.all([
      fetchImplementation(new URL('health', serverRoot), {
        signal: AbortSignal.timeout(1_500),
      }),
      fetchImplementation(`${baseUrl.replace(/\/$/, '')}/models`, {
        signal: AbortSignal.timeout(1_500),
      }),
      fetchImplementation(new URL('props', serverRoot), {
        signal: AbortSignal.timeout(1_500),
      }),
    ]);
    if (!healthResponse.ok || !modelsResponse.ok || !propsResponse.ok) {
      return false;
    }
    const models = modelListSchema.parse(await modelsResponse.json());
    const props = modelPropertiesSchema.parse(await propsResponse.json());
    return (
      models.data.some(({ id }) => id === modelId) &&
      props.default_generation_settings.n_ctx === contextSize
    );
  } catch {
    return false;
  }
}
