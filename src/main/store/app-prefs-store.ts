import type { AppPrefs } from '@shared/app-prefs';
import Store from 'electron-store';

export type { AppPrefs };

export const appPrefsStore = new Store<AppPrefs>({
  name: 'app-prefs',
  defaults: {
    startMinimizedToTray: false
  }
});

export function getAppPrefs(): AppPrefs {
  return { ...appPrefsStore.store };
}

export function setAppPrefs(patch: Partial<AppPrefs>): AppPrefs {
  const next: AppPrefs = { ...appPrefsStore.store, ...patch };
  appPrefsStore.set(next);
  return next;
}
