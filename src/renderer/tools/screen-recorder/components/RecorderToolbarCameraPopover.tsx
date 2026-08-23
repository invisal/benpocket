import { useEffect, useRef, useState, type JSX } from 'react';
import { Video, VideoOff } from 'lucide-react';
import { cn } from 'cnfast';
import { Popover } from '@renderer/components/ui/Popover';
import type { WebcamOptions } from '@screen-recorder/types/recording';
import type { ToolbarError } from '../types/toolbar';
import { usePermission } from '../features/permissions/hooks/usePermission';
import { NO_DRAG, enablePointerEvents } from '../lib/pointer-events';

const SHAPES: { value: WebcamOptions['shape']; label: string; className: string }[] = [
  { value: 'circle', label: 'Circle', className: 'rounded-full' },
  { value: 'rounded-square', label: 'Rounded', className: 'rounded-[4px]' },
  { value: 'square', label: 'Square', className: 'rounded-none' }
];

/** The Camera popover -- toggle, live self-view, device pick, and shape/mirror settings. Owns the webcam preview stream's lifecycle. */
export function RecorderToolbarCameraPopover({
  webcam,
  onWebcamChange,
  open,
  onOpenChange,
  onError
}: {
  webcam: WebcamOptions;
  onWebcamChange: (updater: (w: WebcamOptions) => WebcamOptions) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (error: ToolbarError) => void;
}): JSX.Element {
  const cameraPermission = usePermission('camera');
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraPreviewStreamRef = useRef<MediaStream | null>(null);

  // Live self-view + device labels while the popover is open (labels stay
  // blank until getUserMedia grants); stopped on close so the light doesn't
  // stay on.
  useEffect(() => {
    if (!open || !webcam.enabled) {
      cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraPreviewStreamRef.current = null;
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: webcam.deviceId ? { deviceId: { exact: webcam.deviceId } } : true })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraPreviewStreamRef.current = stream;
        if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = stream;

        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setCameraDevices(devices.filter((d) => d.kind === 'videoinput'));
      })
      .catch((err) => console.error('[toolbar] failed to open camera preview:', err));

    return () => {
      cancelled = true;
      cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraPreviewStreamRef.current = null;
    };
  }, [open, webcam.enabled, webcam.deviceId]);

  // Requests Camera access at the click that turns it on; opens Settings only if refused.
  async function toggleWebcam(nextEnabled: boolean): Promise<void> {
    if (!nextEnabled || cameraPermission.status === 'granted') {
      onWebcamChange((w) => ({ ...w, enabled: nextEnabled }));
      return;
    }
    if (await cameraPermission.ensure()) {
      onWebcamChange((w) => ({ ...w, enabled: true }));
    } else {
      onError({
        message: 'Camera access is required.',
        openSettings: cameraPermission.openSettings
      });
      cameraPermission.openSettings();
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
            webcam.enabled
              ? 'bg-surface-3 text-strong'
              : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
          )}
        >
          {webcam.enabled ? <Video size={14} /> : <VideoOff size={14} />}
          {webcam.enabled ? 'Camera on' : 'Camera off'}
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
              checked={webcam.enabled}
              onChange={(e) => void toggleWebcam(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent"
            />
            Show webcam
          </label>
          {webcam.enabled && (
            <div className="flex flex-col gap-2">
              <video
                ref={cameraPreviewRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  'h-24 w-full rounded-lg bg-black object-cover',
                  webcam.mirrored && 'scale-x-[-1]'
                )}
              />
              {cameraDevices.length > 1 && (
                <select
                  value={webcam.deviceId ?? ''}
                  onChange={(e) =>
                    onWebcamChange((w) => ({ ...w, deviceId: e.target.value || undefined }))
                  }
                  className="w-full rounded-lg border border-border bg-transparent px-2 py-1 text-[11px] text-foreground"
                >
                  {cameraDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId} className="bg-surface">
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {SHAPES.map(({ value, label, className }) => (
                  <button
                    key={value}
                    onClick={() => onWebcamChange((w) => ({ ...w, shape: value }))}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px]',
                      webcam.shape === value
                        ? 'border-accent text-accent'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    <span
                      className={cn('h-4 w-4 border border-current bg-current/20', className)}
                    />
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={webcam.mirrored}
                  onChange={(e) => onWebcamChange((w) => ({ ...w, mirrored: e.target.checked }))}
                  className="h-3.5 w-3.5 accent-accent"
                />
                Mirror
              </label>
            </div>
          )}
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
