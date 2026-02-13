import { db } from '../client';

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
        conditions.push("(f.path LIKE '%/' || ? || '/%' OR f.path LIKE '%' || ? || '\%')");
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
