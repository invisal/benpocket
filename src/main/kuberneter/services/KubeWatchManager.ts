import type { BrowserWindow } from 'electron';
import type { ChildProcess } from 'child_process';
import { KubeCliWatchService, type WatchOptions, type WatchEvent } from './KubeCliWatchService';

export type { WatchOptions, WatchEvent };

interface ActiveWatchItem {
  options: WatchOptions;
  process?: ChildProcess;
}

export class KubeWatchManager {
  private static activeWatches = new Map<string, ActiveWatchItem>();

  public static startWatch(id: string, options: WatchOptions, window?: BrowserWindow | null): void {
    this.stopWatch(id);

    const child = KubeCliWatchService.startWatchProcess(id, options, (event) => {
      console.log(`[KubeWatchManager] Event emitted: ${event.type} for ${event.resource}`);
      if (window && !window.isDestroyed()) {
        window.webContents.send('kuberneter:watch-event', event);
      }
    });

    this.activeWatches.set(id, { options, process: child });
  }

  public static stopWatch(id: string): void {
    const existing = this.activeWatches.get(id);
    if (existing) {
      if (existing.process && !existing.process.killed) {
        try {
          existing.process.kill();
        } catch {
          // ignore kill error
        }
      }
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
