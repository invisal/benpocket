import type { JSX, ReactNode } from 'react';
import { useRecordingController } from '../hooks/useRecordingController';
import { RecordingControllerContext } from './recording-controller-context';

/**
 * Mounts the single, app-wide recording session so both the persistent
 * sidebar and the focus-view "Start Recording" button drive the exact same
 * capture instead of each owning independent MediaRecorder/cursor-tracking
 * refs.
 */
export function RecordingControllerProvider({ children }: { children: ReactNode }): JSX.Element {
  const controller = useRecordingController();
  return (
    <RecordingControllerContext.Provider value={controller}>
      {children}
    </RecordingControllerContext.Provider>
  );
}
