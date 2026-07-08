export interface OpenToken {
  /** Index of the token's opening `{{` in the field's text. */
  start: number;
  query: string;
}

/** Finds an unfinished `{{name` token ending at the caret, or null if the caret isn't inside one. */
export function findOpenToken(text: string, caret: number): OpenToken | null {
  const before = text.slice(0, caret);
  const openIdx = before.lastIndexOf('{{');
  if (openIdx === -1) return null;
  const between = before.slice(openIdx + 2);
  if (between.includes('}}') || between.includes('{{')) return null;
  return { start: openIdx, query: between.trim() };
}

export function insertVariable(
  text: string,
  token: OpenToken,
  caret: number,
  name: string
): { text: string; caret: number } {
  const after = text.slice(caret);
  // Don't double up a closing `}}` the user already typed (e.g. re-editing inside `{{ }}`).
  const closing = /^\s*}}/.test(after) ? '' : '}}';
  const inserted = `{{${name}${closing}`;
  return { text: text.slice(0, token.start) + inserted + after, caret: token.start + inserted.length };
}
