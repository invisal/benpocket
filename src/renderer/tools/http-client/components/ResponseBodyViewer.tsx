import React, { useMemo, useState } from 'react';
import { Select } from '@renderer/components/ui/Select';
import { Check, Copy, Eye, FileText } from 'lucide-react';
import { getPrettyText, getTokens } from '../lib/formatters/index';
import { RESPONSE_FORMATS, detectFormat, isImageContentType } from '../lib/responseFormat';
import type { ResponseFormat } from '../lib/responseFormat';
import { HexView } from './HexView';
import { ResponsePreview } from './ResponsePreview';

const COPY_FEEDBACK_MS = 1500;
const BASE64_LINE_LENGTH = 76;

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
  const [viewMode, setViewMode] = useState<'formatted' | 'preview'>(
    isImageContentType(contentType) ? 'preview' : 'formatted'
  );
  const [copied, setCopied] = useState(false);

  const previewEnabled = format === 'html' || isImageContentType(contentType);

  const prettyText = useMemo(() => getPrettyText(format, text), [format, text]);
  const tokens = useMemo(() => getTokens(format, prettyText), [format, prettyText]);

  const copyText = format === 'base64' ? bodyBase64 : prettyText;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard API unavailable/denied - nothing else to fall back to.
    }
  };

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

          {previewEnabled && (
            <div className="flex items-center bg-editor-bg border border-border-dark rounded overflow-hidden text-[10px] font-semibold">
              <button
                onClick={() => setViewMode('formatted')}
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer transition-colors ${
                  viewMode === 'formatted'
                    ? 'bg-accent/20 text-accent'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileText size={10} />
                Pretty
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-accent/20 text-accent'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Eye size={10} />
                Preview
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleCopy}
          title="Copy body"
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 hover:text-white bg-editor-bg border border-border-dark rounded cursor-pointer transition-colors"
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
        ) : format === 'hex' ? (
          <HexView bytes={bytes} />
        ) : format === 'base64' ? (
          <pre className="font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap break-all select-text">
            {chunkBase64(bodyBase64)}
          </pre>
        ) : (
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all select-text">
            {tokens.map((tok, i) => (
              <span key={i} className={tok.className}>
                {tok.text}
              </span>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
};
