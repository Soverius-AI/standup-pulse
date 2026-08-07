import { assertLoopbackHostname } from './loopback-host';

describe('assertLoopbackHostname', () => {
  it.each(['127.0.0.1', '127.42.0.9', 'localhost', '::1', '[::1]'])(
    'accepts loopback host %s',
    (hostname) => expect(() => assertLoopbackHostname(hostname)).not.toThrow(),
  );

  it.each(['0.0.0.0', '192.168.1.20', 'api.internal', '::'])(
    'rejects non-loopback host %s',
    (hostname) => expect(() => assertLoopbackHostname(hostname)).toThrow(),
  );
});
