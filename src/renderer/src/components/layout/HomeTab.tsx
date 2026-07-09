import React from 'react';
import { useLayoutStore } from '../../store/layout.store';
import { Monitor, Send, Video } from 'lucide-react';
import { Button } from '../ui/Button';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';

export const HomeTab: React.FC = () => {
  const addActivityInstance = useLayoutStore((s) => s.addActivityInstance);

  const apps = [
    {
      id: 'kuberneter' as const,
      name: 'Kubernetes',
      description:
        'Deploy, inspect, and monitor Kubernetes workloads, pods, deployments, and nodes in real-time.',
      icon: Monitor,
      color:
        'from-blue-500/20 to-indigo-500/20 border-blue-500/30 hover:border-blue-500/60 shadow-blue-950/20 hover:shadow-blue-500/10 text-blue-400',
      badge: 'Kubernetes IDE'
    },
    {
      id: 'postman' as const,
      name: 'HTTP Request',
      description:
        'Compose API requests, trigger mock response payloads, customize HTTP headers, and inspect JSON bodies.',
      icon: Send,
      color:
        'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-950/20 hover:shadow-emerald-500/10 text-emerald-400',
      badge: 'API Workspace'
    },
    {
      id: 'screenrecorder' as const,
      name: 'Screen Recorder',
      description:
        'Simulate high-fidelity screen recording sessions with mouse click zoom levels, canvas backdrops, and export presets.',
      icon: Video,
      color:
        'from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:border-purple-500/60 shadow-purple-950/20 hover:shadow-purple-500/10 text-purple-400',
      badge: 'Studio Recorder'
    }
  ];

  return (
    <div className="bg-surface w-full h-screen p-8">
      <h1 className="font-medium text-xl">benpocket</h1>
      <p>various of random tools for developers</p>

      <input
        className="border w-md h-9 text-sm px-2 rounded mt-4 mb-12 bg-surface-2 border-border outline-none"
        placeholder="Search tool..."
      />

      <div className="space-y-2">
        {apps.map((tool) => {
          return (
            <button
              role="button"
              key={tool.id}
              className="flex gap-2 text-left"
              onClick={() => addActivityInstance(tool.id)}
            >
              <span className="size-12 rounded bg-surface-2 inline-flex items-center justify-center">
                {tool.id === 'kuberneter' ? (
                  <img
                    src={kuberneterIcon}
                    className="size-5 select-none pointer-events-none"
                    alt="Kubernetes"
                  />
                ) : (
                  <tool.icon size={18} />
                )}
              </span>
              <p className="flex flex-col text-sm justify-center">
                <span className="font-medium">{tool.name}</span>
                <span className="text-gray-500">{tool.description}</span>
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-12">
        <Button variant="primary">Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </div>
  );
};
