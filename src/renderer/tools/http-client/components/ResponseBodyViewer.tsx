import type React from 'react';
import { useMemo, useState } from 'react';
import { cn } from 'cnfast';
import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';
import { xml as xmlLang } from '@codemirror/lang-xml';
import { html as htmlLang } from '@codemirror/lang-html';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { javascript as javascriptLang } from '@codemirror/lang-javascript';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { Select } from '@renderer/components/ui/Select';
import { PillTab } from '@renderer/components/ui/Tabs';
import { Check, Copy, Eye, FileText, Filter, Table } from 'lucide-react';
import { useThemeStore } from '@renderer/store/theme.store';
import { getPrettyText } from '../lib/formatters/index';
import { RESPONSE_FORMATS, detectFormat, isImageContentType } from '../lib/responseFormat';
import type { ResponseFormat } from '../lib/responseFormat';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { RESPONSE_ACTION_BUTTON_CLASS } from '../lib/responseActionButtonClass';
import type { HttpResponsePayload } from '../../../../preload/http-client/types';
import type { HttpState } from '../hooks/useHttp';
import type { SavedBinding } from '../types';
import { HexView } from './HexView';
import { ResponsePreview } from './ResponsePreview';
import { ResponseTable } from './ResponseTable';
import { SaveExamplePopover } from './SaveExamplePopover';

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
  response: HttpResponsePayload;
  binding: SavedBinding | null;
  request: HttpState;
}

export const ResponseBodyViewer: React.FC<ResponseBodyViewerProps> = ({
  text,
  bytes,
  bodyBase64,
  contentType,
  response,
  binding,
  request
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const previewEnabled = format === 'html' || isImageContentType(contentType);
  const tableEnabled = format === 'json' || format === 'yaml';
  // Line-filtering only makes sense against the flat text views - hex bytes, the table
  // view's parsed rows, and image/html previews have nothing resembling a line to match.
  const filterable = format !== 'hex' && viewMode !== 'table' && viewMode !== 'preview';

  const prettyText = useMemo(() => getPrettyText(format, text), [format, text]);
  const prettyExtensions = useMemo(() => prettyLanguage(format), [format]);
  const chunkedBase64 = useMemo(() => chunkBase64(bodyBase64), [bodyBase64]);

  const filterLines = (value: string): string => {
    const needle = filterQuery.trim().toLowerCase();
    if (!needle) return value;
    return value
      .split('\n')
      .filter((line) => line.toLowerCase().includes(needle))
      .join('\n');
  };
  const displayedPrettyText = filterable ? filterLines(prettyText) : prettyText;
  const displayedBase64 = filterable ? filterLines(chunkedBase64) : chunkedBase64;

  const toggleFilter = (): void => {
    setFilterOpen((open) => {
      if (open) setFilterQuery('');
      return !open;
    });
  };

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

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleFilter}
            title="Filter response body"
            className={cn(
              RESPONSE_ACTION_BUTTON_CLASS,
              filterOpen && 'text-accent border-accent bg-accent/10'
            )}
          >
            <Filter size={12} />
          </button>
          <SaveExamplePopover binding={binding} response={response} request={request} />
          <button
            type="button"
            onClick={() => copy(copyText)}
            title={copied ? 'Copied' : 'Copy body'}
            className={RESPONSE_ACTION_BUTTON_CLASS}
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="flex flex-col gap-1 shrink-0">
          <input
            type="text"
            autoFocus
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFilterOpen(false);
                setFilterQuery('');
              }
            }}
            placeholder="Filter body by text..."
            className="w-full h-7 px-2 text-[11px] bg-surface-2 border border-border rounded outline-none focus:border-accent"
          />
          {!filterable && (
            <span className="text-[10px] text-zinc-500">
              Filtering isn&apos;t available for this view.
            </span>
          )}
        </div>
      )}

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
          <pre className="font-mono text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-all select-text">
            {displayedBase64}
          </pre>
        ) : (
          <CodeMirror
            value={displayedPrettyText}
            editable={false}
            height="100%"
            className="h-full text-sm"
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
