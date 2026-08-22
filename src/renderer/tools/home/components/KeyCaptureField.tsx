import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from 'cnfast';
import { formatShortcut } from '@renderer/lib/shortcut';
import { acceleratorFromKeyboardEvent } from '@renderer/lib/accelerator';

interface KeyCaptureFieldProps {
  value: string | null;
  onChange: (accelerator: string) => void;
}

/** Focusable box that captures a key combination on keydown and reports it
 *  as an Electron accelerator string. Escape cancels without changing `value`. */
export function KeyCaptureField({ value, onChange }: KeyCaptureFieldProps) {
  const [capturing, setCapturing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.key === 'Escape') {
      ref.current?.blur();
      return;
    }
    const accelerator = acceleratorFromKeyboardEvent(e.nativeEvent);
    if (!accelerator) return;
    onChange(accelerator);
    ref.current?.blur();
  }

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="button"
      aria-label="Press a key combination to assign this keybinding"
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex h-9 cursor-pointer items-center justify-center rounded-md border px-3 text-xs outline-none',
        capturing ? 'border-border-dark bg-surface-2' : 'border-border bg-surface'
      )}
    >
      {capturing
        ? 'Press a key combination…'
        : value
          ? formatShortcut(value)
          : 'Click to record a shortcut'}
    </div>
  );
}
