/**
 * Minimal indentation-based YAML parser covering the common subset seen in API
 * responses: block/flow maps and sequences, quoted/plain scalars, comments.
 * No support for anchors/aliases, multi-line block scalars (| or >), or tabs —
 * callers should treat parse failures/odd results as best-effort.
 */

interface Line {
  indent: number;
  content: string;
}

function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function preprocess(text: string): Line[] {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const lines: Line[] = [];

  for (const raw of rawLines) {
    const stripped = stripComment(raw).replace(/\s+$/, '');
    const trimmed = stripped.trim();
    if (!trimmed) continue;
    if (/^(---|\.\.\.)$/.test(trimmed)) continue;

    const indent = stripped.length - stripped.trimStart().length;

    if (trimmed === '-') {
      lines.push({ indent, content: '-' });
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const afterDash = stripped.slice(indent + 1);
      const afterDashTrimmed = afterDash.trimStart();
      const dashLeadingSpaces = afterDash.length - afterDashTrimmed.length;
      lines.push({ indent, content: '-' });
      lines.push({ indent: indent + 1 + dashLeadingSpaces, content: afterDashTrimmed.trim() });
      continue;
    }

    lines.push({ indent, content: trimmed });
  }

  return lines;
}

function findUnquotedColon(s: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ':' && !inSingle && !inDouble) {
      if (i === s.length - 1 || s[i + 1] === ' ') return i;
    }
  }
  return -1;
}

function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let current = '';

  for (const ch of s) {
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;

    if (!inSingle && !inDouble) {
      if (ch === '[' || ch === '{') depth++;
      if (ch === ']' || ch === '}') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim() !== '') parts.push(current);
  return parts;
}

function unquote(s: string): string {
  if (/^"(?:[^"\\]|\\.)*"$/.test(s)) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (/^'(?:[^']|'')*'$/.test(s)) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function parseFlowSequence(s: string): unknown[] {
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  return splitTopLevel(inner).map((part) => parseScalar(part.trim()));
}

function parseFlowMapping(s: string): Record<string, unknown> {
  const inner = s.slice(1, -1).trim();
  const obj: Record<string, unknown> = {};
  if (!inner) return obj;
  for (const part of splitTopLevel(inner)) {
    const idx = findUnquotedColon(part);
    if (idx === -1) continue;
    obj[unquote(part.slice(0, idx).trim())] = parseScalar(part.slice(idx + 1).trim());
  }
  return obj;
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === '' || s === '~' || /^null$/i.test(s)) return null;
  if (/^true$/i.test(s)) return true;
  if (/^false$/i.test(s)) return false;
  if (/^"(?:[^"\\]|\\.)*"$/.test(s) || /^'(?:[^']|'')*'$/.test(s)) return unquote(s);
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
  if (s.startsWith('[') && s.endsWith(']')) return parseFlowSequence(s);
  if (s.startsWith('{') && s.endsWith('}')) return parseFlowMapping(s);
  return s;
}

class Cursor {
  pos = 0;
  constructor(private lines: Line[]) {}
  peek(): Line | undefined {
    return this.lines[this.pos];
  }
  next(): Line | undefined {
    return this.lines[this.pos++];
  }
  get done(): boolean {
    return this.pos >= this.lines.length;
  }
}

function parseSequence(cur: Cursor, indent: number): unknown[] {
  const items: unknown[] = [];
  while (!cur.done) {
    const line = cur.peek();
    if (!line || line.indent !== indent || line.content !== '-') break;
    cur.next();
    const next = cur.peek();
    if (next && next.indent > indent) {
      items.push(parseBlock(cur, next.indent));
    } else {
      items.push(null);
    }
  }
  return items;
}

function parseMapping(cur: Cursor, indent: number): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  while (!cur.done) {
    const line = cur.peek();
    if (!line || line.indent !== indent) break;
    const splitIdx = findUnquotedColon(line.content);
    if (splitIdx === -1) break;
    cur.next();
    const key = unquote(line.content.slice(0, splitIdx).trim());
    const valuePart = line.content.slice(splitIdx + 1).trim();
    if (valuePart === '') {
      const next = cur.peek();
      obj[key] = next && next.indent > indent ? parseBlock(cur, next.indent) : null;
    } else {
      obj[key] = parseScalar(valuePart);
    }
  }
  return obj;
}

function parseBlock(cur: Cursor, indent: number): unknown {
  const first = cur.peek();
  if (!first || first.indent < indent) return null;
  if (first.content === '-') return parseSequence(cur, indent);
  if (findUnquotedColon(first.content) !== -1) return parseMapping(cur, indent);
  cur.next();
  return parseScalar(first.content);
}

/** Best-effort parse of a YAML document into plain JS values. Throws on totally empty input. */
export function parseYaml(text: string): unknown {
  const lines = preprocess(text);
  if (lines.length === 0) return null;
  const cur = new Cursor(lines);
  return parseBlock(cur, lines[0].indent);
}
