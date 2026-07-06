import React from 'react';
import { useLayoutStore } from '../../store/layout.store';
import { Monitor, Send, Video, Terminal } from 'lucide-react';

export const HomeTab: React.FC = () => {
  const addActivityInstance = useLayoutStore((s) => s.addActivityInstance);

  const apps = [
    {
      id: 'lens' as const,
      name: 'Lens K8s IDE',
      description:
        'Deploy, inspect, and monitor Kubernetes workloads, pods, deployments, and nodes in real-time.',
      icon: Monitor,
      color:
        'from-blue-500/20 to-indigo-500/20 border-blue-500/30 hover:border-blue-500/60 shadow-blue-950/20 hover:shadow-blue-500/10 text-blue-400',
      badge: 'Kubernetes IDE'
    },
    {
      id: 'postman' as const,
      name: 'Postman Client',
      description:
        'Compose API requests, trigger mock response payloads, customize HTTP headers, and inspect JSON bodies.',
      icon: Send,
      color:
        'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-950/20 hover:shadow-emerald-500/10 text-emerald-400',
      badge: 'API Workspace'
    },
    {
      id: 'screenstudio' as const,
      name: 'ScreenStudio Canvas',
      description:
        'Simulate high-fidelity screen recording sessions with mouse click zoom levels, canvas backdrops, and export presets.',
      icon: Video,
      color:
        'from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:border-purple-500/60 shadow-purple-950/20 hover:shadow-purple-500/10 text-purple-400',
      badge: 'Studio Recorder'
    }
  ];

  return (
    <div className="flex-1 bg-editor-bg flex flex-col items-center justify-center p-6 relative overflow-hidden select-none text-zinc-300 antialiased font-sans rounded-lg border border-border-dark">
      {/* Background soft ambient radial glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Info */}
      <div className="text-center flex flex-col items-center gap-3 mb-10 max-w-lg z-10 animate-in fade-in duration-300">
        <div className="flex items-center gap-2 bg-sidebar-bg/60 border border-border-dark px-3 py-1 rounded-full text-xs font-semibold text-accent shadow-sm">
          <Terminal size={14} />
          <span>CraftBox Dashboard</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          CraftBox Workspace Suite
        </h1>
        <p className="text-xs text-zinc-450 leading-relaxed">
          Click an application below to instantiate it dynamically. Spawning an app opens it as a
          dedicated icon in the Activity Bar. You can create multiple instances of any application.
        </p>
      </div>

      {/* Grid selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.id}
              onClick={() => addActivityInstance(app.id)}
              className={`group relative bg-sidebar-bg/60 border rounded-2xl p-6 flex flex-col gap-4 cursor-pointer hover:-translate-y-1 transition-all duration-200 shadow-xl backdrop-blur-md ${app.color}`}
            >
              {/* App Icon Circle */}
              <div className="w-12 h-12 rounded-xl bg-editor-bg flex items-center justify-center border border-border-dark group-hover:scale-105 transition-transform duration-200">
                <Icon size={24} />
              </div>

              {/* Text metadata */}
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white group-hover:text-white transition-colors">
                    {app.name}
                  </h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-editor-bg border border-border-dark rounded-full text-zinc-550">
                    {app.badge}
                  </span>
                </div>
                <p className="text-xs text-zinc-455 leading-relaxed">{app.description}</p>
              </div>

              {/* Bottom launch label */}
              <div className="mt-auto pt-4 border-t border-border-dark/60 flex items-center justify-between text-[11px] font-semibold text-zinc-500 group-hover:text-white transition-colors">
                <span>Instantiate & Launch</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0 duration-200">
                  →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
