export interface FileHandle {
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

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  isEditable?: boolean;
  userId?: number;
  _count?: {
    files: number;
  };
}

export interface Scope {
  id: number;
  userId?: number;
  path: string;
  name: string;
  createdAt?: string | Date;
}

export interface User {
  id: number;
  username: string;
}

export interface ApiKey {
  id: number;
  userId?: number;
  name: string;
  key?: string;
  permissions: string[];
  privacyProfileId: number | null;
  privacyProfileName?: string;
  createdAt: string | Date;
  lastUsedAt: string | null;
}

export interface PrivacyProfile {
  id: number;
  userId?: number;
  name: string;
  ruleCount: number;
}

export interface PrivacyRule {
  id: number;
  profileId: number;
  type: 'LITERAL' | 'REGEX';
  pattern: string;
  replacement: string;
  isActive: boolean;
}

export interface SearchCriteria {
  filename: string;
  content: string;
  directory: string;
}
