import * as fs from 'fs';
import { type WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';

interface WatchEntry {
  watcher: fs.FSWatcher;
  senders: Set<WebContents>;
}

// One fs.watch per directory, shared across every panel/window currently
// looking at it, rather than one per subscriber.
const watches = new Map<string, WatchEntry>();
// Tracks which senders already have a cleanup listener, so a closed window/tab
// can't leak a watcher whose subscriber never explicitly called unwatchDirectory.
const sendersWithCleanup = new WeakSet<WebContents>();

function stopEntry(uri: string, entry: WatchEntry): void {
  entry.watcher.close();
  watches.delete(uri);
}

export function watchDirectory(uri: string, sender: WebContents): void {
  let entry = watches.get(uri);
  if (!entry) {
    let fsWatcher: fs.FSWatcher;
    try {
      fsWatcher = fs.watch(uri, { persistent: false });
    } catch {
      // Path doesn't exist, isn't a directory, or isn't watchable -- no-op.
      return;
    }
    entry = { watcher: fsWatcher, senders: new Set() };
    watches.set(uri, entry);

    fsWatcher.on('change', () => {
      const current = watches.get(uri);
      if (!current) return;
      for (const watchingSender of current.senders) {
        if (!watchingSender.isDestroyed()) {
          watchingSender.send(IpcChannels.FileExplorerWatchEvent, uri);
        }
      }
    });
    // An unhandled 'error' event would throw and crash the main process --
    // e.g. the watched directory itself gets deleted out from under us.
    fsWatcher.on('error', () => {
      const current = watches.get(uri);
      if (current) stopEntry(uri, current);
    });
  }

  entry.senders.add(sender);

  if (!sendersWithCleanup.has(sender)) {
    sendersWithCleanup.add(sender);
    sender.once('destroyed', () => {
      for (const [watchedUri, watchEntry] of watches) {
        watchEntry.senders.delete(sender);
        if (watchEntry.senders.size === 0) stopEntry(watchedUri, watchEntry);
      }
    });
  }
}

export function unwatchDirectory(uri: string, sender: WebContents): void {
  const entry = watches.get(uri);
  if (!entry) return;
  entry.senders.delete(sender);
  if (entry.senders.size === 0) {
    stopEntry(uri, entry);
  }
}
