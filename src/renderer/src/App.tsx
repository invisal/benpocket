import type React from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TrayBridge } from './components/TrayBridge';
import { CaptureToolbarBridge } from './components/CaptureToolbarBridge';
import { KeybindingsBridge } from './components/KeybindingsBridge';

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <TrayBridge />
      <KeybindingsBridge />
      {!window.api?.usesOsCapturePicker && <CaptureToolbarBridge />}
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;
