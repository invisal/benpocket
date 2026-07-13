import type React from 'react';
import { ImageOff } from 'lucide-react';
import { isImageContentType } from '../lib/responseFormat';
import type { ResponseFormat } from '../lib/responseFormat';

interface ResponsePreviewProps {
  format: ResponseFormat;
  text: string;
  bodyBase64: string;
  contentType: string | undefined;
}

/** Rendered preview: images render as an <img>, HTML renders in a fully sandboxed (no-script) iframe. */
export const ResponsePreview: React.FC<ResponsePreviewProps> = ({
  format,
  text,
  bodyBase64,
  contentType
}) => {
  if (isImageContentType(contentType)) {
    return (
      <div className="h-full flex items-center justify-center p-4 overflow-auto">
        <img
          src={`data:${contentType};base64,${bodyBase64}`}
          alt="Response preview"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  if (format === 'html') {
    return (
      <iframe
        title="Response preview"
        sandbox=""
        srcDoc={text}
        className="w-full h-full border-0 bg-white"
      />
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650 text-xs">
      <ImageOff size={20} />
      <span>No preview available for this content type.</span>
    </div>
  );
};
