# Tool folder structure

Each tool lives at `src/renderer/tools/<tool-name>/` (kebab-case).

```
<tool-name>/
  index.tsx      # entry
  components/    # UI pieces (PascalCase .tsx)
  hooks/         # useX.ts hooks
  lib/           # non-React helper logic (not utils/)
  store/         # *.store.ts zustand state
  types/         # type-only files (folder, not a single types.ts)
```

Small tools (e.g. `home`, `settings`) can skip subfolders they don't need.

Tools with multiple independent features or pages may add:

- `features/<feature>/{components,store,lib,engine}` — one folder per concern
- `workspace/<page>/` — one folder per top-level page/route
