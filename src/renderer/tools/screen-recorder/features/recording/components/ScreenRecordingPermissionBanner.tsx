import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ScreenRecordingStatus } from '@screen-recorder/types/permissions';
import { Button } from '../../../components/ui/button';

// On macOS, recording without Screen Recording permission doesn't error --
// desktopCapturer still lists sources, getUserMedia still resolves, and
// MediaRecorder happily produces a file. Every frame in it is just solid
// black. This is the single most common cause of "I recorded something and
// it's a black, unplayable video" reports, and it's otherwise invisible from
// inside the app. Surface it before the user even hits Record.
export function ScreenRecordingPermissionBanner(): JSX.Element | null {
  const [status, setStatus] = useState<ScreenRecordingStatus | null>(null);

  useEffect(() => {
    window.screenRecorder?.permissions.getScreenRecordingStatus().then(setStatus);
  }, []);

  if (!status || status === 'granted' || status === 'unknown') return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm font-medium text-amber-200">Screen Recording permission needed</p>
        <p className="text-xs text-amber-200/70">
          Without it, macOS lets the recording start but every frame comes out solid black. Grant it
          in System Settings, then <strong>fully quit and reopen ScreenRecorder</strong> -- Electron
          won&apos;t pick up the change while it&apos;s still running.
        </p>
        <div>
          <Button
            variant="secondary"
            onClick={() => window.screenRecorder?.permissions.openScreenRecordingSettings()}
          >
            Open System Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
