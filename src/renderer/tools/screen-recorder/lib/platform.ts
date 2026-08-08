// Best-effort platform sniff for renderer-only UI decisions where the
// distinction is cosmetic (e.g. macOS's TCC screen-recording/mic permission
// gate has no Windows/Linux equivalent, so there's nothing to show there) --
// not for anything security-relevant. There's no IPC-exposed
// `process.platform` today; adding one just for UI copy would be overkill.
export const isLikelyMac = navigator.userAgent.includes('Mac');

/** Same caveat as isLikelyMac -- Windows 10+'s own global mic/camera Privacy toggle is a real gate Electron surfaces there (see permissions.ts's supportsMediaAccessStatus), unlike Screen Recording/Accessibility/Automation, which stay macOS-only. */
export const isLikelyWindows = navigator.userAgent.includes('Windows');
