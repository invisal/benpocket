import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface KeySuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
}

// Lightweight, fully-controlled autocomplete for free-text fields with a
// known vocabulary (e.g. common HTTP header names). Deliberately avoids a
// native <datalist> so the dropdown can be themed to match the app. Renders
// via a portal + fixed positioning so it isn't clipped by the scrollable
// Params/Headers panel it lives inside.
export const KeySuggestInput: React.FC<KeySuggestInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [rect, setRect] = useState<DropdownRect | null>(null);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    const matches = query
      ? suggestions.filter((s) => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      : suggestions;
    return matches.slice(0, 8);
  }, [value, suggestions]);

  const showDropdown = isOpen && filtered.length > 0;

  useLayoutEffect(() => {
    if (!showDropdown || !inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, [showDropdown, value]);

  // Any ancestor scrolling (e.g. the Headers panel's own scroll area)
  // invalidates the computed position - simplest correct fix is to close.
  useEffect(() => {
    if (!showDropdown) return;
    const close = (): void => setIsOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [showDropdown]);

  const selectSuggestion = (suggestion: string): void => {
    onChange(suggestion);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlightedIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay so a suggestion's onMouseDown can fire before the list unmounts.
          setTimeout(() => setIsOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((i) => (i + 1) % filtered.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            selectSuggestion(filtered[highlightedIndex]);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={className}
        autoComplete="off"
        spellCheck={false}
      />
      {showDropdown &&
        rect &&
        createPortal(
          <div
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 max-h-48 overflow-auto bg-sidebar-bg border border-border-dark rounded-md shadow-xl py-1"
          >
            {filtered.map((suggestion, index) => (
              <div
                key={suggestion}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(suggestion);
                }}
                className={`px-2.5 py-1 text-xs font-mono cursor-pointer ${
                  index === highlightedIndex
                    ? 'bg-accent/20 text-accent'
                    : 'text-zinc-300 hover:bg-border-dark/60'
                }`}
              >
                {suggestion}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
