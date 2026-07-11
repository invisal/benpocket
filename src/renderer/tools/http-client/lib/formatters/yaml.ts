import type { HighlightToken } from '../jsonHighlight';

const KEY_CLASS = 'text-sky-400';
const STRING_CLASS = 'text-emerald-400';
const NUMBER_CLASS = 'text-amber-400';
const KEYWORD_CLASS = 'text-purple-400';
const COMMENT_CLASS = 'text-zinc-600 italic';
const PUNCTUATION_CLASS = 'text-zinc-500';
const DEFAULT_CLASS = 'text-zinc-200';

function tokenizeScalar(text: string): HighlightToken[] {
  if (/^\s*#/.test(text)) return [{ text, className: COMMENT_CLASS }];
  const quoted = text.match(/^(\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(.*)$/);
  if (quoted) {
    const [, lead, value, rest] = quoted;
    return [
      { text: lead, className: DEFAULT_CLASS },
      { text: value, className: STRING_CLASS },
      ...(rest ? tokenizeScalar(rest) : [])
    ];
  }
  if (/^\s*(true|false|null|~)\s*$/i.test(text)) return [{ text, className: KEYWORD_CLASS }];
  if (/^\s*-?\d+\.?\d*\s*$/.test(text)) return [{ text, className: NUMBER_CLASS }];
  return [{ text, className: DEFAULT_CLASS }];
}

/** Line-oriented YAML tokenizer: colors keys, list markers, comments, strings and scalars per line. */
export function tokenizeYaml(text: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const commentOnly = line.match(/^(\s*)(#.*)$/);
    if (commentOnly) {
      tokens.push({ text: commentOnly[1], className: DEFAULT_CLASS });
      tokens.push({ text: commentOnly[2], className: COMMENT_CLASS });
    } else {
      const kv = line.match(/^(\s*(?:-\s+)?)([^:#]+?)(:)(\s.*|)$/);
      if (kv) {
        const [, lead, key, colon, rest] = kv;
        tokens.push({ text: lead, className: PUNCTUATION_CLASS });
        tokens.push({ text: key, className: KEY_CLASS });
        tokens.push({ text: colon, className: PUNCTUATION_CLASS });
        if (rest) tokens.push(...tokenizeScalar(rest));
      } else {
        const listItem = line.match(/^(\s*-\s+)(.*)$/);
        if (listItem) {
          const [, lead, rest] = listItem;
          tokens.push({ text: lead, className: PUNCTUATION_CLASS });
          tokens.push(...tokenizeScalar(rest));
        } else if (line.trim()) {
          tokens.push(...tokenizeScalar(line));
        } else {
          tokens.push({ text: line, className: DEFAULT_CLASS });
        }
      }
    }
    if (i < lines.length - 1) tokens.push({ text: '\n', className: DEFAULT_CLASS });
  });

  return tokens;
}
