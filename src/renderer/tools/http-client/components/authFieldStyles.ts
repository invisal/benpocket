/** Shared field styling for AuthEditor/OAuth2AuthFields so auth inputs match the
 * bordered, `bg-surface` look used by KeyValueEditor's Params/Headers rows. */
export const fieldLabelClass =
  'text-[10px] font-bold uppercase tracking-wider text-muted-foreground';

/** Mirrors `Input`'s default (md) size recipe so `VariableSuggestInput` fields
 * (which render a bare `<input>`, not the shared `Input` component) line up
 * with plain `Input` fields used alongside them, e.g. OAuth2's Client Secret. */
export const fieldInputClass =
  'w-full h-8 rounded-md border border-border bg-surface px-3 text-[13px] outline-none transition-colors focus:border-border-dark disabled:pointer-events-none disabled:opacity-50';
