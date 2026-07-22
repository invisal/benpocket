# Design

## Shared components (`src/renderer/src/components/ui/`)

Generic, tool-agnostic building blocks. Prefer one of these over rolling your
own — reach for a tool-local component only when what you need genuinely
isn't covered here.

- `Button` — styled `<button>`; `variant` (primary/secondary/destructive/ghost/outline) x `size` (sm/md/lg).
- `Input` — styled `<input>`; same `size` scale as `Button`.
- `Dialog` — modal (`Dialog.Root/Trigger/Content/Title/Description`), built on `@base-ui/react`.
- `Chat` — agent chat surface (`Chat.Root/MessageContainer/UserMessage/AssistantMessage/Thinking/PermissionRequest/Input`).
- `ContextMenu` — right-click menu (`ContextMenu.Root/Trigger/Content/Item/CheckboxItem/RadioItem/GroupLabel/Separator/SubmenuTrigger`).
- `Menu` — click-to-open dropdown menu (`Menu.Root/Trigger/Content/Item/GroupLabel/Separator`), same visual language as `ContextMenu`.
- `Select` — dropdown select (`Select.Trigger/Content/Item`), `SelectTrigger` renders as a `Button`.
- `Popover` — anchored floating panel (`Popover.Root/Trigger/Content`).
- `Tooltip` — hover hint (`Tooltip.Provider/Root/Trigger/Content`).
- `Toolbar` — horizontal action bar (`Toolbar.Root/Button/Link/Input/Label/FreeSpace/Group/Separator`).
- `ListView` — virtualized selectable row list backed by `@tanstack/react-table` + `react-virtual`; supports context menu, copy/cut/paste/delete, keyboard nav.
- `ResizablePanel` — drag handle on one edge (`left`/`right`/`top`/`bottom`) that resizes a panel in `px` or `%`.

## Color tokens

Defined in `src/renderer/src/assets/main.css` as CSS custom properties. Tailwind
picks them up as `bg-*` / `border-*` / `text-*` utilities automatically
(e.g. `--color-surface` -> `bg-surface`).

## Surface scale (`bg-surface`, `bg-surface-2` … `bg-surface-5`)

An elevation scale, lowest to highest. Higher numbers sit "on top of" or are
interactive states of the layer below — do not treat them as unrelated colors.

- `bg-surface` — base background, the lowest layer.
- `bg-surface-2` — elevation 1. Either a panel sitting on top of the base
  surface, or the hover state of a row/item on `bg-surface`.
- `bg-surface-3` — elevation 2. Hover state on top of `bg-surface-2`, or the
  selected state on top of `bg-surface`.
- `bg-surface-4` — elevation 3. Selected state on top of `bg-surface-2`.
- `bg-surface-5` — elevation 4. Selected state on top of `bg-surface-3`.

General pattern for an interactive row/item:

```
bg-surface            (base)
hover:bg-surface-2     (hover)
selected: bg-surface-3
```

If the container itself is already `bg-surface-2`, shift the chain up one step:
hover becomes `bg-surface-3`, selected becomes `bg-surface-4`.

## Text: `text-foreground` vs `text-muted-foreground`

- `text-foreground` — primary text color. Backed by `--color-foreground`.
- `text-muted-foreground` — secondary/dimmed text (labels, hints, subtext).
  Backed by `--color-muted-foreground`.

These were renamed from `text-text-base` / `text-text-dim` (formerly
`--color-text-base` / `--color-text-dim`) for clearer, more conventional
naming. The old names are kept as aliases (`--color-text-base: var(--color-foreground)`,
`--color-text-dim: var(--color-muted-foreground)`) so existing `text-text-base` /
`text-text-dim` usages keep working — but use `text-foreground` /
`text-muted-foreground` in any new code.

`text-white` is a separate, raw Tailwind color — not a theme token, and not
an alias for `text-foreground`. Don't swap existing `text-white` for
`text-foreground`; that changes its meaning from "always white" to
"theme-adaptive." Reserve `text-white` for text that must render as true
white regardless of theme (e.g. on a saturated accent/danger fill); reach
for `text-foreground` / `text-muted-foreground` for ordinary body/UI text
that should adapt between light and dark.

## Border levels: `border-border` vs `border-border-dark`

There are only two border colors — don't introduce a third:

- `border-border` — the subtle level. Low contrast, meant to barely separate
  content sitting on `bg-surface` (e.g. a hairline between rows).
- `border-border-dark` — the stronger level. Higher contrast, used where a
  border needs to actually read as a border rather than a faint seam —
  structural dividers between major layout regions.

When adding a new border, default to `border-border`. Reach for
`border-border-dark` only when `border-border` isn't visible enough for
what you're separating.

## Texture utilities: `bg-dotted` and `bg-diagonal-stripes`

- `bg-dotted` — dot-grid texture for a larger empty content area.
- `bg-diagonal-stripes` — hairline stripe texture for a thin filler strip.

Use sparingly, as an occasional accent rather than the default treatment for
empty space — a flat `bg-surface*` is still the normal choice. Both are
decorative only — pair with a `bg-surface*` class underneath since neither
utility paints a base background itself.
