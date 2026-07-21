import type { JSX } from 'react';
import { useRecordingStore } from '../store/recording-store';

// Best-effort platform sniff purely for the UI caveat below -- system audio
// loopback via getUserMedia({ audio: { mandatory: { chromeMediaSource:
// 'desktop' } } }) only reliably captures anything on Windows/Linux. On
// macOS it typically records silence without a virtual audio driver; see
// main/capture/system-audio-capture.ts.
const isLikelyMac = navigator.userAgent.includes('Mac');

// TODO: microphone device select dropdown (enumerateDevices, filter kind
// 'audioinput')
export function AudioSourceToggle(): JSX.Element {
  const audio = useRecordingStore((state) => state.audio);
  const setAudio = useRecordingStore((state) => state.setAudio);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={audio.microphoneEnabled}
          onChange={(e) => setAudio({ microphoneEnabled: e.target.checked })}
          className="h-3.5 w-3.5 accent-accent"
        />
        Microphone
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={audio.systemAudioEnabled}
          onChange={(e) => setAudio({ systemAudioEnabled: e.target.checked })}
          className="h-3.5 w-3.5 accent-accent"
        />
        System audio
      </label>
      {audio.systemAudioEnabled && isLikelyMac && (
        <p className="text-[11px] text-muted-foreground">
          System audio capture is unreliable on macOS without a virtual audio driver -- this may
          record silence.
        </p>
      )}
    </div>
  );
}
