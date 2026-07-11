# Screen Capture

Take a single PNG screenshot of a screen, window, or screen region. Preview the result, copy to clipboard, or save through a native file dialog. Integrated as a CraftBox tool tab — same shared main window as everything else.

**Source selection is platform-dependent:**

- **macOS / Windows / Linux X11:** in-app thumbnail grid (`desktopCapturer.getSources`)
- **Linux Wayland (PipeWire):** OS portal picker via `getDisplayMedia` — PipeWire cannot enumerate all sources for a custom grid

## How it's mounted into CraftBox

```
AppShell
├─ ActivityBar              camera icon → activates screen-capture tab
├─ ToolDialog / Home        shortcuts to openTab('screen-capture', {})
└─ Workspace (tab content)
    └─ ScreenCaptureMain    tools/screen-capture/index.tsx
        Phase UI: idle → capturing → result
```

Registration lives in:

- `src/renderer/src/components/providers/AllTools.tsx` — lazy-loads this tool
- `src/renderer/src/components/layout/ActivityBar.tsx` — icon mapping
- `src/renderer/src/components/dialog/ToolDialog.tsx` — “+” menu entry
- `src/renderer/tools/home/index.tsx` — home tile

There is **no** `@screen-capture/*` path alias. Imports use relative paths or shared `@renderer/*` / `@screen-recorder/*` where noted below.

## Directory layout

```
index.tsx                      Main UI — phase state machine + action handlers
components/SourcePicker.tsx    Thumbnail grid for screen/window sources (in-app picker)
lib/use-capture-sources.ts     Loads sources via IPC, tab state, default selection
lib/capture-frame.ts           captureFromSource / captureFromSystemPicker / selectAndCaptureRegion → PNG
README.md                      This file
region-select.html / .ts       Fullscreen drag-to-select overlay (separate renderer entry)
```

Shared with main/preload (not under this directory):

- `src/shared/uses-os-capture-picker.ts` — Wayland detection (`window.api.usesOsCapturePicker`)
- `src/main/screen-recorder/capture/screenshot-capture.ts` — main-process full-display PNG grab
- `src/main/screen-recorder/windows/window-visibility.ts` — hide/restore helpers (shared with window IPC)
- `src/main/screen-recorder/windows/region-select-window.ts` — transparent overlay spanning all displays
- `src/main/screen-recorder/security/display-media-handler.ts` — portal routing for `getDisplayMedia`

## UI flow (`index.tsx`)

When `window.api.usesOsCapturePicker` is true (Linux Wayland), the thumbnail grid is skipped.

| Phase       | Header (in-app picker)                                 | Header (OS picker / Wayland)           | Body                                        |
| ----------- | ------------------------------------------------------ | -------------------------------------- | ------------------------------------------- |
| `idle`      | Entire Screen / Window / **Region** tabs + **Capture** | Screen / **Region** tabs + **Capture** | Permission banner + grid / region hint      |
| `capturing` | Hidden                                                 | Hidden                                 | “Capturing…” / “Choose what to share…”      |
| `result`    | **Preview** title + description                        | same                                   | Preview image + Copy / Save / Capture again |

**Capture again** resets to `idle` with the source grid on macOS/Windows/X11 — it does **not** immediately re-capture. On **Linux Wayland**, **Capture again** reopens the OS portal picker immediately (still uses the button click as the user gesture).

On success, a **native OS notification** is shown (see below). Permission issues are surfaced only via `ScreenRecordingPermissionBanner` — no inline error text.

## Source loading (`lib/use-capture-sources.ts`)

Skipped when `window.api.usesOsCapturePicker` is true (Linux Wayland). Otherwise on mount:

1. `window.screenRecorder.recording.getCaptureSources()`
2. Split into `screens` and `windows` by `source.type`
3. Default tab: **Entire Screen** when displays exist, otherwise **Window**
4. Auto-select the first source on the active tab

Thumbnails come from `main/screen-recorder/capture/screen-source-provider.ts` (`desktopCapturer.getSources`).

## Region capture (`selectAndCaptureRegion`)

**Region** tab: drag a rectangle on a fullscreen overlay, then capture and crop to that area. Works on **all platforms** (overlay is a separate `BrowserWindow`).

1. Hide the main CraftBox window only (`window.hide({ mainOnly: true })`) so the overlay can show on macOS
2. `window.screenRecorder.screenshot.selectRegion()` — transparent overlay spanning the virtual desktop
3. User drags a rect (Esc cancels) — `region-select.ts` maps client coords to screen space via `ox`/`oy` query params
4. Restore main window unfocused, capture the matching display, crop in `capture-frame.ts`, then focus for preview

| Platform      | Region overlay | Capture backend after selection                                                              |
| ------------- | -------------- | -------------------------------------------------------------------------------------------- |
| macOS         | Yes            | Main-process `desktopCapturer` full frame + crop (`hideApp: false` — window stays visible)   |
| Windows       | Yes            | Main-process `desktopCapturer` full frame + crop                                             |
| Linux X11     | Yes            | Main-process `desktopCapturer` full frame + crop                                             |
| Linux Wayland | Yes            | `getDisplayMedia` portal + crop — ponytail: may re-prompt portal; multi-monitor less precise |

## Capture pipeline (`lib/capture-frame.ts`)

Two paths, selected by `window.api.usesOsCapturePicker`:

### In-app picker (macOS / Windows / Linux X11) — `captureFromSource`

| Source type | Backend                                                        | Hide before grab        |
| ----------- | -------------------------------------------------------------- | ----------------------- |
| `screen`    | Main-process `screenshot.capture` → `captureScreenPngWithHide` | Yes (atomic in one IPC) |
| `window`    | Renderer `getUserMedia` + `grabPngFromStream`                  | No                      |

```
getCaptureSources (renderer → main → desktopCapturer)
    ↓
User selects thumbnail in SourcePicker
    ↓
captureFromSource(source)
    ↓ screen: screenshot.capture IPC (blur → hide → desktopCapturer PNG → restore)
    ↓ window: getUserMedia → grabPngFromStream
PNG Blob
```

**Full-display hide behavior** (`capture/screenshot-capture.ts`):

- **macOS:** `mainOnly` window hide inside the atomic IPC — avoids `app.hide()` suspending the renderer before the IPC reply returns
- **Windows / Linux X11:** `win.hide()` inside the same atomic IPC, then restore

### OS picker (Linux Wayland) — `captureFromSystemPicker`

1. User clicks **Capture**
2. `getDisplayMedia()` — PipeWire portal shows all screens/windows
3. Main process `display-media-handler.ts` passes a placeholder source on Wayland so the portal owns selection
4. If `displaySurface === 'monitor'` (or near-full-frame heuristic when PipeWire omits it) → hide CraftBox, grab one frame from the stream, restore
5. Window/application captures skip hide/show

```
User clicks Capture
    ↓
captureFromSystemPicker()
    ↓ getDisplayMedia (portal picker)
    ↓ hide (monitor only) → grabPngFromStream → restore
PNG Blob
```

## Clipboard copy — two paths (important)

Auto-copy after capture and the **Copy** button use **different strategies** on purpose:

| When              | Strategy                                                    | Why                                                                  |
| ----------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| After capture     | Main process first (`screenshot.copy`), renderer fallback   | User-gesture from the Capture click expires during hide/grab/restore |
| Copy button click | Renderer `navigator.clipboard` first, main process fallback | Fresh user gesture; renderer path is reliable on click               |

After capture, clipboard copy runs **async** after `setPhase('result')` so the preview is not blocked.

Main-process copy: `src/main/screen-recorder/clipboard/copy-screenshot-to-clipboard.ts`

- **macOS:** writes immediately (no focus wait)
- **Linux / Windows:** waits for window `'focus'` after `win.focus()` before writing
- Writes both `clipboard.writeBuffer('image/png', …)` and `clipboard.writeImage()` — needed on Wayland

## Main process / IPC

Reuses the **`window.screenRecorder`** preload namespace (same as Screen Recorder) even though this is a separate tool tab.

| `window.screenRecorder.*`     | Handler / module                                                       | Used by Screen Capture |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------------- |
| `recording.getCaptureSources` | `ipc/recording-handlers.ts` → `capture/screen-source-provider.ts`      | Yes — thumbnail picker |
| `screenshot.capture`          | `ipc/dialog-handlers.ts` → `capture/screenshot-capture.ts`             | Yes — full-display PNG |
| `screenshot.selectRegion`     | `ipc/region-handlers.ts` → `windows/region-select-window.ts`           | Yes — region overlay   |
| `window.hide` / `restore`     | `ipc/window-handlers.ts` → `windows/window-visibility.ts`              | Yes — region + legacy  |
| `screenshot.copy`             | `ipc/dialog-handlers.ts` → `clipboard/copy-screenshot-to-clipboard.ts` | Yes                    |
| `screenshot.save`             | `ipc/dialog-handlers.ts` (native save dialog → Pictures)               | Yes                    |
| `recording.start` / `stop`    | Screen Recorder pipeline                                               | **No**                 |

App-wide notifications (not under `screenRecorder`):

| `window.api.*`        | Handler / module                                          |
| --------------------- | --------------------------------------------------------- |
| `usesOsCapturePicker` | `@shared/uses-os-capture-picker.ts` (preload)             |
| `showNotification`    | `main/notification-handlers.ts` → Electron `Notification` |

Renderer helper: `src/renderer/src/lib/notify.ts` — `notifySuccess()` / `notifyError()` with title **CraftBox**.

IPC channels (`src/shared/ipc-channels.ts`): `capture:get-sources`, `screenshot:capture`, `screenshot:copy`, `screenshot:save`, `screenshot:select-region`, `region-select:complete`, `region-select:cancel`, `notification:show`, `window:hide`, `window:restore`.

## Shared global hooks (affects other tools)

Registered once in `src/main/index.ts`:

| Module                                                | Scope                                      | Screen Capture usage                             |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `screen-recorder/security/content-security-policy.ts` | Whole app CSP                              | `img-src` includes `data:` for picker thumbnails |
| `screen-recorder/security/display-media-handler.ts`   | `getDisplayMedia` on Linux Wayland         | Routes capture to PipeWire portal picker         |
| `screen-recorder/ipc/window-handlers.ts`              | All tools using title bar / hide / restore | Hide/restore for region + title bar              |
| `screen-recorder/capture/screen-source-provider.ts`   | Shared with Screen Recorder source picker  | Lists screens/windows for the thumbnail grid     |

Screen Capture and Screen Recorder share **`getCaptureSources`** and hide/restore IPC. Screen Capture uses **main-process `desktopCapturer`** for full-display stills; **renderer `getUserMedia`** for window stills and Wayland portal streams. Screen Recorder video capture stays renderer-only (`capture-engine.ts`).

## Differences from Screen Recorder

|                   | Screen Capture                                                                        | Screen Recorder                |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------ |
| Source selection  | In-app grid (most platforms); OS picker on Linux Wayland                              | In-app `desktopCapturer` grid  |
| Output            | Single PNG                                                                            | Video (`MediaRecorder`)        |
| Full display grab | Main-process `desktopCapturer` thumbnail at display resolution                        | Renderer `getUserMedia` stream |
| Hide window       | Yes on full display (`source.type === 'screen'` or OS `displaySurface === 'monitor'`) | No                             |
| Region            | Yes — overlay + crop                                                                  | No                             |
| Cursor in shot    | Whatever the OS includes — no toggle                                                  | N/A (video stream)             |

## Intentionally not implemented / removed

- **Custom in-app toast** — replaced by native OS notifications
- **Fixed-delay settle after hide** — removed; hide/show sync on IPC `'hide'`/`'show'` events and video element events only
- **Renderer-only full-display capture** — replaced by main-process `screenshot:capture` (macOS renderer suspension + focus issues)

## Platform notes

- **macOS:** full-display capture uses atomic main-process IPC with `mainOnly` hide
- **Windows:** full-display capture uses `win.hide()` inside atomic main-process IPC
- **Linux X11:** same in-app grid + main-process full-display capture as Windows
- **Linux Wayland:** `usesOsCapturePicker` — no in-app grid; `getDisplayMedia` + `display-media-handler.ts` for portal picker; clipboard needs main-process write + focus wait on non-macOS
- **`region-select.ts`** is a separate renderer entry — included in `tsconfig.web.json`; imports preload types for `window.screenRecorder`
- **`waitForVideoFrame`** (Wayland/window path) uses video element events only (`loadeddata`, `playing`, `resize`)

## Type-checking

```bash
npm run typecheck:web
npm run typecheck:node
npm run lint
npm run format
```

Touch main + renderer when changing IPC, clipboard, window handlers, or capture logic.
