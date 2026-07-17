export type PreviewUnavailableReason = 'no-selection' | 'multiple-selection' | 'directory';

export interface PreviewEditorHandle {
  /** Writes the current buffer to disk. Resolves false (and leaves the buffer untouched) on failure. */
  save: () => Promise<boolean>;
}
