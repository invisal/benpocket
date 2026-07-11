import { ReactNode, useEffect, useState } from 'react';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { FileEntry, formatBytes } from './columns';

type PreviewKind = 'text';

const PREVIEWABLE_EXTENSIONS: Record<string, PreviewKind> = {
  txt: 'text',
  md: 'text',
  json: 'text',
  ini: 'text'
};

interface FilePreviewProps {
  selection: FileEntry[];
}

function PreviewMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-dim text-xs px-4 text-center">
      <FileText size={20} className="text-zinc-600" />
      <span>{children}</span>
    </div>
  );
}

export function FilePreview({ selection }: FilePreviewProps) {
  if (selection.length === 0) {
    return <PreviewMessage>Select a file in the left panel to preview it.</PreviewMessage>;
  }

  if (selection.length > 1) {
    return <PreviewMessage>Select a single file to preview it.</PreviewMessage>;
  }

  const entry = selection[0];

  if (entry.isDirectory) {
    return <PreviewMessage>Folders can&apos;t be previewed.</PreviewMessage>;
  }

  const kind = PREVIEWABLE_EXTENSIONS[entry.extension];

  if (!kind) {
    return (
      <PreviewMessage>
        {entry.extension
          ? `Preview not available for .${entry.extension} files.`
          : 'Preview not available for this file.'}
      </PreviewMessage>
    );
  }

  return <TextFilePreview key={entry.path} entry={entry} />;
}

function TextFilePreview({ entry }: { entry: FileEntry }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; content: string }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading' });

    window.fileExplorer.readFileContent(entry.path).then((res) => {
      if (cancelled) return;
      if ('content' in res) {
        setState({ status: 'ready', content: res.content });
      } else if ('maxBytes' in res) {
        setState({
          status: 'error',
          message: `This file is too large to preview (${formatBytes(res.maxBytes)} limit).`
        });
      } else if (res.error === 'unsupported-extension') {
        setState({ status: 'error', message: 'Preview not available for this file.' });
      } else {
        setState({ status: 'error', message: `Couldn't read this file: ${res.error}` });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [entry.path]);

  if (state.status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center text-text-dim">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-dim text-xs px-4 text-center">
        <AlertCircle size={20} className="text-red-500" />
        <span>{state.message}</span>
      </div>
    );
  }

  return (
    <pre className="flex-1 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap text-zinc-200">
      {state.content}
    </pre>
  );
}
