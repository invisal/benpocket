import { useEffect, useState, type JSX } from 'react';
import { AppWindow, Crop, GripVertical, Monitor, X } from 'lucide-react';
import { cn } from 'cnfast';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { useSyncDocumentTheme } from '@renderer/store/theme.store';
import type { CaptureSource, CaptureTargetType } from '@screen-recorder/types/recording';
import { pickDefaultCaptureSource } from '@screen-recorder/features/recording/lib/pick-default-capture-source';
import { findScreenSourceForRegion } from '../lib/capture-frame';

const TABS: { type: CaptureTargetType; label: string; icon: typeof Monitor }[] = [
  { type: 'screen', label: 'Display', icon: Monitor },
  { type: 'window', label: 'Window', icon: AppWindow }
];

const DRAG = '[-webkit-app-region:drag]';
const NO_DRAG = '[-webkit-app-region:no-drag]';

export function CaptureToolbarApp(): JSX.Element {
  useSyncDocumentTheme();
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [activeTab, setActiveTab] = useState<CaptureTargetType | null>(null);

  useEffect(() => {
    window.screenRecorder.recording
      .getCaptureSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') window.screenRecorder.captureToolbar.cancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function openSourcePicker(type: CaptureTargetType): Promise<void> {
    await window.screenRecorder.captureToolbar.openSourcePicker({ type });
  }

  async function pickArea(): Promise<void> {
    const list =
      sources.length > 0 ? sources : await window.screenRecorder.recording.getCaptureSources();
    const anyScreenSource = list.find((s) => s.type === 'screen') ?? pickDefaultCaptureSource(list);
    if (!anyScreenSource) return;
    const bounds = await window.screenRecorder.captureToolbar.getCurrentDisplayBounds();
    await window.screenRecorder.window.hide({ mainOnly: true });
    let captured = false;
    try {
      const selection = await window.screenRecorder.screenshot.selectRegion({
        bounds: bounds ?? undefined
      });
      if (!selection) return;
      const screenSource = findScreenSourceForRegion(list, selection) ?? anyScreenSource;
      captured = true;
      window.screenRecorder.captureToolbar.requestCapture({
        sourceId: screenSource.id,
        cropRegion: selection
      });
    } finally {
      if (!captured) await window.screenRecorder.window.restore({ focus: false });
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Tooltip.Provider delay={200} closeDelay={0}>
        <div
          className={cn(
            DRAG,
            'flex items-center gap-1 rounded-full border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur'
          )}
        >
          <GripVertical size={13} className="mx-1 shrink-0 text-muted-foreground/50" />

          <Tooltip.Root>
            <Tooltip.Trigger
              onClick={() => window.screenRecorder.captureToolbar.cancel()}
              className={cn(
                NO_DRAG,
                'flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground'
              )}
            >
              <X size={14} />
            </Tooltip.Trigger>
            <Tooltip.Content side="top">Cancel (Esc)</Tooltip.Content>
          </Tooltip.Root>

          <div className="ml-1 flex items-center gap-1">
            {TABS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setActiveTab(type);
                  void openSourcePicker(type);
                }}
                className={cn(
                  NO_DRAG,
                  'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px]',
                  activeTab === type
                    ? 'bg-surface-3 text-strong'
                    : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setActiveTab(null);
                void pickArea();
              }}
              className={cn(
                NO_DRAG,
                'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] text-muted-foreground hover:bg-surface-3 hover:text-foreground'
              )}
            >
              <Crop size={15} />
              Area
            </button>
          </div>
        </div>
      </Tooltip.Provider>
    </div>
  );
}
