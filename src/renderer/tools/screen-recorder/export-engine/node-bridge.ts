/**
 * Every file in this directory runs inside the hidden, `nodeIntegration:
 * true` export window (see export-worker-window.ts) as part of a `<script
 * type="module">` page bundle. nodeIntegration only injects a global
 * `require` function -- it does NOT patch Chromium's native ES-module
 * resolver, so a real `import ... from 'electron'` (or 'execa', 'fs', etc.)
 * statement fails at runtime with "Failed to resolve module specifier"
 * even though it type-checks and builds fine (confirmed by actually running
 * the built app, not assumed). `require()` is the only thing that actually
 * resolves a Node/Electron built-in here.
 *
 * Centralized in this one file rather than repeating the `require(...) as
 * typeof import(...)` cast everywhere -- every other export-engine module
 * imports these normally from here instead of importing the built-ins
 * directly.
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports --
   the whole point of this file is the require() + `as typeof import(...)` pattern described above. */
export const { ipcRenderer } = require('electron') as typeof import('electron');

// execa calls Node's internal `events.setMaxListeners`/`addAbortListener` on
// every single spawn (unconditionally, not optional via any execa option --
// confirmed by reading execa's source), passing an `AbortSignal` it creates
// itself via a bare `new AbortController()`. In this window's dual
// Node+Chromium realm, that signal genuinely passes `instanceof EventTarget`
// against the *visible* global `EventTarget` -- but Node's internal
// `events.setMaxListeners`/`addAbortListener` validate against a private,
// bootstrap-time-captured EventTarget/EventEmitter reference that's a
// *different* object even though it looks identical, so the check fails
// every time with "must be an instance of EventEmitter or EventTarget" --
// this is an Electron nodeIntegration-renderer-specific incompatibility, not
// present in a plain Node process (confirmed: this exact code works
// unmodified in the Electron *main* process). Patched here, before execa
// (or anything else) is required, rather than in execa itself.

const nodeEvents = require('events') as typeof import('events');
const originalSetMaxListeners = nodeEvents.setMaxListeners;
nodeEvents.setMaxListeners = (...args: Parameters<typeof originalSetMaxListeners>) => {
  try {
    originalSetMaxListeners(...args);
  } catch {
    // Realm mismatch above -- harmless to skip: this only raises Node's max-
    // listeners warning threshold, it doesn't affect actual functionality.
  }
};
const originalAddAbortListener = nodeEvents.addAbortListener;
nodeEvents.addAbortListener = (signal: AbortSignal, listener: (event: Event) => void) => {
  try {
    return originalAddAbortListener(signal, listener);
  } catch {
    // Same realm mismatch -- fall back to the plain DOM AbortSignal API,
    // which works fine since `signal` really is a genuine EventTarget from
    // this window's own (Chromium) perspective.
    signal.addEventListener('abort', listener, { once: true });
    return {
      [Symbol.dispose ?? Symbol.for('dispose')]: () => signal.removeEventListener('abort', listener)
    };
  }
};

export const { execa } = require('execa') as typeof import('execa');
export const { promises: fsPromises } = require('fs') as typeof import('fs');
export const { dirname } = require('path') as typeof import('path');
export const { Transform } = require('stream') as typeof import('stream');
export type { TransformCallback } from 'stream';
export type { ResultPromise } from 'execa';

// ffmpeg-static/ffprobe-static are plain CJS packages (`module.exports =
// <value>`, no `.default` wrapper), so their actual `require()` shape is the
// raw value -- not the `{ default: ... }` shape `typeof import(...)` would
// suggest for a package typed with `export default`.
export const ffmpegStaticPath = require('ffmpeg-static') as string | null;
export const ffprobeStaticModule = require('ffprobe-static') as { path: string };
