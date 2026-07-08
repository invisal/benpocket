export interface HighlightToken {
  text: string;
  className: string;
}

const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\]:,])/g;

const STRING_KEY_CLASS = 'text-sky-400';
const STRING_VALUE_CLASS = 'text-emerald-400';
const NUMBER_CLASS = 'text-amber-400';
const KEYWORD_CLASS = 'text-purple-400';
const PUNCTUATION_CLASS = 'text-zinc-500';
const DEFAULT_CLASS = 'text-zinc-200';

/**
 * Lightweight regex-based JSON tokenizer for syntax-color highlighting a raw text body.
 * Doesn't require (or validate) well-formed JSON - it just colors recognizable tokens
 * and leaves everything else in the default color, so partially-typed JSON still renders
 * sensibly instead of erroring out.
 */
export function tokenizeJson(text: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(JSON_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ text: text.slice(lastIndex, index), className: DEFAULT_CLASS });

    const [full, str, colon, num, keyword, punctuation] = match;
    if (str) {
      tokens.push({ text: str, className: colon ? STRING_KEY_CLASS : STRING_VALUE_CLASS });
      if (colon) tokens.push({ text: colon, className: PUNCTUATION_CLASS });
    } else if (num) {
      tokens.push({ text: num, className: NUMBER_CLASS });
    } else if (keyword) {
      tokens.push({ text: keyword, className: KEYWORD_CLASS });
    } else if (punctuation) {
      tokens.push({ text: punctuation, className: PUNCTUATION_CLASS });
    }
    lastIndex = index + full.length;
  }

  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex), className: DEFAULT_CLASS });
  return tokens;
}
