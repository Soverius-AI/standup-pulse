import { modelIsReady } from './model-readiness';

describe('modelIsReady', () => {
  const response = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  it('requires the loaded alias and configured context size', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response({ status: 'ok' }))
      .mockResolvedValueOnce(response({ data: [{ id: 'local-gemma' }] }))
      .mockResolvedValueOnce(
        response({ default_generation_settings: { n_ctx: 131_072 } }),
      );

    await expect(
      modelIsReady('http://127.0.0.1:8080/v1', 'local-gemma', 131_072, fetch),
    ).resolves.toBe(true);
  });

  it('rejects a healthy server with the wrong context size', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response({ status: 'ok' }))
      .mockResolvedValueOnce(response({ data: [{ id: 'local-gemma' }] }))
      .mockResolvedValueOnce(
        response({ default_generation_settings: { n_ctx: 16_384 } }),
      );

    await expect(
      modelIsReady('http://127.0.0.1:8080/v1', 'local-gemma', 131_072, fetch),
    ).resolves.toBe(false);
  });

  it('fails closed when llama.cpp metadata has an unexpected shape', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response({ status: 'ok' }))
      .mockResolvedValueOnce(response({ data: [{ id: 42 }] }))
      .mockResolvedValueOnce(
        response({ default_generation_settings: { n_ctx: '131072' } }),
      );

    await expect(
      modelIsReady('http://127.0.0.1:8080/v1', 'local-gemma', 131_072, fetch),
    ).resolves.toBe(false);
  });
});
