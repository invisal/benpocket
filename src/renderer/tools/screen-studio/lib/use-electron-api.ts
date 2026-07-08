// Thin convenience hook re-exporting the preload-exposed API under a typed name.
export function useElectronApi(): Window['screenStudio'] {
  return window.screenStudio;
}
