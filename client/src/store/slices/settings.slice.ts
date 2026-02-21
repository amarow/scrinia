import type { StateCreator } from 'zustand';
import type { Share, PrivacyProfile, PrivacyRule } from '../types';
import { API_BASE, authFetch } from '../utils';
import { notifications } from '@mantine/notifications';
import { translations } from '../../i18n';

export interface SettingsSlice {
  shares: Share[];
  privacyProfiles: PrivacyProfile[];
  editingRule: { 
    ruleId?: number, 
    profileId?: number, 
    isNew?: boolean,
    initialRules?: any[],
    initialName?: string
  } | null;
  isPrivacyModalOpen: boolean;
  privacyRefreshCounter: number;
  
  fetchShares: () => Promise<void>;
  generateShareKeyString: () => Promise<string | null>;
  createShare: (name: string, permissions?: string, tagIds?: number[], privacyProfileIds?: number[], key?: string) => Promise<Share | null>;
  updateShare: (id: number, updates: Partial<Pick<Share, 'name' | 'permissions' | 'tagIds' | 'privacyProfileIds' | 'cloudSync'>>) => Promise<void>;
  deleteShare: (id: number) => Promise<void>;
  syncShare: (id: number) => Promise<boolean>;

  fetchPrivacyProfiles: () => Promise<void>;
  createPrivacyProfile: (name: string, rules?: Omit<PrivacyRule, 'id' | 'profileId'>[]) => Promise<PrivacyProfile | null>;
  updatePrivacyProfile: (id: number, name: string, rules?: Omit<PrivacyRule, 'id' | 'profileId'>[]) => Promise<void>;
  deletePrivacyProfile: (id: number) => Promise<void>;
  fetchPrivacyRules: (profileId: number) => Promise<PrivacyRule[]>;
  addPrivacyRule: (profileId: number, rule: Omit<PrivacyRule, 'id' | 'profileId' | 'isActive'>) => Promise<void>;
  updatePrivacyRule: (id: number, updates: Partial<PrivacyRule>) => Promise<void>;
  deletePrivacyRule: (id: number) => Promise<void>;
  setEditingRule: (rule: { ruleId?: number, profileId?: number, isNew?: boolean, initialRules?: any[], initialName?: string } | null) => void;
  setIsPrivacyModalOpen: (open: boolean) => void;
  
  savePreferences: () => Promise<void>;
  init: () => Promise<void>;
}

export const createSettingsSlice: StateCreator<any, [], [], SettingsSlice> = (set, get) => ({
  shares: [],
  privacyProfiles: [],
  editingRule: null,
  isPrivacyModalOpen: false,
  privacyRefreshCounter: 0,

  fetchShares: async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/shares`, get().token);
      if (res.ok) {
        const data = await res.json();
        set({ shares: data });
      }
    } catch (e) {
      console.error("Failed to fetch shares", e);
    }
  },

  generateShareKeyString: async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/shares/generate`, get().token);
      if (res.ok) {
        const data = await res.json();
        return data.key;
      }
    } catch (e) {
      console.error("Failed to generate share key string", e);
    }
    return null;
  },

  createShare: async (name, permissions, tagIds, privacyProfileIds, key) => {
    set({ isLoading: true });
    try {
      const perms = Array.isArray(permissions) ? permissions.join(',') : permissions;
      const res = await authFetch(`${API_BASE}/api/shares`, get().token, {
        method: 'POST',
        body: JSON.stringify({ name, permissions: perms, tagIds, privacyProfileIds, key })
      });
      if (res.ok) {
        const newShare = await res.json();
        await get().fetchShares();
        set({ isLoading: false });
        return newShare;
      }
      set({ isLoading: false });
      return null;
    } catch (e) {
      set({ isLoading: false });
      console.error("Failed to create share", e);
      return null;
    }
  },

  deleteShare: async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/api/shares/${id}`, get().token, { method: 'DELETE' });
      if (res.ok) {
        await get().fetchShares();
        const lang = get().language as 'en' | 'de';
        notifications.show({
            title: translations[lang].delete,
            message: 'Share deleted',
            color: 'blue'
        });
      }
    } catch (e) {
      console.error("Failed to delete share", e);
    }
  },

  updateShare: async (id, updates) => {
    try {
      const payload: any = { ...updates };
      if (updates.permissions && Array.isArray(updates.permissions)) {
        payload.permissions = updates.permissions.join(',');
      }
      const res = await authFetch(`${API_BASE}/api/shares/${id}`, get().token, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      if (res.ok) await get().fetchShares();
    } catch (e) {
      console.error("Failed to update share", e);
    }
  },

  syncShare: async (id) => {
    set({ isLoading: true });
    try {
      const res = await authFetch(`${API_BASE}/api/shares/${id}/sync`, get().token, {
        method: 'POST'
      });
      set({ isLoading: false });
      if (res.ok) {
          await get().fetchShares();
          return true;
      }
      return false;
    } catch (e) {
      set({ isLoading: false });
      console.error("Failed to sync share", e);
      return false;
    }
  },

  fetchPrivacyProfiles: async () => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/profiles`, get().token);
      if (res.ok) {
        const data = await res.json();
        set({ privacyProfiles: data });
      }
    } catch (e) {
      console.error("Failed to fetch privacy profiles", e);
    }
  },

  createPrivacyProfile: async (name, rules) => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/profiles`, get().token, {
        method: 'POST',
        body: JSON.stringify({ name, rules })
      });
      if (res.ok) {
        const newProfile = await res.json();
        await get().fetchPrivacyProfiles();
        return newProfile;
      }
    } catch (e) {
      console.error("Failed to create privacy profile", e);
    }
    return null;
  },

  updatePrivacyProfile: async (id, name, rules) => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/profiles/${id}`, get().token, {
        method: 'PATCH',
        body: JSON.stringify({ name, rules })
      });
      if (res.ok) {
        await get().fetchPrivacyProfiles();
        await get().fetchShares(); 
      }
    } catch (e) {
      console.error("Failed to update privacy profile", e);
    }
  },

  deletePrivacyProfile: async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/profiles/${id}`, get().token, { method: 'DELETE' });
      if (res.ok) {
        await get().fetchPrivacyProfiles();
        await get().fetchShares();
        const lang = get().language as 'en' | 'de';
        notifications.show({
            title: translations[lang].delete,
            message: 'Ruleset deleted',
            color: 'blue'
        });
      }
    } catch (e) {
      console.error("Failed to delete privacy profile", e);
    }
  },

  fetchPrivacyRules: async (profileId) => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/profiles/${profileId}/rules`, get().token);
      if (res.ok) return await res.json();
    } catch (e) {
      console.error("Failed to fetch privacy rules", e);
    }
    return [];
  },

  addPrivacyRule: async (profileId, rule) => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/profiles/${profileId}/rules`, get().token, {
        method: 'POST',
        body: JSON.stringify(rule)
      });
      if (res.ok) {
          await get().fetchPrivacyProfiles();
          set((state: any) => ({ privacyRefreshCounter: state.privacyRefreshCounter + 1 }));
          const lang = get().language as 'en' | 'de';
          notifications.show({
              title: translations[lang].add,
              message: 'Rule added to ruleset',
              color: 'green'
          });
      }
    } catch (e) {
      console.error("Failed to add privacy rule", e);
    }
  },

  updatePrivacyRule: async (id, updates) => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/rules/${id}`, get().token, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
      if (res.ok) await get().fetchPrivacyProfiles();
    } catch (e) {
      console.error("Failed to update privacy rule", e);
    }
  },

  deletePrivacyRule: async (id) => {
    try {
      const res = await authFetch(`${API_BASE}/api/privacy/rules/${id}`, get().token, { method: 'DELETE' });
      if (res.ok) await get().fetchPrivacyProfiles(); 
    } catch (e) {
      console.error("Failed to delete privacy rule", e);
    }
  },

  setEditingRule: (editingRule) => {
    console.log('[Store] setEditingRule:', editingRule);
    set({ editingRule });
  },

  setIsPrivacyModalOpen: (isPrivacyModalOpen) => {
    console.log('[Store] setIsPrivacyModalOpen:', isPrivacyModalOpen);
    set({ isPrivacyModalOpen });
  },

  savePreferences: async () => {
    const state = get();
    if (!state.token) return;
    const prefs = {
      activeScopeIds: state.activeScopeIds,
      selectedTagIds: state.selectedTagIds,
      searchCriteria: state.searchCriteria
    };
    try {
        await authFetch(`${API_BASE}/api/preferences`, state.token, {
            method: 'POST',
            body: JSON.stringify(prefs)
        });
    } catch (e) {
        console.error("Failed to save preferences", e);
    }
  },

  init: async () => {
    const { token } = get();
    if (!token) return;

    try {
        const res = await authFetch(`${API_BASE}/api/preferences`, token);
        const prefs = await res.json();
        if (prefs) {
            let criteria = { 
                filename: '', 
                content: '', 
                directory: '',
                enabled: true 
            };
            
            if (prefs.searchQuery && typeof prefs.searchQuery === 'string') {
                criteria.filename = prefs.searchQuery;
            } else if (prefs.searchCriteria) {
                criteria = { ...criteria, ...prefs.searchCriteria };
                // Ensure enabled is true if not present in saved prefs
                if (criteria.enabled === undefined) criteria.enabled = true;
            }

            set({ 
                activeScopeIds: prefs.activeScopeIds || [],
                selectedTagIds: prefs.selectedTagIds || (prefs.selectedTagId ? [prefs.selectedTagId] : []),
                searchCriteria: criteria
            });
        }
    } catch (e) {
        if ((e as Error).message === "Unauthorized") get().logout();
        return;
    }

    await Promise.all([
        get().fetchFiles(),
        get().fetchScopes(),
        get().fetchTags(),
        get().fetchShares(),
        get().fetchPrivacyProfiles()
    ]);
  },
});
