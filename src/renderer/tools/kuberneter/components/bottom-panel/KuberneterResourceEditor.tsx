import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { Save, Check, AlertCircle } from 'lucide-react';
import { DEFAULT_TEMPLATES } from './types';
import { useThemeStore } from '@renderer/store/theme.store';
import { Button } from '@renderer/components/ui/Button';

interface KuberneterResourceEditorProps {
  initialYaml?: string;
  yaml: string;
  onChangeYaml: (newYaml: string) => void;
  onApply: (
    yamlContent: string
  ) => Promise<{ result?: string; error?: string; yaml?: string } | void> | void;
}

export const KuberneterResourceEditor: React.FC<KuberneterResourceEditorProps> = ({
  initialYaml,
  yaml,
  onChangeYaml,
  onApply
}) => {
  const [resourceStatus, setResourceStatus] = useState<{ text: string; isError?: boolean } | null>(
    null
  );
  const [isApplying, setIsApplying] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const isEditMode = Boolean(initialYaml);

  const onChangeYamlRef = useRef(onChangeYaml);
  useEffect(() => {
    onChangeYamlRef.current = onChangeYaml;
  }, [onChangeYaml]);

  // Update value if initialYaml changes and yaml is empty
  useEffect(() => {
    if (initialYaml && (!yaml || !yaml.trim())) {
      onChangeYamlRef.current(initialYaml);
    }
  }, [initialYaml, yaml]);

  const handleApply = async () => {
    const content = yaml || initialYaml || '';
    if (!content || !content.trim()) {
      setResourceStatus({ text: 'Error: YAML content is empty.', isError: true });
      return;
    }
    setIsApplying(true);
    setResourceStatus(null);
    try {
      const res = await onApply(content);
      if (res && res.error) {
        setResourceStatus({ text: `Apply failed: ${res.error}`, isError: true });
      } else {
        if (res && res.yaml) {
          onChangeYaml(res.yaml);
        }
        setResourceStatus({ text: 'Resource applied successfully to cluster.', isError: false });
        setTimeout(() => setResourceStatus(null), 4000);
      }
    } catch (e) {
      setResourceStatus({ text: `Apply failed: ${(e as Error).message}`, isError: true });
    } finally {
      setIsApplying(false);
    }
  };

  const handleSelectTemplate = (templateName: string) => {
    const templateContent = DEFAULT_TEMPLATES[templateName];
    if (templateContent) {
      onChangeYaml(templateContent);
    }
  };

  const currentContent = yaml || initialYaml || '';

  return (
    <div className="flex-1 flex flex-col min-h-0 font-mono text-[11px]">
      {/* Sub-bar with Save and Template Picker */}
      <div className="h-8 shrink-0 flex items-center justify-between px-3 border-b border-border-dark/50 bg-surface-2/40">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={isApplying}
            title="Apply / Save Resource"
            className="flex items-center gap-1 font-sans"
          >
            <Save className="size-3.5" />
            <span>{isApplying ? 'Applying...' : 'Apply'}</span>
          </Button>

          {resourceStatus && (
            <span
              className={`text-[10px] font-sans flex items-center gap-1 ml-2 ${
                resourceStatus.isError ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {resourceStatus.isError ? (
                <AlertCircle className="size-3" />
              ) : (
                <Check className="size-3" />
              )}
              {resourceStatus.text}
            </span>
          )}
        </div>

        {/* Select Template Dropdown */}
        {!isEditMode && (
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
        )}
      </div>

      {/* CodeMirror Editor Container */}
      <div className={`flex-1 min-h-0 relative ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
        <CodeMirror
          value={currentContent}
          height="100%"
          className="h-full text-xs"
          theme={theme === 'dark' ? vscodeDark : vscodeLight}
          extensions={[yamlLang(), EditorView.lineWrapping]}
          onChange={(value) => onChangeYaml(value)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: true,
            tabSize: 2
          }}
        />
      </div>
    </div>
  );
};
