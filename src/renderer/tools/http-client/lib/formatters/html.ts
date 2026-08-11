import { prettyPrintXml } from './xml';

// HTML is tag-structured like XML, so the same lightweight, non-parser indenter applies well
// enough for a read-only pretty-printed view.
export function prettyPrintHtml(text: string): string {
  return prettyPrintXml(text);
}
