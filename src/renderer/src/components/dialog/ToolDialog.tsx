import { useEffect, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  CameraIcon,
  Folder,
  FolderOpen,
  GlobeIcon,
  Plus,
  Server,
  VideoIcon
} from 'lucide-react';
import { cn } from 'cnfast';
import { Dialog } from '../ui/Dialog';
import { useToolTabs } from '../providers/ToolProvider';
import { useLayoutStore } from '../../store/layout.store';
import { useKuberneterStore } from '../../../tools/kuberneter/store/kuberneter.store';
import { useWorkspacesStore } from '../../../tools/http-client/store/workspaces.store';
import kuberneterIcon from '@renderer/assets/kuberneter-icon.svg';

type ToolDialogView = 'tools' | 'kuberneter' | 'http-client';

interface ToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolDialog({ open, onOpenChange }: ToolDialogProps) {
  const [view, setView] = useState<ToolDialogView>('tools');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [draftWorkspaceName, setDraftWorkspaceName] = useState('');
  const { tabs, selectTab, openTab } = useToolTabs();
  const kuberneterKubeconfigs = useKuberneterStore((s) => s.kuberneterKubeconfigs);
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const workspacesLoaded = useWorkspacesStore((s) => s.isLoaded);
  const loadWorkspaces = useWorkspacesStore((s) => s.load);
  const createWorkspace = useWorkspacesStore((s) => s.createWorkspace);

  useEffect(() => {
    if (open && !workspacesLoaded) loadWorkspaces();
  }, [open, workspacesLoaded, loadWorkspaces]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setView('tools');
    onOpenChange(next);
  };

  const close = () => handleOpenChange(false);

  const handleOpenKubeconfig = (configPath: string) => {
    const instanceId = `kuberneter-${Date.now()}`;
    useLayoutStore
      .getState()
      .addActivityInstance('kuberneter', instanceId, { configPath, cluster: '' });
    openTab('kuberneter', { instanceId });
    close();
  };

  const handleAddKubeconfigFile = async () => {
    const filePath = await window.kuberneter.selectKubeconfigFile();
    if (filePath) {
      useKuberneterStore.getState().addKuberneterKubeconfig(filePath);
      handleOpenKubeconfig(filePath);
    }
  };

  const handleOpenWorkspace = (workspaceId: string) => {
    useWorkspacesStore.getState().setActiveWorkspaceId(workspaceId);
    const existing = tabs.find((t) => t.type === 'http-client');
    if (existing) selectTab(existing.id);
    else openTab('http-client', {});
    close();
  };

  const submitNewWorkspace = async () => {
    const name = draftWorkspaceName.trim();
    setIsCreatingWorkspace(false);
    setDraftWorkspaceName('');
    if (!name) return;
    const workspace = await createWorkspace(name);
    handleOpenWorkspace(workspace.id);
  };

  const handleOpenScreenRecorder = () => {
    openTab('screen-recorder', {});
    close();
  };

  const handleOpenScreenCapture = () => {
    openTab('screen-capture', {});
    close();
  };

  const handleOpenFileExplorer = () => {
    openTab('file-explorer', {});
    close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content className="max-w-sm">
        {view === 'tools' && (
          <>
            <Dialog.Title>Add Tool</Dialog.Title>
            <Dialog.Description>Choose a tool to open.</Dialog.Description>
            <div className="mt-4 space-y-1">
              <ToolRow
                icon={<img src={kuberneterIcon} className="size-5" alt="Kubernetes" />}
                name="Kubernetes"
                description="Connect to a cluster and manage workloads."
                onClick={() => setView('kuberneter')}
              />
              <ToolRow
                icon={<GlobeIcon size={18} />}
                name="HTTP Client"
                description="Compose and send API requests."
                onClick={() => setView('http-client')}
              />
              <ToolRow
                icon={<VideoIcon size={18} />}
                name="Screen Recorder"
                description="Record and export your screen."
                onClick={handleOpenScreenRecorder}
              />
              <ToolRow
                icon={<CameraIcon size={18} />}
                name="Screen Capture"
                description="Capture a still image from your screen."
                onClick={handleOpenScreenCapture}
              />
              <ToolRow
                icon={<Folder size={18} />}
                name="File Explorer"
                description="Browse files on your computer."
                onClick={handleOpenFileExplorer}
              />
            </div>
          </>
        )}

        {view === 'kuberneter' && (
          <>
            <DialogSubHeader title="Select Kube Config" onBack={() => setView('tools')} />
            <div className="mt-4 space-y-1">
              <ToolRow
                icon={<Server size={18} />}
                name="Default Config"
                description="~/.kube/config"
                onClick={() => handleOpenKubeconfig('default')}
              />
              {kuberneterKubeconfigs.map((configPath) => (
                <ToolRow
                  key={configPath}
                  icon={<Server size={18} />}
                  name={configPath.split(/[/\\]/).pop() || configPath}
                  description={configPath}
                  onClick={() => handleOpenKubeconfig(configPath)}
                />
              ))}
              <ToolRow
                icon={<Plus size={18} />}
                name="Add Config File..."
                onClick={handleAddKubeconfigFile}
              />
            </div>
          </>
        )}

        {view === 'http-client' && (
          <>
            <DialogSubHeader title="Select Workspace" onBack={() => setView('tools')} />
            <div className="mt-4 space-y-1">
              {workspaces.map((workspace) => (
                <ToolRow
                  key={workspace.id}
                  icon={<FolderOpen size={18} />}
                  name={workspace.name}
                  description={new Date(workspace.createdAt).toLocaleDateString()}
                  onClick={() => handleOpenWorkspace(workspace.id)}
                />
              ))}
              {isCreatingWorkspace ? (
                <input
                  type="text"
                  autoFocus
                  placeholder="Workspace name..."
                  value={draftWorkspaceName}
                  onChange={(e) => setDraftWorkspaceName(e.target.value)}
                  onBlur={submitNewWorkspace}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNewWorkspace();
                    if (e.key === 'Escape') {
                      setIsCreatingWorkspace(false);
                      setDraftWorkspaceName('');
                    }
                  }}
                  className="w-full bg-surface-2 border border-accent rounded-md px-2.5 py-2 text-[13px] text-text-base outline-none"
                />
              ) : (
                <ToolRow
                  icon={<Plus size={18} />}
                  name="New Workspace..."
                  onClick={() => {
                    setIsCreatingWorkspace(true);
                    setDraftWorkspaceName('');
                  }}
                />
              )}
            </div>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function DialogSubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex size-6 items-center justify-center rounded-sm text-text-dim outline-none hover:bg-border-dark/60 hover:text-text-base"
      >
        <ChevronLeft size={16} />
      </button>
      <Dialog.Title>{title}</Dialog.Title>
    </div>
  );
}

function ToolRow({
  icon,
  name,
  description,
  onClick
}: {
  icon: ReactNode;
  name: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left outline-none',
        'hover:bg-border-dark/60'
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-text-base">{name}</span>
        {description && <span className="truncate text-xs text-text-dim">{description}</span>}
      </span>
    </button>
  );
}
