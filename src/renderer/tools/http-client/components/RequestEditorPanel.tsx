import type React from 'react';
import { useMemo, useState } from 'react';
import { PillTab } from '@renderer/components/ui/Tabs';
import { ChevronDown, ChevronRight, Redo2, Undo2 } from 'lucide-react';
import type { HttpBodyType } from '../../../../preload/http-client/types';
import type { UseHttpResult } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { useCollectionsStore } from '../store/collections.store';
import { getAutoHeaders } from '../lib/autoHeaders';
import { authTypeLabel } from '../lib/auth';
import { resolveInheritedAuth } from '../lib/authInheritance';
import { KeyValueEditor } from './KeyValueEditor';
import { MultipartBodyEditor } from './MultipartBodyEditor';
import { COMMON_HTTP_HEADERS } from './httpHeaderSuggestions';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';

type RequestTabValue = 'params' | 'headers' | 'auth' | 'body';

const BODY_TYPES: { value: HttpBodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'form', label: 'Form (urlencoded)' },
  { value: 'multipart', label: 'Form (multipart)' }
];

interface RequestEditorPanelProps {
  http: UseHttpResult;
  /** Which saved request this tab is bound to, if any - resolves 'inherit' auth against its folder/collection. */
  binding?: SavedBinding | null;
}

export const RequestEditorPanel: React.FC<RequestEditorPanelProps> = ({ http, binding }) => {
  const {
    state: { method, url, params, headers, auth, bodyType, body, bodyRows, multipartRows },
    updateParamRow: onUpdateParam,
    removeParamRow: onRemoveParam,
    updateHeaderRow: onUpdateHeader,
    removeHeaderRow: onRemoveHeader,
    setAuth: onAuthChange,
    setBodyType: onBodyTypeChange,
    setBody: onBodyChange,
    updateBodyRow: onUpdateBodyRow,
    removeBodyRow: onRemoveBodyRow,
    updateMultipartRow: onUpdateMultipartRow,
    removeMultipartRow: onRemoveMultipartRow,
    pickMultipartFile: onPickMultipartFile,
    undo,
    redo,
    canUndo,
    canRedo
  } = http;
  const [activeTab, setActiveTab] = useState<RequestTabValue>('params');
  const [showAutoHeaders, setShowAutoHeaders] = useState(false);
  const variables = useActiveEnvironmentVariables();
  const collections = useCollectionsStore((s) => s.collections);

  const activeParamCount = params.filter((p) => p.enabled && p.key.trim()).length;
  const activeHeaderCount = headers.filter((h) => h.enabled && h.key.trim()).length;
  const effectiveAuth = useMemo(() => {
    const collection = binding ? collections.find((c) => c.id === binding.collectionId) : undefined;
    return resolveInheritedAuth(auth, collection, binding?.requestId);
  }, [auth, binding, collections]);
  const autoHeaders = useMemo(
    () => getAutoHeaders(method, url, bodyType, body, headers, variables, effectiveAuth),
    [method, url, bodyType, body, headers, variables, effectiveAuth]
  );

  return (
    <PillTab.Root
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as RequestTabValue)}
      className="flex flex-col min-h-0 flex-1"
    >
      <div className="flex items-center justify-between gap-2 mx-3 shrink-0">
        <PillTab.List>
          <PillTab.Item value="params">
            Params{activeParamCount > 0 ? ` (${activeParamCount})` : ''}
          </PillTab.Item>
          <PillTab.Item value="headers">
            Headers{activeHeaderCount > 0 ? ` (${activeHeaderCount})` : ''}
          </PillTab.Item>
          <PillTab.Item value="auth">
            Authorization{auth.type !== 'noauth' ? ` (${authTypeLabel(auth.type)})` : ''}
          </PillTab.Item>
          <PillTab.Item value="body">
            Body{bodyType !== 'none' ? ` (${bodyType})` : ''}
          </PillTab.Item>
          <PillTab.Indicator />
        </PillTab.List>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex items-center justify-center size-6 rounded-sm text-zinc-400 hover:text-foreground hover:bg-border-dark/60 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="flex items-center justify-center size-6 rounded-sm text-zinc-400 hover:text-foreground hover:bg-border-dark/60 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            <Redo2 size={13} />
          </button>
        </div>
      </div>

      <PillTab.Panel value="params" className="flex-1 min-h-0 overflow-auto p-3">
        <KeyValueEditor
          rows={params}
          onUpdate={onUpdateParam}
          onRemove={onRemoveParam}
          keyPlaceholder="Param"
          valuePlaceholder="Value or {{var}}"
        />
      </PillTab.Panel>

      <PillTab.Panel value="headers" className="flex-1 min-h-0 overflow-auto p-3">
        <KeyValueEditor
          rows={headers}
          onUpdate={onUpdateHeader}
          onRemove={onRemoveHeader}
          keyPlaceholder="Header"
          valuePlaceholder="Value or {{var}}"
          keySuggestions={COMMON_HTTP_HEADERS}
        />
        {autoHeaders.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <button
              onClick={() => setShowAutoHeaders((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              {showAutoHeaders ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {autoHeaders.length} auto-generated header{autoHeaders.length === 1 ? '' : 's'}{' '}
              {showAutoHeaders ? 'shown' : 'hidden'}
            </button>
            {showAutoHeaders && (
              <div className="flex flex-col gap-1 mt-1.5">
                {autoHeaders.map((h) => (
                  <div
                    key={h.key}
                    className="grid grid-cols-[34px_1fr_2fr_24px] gap-2 items-center"
                    title="Automatically generated from the URL/body - not editable here."
                  >
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="accent-accent opacity-40 justify-self-center"
                    />
                    <span className="bg-surface-2 border border-border text-xs rounded px-2 py-1 text-zinc-600 truncate">
                      {h.key}
                    </span>
                    <span className="bg-surface-2 border border-border text-xs rounded px-2 py-1 text-zinc-600 truncate">
                      {h.value}
                    </span>
                    <span />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PillTab.Panel>

      <PillTab.Panel value="auth" className="flex-1 min-h-0 overflow-auto p-3">
        <AuthEditor auth={auth} onChange={onAuthChange} />
      </PillTab.Panel>

      <PillTab.Panel value="body" className="flex-1 min-h-0 flex flex-col gap-2 p-3 overflow-auto">
        <div className="flex gap-3 text-[11px] shrink-0">
          {BODY_TYPES.map((bt) => (
            <label
              key={bt.value}
              className="flex items-center gap-1.5 cursor-pointer text-zinc-400"
            >
              <input
                type="radio"
                name="body-type"
                checked={bodyType === bt.value}
                onChange={() => onBodyTypeChange(bt.value)}
                className="accent-accent cursor-pointer"
              />
              {bt.label}
            </label>
          ))}
        </div>
        {bodyType === 'form' && (
          <KeyValueEditor
            rows={bodyRows}
            onUpdate={onUpdateBodyRow}
            onRemove={onRemoveBodyRow}
            keyPlaceholder="Key"
            valuePlaceholder="Value or {{var}}"
          />
        )}
        {bodyType === 'multipart' && (
          <MultipartBodyEditor
            rows={multipartRows}
            onUpdate={onUpdateMultipartRow}
            onRemove={onRemoveMultipartRow}
            onPickFile={onPickMultipartFile}
          />
        )}
        {bodyType !== 'none' && bodyType !== 'form' && bodyType !== 'multipart' && (
          <BodyEditor
            value={body}
            onChange={onBodyChange}
            bodyType={bodyType}
            variables={variables}
            placeholder={bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body...'}
          />
        )}
      </PillTab.Panel>
    </PillTab.Root>
  );
};
