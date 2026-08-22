/// <reference types="vite/client" />
import '../../preload/index.d.ts';

declare global {
  const __APP_VERSION__: string;

  interface Window {
    /** Only set when `window.api.isE2E` -- see ToolProvider.ts. Lets Playwright open/select
     * tool tabs directly instead of driving them through the UI (home screen clicks, context
     * menus, etc). Loosely typed since it spans every registered tool's payload shape. */
    devTools?: {
      openTab: (
        type: string,
        payload: unknown,
        options?: { title?: string; subtitle?: string }
      ) => string;
      selectTab: (id: string) => void;
      closeTab: (id: string) => void;
      getTabs: () => Array<{ id: string; type: string; title: string; subtitle?: string }>;
    };
  }
}
