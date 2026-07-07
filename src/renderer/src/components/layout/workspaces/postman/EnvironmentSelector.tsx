import React, { useEffect, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown, Globe, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEnvironmentsStore } from '../../../../store/environments.store';
import { KeyValueEditor } from './KeyValueEditor';
import { withTrailingRow, type KeyValueRow } from '../../../../hooks/useApiClient';

const SAVE_DEBOUNCE_MS = 400;

export const EnvironmentSelector: React.FC = () => {
  const {
    environments,
    isLoaded,
    load,
    activeEnvironmentId,
    setActiveEnvironmentId,
    createEnvironment,
    renameEnvironment,
    deleteEnvironment,
    saveVariables
  } = useEnvironmentsStore();

  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [localVariables, setLocalVariables] = useState<KeyValueRow[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) ?? null;

  useEffect(() => {
    setLocalVariables(withTrailingRow(activeEnvironment?.variables ?? []));
    // Reset local draft whenever the active environment (or its saved data) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnvironment?.id, activeEnvironment?.variables]);

  const persistVariables = (environmentId: string, rows: KeyValueRow[]): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveVariables(
        environmentId,
        rows.filter((r) => r.key.trim() || r.value.trim())
      );
    }, SAVE_DEBOUNCE_MS);
  };

  const updateVariable = (id: string, patch: Partial<KeyValueRow>): void => {
    if (!activeEnvironment) return;
    const next = withTrailingRow(localVariables.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setLocalVariables(next);
    persistVariables(activeEnvironment.id, next);
  };

  const removeVariable = (id: string): void => {
    if (!activeEnvironment) return;
    const next = withTrailingRow(localVariables.filter((r) => r.id !== id));
    setLocalVariables(next);
    persistVariables(activeEnvironment.id, next);
  };

  const submitNewEnvironment = async (): Promise<void> => {
    const name = draftName.trim();
    setIsCreating(false);
    setDraftName('');
    if (name) await createEnvironment(name);
  };

  const submitRename = (): void => {
    setIsRenaming(false);
    const trimmed = renameDraft.trim();
    if (activeEnvironment && trimmed && trimmed !== activeEnvironment.name) {
      renameEnvironment(activeEnvironment.id, trimmed);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar-bg border border-border-dark hover:border-accent text-zinc-300 hover:text-white text-xs font-semibold rounded cursor-pointer transition-colors">
        <Globe size={12} className={activeEnvironment ? 'text-accent' : 'text-zinc-500'} />
        <span className="max-w-32 truncate">{activeEnvironment?.name ?? 'No Environment'}</span>
        <ChevronDown size={11} className="text-zinc-500" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="bg-sidebar-bg border border-border-dark rounded-lg shadow-xl p-3 w-80 flex flex-col gap-3 text-xs outline-none">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">Environment</span>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setDraftName('');
                }}
                title="New Environment"
                className="p-1 text-zinc-500 hover:text-white hover:bg-border-dark/60 rounded cursor-pointer"
              >
                <Plus size={13} />
              </button>
            </div>

            {isCreating && (
              <input
                type="text"
                autoFocus
                placeholder="Environment name..."
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={submitNewEnvironment}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNewEnvironment();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setDraftName('');
                  }
                }}
                className="bg-editor-bg border border-accent rounded px-2 py-1.5 text-zinc-200 focus:outline-none"
              />
            )}

            <select
              value={activeEnvironmentId ?? ''}
              onChange={(e) => setActiveEnvironmentId(e.target.value || null)}
              className="bg-editor-bg border border-border-dark rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">No Environment</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>

            {activeEnvironment ? (
              <>
                <div className="flex items-center justify-between border-t border-border-dark pt-2">
                  {isRenaming ? (
                    <input
                      type="text"
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename();
                        if (e.key === 'Escape') setIsRenaming(false);
                      }}
                      className="flex-1 bg-editor-bg border border-accent rounded px-1.5 py-0.5 text-zinc-200 focus:outline-none"
                    />
                  ) : (
                    <span className="text-zinc-400 font-semibold truncate">{activeEnvironment.name}</span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setRenameDraft(activeEnvironment.name);
                        setIsRenaming(true);
                      }}
                      title="Rename environment"
                      className="p-0.5 text-zinc-555 hover:text-white cursor-pointer"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => deleteEnvironment(activeEnvironment.id)}
                      title="Delete environment"
                      className="p-0.5 text-zinc-555 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-auto pr-1">
                  <KeyValueEditor
                    rows={localVariables}
                    onUpdate={updateVariable}
                    onRemove={removeVariable}
                    keyPlaceholder="Variable"
                    valuePlaceholder="Value"
                  />
                </div>
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Use <code className="text-accent">{'{{variable}}'}</code> in the URL, headers, params, or body -
                  resolved automatically when sending.
                </p>
              </>
            ) : (
              <div className="text-[11px] text-zinc-650 italic py-2 leading-relaxed">
                No active environment. Create or select one above to define variables like{' '}
                <code className="text-zinc-500">base_url</code> and <code className="text-zinc-500">token</code>.
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
