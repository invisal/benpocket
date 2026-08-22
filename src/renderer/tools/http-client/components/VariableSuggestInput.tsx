import type React from 'react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from 'cnfast';
import type { KeyValuePair } from '../../../../preload/http-client/types';
import { findOpenToken, insertVariable, type OpenToken } from '../lib/variableToken';

const VARIABLE_TOKEN_RE = /\{\{([^{}]*)\}\}/g;
const HAS_VARIABLE_TOKEN_RE = /\{\{[^{}]*\}\}/;

/** Splits `value` into plain-text and `{{name}}` pieces, rendering each variable as a pill
 * with the braces hidden - used for the read-only "resting" overlay shown while the field
 * isn't focused. */
function renderWithPills(value: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  VARIABLE_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VARIABLE_TOKEN_RE.exec(value))) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{value.slice(lastIndex, match.index)}</Fragment>);
    }
    nodes.push(
      <span
        key={key++}
        className="inline-flex items-center rounded bg-accent/15 px-1 font-mono text-[11px] text-accent"
      >
        {match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) {
    nodes.push(<Fragment key={key++}>{value.slice(lastIndex)}</Fragment>);
  }
  return nodes;
}

interface VariableSuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  variables: KeyValuePair[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Called on Enter when no suggestion dropdown is open (e.g. to trigger Send from the URL field). */
  onEnter?: () => void;
  /** Raw clipboard paste handler, run before the normal onChange-driven insert - e.g. the
   * URL field intercepts a pasted `curl ...` command instead of dropping it in as text. */
  onPaste?: (event: React.ClipboardEvent<HTMLInputElement>) => void;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
}

// "{{variableName}}" autocomplete for free-text fields (request URL,
// header/param values, ...). Detects an in-progress `{{` token around the caret and
// offers the active environment's variable names, replacing the token on selection.
// Structurally mirrors KeySuggestInput (portal + fixed positioning, keyboard nav),
// but matches an in-text token instead of the whole field.
export const VariableSuggestInput: React.FC<VariableSuggestInputProps> = ({
  value,
  onChange,
  variables,
  placeholder,
  className,
  disabled,
  onEnter,
  onPaste
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState<OpenToken | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [rect, setRect] = useState<DropdownRect | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Resting (unfocused) state shows `{{name}}` tokens as pills instead of raw braces - editing
  // still happens against the plain string via the real input, so this only kicks in when
  // there's nothing being actively typed and something to actually highlight.
  const showPills = !isFocused && !disabled && HAS_VARIABLE_TOKEN_RE.test(value);

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

  const evaluate = (target: HTMLInputElement): void => {
    const caret = target.selectionStart ?? target.value.length;
    setToken(findOpenToken(target.value, caret));
    setHighlightedIndex(0);
  };

  useLayoutEffect(() => {
    if (!showDropdown || !inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, [showDropdown, value]);

  // Any ancestor scrolling invalidates the computed position - simplest correct fix is to close.
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
    const input = inputRef.current;
    if (!input || !token) return;
    const caret = input.selectionStart ?? value.length;
    const { text, caret: nextCaret } = insertVariable(value, token, caret, name);
    onChange(text);
    setToken(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return (
    <div className="relative flex-1 min-w-0 h-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        className={cn(className, showPills && 'opacity-0')}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          evaluate(e.target);
        }}
        onClick={(e) => evaluate(e.currentTarget)}
        onPaste={onPaste}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') evaluate(e.currentTarget);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          // Delay so a suggestion's onMouseDown can fire before the list unmounts.
          setTimeout(() => setToken(null), 120);
        }}
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
          if (e.key === 'Enter') onEnter?.();
        }}
        autoComplete="off"
        spellCheck={false}
      />
      {showPills && (
        <div
          aria-hidden
          onMouseDown={(e) => {
            e.preventDefault();
            const input = inputRef.current;
            if (!input) return;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }}
          className={cn(
            className,
            'absolute inset-0 z-10 flex items-center overflow-hidden whitespace-nowrap cursor-text'
          )}
        >
          {renderWithPills(value)}
        </div>
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
                className={`px-2.5 py-1 text-sm font-mono cursor-pointer ${
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
