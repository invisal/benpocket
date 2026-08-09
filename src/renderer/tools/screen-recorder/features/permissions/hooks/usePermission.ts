import { useCallback, useEffect, useState } from 'react';
import type { ScreenRecordingStatus } from '@screen-recorder/types/permissions';

export type PermissionKind = 'screen' | 'microphone' | 'camera' | 'accessibility';
type PermissionStatus = ScreenRecordingStatus;

const bridge = (): Window['screenRecorder']['permissions'] => window.screenRecorder.permissions;

const GET_STATUS: Record<PermissionKind, () => Promise<PermissionStatus>> = {
  screen: () => bridge().getScreenRecordingStatus(),
  microphone: () => bridge().getMicrophoneStatus(),
  camera: () => bridge().getCameraStatus(),
  accessibility: () => bridge().getAccessibilityStatus()
};

// Only these three have a real programmatic "request" call that raises the
// native OS prompt -- Screen Recording has none at the JS level; the only
// thing that ever actually asks for it is the native capture helper, at the
// moment a recording is actually attempted (main.swift's
// ensureRequestedPermissions). `ensure()` below falls back to a plain
// re-check for 'screen', not a request.
const REQUEST: Partial<Record<PermissionKind, () => Promise<PermissionStatus>>> = {
  microphone: () => bridge().requestMicrophoneAccess(),
  camera: () => bridge().requestCameraAccess(),
  accessibility: () => bridge().requestAccessibilityAccess()
};

const OPEN_SETTINGS: Record<PermissionKind, () => void> = {
  screen: () => bridge().openScreenRecordingSettings(),
  microphone: () => bridge().openMicrophoneSettings(),
  camera: () => bridge().openCameraSettings(),
  accessibility: () => bridge().openAccessibilitySettings()
};

export interface UsePermissionResult {
  status: PermissionStatus | null;
  /**
   * Raises the native OS prompt (for kinds with a real request API) then
   * resolves whether `kind` is granted -- call this from the exact click
   * that needs it (a Mic/Camera toggle, an Accessibility-gated feature's
   * switch), not proactively, so the prompt appears in context. Safe to
   * call even when already granted -- both askForMediaAccess and
   * isTrustedAccessibilityClient resolve immediately without prompting in
   * that case. The caller decides what to do if this resolves false --
   * typically `openSettings()`.
   */
  ensure: () => Promise<boolean>;
  openSettings: () => void;
}

/** One `kind`'s live status + how to request/open-settings for it -- see permissions.ts for the underlying per-kind main-process implementations. */
export function usePermission(kind: PermissionKind): UsePermissionResult {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    GET_STATUS[kind]().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const ensure = useCallback(async (): Promise<boolean> => {
    const next = await (REQUEST[kind] ?? GET_STATUS[kind])();
    setStatus(next);
    return next === 'granted';
  }, [kind]);

  const openSettings = useCallback(() => OPEN_SETTINGS[kind](), [kind]);

  return { status, ensure, openSettings };
}
