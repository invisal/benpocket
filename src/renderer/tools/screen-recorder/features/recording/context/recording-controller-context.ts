import { createContext, useContext } from 'react';
import type { RecordingController } from '../hooks/useRecordingController';

export const RecordingControllerContext = createContext<RecordingController | null>(null);

export function useRecordingControllerContext(): RecordingController {
  const controller = useContext(RecordingControllerContext);
  if (!controller) {
    throw new Error(
      'useRecordingControllerContext must be used within a RecordingControllerProvider'
    );
  }
  return controller;
}
