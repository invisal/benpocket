import { useEffect, useRef, useState, type JSX } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from 'cnfast';
import { Popover } from '@renderer/components/ui/Popover';
import type { AudioInputOptions } from '@screen-recorder/types/recording';
import type { ToolbarError } from '../types/toolbar';
import { usePermission } from '../features/permissions/hooks/usePermission';
import { NO_DRAG, enablePointerEvents } from '../lib/pointer-events';

/** The Mic popover -- toggle, live level meter, and device pick. Owns the mic stream/analyser lifecycle. */
export function RecorderToolbarMicPopover({
  audio,
  onAudioChange,
  open,
  onOpenChange,
  onError
}: {
  audio: AudioInputOptions;
  onAudioChange: (updater: (a: AudioInputOptions) => AudioInputOptions) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (error: ToolbarError) => void;
}): JSX.Element {
  const micPermission = usePermission('microphone');
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDeviceLabel, setMicDeviceLabel] = useState<string | null>(null);
  const micLevelBarRef = useRef<HTMLDivElement>(null);

  // Live level meter (writes to the DOM via rAF, not state -- too frequent
  // for re-renders) + real device label while the mic is enabled.
  useEffect(() => {
    // Stale label left as-is when mic is off -- only read while enabled.
    if (!audio.microphoneEnabled) return;

    let cancelled = false;
    let audioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;

    navigator.mediaDevices
      .getUserMedia({
        audio: audio.microphoneDeviceId ? { deviceId: { exact: audio.microphoneDeviceId } } : true
      })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        const track = s.getAudioTracks()[0];
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
        const deviceId = track?.getSettings().deviceId;
        setMicDeviceLabel(
          devices.find((d) => d.deviceId === deviceId)?.label ?? track?.label ?? null
        );

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(s);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        function tick(): void {
          analyser.getByteTimeDomainData(data);
          // RMS of the waveform, normalized.
          let sumSquares = 0;
          for (const value of data) {
            const centered = (value - 128) / 128;
            sumSquares += centered * centered;
          }
          const level = Math.min(1, Math.sqrt(sumSquares / data.length) * 4);
          if (micLevelBarRef.current) micLevelBarRef.current.style.transform = `scaleX(${level})`;
          rafId = requestAnimationFrame(tick);
        }
        tick();
      })
      .catch(() => setMicDeviceLabel(null));

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [audio.microphoneEnabled, audio.microphoneDeviceId]);

  // Requests Mic access at the click that turns it on; opens Settings only if refused.
  async function toggleMic(): Promise<void> {
    if (audio.microphoneEnabled || micPermission.status === 'granted') {
      onAudioChange((a) => ({ ...a, microphoneEnabled: !a.microphoneEnabled }));
      return;
    }
    if (await micPermission.ensure()) {
      onAudioChange((a) => ({ ...a, microphoneEnabled: true }));
    } else {
      onError({
        message: 'Microphone access is required.',
        openSettings: micPermission.openSettings
      });
      micPermission.openSettings();
    }
  }

  return (
    <div className="flex items-center gap-1 border-r border-border px-1.5">
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (next) enablePointerEvents();
        }}
      >
        <Popover.Trigger
          className={cn(
            NO_DRAG,
            'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px]',
            audio.microphoneEnabled
              ? 'bg-surface-3 text-strong'
              : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
          )}
        >
          {audio.microphoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
          <span className="max-w-20 truncate">
            {audio.microphoneEnabled ? (micDeviceLabel ?? 'Mic') : 'Mic'}
          </span>
          {audio.microphoneEnabled && (
            <span className="h-3 w-6 overflow-hidden rounded-full bg-surface-3">
              <span
                ref={micLevelBarRef}
                className="block h-full w-full origin-left scale-x-0 rounded-full bg-accent"
              />
            </span>
          )}
        </Popover.Trigger>

        <Popover.Content
          side="top"
          align="start"
          onMouseEnter={enablePointerEvents}
          className={cn(NO_DRAG, 'w-48 p-3')}
        >
          <label className="mb-2 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={audio.microphoneEnabled}
              onChange={() => void toggleMic()}
              className="h-3.5 w-3.5 accent-accent"
            />
            Enable microphone
          </label>
          {audio.microphoneEnabled && micDevices.length > 1 && (
            <select
              value={audio.microphoneDeviceId ?? ''}
              onChange={(e) => {
                const deviceId = e.target.value || undefined;
                const device = micDevices.find((d) => d.deviceId === deviceId);
                onAudioChange((a) => ({
                  ...a,
                  microphoneDeviceId: deviceId,
                  microphoneDeviceName: device?.label
                }));
              }}
              className="w-full rounded-lg border border-border bg-transparent px-2 py-1 text-[11px] text-foreground"
            >
              {micDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId} className="bg-surface">
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          )}
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
