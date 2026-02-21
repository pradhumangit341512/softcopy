import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface AppState {
  // UI State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  
  // Filters & Search
  clientSearchQuery: string;
  clientStatusFilter: string;
  clientInquiryFilter: string;
  
  // Pagination
  clientsPerPage: number;
  currentPage: number;
  
  // Modals
  isAddClientModalOpen: boolean;
  isDeleteConfirmOpen: boolean;
  deleteTargetId: string | null;
  
  // UI Preferences
  sideNotifications: boolean;
  autoRefresh: boolean;
  
  // Actions - UI
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Actions - Filters
  setClientSearchQuery: (query: string) => void;
  setClientStatusFilter: (status: string) => void;
  setClientInquiryFilter: (inquiry: string) => void;
  clearFilters: () => void;
  
  // Actions - Pagination
  setCurrentPage: (page: number) => void;
  setClientsPerPage: (count: number) => void;
  
  // Actions - Modals
  openAddClientModal: () => void;
  closeAddClientModal: () => void;
  openDeleteConfirm: (id: string) => void;
  closeDeleteConfirm: () => void;
  
  // Actions - Preferences
  toggleNotifications: () => void;
  toggleAutoRefresh: () => void;
  
  // Reset
  resetAppState: () => void;
}

const initialState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: 'light' as const,
  clientSearchQuery: '',
  clientStatusFilter: '',
  clientInquiryFilter: '',
  clientsPerPage: 20,
  currentPage: 1,
  isAddClientModalOpen: false,
  isDeleteConfirmOpen: false,
  deleteTargetId: null,
  sideNotifications: true,
  autoRefresh: true,
};

export const useAppStore = create<AppState>()(
  devtools((set) => ({
    ...initialState,

    // UI Actions
    toggleSidebar: () =>
      set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    toggleSidebarCollapse: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    setTheme: (theme) => {
      set({ theme });
      if (typeof document !== 'undefined') {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },

    // Filter Actions
    setClientSearchQuery: (query) =>
      set({ clientSearchQuery: query, currentPage: 1 }),

    setClientStatusFilter: (status) =>
      set({ clientStatusFilter: status, currentPage: 1 }),

    setClientInquiryFilter: (inquiry) =>
      set({ clientInquiryFilter: inquiry, currentPage: 1 }),

    clearFilters: () =>
      set({
        clientSearchQuery: '',
        clientStatusFilter: '',
        clientInquiryFilter: '',
        currentPage: 1,
      }),

    // Pagination Actions
    setCurrentPage: (page) => set({ currentPage: page }),

    setClientsPerPage: (count) =>
      set({ clientsPerPage: count, currentPage: 1 }),

    // Modal Actions
    openAddClientModal: () => set({ isAddClientModalOpen: true }),

    closeAddClientModal: () => set({ isAddClientModalOpen: false }),

    openDeleteConfirm: (id) =>
      set({ isDeleteConfirmOpen: true, deleteTargetId: id }),

    closeDeleteConfirm: () =>
      set({ isDeleteConfirmOpen: false, deleteTargetId: null }),

    // Preference Actions
    toggleNotifications: () =>
      set((state) => ({ sideNotifications: !state.sideNotifications })),

    toggleAutoRefresh: () =>
      set((state) => ({ autoRefresh: !state.autoRefresh })),

    // Reset
    resetAppState: () => set(initialState),
  }))
);