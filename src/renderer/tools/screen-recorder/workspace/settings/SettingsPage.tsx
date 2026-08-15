import type { JSX } from 'react';
import { AudioSourceToggle } from '../../features/recording/components/AudioSourceToggle';
import { AutoZoomToggle } from '../../features/recording/components/AutoZoomToggle';
import { WebcamShapePicker } from '../../features/webcam/components/WebcamShapePicker';
import { ShortcutRecorder } from '../../features/shortcuts/components/ShortcutRecorder';
import { ExportPresetPicker } from '../../features/export/components/ExportPresetPicker';
import { PermissionsSettings } from '../../features/permissions/components/PermissionsSettings';
import { SettingsGroup, SettingsRow } from '../../components/ui/settings-row';
import { isLikelyMac, isLikelyWindows, isLikelyLinux } from '../../lib/platform';

export function SettingsPage(): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Defaults applied the next time you launch the recorder.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-8">
        {/* Linux has no equivalent permission gate at all for this app to
            surface; macOS/Windows each have at least mic/camera (and macOS
            several more) worth showing -- see PermissionsSettings for which
            rows apply on which of the two. */}
        {(isLikelyMac || isLikelyWindows) && (
          <SettingsGroup title="Permissions">
            <PermissionsSettings />
          </SettingsGroup>
        )}

        <SettingsGroup title="Recording">
          <AudioSourceToggle />
          {/* Cursor/click tracking is always skipped on Linux (see
              useRecordingController.ts) -- this toggle would just be a
              silent no-op there. */}
          {!isLikelyLinux && <AutoZoomToggle />}
        </SettingsGroup>

        <SettingsGroup title="Webcam">
          <WebcamShapePicker />
        </SettingsGroup>

        <SettingsGroup title="Export">
          <SettingsRow
            title="Preset"
            description="Default format, resolution, and quality for new exports."
          >
            <ExportPresetPicker />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Shortcuts">
          <ShortcutRecorder />
        </SettingsGroup>
      </div>
    </div>
  );
}
