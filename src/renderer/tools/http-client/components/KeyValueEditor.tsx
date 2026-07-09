import React from 'react';
import { Trash2 } from 'lucide-react';
import type { KeyValueRow } from '../lib/keyValueRows';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { KeySuggestInput } from './KeySuggestInput';
import { VariableSuggestInput } from './VariableSuggestInput';

interface KeyValueEditorProps {
  rows: KeyValueRow[];
  onUpdate: (id: string, patch: Partial<KeyValueRow>) => void;
  onRemove: (id: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** When set, the key column offers a filtered dropdown of these values (e.g. common header names). */
  keySuggestions?: string[];
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  rows,
  onUpdate,
  onRemove,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keySuggestions
}) => {
  const variables = useActiveEnvironmentVariables();
  const isLastRow = (id: string): boolean => rows[rows.length - 1]?.id === id;
  const keyInputClassName = (enabled: boolean): string =>
    `bg-editor-bg border border-border-dark text-xs rounded px-2 py-1 focus:outline-none focus:border-accent w-full ${
      enabled ? 'text-zinc-200' : 'text-zinc-600'
    }`;

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[20px_1fr_1fr_24px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        <span />
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[20px_1fr_1fr_24px] gap-2 items-center">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => onUpdate(row.id, { enabled: e.target.checked })}
            className="accent-accent cursor-pointer justify-self-center"
            title={row.enabled ? 'Disable row' : 'Enable row'}
          />
          {keySuggestions ? (
            <KeySuggestInput
              value={row.key}
              onChange={(key) => onUpdate(row.id, { key })}
              suggestions={keySuggestions}
              placeholder={keyPlaceholder}
              className={keyInputClassName(row.enabled)}
            />
          ) : (
            <input
              type="text"
              value={row.key}
              placeholder={keyPlaceholder}
              onChange={(e) => onUpdate(row.id, { key: e.target.value })}
              className={keyInputClassName(row.enabled)}
            />
          )}
          <VariableSuggestInput
            value={row.value}
            onChange={(value) => onUpdate(row.id, { value })}
            variables={variables}
            placeholder={valuePlaceholder}
            className={`w-full bg-editor-bg border border-border-dark text-xs rounded px-2 py-1 focus:outline-none focus:border-accent ${
              row.enabled ? 'text-zinc-200' : 'text-zinc-600'
            }`}
          />
          <button
            onClick={() => onRemove(row.id)}
            disabled={isLastRow(row.id)}
            title="Remove row"
            className="p-1 text-zinc-600 hover:text-red-400 disabled:opacity-0 disabled:cursor-default cursor-pointer transition-colors justify-self-center"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};
