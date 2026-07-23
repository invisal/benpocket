import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignLeft, Check, Minimize2, X } from 'lucide-react';
import type { HttpBodyType, KeyValuePair } from '../../../../preload/http-client/types';
import { tokenizeJson } from '../lib/jsonHighlight';
import { findOpenToken, insertVariable, type OpenToken } from '../lib/variableToken';
import { resolveJsonVariables } from '../lib/variables';

interface BodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  bodyType: HttpBodyType;
  variables: KeyValuePair[];
  placeholder?: string;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
}

// Shared by the gutter's row height, the highlight backdrop, and the textarea itself
// so a given scrollTop lines all three up at the same pixel offset.
const LINE_HEIGHT = 20;

// Postman-style body editor: line-number gutter, JSON syntax-color backdrop, a
// Beautify/Minify + valid-JSON indicator toolbar (JSON bodies only), Tab-to-indent,
// and {{variable}} autocomplete - all hand-rolled (no code-editor dependency), reusing
// the classic "transparent textarea over a colored <pre> backdrop" trick. Wrapping is
// disabled (wrap="off" + whitespace-pre) on both layers so they never disagree about
// where a line breaks, which is what makes that trick safe to hand-roll.
export const BodyEditor: React.FC<BodyEditorProps> = ({
  value,
  onChange,
  bodyType,
  variables,
  placeholder
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [token, setToken] = useState<OpenToken | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [rect, setRect] = useState<DropdownRect | null>(null);

  const isJson = bodyType === 'json';

  const lineCount = useMemo(() => (value.length === 0 ? 1 : value.split('\n').length), [value]);

  const tokens = useMemo(
    () => (isJson ? tokenizeJson(value) : [{ text: value, className: 'text-zinc-200' }]),
    [isJson, value]
  );

  // Validates the JSON-aware resolved body (bare `{{var}}` placeholders auto-quoted,
  // same as at send time - see resolveJsonVariables) rather than the raw template, so
  // a body like `"username": {{username}}` isn't flagged invalid when it will in fact
  // send valid JSON once the variable is substituted in.
  const jsonError = useMemo(() => {
    if (!isJson || !value.trim()) return null;
    try {
      JSON.parse(resolveJsonVariables(value, variables));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid JSON';
    }
  }, [isJson, value, variables]);

  const names = useMemo(
    () => Array.from(new Set(variables.map((v) => v.key.trim()).filter(Boolean))),
    [variables]
  );

  const filtered = useMemo(() => {
    if (!token) return [];
    const query = token.query.toLowerCase();
    const matches = query ? names.filter((n) => n.toLowerCase().includes(query)) : names;
    return matches.slice(0, 8);
  }, [token, names]);

  const showDropdown = token !== null && filtered.length > 0;

  const evaluateToken = (target: HTMLTextAreaElement): void => {
    const caret = target.selectionStart ?? target.value.length;
    setToken(findOpenToken(target.value, caret));
    setHighlightedIndex(0);
  };

  useLayoutEffect(() => {
    if (!showDropdown || !textareaRef.current) return;
    const r = textareaRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: Math.min(r.width, 260) });
  }, [showDropdown, value]);

  useEffect(() => {
    if (!showDropdown) return;
    const close = (): void => setToken(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [showDropdown]);

  const selectSuggestion = (name: string): void => {
    const el = textareaRef.current;
    if (!el || !token) return;
    const caret = el.selectionStart ?? value.length;
    const { text, caret: nextCaret } = insertVariable(value, token, caret, name);
    onChange(text);
    setToken(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>): void => {
    const t = e.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = t.scrollTop;
      highlightRef.current.scrollLeft = t.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = t.scrollTop;
  };

  const insertTab = (): void => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const selectionEnd = el.selectionEnd ?? caret;
    onChange(`${value.slice(0, caret)}  ${value.slice(selectionEnd)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret + 2, caret + 2);
    });
  };

  const handleBeautify = (): void => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // Invalid JSON - the error badge already surfaces this; nothing to reformat.
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
    <div className="flex flex-col gap-1.5">
      {isJson && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
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
          {value.trim() && (
            <span
              title={jsonError ?? undefined}
              className={`flex items-center gap-1 text-[10px] font-semibold ${jsonError ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {jsonError ? <X size={10} /> : <Check size={10} />}
              {jsonError ? 'Invalid JSON' : 'Valid JSON'}
            </span>
          )}
        </div>
      )}

      <div className="relative flex h-40 bg-surface-2 border border-border rounded overflow-hidden focus-within:border-accent">
        <div
          ref={gutterRef}
          className="w-9 shrink-0 overflow-hidden py-2 border-r border-border select-none"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              style={{ height: LINE_HEIGHT }}
              className="px-2 text-right text-[11px] leading-5 text-zinc-600"
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden">
          <pre
            ref={highlightRef}
            aria-hidden
            className="absolute inset-0 m-0 py-2 px-2 overflow-hidden whitespace-pre pointer-events-none font-mono text-xs leading-5"
          >
            {tokens.map((tok, i) => (
              <span key={i} className={tok.className}>
                {tok.text}
              </span>
            ))}{' '}
          </pre>
          <textarea
            ref={textareaRef}
            value={value}
            placeholder={placeholder}
            wrap="off"
            onChange={(e) => {
              onChange(e.target.value);
              evaluateToken(e.target);
            }}
            onClick={(e) => evaluateToken(e.currentTarget)}
            onScroll={handleScroll}
            onBlur={() => setTimeout(() => setToken(null), 120)}
            onKeyDown={(e) => {
              if (showDropdown) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex((i) => (i + 1) % filtered.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  selectSuggestion(filtered[highlightedIndex]);
                  return;
                }
                if (e.key === 'Escape') {
                  setToken(null);
                  return;
                }
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                insertTab();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') evaluateToken(e.currentTarget);
            }}
            spellCheck={false}
            className="absolute inset-0 w-full h-full m-0 py-2 px-2 bg-transparent text-transparent caret-zinc-200 resize-none outline-none whitespace-pre overflow-auto font-mono text-xs leading-5"
          />
        </div>
      </div>

      {isJson && jsonError && value.trim() && (
        <p className="text-[10px] text-red-400 leading-relaxed">{jsonError}</p>
      )}

      {showDropdown &&
        rect &&
        createPortal(
          <div
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 max-h-48 overflow-auto bg-surface border border-border-dark rounded-md shadow-xl py-1"
          >
            {filtered.map((name, index) => (
              <div
                key={name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(name);
                }}
                className={`px-2.5 py-1 text-xs font-mono cursor-pointer ${
                  index === highlightedIndex
                    ? 'bg-accent/20 text-accent'
                    : 'text-zinc-300 hover:bg-border-dark/60'
                }`}
              >
                {'{{'}
                {name}
                {'}}'}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
