import type React from 'react';
import { useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { PillTab } from '@renderer/components/ui/Tabs';
import type { HttpResponsePayload } from '../../../../preload/http-client/types';
import { base64ToBytes, bytesToText, formatBytes } from '../lib/bytes';
import type { HttpState } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { ResponseBodyViewer } from './ResponseBodyViewer';
import { ResponseHeadersTable } from './ResponseHeadersTable';

type ResponseTabValue = 'body' | 'headers';

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
  binding: SavedBinding | null;
  request: HttpState;
}

export const ResponseInspector: React.FC<ResponseInspectorProps> = ({
  response,
  isLoading,
  binding,
  request
}) => {
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
    <div className="h-full border-t border-border-light flex flex-col min-h-0">
      <div className="flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-650">
            <RefreshCw size={24} className="animate-spin" />
            <span>Sending request...</span>
          </div>
        ) : response ? (
          response.error ? (
            <div className="flex-1 p-4 font-mono text-sm text-red-400 overflow-auto select-text">
              {response.error}
            </div>
          ) : (
            <PillTab.Root
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ResponseTabValue)}
              className="flex flex-col min-h-0 flex-1"
            >
              <div className="mx-3 mt-2 shrink-0 flex items-center justify-between">
                <PillTab.List>
                  <PillTab.Item value="body">Body</PillTab.Item>
                  <PillTab.Item value="headers">Headers ({headerEntries.length})</PillTab.Item>
                  <PillTab.Indicator />
                </PillTab.List>

                <div className="flex gap-3 items-center text-sm">
                  <span className={statusColorClass(response.status, response.ok)}>
                    {response.status === 0 ? 'ERROR' : `${response.status} ${response.statusText}`}
                  </span>
                  <span className="text-zinc-500">{response.durationMs} ms</span>
                  <span className="text-zinc-500">{formatBytes(response.sizeBytes)}</span>
                </div>
              </div>

              <PillTab.Panel value="body" className="flex-1 min-h-0 overflow-auto">
                <ResponseBodyViewer
                  key={response.bodyBase64}
                  text={text}
                  bytes={bytes}
                  bodyBase64={response.bodyBase64}
                  contentType={contentType}
                  response={response}
                  binding={binding}
                  request={request}
                />
              </PillTab.Panel>

              <PillTab.Panel value="headers" className="flex-1 min-h-0 overflow-auto">
                <ResponseHeadersTable headers={response.headers} />
              </PillTab.Panel>
            </PillTab.Root>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650 text-sm">
            <AlertCircle size={20} />
            <span>Enter request parameters and click Send to inspect results.</span>
          </div>
        )}
      </div>
    </div>
  );
};
