export interface ParsedLocation {
  scheme: 'local' | 'r2';
  /** For 'local': the OS path, unchanged. For 'r2': `<bucket>[/<key>]`. */
  path: string;
}

const SCHEME_PREFIX = /^([a-z][a-z0-9+.-]*):\/\//i;

/**
 * Any string without an explicit `scheme://` prefix is treated as a local path --
 * i.e. today's bare OS paths (`C:\Users\...`, `/home/...`) keep working unchanged.
 * Windows drive letters never match `SCHEME_PREFIX` since it requires `://`.
 */
export function parseLocation(id: string): ParsedLocation {
  const match = id.match(SCHEME_PREFIX);
  if (!match) {
    return { scheme: 'local', path: id };
  }

  const scheme = match[1].toLowerCase();
  if (scheme === 'r2') {
    return { scheme: 'r2', path: id.slice(match[0].length) };
  }

  return { scheme: 'local', path: id };
}
