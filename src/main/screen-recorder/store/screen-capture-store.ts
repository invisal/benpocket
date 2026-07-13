import Store from 'electron-store';

interface ScreenCaptureSchema {
  lastSaveDir: string | null;
}

export const screenCaptureStore = new Store<ScreenCaptureSchema>({
  defaults: { lastSaveDir: null }
});

export function getLastScreenshotSaveDir(): string | null {
  return screenCaptureStore.get('lastSaveDir');
}

export function setLastScreenshotSaveDir(dir: string): void {
  screenCaptureStore.set('lastSaveDir', dir);
}
