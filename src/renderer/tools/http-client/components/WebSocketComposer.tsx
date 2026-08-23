import type React from 'react';
import { useMemo } from 'react';
import { EditorView, keymap, Prec } from '@uiw/react-codemirror';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { Send } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { CodeEditor } from '@renderer/components/ui/CodeEditor';

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
  // Enter sends the message, Shift+Enter still inserts a newline - same behavior as the
  // textarea this replaced. Prec.highest so it wins over CodeMirror's own Enter binding.
  const extensions = useMemo(
    () => [
      Prec.highest(
        keymap.of([
          {
            key: 'Enter',
            run: () => {
              if (disabled) return false;
              onSendMessage();
              return true;
            },
            shift: insertNewlineAndIndent
          }
        ])
      ),
      EditorView.lineWrapping
    ],
    [disabled, onSendMessage]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 px-3 pb-3">
      <div
        className={`relative flex flex-1 min-h-14 bg-surface-2 border border-border rounded overflow-hidden focus-within:border-accent ${disabled ? 'opacity-50' : ''}`}
      >
        <CodeEditor
          value={messageInput}
          onChange={onMessageInputChange}
          editable={!disabled}
          placeholder={
            disabled
              ? 'Connect to send a message'
              : 'Type a message... (Enter to send, Shift+Enter for newline)'
          }
          height="100%"
          className="flex-1 min-h-0 text-sm font-mono [&_.cm-editor]:h-full"
          extensions={extensions}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            autocompletion: false
          }}
        />
      </div>

      <div className="flex justify-end shrink-0">
        <Button
          variant="primary"
          onClick={onSendMessage}
          disabled={disabled || !messageInput.trim()}
        >
          <Send size={14} />
          <span>Send</span>
        </Button>
      </div>
    </div>
  );
};
