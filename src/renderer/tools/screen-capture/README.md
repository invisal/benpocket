# Screen Capture

Take a single PNG screenshot of a screen or window via an **in-app source picker** (`desktopCapturer` thumbnails). Preview the result, copy to clipboard, or save through a native file dialog. Integrated as a CraftBox tool tab — same shared main window as everything else.

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

| Phase       | Header                                                | Body                                        |
| ----------- | ----------------------------------------------------- | ------------------------------------------- |
| `idle`      | Entire Screen / Window tabs + **Capture** (top-right) | Permission banner + thumbnail grid          |
| `capturing` | Hidden                                                | “Capturing…” spinner                        |
| `result`    | **Preview** title + description                       | Preview image + Copy / Save / Capture again |

**Capture again** resets to `idle` with the source grid — it does **not** immediately re-capture. The user picks a source and clicks **Capture** again.

On success, a **native OS notification** is shown (see below). Source-load errors render inline in the body.

## Source loading (`lib/use-capture-sources.ts`)

1. `window.screenRecorder.recording.getCaptureSources()` on mount
2. Split into `screens` and `windows` by `source.type`
3. Default tab: **Entire Screen** when displays exist, otherwise **Window**
4. Auto-select the first source on the active tab

Thumbnails come from `main/capture/screen-source-provider.ts` (`desktopCapturer.getSources`).

## Capture pipeline (`lib/capture-frame.ts`)

Same capture primitive as Screen Recorder — **`getUserMedia` + `chromeMediaSourceId`**, not `getDisplayMedia`:

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

### Hiding the app on full-screen capture

When the chosen source is a display (`source.type === 'screen'`):

- `window.screenRecorder.window.hide()` → `ipc/window-handlers.ts`
  - **macOS:** `app.hide()` (whole app, not just the window)
  - **Linux/Windows:** waits for Electron `'hide'` event on the window
- **macOS only:** 300 ms settle delay after hide before grabbing (`ponytail:` compositor beat)
- After grab: `window.screenRecorder.window.restore()` → `app.show()` on macOS; Linux GNOME gets a brief `setAlwaysOnTop` focus pin

Window capture (`source.type === 'window'`) skips hide/show.

## Clipboard copy — two paths (important)

Auto-copy after capture and the **Copy** button use **different strategies** on purpose:

| When              | Strategy                                                    | Why                                                                  |
| ----------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| After capture     | Main process first (`screenshot.copy`), renderer fallback   | User-gesture from the Capture click expires during hide/grab/restore |
| Copy button click | Renderer `navigator.clipboard` first, main process fallback | Fresh user gesture; renderer path is reliable on click               |

After capture, copy is deferred until the preview phase is shown and two `requestAnimationFrame` ticks pass (GNOME/Wayland focus settle).

Main-process copy: `src/main/screen-recorder/clipboard/copy-screenshot-to-clipboard.ts`

- Waits for window focus (up to 500 ms)
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

| `window.api.*`     | Handler / module                                          |
| ------------------ | --------------------------------------------------------- |
| `showNotification` | `main/notification-handlers.ts` → Electron `Notification` |

Renderer helper: `src/renderer/src/lib/notify.ts` — `notifySuccess()` / `notifyError()` with title **CraftBox**.

IPC channels (`src/shared/ipc-channels.ts`): `capture:get-sources`, `screenshot:copy`, `screenshot:save`, `notification:show`, `window:hide`, `window:restore`.

## Shared global hooks (affects other tools)

Registered once in `src/main/index.ts`:

| Module                                | Scope                                      | Screen Capture usage                             |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| `security/content-security-policy.ts` | Whole app CSP                              | `img-src` includes `data:` for picker thumbnails |
| `ipc/window-handlers.ts`              | All tools using title bar / hide / restore | Hide/restore for full-screen capture             |
| `capture/screen-source-provider.ts`   | Shared with Screen Recorder source picker  | Lists screens/windows for the thumbnail grid     |

Screen Capture and Screen Recorder share the same **`getUserMedia` + `chromeMediaSourceId`** capture primitive (`capture-frame.ts` vs `capture-engine.ts`). Changes to shared IPC (`getCaptureSources`, hide/restore, clipboard) affect both.

## Differences from Screen Recorder

|                  | Screen Capture                       | Screen Recorder               |
| ---------------- | ------------------------------------ | ----------------------------- |
| Source selection | In-app `desktopCapturer` grid        | In-app `desktopCapturer` grid |
| Output           | Single PNG                           | Video (`MediaRecorder`)       |
| Hide window      | Yes, on `source.type === 'screen'`   | No                            |
| Cursor in shot   | Whatever the OS includes — no toggle | N/A (video stream)            |

## Intentionally not implemented / removed

Do not re-add without re-validating on all target platforms:

- **`getDisplayMedia` + OS system picker** — removed; replaced by in-app picker for consistent cross-platform UX (`display-media-handler.ts` deleted)
- **Main-process `screenshot:capture` PNG path** — removed; renderer grab from `getUserMedia` stream is sufficient
- **`cursor: 'never'` on `getDisplayMedia`** — N/A after picker removal
- **Custom in-app toast** — replaced by native OS notifications

## Platform notes

- **macOS:** `app.hide()` / `app.show()` for full-screen capture; 300 ms post-hide settle before grab
- **Linux GNOME / Wayland:** clipboard after capture needs main-process write + focus wait; restore uses `setAlwaysOnTop` focus pin
- **`waitForVideoFrame`** uses video events only — no arbitrary timeout wrappers on the grab itself

## Type-checking

```bash
npm run typecheck:web
npm run typecheck:node
npm run lint
npm run format
```

Touch main + renderer when changing IPC, clipboard, window handlers, or capture logic.
