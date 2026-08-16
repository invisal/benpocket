import type React from 'react';
import { useMemo, useState } from 'react';
import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';
import { xml as xmlLang } from '@codemirror/lang-xml';
import { html as htmlLang } from '@codemirror/lang-html';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { javascript as javascriptLang } from '@codemirror/lang-javascript';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { Select } from '@renderer/components/ui/Select';
import { PillTab } from '@renderer/components/ui/Tabs';
import { Check, Copy, Eye, FileText, Table } from 'lucide-react';
import { useThemeStore } from '@renderer/store/theme.store';
import { getPrettyText } from '../lib/formatters/index';
import { RESPONSE_FORMATS, detectFormat, isImageContentType } from '../lib/responseFormat';
import type { ResponseFormat } from '../lib/responseFormat';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { HexView } from './HexView';
import { ResponsePreview } from './ResponsePreview';
import { ResponseTable } from './ResponseTable';

const BASE64_LINE_LENGTH = 76;

/** CodeMirror language extension for the "Pretty" view, per format - undefined formats (raw, markdown, ...) still get CodeMirror's line-virtualized rendering, just without coloring. */
function prettyLanguage(format: ResponseFormat): Extension[] {
  switch (format) {
    case 'json':
      return [jsonLang()];
    case 'xml':
      return [xmlLang()];
    case 'html':
      return [htmlLang()];
    case 'yaml':
      return [yamlLang()];
    case 'javascript':
      return [javascriptLang()];
    default:
      return [];
  }
}

function chunkBase64(base64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += BASE64_LINE_LENGTH) {
    lines.push(base64.slice(i, i + BASE64_LINE_LENGTH));
  }
  return lines.join('\n');
}

interface ResponseBodyViewerProps {
  text: string;
  bytes: Uint8Array;
  bodyBase64: string;
  contentType: string | undefined;
}

export const ResponseBodyViewer: React.FC<ResponseBodyViewerProps> = ({
  text,
  bytes,
  bodyBase64,
  contentType
}) => {
  const detected = useMemo(
    () => detectFormat(contentType, text, bytes),
    [contentType, text, bytes]
  );
  // Callers key this component by bodyBase64, so a new response remounts it and these
  // initial values are re-derived instead of keeping the previous response's picks.
  const [format, setFormat] = useState<ResponseFormat>(detected);
  const [viewMode, setViewMode] = useState<'formatted' | 'preview' | 'table'>(
    isImageContentType(contentType) ? 'preview' : 'formatted'
  );
  const [copied, copy] = useCopyFeedback();
  const theme = useThemeStore((s) => s.theme);

  const previewEnabled = format === 'html' || isImageContentType(contentType);
  const tableEnabled = format === 'json' || format === 'yaml';

  const prettyText = useMemo(() => getPrettyText(format, text), [format, text]);
  const prettyExtensions = useMemo(() => prettyLanguage(format), [format]);
  const chunkedBase64 = useMemo(() => chunkBase64(bodyBase64), [bodyBase64]);

  const copyText = format === 'base64' ? bodyBase64 : prettyText;

  return (
    <div className="flex flex-col gap-1.5 h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Select.Root value={format} onValueChange={(value) => setFormat(value as ResponseFormat)}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content side="bottom" align="start">
              {RESPONSE_FORMATS.map((f) => (
                <Select.Item key={f.value} value={f.value}>
                  <Select.ItemText>{f.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          {(previewEnabled || tableEnabled) && (
            <PillTab.Root
              value={viewMode}
              onValueChange={(value) => setViewMode(value as 'formatted' | 'preview' | 'table')}
            >
              <PillTab.List>
                <PillTab.Item value="formatted">
                  <FileText size={10} />
                  Pretty
                </PillTab.Item>
                {previewEnabled && (
                  <PillTab.Item value="preview">
                    <Eye size={10} />
                    Preview
                  </PillTab.Item>
                )}
                {tableEnabled && (
                  <PillTab.Item value="table">
                    <Table size={10} />
                    Table
                  </PillTab.Item>
                )}
                <PillTab.Indicator />
              </PillTab.List>
            </PillTab.Root>
          )}
        </div>

        <button
          onClick={() => copy(copyText)}
          title="Copy body"
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 hover:text-foreground bg-surface-3 border border-border-dark rounded cursor-pointer transition-colors"
        >
          {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {viewMode === 'preview' && previewEnabled ? (
          <ResponsePreview
            format={format}
            text={text}
            bodyBase64={bodyBase64}
            contentType={contentType}
          />
        ) : viewMode === 'table' && (format === 'json' || format === 'yaml') ? (
          <ResponseTable format={format} text={text} />
        ) : format === 'hex' ? (
          <HexView bytes={bytes} />
        ) : format === 'base64' ? (
          <pre className="font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap break-all select-text">
            {chunkedBase64}
          </pre>
        ) : (
          <CodeMirror
            value={prettyText}
            editable={false}
            height="100%"
            className="h-full text-xs"
            theme={theme === 'dark' ? vscodeDark : vscodeLight}
            extensions={[...prettyExtensions, EditorView.lineWrapping]}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              bracketMatching: true,
              autocompletion: false,
              closeBrackets: false,
              history: false
            }}
          />
        )}
      </div>
    </div>
  );
};
