import type React from 'react';
import { useMemo, useState } from 'react';
import { Check, ChevronDownIcon, Code2, Copy, X } from 'lucide-react';
import { Drawer } from '@renderer/components/ui/Drawer';
import { Menu } from '@renderer/components/ui/Menu';
import type { HttpBodyType, HttpMethod } from '../../../../preload/http-client/types';
import type { KeyValueRow } from '../lib/keyValueRows';
import { generateSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from '../lib/codeSnippet';
import { useCopyFeedback } from '../hooks/useCopyFeedback';

interface CodeSnippetDrawerProps {
  method: HttpMethod;
  url: string;
  headers: KeyValueRow[];
  bodyType: HttpBodyType;
  body: string;
}

/** "Code" panel like Postman's: slides in the current request draft as a copy-pasteable snippet in a few common languages. */
export const CodeSnippetDrawer: React.FC<CodeSnippetDrawerProps> = ({
  method,
  url,
  headers,
  bodyType,
  body
}) => {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<SnippetLanguage>('curl');
  const [copied, copy] = useCopyFeedback();

  const snippet = useMemo(
    () => generateSnippet(language, { method, url, headers, bodyType, body }),
    [language, method, url, headers, bodyType, body]
  );

  const selectedLabel = SNIPPET_LANGUAGES.find((l) => l.value === language)?.label ?? language;

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger
        title="Generate code snippet"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border-dark hover:border-accent text-zinc-300 hover:text-foreground text-xs font-semibold rounded cursor-pointer transition-colors"
      >
        <Code2 size={12} />
        <span>Code</span>
      </Drawer.Trigger>
      <Drawer.Content side="right" className="w-md" showClose={false}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
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
        <pre className="m-0 p-3 flex-1 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre select-text">
          {snippet}
        </pre>
      </Drawer.Content>
    </Drawer.Root>
  );
};
