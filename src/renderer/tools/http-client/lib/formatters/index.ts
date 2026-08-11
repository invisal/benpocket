import type { ResponseFormat } from '../responseFormat';
import { prettyPrintHtml } from './html';
import { prettyPrintXml } from './xml';

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
