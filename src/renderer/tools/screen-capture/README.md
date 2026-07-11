# Screen Capture

Take a single PNG screenshot of a screen or window via the **OS capture picker** (PipeWire portal on Wayland). Preview the result, copy to clipboard, or save through a native file dialog. Integrated as a CraftBox tool tab — same shared main window as everything else.

## How it's mounted into CraftBox

```
AppShell
├─ ActivityBar              camera icon → activates screen-capture tab
├─ ToolDialog / Home        shortcuts to openTab('screen-capture', {})
└─ Workspace (tab content)
    └─ ScreenCaptureMain    tools/screen-capture/index.tsx
        Phase UI: idle → capturing → result | failed
```

Registration lives in:

- `src/renderer/src/components/providers/AllTools.tsx` — lazy-loads this tool
- `src/renderer/src/components/layout/ActivityBar.tsx` — icon mapping
- `src/renderer/src/components/dialog/ToolDialog.tsx` — “+” menu entry
- `src/renderer/tools/home/index.tsx` — home tile

There is **no** `@screen-capture/*` path alias. Imports use relative paths or shared `@renderer/*` / `@screen-recorder/*` where noted below.

## Directory layout

```
index.tsx              Main UI — phase state machine + action handlers
lib/capture-frame.ts   OS picker → single PNG frame (renderer-side grab)
README.md              This file
```

## UI flow (`index.tsx`)

| Phase       | What the user sees                               |
| ----------- | ------------------------------------------------ |
| `idle`      | Permission banner + **Capture** button           |
| `capturing` | “Choose what to share…” while picker / grab runs |
| `result`    | Preview image + Copy / Save / Capture again      |
| `failed`    | Error text + Capture again (returns to idle)     |

**Capture again** resets to `idle` — it does **not** immediately reopen the OS picker. The user must click **Capture** again.

On success, a **native OS notification** is shown (see below). Inline error text remains on the `failed` phase only.

## Capture pipeline (`lib/capture-frame.ts`)

Screen Capture does **not** use Screen Recorder's in-app source grid or `desktopCapturer` thumbnails. Flow:

1. `navigator.mediaDevices.getDisplayMedia()` — OS picker (`useSystemPicker: true` via main-process handler)
2. Detect full-screen capture → hide CraftBox window so it is not in the shot
3. Grab **one frame** from the stream: off-DOM `<video>` → `<canvas>` → PNG `Blob`
4. Restore window if it was hidden

```
getDisplayMedia (renderer)
    ↓
display-media-handler.ts (main) — routes to PipeWire / desktopCapturer picker
    ↓
grabPngFromStream — video.play() + waitForVideoFrame (event-driven, no timeouts)
    ↓
PNG Blob
```

### Hiding the app on full-screen capture

When the chosen source looks like a monitor (`displaySurface === 'monitor'`, or near-full-display heuristic for PipeWire), the tool calls:

- `window.screenRecorder.window.hide()` → `ipc/window-handlers.ts` waits for Electron `'hide'` event
- After grab: `window.screenRecorder.window.restore()` → waits for `'show'`, then Linux GNOME focus pin (`setAlwaysOnTop` trick)

Window capture (single window) skips hide/show.

## Clipboard copy — two paths (important)

Auto-copy after capture and the **Copy** button use **different strategies** on purpose:

| When              | Strategy                                                    | Why                                                                                              |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| After capture     | Main process first (`screenshot.copy`), renderer fallback   | User-gesture from the Capture click expires during the long async picker/hide/grab/restore chain |
| Copy button click | Renderer `navigator.clipboard` first, main process fallback | Fresh user gesture; renderer path is reliable on click                                           |

After capture, copy is deferred until the preview phase is shown and two `requestAnimationFrame` ticks pass (GNOME/Wayland focus settle).

Main-process copy: `src/main/screen-recorder/clipboard/copy-screenshot-to-clipboard.ts`

- Waits for window focus (up to 500 ms)
- Writes both `clipboard.writeBuffer('image/png', …)` and `clipboard.writeImage()` — needed on Wayland

## Main process / IPC

Reuses the **`window.screenRecorder`** preload namespace (same as Screen Recorder) even though this is a separate tool tab.

| `window.screenRecorder.*` | Handler / module                                                       | Used by Screen Capture    |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------- |
| `window.hide` / `restore` | `ipc/window-handlers.ts`                                               | Yes — full-screen capture |
| `screenshot.copy`         | `ipc/dialog-handlers.ts` → `clipboard/copy-screenshot-to-clipboard.ts` | Yes                       |
| `screenshot.save`         | `ipc/dialog-handlers.ts` (native save dialog → Pictures)               | Yes                       |
| `recording.*`             | Screen Recorder pipeline                                               | **No**                    |

App-wide notifications (not under `screenRecorder`):

| `window.api.*`     | Handler / module                                          |
| ------------------ | --------------------------------------------------------- |
| `showNotification` | `main/notification-handlers.ts` → Electron `Notification` |

Renderer helper: `src/renderer/src/lib/notify.ts` — `notifySuccess()` / `notifyError()` with title **CraftBox**.

IPC channels (`src/shared/ipc-channels.ts`): `screenshot:copy`, `screenshot:save`, `notification:show`, `window:hide`, `window:restore`.

## Shared global hooks (affects other tools)

Registered once in `src/main/index.ts`:

| Module                                | Scope                                      | Screen Capture usage                              |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| `security/display-media-handler.ts`   | Session-wide `getDisplayMedia`             | **Only this tool** calls `getDisplayMedia` today  |
| `security/content-security-policy.ts` | Whole app CSP                              | `img-src` includes `data:` for preview thumbnails |
| `ipc/window-handlers.ts`              | All tools using title bar / hide / restore | Hide/restore added for this tool                  |

Screen Recorder uses **`getUserMedia` + `chromeMediaSourceId`** (`capture-engine.ts`) — a completely separate capture path. Changes here should not affect recording unless they touch shared IPC or the global display-media handler.

## Differences from Screen Recorder

|                  | Screen Capture                            | Screen Recorder               |
| ---------------- | ----------------------------------------- | ----------------------------- |
| Source selection | OS system dialog                          | In-app `desktopCapturer` grid |
| Output           | Single PNG                                | Video (`MediaRecorder`)       |
| Hide window      | Yes, on monitor capture                   | No                            |
| Cursor in shot   | Whatever OS/PipeWire includes — no toggle | N/A (video stream)            |

## Intentionally not implemented / removed

Do not re-add without re-validating on Linux/Wayland:

- **`desktopCapturer` thumbnail capture** (`screenshot:capture` main-process PNG path) — removed; redundant with `getDisplayMedia` picker flow
- **`cursor: 'never'` on `getDisplayMedia`** — ignored on PipeWire; cursor toggle UI was scrapped
- **In-app source picker** — replaced by OS picker
- **Custom in-app toast** — replaced by native OS notifications

## Platform notes (Fedora / GNOME / Wayland)

- PipeWire portal handles picker; `display-media-handler.ts` short-circuits Wayland to avoid a redundant `getSources()` portal session
- Clipboard after capture requires main-process write + focus wait — do not rely on renderer `navigator.clipboard` alone immediately after capture
- `waitForVideoFrame` uses video events only — no arbitrary timeout wrappers

## Type-checking

```bash
npm run typecheck:web
npm run typecheck:node
npm run lint
npm run format
```

Touch main + renderer when changing IPC, clipboard, window handlers, or capture logic.
