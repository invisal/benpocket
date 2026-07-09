import { ToolComponentProps } from '@renderer/components/providers/createTabProvider';
import { useToolTabs } from '@renderer/components/providers/ToolProvider';
import { Button } from '@renderer/components/ui/Button';
import { GlobeIcon } from 'lucide-react';
import { useLayoutStore } from '@renderer/store/layout.store';

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

      <div className="space-y-2">
        <ToolItem
          name="Kubernetes"
          description="Deploy, inspect, and monitor Kubernetes workloads, pods, deployments, and nodes in real-time."
          onClick={() => {
            const instanceId = `kuberneter-${Date.now()}`;
            useLayoutStore.getState().addActivityInstance('kuberneter', instanceId);
            openTab('kuberneter', { instanceId });
          }}
        />
        <ToolItem
          name="HTTP Request"
          description="Compose API requests, trigger mock response payloads, customize HTTP headers, and inspect JSON bodies."
          onClick={() => openTab('http-client', {})}
        />
        <ToolItem
          name="Screen Recorder"
          description="Simulate high-fidelity screen recording sessions with mouse click zoom levels, canvas backdrops, and export presets."
          onClick={() => openTab('screen-recorder', {})}
        />
      </div>

      <div className="flex gap-2 mt-12">
        <Button variant="primary">Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </div>
  );
}

function ToolItem({
  name,
  description,
  onClick
}: {
  name: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button role="button" key={name} className="flex gap-2 text-left" onClick={onClick}>
      <span className="size-12 rounded bg-surface-2 inline-flex items-center justify-center">
        <GlobeIcon size={18} />
      </span>
      <p className="flex flex-col text-sm justify-center">
        <span className="font-medium">{name}</span>
        <span className="text-gray-500">{description}</span>
      </p>
    </button>
  );
}
