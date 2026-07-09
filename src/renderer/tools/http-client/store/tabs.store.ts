import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PostmanTabSeed } from '../types';

export interface PostmanTab {
  id: string;
  title: string;
  /** Seed data the tab was opened with (from sidebar history or a saved request), if any. */
  meta?: PostmanTabSeed;
}

interface PostmanTabsState {
  tabs: PostmanTab[];
  activeTabId: string | null;
  openTab: (tab: PostmanTab) => void;
  /** Convenience wrapper around `openTab` that generates a fresh request-tab id. Returns the new tab's id. */
  openNewRequestTab: (seed?: PostmanTabSeed, title?: string) => string;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  renameTab: (id: string, title: string) => void;
}

function makeTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return `postman-req-${crypto.randomUUID()}`;
  return `postman-req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Dedicated tab system for the HTTP Client tool's own request tabs and sidebar,
 * independent of the app's global tool-tab switcher (`ToolProvider`/`useToolTabs`,
 * which only tracks top-level tool tabs like "HTTP Client" itself).
 */
export const usePostmanTabsStore = create<PostmanTabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (tab) =>
        set((state) => {
          const exists = state.tabs.some((t) => t.id === tab.id);
          return {
            tabs: exists ? state.tabs : [...state.tabs, tab],
            activeTabId: tab.id
          };
        }),

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

          return { tabs, activeTabId };
        }),

      setActiveTabId: (id) => set({ activeTabId: id }),

      renameTab: (id, title) =>
        set((state) => ({ tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t)) }))
    }),
    {
      name: 'craftbox-http-client-tabs',
      partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId })
    }
  )
);
