import { useEffect } from 'react';
import { type ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { registerToolLeaveGuard } from '@renderer/components/providers/ToolProvider';
import { ToolLayout } from '@renderer/components/layout/ToolLayout';
import { hasUnsavedChanges } from './features/history/store/history-store';
import { ScreenRecorderApp } from './ScreenRecorderApp';

interface Props {}

export function ScreenRecordMain({ id }: ToolComponentProps<Props>) {
  useEffect(() => {
    registerToolLeaveGuard(id, () => {
      if (!hasUnsavedChanges()) return true;
      return window.confirm('Leave the Screen Recorder? Any unsaved changes will be lost.');
    });
  }, [id]);

  return (
    <>
      <ToolLayout.Title>Screen Recorder</ToolLayout.Title>
      <ScreenRecorderApp />
    </>
  );
}

export default ScreenRecordMain;
