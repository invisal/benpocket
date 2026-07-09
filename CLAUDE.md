# CraftBox

## Workflow

Every change must pass format and lint before it's considered done:

```bash
npm run format       # prettier --write . (auto-fixes formatting)
npm run lint          # eslint --cache .
npm run typecheck     # tsc --noEmit for both node and web targets
```

Run all three after finishing a change. If `lint` have error or warning in files and fix them .
