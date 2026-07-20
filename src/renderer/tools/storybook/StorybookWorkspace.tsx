import { useState, type ComponentType } from 'react';
import { cn } from 'cnfast';
import { ButtonGallery } from './components/ButtonGallery';
import { InputGallery } from './components/InputGallery';
import { SelectGallery } from './components/SelectGallery';
import { DialogGallery } from './components/DialogGallery';
import { MenuGallery } from './components/MenuGallery';
import { ContextMenuGallery } from './components/ContextMenuGallery';
import { PopoverGallery } from './components/PopoverGallery';
import { TooltipGallery } from './components/TooltipGallery';
import { ToolbarGallery } from './components/ToolbarGallery';
import { ListViewGallery } from './components/ListViewGallery';
import { ResizablePanelGallery } from './components/ResizablePanelGallery';
import { ColorTokenGallery } from './components/ColorTokenGallery';
import { SettingsMockup } from './components/mockups/SettingsMockup';
import { DataListMockup } from './components/mockups/DataListMockup';
import { DashboardMockup } from './components/mockups/DashboardMockup';

type NavGroup = 'Foundations' | 'Components' | 'Mockup pages';

interface NavItem {
  id: string;
  label: string;
  group: NavGroup;
  Component: ComponentType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'colors', label: 'Colors', group: 'Foundations', Component: ColorTokenGallery },
  { id: 'button', label: 'Button', group: 'Components', Component: ButtonGallery },
  { id: 'input', label: 'Input', group: 'Components', Component: InputGallery },
  { id: 'select', label: 'Select', group: 'Components', Component: SelectGallery },
  { id: 'dialog', label: 'Dialog', group: 'Components', Component: DialogGallery },
  { id: 'menu', label: 'Menu', group: 'Components', Component: MenuGallery },
  { id: 'context-menu', label: 'Context Menu', group: 'Components', Component: ContextMenuGallery },
  { id: 'popover', label: 'Popover', group: 'Components', Component: PopoverGallery },
  { id: 'tooltip', label: 'Tooltip', group: 'Components', Component: TooltipGallery },
  { id: 'toolbar', label: 'Toolbar', group: 'Components', Component: ToolbarGallery },
  { id: 'list-view', label: 'List View', group: 'Components', Component: ListViewGallery },
  {
    id: 'resizable-panel',
    label: 'Resizable Panel',
    group: 'Components',
    Component: ResizablePanelGallery
  },
  { id: 'settings-page', label: 'Settings', group: 'Mockup pages', Component: SettingsMockup },
  { id: 'data-list-page', label: 'Team Members', group: 'Mockup pages', Component: DataListMockup },
  { id: 'dashboard-page', label: 'Dashboard', group: 'Mockup pages', Component: DashboardMockup }
];

const GROUPS: NavGroup[] = ['Foundations', 'Components', 'Mockup pages'];

export function StorybookWorkspace() {
  const [activeId, setActiveId] = useState(NAV_ITEMS[0].id);
  const active = NAV_ITEMS.find((item) => item.id === activeId) ?? NAV_ITEMS[0];
  const ActiveComponent = active.Component;

  return (
    <div className="flex h-screen w-full bg-surface">
      <nav className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface-2">
        <div className="border-b border-border p-4">
          <div className="text-sm font-medium text-foreground">Storybook</div>
          <div className="text-xs text-muted-foreground">Shared component gallery</div>
        </div>
        {GROUPS.map((group) => (
          <div key={group} className="p-2">
            <div className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {group}
            </div>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                className={cn(
                  'block w-full rounded-md px-2 py-1.5 text-left text-[13px] outline-none',
                  item.id === activeId
                    ? 'bg-surface-3 text-foreground'
                    : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <h1 className="mb-6 text-base font-medium text-foreground">{active.label}</h1>
        <ActiveComponent />
      </div>
    </div>
  );
}
