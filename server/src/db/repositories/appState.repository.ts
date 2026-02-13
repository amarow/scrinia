import { db } from '../client';

export const appStateRepository = {
  async get(userId: number) {
    const stmt = db.prepare('SELECT value FROM AppState WHERE userId = ?');
    const row = stmt.get(userId) as { value: string };
    return row ? JSON.parse(row.value) : null;
  },

  async set(userId: number, value: any) {
    const strValue = JSON.stringify(value);
    const sql = `
        INSERT INTO AppState (userId, value) VALUES (?, ?)
        ON CONFLICT(userId) DO UPDATE SET value = excluded.value
    `;
    db.prepare(sql).run(userId, strValue);
  }
};
