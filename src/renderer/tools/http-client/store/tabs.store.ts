import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RequestTabSeed } from '../types';
import { makeId } from '../lib/makeId';

export interface RequestTab {
  id: string;
  title: string;
  /** Seed data the tab was opened with (from sidebar history or a saved request), if any. */
  meta?: RequestTabSeed;
}

interface RequestTabsState {
  tabs: RequestTab[];
  activeTabId: string | null;
  /** The tab currently shown in italic "preview" style, if any -- see `openTab`'s `preview` option. */
  previewTabId: string | null;
  /**
   * Opens a tab. With `{ preview: true }` (single-click from the sidebar), the tab reuses
   * the existing preview slot instead of piling up a new permanent tab -- VS Code's
   * "preview tab" behavior. Returns the id of a preview tab that got replaced/evicted as a
   * result, if any, so the caller can dispose its cached request-engine state.
   */
  openTab: (tab: RequestTab, options?: { preview?: boolean }) => { replacedTabId: string | null };
  /** Convenience wrapper around `openTab` that generates a fresh request-tab id. Returns the new tab's id. */
  openNewRequestTab: (seed?: RequestTabSeed, title?: string) => string;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  /** Promotes a preview tab to a permanent one (no-op if `id` isn't the current preview tab). */
  pinTab: (id: string) => void;
}

function makeTabId(): string {
  return makeId('request');
}

/**
 * Dedicated tab system for the HTTP Client tool's own request tabs and sidebar,
 * independent of the app's global tool-tab switcher (`ToolProvider`/`useToolTabs`,
 * which only tracks top-level tool tabs like "HTTP Client" itself).
 */
export const useRequestTabsStore = create<RequestTabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      previewTabId: null,

      openTab: (tab, options) => {
        const preview = options?.preview ?? false;
        let replacedTabId: string | null = null;

        set((state) => {
          const existingIdx = state.tabs.findIndex((t) => t.id === tab.id);
          if (existingIdx !== -1) {
            // Already open (permanent or preview) -- just activate it. Re-opening it
            // permanently (e.g. via double-click) pins it if it was the preview tab.
            const previewTabId =
              !preview && state.previewTabId === tab.id ? null : state.previewTabId;
            return { activeTabId: tab.id, previewTabId };
          }

          if (!preview) {
            return { tabs: [...state.tabs, tab], activeTabId: tab.id };
          }

          // New preview tab: reuse the existing preview slot (same position) instead of
          // growing the tab bar, evicting whatever was previewed before.
          const previewIdx = state.tabs.findIndex((t) => t.id === state.previewTabId);
          if (previewIdx !== -1) {
            replacedTabId = state.previewTabId;
            const tabs = state.tabs.map((t, i) => (i === previewIdx ? tab : t));
            return { tabs, activeTabId: tab.id, previewTabId: tab.id };
          }

          return { tabs: [...state.tabs, tab], activeTabId: tab.id, previewTabId: tab.id };
        });

        return { replacedTabId };
      },

      openNewRequestTab: (seed, title = 'New API Request') => {
        const id = makeTabId();
        get().openTab({ id, title, meta: seed });
        return id;
      },

      closeTab: (id) =>
        set((state) => {
          const idx = state.tabs.findIndex((t) => t.id === id);
          if (idx === -1) return state;

          const tabs = state.tabs.filter((t) => t.id !== id);
          const activeTabId =
            state.activeTabId !== id
              ? state.activeTabId
              : (tabs[Math.min(idx, tabs.length - 1)]?.id ?? null);
          const previewTabId = state.previewTabId === id ? null : state.previewTabId;

          return { tabs, activeTabId, previewTabId };
        }),

      setActiveTabId: (id) => set({ activeTabId: id }),

      renameTab: (id, title) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
          previewTabId: state.previewTabId === id ? null : state.previewTabId
        })),

      pinTab: (id) => set((state) => (state.previewTabId === id ? { previewTabId: null } : state))
    }),
    {
      name: 'craftbox-http-client-tabs',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        previewTabId: state.previewTabId
      })
    }
  )
);
