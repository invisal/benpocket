import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown, Globe, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { ImportedEnvironmentDraft, KeyValuePair } from '../../../../preload/http-client/types';
import { useEnvironmentsStore } from '../store/environments.store';
import { KeyValueEditor } from './KeyValueEditor';
import { withTrailingRow, type KeyValueRow } from '../lib/keyValueRows';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';

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
    saveVariables,
    importEnvironment,
    resolveEnvironmentImportConflict
  } = useEnvironmentsStore();

  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [localVariables, setLocalVariables] = useState<KeyValueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    existingId: string;
    existingName: string;
    draft: ImportedEnvironmentDraft;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) ?? null;

  // Reset the local draft whenever the active environment (or its saved data)
  // changes. Adjusted directly during render rather than in an effect, guarded
  // by the last-synced id/variables so it only reacts to genuine changes, not
  // to the user editing `localVariables` themselves.
  const [syncedEnvironmentId, setSyncedEnvironmentId] = useState<string | null>(null);
  const [syncedVariables, setSyncedVariables] = useState<KeyValuePair[] | undefined>(undefined);
  if (
    syncedEnvironmentId !== (activeEnvironment?.id ?? null) ||
    syncedVariables !== activeEnvironment?.variables
  ) {
    setSyncedEnvironmentId(activeEnvironment?.id ?? null);
    setSyncedVariables(activeEnvironment?.variables);
    setLocalVariables(withTrailingRow(activeEnvironment?.variables ?? []));
  }

  const persistVariables = (environmentId: string, rows: KeyValueRow[]): void => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveVariables(
        environmentId,
        rows.filter((r) => r.key.trim() || r.value.trim())
      ).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      });
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
    if (!name) return;
    try {
      await createEnvironment(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const submitRename = async (): Promise<void> => {
    setIsRenaming(false);
    const trimmed = renameDraft.trim();
    if (!activeEnvironment || !trimmed || trimmed === activeEnvironment.name) return;
    try {
      await renameEnvironment(activeEnvironment.id, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!activeEnvironment) return;
    try {
      await deleteEnvironment(activeEnvironment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleImport = async (): Promise<void> => {
    try {
      const result = await importEnvironment();
      if (result.canceled) return;
      if (!result.ok) {
        setError(result.error ?? 'Import failed.');
        return;
      }
      if (result.conflict) setConflict(result.conflict);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleResolveConflict = async (choice: 'replace' | 'copy'): Promise<void> => {
    if (!conflict) return;
    try {
      await resolveEnvironmentImportConflict(conflict.existingId, conflict.draft, choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setConflict(null);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Popover.Trigger className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border-dark hover:border-accent text-zinc-300 hover:text-foreground text-xs font-semibold rounded cursor-pointer transition-colors">
        <Globe size={12} className={activeEnvironment ? 'text-accent' : 'text-zinc-500'} />
        <span className="max-w-32 truncate">{activeEnvironment?.name ?? 'No Environment'}</span>
        <ChevronDown size={11} className="text-zinc-500" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="bg-surface border border-border-dark rounded-lg shadow-xl p-3 w-80 flex flex-col gap-3 text-xs outline-none">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                Environment
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleImport}
                  title="Import Postman Environment (.postman_environment.json)"
                  className="p-1 text-zinc-500 hover:text-foreground hover:bg-border-dark/60 rounded cursor-pointer"
                >
                  <Upload size={13} />
                </button>
                <button
                  onClick={() => {
                    setIsCreating(true);
                    setDraftName('');
                  }}
                  title="New Environment"
                  className="p-1 text-zinc-500 hover:text-foreground hover:bg-border-dark/60 rounded cursor-pointer"
                >
                  <Plus size={13} />
                </button>
              </div>
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
                className="bg-surface-2 border border-accent rounded px-2 py-1.5 text-zinc-200 focus:outline-none"
              />
            )}

            <select
              value={activeEnvironmentId ?? ''}
              onChange={(e) => setActiveEnvironmentId(e.target.value || null)}
              className="bg-surface-2 border border-border rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-accent cursor-pointer"
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
                <div className="flex items-center justify-between border-t border-border pt-2">
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
                      className="flex-1 bg-surface-2 border border-accent rounded px-1.5 py-0.5 text-zinc-200 focus:outline-none"
                    />
                  ) : (
                    <span className="text-zinc-400 font-semibold truncate">
                      {activeEnvironment.name}
                    </span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setRenameDraft(activeEnvironment.name);
                        setIsRenaming(true);
                      }}
                      title="Rename environment"
                      className="p-0.5 text-zinc-555 hover:text-foreground cursor-pointer"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={handleDelete}
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
                  Use <code className="text-accent">{'{{variable}}'}</code> in the URL, headers,
                  params, or body - resolved automatically when sending.
                </p>
              </>
            ) : (
              <div className="text-[11px] text-zinc-650 italic py-2 leading-relaxed">
                No active environment. Create or select one above to define variables like{' '}
                <code className="text-zinc-500">base_url</code> and{' '}
                <code className="text-zinc-500">token</code>.
              </div>
            )}

            {error && <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>

      <Dialog.Root open={conflict !== null} onOpenChange={(next) => !next && setConflict(null)}>
        <Dialog.Content className="max-w-sm p-0 overflow-hidden bg-surface border border-border-dark rounded-lg shadow-xl">
          <div className="px-4 py-3 border-b border-border-dark">
            <Dialog.Title className="text-xs font-semibold text-foreground">
              Environment already exists
            </Dialog.Title>
          </div>
          <div className="p-4 text-xs text-zinc-400 leading-relaxed">
            An environment named{' '}
            <span className="text-foreground font-semibold">
              &ldquo;{conflict?.existingName}&rdquo;
            </span>{' '}
            already exists in this workspace. Replace its variables with the imported ones, or keep
            both by importing this as a new copy.
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 bg-surface-2/40 border-t border-border-dark">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleResolveConflict('copy')}
              className="text-xs font-medium"
            >
              Keep Both (Copy)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleResolveConflict('replace')}
              className="text-xs font-medium"
            >
              Replace
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </Popover.Root>
  );
};
