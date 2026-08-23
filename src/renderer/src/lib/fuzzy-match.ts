export interface FuzzyMatchResult {
  matched: boolean;
  /** Positions in `text` that matched a query character, in order -- for highlighting. Empty when `matched` is false or `query` is blank. */
  indices: number[];
}

/**
 * Case-insensitive subsequence fuzzy match: every character of `query` must
 * appear in `text`, in order, though not necessarily contiguously (e.g.
 * "srch" matches "search"). A blank query matches everything.
 */
export function fuzzyMatch(text: string, query: string): FuzzyMatchResult {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return { matched: true, indices: [] };

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();

  const indices: number[] = [];
  let searchFrom = 0;

  for (const char of lowerQuery) {
    const foundAt = lowerText.indexOf(char, searchFrom);
    if (foundAt === -1) return { matched: false, indices: [] };
    indices.push(foundAt);
    searchFrom = foundAt + 1;
  }

  return { matched: true, indices };
}
