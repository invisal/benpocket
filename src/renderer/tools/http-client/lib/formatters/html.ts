import type { HighlightToken } from '../jsonHighlight';
import { prettyPrintXml, tokenizeXml } from './xml';

// HTML is tag-structured like XML, so the same lightweight, non-parser tokenizer/indenter
// applies well enough for a read-only highlighted view.
export function prettyPrintHtml(text: string): string {
  return prettyPrintXml(text);
}

export function tokenizeHtml(text: string): HighlightToken[] {
  return tokenizeXml(text);
}
