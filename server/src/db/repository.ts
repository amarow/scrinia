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
    const runTransaction = db.transaction(() => {
      const filename = path.basename(filePath);
      const extension = path.extname(filePath).toLowerCase();
      
      // Simple naive mime mapping
      let mimeType = 'application/octet-stream';
      if (['.txt', '.md', '.rtf', '.csv', '.json', '.xml', '.log'].includes(extension)) mimeType = 'text/plain';
      if (['.pdf'].includes(extension)) mimeType = 'application/pdf';
      if (['.docx', '.doc'].includes(extension)) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (['.zip', '.7z', '.rar', '.tar', '.gz'].includes(extension)) mimeType = 'application/zip'; // Treat all archives as zip/archive for now
      if (['.jpg', '.jpeg', '.png', '.avif', '.gif', '.webp', '.bmp', '.tiff', '.heic'].includes(extension)) mimeType = 'image';
      if (['.avi', '.mp4', '.mkv', '.mov', '.webm', '.wmv', '.flv', '.m4v', '.3gp'].includes(extension)) mimeType = 'video';
      if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'].includes(extension)) mimeType = 'audio';

      // Using UPSERT syntax (INSERT OR REPLACE / ON CONFLICT)
      const sql = `
        INSERT INTO FileHandle (scopeId, path, name, extension, size, mimeType, updatedAt)
        VALUES (@scopeId, @path, @name, @extension, @size, @mimeType, @mtime)
        ON CONFLICT(scopeId, path) DO UPDATE SET
          size = excluded.size,
          updatedAt = excluded.updatedAt
        RETURNING id
      `;
      
      const stmt = db.prepare(sql);
      const row = stmt.get({
          scopeId,
          path: filePath,
          name: filename,
          extension,
          size: stats.size,
          mimeType,
          mtime: stats.mtime.toISOString()
      }) as { id: number };

      const fileId = row.id;

      // Assign predefined tags
      const scope = db.prepare('SELECT userId FROM Scope WHERE id = ?').get(scopeId) as { userId: number };
      if (scope) {
        const userId = scope.userId;
        let tagName: string | null = null;
        if (mimeType.startsWith('image')) tagName = 'Bilder';
        else if (mimeType.startsWith('audio')) tagName = 'Musik';
        else if (mimeType.startsWith('video')) tagName = 'Video';
        else if (mimeType === 'application/zip') tagName = 'Archive';
        else if (mimeType.startsWith('text') || mimeType === 'application/pdf' || mimeType.includes('document')) tagName = 'Text';
        else tagName = 'Rest'; // Default to Rest if no other tag matches

        if (tagName) {
          const tag = db.prepare('SELECT id FROM Tag WHERE userId = ? AND name = ?').get(userId, tagName) as { id: number };
          if (tag) {
            db.prepare('INSERT OR IGNORE INTO _FileHandleToTag (A, B) VALUES (?, ?)').run(fileId, tag.id);
          }
        }
      }

      return fileId;
    });

    return runTransaction();
  },

  async removeFile(scopeId: number, filePath: string) {
      const stmt = db.prepare('DELETE FROM FileHandle WHERE scopeId = ? AND path = ?');
      stmt.run(scopeId, filePath);
  },
  
  getFileMinimal(scopeId: number, filePath: string) {
      const stmt = db.prepare(`
        SELECT f.id, f.updatedAt, f.size, 
               EXISTS(SELECT 1 FROM FileContentIndex WHERE rowid = f.id) as hasContent
        FROM FileHandle f 
        WHERE f.scopeId = ? AND f.path = ?
      `);
      return stmt.get(scopeId, filePath) as { id: number, updatedAt: string, size: number, hasContent: number } | undefined;
  },
  
  // Get all files for a specific user (through user's scopes)
  async getAll(userId: number, allowedTagIds?: number[]) {
      // Need a JOIN to check scope ownership
      let tagFilter = '';
      const params: any[] = [userId];

      if (allowedTagIds && allowedTagIds.length > 0) {
          const placeholders = allowedTagIds.map(() => '?').join(',');
          tagFilter = `AND f.id IN (SELECT A FROM _FileHandleToTag WHERE B IN (${placeholders}))`;
          params.push(...allowedTagIds);
      }

      const sql = `
        SELECT f.*, 
               json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color, 'isEditable', t.isEditable)) as tags_json
        FROM FileHandle f
        JOIN Scope s ON f.scopeId = s.id
        LEFT JOIN _FileHandleToTag ft ON f.id = ft.A
        LEFT JOIN Tag t ON ft.B = t.id
        WHERE s.userId = ? ${tagFilter}
        GROUP BY f.id
        ORDER BY f.updatedAt DESC
      `;
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      
      // Parse the JSON tags (sqlite returns string)
      return rows.map((row: any) => ({
          ...row,
          tags: JSON.parse(row.tags_json).filter((t: any) => t.id !== null)
      }));
  },

  async addTagToFile(userId: number, fileId: number, tagName: string) {
    // Transaction to ensure atomicity
    const runTransaction = db.transaction(() => {
        // 1. Verify access & Get Path
        const fileStmt = db.prepare(`
            SELECT f.path FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `);
        const file = fileStmt.get(fileId, userId) as { path: string };
        if (!file) throw new Error("File access denied");

        // 2. Find or Create Tag
        const upsertTag = db.prepare(`
            INSERT INTO Tag (userId, name) VALUES (?, ?)
            ON CONFLICT(userId, name) DO NOTHING
        `);
        upsertTag.run(userId, tagName);
        
        const getTag = db.prepare('SELECT id FROM Tag WHERE userId = ? AND name = ?');
        const tag = getTag.get(userId, tagName) as { id: number };

        // 3. Find ALL matching files (same path, same user)
        const allInstancesStmt = db.prepare(`
            SELECT f.id FROM FileHandle f
            JOIN Scope s ON f.scopeId = s.id
            WHERE f.path = ? AND s.userId = ?
        `);
        const instances = allInstancesStmt.all(file.path, userId) as { id: number }[];

        // 4. Link ALL instances to Tag
        const link = db.prepare(`
            INSERT OR IGNORE INTO _FileHandleToTag (A, B) VALUES (?, ?)
        `);
        
        for (const instance of instances) {
            link.run(instance.id, tag.id);
        }
        
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
        
        const getTag = db.prepare('SELECT id, name, color FROM Tag WHERE userId = ? AND name = ?');
        const tag = getTag.get(userId, tagName) as { id: number, name: string, color: string };

        // 2. Process Files
        // Get all paths first
        const checkFile = db.prepare(`
            SELECT f.path FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `);
        
        // Query to find all instances for a path
        const allInstancesStmt = db.prepare(`
            SELECT f.id FROM FileHandle f
            JOIN Scope s ON f.scopeId = s.id
            WHERE f.path = ? AND s.userId = ?
        `);

        const link = db.prepare(`
            INSERT OR IGNORE INTO _FileHandleToTag (A, B) VALUES (?, ?)
        `);

        const updatedFiles: number[] = [];
        const processedPaths = new Set<string>();
        
        for (const fileId of fileIds) {
             const file = checkFile.get(fileId, userId) as { path: string };
             if (file && !processedPaths.has(file.path)) {
                 processedPaths.add(file.path);
                 const instances = allInstancesStmt.all(file.path, userId) as { id: number }[];
                 
                 for (const instance of instances) {
                     link.run(instance.id, tag.id);
                     updatedFiles.push(instance.id);
                 }
             }
        }
        
        return { 
            tag, 
            updatedFileIds: updatedFiles 
        };
     });
     return runTransaction();
  },

  async removeTagFromFiles(userId: number, fileIds: number[], tagId: number) {
     const runTransaction = db.transaction(() => {
        const checkFile = db.prepare(`
            SELECT f.path FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `);
        
        const allInstancesStmt = db.prepare(`
            SELECT f.id FROM FileHandle f
            JOIN Scope s ON f.scopeId = s.id
            WHERE f.path = ? AND s.userId = ?
        `);

        const unlinkOne = db.prepare('DELETE FROM _FileHandleToTag WHERE A = ? AND B = ?');

        const updatedFileIds: number[] = [];
        const processedPaths = new Set<string>();
        
        for (const fileId of fileIds) {
             const file = checkFile.get(fileId, userId) as { path: string };
             if (file && !processedPaths.has(file.path)) {
                 processedPaths.add(file.path);
                 const instances = allInstancesStmt.all(file.path, userId) as { id: number }[];
                 
                 for (const instance of instances) {
                     const info = unlinkOne.run(instance.id, tagId);
                     if (info.changes > 0) {
                         updatedFileIds.push(instance.id);
                     }
                 }
             }
        }
        
        return { tagId, updatedFileIds };
     });
     return runTransaction();
  },

  async removeTagFromFile(userId: number, fileId: number, tagId: number) {
     const runTransaction = db.transaction(() => {
        // 1. Verify access & Get Path
        const fileStmt = db.prepare(`
            SELECT f.path FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `);
        const file = fileStmt.get(fileId, userId) as { path: string };
        if (!file) throw new Error("File access denied");

        // 2. Find ALL matching files
        const allInstancesStmt = db.prepare(`
            SELECT f.id FROM FileHandle f
            JOIN Scope s ON f.scopeId = s.id
            WHERE f.path = ? AND s.userId = ?
        `);
        const instances = allInstancesStmt.all(file.path, userId) as { id: number }[];

        // 3. Unlink ALL instances
        const unlink = db.prepare('DELETE FROM _FileHandleToTag WHERE A = ? AND B = ?');
        
        for (const instance of instances) {
            unlink.run(instance.id, tagId);
        }

        return this.getFileWithTags(fileId);
     });
     return runTransaction();
  },

  async pruneFiles(scopeId: number, validFileIds: number[]) {
      // 1. Get all file IDs for this scope
      const allFilesStmt = db.prepare('SELECT id FROM FileHandle WHERE scopeId = ?');
      const allFiles = allFilesStmt.all(scopeId) as { id: number }[];
      
      const validSet = new Set(validFileIds);
      const toDelete = allFiles.filter(f => !validSet.has(f.id)).map(f => f.id);
      
      if (toDelete.length === 0) return 0;

      const deleteStmt = db.prepare('DELETE FROM FileHandle WHERE id = ?');
      const deleteTagsStmt = db.prepare('DELETE FROM _FileHandleToTag WHERE A = ?');
      const deleteContentStmt = db.prepare('DELETE FROM FileContentIndex WHERE rowid = ?');

      const runTransaction = db.transaction(() => {
          for (const id of toDelete) {
              deleteTagsStmt.run(id); // Clean up tags
              deleteContentStmt.run(id); // Clean up FTS index
              deleteStmt.run(id);
          }
          return toDelete.length;
      });

      return runTransaction();
  },

  // Helper
  getFileWithTags(fileId: number) {
      const sql = `
        SELECT f.*, 
               json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color, 'isEditable', t.isEditable)) as tags_json
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
  },

  async applySystemTagsToAllFiles() {
      console.log('Running system tag update on all files...');
      const runTransaction = db.transaction(() => {
          let totalChanges = 0;
          
          // Define mappings
          const mappings = [
              { tagName: 'Text', exts: ['.txt', '.md', '.rtf', '.csv', '.json', '.xml', '.log', '.pdf', '.docx', '.doc', '.odt'] },
              { tagName: 'Bilder', exts: ['.jpg', '.jpeg', '.png', '.avif', '.gif', '.webp', '.bmp', '.tiff', '.heic'] },
              { tagName: 'Video', exts: ['.avi', '.mp4', '.mkv', '.mov', '.webm', '.wmv', '.flv', '.m4v', '.3gp'] },
              { tagName: 'Musik', exts: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'] },
              { tagName: 'Archive', exts: ['.zip', '.7z', '.rar', '.tar', '.gz'] }
          ];

          for (const map of mappings) {
              // 1. Get all file extensions as a quoted list for SQL
              const placeholders = map.exts.map(() => '?').join(',');
              
              // 2. Insert links
              // We join FileHandle -> Scope -> Tag (by userId and Name)
              const sql = `
                  INSERT OR IGNORE INTO _FileHandleToTag (A, B)
                  SELECT f.id, t.id
                  FROM FileHandle f
                  JOIN Scope s ON f.scopeId = s.id
                  JOIN Tag t ON s.userId = t.userId
                  WHERE t.name = ?
                  AND f.extension IN (${placeholders})
              `;
              
              const stmt = db.prepare(sql);
              const info = stmt.run(map.tagName, ...map.exts);
              totalChanges += info.changes;
          }

          // 3. Apply 'Rest' tag to files that have NO tags (or effectively, files that didn't match above categories)
          // We can't strictly check "no tags" because user might have custom tags.
          // But the requirement is: "Rest ... unter dem alle Files getagt sind, die nicht Bilder, die nicht Musik, die nicht Text und nicht Video sind"
          // So we should find files that do NOT have any of the SYSTEM tags (Bilder, Musik, Text, Video) and assign Rest.
          
          const systemTagNames = ['Bilder', 'Musik', 'Text', 'Video', 'Archive'];
          const placeholders = systemTagNames.map(() => '?').join(',');

          const sqlRest = `
              INSERT OR IGNORE INTO _FileHandleToTag (A, B)
              SELECT f.id, tRest.id
              FROM FileHandle f
              JOIN Scope s ON f.scopeId = s.id
              JOIN Tag tRest ON s.userId = tRest.userId AND tRest.name = 'Rest'
              WHERE NOT EXISTS (
                  SELECT 1 
                  FROM _FileHandleToTag ft
                  JOIN Tag t ON ft.B = t.id
                  WHERE ft.A = f.id
                  AND t.name IN (${placeholders})
              )
          `;
          
          const stmtRest = db.prepare(sqlRest);
          const infoRest = stmtRest.run(...systemTagNames);
          totalChanges += infoRest.changes;

          return totalChanges;
      });
      const changes = runTransaction();
      console.log(`System tags applied (including 'Rest'). New links created: ${changes}`);
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

export const searchRepository = {
  async indexContent(fileId: number, content: string) {
    const stmt = db.prepare('INSERT OR REPLACE INTO FileContentIndex(rowid, content) VALUES (?, ?)');
    stmt.run(fileId, content);
  },

  async search(userId: number, criteria: { filename?: string, content?: string, directory?: string }) {
    const conditions: string[] = ['s.userId = ?'];
    const params: any[] = [userId];
    let joinContent = false;
    let ftsQuery = '';

    // Handle Content Search (FTS)
    if (criteria.content && criteria.content.trim()) {
      const terms = criteria.content.trim().split(/\s+/).filter(t => t.length > 0);
      if (terms.length > 0) {
        ftsQuery = terms.map(t => `"${t.replace(/"/g, '""')}"*`).join(' AND ');
        joinContent = true;
        conditions.push('fts.content MATCH ?');
        params.push(ftsQuery);
      }
    }

    // Handle Filename Search
    if (criteria.filename && criteria.filename.trim()) {
        conditions.push('f.name LIKE ?');
        params.push(`%${criteria.filename.trim()}%`);
    }

    // Handle Directory Search
    if (criteria.directory && criteria.directory.trim()) {
        conditions.push("(f.path LIKE '%/' || ? || '/%' OR f.path LIKE '%\\' || ? || '\\%')");
        params.push(criteria.directory.trim());
        params.push(criteria.directory.trim());
    }
    
    // Construct Query
    const sql = `
        SELECT f.*,
               ${joinContent ? "snippet(FileContentIndex, 0, '<b>', '</b>', '...', 64) as snippet," : ""}
               (
                   SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
                   FROM _FileHandleToTag ft
                   JOIN Tag t ON ft.B = t.id
                   WHERE ft.A = f.id
               ) as tags_json
        FROM FileHandle f
        JOIN Scope s ON f.scopeId = s.id
        ${joinContent ? "JOIN FileContentIndex fts ON f.id = fts.rowid" : ""}
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${joinContent ? "rank" : "f.updatedAt DESC"}
        LIMIT 500
    `;

    const rows = db.prepare(sql).all(...params);

    return rows.map((row: any) => ({
        ...row,
        tags: row.tags_json ? JSON.parse(row.tags_json).filter((t: any) => t.id !== null) : []
    }));
  }
};

export const apiKeyRepository = {
  async create(userId: number, name: string, key: string, permissions: string) {
    const stmt = db.prepare('INSERT INTO ApiKey (userId, name, key, permissions) VALUES (?, ?, ?, ?)');
    const info = stmt.run(userId, name, key, permissions);
    return { 
      id: Number(info.lastInsertRowid), 
      userId, 
      name, 
      key, 
      permissions: permissions.split(','), 
      createdAt: new Date() 
    };
  },

  async getAll(userId: number) {
    const stmt = db.prepare('SELECT id, name, key, permissions, createdAt, lastUsedAt FROM ApiKey WHERE userId = ? ORDER BY createdAt DESC');
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
  }
};