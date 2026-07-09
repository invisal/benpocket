import React from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToolTabItem, ToolTabProvider } from './components/providers/ToolProvider';

function createInitialTabs(): ToolTabItem[] {
  return [{ type: 'home', payload: {}, title: 'Home', subtitle: '', id: 'home' }];
}

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <ToolTabProvider initialTabs={createInitialTabs}>
        <AppShell />
      </ToolTabProvider>
    </ErrorBoundary>
  );
}

export default App;
