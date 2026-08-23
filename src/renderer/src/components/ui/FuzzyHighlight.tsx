import type { ReactNode } from 'react';
import { fuzzyMatch } from '@renderer/lib/fuzzy-match';

interface FuzzyHighlightProps {
  text: string;
  query: string;
}

/** Wraps each fuzzy-matched character of `query` inside `text` in a `<mark>`, merging adjacent matched characters into a single run. Pairs with `fuzzyMatch` -- use `HighlightMatch` instead for plain substring matching. */
export function FuzzyHighlight({ text, query }: FuzzyHighlightProps): ReactNode {
  const { indices } = fuzzyMatch(text, query);
  if (indices.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let i = 0;

  while (i < indices.length) {
    let runEnd = i;
    while (runEnd + 1 < indices.length && indices[runEnd + 1] === indices[runEnd] + 1) {
      runEnd += 1;
    }
    const start = indices[i];
    const end = indices[runEnd] + 1;

    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark key={start} className="bg-accent/20 text-accent">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
    i = runEnd + 1;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
