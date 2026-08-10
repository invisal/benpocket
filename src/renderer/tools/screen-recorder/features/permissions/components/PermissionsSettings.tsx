import type { JSX } from 'react';
import { useState } from 'react';
import type { AutomationStatus } from '@screen-recorder/types/permissions';
import { Button } from '@renderer/components/ui/Button';
import { SettingsRow } from '../../../components/ui/settings-row';
import { cn } from '../../../lib/utils';
import { isLikelyMac } from '../../../lib/platform';
import {
  usePermission,
  type PermissionKind,
  type UsePermissionResult
} from '../hooks/usePermission';

type Status = UsePermissionResult['status'] | AutomationStatus;

const STATUS_LABEL: Record<NonNullable<Status>, string> = {
  granted: 'Granted',
  denied: 'Not granted',
  restricted: 'Restricted',
  'not-determined': 'Not granted yet',
  unknown: 'Unknown'
};

function StatusPill({ status }: { status: Status }): JSX.Element {
  // 'unknown' means the status check itself failed (or this platform has no
  // such gate at all) -- treated as "nothing to warn about" rather than
  // "denied", same as ScreenRecordingPermissionBanner.tsx, since there's no
  // reliable signal to act on either way.
  const needsAction = status !== null && status !== 'granted' && status !== 'unknown';
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        needsAction ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400/80'
      )}
    >
      {status ? STATUS_LABEL[status] : 'Checking…'}
    </span>
  );
}

function PermissionRow({
  kind,
  title,
  description
}: {
  kind: PermissionKind;
  title: string;
  description: string;
}): JSX.Element {
  const { status, ensure, openSettings } = usePermission(kind);
  const needsAction = status !== null && status !== 'granted' && status !== 'unknown';
  return (
    <SettingsRow title={title} description={description}>
      <div className="flex items-center gap-2">
        <StatusPill status={status} />
        {needsAction && (
          <button
            onClick={() => void ensure().then((granted) => !granted && openSettings())}
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
 * Mic/Camera are real, checkable gates on both macOS and Windows (see
 * permissions.ts's supportsMediaAccessStatus) -- SettingsPage only mounts
 * this component on one of those two, so both rows always apply here.
 * Screen Recording/Accessibility/Automation, plus the "only re-checks at
 * relaunch" caveat, are macOS-specific TCC concepts with no Windows
 * equivalent, so those stay gated to isLikelyMac below.
 */
export function PermissionsSettings(): JSX.Element {
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [isCheckingAutomation, setIsCheckingAutomation] = useState(false);

  // Automation has no non-invasive "just check" call (see usePermission's
  // doc on why it's not one of the four kinds that hook covers) -- checking
  // it at all IS the request, so it only ever runs from this explicit click,
  // never automatically on mount like the four PermissionRows below.
  async function handleCheckAutomation(): Promise<void> {
    setIsCheckingAutomation(true);
    try {
      const status = await window.screenRecorder.permissions.requestAutomationAccess();
      setAutomationStatus(status);
      if (status !== 'granted') window.screenRecorder.permissions.openAutomationSettings();
    } finally {
      setIsCheckingAutomation(false);
    }
  }

  return (
    <>
      {isLikelyMac && (
        <PermissionRow
          kind="screen"
          title="Screen & System Audio Recording"
          description="Required to capture your screen and any system audio. macOS lists this app under both 'Screen & System Audio Recording' and 'System Audio Recording Only' in Privacy & Security -- enable both."
        />
      )}
      <PermissionRow
        kind="microphone"
        title="Microphone"
        description="Required for the Mic toggle to record voice narration."
      />
      <PermissionRow
        kind="camera"
        title="Camera"
        description="Required for the webcam preview and picture-in-picture overlay."
      />
      {isLikelyMac && (
        <>
          <PermissionRow
            kind="accessibility"
            title="Accessibility"
            description="Required to track mouse clicks system-wide, which Auto Zoom uses to place its keyframes. Without it, recording still works but Auto Zoom has no clicks to follow."
          />
          <SettingsRow
            title="Automation"
            description="Only needed when recording a booted iOS Simulator window, to ask System Events for its on-screen position -- macOS prompts for this automatically the first time you do that."
          >
            <div className="flex items-center gap-2">
              <StatusPill status={automationStatus} />
              <Button
                variant="secondary"
                onClick={() => void handleCheckAutomation()}
                disabled={isCheckingAutomation}
              >
                {isCheckingAutomation ? 'Checking…' : 'Check Access'}
              </Button>
            </div>
          </SettingsRow>
          <SettingsRow
            title="Already granted one in System Settings?"
            description={
              <>
                Screen Recording/Microphone/Camera status only re-checks when the app relaunches --
                flipping a toggle while benpocket is still running won&apos;t take effect until it
                restarts.
              </>
            }
          >
            <Button
              variant="secondary"
              onClick={() => window.screenRecorder.permissions.relaunchApp()}
            >
              Restart benpocket
            </Button>
          </SettingsRow>
        </>
      )}
    </>
  );
}
