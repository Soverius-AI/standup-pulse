import { isIP } from 'node:net';

export function assertLoopbackHostname(hostname: string): void {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const loopback =
    normalized === 'localhost' ||
    normalized === '::1' ||
    (isIP(normalized) === 4 && normalized.startsWith('127.'));

  if (!loopback) {
    throw new Error(
      `Refusing to expose the unauthenticated local-admin API on non-loopback host ${hostname}`,
    );
  }
}
