const INDENT = '  ';

/**
 * Lightweight, non-parser XML/HTML pretty-printer: breaks the string between adjacent
 * tags and indents by tracking open/close tag depth. Doesn't validate well-formedness -
 * malformed markup just indents best-effort instead of erroring out.
 */
export function prettyPrintXml(text: string): string {
  const withBreaks = text.trim().replace(/>\s*</g, '>\n<');
  const lines = withBreaks.split('\n');
  let depth = 0;
  const out: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const isClosing = /^<\//.test(line);
    const isSelfClosing = /\/>$/.test(line) || /^<\?/.test(line) || /^<!/.test(line);
    const isOpenAndClose = /^<[^/][^>]*>.*<\/[^>]+>$/.test(line);

    if (isClosing) depth = Math.max(0, depth - 1);
    out.push(INDENT.repeat(depth) + line);
    if (!isClosing && !isSelfClosing && !isOpenAndClose) depth++;
  }

  return out.join('\n');
}
