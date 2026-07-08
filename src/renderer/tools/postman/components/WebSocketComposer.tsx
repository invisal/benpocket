import React from 'react';
import { Plug, PlugZap, RefreshCw, Send } from 'lucide-react';
import type { WsStatus } from '../hooks/useWebSocket';

function statusMeta(status: WsStatus): { label: string; className: string } {
  switch (status) {
    case 'CONNECTED':
      return { label: 'Connected', className: 'text-emerald-500' };
    case 'CONNECTING':
      return { label: 'Connecting...', className: 'text-amber-500' };
    case 'ERROR':
      return { label: 'Error', className: 'text-red-500' };
    default:
      return { label: 'Disconnected', className: 'text-zinc-500' };
  }
}

interface WebSocketComposerProps {
  url: string;
  onUrlChange: (url: string) => void;
  status: WsStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
}

export const WebSocketComposer: React.FC<WebSocketComposerProps> = ({
  url,
  onUrlChange,
  status,
  onConnect,
  onDisconnect,
  messageInput,
  onMessageInputChange,
  onSendMessage
}) => {
  const isConnected = status === 'CONNECTED';
  const isConnecting = status === 'CONNECTING';
  const meta = statusMeta(status);

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <div className="flex gap-2 items-center">
        <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 ${meta.className}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : isConnecting ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`} />
          {meta.label}
        </span>
        <input
          type="text"
          placeholder="wss://echo.websocket.org"
          value={url}
          disabled={isConnected || isConnecting}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isConnected && !isConnecting) onConnect();
          }}
          className="flex-1 bg-sidebar-bg border border-border-dark text-xs rounded px-3 py-1.5 focus:outline-none focus:border-accent text-zinc-200 disabled:opacity-60"
        />
        <button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting || (!isConnected && !url.trim())}
          className={`px-4 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isConnected
              ? 'bg-red-500/80 hover:bg-red-500 text-white'
              : 'bg-accent/80 hover:bg-accent text-white'
          }`}
        >
          {isConnecting ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : isConnected ? (
            <PlugZap size={12} />
          ) : (
            <Plug size={12} />
          )}
          <span>{isConnected ? 'Disconnect' : 'Connect'}</span>
        </button>
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          value={messageInput}
          onChange={(e) => onMessageInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          placeholder={isConnected ? 'Type a message... (Enter to send, Shift+Enter for newline)' : 'Connect to send a message'}
          disabled={!isConnected}
          rows={2}
          className="flex-1 bg-editor-bg border border-border-dark rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-accent disabled:opacity-50 resize-none"
        />
        <button
          onClick={onSendMessage}
          disabled={!isConnected || !messageInput.trim()}
          className="px-4 py-2 bg-accent/80 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
        >
          <Send size={12} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
