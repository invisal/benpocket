import type { JSX } from 'react';
import { useRecordingStore } from '../store/recording-store';
import { Switch } from '../../../components/ui/switch';
import { SettingsRow } from '../../../components/ui/settings-row';

export function AutoZoomToggle(): JSX.Element {
  const autoZoomEnabled = useRecordingStore((state) => state.autoZoomEnabled);
  const setAutoZoomEnabled = useRecordingStore((state) => state.setAutoZoomEnabled);

  return (
    <SettingsRow title="Auto Zoom" description="Automatically zoom in on clicks while recording.">
      <Switch checked={autoZoomEnabled} onChange={setAutoZoomEnabled} label="Auto Zoom" />
    </SettingsRow>
  );
}
