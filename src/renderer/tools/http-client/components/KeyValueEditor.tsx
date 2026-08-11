import type React from 'react';
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

  return (
    <div className="flex flex-col border-border border rounded overflow-hidden bg-surface divide-y divide-border-light">
      <div className="grid grid-cols-[34px_1fr_2fr] divide-x divide-border-light h-8 text-[10px] font-medium uppercase tracking-wider bg-surface-2">
        <span />
        <span className="flex items-center px-2">{keyPlaceholder}</span>
        <span className="flex items-center px-2">{valuePlaceholder}</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="group grid grid-cols-[34px_1fr_2fr] items-center divide-x divide-border-light [&>*:last-child]:!border-l-0"
        >
          <div
            className="h-8 w-full flex items-center justify-center"
            onClick={() => onUpdate(row.id, { enabled: !row.enabled })}
          >
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={() => onUpdate(row.id, { enabled: !row.enabled })}
              tabIndex={-1}
              className="accent-accent"
            />
          </div>
          {keySuggestions ? (
            <KeySuggestInput
              value={row.key}
              onChange={(key) => onUpdate(row.id, { key })}
              suggestions={keySuggestions}
              placeholder={keyPlaceholder}
              className="h-8 w-full outline-none px-2 text-xs"
            />
          ) : (
            <input
              type="text"
              value={row.key}
              placeholder={keyPlaceholder}
              autoCorrect="false"
              spellCheck="false"
              className="h-8 w-full outline-none px-2 text-xs"
              onChange={(e) => onUpdate(row.id, { key: e.target.value })}
            />
          )}
          <div className="h-8 flex">
            <VariableSuggestInput
              value={row.value}
              onChange={(value) => onUpdate(row.id, { value })}
              variables={variables}
              placeholder={valuePlaceholder}
              className={`w-full h-8 px-2 text-xs outline-none ${row.enabled ? 'text-zinc-200' : 'text-zinc-600'}`}
            />
            <div className="h-8 items-center justify-center flex px-2">
              <button
                onClick={() => onRemove(row.id)}
                disabled={isLastRow(row.id)}
                tabIndex={-1}
                title="Remove row"
                className=" p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-default cursor-pointer transition justify-self-center"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
