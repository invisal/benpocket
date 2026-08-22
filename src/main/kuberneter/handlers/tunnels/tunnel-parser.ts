/**
 * Extracts a Cloudflare TryCloudflare tunnel URL from a text chunk or accumulated log.
 * Handles trycloudflare.com domains (e.g. https://recipes-hollow-aud-affect.trycloudflare.com).
 */
export function extractCloudflareTunnelUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i);
  return match ? match[0] : null;
}

/**
 * Extracts an ngrok tunnel URL from text/JSON chunks or accumulated logs.
 * Handles JSON log lines ({"url":"https://xyz.ngrok-free.app"}) and plain text output.
 */
export function extractNgrokTunnelUrl(text: string): string | null {
  if (!text) return null;

  // 1. Try parsing JSON lines if present
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as { url?: string };
        if (typeof parsed.url === 'string' && parsed.url.startsWith('https://')) {
          return parsed.url;
        }
      } catch {
        // Not valid JSON, continue
      }
    }
  }

  // 2. Fallback to regex matching ngrok domains
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.(?:ngrok-free\.app|ngrok\.app|ngrok\.io)/i);
  return match ? match[0] : null;
}
