import { useState, useMemo, useCallback, useEffect, useRef, type FC } from 'react';
import { Search, Plus, Copy, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { Tooltip } from '@renderer/components/ui/Tooltip';
import { Menu } from '@renderer/components/ui/Menu';
import { useKuberneterStore } from '../../../../../store/kuberneter.store';
import { ContainerEnvRow } from './ContainerEnvRow';
import { EnvSourceBadge } from './EnvSourceBadge';
import type { LiteralEnvEntry, ReferencedEnvEntry, EnvFromEntry } from './types';

interface ContainerEnvEditorProps {
  namespace: string;
  literalEntries: LiteralEnvEntry[];
  referencedEntries: ReferencedEnvEntry[];
  envFromEntries: EnvFromEntry[];
  onKeyChange: (id: string, newKey: string) => void;
  onValueChange: (id: string, newVal: string) => void;
  onDeleteLiteral: (id: string) => void;
  onDeleteReferenced?: (id: string) => void;
  onDeleteEnvFrom?: (id: string) => void;
  onAddLiteral: () => void;
}

export const ContainerEnvEditor: FC<ContainerEnvEditorProps> = ({
  namespace,
  literalEntries,
  referencedEntries,
  envFromEntries,
  onKeyChange,
  onValueChange,
  onDeleteLiteral,
  onDeleteReferenced,
  onDeleteEnvFrom,
  onAddLiteral
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const targetFocusIdRef = useRef<string | null>(null);

  const filteredLiteralEntries = useMemo(() => {
    if (!searchFilter.trim()) return literalEntries;
    const q = searchFilter.toLowerCase();
    return literalEntries.filter(
      (e) => e.name.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)
    );
  }, [literalEntries, searchFilter]);

  const filteredReferencedEntries = useMemo(() => {
    if (!searchFilter.trim()) return referencedEntries;
    const q = searchFilter.toLowerCase();
    return referencedEntries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.refName && e.refName.toLowerCase().includes(q)) ||
        (e.refKey && e.refKey.toLowerCase().includes(q))
    );
  }, [referencedEntries, searchFilter]);

  const filteredEnvFromEntries = useMemo(() => {
    if (!searchFilter.trim()) return envFromEntries;
    const q = searchFilter.toLowerCase();
    return envFromEntries.filter(
      (e) => e.name.toLowerCase().includes(q) || (e.prefix && e.prefix.toLowerCase().includes(q))
    );
  }, [envFromEntries, searchFilter]);

  const handleAdd = useCallback(() => {
    setSearchFilter('');
    onAddLiteral();
  }, [onAddLiteral]);

  useEffect(() => {
    if (targetFocusIdRef.current) {
      const id = targetFocusIdRef.current;
      targetFocusIdRef.current = null;
      requestAnimationFrame(() => {
        const el = document.getElementById(`container-env-row-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const input = el.querySelector('input');
          input?.focus();
        }
      });
    }
  }, [literalEntries]);

  const handleCopy = useCallback((key: string, value: string) => {
    navigator.clipboard.writeText(value);
    useKuberneterStore.getState().addToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: key ? `Copied value of "${key}"` : 'Value copied to clipboard.'
    });
  }, []);

  const handleCopyAllAsEnv = useCallback(() => {
    if (literalEntries.length === 0 && referencedEntries.length === 0) return;
    const lines: string[] = [];
    for (const e of literalEntries) {
      lines.push(`${e.name}=${e.value}`);
    }
    for (const e of referencedEntries) {
      lines.push(`${e.name}=<from ${e.sourceType}:${e.refName || e.fieldPath}>`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    useKuberneterStore.getState().addToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: 'Environment variables copied in key=value format.'
    });
  }, [literalEntries, referencedEntries]);

  const totalCount = literalEntries.length + referencedEntries.length + envFromEntries.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-455 uppercase tracking-wider">
          Variables ({totalCount})
        </span>

        <div className="flex items-center gap-2">
          {totalCount > 4 && (
            <div className="relative flex items-center">
              <Search className="size-3 text-zinc-500 absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search variables..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-6 pl-6 pr-2 text-[10px] font-mono bg-surface-3 border border-border/60 rounded text-foreground outline-none w-36"
              />
            </div>
          )}

          <Tooltip.Provider delay={200} closeDelay={0}>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAllAsEnv}
                    disabled={totalCount === 0}
                    className="size-6 p-0 flex items-center justify-center bg-surface-3 hover:bg-surface-4 text-zinc-300 disabled:opacity-40"
                  >
                    <Copy className="size-3" />
                  </Button>
                }
              />
              <Tooltip.Content side="bottom">Copy all as .env</Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="h-6 px-2 text-[10px] font-medium flex items-center gap-1 bg-surface-3 hover:bg-surface-4 text-zinc-200"
          >
            <Plus className="size-3" />
            <span>Add Variable</span>
          </Button>
        </div>
      </div>

      {/* Bulk envFrom Sources if any */}
      {filteredEnvFromEntries.length > 0 && (
        <div className="flex flex-col gap-1.5 p-2 bg-surface-1/60 border border-border/60 rounded-lg">
          <span className="text-[10px] font-semibold text-zinc-450 uppercase tracking-wider">
            Bulk Sources (envFrom)
          </span>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {filteredEnvFromEntries.map((ef) => (
              <div key={ef.id} className="flex items-center gap-1">
                <EnvSourceBadge envFrom={ef} namespace={namespace} />
                {onDeleteEnvFrom && (
                  <button
                    type="button"
                    onClick={() => onDeleteEnvFrom(ef.id)}
                    title="Remove source"
                    className="text-zinc-500 hover:text-rose-400 p-0.5 rounded cursor-pointer border-none bg-transparent"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Literal Key-Value Variables Table */}
      <div className="flex flex-col border border-border/60 rounded-lg overflow-hidden bg-surface-1/40">
        <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2 px-3 py-2 bg-surface-3/50 border-b border-border/60 text-[11px] font-semibold text-zinc-400">
          <span>Name</span>
          <span>Value</span>
          <span className="w-8 text-center">Actions</span>
        </div>

        {filteredLiteralEntries.length === 0 && filteredReferencedEntries.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500 italic text-center">
            {literalEntries.length === 0 && referencedEntries.length === 0
              ? 'No environment variables configured for this container.'
              : 'No variables matching your search.'}
          </div>
        ) : (
          <>
            {filteredLiteralEntries.map((entry) => (
              <ContainerEnvRow
                key={entry.id}
                id={entry.id}
                name={entry.name}
                value={entry.value}
                onKeyChange={onKeyChange}
                onValueChange={onValueChange}
                onDelete={onDeleteLiteral}
                onCopy={handleCopy}
              />
            ))}
          </>
        )}
      </div>

      {/* Referenced (valueFrom) Variables Table if any */}
      {filteredReferencedEntries.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
            Referenced Values (valueFrom)
          </span>
          <div className="flex flex-col border border-border/60 rounded-lg overflow-hidden bg-surface-1/40">
            <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2 px-3 py-2 bg-surface-3/50 border-b border-border/60 text-[11px] font-semibold text-zinc-400">
              <span>Name</span>
              <span>Source Reference</span>
              <span className="w-8 text-center">Actions</span>
            </div>
            {filteredReferencedEntries.map((ref) => (
              <div
                key={ref.id}
                className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center px-3 py-2 border-b border-border/40 hover:bg-surface-2/40 transition-colors"
              >
                <span className="font-mono text-sm text-foreground truncate" title={ref.name}>
                  {ref.name}
                </span>
                <div>
                  <EnvSourceBadge entry={ref} namespace={namespace} />
                </div>
                <div className="flex items-center justify-center shrink-0 w-8">
                  {onDeleteReferenced && (
                    <Menu.Root>
                      <Menu.Trigger
                        render={
                          <button
                            type="button"
                            title="Actions"
                            className="size-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-3 transition-colors border-none bg-transparent cursor-pointer"
                          >
                            <MoreVertical className="size-3.5" />
                          </button>
                        }
                      />
                      <Menu.Content align="end" className="min-w-36">
                        <Menu.Item
                          onClick={() => onDeleteReferenced(ref.id)}
                          className="flex items-center gap-2 cursor-pointer text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-3.5 text-rose-400" />
                          <span>Delete</span>
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Root>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
