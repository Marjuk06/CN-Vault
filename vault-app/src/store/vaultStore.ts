import { create } from 'zustand';
import type { VaultEntry } from '@/lib/schema';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';


export type VaultStatus = 'uninitialized' | 'locked' | 'unlocked';

export interface AppSettings {
  autoLockMinutes: number;
  clipboardClearSeconds: number;
  hasSeenTour: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UserProfile {
  name: string;
  avatar: string;
}

interface VaultState {
  status: VaultStatus;
  settings: AppSettings;
  userProfile: UserProfile | null;

  entries: VaultEntry[];
  selectedEntryId: string | null;

  searchQuery: string;
  activeCategory: string;
  toasts: Toast[];
  clipboardCountdown: number | null; // seconds remaining, null when idle
  isNetworkActive: boolean; // true when fetching icons
  runTour: boolean;

  getFilteredEntries: () => VaultEntry[];
  getSelectedEntry: () => VaultEntry | null;

  fetchStatus: () => Promise<void>;
  fetchEntries: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  lockVault: () => Promise<void>;

  addEntry: (entry: VaultEntry) => Promise<void>;
  updateEntry: (entry: VaultEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  setSelectedEntryId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  setNetworkActive: (active: boolean) => void;

  copyToClipboard: (value: string) => Promise<void>;

  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  saveSetting: (key: string, value: string) => Promise<void>;
  startTour: () => void;
  finishTour: () => Promise<void>;
}


let clipboardTimerRef: ReturnType<typeof setInterval> | null = null;

export const useVaultStore = create<VaultState>((set, get) => ({
  status: 'uninitialized',
  settings: {
    autoLockMinutes: 5,
    clipboardClearSeconds: 30,
    hasSeenTour: false,
  },
  userProfile: null,
  entries: [],
  selectedEntryId: null,
  searchQuery: '',
  activeCategory: 'all',
  toasts: [],
  clipboardCountdown: null,
  isNetworkActive: false,
  runTour: false,

  // Derived

  getFilteredEntries: () => {
    const { entries, activeCategory, searchQuery } = get();
    let list = entries;

    // Category filter
    if (activeCategory === 'favorites') {
      list = list.filter((e) => e.isFavorite);
    } else if (activeCategory !== 'all' && activeCategory !== 'dashboard') {
      list = list.filter((e) => e.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.username?.toLowerCase().includes(q) ||
          e.url?.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q)
      );
    }

    return list;
  },

  getSelectedEntry: () => {
    const { entries, selectedEntryId } = get();
    if (!selectedEntryId) return null;
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  },

  fetchStatus: async () => {
    try {
      const status: { isInitialized: boolean; isUnlocked: boolean } =
        await invoke('get_vault_status');
      if (!status.isInitialized) {
        set({ status: 'uninitialized' });
      } else if (status.isUnlocked) {
        set({ status: 'unlocked' });
      } else {
        set({ status: 'locked' });
      }
    } catch (e) {
      console.error('fetchStatus error:', e);
    }
  },

  fetchEntries: async () => {
    try {
      const entries: VaultEntry[] = await invoke('get_entries');
      set({ entries });
      const { selectedEntryId } = get();
      if (selectedEntryId && !entries.find((e) => e.id === selectedEntryId)) {
        set({ selectedEntryId: entries[0]?.id ?? null });
      }
    } catch (e) {
      console.error('fetchEntries error:', e);
    }
  },

  fetchSettings: async () => {
    try {
      const settings = await invoke<AppSettings>('get_settings');
      set({ 
        settings,
        runTour: !settings.hasSeenTour 
      });
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  },

  fetchUserProfile: async () => {
    try {
      const userProfile = await invoke<UserProfile>('get_user_profile');
      set({ userProfile });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  },

  updateUserProfile: async (profile: UserProfile) => {
    try {
      await invoke('set_user_profile', { profile });
      set({ userProfile: profile });
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  },

  lockVault: async () => {
    try {
      await invoke('lock_vault');
    } catch (e) {
      console.error('lock_vault error:', e);
    }
    if (clipboardTimerRef) {
      clearInterval(clipboardTimerRef);
      clipboardTimerRef = null;
    }
    set({
      status: 'locked',
      entries: [],
      selectedEntryId: null,
      searchQuery: '',
      activeCategory: 'all',
      toasts: [],
      clipboardCountdown: null,
      runTour: false,
    });
  },

  addEntry: async (entry) => {
    await invoke('save_entry', { entry });
    set((state) => ({
      entries: [entry, ...state.entries],
      selectedEntryId: entry.id,
    }));
    get().addToast(`"${entry.title}" added`, 'success');
  },

  updateEntry: async (entry) => {
    await invoke('save_entry', { entry });
    set((state) => ({
      entries: state.entries.map((e) => (e.id === entry.id ? entry : e)),
    }));
    get().addToast(`"${entry.title}" updated`, 'success');
  },

  deleteEntry: async (id) => {
    const entry = get().entries.find((e) => e.id === id);
    await invoke('delete_entry', { id });
    const remaining = get().entries.filter((e) => e.id !== id);
    set({
      entries: remaining,
      selectedEntryId: remaining[0]?.id ?? null,
    });
    if (entry) get().addToast(`"${entry.title}" deleted`, 'info');
  },

  setSelectedEntryId: (id) => set({ selectedEntryId: id }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setActiveCategory: (category) =>
    set({ activeCategory: category, searchQuery: '', selectedEntryId: null }),

  setNetworkActive: (active) => set({ isNetworkActive: active }),

  copyToClipboard: async (value) => {
    try {
      await writeText(value);
    } catch (e) {
      console.error('Failed to copy to clipboard', e);
      return;
    }
    const { settings } = get();
    const duration = settings.clipboardClearSeconds;

    if (clipboardTimerRef) {
      clearInterval(clipboardTimerRef);
      clipboardTimerRef = null;
    }

    set({ clipboardCountdown: duration });

    let remaining = duration;
    clipboardTimerRef = setInterval(async () => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(clipboardTimerRef!);
        clipboardTimerRef = null;
        try {
          await writeText('');
        } catch (e) {
          console.warn('Could not clear clipboard', e);
        }
        set({ clipboardCountdown: null });
        get().addToast('Clipboard cleared', 'info');
      } else {
        set({ clipboardCountdown: remaining });
      }
    }, 1000);
  },

  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  saveSetting: async (key, value) => {
    await invoke('save_setting', { key, value });
    const settings = await invoke<AppSettings>('get_settings');
    set({ settings });
  },

  startTour: () => {
    set({ runTour: true });
  },

  finishTour: async () => {
    set({ runTour: false });
    await get().saveSetting('has_seen_tour', 'true');
  },
}));
