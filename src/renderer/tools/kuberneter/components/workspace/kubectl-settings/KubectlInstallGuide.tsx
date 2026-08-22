import { useState } from 'react';
import { Terminal, ExternalLink, Info } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { SectionLabel } from './SectionLabel';
import { INSTALL_GUIDES, getDetectedOS, OS_NAMES, type PlatformOS } from './installGuides';

export function KubectlInstallGuide() {
  const detectedOs = getDetectedOS();
  const [activeGuideOs, setActiveGuideOs] = useState<PlatformOS>(detectedOs);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  function handleCopy(cmd: string) {
    void navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  }

  const guide = INSTALL_GUIDES[activeGuideOs];

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <SectionLabel>Installation Guide & Setup</SectionLabel>
        <div className="flex items-center gap-3">
          <select
            value={activeGuideOs}
            onChange={(e) => setActiveGuideOs(e.target.value as PlatformOS)}
            className="bg-surface-2 border border-border text-foreground rounded px-2 py-1 text-sm outline-none cursor-pointer"
          >
            {(['mac', 'win', 'linux'] as PlatformOS[]).map((osKey) => (
              <option key={osKey} value={osKey}>
                {OS_NAMES[osKey]} {osKey === detectedOs ? '(Detected)' : ''}
              </option>
            ))}
          </select>
          <a
            href="https://kubernetes.io/docs/tasks/tools/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Official Docs <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* OS Guide Content */}
      <div className="flex flex-col gap-3 bg-surface-2 p-4 rounded-lg border border-border">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Terminal className="size-3.5 text-accent shrink-0" />
          <span>{guide.title}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {guide.commands.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
              <div className="flex items-center justify-between bg-surface-3 border border-border rounded px-2.5 py-1.5">
                <code className="text-[11px] font-mono text-foreground break-all select-all">
                  {item.cmd}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(item.cmd)}
                  className="ml-2 h-6 px-2 text-[10px] shrink-0"
                >
                  {copiedCmd === item.cmd ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
          <Info className="size-3.5 mt-0.5 text-accent shrink-0" />
          <span>
            After installing, click <strong>Re-test</strong> above or restart the application to
            detect the new binary.
          </span>
        </div>
      </div>
    </div>
  );
}
