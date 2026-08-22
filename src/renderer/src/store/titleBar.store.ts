import type { ReactNode } from 'react';
import { create } from 'zustand';

interface TitleBarState {
  content: ReactNode;
  setContent: (content: ReactNode) => void;
}

export const useTitleBarStore = create<TitleBarState>((set) => ({
  content: null,
  setContent: (content) => set({ content })
}));
