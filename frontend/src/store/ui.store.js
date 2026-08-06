import { create } from 'zustand';

/**
 * @store useUIStore
 * @description Global UI state (sidebar, modals, theme).
 */
export const useUIStore = create((set) => ({
  // Sidebar
  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebar:    (value) => set({ isSidebarOpen: value }),

  // Modals
  activeModal:   null,
  modalData:     null,
  openModal:     (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal:    () => set({ activeModal: null, modalData: null }),

  // Global loading
  isGlobalLoading: false,
  setGlobalLoading: (value) => set({ isGlobalLoading: value }),
}));