import React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { useLayoutStore } from '../../../store/layout.store';
import { useApiClient, type ProtocolTab } from '../../../hooks/useApiClient';
import { RequestComposer } from './postman/RequestComposer';
import { RequestEditorPanel } from './postman/RequestEditorPanel';
import { ResponseInspector } from './postman/ResponseInspector';
import { WebSocketComposer } from './postman/WebSocketComposer';
import { WebSocketLog } from './postman/WebSocketLog';
import { SaveRequestPopover } from './postman/SaveRequestPopover';
import { EnvironmentSelector } from './postman/EnvironmentSelector';

export const PostmanWorkspace: React.FC = () => {
  const activeTabId = useLayoutStore((s) => s.activeTabId);

  if (!activeTabId) return null;

  return <PostmanClient tabId={activeTabId} />;
};

const PostmanClient: React.FC<{ tabId: string }> = ({ tabId }) => {
  const client = useApiClient(tabId);
  const tab = useLayoutStore((s) => s.openTabs.find((t) => t.id === tabId));
  const renameTab = useLayoutStore((s) => s.renameTab);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      <Tabs.Root
        value={client.protocol}
        onValueChange={(value) => client.setProtocol(value as ProtocolTab)}
        className="flex flex-col gap-3 min-h-0 flex-1"
      >
        <div className="flex items-center justify-between gap-2 shrink-0">
          <Tabs.List className="flex gap-1 bg-sidebar-bg border border-border-dark rounded-lg p-1 text-xs w-fit select-none">
            <Tabs.Tab
              value="HTTP"
              className={`px-4 py-1.5 rounded-md font-semibold cursor-pointer transition-colors ${
                client.protocol === 'HTTP' ? 'bg-accent text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              REST Client
            </Tabs.Tab>
            <Tabs.Tab
              value="WEBSOCKET"
              className={`px-4 py-1.5 rounded-md font-semibold cursor-pointer transition-colors ${
                client.protocol === 'WEBSOCKET' ? 'bg-accent text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              WebSocket Client
            </Tabs.Tab>
          </Tabs.List>

          <div className="flex items-center gap-2">
            <EnvironmentSelector />
            {client.protocol === 'HTTP' && (
              <SaveRequestPopover
                tabTitle={tab?.title ?? 'New API Request'}
                method={client.http.state.method}
                url={client.http.state.url}
                headers={client.http.state.headers}
                params={client.http.state.params}
                bodyType={client.http.state.bodyType}
                body={client.http.state.body}
                binding={client.binding}
                onSaved={(binding, name) => {
                  client.bindTo(binding);
                  renameTab(tabId, name);
                }}
              />
            )}
          </div>
        </div>

        <Tabs.Panel value="HTTP" className="flex flex-col gap-3 min-h-0 flex-1">
          <RequestComposer
            method={client.http.state.method}
            onMethodChange={client.http.setMethod}
            url={client.http.state.url}
            onUrlChange={client.http.setUrl}
            isLoading={client.http.state.isLoading}
            onSend={client.http.send}
          />

          <RequestEditorPanel
            params={client.http.state.params}
            onUpdateParam={client.http.updateParamRow}
            onRemoveParam={client.http.removeParamRow}
            headers={client.http.state.headers}
            onUpdateHeader={client.http.updateHeaderRow}
            onRemoveHeader={client.http.removeHeaderRow}
            bodyType={client.http.state.bodyType}
            onBodyTypeChange={client.http.setBodyType}
            body={client.http.state.body}
            onBodyChange={client.http.setBody}
          />

          <ResponseInspector response={client.http.state.response} isLoading={client.http.state.isLoading} />
        </Tabs.Panel>

        <Tabs.Panel value="WEBSOCKET" className="flex flex-col gap-3 min-h-0 flex-1">
          <WebSocketComposer
            url={client.ws.state.url}
            onUrlChange={client.ws.setUrl}
            status={client.ws.state.status}
            onConnect={client.ws.connect}
            onDisconnect={client.ws.disconnect}
            messageInput={client.ws.state.messageInput}
            onMessageInputChange={client.ws.setMessageInput}
            onSendMessage={client.ws.sendMessage}
          />

          <WebSocketLog log={client.ws.state.log} onClear={client.ws.clearLog} />
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
};
