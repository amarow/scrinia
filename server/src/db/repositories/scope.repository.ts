import { db } from '../client';
import path from 'path';

export const scopeRepository = {
  async create(userId: number, directoryPath: string, name?: string) {
    const scopeName = name || path.basename(directoryPath);
    const stmt = db.prepare('INSERT INTO Scope (userId, path, name) VALUES (?, ?, ?)');
    const info = stmt.run(userId, directoryPath, scopeName);
    return { id: Number(info.lastInsertRowid), userId, path: directoryPath, name: scopeName, createdAt: new Date() };
  },

  async getAll(userId?: number) {
    if (userId) {
        const stmt = db.prepare('SELECT * FROM Scope WHERE userId = ?');
        return stmt.all(userId);
    }
    const stmt = db.prepare('SELECT * FROM Scope');
    return stmt.all();
  },
  
  async getById(id: number) {
      const stmt = db.prepare('SELECT * FROM Scope WHERE id = ?');
      return stmt.get(id);
  },
  
  async delete(userId: number, id: number) {
      const stmt = db.prepare('DELETE FROM Scope WHERE id = ? AND userId = ?');
      stmt.run(id, userId);
  }
};
