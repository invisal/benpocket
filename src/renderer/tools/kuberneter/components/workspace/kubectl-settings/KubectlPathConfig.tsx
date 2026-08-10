import { FolderOpen } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { SectionLabel } from './SectionLabel';

interface KubectlPathConfigProps {
  inputPath: string;
  kubectlPath: string;
  loading: boolean;
  actualPath?: string;
  setInputPath: (path: string) => void;
  onBrowse: () => void;
  onSavePath: () => void;
  onReset: () => void;
}

export function KubectlPathConfig({
  inputPath,
  kubectlPath,
  loading,
  actualPath,
  setInputPath,
  onBrowse,
  onSavePath,
  onReset
}: KubectlPathConfigProps) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Custom Binary Path</SectionLabel>
      <p className="text-xs text-muted-foreground">
        Leave blank to automatically detect `kubectl` from system $PATH or standard installation
        directories.
      </p>

      <div className="flex gap-2">
        <Input
          size="sm"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onBlur={onSavePath}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSavePath();
          }}
          placeholder={actualPath || 'Auto-detect from System $PATH'}
          className="flex-1 font-mono text-xs"
        />
        <Button variant="outline" size="sm" onClick={onBrowse} title="Browse file system">
          <FolderOpen className="size-3.5" />
          Browse...
        </Button>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onSavePath}
            disabled={inputPath === kubectlPath && !loading}
          >
            Save Path
          </Button>

          {kubectlPath && (
            <Button variant="outline" size="sm" onClick={onReset}>
              Reset to Default
            </Button>
          )}
        </div>

        <span className="text-[11px] text-muted-foreground italic">
          {kubectlPath ? 'Using custom path' : 'Using auto-detection'}
        </span>
      </div>
    </div>
  );
}
