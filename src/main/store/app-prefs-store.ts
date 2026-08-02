import type { AppPrefs } from '@shared/app-prefs';
import { app } from 'electron';
import Store from 'electron-store';

export type { AppPrefs };

export const appPrefsStore = new Store<AppPrefs>({
  name: 'app-prefs',
  defaults: {
    startMinimizedToTray: false,
    launchAtLogin: false
  }
});

/** Syncs OS login-item registration with the current prefs. */
export function applyLoginItemSettings(prefs: AppPrefs = appPrefsStore.store): void {
  app.setLoginItemSettings({
    openAtLogin: prefs.launchAtLogin,
    openAsHidden: prefs.startMinimizedToTray
  });
}

export function getAppPrefs(): AppPrefs {
  return { ...appPrefsStore.store };
}

export function setAppPrefs(patch: Partial<AppPrefs>): AppPrefs {
  const next: AppPrefs = { ...appPrefsStore.store, ...patch };
  appPrefsStore.set(next);
  applyLoginItemSettings(next);
  return next;
}
