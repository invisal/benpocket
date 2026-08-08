import type { JSX } from 'react';
import { useRecordingStore } from '../store/recording-store';
import { Switch } from '../../../components/ui/switch';
import { SettingsRow } from '../../../components/ui/settings-row';
import { isLikelyMac } from '../../../lib/platform';

// TODO: microphone device select dropdown (enumerateDevices, filter kind
// 'audioinput')
export function AudioSourceToggle(): JSX.Element {
  const audio = useRecordingStore((state) => state.audio);
  const setAudio = useRecordingStore((state) => state.setAudio);

  return (
    <>
      <SettingsRow title="Microphone" description="Record audio from your microphone.">
        <Switch
          checked={audio.microphoneEnabled}
          onChange={(checked) => setAudio({ microphoneEnabled: checked })}
          label="Microphone"
        />
      </SettingsRow>
      <SettingsRow
        title="System audio"
        description={
          // System audio loopback via getUserMedia({ audio: { mandatory: {
          // chromeMediaSource: 'desktop' } } }) only reliably captures
          // anything on Windows/Linux -- on macOS it typically records
          // silence without a virtual audio driver; see
          // main/capture/system-audio-capture.ts.
          audio.systemAudioEnabled && isLikelyMac
            ? 'Unreliable on macOS without a virtual audio driver -- this may record silence.'
            : 'Record audio playing on your computer.'
        }
      >
        <Switch
          checked={audio.systemAudioEnabled}
          onChange={(checked) => setAudio({ systemAudioEnabled: checked })}
          label="System audio"
        />
      </SettingsRow>
    </>
  );
}
