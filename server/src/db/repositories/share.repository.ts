import { db } from '../client';

export const shareRepository = {
  async create(userId: number, name: string, key: string, permissions: string, tagIds: number[], privacyProfileIds?: number[]) {
    const info = db.transaction(() => {
      const stmt = db.prepare('INSERT INTO Share (userId, name, key, permissions) VALUES (?, ?, ?, ?)');
      const keyInfo = stmt.run(userId, name, key, permissions);
      const shareId = Number(keyInfo.lastInsertRowid);

      if (privacyProfileIds && privacyProfileIds.length > 0) {
        const profileStmt = db.prepare('INSERT INTO SharePrivacyProfile (shareId, privacyProfileId, sequence) VALUES (?, ?, ?)');
        privacyProfileIds.forEach((profileId, index) => {
          profileStmt.run(shareId, profileId, index);
        });
      }

      if (tagIds && tagIds.length > 0) {
        const tagStmt = db.prepare('INSERT INTO _ShareToTag (A, B) VALUES (?, ?)');
        tagIds.forEach(tagId => {
          tagStmt.run(shareId, tagId);
        });
      }

      return shareId;
    })();

    return { 
      id: info, 
      userId, 
      name, 
      key, 
      permissions: permissions.split(','), 
      tagIds,
      privacyProfileIds: privacyProfileIds || [],
      cloudSync: false,
      lastSyncedAt: null,
      createdAt: new Date() 
    };
  },

  async getAll(userId: number) {
    const stmt = db.prepare(`
      SELECT k.* 
      FROM Share k 
      WHERE k.userId = ? 
      ORDER BY k.createdAt DESC
    `);
    const rows = stmt.all(userId) as any[];
    
    const profileStmt = db.prepare(`
      SELECT privacyProfileId 
      FROM SharePrivacyProfile 
      WHERE shareId = ? 
      ORDER BY sequence ASC
    `);

    const tagStmt = db.prepare(`
      SELECT B as tagId 
      FROM _ShareToTag 
      WHERE A = ?
    `);

    return rows.map(row => {
      const profiles = profileStmt.all(row.id) as { privacyProfileId: number }[];
      const tags = tagStmt.all(row.id) as { tagId: number }[];
      return {
        ...row,
        permissions: row.permissions ? row.permissions.split(',') : [],
        privacyProfileIds: profiles.map(p => p.privacyProfileId),
        tagIds: tags.map(t => t.tagId),
        cloudSync: !!row.cloudSync
      };
    });
  },

  async delete(userId: number, id: number) {
    const stmt = db.prepare('DELETE FROM Share WHERE id = ? AND userId = ?');
    const info = stmt.run(id, userId);
    return info.changes > 0;
  },

  async verify(key: string) {
    const stmt = db.prepare('SELECT * FROM Share WHERE key = ?');
    const share = stmt.get(key) as any;
    if (share) {
      // Update lastUsedAt
      db.prepare('UPDATE Share SET lastUsedAt = CURRENT_TIMESTAMP WHERE id = ?').run(share.id);
      
      const profileStmt = db.prepare(`
        SELECT privacyProfileId 
        FROM SharePrivacyProfile 
        WHERE shareId = ? 
        ORDER BY sequence ASC
      `);
      const profiles = profileStmt.all(share.id) as { privacyProfileId: number }[];

      const tagStmt = db.prepare(`
        SELECT B as tagId 
        FROM _ShareToTag 
        WHERE A = ?
      `);
      const tags = tagStmt.all(share.id) as { tagId: number }[];

      share.privacyProfileIds = profiles.map(p => p.privacyProfileId);
      share.tagIds = tags.map(t => t.tagId);
      share.permissions = share.permissions ? share.permissions.split(',') : [];
      share.cloudSync = !!share.cloudSync;
      
      return share;
    }
    return null;
  },

  async update(userId: number, id: number, updates: { 
    name?: string, 
    permissions?: string, 
    privacyProfileIds?: number[], 
    tagIds?: number[],
    cloudSync?: boolean 
  }) {
    db.transaction(() => {
      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.permissions !== undefined) {
        fields.push('permissions = ?');
        values.push(updates.permissions);
      }
      if (updates.cloudSync !== undefined) {
        fields.push('cloudSync = ?');
        values.push(updates.cloudSync ? 1 : 0);
      }

      if (fields.length > 0) {
        values.push(id);
        values.push(userId);
        const stmt = db.prepare(`UPDATE Share SET \${fields.join(', ')} WHERE id = ? AND userId = ?`);
        stmt.run(...values);
      }

      const keyCheck = db.prepare('SELECT id FROM Share WHERE id = ? AND userId = ?').get(id, userId);
      if (!keyCheck) return;

      if (updates.privacyProfileIds !== undefined) {
        db.prepare('DELETE FROM SharePrivacyProfile WHERE shareId = ?').run(id);
        const profileStmt = db.prepare('INSERT INTO SharePrivacyProfile (shareId, privacyProfileId, sequence) VALUES (?, ?, ?)');
        updates.privacyProfileIds.forEach((profileId, index) => {
          profileStmt.run(id, profileId, index);
        });
      }

      if (updates.tagIds !== undefined) {
        db.prepare('DELETE FROM _ShareToTag WHERE A = ?').run(id);
        const tagStmt = db.prepare('INSERT INTO _ShareToTag (A, B) VALUES (?, ?)');
        updates.tagIds.forEach(tagId => {
          tagStmt.run(id, tagId);
        });
      }
    })();
  }
};
