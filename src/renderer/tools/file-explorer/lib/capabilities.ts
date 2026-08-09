export interface DriverCapabilities {
  trash: boolean;
  nativeIcons: boolean;
  atomicMove: boolean;
  realFolders: boolean;
  sync: 'watch' | 'optimistic' | 'sync';
  /** Driver can watch a directory for changes made outside the app and push events (e.g. `fs.watch`). */
  watchable: boolean;
}

// Mirrors LocalFileDriver.capabilities / R2FileDriver.capabilities in
// src/main/file-explorer/*. The renderer can't import main-process types
// directly, so this is a lightweight scheme sniff rather than an IPC round trip.
const LOCAL_CAPABILITIES: DriverCapabilities = {
  trash: true,
  nativeIcons: true,
  atomicMove: true,
  realFolders: true,
  sync: 'sync',
  watchable: true
};

const R2_CAPABILITIES: DriverCapabilities = {
  trash: false,
  nativeIcons: false,
  atomicMove: false,
  realFolders: false,
  sync: 'optimistic',
  watchable: false
};

export function getCapabilitiesForLocation(uri: string): DriverCapabilities {
  return uri.startsWith('r2://') ? R2_CAPABILITIES : LOCAL_CAPABILITIES;
}
