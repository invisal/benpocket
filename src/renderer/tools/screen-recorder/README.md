# ScreenRecorder

A screen recording + editing tool integrated as one of CraftBox's tools (alongside Lens/Kubernetes and Postman). Record a screen/window, trim and arrange clips on a timeline, style the output (background, cursor, webcam PiP, captions, zoom), and export to MP4/WebM/MOV/GIF.

## How it's mounted into CraftBox

ScreenRecorder doesn't run standalone — it's mounted inside the main CraftBox window through the same activity-bar → sidebar → tab-workspace chrome every other tool uses:

```
AppShell
├─ ActivityBar            (icon rail — switches which tool instance is active)
├─ LeftPanel
│   └─ ScreenRecorderSidebar   tools/screen-recorder/sidebar/ScreenRecorderSidebar.tsx
│       Audio + webcam controls and the Start/Stop Recording button live
│       here (not in RecordSetupPage) so they stay reachable and a
│       recording stays controllable no matter which internal page is open.
└─ Workspace (tab content area)
    └─ ScreenRecorderWorkspace   src/renderer/src/components/layout/workspaces/ScreenRecorderWorkspace.tsx
        └─ ScreenRecorderApp     tools/screen-recorder/ScreenRecorderApp.tsx
            Owns a small top nav (Record / Library / Presets / Editor / Settings)
            and renders whichever workspace/ page matches useAppStore().route.
```

`recording-hud` is a `ScreenRecorderRoute` value but is **not** one of the nav items and is never rendered by `ScreenRecorderApp` — `workspace/recording-hud/RecordingHudPage.tsx` is meant to load into its own frameless always-on-top window (see "Known gaps" below), not the main tab content.

## Navigation model

There's no router. `app/app-store.ts` (`useAppStore`, a zustand store) holds a single `route: ScreenRecorderRoute` field; `ScreenRecorderApp` and `ScreenRecorderSidebar` both read/write it directly. It also holds `isRecording`, `lastRecording` (preview URL + on-disk path + size + timestamp of the most recent recording), and `projectName`.

Everything else is its own independent zustand store under `features/*/store/`, each scoped to one concern (`recording-store`, `background-store`, `cursor-store`, `webcam-store`, `captions-store`, `zoom-store`, `crop-store`, `annotations-store`, `timeline-store`, `export-store`, `shortcuts-store`). Feature panels read/write their store directly — nothing is prop-drilled from `EditorPage` down.

## Directory layout

```
ScreenRecorderApp.tsx        Root component: top nav + route switch
app/app-store.ts           Global route/recording state (see above)
sidebar/                   ScreenRecorderSidebar (mounted by the outer app's LeftPanel)
components/ui/             Local button.tsx / slider.tsx (this tool's own tiny design
                            system — deliberately separate from src/renderer/src/components/ui)
workspace/                 One folder per ScreenRecorderRoute page:
  record-setup/               source picker + permission banner (controls live in the sidebar)
  library/                    last recording, jump into the editor
  presets/                    export preset picker, jumps into the editor
  editor/                     EditorPage + PreviewStage + EditorTransportBar +
                               EditorToolRail/EditorToolPanel (the tool-panel switcher for
                               Background/Cursor/Webcam/Captions/Zoom/Export)
  settings/                   shortcut rebinding (ShortcutRecorder)
  recording-hud/               unwired — see "Known gaps"
features/                  One folder per concern, each typically store/ + components/
                            (+ engine/ or lib/ for pure logic): recording, background,
                            cursor, webcam, captions, zoom, crop, annotations, timeline, export
types/                     Shared type definitions (project/recording/export/timeline/
                            permissions/shortcuts) — also imported by main/preload via the
                            `@screen-recorder/*` alias
lib/                       cn() (re-exports cnfast), appRegion(), mediaErrorMessage()
hooks/useStore.ts          Dead scaffold — see "Known gaps", do not use
```

## Main process / IPC

Renderer code talks to the main process through `window.screenRecorder` (exposed by `src/preload/screen-recorder/api.ts`). Handlers live in `src/main/screen-recorder/ipc/*-handlers.ts` and are all registered together via `registerIpcHandlers()` (`ipc/register-handlers.ts`), which is called from `src/main/index.ts`'s `app.whenReady()` alongside Postman's handlers — ScreenRecorder does **not** get its own `BrowserWindow`; it shares CraftBox's single main window (see "Known gaps" for the unused standalone-window scaffolding).

| `window.screenRecorder.*` | Backed by                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `recording.*`             | `capture/screen-source-provider.ts`, `capture/recording-controller.ts`                                                          |
| `project.*`               | `ipc/project-handlers.ts` (open/save — currently stubs, no real persistence)                                                    |
| `export.*`                | `export/export-manager.ts` → `frame-compositor.ts` / `video-encoder.ts` / `video-decoder.ts` (ffmpeg-backed)                    |
| `settings.*`              | `store/settings-store.ts` (electron-store; pinned to `^8.x` — v9+ is ESM-only and breaks under electron-vite's CJS main bundle) |
| `window.*`                | TitleBar minimize/maximize/close (`ipc/window-handlers.ts`); `hide`/`restore` added for Screen Capture only                     |
| `permissions.*`           | `permissions/screen-recording-permission.ts` (macOS screen-recording permission check)                                          |
| `dialog.*`                | `ipc/dialog-handlers.ts` (native save-file dialog for export)                                                                   |
| `screenshot.*`            | **Screen Capture tool only** — PNG capture, clipboard, save, region overlay, Wayland portal pick (see `tools/screen-capture/`)  |
| `regionSelect.*`          | **Screen Capture tool only** — IPC from the `region-select.html` overlay entry                                                  |

The actual capture (`getUserMedia` + `MediaRecorder`) happens in the **renderer** (`features/recording/engine/capture-engine.ts`) since those are browser APIs with no main-process equivalent; the main process only persists the finished blob and drives export. Screen Recorder does **not** call `getDisplayMedia` — the Wayland `display-media-handler.ts` hook (Screen Capture only) does not affect recording.

CSP is set dynamically per-response from `main/screen-recorder/security/content-security-policy.ts` (dev vs. prod policy, `media-src blob:` for the recording preview, `img-src data: blob:` for source thumbnails and screenshot previews) — `index.html` intentionally has **no** CSP `<meta>` tag, because a static tag would combine restrictively with that header and block what it's meant to allow.

## Editor tool panel

`EditorToolRail` (icon rail) + `EditorToolPanel` (the panel body) is a single mutually-exclusive switcher over `EditorTool = 'background' | 'cursor' | 'webcam' | 'captions' | 'zoom' | 'export'`. Every panel is self-contained — no props from `EditorPage`, each reads its own feature store directly — **except** it's still worth checking `ExportSidePanel` if you're touching this, since it's the newest addition and pulls from `app-store`/`timeline-store` directly rather than the feature's own store (there is no dedicated UI store for export beyond `export-store`'s format/codec/quality fields).

The export flow itself (save-path dialog → `export.start` → live progress via `export.onProgress` → error surfacing) lives once in `features/export/hooks/useExportAction.ts` and is shared by both `ExportButton` (quick top-nav export using whatever's currently in `export-store`) and `ExportSidePanel`'s full config panel — don't duplicate that flow a third time.

## Known gaps / unwired scaffolding

These exist in the tree but nothing calls them — don't assume they're live just because the file exists:

- **`workspace/recording-hud/RecordingHudPage.tsx`** and **`main/screen-recorder/windows/recorder-bar-window.ts`** — a small always-on-top recording control bar, meant to be a separate `BrowserWindow` loading this page. `recorder-bar-window.ts` creates a window but never calls `loadURL`/`loadFile`, so it's a no-op today.
- **`main/screen-recorder/windows/main-window.ts`** and **`windows/editor-window.ts`** — a more complete, frameless/custom-titlebar standalone window setup for ScreenRecorder, plus a placeholder for a dedicated multi-window editor. Not used — the app actually runs inside CraftBox's single shared window (`src/main/index.ts`'s `createWindow()`). Don't wire these up without checking whether that's still the intended architecture.
- **`hooks/useStore.ts`** (`useScreenRecorderStore`) — an earlier/parallel version of `app/app-store.ts`'s state (same shape, different route typing). Nothing imports it. Use `app/app-store.ts`.
- **`main/screen-recorder/shortcuts/global-shortcuts.ts`** — registers global hotkeys with no-op callbacks (`// TODO: dispatch binding.action`); not called from `main/index.ts`. Registering it as-is would just grab system-wide shortcuts that do nothing.
- **`features/recording/hooks/useRecordingSession.ts`**, **`lib/use-electron-api.ts`** — thin convenience wrappers around `window.screenRecorder`, unused (current code calls `window.screenRecorder.recording.*` directly).
- **`features/cursor/engine/cursor-smoothing-engine.ts`**, **`features/zoom/engine/auto-zoom-engine.ts`**, **`features/captions/engine/on-device-transcriber.ts`**, **`features/annotations/presets/text-animation-presets.ts`** — stub implementations for post-processing that hasn't been built yet (cursor jitter smoothing, auto-zoom keyframe generation, on-device transcription, annotation enter/exit animations). All explicitly marked `TODO` and return no-ops.
- **`features/export/components/ExportDialog.tsx`** — an earlier, incomplete export UI (no output-path picker, no progress) superseded by `ExportSidePanel`. Unreferenced.
- **Annotation rendering** (`features/annotations/components/{Arrow,Image,Text}Annotation.tsx`) — type-checked components with `// TODO: render an SVG arrow / render this image / render this text` bodies; the annotations feature has a store and types but no actual on-canvas rendering yet.

## Type-checking & building

```bash
npm run typecheck:web     # tsc -p tsconfig.web.json (renderer + preload types)
npm run typecheck:node    # tsc -p tsconfig.node.json (main + preload)
npm run build              # typecheck + electron-vite build (main/preload/renderer)
```

Path alias: `@screen-recorder/*` → `src/renderer/tools/screen-recorder/*`, defined in `tsconfig.web.json`, `tsconfig.node.json`, and (for the actual bundler, not just types) `electron.vite.config.ts`'s `main`/`preload`/`renderer` blocks. Import via the alias rather than deep relative paths (`../../../../`) or the old literal `src/renderer/tools/screen-recorder/...` form — the latter resolves under `tsc`'s `baseUrl` but Rollup can't resolve it at bundle time.
