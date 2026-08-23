import type { ReactNode } from 'react';

interface HighlightMatchProps {
  text: string;
  query: string;
}

/** Wraps every occurrence of `query` inside `text` in a `<mark>`. Case-insensitive; renders `text` unchanged when `query` is blank. */
export function HighlightMatch({ text, query }: HighlightMatchProps): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const escaped = trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return parts.map((part, i) =>
    // `.split` with a capturing group alternates non-match/match starting at
    // index 0, so odd indices are always the matched substrings.
    i % 2 === 1 ? (
      <mark key={i} className="bg-accent/20 text-accent">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
