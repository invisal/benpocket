import type React from 'react';
import { useMemo } from 'react';
import CodeMirror, {
  EditorView,
  type Extension,
  type ReactCodeMirrorProps
} from '@uiw/react-codemirror';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { useThemeStore } from '@renderer/store/theme.store';

// Drops @codemirror/view's default border-right on .cm-gutters (no divider against the code);
// swaps the theme's barely-visible active-line tint for the app's row-hover color so the
// selected line reads the same as a hovered row elsewhere in the UI; and mutes the theme's
// fairly high-contrast line-number color down to the app's muted-foreground token.
const editorChromeTheme = EditorView.theme({
  '.cm-gutters': { borderRight: 'none' },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-border-dark) 25%, transparent)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--color-border-dark) 25%, transparent)'
  },
  '.cm-gutterElement': {
    color: 'color-mix(in srgb, var(--color-muted-foreground) 55%, transparent)'
  }
});

export interface CodeEditorProps extends Omit<ReactCodeMirrorProps, 'theme'> {
  extensions?: Extension[];
}

/**
 * CodeMirror wrapper with the app's light/dark theme wired in and the borderless-gutter
 * chrome applied by default, so every editor surface in the app reads the same. Callers still
 * own their own `extensions` (language, autocomplete, keymaps) and `basicSetup` overrides.
 */
export const CodeEditor: React.FC<CodeEditorProps> = ({ extensions = [], ...props }) => {
  const theme = useThemeStore((s) => s.theme);

  const allExtensions = useMemo(() => [editorChromeTheme, ...extensions], [extensions]);

  return (
    <CodeMirror
      theme={theme === 'dark' ? vscodeDark : vscodeLight}
      extensions={allExtensions}
      {...props}
    />
  );
};
