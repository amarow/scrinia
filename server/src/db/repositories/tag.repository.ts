import { db } from '../client';

export const tagRepository = {
  async getAll(userId: number) {
    // Count files linked
    const sql = `
        SELECT t.*, COUNT(ft.A) as fileCount
        FROM Tag t
        LEFT JOIN _FileHandleToTag ft ON t.id = ft.B
        WHERE t.userId = ?
        GROUP BY t.id
        ORDER BY t.name ASC
    `;
    const stmt = db.prepare(sql);
    const rows = stmt.all(userId);
    
    // Map to structure compatible with frontend expectation { ..., _count: { files: N } }
    return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        isEditable: r.isEditable,
        userId: r.userId,
        _count: { files: r.fileCount }
    }));
  },

  async create(userId: number, name: string, color?: string) {
    const stmt = db.prepare('INSERT INTO Tag (userId, name, color) VALUES (?, ?, ?)');
    const info = stmt.run(userId, name, color);
    return { id: Number(info.lastInsertRowid), userId, name, color };
  },

  async update(userId: number, id: number, updates: { name?: string, color?: string }) {
    const tag = db.prepare('SELECT isEditable FROM Tag WHERE id = ? AND userId = ?').get(id, userId) as { isEditable: number };
    if (tag && tag.isEditable === 0) {
      throw new Error('Cannot edit a predefined tag.');
    }

    const { name, color } = updates;
    const fields = [];
    const values = [];

    if (name !== undefined) {
        fields.push('name = ?');
        values.push(name);
    }
    if (color !== undefined) {
        fields.push('color = ?');
        values.push(color);
    }

    if (fields.length === 0) return null;

    values.push(id);
    values.push(userId);

    const stmt = db.prepare(`UPDATE Tag SET ${fields.join(', ')} WHERE id = ? AND userId = ?`);
    stmt.run(...values);
    
    // Return updated tag
    const getStmt = db.prepare('SELECT * FROM Tag WHERE id = ?');
    return getStmt.get(id);
  },

  async delete(userId: number, id: number) {
    const tag = db.prepare('SELECT isEditable FROM Tag WHERE id = ? AND userId = ?').get(id, userId) as { isEditable: number };
    if (tag && tag.isEditable === 0) {
      throw new Error('Cannot delete a predefined tag.');
    }
    const stmt = db.prepare('DELETE FROM Tag WHERE id = ? AND userId = ?');
    stmt.run(id, userId);
  }
};
