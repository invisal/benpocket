# Screen Capture

Take a single PNG screenshot of a screen, window, or screen region. Preview the result, copy to clipboard, or save through a native file dialog. Integrated as a CraftBox tool tab — same shared main window as everything else.

**Source selection is platform-dependent:**

- **macOS / Windows / Linux X11:** in-app thumbnail grid (`desktopCapturer.getSources`)
- **Linux Wayland:** no in-app grid — pixels come straight from the OS via the xdg-desktop-portal `Screenshot` D-Bus interface (not PipeWire/`getDisplayMedia`, which round-trips through a video frame and loses quality; see `capture/portal-screenshot.ts`)

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
lib/capture-frame.ts           captureFromSource / selectAndCaptureRegion → PNG
README.md                      This file
region-select.html / .ts       Fullscreen drag-to-select overlay (separate renderer entry)
```

Shared with main/preload (not under this directory):

- `src/shared/uses-os-capture-picker.ts` — Wayland detection (`window.api.usesOsCapturePicker`)
- `src/main/screen-recorder/capture/portal-screenshot.ts` — Wayland: xdg-desktop-portal `Screenshot` D-Bus call, always interactive (GNOME's own screen/window/selection picker)
- `src/main/screen-recorder/capture/display-for-source.ts` — pairs capturer `display_id` with `screen.getAllDisplays()`
- `src/main/screen-recorder/capture/screenshot-capture.ts` — main-process full-display PNG grab (macOS / Windows / Linux X11)
- `src/main/screen-recorder/windows/window-visibility.ts` — hide/restore helpers (shared with window IPC)
- `src/main/screen-recorder/windows/region-select-window.ts` — transparent overlay spanning all displays (macOS / Windows / Linux X11 only)

## UI flow (`index.tsx`)

When `window.api.usesOsCapturePicker` is true (Linux Wayland), the thumbnail grid is skipped **and the footer shows only one "Capture" button** — GNOME's native picker already offers screen/window/selection in one UI, so a separate "Capture region" button would trigger the exact same flow.

| Phase       | Header (in-app picker)          | Header (OS picker / Wayland) | Body / footer (idle)                                                                                                                                                                      |
| ----------- | ------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`      | Entire Screen / Window tabs     | Title + short description    | Scrollable source grid (Wayland: empty body — the header description already explains the flow); footer pinned bottom-right: **Capture region** + **Capture** (Wayland: **Capture** only) |
| `capturing` | Hidden                          | Hidden                       | “Capturing…” / region / portal message                                                                                                                                                    |
| `result`    | **Preview** title + description | same                         | Preview scales to fit; footer pinned bottom-right: Copy / Save / Capture again                                                                                                            |

**Capture again** resets to `idle` — it does **not** immediately re-capture. On macOS/Windows/X11 that shows the source grid; on Linux Wayland it returns to the idle screen with the single **Capture** button in the footer.

Errors (clipboard copy, region capture, save) are logged to the console — no notifications. Permission issues are surfaced only via `ScreenRecordingPermissionBanner` — no inline error text.

## Source loading (`lib/use-capture-sources.ts`)

Skipped when `window.api.usesOsCapturePicker` is true (Linux Wayland). Otherwise on mount:

1. `window.screenRecorder.recording.getCaptureSources()`
2. Split into `screens` and `windows` by `source.type`
3. Default tab: **Entire Screen** when displays exist, otherwise **Window**
4. Auto-select the first source on the active tab

Thumbnails come from `main/screen-recorder/capture/screen-source-provider.ts` (`desktopCapturer.getSources`).

## Cross-platform summary

| Action              | macOS / Windows / Linux X11                           | Linux Wayland (xdg-desktop-portal)                                                                                                     |
| ------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Capture**         | In-app grid → main-process PNG (screen hides app)     | Same as Capture region below — there's only one button on Wayland                                                                      |
| **Capture region**  | Overlay → main-process PNG + crop (app stays visible) | Portal `Screenshot(interactive: true)` — hide our window, GNOME's own screen/window/selection picker returns the final pixels directly |
| Source grid         | Yes (`getCaptureSources`)                             | No — OS portal instead                                                                                                                 |
| Hide on full screen | Yes (atomic main-process IPC)                         | Yes, always — our own window would otherwise sit on top of GNOME's picker                                                              |

Wayland uses **one portal call for every capture**, always `interactive: true` — CraftBox never takes a screenshot without the user seeing and confirming it in GNOME's own picker. This intentionally does not use `getDisplayMedia`/PipeWire (Chromium's ScreenCast path): that round-trips a still through a video frame, which is visibly lower quality than the OS's own screenshot pixels — see `capture/portal-screenshot.ts` for why. There's no separate "pick a rect, then grab pixels" step for region capture: GNOME's own picker UI handles the whole selection and hands back the finished image, so "Capture" and "Capture region" collapse into the same call on Wayland (hence the merged footer button).

## Region capture (`selectAndCaptureRegion`)

**Capture region** and **Capture** sit together in a footer pinned to the bottom-right of the app (scroll the source grid above) on macOS/Windows/X11. On Wayland only **Capture** is shown, and it calls this same function.

### Linux Wayland

1. Main process hides the window (same as the non-Wayland full-display hide — otherwise CraftBox sits on top of GNOME's picker)
2. `screenshot.capturePortal()` — GNOME shows its own screen/window/selection picker UI
3. User picks and confirms in that native UI (Esc cancels — resolves `null`, no error); main process restores and focuses the window
4. Portal writes the file, we read it and return the bytes directly — **no overlay, no crop**

### macOS / Windows / Linux X11

1. Hide main window for the overlay
2. `screenshot.selectRegion()` — user drags a rect (Esc cancels); `region-select.ts` maps client coords via `ox`/`oy` query params
3. Restore window unfocused, main-process full-display PNG via `screenshot.capture`, crop to selection

| Platform      | Region overlay             | Capture backend after selection                          |
| ------------- | -------------------------- | -------------------------------------------------------- |
| macOS         | Yes                        | Main-process `desktopCapturer` + crop (`hideApp: false`) |
| Windows       | Yes                        | Main-process `desktopCapturer` + crop                    |
| Linux X11     | Yes                        | Main-process `desktopCapturer` + crop                    |
| Linux Wayland | No — GNOME's own picker UI | Portal `Screenshot(interactive: true)`, no crop needed   |

## Capture pipeline (`lib/capture-frame.ts`)

Selected by `window.api.usesOsCapturePicker`: macOS/Windows/Linux X11 use `captureFromSource` (in-app picker, below); Linux Wayland always uses `selectAndCaptureRegion`'s portal branch (see "Region capture" above) — there is no separate instant/non-interactive Wayland path anymore.

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

### OS picker (Linux Wayland) — `selectAndCaptureRegion`'s Wayland branch

1. User clicks the single **Capture** button
2. IPC `screenshot.capturePortal()` → main process hides the window, calls the portal, restores + focuses when done
3. Main process: `capture/portal-screenshot.ts` calls `org.freedesktop.portal.Screenshot.Screenshot` with `interactive: true`, waits for the async `Request.Response` D-Bus signal, reads the returned file, deletes it
4. A `null` result means the user cancelled in GNOME's picker (Esc / close) — silent, back to idle, no error

```
User clicks Capture
    ↓
selectAndCaptureRegion(..., usesOsPicker=true)
    ↓ IPC screenshot.capturePortal()
    ↓ main: hide → portal Screenshot(interactive: true) → wait for Response signal → read file → restore + focus
PNG Blob (or null if cancelled)
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

| `window.screenRecorder.*`     | Handler / module                                                       | Used by Screen Capture                          |
| ----------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| `recording.getCaptureSources` | `ipc/recording-handlers.ts` → `capture/screen-source-provider.ts`      | Yes — thumbnail picker                          |
| `screenshot.capture`          | `ipc/dialog-handlers.ts` → `capture/screenshot-capture.ts`             | Yes — full-display PNG                          |
| `screenshot.capturePortal`    | `ipc/dialog-handlers.ts` → `capture/portal-screenshot.ts`              | Yes — Wayland only, the only capture path there |
| `screenshot.selectRegion`     | `ipc/region-handlers.ts` → `windows/region-select-window.ts`           | Yes — region overlay (macOS/Windows/X11 only)   |
| `window.hide` / `restore`     | `ipc/window-handlers.ts` → `windows/window-visibility.ts`              | Yes                                             |
| `screenshot.copy`             | `ipc/dialog-handlers.ts` → `clipboard/copy-screenshot-to-clipboard.ts` | Yes                                             |
| `screenshot.save`             | `ipc/dialog-handlers.ts` (native save dialog; remembers last save dir) | Yes                                             |
| `recording.start` / `stop`    | Screen Recorder pipeline                                               | **No**                                          |

Other `window.api.*` used (not under `screenRecorder`):

| `window.api.*`        | Handler / module                              |
| --------------------- | --------------------------------------------- |
| `usesOsCapturePicker` | `@shared/uses-os-capture-picker.ts` (preload) |

IPC channels (`src/shared/ipc-channels.ts`): `capture:get-sources`, `screenshot:capture`, `screenshot:capture-portal`, `screenshot:copy`, `screenshot:save`, `screenshot:select-region`, `region-select:complete`, `region-select:cancel`, `window:hide`, `window:restore`.

## Impact on other CraftBox tools

Screen Capture lives under `tools/screen-capture/` but reuses the **`window.screenRecorder`** preload namespace and some main-process modules from Screen Recorder. Changes are additive unless noted.

| Shared surface                         | Used by Screen Capture                 | Used by Screen Recorder / others                          | Cross-tool risk                                                                                     |
| -------------------------------------- | -------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `recording.getCaptureSources`          | Yes (in-app picker)                    | Yes — `SourcePicker.tsx`                                  | **None** — `screen-source-provider.ts` unchanged; same listing both tools already shared            |
| `getUserMedia` + `chromeMediaSourceId` | Window stills (macOS/Windows/X11 only) | Video recording (`capture-engine.ts`)                     | **None** — different code paths; Screen Recorder never calls the portal                             |
| `capture/portal-screenshot.ts`         | Wayland full + region capture          | **Not used**                                              | **Isolated** — only reachable via `screenshot.capturePortal`, which no other tool calls             |
| `screenshot.*` / `selectRegion`        | Yes                                    | **Not used**                                              | **None** — IPC exists but no other tool calls it                                                    |
| `window.hide` / `window.restore`       | Yes — hide before capture / region     | **Not used** (TitleBar uses minimize/maximize/close only) | **None** — only invoked from Screen Capture renderer                                                |
| `window.minimize` / `close` / …        | No                                     | TitleBar (all tools)                                      | **None** — existing handlers untouched                                                              |
| `content-security-policy.ts`           | Preview images                         | Recording preview (`blob:` URLs)                          | **Low** — added `blob:` to `img-src` (allows blob preview images app-wide; does not loosen scripts) |
| `usesOsCapturePicker` on `window.api`  | UI routing                             | **Not read** by other tools                               | **None** — read-only flag                                                                           |

**Screen Recorder on Linux Wayland:** still uses the in-app `getCaptureSources` grid (PipeWire source enumeration is limited — pre-existing constraint, not introduced by Screen Capture). Screen Capture skips the grid on Wayland and uses OS portals instead.

## Shared global hooks (affects other tools)

Registered once in `src/main/index.ts`:

| Module                                                | Scope                          | Screen Capture usage                                       |
| ----------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `screen-recorder/security/content-security-policy.ts` | Whole app CSP                  | `img-src` includes `data:` for picker thumbnails           |
| `screen-recorder/ipc/window-handlers.ts`              | All tools using hide / restore | Hide/restore for region overlay + full-display capture     |
| `screen-recorder/capture/screen-source-provider.ts`   | Shared with Screen Recorder    | Lists screens/windows for the in-app thumbnail grid        |
| `screen-recorder/capture/portal-screenshot.ts`        | Wayland only                   | `screenshot.capturePortal` — the only Wayland capture path |

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

## Platform notes

- **macOS:** full-display capture uses atomic main-process IPC with `mainOnly` hide; region overlay uses `hide({ mainOnly: true })`
- **Windows / Linux X11:** in-app grid + main-process full-display capture; region keeps the app visible during grab (`hideApp: false`)
- **Linux Wayland:** no in-app grid; full capture and region both go through the xdg-desktop-portal `Screenshot` D-Bus call (`capture/portal-screenshot.ts`), not PipeWire/`getDisplayMedia`; clipboard needs main-process write + focus wait on non-macOS
- **`region-select.ts`** is a separate renderer entry (`tsconfig.web.json`, `electron.vite.config.ts`)

## Type-checking

```bash
npm run typecheck:web
npm run typecheck:node
npm run lint
npm run format
```

Touch main + renderer when changing IPC, clipboard, window handlers, or capture logic.
