export interface TreeSearchResult {
  /** Every node that should remain visible: matches plus all of their ancestors. */
  visibleIds: Set<string>;
  /** The subset of visibleIds that actually satisfied the predicate (for highlight/styling). */
  matchIds: Set<string>;
  /** Ancestor container nodes that must be in `expanded` to reveal a descendant match. */
  expandIds: Set<string>;
}

/**
 * Walks a tree and keeps every node that matches `predicate` plus all of its
 * ancestors, so a filtered `TreeList` still shows matches in context instead
 * of as orphan rows with no parent chain. Matching itself is entirely the
 * caller's concern -- `predicate` can be substring, fuzzy, regex, whatever --
 * this only owns the tree-walk and ancestor-preservation.
 */
export function filterTreeKeepingAncestors<T>(
  data: T[],
  getId: (node: T) => string,
  getChildren: (node: T) => T[] | undefined,
  predicate: (node: T) => boolean
): TreeSearchResult {
  const visibleIds = new Set<string>();
  const matchIds = new Set<string>();
  const expandIds = new Set<string>();

  const walk = (node: T): boolean => {
    const id = getId(node);
    const children = getChildren(node) ?? [];
    const anyChildKept = children.reduce((kept, child) => walk(child) || kept, false);
    const isMatch = predicate(node);
    const kept = isMatch || anyChildKept;

    if (isMatch) matchIds.add(id);
    if (kept) visibleIds.add(id);
    if (anyChildKept) expandIds.add(id);

    return kept;
  };

  data.forEach(walk);

  return { visibleIds, matchIds, expandIds };
}
