import { FolderOpen } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { SectionLabel } from '../kubectl-settings/SectionLabel';

interface HelmPathConfigProps {
  inputPath: string;
  helmPath: string;
  loading: boolean;
  actualPath?: string;
  setInputPath: (path: string) => void;
  onBrowse: () => void;
  onSavePath: () => void;
  onReset: () => void;
}

export function HelmPathConfig({
  inputPath,
  helmPath,
  loading,
  actualPath,
  setInputPath,
  onBrowse,
  onSavePath,
  onReset
}: HelmPathConfigProps) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Custom Binary Path</SectionLabel>
      <p className="text-sm text-muted-foreground">
        Leave blank to automatically detect `helm` from system $PATH or standard installation
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
          className="flex-1 font-mono text-sm"
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
            disabled={inputPath === helmPath && !loading}
          >
            Save Path
          </Button>

          {helmPath && (
            <Button variant="outline" size="sm" onClick={onReset}>
              Reset to Default
            </Button>
          )}
        </div>

        <span className="text-[11px] text-muted-foreground italic">
          {helmPath ? 'Using custom path' : 'Using auto-detection'}
        </span>
      </div>
    </div>
  );
}
