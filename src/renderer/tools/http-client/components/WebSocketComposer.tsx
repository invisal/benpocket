import type React from 'react';
import { Send } from 'lucide-react';

interface WebSocketComposerProps {
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
  /** Message composing only makes sense once the connection (managed by the address bar above) is live. */
  disabled: boolean;
}

export const WebSocketComposer: React.FC<WebSocketComposerProps> = ({
  messageInput,
  onMessageInputChange,
  onSendMessage,
  disabled
}) => {
  return (
    <div className="flex flex-col gap-2 shrink-0 px-3">
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
          placeholder={
            disabled
              ? 'Connect to send a message'
              : 'Type a message... (Enter to send, Shift+Enter for newline)'
          }
          disabled={disabled}
          rows={2}
          className="flex-1 bg-surface-2 border border-border rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-accent disabled:opacity-50 resize-none"
        />
        <button
          onClick={onSendMessage}
          disabled={disabled || !messageInput.trim()}
          className="px-4 py-2 bg-accent/80 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-emphasis-text text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
        >
          <Send size={12} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
