import { useEffect, useState, type JSX } from 'react';
import { useRecordingStore } from '../store/recording-store';
import { Switch } from '../../../components/ui/switch';
import { SettingsRow } from '../../../components/ui/settings-row';
import { Select } from '@renderer/components/ui/Select';
import { isLikelyMac } from '../../../lib/platform';

export function AudioSourceToggle(): JSX.Element {
  const audio = useRecordingStore((state) => state.audio);
  const setAudio = useRecordingStore((state) => state.setAudio);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);

  // Device labels stay blank until a getUserMedia audio permission has
  // actually been granted (Chromium privacy restriction) -- same open-then-
  // enumerate-then-close shape as RecorderToolbarApp.tsx's camera/mic
  // preview effects, just without a persistent stream since this settings
  // row has no live level meter to drive.
  useEffect(() => {
    // No reset here when mic is off -- this row is only ever rendered while
    // `audio.microphoneEnabled` is true, so a stale list sitting unused in
    // state until the mic is re-enabled is harmless (same tradeoff
    // RecorderToolbarApp.tsx's own mic effect makes, for the same reason:
    // avoids a synchronous setState at the top of this effect).
    if (!audio.microphoneEnabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(async (s) => {
        stream = s;
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
      })
      .catch(() => setMicDevices([]))
      .finally(() => stream?.getTracks().forEach((track) => track.stop()));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [audio.microphoneEnabled]);

  return (
    <>
      <SettingsRow title="Microphone" description="Record audio from your microphone.">
        <Switch
          checked={audio.microphoneEnabled}
          onChange={(checked) => setAudio({ microphoneEnabled: checked })}
          label="Microphone"
        />
      </SettingsRow>
      {audio.microphoneEnabled && micDevices.length > 1 && (
        <SettingsRow title="Microphone device" description="Which microphone to record from.">
          <Select.Root
            value={audio.microphoneDeviceId ?? micDevices[0].deviceId}
            onValueChange={(deviceId) => {
              const device = micDevices.find((d) => d.deviceId === deviceId);
              setAudio({
                microphoneDeviceId: deviceId ?? undefined,
                microphoneDeviceName: device?.label
              });
            }}
          >
            <Select.Trigger size="sm" className="max-w-48 justify-between">
              {micDevices.find((d) => d.deviceId === audio.microphoneDeviceId)?.label ??
                micDevices[0].label}
            </Select.Trigger>
            <Select.Content>
              {micDevices.map((device, index) => (
                <Select.Item key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </SettingsRow>
      )}
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
