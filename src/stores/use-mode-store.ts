import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserMode = 'CONSUMER' | 'B2B';

interface ModeStore {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  toggleMode: () => void;
}

export const useModeStore = create<ModeStore>()(
  persist(
    (set) => ({
      mode: 'CONSUMER',
      setMode: (mode: UserMode) => set({ mode }),
      toggleMode: () => set((state) => ({ mode: state.mode === 'CONSUMER' ? 'B2B' : 'CONSUMER' })),
    }),
    {
      name: 'freshminut-mode-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
