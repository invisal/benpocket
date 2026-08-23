import type React from 'react';
import { useMemo } from 'react';
import { keymap, Prec, type EditorView } from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';
import {
  acceptCompletion,
  autocompletion,
  completionStatus,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';
import { AlignLeft, Minimize2 } from 'lucide-react';
import { CodeEditor } from '@renderer/components/ui/CodeEditor';
import type { HttpBodyType, KeyValuePair } from '../../../../preload/http-client/types';
import { findOpenToken } from '../lib/variableToken';

interface BodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  bodyType: HttpBodyType;
  variables: KeyValuePair[];
  placeholder?: string;
}

/**
 * `{{variable}}` autocomplete as a CodeMirror completion source, reusing the same
 * `findOpenToken` query-detection this editor used before the CodeMirror switch (it operates on
 * flat doc text + offset, which lines up with CompletionContext.pos same as it did with a
 * textarea's selectionStart). Applying a pick replaces just the `{{query` span rather than the
 * whole document, and skips adding a closing `}}` the user already typed past the cursor.
 */
function variableCompletionSource(names: string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const token = findOpenToken(context.state.doc.toString(), context.pos);
    if (!token) return null;
    const query = token.query.toLowerCase();
    const matches = query ? names.filter((n) => n.toLowerCase().includes(query)) : names;
    if (matches.length === 0) return null;
    return {
      from: token.start,
      options: matches.map((name) => ({
        label: name,
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          const after = view.state.doc.sliceString(to);
          const closing = /^\s*}}/.test(after) ? '' : '}}';
          const insert = `{{${name}${closing}`;
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length }
          });
        }
      }))
    };
  };
}

// Tab accepts an open completion (default keymap only binds Enter for that); otherwise falls
// through to indentWithTab. Prec.highest so it's checked before indentWithTab's own Tab binding.
const tabAcceptsCompletion = Prec.highest(
  keymap.of([
    {
      key: 'Tab',
      run: (view) => (completionStatus(view.state) === 'active' ? acceptCompletion(view) : false)
    }
  ])
);

// Body editor: CodeMirror with JSON syntax highlighting (JSON bodies only), a
// Beautify/Minify toolbar, and {{variable}} autocomplete wired in above.
export const BodyEditor: React.FC<BodyEditorProps> = ({
  value,
  onChange,
  bodyType,
  variables,
  placeholder
}) => {
  const isJson = bodyType === 'json';

  const names = useMemo(
    () => Array.from(new Set(variables.map((v) => v.key.trim()).filter(Boolean))),
    [variables]
  );

  const extensions = useMemo(
    () => [
      ...(isJson ? [jsonLang()] : []),
      tabAcceptsCompletion,
      keymap.of([indentWithTab]),
      autocompletion({ override: [variableCompletionSource(names)] })
    ],
    [isJson, names]
  );

  const handleBeautify = (): void => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // Invalid JSON - nothing to reformat.
    }
  };

  const handleMinify = (): void => {
    try {
      onChange(JSON.stringify(JSON.parse(value)));
    } catch {
      // Invalid JSON - leave as-is.
    }
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0 pl-2">
      <div className="relative flex flex-1 min-h-24 w-full bg-surface-2 overflow-hidden">
        <CodeEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          height="100%"
          className="flex-1 min-h-0 [&_.cm-editor]:h-full"
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            highlightSelectionMatches: false,
            tabSize: 2
          }}
        />

        {isJson && (
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5">
            <button
              onClick={handleBeautify}
              title="Beautify JSON"
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 hover:text-foreground bg-surface-2 border border-border-dark rounded cursor-pointer transition-colors"
            >
              <AlignLeft size={10} />
              Beautify
            </button>
            <button
              onClick={handleMinify}
              title="Minify JSON"
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 hover:text-foreground bg-surface-2 border border-border-dark rounded cursor-pointer transition-colors"
            >
              <Minimize2 size={10} />
              Minify
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
