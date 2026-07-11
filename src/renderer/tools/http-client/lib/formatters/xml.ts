import type { HighlightToken } from '../jsonHighlight';

const TAG_CLASS = 'text-sky-400';
const ATTR_NAME_CLASS = 'text-purple-400';
const ATTR_VALUE_CLASS = 'text-emerald-400';
const COMMENT_CLASS = 'text-zinc-600 italic';
const PUNCTUATION_CLASS = 'text-zinc-500';
const DEFAULT_CLASS = 'text-zinc-200';

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

const XML_TOKEN_PATTERN =
  /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w:-]*)|(\s[a-zA-Z][\w:-]*)(=)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\/?>)/g;

export function tokenizeXml(text: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(XML_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex)
      tokens.push({ text: text.slice(lastIndex, index), className: DEFAULT_CLASS });

    const [full, comment, tagOpen, attrName, equals, attrValue, tagClose] = match;
    if (comment) {
      tokens.push({ text: comment, className: COMMENT_CLASS });
    } else if (tagOpen) {
      tokens.push({ text: tagOpen, className: TAG_CLASS });
    } else if (attrName && equals && attrValue) {
      tokens.push({ text: attrName, className: ATTR_NAME_CLASS });
      tokens.push({ text: equals, className: PUNCTUATION_CLASS });
      tokens.push({ text: attrValue, className: ATTR_VALUE_CLASS });
    } else if (tagClose) {
      tokens.push({ text: tagClose, className: TAG_CLASS });
    }
    lastIndex = index + full.length;
  }

  if (lastIndex < text.length)
    tokens.push({ text: text.slice(lastIndex), className: DEFAULT_CLASS });
  return tokens;
}
