import React, { useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import type { HttpBodyType } from '../../../../preload/http-client/types';
import type { KeyValueRow } from '../lib/keyValueRows';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { KeyValueEditor } from './KeyValueEditor';
import { COMMON_HTTP_HEADERS } from './httpHeaderSuggestions';
import { BodyEditor } from './BodyEditor';

type RequestTabValue = 'params' | 'headers' | 'body';

const BODY_TYPES: { value: HttpBodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'form', label: 'Form (urlencoded)' }
];

interface RequestEditorPanelProps {
  params: KeyValueRow[];
  onUpdateParam: (id: string, patch: Partial<KeyValueRow>) => void;
  onRemoveParam: (id: string) => void;
  headers: KeyValueRow[];
  onUpdateHeader: (id: string, patch: Partial<KeyValueRow>) => void;
  onRemoveHeader: (id: string) => void;
  bodyType: HttpBodyType;
  onBodyTypeChange: (type: HttpBodyType) => void;
  body: string;
  onBodyChange: (body: string) => void;
}

export const RequestEditorPanel: React.FC<RequestEditorPanelProps> = ({
  params,
  onUpdateParam,
  onRemoveParam,
  headers,
  onUpdateHeader,
  onRemoveHeader,
  bodyType,
  onBodyTypeChange,
  body,
  onBodyChange
}) => {
  const [activeTab, setActiveTab] = useState<RequestTabValue>('params');
  const variables = useActiveEnvironmentVariables();

  const activeParamCount = params.filter((p) => p.enabled && p.key.trim()).length;
  const activeHeaderCount = headers.filter((h) => h.enabled && h.key.trim()).length;

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as RequestTabValue)}
      className="flex flex-col gap-3 shrink-0"
    >
      <Tabs.List className="flex gap-4 border-b border-border-dark text-xs select-none">
        <Tabs.Tab
          value="params"
          className={`py-1 border-b -mb-px cursor-pointer transition-colors ${
            activeTab === 'params'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-zinc-555 hover:text-zinc-350'
          }`}
        >
          Params{activeParamCount > 0 ? ` (${activeParamCount})` : ''}
        </Tabs.Tab>
        <Tabs.Tab
          value="headers"
          className={`py-1 border-b -mb-px cursor-pointer transition-colors ${
            activeTab === 'headers'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-zinc-555 hover:text-zinc-350'
          }`}
        >
          Headers{activeHeaderCount > 0 ? ` (${activeHeaderCount})` : ''}
        </Tabs.Tab>
        <Tabs.Tab
          value="body"
          className={`py-1 border-b -mb-px cursor-pointer transition-colors ${
            activeTab === 'body'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-zinc-555 hover:text-zinc-350'
          }`}
        >
          Body{bodyType !== 'none' ? ` (${bodyType})` : ''}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="params" className="max-h-40 overflow-auto pr-1">
        <KeyValueEditor
          rows={params}
          onUpdate={onUpdateParam}
          onRemove={onRemoveParam}
          keyPlaceholder="Param"
          valuePlaceholder="Value or {{var}}"
        />
      </Tabs.Panel>

      <Tabs.Panel value="headers" className="max-h-40 overflow-auto pr-1">
        <KeyValueEditor
          rows={headers}
          onUpdate={onUpdateHeader}
          onRemove={onRemoveHeader}
          keyPlaceholder="Header"
          valuePlaceholder="Value or {{var}}"
          keySuggestions={COMMON_HTTP_HEADERS}
        />
      </Tabs.Panel>

      <Tabs.Panel value="body" className="flex flex-col gap-2">
        <div className="flex gap-3 text-[11px]">
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
        {bodyType !== 'none' && (
          <BodyEditor
            value={body}
            onChange={onBodyChange}
            bodyType={bodyType}
            variables={variables}
            placeholder={bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body...'}
          />
        )}
      </Tabs.Panel>
    </Tabs.Root>
  );
};
