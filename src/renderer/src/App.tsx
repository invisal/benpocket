import type React from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TrayBridge } from './components/TrayBridge';

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <TrayBridge />
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;
