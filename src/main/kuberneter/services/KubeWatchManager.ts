import type { BrowserWindow } from 'electron';
import { KubeApiWatchService, type WatchOptions, type WatchEvent } from './KubeApiWatchService';

export type { WatchOptions, WatchEvent };

interface ActiveWatchItem {
  options: WatchOptions;
  abort?: () => void;
}

export class KubeWatchManager {
  private static activeWatches = new Map<string, ActiveWatchItem>();

  public static startWatch(id: string, options: WatchOptions, window?: BrowserWindow | null): void {
    this.stopWatch(id);

    const { abort } = KubeApiWatchService.startWatch(id, options, (event) => {
      console.log(`[KubeWatchManager] Event emitted: ${event.type} for ${event.resource}`);
      if (window && !window.isDestroyed()) {
        window.webContents.send('kuberneter:watch-event', event);
      }
    });

    this.activeWatches.set(id, { options, abort });
  }

  public static stopWatch(id: string): void {
    const existing = this.activeWatches.get(id);
    if (existing) {
      existing.abort?.();
      this.activeWatches.delete(id);
    }
  }

  public static stopAllWatches(): void {
    for (const id of this.activeWatches.keys()) {
      this.stopWatch(id);
    }
  }

  public static emitEvent(window: BrowserWindow | null, event: WatchEvent): void {
    if (window && !window.isDestroyed()) {
      window.webContents.send('kuberneter:watch-event', event);
    }
  }
}
