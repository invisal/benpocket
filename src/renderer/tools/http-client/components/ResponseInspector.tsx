import React, { useMemo, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { HttpResponsePayload } from '../../../../preload/http-client/types';
import { base64ToBytes, bytesToText } from '../lib/bytes';
import { ResponseBodyViewer } from './ResponseBodyViewer';
import { ResponseHeadersTable } from './ResponseHeadersTable';

type ResponseTabValue = 'body' | 'headers';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusColorClass(status: number, ok: boolean): string {
  if (status === 0) return 'text-red-500';
  if (ok && status < 300) return 'text-emerald-500';
  if (status < 400) return 'text-sky-500';
  if (status < 500) return 'text-amber-500';
  return 'text-red-500';
}

interface ResponseInspectorProps {
  response: HttpResponsePayload | null;
  isLoading: boolean;
}

export const ResponseInspector: React.FC<ResponseInspectorProps> = ({ response, isLoading }) => {
  const [activeTab, setActiveTab] = useState<ResponseTabValue>('body');

  const bytes = useMemo(
    () => (response ? base64ToBytes(response.bodyBase64) : new Uint8Array(0)),
    [response]
  );
  const text = useMemo(() => bytesToText(bytes), [bytes]);
  const contentType = response?.headers['content-type'];
  const headerEntries = useMemo(
    () => (response ? Object.entries(response.headers) : []),
    [response]
  );

  return (
    <div className="flex-1 bg-sidebar-bg border border-border-dark rounded-lg overflow-hidden flex flex-col min-h-0">
      <div className="bg-editor-bg border-b border-border-dark px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none">
        <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
          Response
        </span>
        {response && (
          <div className="flex gap-3 text-[10px] items-center">
            <span className={`font-bold ${statusColorClass(response.status, response.ok)}`}>
              {response.status === 0 ? 'ERROR' : `${response.status} ${response.statusText}`}
            </span>
            <span className="text-zinc-500">TIME: {response.durationMs} ms</span>
            <span className="text-zinc-550">SIZE: {formatBytes(response.sizeBytes)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-650">
            <RefreshCw size={24} className="animate-spin" />
            <span>Sending request...</span>
          </div>
        ) : response ? (
          response.error ? (
            <div className="flex-1 p-4 font-mono text-xs text-red-400 overflow-auto select-text">
              {response.error}
            </div>
          ) : (
            <Tabs.Root
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ResponseTabValue)}
              className="flex flex-col min-h-0 flex-1"
            >
              <Tabs.List className="flex gap-4 border-b border-border-dark px-3 text-xs select-none shrink-0">
                <Tabs.Tab
                  value="body"
                  className={`py-1.5 border-b -mb-px cursor-pointer transition-colors ${
                    activeTab === 'body'
                      ? 'border-accent text-accent font-semibold'
                      : 'border-transparent text-zinc-555 hover:text-zinc-350'
                  }`}
                >
                  Body
                </Tabs.Tab>
                <Tabs.Tab
                  value="headers"
                  className={`py-1.5 border-b -mb-px cursor-pointer transition-colors ${
                    activeTab === 'headers'
                      ? 'border-accent text-accent font-semibold'
                      : 'border-transparent text-zinc-555 hover:text-zinc-350'
                  }`}
                >
                  Headers ({headerEntries.length})
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="body" className="flex-1 min-h-0 overflow-auto p-4">
                <ResponseBodyViewer
                  key={response.bodyBase64}
                  text={text}
                  bytes={bytes}
                  bodyBase64={response.bodyBase64}
                  contentType={contentType}
                />
              </Tabs.Panel>

              <Tabs.Panel value="headers" className="flex-1 min-h-0 overflow-auto p-4">
                <ResponseHeadersTable headers={response.headers} />
              </Tabs.Panel>
            </Tabs.Root>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650 text-xs">
            <AlertCircle size={20} />
            <span>Enter request parameters and click Send to inspect results.</span>
          </div>
        )}
      </div>
    </div>
  );
};
