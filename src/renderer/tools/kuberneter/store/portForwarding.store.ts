import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type PortForwardData } from '../types/PortForwardData';

interface PortForwardingState {
  portForwards: PortForwardData[];
  addPortForward: (entry: PortForwardData) => void;
  removePortForward: (id: string) => void;
  updatePortForwardStatus: (id: string, status: PortForwardData['status']) => void;
}

export const usePortForwardingStore = create<PortForwardingState>()(
  persist(
    (set) => ({
      portForwards: [],

      addPortForward: (entry) =>
        set((state) => ({
          portForwards: [...state.portForwards.filter((pf) => pf.id !== entry.id), entry]
        })),

      removePortForward: (id) =>
        set((state) => ({
          portForwards: state.portForwards.filter((pf) => pf.id !== id)
        })),

      updatePortForwardStatus: (id, status) =>
        set((state) => ({
          portForwards: state.portForwards.map((pf) => (pf.id === id ? { ...pf, status } : pf))
        }))
    }),
    {
      name: 'craftbox-port-forwarding-store'
    }
  )
);
