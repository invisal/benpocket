import { useMemo, memo, type FC } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { useThemeStore } from '@renderer/store/theme.store';
import { cn } from 'cnfast';

interface KeyValueCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const cmCustomTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent !important',
    fontSize: '12px'
  },
  '&.cm-editor': {
    backgroundColor: 'transparent !important'
  },
  '.cm-scroller': {
    backgroundColor: 'transparent !important',
    overflow: 'auto',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '18px'
  },
  '.cm-content': {
    backgroundColor: 'transparent !important',
    padding: '6px 10px',
    minHeight: '100%'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent !important',
    border: 'none'
  },
  '.cm-line': {
    backgroundColor: 'transparent !important',
    padding: '0'
  },
  '&.cm-focused': {
    outline: 'none !important',
    backgroundColor: 'transparent !important'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-foreground, #fff)'
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-accent-subtle, rgba(59, 130, 246, 0.3)) !important'
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--color-accent-subtle, rgba(59, 130, 246, 0.3)) !important'
  }
});

const basicSetupConfig = {
  lineNumbers: false,
  foldGutter: false,
  dropCursor: true,
  allowMultipleSelections: true,
  indentOnInput: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: false,
  highlightSelectionMatches: false,
  tabSize: 2
};

export const KeyValueCodeEditor: FC<KeyValueCodeEditorProps> = memo(function KeyValueCodeEditor({
  value,
  onChange,
  placeholder = 'Value...',
  className,
  disabled = false
}: KeyValueCodeEditorProps) {
  const theme = useThemeStore((s) => s.theme);

  const extensions = useMemo(() => [EditorView.lineWrapping, cmCustomTheme], []);

  return (
    <div
      className={cn(
        'w-full min-h-8 h-8 resize-y overflow-hidden rounded bg-surface-2 border border-border/60 focus-within:border-accent transition-colors flex flex-col',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
      style={{ minHeight: '32px' }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        height="100%"
        editable={!disabled}
        className="w-full h-full text-sm font-mono !bg-transparent [&_.cm-editor]:h-full [&_.cm-editor]:!bg-transparent [&_.cm-scroller]:h-full [&_.cm-scroller]:!bg-transparent [&_.cm-gutters]:!bg-transparent [&_.cm-content]:!bg-transparent [&_.cm-line]:!bg-transparent"
        theme={theme === 'dark' ? vscodeDark : vscodeLight}
        extensions={extensions}
        basicSetup={basicSetupConfig}
      />
    </div>
  );
});
