import { describe, expect, it } from 'vitest';
import { extractCloudflareTunnelUrl, extractNgrokTunnelUrl } from './tunnel-parser';

describe('extractCloudflareTunnelUrl', () => {
  it('extracts URL from TryCloudflare ASCII table banner', () => {
    const log = `
2026-08-22T09:27:58Z INF Requesting new quick Tunnel on trycloudflare.com...
2026-08-22T09:28:09Z INF +--------------------------------------------------------------------------------------------+
2026-08-22T09:28:09Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2026-08-22T09:28:09Z INF |  https://recipes-hollow-aud-affect.trycloudflare.com                                       |
2026-08-22T09:28:09Z INF +--------------------------------------------------------------------------------------------+
`;
    expect(extractCloudflareTunnelUrl(log)).toBe(
      'https://recipes-hollow-aud-affect.trycloudflare.com'
    );
  });

  it('extracts URL from plain text line', () => {
    expect(extractCloudflareTunnelUrl('https://my-test-tunnel-123.trycloudflare.com')).toBe(
      'https://my-test-tunnel-123.trycloudflare.com'
    );
  });

  it('returns null if no TryCloudflare URL is found', () => {
    expect(extractCloudflareTunnelUrl('random error message')).toBeNull();
    expect(extractCloudflareTunnelUrl('')).toBeNull();
  });
});

describe('extractNgrokTunnelUrl', () => {
  it('extracts URL from ngrok JSON log output', () => {
    const jsonLog = `
{"lvl":"info","msg":"client session established","obj":"tunnels.session"}
{"addr":"http://localhost:59999","lvl":"info","msg":"started tunnel","name":"command_line","obj":"tunnels","url":"https://e861-103-193-207-86.ngrok-free.app"}
`;
    expect(extractNgrokTunnelUrl(jsonLog)).toBe('https://e861-103-193-207-86.ngrok-free.app');
  });

  it('extracts URL from ngrok paid domain (.ngrok.app / .ngrok.io)', () => {
    const textLog = 'Forwarding https://custom-app.ngrok.app -> http://localhost:8080';
    expect(extractNgrokTunnelUrl(textLog)).toBe('https://custom-app.ngrok.app');

    const legacyLog = 'Forwarding https://test-123.ngrok.io -> http://localhost:3000';
    expect(extractNgrokTunnelUrl(legacyLog)).toBe('https://test-123.ngrok.io');
  });

  it('returns null if no ngrok URL is found', () => {
    expect(extractNgrokTunnelUrl('{"msg":"no tunnel"}')).toBeNull();
    expect(extractNgrokTunnelUrl('something went wrong')).toBeNull();
    expect(extractNgrokTunnelUrl('')).toBeNull();
  });
});
