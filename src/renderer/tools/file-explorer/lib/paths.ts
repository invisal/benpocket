export interface PathSegment {
  label: string;
  path: string;
}

/**
 * Splits an absolute path into clickable breadcrumb segments. Handles both
 * POSIX (`/Users/x`) and Windows (`C:\Users\x`) separators purely by string
 * inspection -- the real filesystem operations happen in the main process via
 * `path`/`fs`, so a mis-split here only affects a breadcrumb label, never
 * navigation correctness.
 */
export function splitPathSegments(fullPath: string): PathSegment[] {
  const isWindows = /^[a-zA-Z]:[\\/]/.test(fullPath);
  const normalized = fullPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const segments: PathSegment[] = [];

  if (isWindows) {
    const drive = parts.shift();
    if (drive) {
      let acc = `${drive}\\`;
      segments.push({ label: drive, path: acc });
      for (const part of parts) {
        acc = `${acc}${part}\\`;
        segments.push({ label: part, path: acc.replace(/\\$/, '') });
      }
    }
  } else {
    segments.push({ label: '/', path: '/' });
    let acc = '';
    for (const part of parts) {
      acc = `${acc}/${part}`;
      segments.push({ label: part, path: acc });
    }
  }

  return segments;
}

export function getParentPath(fullPath: string): string | null {
  const segments = splitPathSegments(fullPath);
  if (segments.length <= 1) return null;
  return segments[segments.length - 2].path;
}
