import React from 'react';
import { AppShell } from './components/layout/AppShell';
import { ToolTabItem, ToolTabProvider } from './components/providers/ToolProvider';

function createInitialTabs(): ToolTabItem[] {
  return [{ type: 'home', payload: {}, title: 'Home', subtitle: '', id: 'home' }];
}

function App(): React.JSX.Element {
  return (
    <ToolTabProvider initialTabs={createInitialTabs}>
      <AppShell />
    </ToolTabProvider>
  );
}

export default App;
