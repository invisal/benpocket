import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { useToolTabs } from '@renderer/components/providers/ToolProvider';
import { Folder, GlobeIcon, PlusIcon } from 'lucide-react';
import { useLayoutStore } from '@renderer/store/layout.store';
import { ReactNode } from 'react';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';

interface Props {}

// eslint-disable-next-line no-empty-pattern
export function HomeMain({}: ToolComponentProps<Props>) {
  const { openTab } = useToolTabs();

  return (
    <div className="bg-surface w-full h-screen p-8">
      <h1 className="font-medium text-xl">benpocket</h1>
      <p>various of random tools for developers</p>

      <input
        className="border w-md h-9 text-sm px-2 rounded mt-4 mb-12 bg-surface-2 border-border outline-none"
        placeholder="Search tool..."
      />

      <div className="space-y-2 mb-8">
        <h2 className="text-sm font-medium">Tools</h2>
        <ToolItem
          name="Connect Kubernete"
          icon={<img src={kuberneterIcon} className="size-5" />}
          onClick={() => {
            const instanceId = `kuberneter-${Date.now()}`;
            useLayoutStore.getState().addActivityInstance('kuberneter', instanceId);
            openTab('kuberneter', { instanceId });
          }}
        />
        <ToolItem
          name="HTTP Request"
          icon={<GlobeIcon size={16} />}
          onClick={() => openTab('http-client', {})}
        />
        <ToolItem
          name="Screen Recorder"
          icon={<GlobeIcon size={16} />}
          onClick={() => openTab('screen-recorder', {})}
        />
        <ToolItem
          name="File Explorer"
          icon={<Folder size={16} />}
          onClick={() => openTab('file-explorer', {})}
        />
      </div>

      <div className="space-y-2 border-t pt-4 border-border">
        <h2 className="text-sm font-medium">Workspaces</h2>

        <div className="w-xs border border-dashed rounded border-border text-xs p-2 bg-surface-2 hover:bg-surface-3 inline-flex items-center gap-1">
          <PlusIcon size={14} />
          <span>Add Workspace</span>
        </div>

        <ToolItem
          name="testing-01"
          icon={<img src={kuberneterIcon} className="size-5" />}
          onClick={() => {}}
        />

        <ToolItem
          name="kube-local"
          icon={<img src={kuberneterIcon} className="size-5" />}
          onClick={() => {}}
        />
      </div>
    </div>
  );
}

export default HomeMain;

function ToolItem({ name, icon, onClick }: { name: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button role="button" key={name} className="flex gap-2 text-left" onClick={onClick}>
      <span className="size-8 rounded bg-surface-2 inline-flex items-center justify-center">
        {icon}
      </span>
      <p className="flex flex-col text-sm justify-center">
        <span className="font-medium">{name}</span>
      </p>
    </button>
  );
}
