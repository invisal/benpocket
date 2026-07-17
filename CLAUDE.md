# BenPocket

BenPocket — a personal multi-purpose toolkit (Swiss Army knife) combining small tools:

- `file-explorer` — browse, edit, and manage local files (and R2/S3, in progress)
- `http-client` — Postman-style tool for building and sending HTTP/WebSocket requests
- `kuberneter` — Kubernetes GUI client for browsing cluster resources (pods, deployments, services, etc.)
- `screen-capture` — take screenshots
- `screen-recorder` — record, edit, and export screen recordings

## Workflow

Every change must pass format and lint before it's considered done:

```bash
npm run format       # prettier --write . (auto-fixes formatting)
npm run lint          # eslint --cache .
npm run typecheck     # tsc --noEmit for both node and web targets
```

- Run all three after finishing a change. If `lint` have error or warning in files and fix them .
- Use `cn` from `cnfast` to combine class names — not manual string template concatenation.

## Receipts

Topic-specific reference docs live in `docs/receipts/`. Check the relevant one before
touching that area of the code:

- [colors.md](docs/receipts/colors.md) — Tailwind color tokens
- [tools.md](docs/receipts/tools.md) — folder structure for `renderer/tools/*`
