import type React from 'react';
import {
  CheckCircle,
  CheckCircleIcon,
  CheckIcon,
  CheckSquare,
  CheckSquareIcon,
  CircleDot,
  CircleDotIcon,
  Trash2
} from 'lucide-react';
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
    <div className="flex flex-col border border-border rounded bg-surface divide-y divide-border">
      <div className="grid grid-cols-[34px_1fr_2fr_34px] divide-x divide-border h-8 text-[10px] font-bold uppercase tracking-wider">
        <span />
        <span className="flex items-center px-2">{keyPlaceholder}</span>
        <span className="flex items-center px-2">{valuePlaceholder}</span>
        <span />
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[34px_1fr_2fr_34px] items-center divide-x divide-border"
        >
          <div
            className="h-8 w-full flex items-center justify-center cursor-pointer hover:bg-surface-3"
            onClick={() => onUpdate(row.id, { enabled: !row.enabled })}
          >
            {row.enabled && <CircleDotIcon size={13} className="bg-blue-100 rounded-full" />}
          </div>
          {keySuggestions ? (
            <KeySuggestInput
              value={row.key}
              onChange={(key) => onUpdate(row.id, { key })}
              suggestions={keySuggestions}
              placeholder={keyPlaceholder}
            />
          ) : (
            <input
              type="text"
              value={row.key}
              placeholder={keyPlaceholder}
              autoCorrect="false"
              spellCheck="false"
              className="h-8 outline-none px-2 text-xs"
              onChange={(e) => onUpdate(row.id, { key: e.target.value })}
            />
          )}
          <VariableSuggestInput
            value={row.value}
            onChange={(value) => onUpdate(row.id, { value })}
            variables={variables}
            placeholder={valuePlaceholder}
            className={`w-full h-8 px-2 text-xs ${row.enabled ? 'text-zinc-200' : 'text-zinc-600'}`}
          />
          <div className="h-8 flex items-center justify-center">
            <button
              onClick={() => onRemove(row.id)}
              disabled={isLastRow(row.id)}
              title="Remove row"
              className="p-1 text-zinc-600 hover:text-red-400 disabled:opacity-0 disabled:cursor-default cursor-pointer transition-colors justify-self-center"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
