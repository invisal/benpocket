import type { HighlightToken } from '../jsonHighlight';
import { tokenizeJson } from '../jsonHighlight';
import type { ResponseFormat } from '../responseFormat';
import { prettyPrintHtml, tokenizeHtml } from './html';
import { tokenizeJavaScript } from './javascript';
import { prettyPrintXml, tokenizeXml } from './xml';
import { tokenizeYaml } from './yaml';

const PLAIN_CLASS = 'text-zinc-200';

/** Best-effort pretty-print for the given format. Falls back to the original text on failure. */
export function getPrettyText(format: ResponseFormat, text: string): string {
  switch (format) {
    case 'json':
      try {
        return JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        return text;
      }
    case 'xml':
      return prettyPrintXml(text);
    case 'html':
      return prettyPrintHtml(text);
    default:
      return text;
  }
}

/** Maps formatted text to highlight tokens for the given format. Raw/hex/base64 get no highlighting. */
export function getTokens(format: ResponseFormat, prettyText: string): HighlightToken[] {
  switch (format) {
    case 'json':
      return tokenizeJson(prettyText);
    case 'xml':
      return tokenizeXml(prettyText);
    case 'html':
      return tokenizeHtml(prettyText);
    case 'yaml':
      return tokenizeYaml(prettyText);
    case 'javascript':
      return tokenizeJavaScript(prettyText);
    default:
      return [{ text: prettyText, className: PLAIN_CLASS }];
  }
}
