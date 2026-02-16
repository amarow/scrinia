import type { StateCreator } from 'zustand';

export interface AppSlice {
  activeMainTab: 'filter' | 'data';
  lastDataPath: string;
  setActiveMainTab: (tab: 'filter' | 'data') => void;
  setLastDataPath: (path: string) => void;
}

export const createAppSlice: StateCreator<any, [], [], AppSlice> = (set) => ({
  activeMainTab: 'filter',
  lastDataPath: '/data',
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),
  setLastDataPath: (path) => set({ lastDataPath: path }),
});
