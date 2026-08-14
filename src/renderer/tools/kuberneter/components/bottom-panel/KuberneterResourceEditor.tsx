import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { Save, Check, FileCode, ChevronDown } from 'lucide-react';
import { DEFAULT_TEMPLATES, TEMPLATE_CATEGORIES } from './types';
import { useThemeStore } from '@renderer/store/theme.store';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { Button } from '@renderer/components/ui/Button';
import { Menu } from '@renderer/components/ui/Menu';

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
  const [resourceStatus, setResourceStatus] = useState<{ text: string } | null>(null);
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
      useKuberneterStore.getState().addToast({
        type: 'error',
        title: 'Apply Resource Failed',
        message: 'YAML content is empty.'
      });
      return;
    }
    setIsApplying(true);
    setResourceStatus(null);
    try {
      const res = await onApply(content);
      if (res && res.error) {
        useKuberneterStore.getState().addToast({
          type: 'error',
          title: 'Apply Resource Failed',
          message: res.error
        });
      } else {
        if (res && res.yaml) {
          onChangeYaml(res.yaml);
        }
        setResourceStatus({ text: 'Resource applied successfully to cluster.' });
        setTimeout(() => setResourceStatus(null), 4000);
      }
    } catch (e) {
      useKuberneterStore.getState().addToast({
        type: 'error',
        title: 'Apply Resource Failed',
        message: (e as Error).message
      });
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
            <span className="text-[10px] font-sans flex items-center gap-1 ml-2 text-emerald-400">
              <Check className="size-3" />
              {resourceStatus.text}
            </span>
          )}
        </div>

        {/* Select Template Dropdown */}
        {!isEditMode && (
          <div className="flex items-center gap-2">
            <Menu.Root>
              <Menu.Trigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs text-foreground font-sans gap-1.5 px-2 bg-surface hover:bg-surface-2 border-border-dark"
                  >
                    <FileCode className="size-3 text-muted-foreground" />
                    <span>Select Template...</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                }
              />
              <Menu.Content align="end" className="w-56 max-h-72 overflow-y-auto">
                {TEMPLATE_CATEGORIES.map((category, idx) => (
                  <Menu.Group key={category.name}>
                    {idx > 0 && <Menu.Separator />}
                    <Menu.GroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                      {category.name}
                    </Menu.GroupLabel>
                    {category.templates.map((tmpl) => (
                      <Menu.Item
                        key={tmpl.name}
                        onClick={() => handleSelectTemplate(tmpl.name)}
                        className="text-xs text-foreground hover:bg-surface-2 focus:bg-surface-2 cursor-pointer px-2 py-1 rounded"
                      >
                        {tmpl.name}
                      </Menu.Item>
                    ))}
                  </Menu.Group>
                ))}
              </Menu.Content>
            </Menu.Root>
          </div>
        )}
      </div>

      {/* CodeMirror Editor Container */}
      <div className="flex-1 min-h-0 relative bg-surface">
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
