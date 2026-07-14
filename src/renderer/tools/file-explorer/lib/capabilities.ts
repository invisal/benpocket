export interface DriverCapabilities {
  trash: boolean;
  nativeIcons: boolean;
  atomicMove: boolean;
  realFolders: boolean;
  sync: 'watch' | 'optimistic' | 'sync';
}

// Mirrors LocalFileDriver.capabilities / R2FileDriver.capabilities in
// src/main/file-explorer/*. The renderer can't import main-process types
// directly, so this is a lightweight scheme sniff rather than an IPC round trip.
const LOCAL_CAPABILITIES: DriverCapabilities = {
  trash: true,
  nativeIcons: true,
  atomicMove: true,
  realFolders: true,
  sync: 'sync'
};

const R2_CAPABILITIES: DriverCapabilities = {
  trash: false,
  nativeIcons: false,
  atomicMove: false,
  realFolders: false,
  sync: 'optimistic'
};

export function getCapabilitiesForLocation(uri: string): DriverCapabilities {
  return uri.startsWith('r2://') ? R2_CAPABILITIES : LOCAL_CAPABILITIES;
}
