# Screen Recorder

Record a screen, a single window, or a dragged region; edit the result on a
clip timeline; export to video or GIF. One of Benpocket's tools, running in
the same shared app window as the others.

## Recording

**Capture target:** a whole screen, a single window, or (screen sources
only) a dragged sub-region.

**Capture backend is native per platform**, falling back to the browser's
own `getUserMedia`/`MediaRecorder` when the native helper isn't available
(no binary, permission denied, a region was selected, or an OS picker
stream was already opened):

- **macOS** — a native helper built on **ScreenCaptureKit** (macOS 13+).
- **Windows** — a native helper built on **Windows Graphics Capture**, system
  audio via **WASAPI loopback**, webcam via **DirectShow**, encoding via
  **Media Foundation**.
- **Linux** — a native helper built on **X11 + MIT-SHM**, shelling out to
  `ffmpeg` for encoding and **PulseAudio** for audio. This path hasn't been
  verified on real Linux hardware yet — treat it as experimental.

Only the native path supports pause/resume and hides the OS cursor from the
capture. The browser fallback records whatever the OS's own picker shows,
cursor included.

**Audio:** microphone and system audio are independent toggles. System audio
through the browser fallback path is unreliable on macOS without a virtual
audio driver installed — it typically records silence there. Recorded
cursor/click position tracking (used for the editor's cursor styling and
auto-zoom camera-follow) is unavailable on Linux.

**Permissions:** macOS surfaces its own Screen Recording / Microphone /
Camera / Accessibility permission state (re-checked at the next app
relaunch after a change). Windows checks its own Privacy toggle for
mic/camera. Linux has no equivalent gate.

## Editing

Every recording opens into a clip-timeline editor:

- **Cut/trim/reorder** clips on the timeline; speed and per-clip audio
  volume/mute.
- **Background** — wallpaper, color, gradient, or image behind the
  recording, with padding, corner radius, and drop shadow — or turned off
  entirely, in which case the recording fills the frame at its own aspect
  ratio instead of a padded canvas.
- **Cursor** — style/size the pointer overlay; recorded movement is smoothed
  before rendering (not available for imported footage or on Linux, which
  never has a recorded cursor path).
- **Webcam** picture-in-picture — shape, position, size — when a webcam was
  recorded alongside the screen.
- **Zoom** — keyframed camera push-ins, either a fixed point or auto-follow
  that tracks the recorded cursor.
- **Annotations** — text, arrows, and images placed on the timeline.
- **Blur / Mask** — blur or solid-color regions over sensitive content,
  timed like any other overlay.
- **Crop** the recording to a sub-rectangle of the source.
- **Captions** — manual segments (add/edit/retime) today; automatic
  on-device transcription is not yet available.

## Export

Presets output **MP4** (Web/Social/Email), **MOV** (4K master), or **GIF**.
H.264 is always available; H.265 is offered too, except on Linux, where it
falls back to H.264 — Chromium has no software HEVC encoder, and Linux
hardware encoder support is inconsistent enough that H.264 is the only
codec guaranteed to actually export there.
