import { useCallback, useEffect, useState } from 'react';
import * as Y from 'yjs';
import { usePersistStore } from '@renderer/hooks/usePersistStore';
import { normalizeCaptureDelay, type CaptureDelaySetting } from '@shared/capture-delay';
import {
  DEFAULT_PEN_SNAP_SHAPES,
  defaultToolStyles,
  LEGACY_EDITOR_PREFS_KEY,
  LEGACY_HIDE_APP_KEY,
  sanitizePrefs,
  type PersistedEditorPrefs
} from '../store/editor.store';

export const SCREEN_CAPTURE_SETTINGS_KEY = 'screen-capture/settings';

export type ScreenCaptureSettingsFields = PersistedEditorPrefs & {
  hideApp: boolean;
  delaySeconds: CaptureDelaySetting;
};

function mapIsEmpty(map: Y.Map<unknown>): boolean {
  return (
    !map.has('toolStyles') &&
    !map.has('penSnapShapes') &&
    !map.has('highlightSnap') &&
    !map.has('highlightSquareEnds') &&
    !map.has('watermark') &&
    !map.has('background') &&
    !map.has('cornerRadiusUnits') &&
    !map.has('hideApp')
  );
}

/** One-shot: seed the profile doc from pre-sync localStorage, then clear those keys. */
function migrateFromLocalStorage(map: Y.Map<unknown>, doc: Y.Doc): void {
  if (!mapIsEmpty(map)) return;

  let legacyPrefs: unknown;
  try {
    const raw = localStorage.getItem(LEGACY_EDITOR_PREFS_KEY);
    legacyPrefs = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    legacyPrefs = null;
  }
  // Zustand persist wraps as { state, version }.
  const stateBlob =
    legacyPrefs && typeof legacyPrefs === 'object' && legacyPrefs !== null && 'state' in legacyPrefs
      ? (legacyPrefs as { state: unknown }).state
      : legacyPrefs;

  const hideRaw = localStorage.getItem(LEGACY_HIDE_APP_KEY);
  if (!stateBlob && hideRaw === null) return;

  const prefs = sanitizePrefs(stateBlob);
  doc.transact(() => {
    if (prefs.toolStyles) map.set('toolStyles', prefs.toolStyles);
    if (prefs.penSnapShapes) map.set('penSnapShapes', prefs.penSnapShapes);
    if (typeof prefs.highlightSnap === 'boolean') map.set('highlightSnap', prefs.highlightSnap);
    if (typeof prefs.highlightSquareEnds === 'boolean') {
      map.set('highlightSquareEnds', prefs.highlightSquareEnds);
    }
    if (typeof prefs.watermark === 'boolean') map.set('watermark', prefs.watermark);
    if ('background' in prefs) map.set('background', prefs.background ?? null);
    if (typeof prefs.cornerRadiusUnits === 'number') {
      map.set('cornerRadiusUnits', prefs.cornerRadiusUnits);
    }
    if (hideRaw !== null) map.set('hideApp', hideRaw !== 'false');
  });

  localStorage.removeItem(LEGACY_EDITOR_PREFS_KEY);
  localStorage.removeItem(LEGACY_HIDE_APP_KEY);
}

function readFields(map: Y.Map<unknown>): ScreenCaptureSettingsFields {
  const sanitized = sanitizePrefs({
    toolStyles: map.get('toolStyles'),
    penSnapShapes: map.get('penSnapShapes'),
    highlightSnap: map.get('highlightSnap'),
    highlightSquareEnds: map.get('highlightSquareEnds'),
    watermark: map.get('watermark'),
    background: map.has('background') ? map.get('background') : undefined,
    cornerRadiusUnits: map.get('cornerRadiusUnits')
  });

  const hideAppRaw = map.get('hideApp');
  return {
    toolStyles: sanitized.toolStyles ?? defaultToolStyles(),
    penSnapShapes: sanitized.penSnapShapes ?? { ...DEFAULT_PEN_SNAP_SHAPES },
    highlightSnap: sanitized.highlightSnap ?? true,
    highlightSquareEnds: sanitized.highlightSquareEnds ?? true,
    watermark: sanitized.watermark ?? true,
    background: 'background' in sanitized ? (sanitized.background ?? null) : null,
    cornerRadiusUnits: sanitized.cornerRadiusUnits ?? 0,
    hideApp: typeof hideAppRaw === 'boolean' ? hideAppRaw : true,
    delaySeconds: normalizeCaptureDelay(map.get('delaySeconds'))
  };
}

export interface UseScreenCaptureSettingsResult {
  isLoading: boolean;
  fields: ScreenCaptureSettingsFields;
  setFields: (patch: Partial<ScreenCaptureSettingsFields>) => void;
}

/**
 * Live view over `screen-capture/settings` in the active profile persist store.
 * Portable editor prefs + hideApp + capture delay; device paths (lastSaveDir) stay local.
 */
export function useScreenCaptureSettings(): UseScreenCaptureSettingsResult {
  const { isLoading, doc } = usePersistStore(SCREEN_CAPTURE_SETTINGS_KEY, () => new Y.Doc());
  const map = doc.getMap<unknown>(SCREEN_CAPTURE_SETTINGS_KEY);
  const [fields, setFieldsState] = useState<ScreenCaptureSettingsFields>(() => readFields(map));

  useEffect(() => {
    if (isLoading) return;
    migrateFromLocalStorage(map, doc);
    const sync = (): void => setFieldsState(readFields(map));
    sync();
    map.observe(sync);
    return () => map.unobserve(sync);
  }, [isLoading, map, doc]);

  const setFields = useCallback(
    (patch: Partial<ScreenCaptureSettingsFields>): void => {
      const next = doc.getMap<unknown>(SCREEN_CAPTURE_SETTINGS_KEY);
      doc.transact(() => {
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) continue;
          next.set(key, value);
        }
      });
    },
    [doc]
  );

  return { isLoading, fields, setFields };
}
