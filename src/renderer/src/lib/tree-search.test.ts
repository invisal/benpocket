import { describe, expect, it } from 'vitest';
import { filterTreeKeepingAncestors } from './tree-search';

interface Node {
  id: string;
  name: string;
  children?: Node[];
}

const getId = (n: Node): string => n.id;
const getChildren = (n: Node): Node[] | undefined => n.children;

const tree: Node[] = [
  {
    id: 'documents',
    name: 'Documents',
    children: [
      {
        id: 'reports',
        name: 'Reports',
        children: [
          { id: 'q1', name: 'Q1.pdf' },
          { id: 'q2', name: 'Q2.pdf' }
        ]
      },
      { id: 'notes', name: 'Notes.md' }
    ]
  },
  { id: 'readme', name: 'README.md' }
];

const matches =
  (query: string) =>
  (n: Node): boolean =>
    n.name.toLowerCase().includes(query.toLowerCase());

describe('filterTreeKeepingAncestors', () => {
  it('pulls in the full ancestor chain for a leaf match', () => {
    const result = filterTreeKeepingAncestors(tree, getId, getChildren, matches('q1'));
    expect(result.visibleIds).toEqual(new Set(['documents', 'reports', 'q1']));
    expect(result.matchIds).toEqual(new Set(['q1']));
    expect(result.expandIds).toEqual(new Set(['documents', 'reports']));
  });

  it('does not pull in unrelated siblings of a matched ancestor chain', () => {
    const result = filterTreeKeepingAncestors(tree, getId, getChildren, matches('q1'));
    expect(result.visibleIds.has('notes')).toBe(false);
    expect(result.visibleIds.has('readme')).toBe(false);
  });

  it('includes a container match without expanding it when nothing inside it also matches', () => {
    const result = filterTreeKeepingAncestors(tree, getId, getChildren, matches('reports'));
    expect(result.visibleIds).toEqual(new Set(['documents', 'reports']));
    expect(result.matchIds).toEqual(new Set(['reports']));
    expect(result.expandIds).toEqual(new Set(['documents']));
  });

  it('returns empty sets when nothing matches', () => {
    const result = filterTreeKeepingAncestors(tree, getId, getChildren, matches('nope'));
    expect(result.visibleIds.size).toBe(0);
    expect(result.matchIds.size).toBe(0);
    expect(result.expandIds.size).toBe(0);
  });

  it('keeps a root-level match visible with no expandIds needed', () => {
    const result = filterTreeKeepingAncestors(tree, getId, getChildren, matches('readme'));
    expect(result.visibleIds).toEqual(new Set(['readme']));
    expect(result.matchIds).toEqual(new Set(['readme']));
    expect(result.expandIds.size).toBe(0);
  });
});
