import { db } from '../client';

export const apiKeyRepository = {
  async create(userId: number, name: string, key: string, permissions: string, privacyProfileId?: number) {
    const stmt = db.prepare('INSERT INTO ApiKey (userId, name, key, permissions, privacyProfileId) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(userId, name, key, permissions, privacyProfileId || null);
    return { 
      id: Number(info.lastInsertRowid), 
      userId, 
      name, 
      key, 
      permissions: permissions.split(','), 
      privacyProfileId: privacyProfileId || null,
      createdAt: new Date() 
    };
  },

  async getAll(userId: number) {
    const stmt = db.prepare(`
      SELECT k.*, p.name as privacyProfileName 
      FROM ApiKey k 
      LEFT JOIN PrivacyProfile p ON k.privacyProfileId = p.id
      WHERE k.userId = ? 
      ORDER BY k.createdAt DESC
    `);
    const rows = stmt.all(userId) as any[];
    return rows.map(row => ({
      ...row,
      permissions: row.permissions ? row.permissions.split(',') : []
    }));
  },

  async delete(userId: number, id: number) {
    const stmt = db.prepare('DELETE FROM ApiKey WHERE id = ? AND userId = ?');
    const info = stmt.run(id, userId);
    return info.changes > 0;
  },

  async verify(key: string) {
    const stmt = db.prepare('SELECT * FROM ApiKey WHERE key = ?');
    const apiKey = stmt.get(key) as any;
    if (apiKey) {
      // Update lastUsedAt
      db.prepare('UPDATE ApiKey SET lastUsedAt = CURRENT_TIMESTAMP WHERE id = ?').run(apiKey.id);
      return apiKey;
    }
    return null;
  },

  async update(userId: number, id: number, updates: { name?: string, permissions?: string, privacyProfileId?: number | null }) {
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
    if (updates.privacyProfileId !== undefined) {
      fields.push('privacyProfileId = ?');
      values.push(updates.privacyProfileId);
    }

    if (fields.length === 0) return;

    values.push(id);
    values.push(userId);

    const stmt = db.prepare(`UPDATE ApiKey SET ${fields.join(', ')} WHERE id = ? AND userId = ?`);
    stmt.run(...values);
  }
};
