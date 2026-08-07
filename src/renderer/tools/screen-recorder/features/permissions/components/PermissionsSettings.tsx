import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type { MicrophoneStatus, ScreenRecordingStatus } from '@screen-recorder/types/permissions';
import { SettingsRow } from '../../../components/ui/settings-row';
import { cn } from '../../../lib/utils';

type Status = ScreenRecordingStatus | MicrophoneStatus;

const STATUS_LABEL: Record<Status, string> = {
  granted: 'Granted',
  denied: 'Not granted',
  restricted: 'Restricted',
  'not-determined': 'Not granted yet',
  unknown: 'Unknown'
};

function PermissionRow({
  title,
  description,
  status,
  onOpenSettings
}: {
  title: string;
  description: string;
  status: Status | null;
  onOpenSettings: () => void;
}): JSX.Element {
  // 'unknown' means the status check itself failed (or this platform has no
  // such gate at all) -- treated as "nothing to warn about" rather than
  // "denied", same as ScreenRecordingPermissionBanner.tsx, since there's no
  // reliable signal to act on either way.
  const needsAction = status !== null && status !== 'granted' && status !== 'unknown';
  return (
    <SettingsRow title={title} description={description}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            needsAction ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400/80'
          )}
        >
          {status ? STATUS_LABEL[status] : 'Checking…'}
        </span>
        {needsAction && (
          <button
            onClick={onOpenSettings}
            className="text-xs font-medium text-accent hover:underline"
          >
            Open Settings
          </button>
        )}
      </div>
    </SettingsRow>
  );
}

/**
 * macOS gates screen/system-audio/mic capture behind Privacy & Security
 * toggles that TCC (the OS permission database) tracks per app code
 * signature -- see screen-recording-permission.ts's doc for why a granted
 * toggle can still look "on" while a differently-signed build of this app
 * keeps getting denied. This surfaces current status plus the single most
 * common cause of "I already granted it but it keeps asking": macOS only
 * re-checks permission status when the app itself relaunches, not live.
 */
export function PermissionsSettings(): JSX.Element {
  const [screenStatus, setScreenStatus] = useState<ScreenRecordingStatus | null>(null);
  const [micStatus, setMicStatus] = useState<MicrophoneStatus | null>(null);

  useEffect(() => {
    window.screenRecorder.permissions.getScreenRecordingStatus().then(setScreenStatus);
    window.screenRecorder.permissions.getMicrophoneStatus().then(setMicStatus);
  }, []);

  return (
    <>
      <PermissionRow
        title="Screen & System Audio Recording"
        description="Required to capture your screen and any system audio. macOS lists this app under both 'Screen & System Audio Recording' and 'System Audio Recording Only' in Privacy & Security -- enable both."
        status={screenStatus}
        onOpenSettings={() => window.screenRecorder.permissions.openScreenRecordingSettings()}
      />
      <PermissionRow
        title="Microphone"
        description="Required for the Mic toggle to record voice narration."
        status={micStatus}
        onOpenSettings={() => window.screenRecorder.permissions.openMicrophoneSettings()}
      />
      <SettingsRow
        title="After granting a permission"
        description={
          <>
            <strong>Fully quit (Cmd+Q) and reopen benpocket</strong> -- macOS only re-checks
            permission status when the app relaunches, so flipping a toggle while it&apos;s still
            running won&apos;t take effect yet.
          </>
        }
      >
        {null}
      </SettingsRow>
    </>
  );
}
