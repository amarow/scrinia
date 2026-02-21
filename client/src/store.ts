import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types
import type { FileHandle, Tag, Scope, User, Share, PrivacyProfile, PrivacyRule, SearchCriteria } from './store/types';

// Slices
import { createAuthSlice } from './store/slices/auth.slice';
import type { AuthSlice } from './store/slices/auth.slice';
import { createFileSlice } from './store/slices/file.slice';
import type { FileSlice } from './store/slices/file.slice';
import { createTagSlice } from './store/slices/tag.slice';
import type { TagSlice } from './store/slices/tag.slice';
import { createScopeSlice } from './store/slices/scope.slice';
import type { ScopeSlice } from './store/slices/scope.slice';
import { createSearchSlice } from './store/slices/search.slice';
import type { SearchSlice } from './store/slices/search.slice';
import { createSettingsSlice } from './store/slices/settings.slice';
import type { SettingsSlice } from './store/slices/settings.slice';
import { createAppSlice } from './store/slices/app.slice';
import type { AppSlice } from './store/slices/app.slice';

// Re-export types for convenience
export type { FileHandle, Tag, Scope, User, Share, PrivacyProfile, PrivacyRule, SearchCriteria };

export type AppState = AuthSlice & FileSlice & TagSlice & ScopeSlice & SearchSlice & SettingsSlice & AppSlice;

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createFileSlice(...a),
      ...createTagSlice(...a),
      ...createScopeSlice(...a),
      ...createSearchSlice(...a),
      ...createSettingsSlice(...a),
      ...createAppSlice(...a),
    }),
    {
      name: 'scrinia-auth-storage-v2', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token,
        user: state.user,
        language: state.language
      }),
    }
  )
);
