import type React from 'react';
import { useMemo, useState } from 'react';
import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror';
import { javascript as javascriptLang } from '@codemirror/lang-javascript';
import { python as pythonLang } from '@codemirror/lang-python';
import { StreamLanguage } from '@codemirror/language';
import { shell as shellMode } from '@codemirror/legacy-modes/mode/shell';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { Check, ChevronDownIcon, Copy, X } from 'lucide-react';
import { Drawer } from '@renderer/components/ui/Drawer';
import { Menu } from '@renderer/components/ui/Menu';
import { Button } from '@renderer/components/ui/Button';
import { useThemeStore } from '@renderer/store/theme.store';
import type { HttpState } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { useActiveEnvironmentVariables } from '../store/environments.store';
import { useCollectionsStore } from '../store/collections.store';
import { resolveInheritedAuth } from '../lib/authInheritance';
import { generateSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from '../lib/codeSnippet';
import { useCopyFeedback } from '../hooks/useCopyFeedback';

interface CodeSnippetDrawerProps {
  request: HttpState;
  /** Which saved request this tab is bound to, if any - resolves 'inherit' auth against its folder/collection, same as RequestEditorPanel's Authorization tab. */
  binding?: SavedBinding | null;
}

// curl has no first-party lezer grammar - legacy-modes' StreamLanguage-wrapped shell mode
// is the standard CodeMirror 6 stand-in for bash/shell highlighting.
const shellLang = StreamLanguage.define(shellMode);

const SNIPPET_LANGUAGE_EXTENSIONS: Record<SnippetLanguage, Extension> = {
  curl: shellLang,
  'javascript-fetch': javascriptLang(),
  'javascript-axios': javascriptLang(),
  'python-requests': pythonLang()
};

/** "Code" panel: slides in the current request draft as a copy-pasteable snippet in a few common languages. */
export const CodeSnippetDrawer: React.FC<CodeSnippetDrawerProps> = ({ request, binding }) => {
  const { method, url, headers, bodyType, body, auth } = request;
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<SnippetLanguage>('javascript-fetch');
  const [copied, copy] = useCopyFeedback();
  const theme = useThemeStore((s) => s.theme);
  const variables = useActiveEnvironmentVariables();
  const collections = useCollectionsStore((s) => s.collections);

  const effectiveAuth = useMemo(() => {
    const collection = binding ? collections.find((c) => c.id === binding.collectionId) : undefined;
    return resolveInheritedAuth(auth, collection, binding?.requestId);
  }, [auth, binding, collections]);

  const snippet = useMemo(
    () =>
      generateSnippet(language, {
        method,
        url,
        headers,
        bodyType,
        body,
        auth: effectiveAuth,
        variables
      }),
    [language, method, url, headers, bodyType, body, effectiveAuth, variables]
  );

  const selectedLabel = SNIPPET_LANGUAGES.find((l) => l.value === language)?.label ?? language;

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger
        title="Generate code snippet"
        render={<Button variant="secondary" size="md" />}
      >
        Code
      </Drawer.Trigger>
      <Drawer.Content side="right" className="w-md" showClose={false}>
        {/* Drawer.Content's own wrapper is a plain block div, not a flex container - this
            wrapper establishes the flex column so the CodeMirror area below can actually
            claim "the rest of the height" instead of collapsing to 0. */}
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
            <Menu.Root>
              <Menu.Trigger className="text-xs font-medium px-2 py-1 flex items-center gap-1 border border-border-dark rounded cursor-pointer">
                <span>{selectedLabel}</span>
                <ChevronDownIcon size={14} />
              </Menu.Trigger>
              <Menu.Content align="start">
                {SNIPPET_LANGUAGES.map((l) => (
                  <Menu.Item key={l.value} onClick={() => setLanguage(l.value)}>
                    {l.label}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Root>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy(snippet)}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-foreground bg-surface-2 border border-border-dark rounded cursor-pointer transition-colors"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <Drawer.Close className="flex items-center justify-center size-6 rounded-sm text-zinc-400 hover:text-foreground hover:bg-border-dark/60 cursor-pointer bg-transparent border-none">
                <X className="size-3.5" />
              </Drawer.Close>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <CodeMirror
              value={snippet}
              editable={false}
              height="100%"
              className="h-full text-[11px] [&_.cm-line]:break-all"
              theme={theme === 'dark' ? vscodeDark : vscodeLight}
              extensions={[SNIPPET_LANGUAGE_EXTENSIONS[language], EditorView.lineWrapping]}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                bracketMatching: true,
                autocompletion: false,
                closeBrackets: false,
                history: false
              }}
            />
          </div>
        </div>
      </Drawer.Content>
    </Drawer.Root>
  );
};
