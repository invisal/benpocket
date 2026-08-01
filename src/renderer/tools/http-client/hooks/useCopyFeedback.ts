import { useState } from 'react';

const COPY_FEEDBACK_MS = 1500;

/**
 * Copies text to the clipboard and reports back a short-lived "active" marker for UI feedback
 * (e.g. swapping a Copy icon for a checkmark). `value` distinguishes which of several copy
 * targets was just copied (e.g. a specific table row) - defaults to `true` for a single target.
 */
export function useCopyFeedback<T = true>(): [
  T | null,
  (text: string, value?: T) => Promise<void>
] {
  const [active, setActive] = useState<T | null>(null);

  const copy = async (text: string, value: T = true as T): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setActive(value);
      setTimeout(
        () => setActive((current) => (current === value ? null : current)),
        COPY_FEEDBACK_MS
      );
    } catch {
      // Clipboard API unavailable/denied - nothing else to fall back to.
    }
  };

  return [active, copy];
}
