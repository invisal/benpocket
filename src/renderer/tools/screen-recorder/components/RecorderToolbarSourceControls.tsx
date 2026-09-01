import type { JSX } from 'react';
import { AppWindow, Crop, Monitor, Smartphone } from 'lucide-react';
import { cn } from 'cnfast';
import { Popover } from '@renderer/components/ui/Popover';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import type { CaptureSource, CaptureTargetType } from '@screen-recorder/types/recording';
import type { CaptureRegionSelection } from '@shared/capture-region';
import { isLikelyLinux } from '../lib/platform';
import { NO_DRAG, enablePointerEvents } from '../lib/pointer-events';

const TABS: { type: CaptureTargetType; label: string; icon: typeof Monitor }[] = [
  { type: 'screen', label: 'Display', icon: Monitor },
  { type: 'window', label: 'Window', icon: AppWindow }
];

/** The Display/Window/Area/Device cluster -- everything for picking *what* to capture. */
export function RecorderToolbarSourceControls({
  activeTab,
  onSelectTab,
  cropRegion,
  onPickArea,
  devicePopoverOpen,
  onDevicePopoverOpenChange,
  selectedDevice,
  simulatorSource,
  emulatorSource,
  bootedSimulatorName,
  onPickDevice
}: {
  activeTab: CaptureTargetType | null;
  onSelectTab: (type: CaptureTargetType) => void;
  cropRegion: CaptureRegionSelection | null;
  onPickArea: () => void;
  devicePopoverOpen: boolean;
  onDevicePopoverOpenChange: (open: boolean) => void;
  selectedDevice: 'simulator' | 'emulator' | null;
  simulatorSource: CaptureSource | undefined;
  emulatorSource: CaptureSource | undefined;
  bootedSimulatorName: string | null;
  onPickDevice: (kind: 'simulator' | 'emulator', source: CaptureSource | undefined) => void;
}): JSX.Element {
  return (
    <div className="ml-1 flex items-center gap-1 border-r border-border pr-1.5">
      {TABS.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          onClick={() => onSelectTab(type)}
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

      {/* setContentProtection's crop border is Windows/macOS-only -- on Linux it'd show up in the recording. */}
      {!isLikelyLinux && (
        <Tooltip.Root>
          <Tooltip.Trigger
            onClick={onPickArea}
            className={cn(
              NO_DRAG,
              'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px]',
              cropRegion
                ? 'bg-surface-3 text-strong'
                : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
            )}
          >
            <Crop size={15} />
            {cropRegion
              ? `${Math.round(cropRegion.rect.width)}×${Math.round(cropRegion.rect.height)}`
              : 'Area'}
          </Tooltip.Trigger>
          <Tooltip.Content side="top">Drag-select a region of a display to record</Tooltip.Content>
        </Tooltip.Root>
      )}

      <Popover.Root
        open={devicePopoverOpen}
        onOpenChange={(open) => {
          onDevicePopoverOpenChange(open);
          if (open) enablePointerEvents();
        }}
      >
        <Popover.Trigger
          title="Record a booted iOS Simulator or Android Emulator"
          className={cn(
            NO_DRAG,
            'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px]',
            selectedDevice
              ? 'bg-surface-3 text-strong'
              : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
          )}
        >
          <Smartphone size={15} />
          {selectedDevice === 'simulator'
            ? 'Simulator'
            : selectedDevice === 'emulator'
              ? 'Emulator'
              : 'Device'}
        </Popover.Trigger>

        <Popover.Content
          side="top"
          align="start"
          onMouseEnter={enablePointerEvents}
          className={cn(NO_DRAG, 'w-48 p-1.5')}
        >
          <button
            onClick={() => onPickDevice('simulator', simulatorSource)}
            disabled={!simulatorSource}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Simulator
            <span className="text-[10px] text-muted-foreground">
              {simulatorSource ? bootedSimulatorName : 'None booted'}
            </span>
          </button>
          <button
            onClick={() => onPickDevice('emulator', emulatorSource)}
            disabled={!emulatorSource}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Emulator
            <span className="text-[10px] text-muted-foreground">
              {emulatorSource ? emulatorSource.name : 'None running'}
            </span>
          </button>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
