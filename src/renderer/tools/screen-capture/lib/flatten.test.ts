import { describe, expect, it } from 'vitest';
import {
  arrowHeadLength,
  arrowHeadPoints,
  clampRectToImage,
  labelTextColor,
  normalizeRect,
  resizeRect,
  shiftAnnotation
} from './flatten';
import { nextLabelValue, reorderById, useCaptureEditorStore } from '../store/editor.store';
import type { CaptureAnnotation } from '../types/editor';

describe('normalizeRect', () => {
  it('round-trips a forward drag unchanged', () => {
    expect(normalizeRect(10, 20, 110, 220)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
  });

  it('normalizes a backwards (up-left) drag to a positive-size rect', () => {
    expect(normalizeRect(110, 220, 10, 20)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
  });
});

describe('resizeRect', () => {
  const start = { x: 100, y: 100, width: 200, height: 100 };

  it('keeps the opposite corner fixed when dragging se', () => {
    expect(resizeRect(start, 'se', 50, 20, 10)).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 120
    });
  });

  it('moves the origin when dragging nw and enforces the minimum size', () => {
    expect(resizeRect(start, 'nw', 195, 95, 10)).toEqual({
      x: 290,
      y: 190,
      width: 10,
      height: 10
    });
  });
});

describe('clampRectToImage', () => {
  it('preserves edges that were already inside the image', () => {
    expect(clampRectToImage({ x: -20, y: 10, width: 100, height: 100 }, 500, 300)).toEqual({
      x: 0,
      y: 10,
      width: 80,
      height: 100
    });
  });

  it('clips the far edges to the image bounds', () => {
    expect(clampRectToImage({ x: 450, y: 250, width: 100, height: 100 }, 500, 300)).toEqual({
      x: 450,
      y: 250,
      width: 50,
      height: 50
    });
  });
});

describe('arrowHeadPoints', () => {
  it('places both wings behind the tip of a horizontal arrow, mirrored about the shaft', () => {
    const head = arrowHeadPoints(0, 0, 100, 0, arrowHeadLength(4));
    expect(head.hx1).toBeLessThan(100);
    expect(head.hx2).toBeLessThan(100);
    expect(head.hy1).toBeCloseTo(-head.hy2);
    // Wing tips are exactly headLength away from the arrow tip.
    expect(Math.hypot(head.hx1 - 100, head.hy1)).toBeCloseTo(16);
    expect(Math.hypot(head.hx2 - 100, head.hy2)).toBeCloseTo(16);
  });
});

describe('reorderById', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const ids = (l: { id: string }[]): string => l.map((x) => x.id).join('');

  it('moves an item up and down to its exact final index', () => {
    expect(ids(reorderById(list, 'a', 2))).toBe('bcad');
    expect(ids(reorderById(list, 'd', 0))).toBe('dabc');
  });

  it('clamps out-of-range targets and returns the same array for no-ops', () => {
    expect(ids(reorderById(list, 'a', 99))).toBe('bcda');
    expect(reorderById(list, 'b', 1)).toBe(list);
    expect(reorderById(list, 'missing', 0)).toBe(list);
  });
});

describe('shiftAnnotation', () => {
  it('shifts point-based and arrow annotations into cropped-output space', () => {
    const rect: CaptureAnnotation = {
      id: 'r',
      kind: 'rect',
      x: 100,
      y: 50,
      width: 10,
      height: 10,
      color: '#fff',
      strokeWidth: 2
    };
    expect(shiftAnnotation(rect, -30, -20)).toMatchObject({ x: 70, y: 30, width: 10, height: 10 });

    const arrow: CaptureAnnotation = {
      id: 'a',
      kind: 'arrow',
      x1: 10,
      y1: 20,
      x2: 30,
      y2: 40,
      color: '#fff',
      strokeWidth: 2
    };
    expect(shiftAnnotation(arrow, -5, 5)).toMatchObject({ x1: 5, y1: 25, x2: 25, y2: 45 });
  });
});

describe('crop undo', () => {
  it('setCrop is undoable and redoable', () => {
    const s = useCaptureEditorStore.getState();
    s.init(1000, 500);
    useCaptureEditorStore.getState().setCrop({ x: 10, y: 20, width: 300, height: 200 });
    expect(useCaptureEditorStore.getState().crop).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200
    });

    useCaptureEditorStore.getState().undo();
    expect(useCaptureEditorStore.getState().crop).toBeNull();

    useCaptureEditorStore.getState().redo();
    expect(useCaptureEditorStore.getState().crop).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200
    });

    useCaptureEditorStore.getState().reset();
  });
});

describe('per-annotation property setters', () => {
  it('setBlurTier patches the targeted blur layer in image px and updates the default', () => {
    const s = useCaptureEditorStore.getState();
    s.init(2000, 1000); // unit = 2
    s.addAnnotation({
      id: 'blur1',
      kind: 'blur',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      blurRadius: 16
    });
    s.addAnnotation({
      id: 'rect1',
      kind: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      color: '#fff',
      strokeWidth: 4
    });

    useCaptureEditorStore.getState().setBlurTier(16, 'blur1');
    let state = useCaptureEditorStore.getState();
    expect(state.blurTier).toBe(16);
    expect(state.annotations.find((a) => a.id === 'blur1')).toMatchObject({ blurRadius: 32 });

    // A non-blur target only moves the default.
    useCaptureEditorStore.getState().setBlurTier(4, 'rect1');
    state = useCaptureEditorStore.getState();
    expect(state.blurTier).toBe(4);
    expect(state.annotations.find((a) => a.id === 'blur1')).toMatchObject({ blurRadius: 32 });

    useCaptureEditorStore.getState().reset();
  });
});

describe('label helpers', () => {
  it('auto-increments past the highest existing label value', () => {
    const annotations: CaptureAnnotation[] = [
      { id: 'a', kind: 'label', x: 0, y: 0, value: 3, radius: 14, color: '#ef4444' },
      { id: 'b', kind: 'rect', x: 0, y: 0, width: 10, height: 10, color: '#fff', strokeWidth: 2 }
    ];
    expect(nextLabelValue(annotations)).toBe(4);
    expect(nextLabelValue([])).toBe(1);
  });

  it('uses dark digits only on a white badge', () => {
    expect(labelTextColor('#ffffff')).toBe('#111111');
    expect(labelTextColor('#ef4444')).toBe('#ffffff');
  });
});
