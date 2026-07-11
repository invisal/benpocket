# Screen Capture

Take a single PNG screenshot of a screen or window. Preview the result, copy to clipboard, or save through a native file dialog. Integrated as a CraftBox tool tab — same shared main window as everything else.

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
components/SourcePicker.tsx    Thumbnail grid for screen/window sources
lib/use-capture-sources.ts     Loads sources via IPC, tab state, default selection
lib/capture-frame.ts           getUserMedia → single PNG frame (renderer-side grab)
README.md                      This file
```

## UI flow (`index.tsx`)

When `window.api.usesOsCapturePicker` is true (Linux Wayland), the thumbnail grid is skipped.

| Phase       | Header (in-app picker)                    | Header (OS picker / Wayland) | Body                                        |
| ----------- | ----------------------------------------- | ---------------------------- | ------------------------------------------- |
| `idle`      | Entire Screen / Window tabs + **Capture** | Title + hint + **Capture**   | Permission banner + thumbnail grid / empty  |
| `capturing` | Hidden                                    | Hidden                       | “Capturing…” / “Choose what to share…”      |
| `result`    | **Preview** title + description           | same                         | Preview image + Copy / Save / Capture again |

**Capture again** resets to `idle` with the source grid on macOS/Windows/X11 — it does **not** immediately re-capture. On **Linux Wayland**, **Capture again** reopens the OS portal picker immediately (still uses the button click as the user gesture).

On success, a **native OS notification** is shown (see below). Permission issues are surfaced only via `ScreenRecordingPermissionBanner` — no inline error text.

## Source loading (`lib/use-capture-sources.ts`)

1. `window.screenRecorder.recording.getCaptureSources()` on mount
2. Split into `screens` and `windows` by `source.type`
3. Default tab: **Entire Screen** when displays exist, otherwise **Window**
4. Auto-select the first source on the active tab

Thumbnails come from `main/capture/screen-source-provider.ts` (`desktopCapturer.getSources`).

## Source loading (`lib/use-capture-sources.ts`)

Skipped when `usesOsCapturePicker` is true. Otherwise:

1. `window.screenRecorder.recording.getCaptureSources()` on mount
2. Split into `screens` and `windows` by `source.type`
3. Default tab: **Entire Screen** when displays exist, otherwise **Window**
4. Auto-select the first source on the active tab

Thumbnails come from `main/capture/screen-source-provider.ts` (`desktopCapturer.getSources`).

## Capture pipeline (`lib/capture-frame.ts`)

Two paths, selected by `window.api.usesOsCapturePicker`:

### In-app picker (macOS / Windows / Linux X11) — `captureFromSource`

1. User picks a source in the in-app grid
2. If `source.type === 'screen'` → hide CraftBox so it is not in the shot
3. `getUserMedia` with `chromeMediaSource: 'desktop'` and the chosen `chromeMediaSourceId`
4. Grab **one frame**: off-DOM `<video>` → `<canvas>` → PNG `Blob`
5. Restore window if it was hidden

```
getCaptureSources (renderer → main → desktopCapturer)
    ↓
User selects thumbnail in SourcePicker
    ↓
captureFromSource(source)
    ↓ hide (screen only) → getUserMedia → grabPngFromStream → restore
PNG Blob
```

### OS picker (Linux Wayland) — `captureFromSystemPicker`

1. User clicks **Capture**
2. `getDisplayMedia()` — PipeWire portal shows all screens/windows
3. Main process `display-media-handler.ts` passes a placeholder source on Wayland so the portal owns selection
4. If `displaySurface === 'monitor'` → hide CraftBox (IPC waits for window `'hide'`), then attach stream and grab the first decoded frame
5. Restore window if hidden

```
User clicks Capture
    ↓
captureFromSystemPicker()
    ↓ getDisplayMedia (portal picker)
    ↓ hide (monitor only) → grabPngFromStream → restore
PNG Blob
```

### Hiding the app on full-screen capture

When the chosen source is a display (`source.type === 'screen'`, or `displaySurface === 'monitor'` via OS picker):

- `window.screenRecorder.window.hide()` → `ipc/window-handlers.ts`
  - **macOS:** `app.hide()`, then waits for Electron `'hide'` on the window
  - **Linux/Windows:** `win.hide()`, then waits for Electron `'hide'` event
- Hide completes **before** the video element attaches — first decoded frame is post-hide
- After grab: `window.screenRecorder.window.restore()` → `app.show()` on macOS; Linux GNOME gets a brief `setAlwaysOnTop` focus pin

Window capture (`source.type === 'window'`) skips hide/show.

## Clipboard copy — two paths (important)

Auto-copy after capture and the **Copy** button use **different strategies** on purpose:

| When              | Strategy                                                    | Why                                                                  |
| ----------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| After capture     | Main process first (`screenshot.copy`), renderer fallback   | User-gesture from the Capture click expires during hide/grab/restore |
| Copy button click | Renderer `navigator.clipboard` first, main process fallback | Fresh user gesture; renderer path is reliable on click               |

After capture, main-process copy runs immediately; it waits for the window `'focus'` event (no timeout) before writing.

Main-process copy: `src/main/screen-recorder/clipboard/copy-screenshot-to-clipboard.ts`

- Waits for window `'focus'` after `win.focus()`
- Writes both `clipboard.writeBuffer('image/png', …)` and `clipboard.writeImage()` — needed on Wayland

## Main process / IPC

Reuses the **`window.screenRecorder`** preload namespace (same as Screen Recorder) even though this is a separate tool tab.

| `window.screenRecorder.*`     | Handler / module                                                       | Used by Screen Capture    |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------- |
| `recording.getCaptureSources` | `ipc/recording-handlers.ts` → `capture/screen-source-provider.ts`      | Yes — thumbnail picker    |
| `window.hide` / `restore`     | `ipc/window-handlers.ts`                                               | Yes — full-screen capture |
| `screenshot.copy`             | `ipc/dialog-handlers.ts` → `clipboard/copy-screenshot-to-clipboard.ts` | Yes                       |
| `screenshot.save`             | `ipc/dialog-handlers.ts` (native save dialog → Pictures)               | Yes                       |
| `recording.start` / `stop`    | Screen Recorder pipeline                                               | **No**                    |

App-wide notifications (not under `screenRecorder`):

| `window.api.*`        | Handler / module                                          |
| --------------------- | --------------------------------------------------------- |
| `usesOsCapturePicker` | `@shared/uses-os-capture-picker.ts` (preload)             |
| `showNotification`    | `main/notification-handlers.ts` → Electron `Notification` |

Renderer helper: `src/renderer/src/lib/notify.ts` — `notifySuccess()` / `notifyError()` with title **CraftBox**.

IPC channels (`src/shared/ipc-channels.ts`): `capture:get-sources`, `screenshot:copy`, `screenshot:save`, `notification:show`, `window:hide`, `window:restore`.

## Shared global hooks (affects other tools)

Registered once in `src/main/index.ts`:

| Module                                | Scope                                      | Screen Capture usage                             |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `security/content-security-policy.ts` | Whole app CSP                              | `img-src` includes `data:` for picker thumbnails |
| `security/display-media-handler.ts`   | `getDisplayMedia` on Linux Wayland         | Routes capture to PipeWire portal picker         |
| `ipc/window-handlers.ts`              | All tools using title bar / hide / restore | Hide/restore for full-screen capture             |
| `capture/screen-source-provider.ts`   | Shared with Screen Recorder source picker  | Lists screens/windows for the thumbnail grid     |

Screen Capture and Screen Recorder share the same **`getUserMedia` + `chromeMediaSourceId`** capture primitive (`capture-frame.ts` vs `capture-engine.ts`). Changes to shared IPC (`getCaptureSources`, hide/restore, clipboard) affect both.

## Differences from Screen Recorder

|                  | Screen Capture                                           | Screen Recorder               |
| ---------------- | -------------------------------------------------------- | ----------------------------- |
| Source selection | In-app grid (most platforms); OS picker on Linux Wayland | In-app `desktopCapturer` grid |
| Output           | Single PNG                                               | Video (`MediaRecorder`)       |
| Hide window      | Yes, on `source.type === 'screen'`                       | No                            |
| Cursor in shot   | Whatever the OS includes — no toggle                     | N/A (video stream)            |

## Intentionally not implemented / removed

- **Main-process `screenshot:capture` PNG path** — removed; renderer grab from media stream is sufficient
- **`cursor: 'never'` on `getDisplayMedia`** — N/A
- **Custom in-app toast** — replaced by native OS notifications

## Platform notes

- **macOS:** `app.hide()` / `app.show()` for full-screen capture; IPC waits for window `'hide'`
- **Linux Wayland:** `usesOsCapturePicker` — no in-app grid; `getDisplayMedia` + `display-media-handler.ts` for portal picker
- **Linux GNOME / Wayland:** clipboard after capture needs main-process write + focus wait; restore uses `setAlwaysOnTop` focus pin
- **Linux X11:** in-app thumbnail grid works like macOS/Windows
- **`waitForVideoFrame`** uses video element events only (`loadeddata`, `playing`, `resize`)

## Type-checking

```bash
npm run typecheck:web
npm run typecheck:node
npm run lint
npm run format
```

Touch main + renderer when changing IPC, clipboard, window handlers, or capture logic.
