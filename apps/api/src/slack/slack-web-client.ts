import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

const MAX_ATTEMPTS = 3;
const AUTHENTICATION_ERROR_CODES = new Set([
  'account_inactive',
  'invalid_auth',
  'not_authed',
  'token_revoked',
]);

export class SlackApiError extends Error {
  override readonly name = 'SlackApiError';

  constructor(
    method: string,
    readonly code?: string,
  ) {
    super(`Slack API call failed: ${method}`);
  }

  get isAuthenticationError(): boolean {
    return this.code !== undefined && AUTHENTICATION_ERROR_CODES.has(this.code);
  }
}

export interface SlackWebClientOptions {
  token: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class SlackWebClient {
  private readonly fetch: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: SlackWebClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
    this.sleep = options.sleep ?? ((milliseconds) => delay(milliseconds));
  }

  async authTest(): Promise<Set<string>> {
    const response = await this.request('https://slack.com/api/auth.test', {
      headers: this.headers(),
    });
    const payload = await readSlackPayload(response);
    if (!response.ok || payload['ok'] !== true) {
      throw new Error('Slack bot authentication failed');
    }
    return new Set(
      (response.headers.get('x-oauth-scopes') ?? '')
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean),
    );
  }

  async api(
    method: string,
    body: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.request(`https://slack.com/api/${method}`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
        });
        const payload = await readSlackPayload(response);
        if (response.ok && payload['ok'] === true) return payload;

        const code =
          typeof payload['error'] === 'string' ? payload['error'] : undefined;
        if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status)) {
          await this.sleep(retryDelay(response, attempt));
          continue;
        }
        throw new SlackApiError(method, code);
      } catch (error) {
        if (error instanceof SlackApiError || attempt >= MAX_ATTEMPTS) {
          throw error;
        }
        await this.sleep(backoffDelay(attempt));
      }
    }
    throw new SlackApiError(method);
  }

  private request(url: string, init: RequestInit): Promise<Response> {
    return this.fetch(url, {
      ...init,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.options.token}`,
      'content-type': 'application/json; charset=utf-8',
    };
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffDelay(attempt: number): number {
  return 250 * 2 ** (attempt - 1);
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfterSeconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds * 1_000
    : backoffDelay(attempt);
}

const SlackPayloadSchema = z.record(z.unknown());

async function readSlackPayload(
  response: Response,
): Promise<Record<string, unknown>> {
  const payload = SlackPayloadSchema.safeParse(await response.json());
  if (!payload.success) {
    throw new Error('Slack returned an invalid response');
  }
  return payload.data;
}
