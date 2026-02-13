import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { notifications } from '@mantine/notifications';
import { translations } from './i18n';

interface FileHandle {
  id: number;
  scopeId: number;
  path: string;
  name: string;
  extension: string;
  size: number;
  mimeType: string | null;
  updatedAt: string;
  tags: Tag[];
}

interface Tag {
  id: number;
  name: string;
  color: string | null;
  isEditable?: boolean; // Optional because legacy data might not have it immediately
  _count?: {
    files: number;
  };
}

interface Scope {
  id: number;
  path: string;
  name: string;
}

interface User {
  id: number;
  username: string;
}

interface ApiKey {

  id: number;

  name: string;

  key?: string;

  permissions: string[];

  privacyProfileId: number | null;

  privacyProfileName?: string;

  createdAt: string;

  lastUsedAt: string | null;

}





interface PrivacyProfile {

  id: number;

  name: string;

  ruleCount: number;

}



interface PrivacyRule {

  id: number;

  profileId: number;

  type: 'LITERAL' | 'REGEX';

  pattern: string;

  replacement: string;

  isActive: boolean;

}



interface AppState {

  // Auth

  token: string | null;

  user: User | null;

  isAuthenticated: boolean;

  apiKeys: ApiKey[];

  privacyProfiles: PrivacyProfile[];



  // Data

  files: FileHandle[];

  scopes: Scope[];

  tags: Tag[];

  isLoading: boolean;

  error: string | null;

  

  // Filter State

  activeScopeIds: number[];

  selectedTagIds: number[];

  searchCriteria: {

      filename: string;

      content: string;

      directory: string;

  };

  searchResults: FileHandle[];

  isSearching: boolean;

  previewFileId: number | null;

  

  // UI State

  language: 'en' | 'de';



  // Selection State (for Checkboxes)

  selectedFileIds: number[];



  // Auth Actions

  login: (username: string, password: string) => Promise<void>;

  register: (username: string, password: string) => Promise<void>;

  changePassword: (current: string, newP: string) => Promise<void>;

  logout: () => void;

  toggleLanguage: () => void;

  

    // API Key Actions

  

    fetchApiKeys: () => Promise<void>;

  

    createApiKey: (name: string, permissions?: string, privacyProfileId?: number) => Promise<ApiKey | null>;

  

    updateApiKey: (id: number, updates: Partial<Pick<ApiKey, 'name' | 'permissions' | 'privacyProfileId'>>) => Promise<void>;

  

    deleteApiKey: (id: number) => Promise<void>;

  

  



    // Privacy Actions

  

  



      fetchPrivacyProfiles: () => Promise<void>;

  

  



      createPrivacyProfile: (name: string) => Promise<PrivacyProfile | null>;

  

  



      updatePrivacyProfile: (id: number, name: string) => Promise<void>;

  

  



  

    deletePrivacyProfile: (id: number) => Promise<void>;

  

  fetchPrivacyRules: (profileId: number) => Promise<PrivacyRule[]>;

  addPrivacyRule: (profileId: number, rule: Omit<PrivacyRule, 'id' | 'profileId' | 'isActive'>) => Promise<void>;

  deletePrivacyRule: (id: number, profileId: number) => Promise<void>;

  togglePrivacyRule: (id: number, isActive: boolean, profileId: number) => Promise<void>;



  // Data Actions


  init: () => Promise<void>;
  fetchFiles: () => Promise<void>;
  fetchScopes: () => Promise<void>;
  fetchTags: () => Promise<void>;
  
  addScope: (path: string) => Promise<void>;
  deleteScope: (id: number) => Promise<void>;
  refreshScope: (id: number) => Promise<void>;
  refreshAllScopes: () => Promise<void>;
  
  addTagToFile: (fileId: number, tagName: string) => Promise<void>;
  addTagToMultipleFiles: (fileIds: number[], tagName: string) => Promise<void>;
  removeTagFromFile: (fileId: number, tagId: number) => Promise<void>;
  removeTagFromMultipleFiles: (fileIds: number[], tagId: number) => Promise<void>;
  
  createTag: (name: string, color?: string) => Promise<void>;
  updateTag: (id: number, updates: { name?: string; color?: string }) => Promise<void>;
  deleteTag: (id: number) => Promise<void>;
  openFile: (fileId: number) => Promise<void>;
  setPreviewFileId: (id: number | null) => void;
  
  // Filter Actions
  toggleScopeActive: (id: number) => void;
  toggleTagFilter: (id: number) => void;
  selectSingleTag: (id: number) => void;
  clearTagFilters: () => void;
  
  setSearchCriteria: (criteria: Partial<{ filename: string; content: string; directory: string }>) => void;
  performSearch: () => Promise<void>;
  clearSearch: () => void;

  // Selection Actions
  toggleFileSelection: (fileId: number) => void;
  setFileSelection: (fileIds: number[]) => void;
  clearFileSelection: () => void;
}

const API_BASE = 'http://localhost:3001';

// Debounce timer for search
let searchTimeout: any = null;

// Helper for authorized fetch
const authFetch = async (url: string, token: string | null, options: RequestInit = {}) => {
  if (!token) throw new Error("No token");
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
      throw new Error("Unauthorized");
  }
  return response;
};

// Helper to save prefs
const savePreferences = async (state: AppState) => {
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
};

export const useAppStore = create<AppState>()(
  persist(
        (set, get) => ({
          token: null,
          user: null,
          isAuthenticated: false,
          apiKeys: [],
          privacyProfiles: [],
    
          files: [],
          scopes: [],
          tags: [],
          isLoading: false,
          error: null,
          
          activeScopeIds: [],
          selectedTagIds: [],
          searchCriteria: { filename: '', content: '', directory: '' },
          searchResults: [],
          isSearching: false,
          previewFileId: null,
          
          language: 'en',
    
          selectedFileIds: [],
    
          setPreviewFileId: (id) => set({ previewFileId: id }),
    
          toggleLanguage: () => {
              set((state) => ({ language: state.language === 'en' ? 'de' : 'en' }));
          },
    
          login: async (username, password) => {
              set({ isLoading: true, error: null });
              try {
                  const res = await fetch(`${API_BASE}/api/login`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username, password })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Login failed');
                  
                  set({ token: data.token, user: data.user, isAuthenticated: true, isLoading: false });
                  await get().init();
              } catch (e: any) {
                  set({ error: e.message, isLoading: false });
              }
          },
    
          register: async (username, password) => {
              set({ isLoading: true, error: null });
              try {
                  const res = await fetch(`${API_BASE}/api/register`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username, password })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Registration failed');
                  set({ isLoading: false, error: null });
                  notifications.show({
                      title: translations[get().language].registerSuccess,
                      message: '',
                      color: 'green'
                  });
              } catch (e: any) {
                  set({ error: e.message, isLoading: false });
              }
          },
    
          changePassword: async (current, newP) => {
              set({ isLoading: true, error: null });
              try {
                  const res = await authFetch(`${API_BASE}/api/user/password`, get().token, {
                      method: 'POST',
                      body: JSON.stringify({ currentPassword: current, newPassword: newP })
                  });
                  if (!res.ok) {
                      const data = await res.json();
                      throw new Error(data.error || 'Password change failed');
                  }
                  set({ isLoading: false, error: null });
                  notifications.show({
                      title: translations[get().language].update || 'Updated',
                      message: translations[get().language].password || 'Password changed',
                      color: 'green'
                  });
              } catch (e: any) {
                  set({ error: e.message, isLoading: false });
                  throw e;
              }
          },
    
          logout: () => {
              set({ token: null, user: null, isAuthenticated: false, files: [], scopes: [], tags: [], selectedFileIds: [], apiKeys: [], privacyProfiles: [] });
          },
    
          fetchApiKeys: async () => {
            try {
              const res = await authFetch(`${API_BASE}/api/keys`, get().token);
              if (res.ok) {
                const data = await res.json();
                set({ apiKeys: data });
              }
            } catch (e) {
              console.error("Failed to fetch api keys", e);
            }
          },
    
          createApiKey: async (name, permissions, privacyProfileId) => {
            set({ isLoading: true });
            try {
              const res = await authFetch(`${API_BASE}/api/keys`, get().token, {
                method: 'POST',
                body: JSON.stringify({ name, permissions, privacyProfileId })
              });
              if (res.ok) {
                const newKey = await res.json();
                await get().fetchApiKeys();
                set({ isLoading: false });
                return newKey;
              }
              set({ isLoading: false });
              return null;
            } catch (e) {
              set({ isLoading: false });
              console.error("Failed to create api key", e);
              return null;
            }
          },
    
                deleteApiKey: async (id) => {
                  try {
                    const res = await authFetch(`${API_BASE}/api/keys/${id}`, get().token, {
                      method: 'DELETE'
                    });
                    if (res.ok) {
                      await get().fetchApiKeys();
                    }
                  } catch (e) {
                    console.error("Failed to delete api key", e);
                  }
                },
          
                updateApiKey: async (id, updates) => {
                  try {
                    const payload: any = { ...updates };
                    if (updates.permissions) {
                       payload.permissions = (updates.permissions as any).join(',');
                    }
                    const res = await authFetch(`${API_BASE}/api/keys/${id}`, get().token, {
                      method: 'PATCH',
                      body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                      await get().fetchApiKeys();
                    }
                  } catch (e) {
                    console.error("Failed to update api key", e);
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
    
                createPrivacyProfile: async (name) => {
                  try {
                    const res = await authFetch(`${API_BASE}/api/privacy/profiles`, get().token, {
                      method: 'POST',
                      body: JSON.stringify({ name })
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
          
                updatePrivacyProfile: async (id, name) => {
                  try {
                    const res = await authFetch(`${API_BASE}/api/privacy/profiles/${id}`, get().token, {
                      method: 'PATCH',
                      body: JSON.stringify({ name })
                    });
                    if (res.ok) {
                      await get().fetchPrivacyProfiles();
                      await get().fetchApiKeys(); // Names might be cached in key list
                    }
                  } catch (e) {
                    console.error("Failed to update privacy profile", e);
                  }
                },
                    deletePrivacyProfile: async (id) => {
            try {
              const res = await authFetch(`${API_BASE}/api/privacy/profiles/${id}`, get().token, {
                method: 'DELETE'
              });
              if (res.ok) {
                await get().fetchPrivacyProfiles();
                await get().fetchApiKeys(); // Profiles might be unlinked from keys
              }
            } catch (e) {
              console.error("Failed to delete privacy profile", e);
            }
          },
    
          fetchPrivacyRules: async (profileId) => {
            try {
              const res = await authFetch(`${API_BASE}/api/privacy/profiles/${profileId}/rules`, get().token);
              if (res.ok) {
                return await res.json();
              }
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
                await get().fetchPrivacyProfiles(); // Refresh rule counts
              }
            } catch (e) {
              console.error("Failed to add privacy rule", e);
            }
          },
    
          deletePrivacyRule: async (id, profileId) => {
            try {
              const res = await authFetch(`${API_BASE}/api/privacy/rules/${id}`, get().token, {
                method: 'DELETE'
              });
              if (res.ok) {
                await get().fetchPrivacyProfiles(); // Refresh rule counts
              }
            } catch (e) {
              console.error("Failed to delete privacy rule", e);
            }
          },
    
          togglePrivacyRule: async (id, isActive, profileId) => {
            try {
              const res = await authFetch(`${API_BASE}/api/privacy/rules/${id}/toggle`, get().token, {
                method: 'PATCH',
                body: JSON.stringify({ isActive })
              });
            } catch (e) {
              console.error("Failed to toggle privacy rule", e);
            }
          },
    
          init: async () => {
            const { token } = get();
            if (!token) return;
    
            try {
                const res = await authFetch(`${API_BASE}/api/preferences`, token);
                const prefs = await res.json();
                if (prefs) {
                    // Handle legacy prefs migration if needed
                    let criteria = { filename: '', content: '', directory: '' };
                    if (prefs.searchQuery && typeof prefs.searchQuery === 'string') {
                        criteria.filename = prefs.searchQuery;
                    } else if (prefs.searchCriteria) {
                        criteria = { ...criteria, ...prefs.searchCriteria };
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
                get().fetchApiKeys(),
                get().fetchPrivacyProfiles()
            ]);
          },
          toggleScopeActive: (id) => {
          const { activeScopeIds } = get();
          if (activeScopeIds.includes(id)) {
              set({ activeScopeIds: activeScopeIds.filter(sid => sid !== id) });
          } else {
              set({ activeScopeIds: [...activeScopeIds, id] });
          }
          savePreferences(get());
      },
      
      toggleTagFilter: (id) => {
          const { selectedTagIds } = get();
          if (selectedTagIds.includes(id)) {
              set({ selectedTagIds: selectedTagIds.filter(tid => tid !== id) });
          } else {
              set({ selectedTagIds: [...selectedTagIds, id] });
          }
          savePreferences(get());
      },

      selectSingleTag: (id) => {
          set({ selectedTagIds: [id] });
          savePreferences(get());
      },

      clearTagFilters: () => {
          set({ selectedTagIds: [] });
          savePreferences(get());
      },

      setSearchCriteria: (updates) => {
          const newCriteria = { ...get().searchCriteria, ...updates };
          set({ searchCriteria: newCriteria });
          savePreferences(get());

          if (searchTimeout) clearTimeout(searchTimeout);

          // Auto-trigger if criteria is substantial
          const hasInput = (newCriteria.filename.length >= 3) || 
                           (newCriteria.content.length >= 3) || 
                           (newCriteria.directory.length >= 3);
          
          // Or if we cleared inputs (to reset search)
          const isEmpty = !newCriteria.filename && !newCriteria.content && !newCriteria.directory;

          if (hasInput || isEmpty) {
              searchTimeout = setTimeout(() => {
                  get().performSearch();
              }, 500);
          }
      },
      
      clearSearch: () => {
          set({ 
              searchCriteria: { filename: '', content: '', directory: '' }, 
              searchResults: [],
              isSearching: false 
          });
          savePreferences(get());
      },

      performSearch: async () => {
          if (searchTimeout) clearTimeout(searchTimeout);
          
          const { token, searchCriteria } = get();
          const { filename, content, directory } = searchCriteria;

          if (!filename.trim() && !content.trim() && !directory.trim()) {
              set({ searchResults: [], isSearching: false });
              return;
          }
          
          set({ isSearching: true, error: null });
          try {
              const params = new URLSearchParams();
              if (filename) params.append('filename', filename);
              if (content) params.append('content', content);
              if (directory) params.append('directory', directory);

              const res = await authFetch(`${API_BASE}/api/search?${params.toString()}`, token);
              if (res.ok) {
                  const data = await res.json();
                  set({ searchResults: data, isSearching: false });
              } else {
                  throw new Error("Search failed");
              }
          } catch (e: any) {
              set({ isSearching: false, error: e.message });
          }
      },

      toggleFileSelection: (fileId) => {
          const { selectedFileIds } = get();
          if (selectedFileIds.includes(fileId)) {
              set({ selectedFileIds: selectedFileIds.filter(id => id !== fileId) });
          } else {
              set({ selectedFileIds: [...selectedFileIds, fileId] });
          }
      },

      setFileSelection: (fileIds) => {
          set({ selectedFileIds: fileIds });
      },

      clearFileSelection: () => {
          set({ selectedFileIds: [] });
      },

      fetchFiles: async () => {
        set({ isLoading: true });
        try {
          const response = await authFetch(`${API_BASE}/api/files`, get().token);
          const data = await response.json();
          set({ files: data, isLoading: false });
        } catch (error) {
           set({ isLoading: false });
        }
      },

      fetchScopes: async () => {
        try {
          const response = await authFetch(`${API_BASE}/api/scopes`, get().token);
          const data = await response.json();
          set({ scopes: data });
        } catch (error) {}
      },

      fetchTags: async () => {
        try {
          const response = await authFetch(`${API_BASE}/api/tags`, get().token);
          const data = await response.json();
          set({ tags: data });
        } catch (error) {}
      },

      addScope: async (path: string) => {
        set({ isLoading: true });
        try {
          const response = await authFetch(`${API_BASE}/api/scopes`, get().token, {
            method: 'POST',
            body: JSON.stringify({ path }),
          });
          if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || 'Failed to add scope');
          }
          await get().fetchScopes();
          await get().fetchFiles();
          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      deleteScope: async (id: number) => {
        set({ isLoading: true });
        try {
          const response = await authFetch(`${API_BASE}/api/scopes/${id}`, get().token, {
            method: 'DELETE'
          });
          if (!response.ok) {
              throw new Error('Failed to delete scope');
          }
          const { activeScopeIds } = get();
          if (activeScopeIds.includes(id)) {
             set({ activeScopeIds: activeScopeIds.filter(sid => sid !== id) });
             savePreferences(get());
          }
          await get().fetchScopes();
          await get().fetchFiles();
          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      refreshScope: async (id: number) => {
        set({ isLoading: true });
        try {
          const response = await authFetch(`${API_BASE}/api/scopes/${id}/refresh`, get().token, {
            method: 'POST'
          });
          if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || 'Failed to refresh scope');
          }
          await get().fetchFiles();
          await get().fetchTags(); // Update tag counts
          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      refreshAllScopes: async () => {
          const { activeScopeIds, refreshScope, fetchTags } = get();
          // Trigger refresh for all active scopes
          // We do this in parallel but without waiting for completion to keep UI responsive
          // (refreshScope is already optimistic/background on server side mostly)
          for (const id of activeScopeIds) {
              await refreshScope(id);
          }
          // After requesting refreshes, fetch tags to update counts (in case of manual changes or previous scans finishing)
          await fetchTags();
      },

      createTag: async (name: string, color?: string) => {
        try {
          const response = await authFetch(`${API_BASE}/api/tags`, get().token, {
            method: 'POST',
            body: JSON.stringify({ name, color }),
          });
          if (response.ok) {
            await get().fetchTags();
          }
        } catch (error) {
          console.error('Failed to create tag', error);
        }
      },

      updateTag: async (id: number, updates: { name?: string; color?: string }) => {
        // Optimistic Update
        const { tags, files } = get();
        
        // 1. Update Tag List locally
        const newTags = tags.map(t => t.id === id ? { ...t, ...updates } : t);
        set({ tags: newTags });

        // 2. Update Files locally (propagate tag change to all files having this tag)
        // This makes the color change visible instantly on the file list
        const newFiles = files.map(f => ({
            ...f,
            tags: f.tags.map(t => t.id === id ? { ...t, ...updates } : t)
        }));
        set({ files: newFiles });

        try {
          const response = await authFetch(`${API_BASE}/api/tags/${id}`, get().token, {
            method: 'PATCH',
            body: JSON.stringify(updates),
          });
          
          // Re-fetch only on error or to ensure consistency, but don't block
          if (!response.ok) {
             await get().fetchTags();
             await get().fetchFiles(); 
          }
        } catch (error) {
          console.error('Failed to update tag', error);
          // Rollback/Sync on error
          await get().fetchTags();
          await get().fetchFiles(); 
        }
      },

      deleteTag: async (id: number) => {
        try {
          const response = await authFetch(`${API_BASE}/api/tags/${id}`, get().token, {
            method: 'DELETE',
          });
          if (response.ok) {
            const { selectedTagIds } = get();
            if (selectedTagIds.includes(id)) {
                set({ selectedTagIds: selectedTagIds.filter(tid => tid !== id) });
            }
            await get().fetchTags();
            await get().fetchFiles();
          }
        } catch (error) {
          console.error('Failed to delete tag', error);
        }
      },

      addTagToFile: async (fileId: number, tagName: string) => {
        try {
          const response = await authFetch(`${API_BASE}/api/files/${fileId}/tags`, get().token, {
            method: 'POST',
            body: JSON.stringify({ tagName }),
          });
          if (response.ok) {
            await get().fetchFiles();
            await get().fetchTags();
          }
        } catch (error) {
          console.error('Failed to add tag', error);
        }
      },

      addTagToMultipleFiles: async (fileIds: number[], tagName: string) => {
          const { token, files } = get();
          console.log(`[Store] Adding tag "${tagName}" to ${fileIds.length} files...`);
          try {
              const res = await authFetch(`${API_BASE}/api/files/bulk-tags`, token, {
                  method: 'POST',
                  body: JSON.stringify({ fileIds, tagName })
              });
              
              if (res.ok) {
                  const { tag, updatedFileIds } = await res.json();
                  console.log(`[Store] Server updated ${updatedFileIds.length} files. Applying optimistic update...`);
                  
                  // Optimistic Update - Use Set for O(1) lookup to avoid O(N*M) complexity
                  const updatedIdSet = new Set(updatedFileIds);
                  const newFiles = files.map(f => {
                      if (updatedIdSet.has(f.id)) {
                          // Add tag if not exists
                          if (!f.tags.some(t => t.id === tag.id)) {
                              return { ...f, tags: [...f.tags, tag] };
                          }
                      }
                      return f;
                  });
                  
                  set({ files: newFiles });
                  console.log(`[Store] Optimistic update complete.`);
                  await get().fetchTags(); // Update counts
              }
          } catch (e) {
              console.error("Failed to add tags to multiple files", e);
          }
      },

      removeTagFromMultipleFiles: async (fileIds: number[], tagId: number) => {
          const { token, files, tags } = get();
          
          // Optimistic Update Files
          const fileIdSet = new Set(fileIds);
          let removedCount = 0;

          const newFiles = files.map(f => {
              if (fileIdSet.has(f.id)) {
                  // Check if tag actually exists on file to verify count decrement
                  if (f.tags.some(t => t.id === tagId)) {
                      removedCount++;
                      return { ...f, tags: f.tags.filter(t => t.id !== tagId) };
                  }
              }
              return f;
          });

          // Optimistic Update Tags
          const newTags = tags.map(t => {
              if (t.id === tagId) {
                  const current = t._count?.files || 0;
                  return { ...t, _count: { files: Math.max(0, current - removedCount) } };
              }
              return t;
          });

          set({ files: newFiles, tags: newTags });

          try {
              const res = await authFetch(`${API_BASE}/api/files/bulk-tags`, token, {
                  method: 'DELETE',
                  body: JSON.stringify({ fileIds, tagId })
              });
              
              if (!res.ok) {
                  throw new Error('Bulk remove failed');
              }
              // We already updated optimistically, but let's sync to be sure
              await get().fetchTags(); 
          } catch (e) {
              console.error('Failed to remove tags from multiple files', e);
              // Revert/Sync on error
              await get().fetchFiles();
              await get().fetchTags();
          }
      },

      removeTagFromFile: async (fileId: number, tagId: number) => {
        const { selectedFileIds } = get();

        // If the file is part of the current selection, remove tag from ALL selected files
        if (selectedFileIds.includes(fileId) && selectedFileIds.length > 0) {
            await get().removeTagFromMultipleFiles(selectedFileIds, tagId);
            return;
        }

        try {
          const { files, tags } = get();
          // Optimistic
          const newFiles = files.map(f => {
              if (f.id === fileId) {
                  return { ...f, tags: f.tags.filter(t => t.id !== tagId) };
              }
              return f;
          });

          // Optimistic Tag Count
          const newTags = tags.map(t => {
              if (t.id === tagId) {
                  const current = t._count?.files || 0;
                  return { ...t, _count: { files: Math.max(0, current - 1) } };
              }
              return t;
          });

          set({ files: newFiles, tags: newTags });

          const response = await authFetch(`${API_BASE}/api/files/${fileId}/tags/${tagId}`, get().token, {
            method: 'DELETE',
          });
          if (response.ok) {
            // await get().fetchFiles(); // No need if optimistic was correct
            await get().fetchTags();
          } else {
             await get().fetchFiles(); // Revert
             await get().fetchTags();
          }
        } catch (error) {
          console.error('Failed to remove tag', error);
          await get().fetchFiles(); // Revert
          await get().fetchTags();
        }
      },

      openFile: async (fileId: number) => {
        try {
          await authFetch(`${API_BASE}/api/files/${fileId}/open`, get().token, { method: 'POST' });
        } catch (error) {
          console.error('Failed to open file', error);
        }
      },
    }),
    {
      name: 'tagzilla-auth-storage-v2', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token,
        user: state.user,
        language: state.language
      }),
    }
  )
);