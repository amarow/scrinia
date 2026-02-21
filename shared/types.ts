export interface FileHandle {
  id: number;
  scopeId: number;
  path: string;
  name: string;
  extension: string;
  size: number;
  mimeType: string | null;
  hash: string | null;
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

export interface Share {
  id: number;
  userId?: number;
  name: string;
  key?: string;
  permissions: string[];
  tagIds: number[];
  privacyProfileIds: number[];
  cloudSync: boolean;
  lastSyncedAt: string | null;
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
  type: 'LITERAL' | 'REGEX' | 'EMAIL' | 'IBAN' | 'IPV4' | 'PHONE';
  pattern: string;
  replacement: string;
  isActive: boolean;
}

export interface SearchCriteria {
  filename: string;
  content: string;
  directory: string;
  enabled: boolean;
}
