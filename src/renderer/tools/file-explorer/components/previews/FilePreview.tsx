import { forwardRef } from 'react';
import { PreviewMessage } from './PreviewMessage';
import { ImagePreview } from './ImagePreview';
import { VideoPreview } from './VideoPreview';
import { TextPreview } from './TextPreview';
import { type PreviewEditorHandle, type PreviewUnavailableReason } from './types';

export { type PreviewEditorHandle, type PreviewUnavailableReason };

type PreviewKind = 'text' | 'image' | 'video';

const PREVIEWABLE_EXTENSIONS: Record<string, PreviewKind> = {
  txt: 'text',
  md: 'text',
  json: 'text',
  ini: 'text',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  ico: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video'
};

interface FilePreviewProps {
  /** Path of the file currently loaded into the preview/edit buffer, or null if nothing valid is targeted. */
  previewFile: string | null;
  /** Why `previewFile` is null -- only read when `previewFile` is null. */
  unavailableReason: PreviewUnavailableReason;
  onDirtyChange: (dirty: boolean) => void;
}

function getExtension(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const dotIndex = base.lastIndexOf('.');
  return dotIndex > 0 ? base.slice(dotIndex + 1).toLowerCase() : '';
}

export const FilePreview = forwardRef<PreviewEditorHandle, FilePreviewProps>(function FilePreview(
  { previewFile, unavailableReason, onDirtyChange },
  ref
) {
  if (!previewFile) {
    if (unavailableReason === 'multiple-selection') {
      return <PreviewMessage>Select a single file to preview it.</PreviewMessage>;
    }
    if (unavailableReason === 'directory') {
      return <PreviewMessage>Folders can&apos;t be previewed.</PreviewMessage>;
    }
    return <PreviewMessage>Select a file in the left panel to preview it.</PreviewMessage>;
  }

  const extension = getExtension(previewFile);
  const kind = PREVIEWABLE_EXTENSIONS[extension];

  if (!kind) {
    return (
      <PreviewMessage>
        {extension
          ? `Preview not available for .${extension} files.`
          : 'Preview not available for this file.'}
      </PreviewMessage>
    );
  }

  if (kind === 'image') {
    return <ImagePreview key={previewFile} ref={ref} filePath={previewFile} />;
  }

  if (kind === 'video') {
    return <VideoPreview key={previewFile} ref={ref} filePath={previewFile} />;
  }

  return (
    <TextPreview key={previewFile} ref={ref} filePath={previewFile} onDirtyChange={onDirtyChange} />
  );
});
