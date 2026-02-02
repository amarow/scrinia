import { db } from './client';
import path from 'path';

// --- Statements ---
// We prepare statements once for efficiency where possible

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

export const fileRepository = {
  async upsertFile(scopeId: number, filePath: string, stats: { size: number; ctime: Date; mtime: Date }) {
    const filename = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    // Simple naive mime mapping
    let mimeType = 'application/octet-stream';
    if (extension === '.txt') mimeType = 'text/plain';
    if (extension === '.pdf') mimeType = 'application/pdf';
    if (extension === '.jpg' || extension === '.jpeg') mimeType = 'image/jpeg';
    if (extension === '.png') mimeType = 'image/png';
    if (extension === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Using UPSERT syntax (INSERT OR REPLACE / ON CONFLICT)
    // SQLite supports ON CONFLICT(scopeId, path) DO UPDATE
    // Use mtime (modification time) from file stats for updatedAt
    const sql = `
      INSERT INTO FileHandle (scopeId, path, name, extension, size, mimeType, updatedAt)
      VALUES (@scopeId, @path, @name, @extension, @size, @mimeType, @mtime)
      ON CONFLICT(scopeId, path) DO UPDATE SET
        size = excluded.size,
        updatedAt = excluded.updatedAt
    `;
    
    const stmt = db.prepare(sql);
    stmt.run({
        scopeId,
        path: filePath,
        name: filename,
        extension,
        size: stats.size,
        mimeType,
        mtime: stats.mtime.toISOString() // Store as ISO string
    });
  },

  async removeFile(scopeId: number, filePath: string) {
      const stmt = db.prepare('DELETE FROM FileHandle WHERE scopeId = ? AND path = ?');
      stmt.run(scopeId, filePath);
  },
  
  // Get all files for a specific user (through user's scopes)
  async getAll(userId: number) {
      // Need a JOIN to check scope ownership
      const sql = `
        SELECT f.*, 
               json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color)) as tags_json
        FROM FileHandle f
        JOIN Scope s ON f.scopeId = s.id
        LEFT JOIN _FileHandleToTag ft ON f.id = ft.A
        LEFT JOIN Tag t ON ft.B = t.id
        WHERE s.userId = ?
        GROUP BY f.id
        ORDER BY f.updatedAt DESC
      `;
      const stmt = db.prepare(sql);
      const rows = stmt.all(userId);
      
      // Parse the JSON tags (sqlite returns string)
      return rows.map((row: any) => ({
          ...row,
          tags: JSON.parse(row.tags_json).filter((t: any) => t.id !== null)
      }));
  },

  async addTagToFile(userId: number, fileId: number, tagName: string) {
    // Transaction to ensure atomicity
    const runTransaction = db.transaction(() => {
        // 1. Verify access
        const fileStmt = db.prepare(`
            SELECT f.id FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `);
        const file = fileStmt.get(fileId, userId);
        if (!file) throw new Error("File access denied");

        // 2. Find or Create Tag
        const upsertTag = db.prepare(`
            INSERT INTO Tag (userId, name) VALUES (?, ?)
            ON CONFLICT(userId, name) DO NOTHING
        `);
        upsertTag.run(userId, tagName);
        
        const getTag = db.prepare('SELECT id FROM Tag WHERE userId = ? AND name = ?');
        const tag = getTag.get(userId, tagName) as { id: number };

        // 3. Link File to Tag
        const link = db.prepare(`
            INSERT OR IGNORE INTO _FileHandleToTag (A, B) VALUES (?, ?)
        `);
        link.run(fileId, tag.id);
        
        return this.getFileWithTags(fileId);
    });

    return runTransaction();
  },

  async addTagToFiles(userId: number, fileIds: number[], tagName: string) {
     const runTransaction = db.transaction(() => {
        // 1. Find or Create Tag (once)
        const upsertTag = db.prepare(`
            INSERT INTO Tag (userId, name) VALUES (?, ?)
            ON CONFLICT(userId, name) DO NOTHING
        `);
        upsertTag.run(userId, tagName);
        
        const getTag = db.prepare('SELECT id FROM Tag WHERE userId = ? AND name = ?');
        const tag = getTag.get(userId, tagName) as { id: number };

        // 2. Process Files
        const checkFile = db.prepare(`
            SELECT f.id FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `);
        const link = db.prepare(`
            INSERT OR IGNORE INTO _FileHandleToTag (A, B) VALUES (?, ?)
        `);

        const updatedFiles: any[] = [];
        
        for (const fileId of fileIds) {
             const file = checkFile.get(fileId, userId);
             if (file) {
                 link.run(fileId, tag.id);
                 // We don't return full objects to save bandwidth on massive updates,
                 // but returning IDs allows client to update locally.
                 updatedFiles.push(fileId);
             }
        }
        
        return { 
            tag, 
            updatedFileIds: updatedFiles 
        };
     });
     return runTransaction();
  },

  async removeTagFromFile(userId: number, fileId: number, tagId: number) {
     const runTransaction = db.transaction(() => {
        // 1. Verify access
        const fileStmt = db.prepare(`
            SELECT f.id FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `);
        const file = fileStmt.get(fileId, userId);
        if (!file) throw new Error("File access denied");

        // 2. Unlink
        const unlink = db.prepare('DELETE FROM _FileHandleToTag WHERE A = ? AND B = ?');
        unlink.run(fileId, tagId);

        return this.getFileWithTags(fileId);
     });
     return runTransaction();
  },

  // Helper
  getFileWithTags(fileId: number) {
      const sql = `
        SELECT f.*, 
               json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color)) as tags_json
        FROM FileHandle f
        LEFT JOIN _FileHandleToTag ft ON f.id = ft.A
        LEFT JOIN Tag t ON ft.B = t.id
        WHERE f.id = ?
        GROUP BY f.id
      `;
      const row: any = db.prepare(sql).get(fileId);
      if (!row) return null;
       return {
          ...row,
          tags: JSON.parse(row.tags_json).filter((t: any) => t.id !== null)
      };
  }
};

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
    const stmt = db.prepare('DELETE FROM Tag WHERE id = ? AND userId = ?');
    stmt.run(id, userId);
  }
};

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