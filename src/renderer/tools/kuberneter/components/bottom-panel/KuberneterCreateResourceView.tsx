import type React from 'react';
import { useState } from 'react';
import { Save, Search, Check } from 'lucide-react';
import { DEFAULT_TEMPLATES } from './types';

interface KuberneterCreateResourceViewProps {
  yaml: string;
  onChangeYaml: (newYaml: string) => void;
  onApply: () => void;
}

export const KuberneterCreateResourceView: React.FC<KuberneterCreateResourceViewProps> = ({
  yaml,
  onChangeYaml,
  onApply
}) => {
  const [resourceStatus, setResourceStatus] = useState<string | null>(null);

  const handleApply = () => {
    if (!yaml || !yaml.trim()) {
      setResourceStatus('Error: YAML content is empty.');
      return;
    }
    onApply();
    setResourceStatus('Resource applied successfully to cluster.');
    setTimeout(() => setResourceStatus(null), 3000);
  };

  const handleSelectTemplate = (templateName: string) => {
    const templateContent = DEFAULT_TEMPLATES[templateName];
    if (templateContent) {
      onChangeYaml(templateContent);
    }
  };

  const lineCount = Math.max(15, (yaml || '').split('\n').length);

  return (
    <div className="flex-1 flex flex-col min-h-0 font-mono text-[11px]">
      {/* Sub-bar with Save, Search, and Template Picker */}
      <div className="h-8 shrink-0 flex items-center justify-between px-3 border-b border-border-dark/50 bg-surface-2/40">
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            title="Apply / Save Resource"
            className="flex items-center gap-1 px-2 py-1 rounded bg-accent/20 hover:bg-accent/30 text-accent font-sans font-medium text-[11px] transition-colors cursor-pointer border border-accent/30"
          >
            <Save className="size-3.5" />
            <span>Apply</span>
          </button>

          <button
            title="Search in Document"
            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-border-dark/40 transition-colors cursor-pointer border-none bg-transparent"
          >
            <Search className="size-3.5" />
          </button>

          {resourceStatus && (
            <span className="text-[10px] font-sans text-emerald-400 flex items-center gap-1 ml-2">
              <Check className="size-3" />
              {resourceStatus}
            </span>
          )}
        </div>

        {/* Select Template Dropdown */}
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => handleSelectTemplate(e.target.value)}
            defaultValue=""
            className="bg-surface-2 border border-border-dark/60 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-accent cursor-pointer font-sans"
          >
            <option value="" disabled>
              Select Template ...
            </option>
            {Object.keys(DEFAULT_TEMPLATES).map((tmpl) => (
              <option key={tmpl} value={tmpl}>
                {tmpl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* YAML Code Editor Area with Line Numbers */}
      <div className="flex-1 flex min-h-0 bg-surface-1 overflow-hidden">
        {/* Line numbers column */}
        <div className="w-10 py-3 bg-surface-2/30 border-r border-border-dark/30 select-none text-right pr-2 text-zinc-600 font-mono text-[11px] leading-relaxed shrink-0">
          {Array.from({ length: lineCount }, (_, i) => i + 1).map((lineNum) => (
            <div key={lineNum}>{lineNum}</div>
          ))}
        </div>

        {/* Code Textarea */}
        <textarea
          value={yaml}
          onChange={(e) => onChangeYaml(e.target.value)}
          placeholder="# Paste or select a Kubernetes resource YAML template..."
          spellCheck={false}
          className="flex-1 p-3 bg-transparent text-zinc-200 border-none outline-none resize-none font-mono text-[11px] leading-relaxed select-text"
        />
      </div>
    </div>
  );
};
