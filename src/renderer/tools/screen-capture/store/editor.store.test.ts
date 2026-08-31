import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PEN_SNAP_SHAPES,
  defaultToolStyles,
  EDITOR_COLORS,
  sanitizePrefs,
  snappedShapeStyle,
  STROKE_TIERS,
  type PersistedEditorPrefs
} from './editor.store';

/**
 * Mirrors use-screen-capture-settings' readFields: prefs go through the Yjs doc
 * as plain JSON, come back through sanitizePrefs, and get rebuilt in
 * getPersistedPrefs' key order.
 */
function roundTrip(prefs: PersistedEditorPrefs): PersistedEditorPrefs {
  const stored = sanitizePrefs(JSON.parse(JSON.stringify(prefs)) as unknown);
  return {
    toolStyles: stored.toolStyles ?? defaultToolStyles(),
    penSnapShapes: stored.penSnapShapes ?? { ...DEFAULT_PEN_SNAP_SHAPES },
    highlightSnap: stored.highlightSnap ?? true,
    highlightSquareEnds: stored.highlightSquareEnds ?? true,
    watermark: stored.watermark ?? true,
    background: 'background' in stored ? (stored.background ?? null) : null,
    cornerRadiusUnits: stored.cornerRadiusUnits ?? 0
  };
}

function samplePrefs(): PersistedEditorPrefs {
  const toolStyles = defaultToolStyles();
  return {
    toolStyles: {
      ...toolStyles,
      // Restyling a non-active tool is the case that used to get stomped.
      chip: { ...toolStyles.chip, color: EDITOR_COLORS[3] },
      pen: { ...toolStyles.pen, strokeTier: STROKE_TIERS.at(-1)!.value }
    },
    penSnapShapes: { ...DEFAULT_PEN_SNAP_SHAPES, arrow: false },
    highlightSnap: false,
    highlightSquareEnds: true,
    watermark: false,
    background: null,
    cornerRadiusUnits: 3
  };
}

describe('persisted prefs round-trip', () => {
  // ScreenCaptureMain detects its own echo off the profile doc by comparing
  // JSON.stringify(getPersistedPrefs()) against what readFields hands back. If
  // that round trip is not byte-identical -- reordered keys, dropped field,
  // over-eager sanitizing -- the echo guard misses and every local edit gets
  // reverted by the store update it just caused.
  it('is byte-identical through the doc, so the echo guard matches', () => {
    const prefs = samplePrefs();
    expect(JSON.stringify(roundTrip(prefs))).toBe(JSON.stringify(prefs));
  });

  it('still reports a genuine external change as different', () => {
    const prefs = samplePrefs();
    const remote = roundTrip({ ...prefs, watermark: true });
    expect(JSON.stringify(remote)).not.toBe(JSON.stringify(prefs));
  });
});

describe('snappedShapeStyle', () => {
  // Free-draw snap used to stamp the pen's working color/stroke onto the
  // line/arrow/rect/circle it produced, ignoring that tool's saved style.
  it('uses the snapped kind\u2019s saved style, not the pen\u2019s', () => {
    const toolStyles = defaultToolStyles();
    toolStyles.pen = {
      ...toolStyles.pen,
      color: EDITOR_COLORS[0],
      strokeTier: STROKE_TIERS[0].value
    };
    toolStyles.rect = {
      ...toolStyles.rect,
      color: EDITOR_COLORS[3],
      strokeTier: STROKE_TIERS.at(-1)!.value
    };

    expect(snappedShapeStyle(toolStyles, 'rect', 2)).toEqual({
      color: EDITOR_COLORS[3],
      strokeWidth: STROKE_TIERS.at(-1)!.value * 2
    });
  });

  it('scales stroke width by the image unit', () => {
    const toolStyles = defaultToolStyles();
    toolStyles.circle = { ...toolStyles.circle, strokeTier: 4 };
    expect(snappedShapeStyle(toolStyles, 'circle', 3).strokeWidth).toBe(12);
  });
});
