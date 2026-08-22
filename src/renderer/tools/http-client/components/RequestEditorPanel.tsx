import type React from 'react';
import { useMemo, useState } from 'react';
import { PillTab } from '@renderer/components/ui/Tabs';
import { ChevronDown, ChevronRight, Redo2, Undo2 } from 'lucide-react';
import type { HttpAuthType, HttpBodyType } from '../../../../preload/http-client/types';
import type { UseHttpResult } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { useCollectionsStore } from '../store/collections.store';
import { getAutoHeaders } from '../lib/autoHeaders';
import { AUTH_TYPE_OPTIONS, authTypeLabel } from '../lib/auth';
import { resolveInheritedAuth } from '../lib/authInheritance';
import { KeyValueEditor } from './KeyValueEditor';
import { MultipartBodyEditor } from './MultipartBodyEditor';
import { COMMON_HTTP_HEADERS } from './httpHeaderSuggestions';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { Menu } from '@renderer/components/ui/Menu';

type RequestTabValue = 'params' | 'headers' | 'auth' | 'body';

const BODY_TYPE_LABELS: Record<HttpBodyType, string> = {
  none: 'None',
  json: 'JSON',
  text: 'Text',
  form: 'URL Encoded',
  multipart: 'Multi-Part'
};

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
            {activeTab === 'auth' ? (
              <Menu.Root>
                <Menu.Trigger
                  render={<span />}
                  nativeButton={false}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <span>{authTypeLabel(auth.type)}</span>
                  <ChevronDown size={14} />
                </Menu.Trigger>
                <Menu.Content sideOffset={10} alignOffset={-10} align="start">
                  <Menu.RadioGroup
                    value={auth.type}
                    onValueChange={(value) =>
                      onAuthChange({ ...auth, type: value as HttpAuthType })
                    }
                  >
                    {AUTH_TYPE_OPTIONS.map((opt) => (
                      <Menu.RadioItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            ) : (
              <span className="flex items-center gap-1">
                {authTypeLabel(auth.type)}
                <ChevronDown size={14} />
              </span>
            )}
          </PillTab.Item>
          <PillTab.Item value="body">
            {activeTab === 'body' ? (
              <Menu.Root>
                <Menu.Trigger
                  render={<span />}
                  nativeButton={false}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <span>{bodyType === 'none' ? 'Body' : BODY_TYPE_LABELS[bodyType]}</span>
                  <ChevronDown size={14} />
                </Menu.Trigger>
                <Menu.Content sideOffset={10} alignOffset={-10} align="start">
                  <Menu.RadioGroup
                    value={bodyType}
                    onValueChange={(value) => onBodyTypeChange(value as HttpBodyType)}
                  >
                    <Menu.Group>
                      <Menu.GroupLabel>Form Data</Menu.GroupLabel>
                      <Menu.RadioItem value="form">{BODY_TYPE_LABELS.form}</Menu.RadioItem>
                      <Menu.RadioItem value="multipart">
                        {BODY_TYPE_LABELS.multipart}
                      </Menu.RadioItem>
                    </Menu.Group>
                    <Menu.Group>
                      <Menu.GroupLabel>Text Content</Menu.GroupLabel>
                      <Menu.RadioItem value="json">{BODY_TYPE_LABELS.json}</Menu.RadioItem>
                      <Menu.RadioItem value="text">{BODY_TYPE_LABELS.text}</Menu.RadioItem>
                    </Menu.Group>
                    <Menu.Group>
                      <Menu.GroupLabel>Other</Menu.GroupLabel>
                      <Menu.RadioItem value="none">{BODY_TYPE_LABELS.none}</Menu.RadioItem>
                    </Menu.Group>
                  </Menu.RadioGroup>
                </Menu.Content>
              </Menu.Root>
            ) : (
              <span className="flex items-center gap-1">
                {bodyType === 'none' ? 'Body' : BODY_TYPE_LABELS[bodyType]}
                <ChevronDown size={14} />
              </span>
            )}
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
                    <span className="bg-surface-2 border border-border text-sm rounded px-2 py-1 text-zinc-600 truncate">
                      {h.key}
                    </span>
                    <span className="bg-surface-2 border border-border text-sm rounded px-2 py-1 text-zinc-600 truncate">
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

      <PillTab.Panel value="body" className="flex-1 min-h-0 flex flex-col gap-2 overflow-auto">
        {bodyType === 'form' && (
          <div className="p-3 flex-1">
            <KeyValueEditor
              rows={bodyRows}
              onUpdate={onUpdateBodyRow}
              onRemove={onRemoveBodyRow}
              keyPlaceholder="Key"
              valuePlaceholder="Value or {{var}}"
            />
          </div>
        )}
        {bodyType === 'multipart' && (
          <div className="p-3 flex-1">
            <MultipartBodyEditor
              rows={multipartRows}
              onUpdate={onUpdateMultipartRow}
              onRemove={onRemoveMultipartRow}
              onPickFile={onPickMultipartFile}
            />
          </div>
        )}
        {bodyType !== 'none' && bodyType !== 'form' && bodyType !== 'multipart' && (
          <BodyEditor
            value={body}
            onChange={onBodyChange}
            bodyType={bodyType}
            variables={variables}
            placeholder="..."
          />
        )}
        {bodyType === 'none' && (
          <p className="text-[11px] text-muted-foreground italic p-3">
            This request does not have a body. Pick a type from the Body dropdown above to add one.
          </p>
        )}
      </PillTab.Panel>
    </PillTab.Root>
  );
};
