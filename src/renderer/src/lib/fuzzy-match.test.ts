import { describe, expect, it } from 'vitest';
import { fuzzyMatch } from './fuzzy-match';

describe('fuzzyMatch', () => {
  it('matches a contiguous substring', () => {
    expect(fuzzyMatch('Search Actions', 'search')).toEqual({
      matched: true,
      indices: [0, 1, 2, 3, 4, 5]
    });
  });

  it('matches a non-contiguous subsequence', () => {
    expect(fuzzyMatch('Search', 'srch')).toEqual({ matched: true, indices: [0, 3, 4, 5] });
  });

  it('is case-insensitive and greedily matches the earliest occurrence of each character', () => {
    expect(fuzzyMatch('Screen Capture', 'SC')).toEqual({ matched: true, indices: [0, 1] });
  });

  it('fails when characters are out of order', () => {
    expect(fuzzyMatch('Search', 'hs')).toEqual({ matched: false, indices: [] });
  });

  it('fails when a character is missing entirely', () => {
    expect(fuzzyMatch('Search', 'searchz')).toEqual({ matched: false, indices: [] });
  });

  it('matches everything for a blank query', () => {
    expect(fuzzyMatch('Search', '  ')).toEqual({ matched: true, indices: [] });
  });
});
