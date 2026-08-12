# BenPocket

BenPocket — a personal multi-purpose toolkit (Swiss Army knife) combining small tools:

- `file-explorer` — browse, edit, and manage local files (and R2/S3, in progress)
- `http-client` — Postman-style tool for building and sending HTTP/WebSocket requests
- `kuberneter` — Kubernetes GUI client for browsing cluster resources (pods, deployments, services, etc.)
- `screen-capture` — take screenshots
- `screen-recorder` — record, edit, and export screen recordings

## Workflow

Every change must pass format, lint, typecheck, knip, and tests before it's considered done:

```bash
npm run check    # format:check + lint + typecheck + knip + test
```

- Run this after finishing a change. If it fails on formatting, run `npm run format` (prettier --write, auto-fixes) and re-run `npm run check`. If `lint` has errors or warnings, fix them.
- If `knip` reports an unused export, prefer deleting the dead code over adding it to `knip.jsonc` ignores. Only extend `knip.jsonc` for false positives (e.g. system binaries invoked via `spawn`).

## Guidelines

- Use `cn` from `cnfast` to combine class names — not manual string template concatenation.
- Write tests for pure logic — parsers, data transforms, store/sync logic — where input and expected output are obvious and the test would fail if the logic broke. Skip tests that need heavy mocking of internal collaborators; if a test needs 3+ stubs to set up, decompose the function instead. A small fake at a real I/O boundary (network, fs, IPC) is fine — see `src/main/store/syncProvider.test.ts`. Don't write component tests for coverage's sake.

## Receipts

Topic-specific reference docs live in `docs/receipts/`. Check the relevant one before
touching that area of the code:

- [design.md](docs/receipts/design.md) — shared components (prefer reuse) and Tailwind color tokens
- [tools.md](docs/receipts/tools.md) — folder structure for `renderer/tools/*`
