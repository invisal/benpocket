import type { JSX } from 'react';
import { ScreenRecordingPermissionBanner } from '../../features/recording/components/ScreenRecordingPermissionBanner';
import { SourcePicker } from '../../features/recording/components/SourcePicker';

// Audio/webcam controls and the Start/Stop Recording button live in the
// app's persistent ScreenStudioSidebar (src/renderer/src/components/layout/
// sidebars/ScreenStudioSidebar.tsx) instead of here, so they stay reachable
// (and a recording stays controllable) no matter which ScreenStudio page is
// showing.
export function RecordSetupPage(): JSX.Element {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">New Recording</h1>
      <ScreenRecordingPermissionBanner />
      <SourcePicker />
    </div>
  );
}
