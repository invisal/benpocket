import React, { useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Check, Code2, Copy } from 'lucide-react';
import type { HttpBodyType, HttpMethod } from '../../../../preload/http-client/types';
import type { KeyValueRow } from '../lib/keyValueRows';
import { generateSnippet, SNIPPET_LANGUAGES, type SnippetLanguage } from '../lib/codeSnippet';

const COPY_FEEDBACK_MS = 1500;

interface CodeSnippetPopoverProps {
  method: HttpMethod;
  url: string;
  headers: KeyValueRow[];
  bodyType: HttpBodyType;
  body: string;
}

/** "Code" panel like Postman's: shows the current request draft as a copy-pasteable snippet in a few common languages. */
export const CodeSnippetPopover: React.FC<CodeSnippetPopoverProps> = ({
  method,
  url,
  headers,
  bodyType,
  body
}) => {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<SnippetLanguage>('curl');
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(
    () => generateSnippet(language, { method, url, headers, bodyType, body }),
    [language, method, url, headers, bodyType, body]
  );

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard API unavailable/denied - nothing else to fall back to.
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        title="Generate code snippet"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-sidebar-bg border border-border-dark hover:border-accent text-zinc-300 hover:text-white text-xs font-semibold rounded cursor-pointer transition-colors"
      >
        <Code2 size={12} />
        <span>Code</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="bg-sidebar-bg border border-border-dark rounded-lg shadow-xl w-md flex flex-col text-xs outline-none overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-dark">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SnippetLanguage)}
                className="bg-editor-bg border border-border-dark rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-accent cursor-pointer"
              >
                {SNIPPET_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-white bg-editor-bg border border-border-dark rounded cursor-pointer transition-colors"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="m-0 p-3 max-h-80 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre select-text">
              {snippet}
            </pre>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
