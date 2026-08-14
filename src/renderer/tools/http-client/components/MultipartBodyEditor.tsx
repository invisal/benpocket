import type React from 'react';
import { FileIcon, Trash2, X } from 'lucide-react';
import { Select } from '@renderer/components/ui/Select';
import type { MultipartFieldType, MultipartRow } from '../lib/multipartRows';
import { formatBytes } from '../lib/bytes';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { VariableSuggestInput } from './VariableSuggestInput';

interface MultipartBodyEditorProps {
  rows: MultipartRow[];
  onUpdate: (id: string, patch: Partial<MultipartRow>) => void;
  onRemove: (id: string) => void;
  onPickFile: (id: string) => void;
}

const FIELD_TYPE_LABELS: Record<MultipartFieldType, string> = { text: 'Text', file: 'File' };

/** Formdata editor: each row is either a plain text field or a local file,
 * picked via a native file dialog and sent by reference (see useHttp.ts's pickMultipartFile -
 * the file's bytes are only read from disk at actual send time, never loaded here). */
export const MultipartBodyEditor: React.FC<MultipartBodyEditorProps> = ({
  rows,
  onUpdate,
  onRemove,
  onPickFile
}) => {
  const variables = useActiveEnvironmentVariables();
  const isLastRow = (id: string): boolean => rows[rows.length - 1]?.id === id;

  const handleTypeChange = (row: MultipartRow, fieldType: MultipartFieldType): void => {
    if (fieldType === row.fieldType) return;
    onUpdate(
      row.id,
      fieldType === 'file' ? { fieldType, value: '' } : { fieldType, file: undefined }
    );
  };

  return (
    <div className="flex flex-col border-border border rounded overflow-hidden bg-surface divide-y divide-border-light">
      <div className="grid grid-cols-[34px_1fr_68px_2fr] divide-x divide-border-light h-8 text-[10px] font-medium uppercase tracking-wider bg-surface-2">
        <span />
        <span className="flex items-center px-2">Key</span>
        <span className="flex items-center px-2">Type</span>
        <span className="flex items-center px-2">Value</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.id}
          className="group grid grid-cols-[34px_1fr_68px_2fr] items-center divide-x divide-border-light [&>*:last-child]:border-l-0!"
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
          <input
            type="text"
            value={row.key}
            placeholder="Key"
            autoCorrect="false"
            spellCheck="false"
            className="h-8 w-full outline-none px-2 text-xs"
            onChange={(e) => onUpdate(row.id, { key: e.target.value })}
          />
          <div className="h-8 flex items-center px-1">
            <Select.Root
              value={row.fieldType}
              onValueChange={(value) => handleTypeChange(row, value as MultipartFieldType)}
            >
              <Select.Trigger size="sm" className="w-full justify-between px-1.5 text-[11px]">
                {FIELD_TYPE_LABELS[row.fieldType]}
              </Select.Trigger>
              <Select.Content side="bottom" align="start">
                <Select.Item value="text">
                  <Select.ItemText>Text</Select.ItemText>
                </Select.Item>
                <Select.Item value="file">
                  <Select.ItemText>File</Select.ItemText>
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
          <div className="h-8 flex">
            {row.fieldType === 'file' ? (
              <div className="flex-1 min-w-0 h-8 flex items-center gap-1.5 px-2">
                {row.file ? (
                  <>
                    <FileIcon size={12} className="shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs text-zinc-200" title={row.file.filePath}>
                      {row.file.fileName}
                    </span>
                    {row.file.size > 0 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatBytes(row.file.size)}
                      </span>
                    )}
                    <button
                      onClick={() => onUpdate(row.id, { file: undefined })}
                      title="Clear file"
                      className="shrink-0 p-0.5 text-zinc-600 hover:text-red-400 cursor-pointer transition"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onPickFile(row.id)}
                    className="text-xs text-accent hover:underline cursor-pointer"
                  >
                    Select file…
                  </button>
                )}
              </div>
            ) : (
              <VariableSuggestInput
                value={row.value}
                onChange={(value) => onUpdate(row.id, { value })}
                variables={variables}
                placeholder="Value or {{var}}"
                className={`w-full h-8 px-2 text-xs outline-none ${row.enabled ? 'text-zinc-200' : 'text-zinc-600'}`}
              />
            )}
            <div className="h-8 items-center justify-center flex px-2">
              <button
                onClick={() => onRemove(row.id)}
                disabled={isLastRow(row.id)}
                tabIndex={-1}
                title="Remove row"
                className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-default cursor-pointer transition justify-self-center"
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
