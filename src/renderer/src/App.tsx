import type React from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TrayBridge } from './components/TrayBridge';
import { CaptureToolbarBridge } from './components/CaptureToolbarBridge';

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <TrayBridge />
      {!window.api?.usesOsCapturePicker && <CaptureToolbarBridge />}
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;
