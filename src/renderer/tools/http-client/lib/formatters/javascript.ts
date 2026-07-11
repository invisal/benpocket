import type { HighlightToken } from '../jsonHighlight';

const STRING_CLASS = 'text-emerald-400';
const COMMENT_CLASS = 'text-zinc-600 italic';
const NUMBER_CLASS = 'text-amber-400';
const KEYWORD_CLASS = 'text-purple-400';
const PUNCTUATION_CLASS = 'text-zinc-500';
const DEFAULT_CLASS = 'text-zinc-200';

const KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'default',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'in',
  'of',
  'class',
  'extends',
  'super',
  'this',
  'import',
  'export',
  'from',
  'as',
  'async',
  'await',
  'try',
  'catch',
  'finally',
  'throw',
  'yield',
  'true',
  'false',
  'null',
  'undefined',
  'void',
  'static',
  'get',
  'set'
]);

const JS_TOKEN_PATTERN =
  /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|([{}[\]().,;:+\-*/%=<>!&|^~?])/gm;

/** Lightweight regex-based JS tokenizer for read-only syntax highlighting - not a real parser. */
export function tokenizeJavaScript(text: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(JS_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex)
      tokens.push({ text: text.slice(lastIndex, index), className: DEFAULT_CLASS });

    const [full, lineComment, blockComment, template, dquote, squote, num, word, punctuation] =
      match;
    if (lineComment || blockComment) {
      tokens.push({ text: full, className: COMMENT_CLASS });
    } else if (template || dquote || squote) {
      tokens.push({ text: full, className: STRING_CLASS });
    } else if (num) {
      tokens.push({ text: num, className: NUMBER_CLASS });
    } else if (word) {
      tokens.push({ text: word, className: KEYWORDS.has(word) ? KEYWORD_CLASS : DEFAULT_CLASS });
    } else if (punctuation) {
      tokens.push({ text: punctuation, className: PUNCTUATION_CLASS });
    }
    lastIndex = index + full.length;
  }

  if (lastIndex < text.length)
    tokens.push({ text: text.slice(lastIndex), className: DEFAULT_CLASS });
  return tokens;
}
