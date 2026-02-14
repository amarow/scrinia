"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privacyRepository = void 0;
const client_1 = require("../client");
exports.privacyRepository = {
    async createProfile(userId, name, rules) {
        return client_1.db.transaction(() => {
            const stmt = client_1.db.prepare('INSERT INTO PrivacyProfile (userId, name) VALUES (?, ?)');
            const info = stmt.run(userId, name);
            const profileId = Number(info.lastInsertRowid);
            if (rules && rules.length > 0) {
                const ruleStmt = client_1.db.prepare('INSERT INTO PrivacyRule (profileId, type, pattern, replacement, isActive) VALUES (?, ?, ?, ?, ?)');
                for (const rule of rules) {
                    ruleStmt.run(profileId, rule.type, rule.pattern || '', rule.replacement, rule.isActive !== undefined ? (rule.isActive ? 1 : 0) : 1);
                }
            }
            return { id: profileId, userId, name, ruleCount: rules ? rules.length : 0 };
        })();
    },
    async getProfiles(userId) {
        const stmt = client_1.db.prepare(`
      SELECT p.*, COUNT(r.id) as ruleCount 
      FROM PrivacyProfile p 
      LEFT JOIN PrivacyRule r ON p.id = r.profileId 
      WHERE p.userId = ? 
      GROUP BY p.id
    `);
        return stmt.all(userId);
    },
    async deleteProfile(userId, id) {
        const stmt = client_1.db.prepare('DELETE FROM PrivacyProfile WHERE id = ? AND userId = ?');
        const info = stmt.run(id, userId);
        return info.changes > 0;
    },
    async updateProfile(userId, id, name, rules) {
        client_1.db.transaction(() => {
            // Update name
            const stmt = client_1.db.prepare('UPDATE PrivacyProfile SET name = ? WHERE id = ? AND userId = ?');
            stmt.run(name, id, userId);
            if (rules) {
                // Sync rules: simplest way is to delete and re-insert
                // Verify ownership
                const profile = client_1.db.prepare('SELECT id FROM PrivacyProfile WHERE id = ? AND userId = ?').get(id, userId);
                if (profile) {
                    client_1.db.prepare('DELETE FROM PrivacyRule WHERE profileId = ?').run(id);
                    const ruleStmt = client_1.db.prepare('INSERT INTO PrivacyRule (profileId, type, pattern, replacement, isActive) VALUES (?, ?, ?, ?, ?)');
                    for (const rule of rules) {
                        ruleStmt.run(id, rule.type, rule.pattern || '', rule.replacement, rule.isActive !== undefined ? (rule.isActive ? 1 : 0) : 1);
                    }
                }
            }
        })();
    },
    async addRule(profileId, rule) {
        const stmt = client_1.db.prepare('INSERT INTO PrivacyRule (profileId, type, pattern, replacement) VALUES (?, ?, ?, ?)');
        const info = stmt.run(profileId, rule.type, rule.pattern, rule.replacement);
        return { id: Number(info.lastInsertRowid), profileId, ...rule, isActive: 1 };
    },
    async getRules(profileId) {
        const stmt = client_1.db.prepare('SELECT * FROM PrivacyRule WHERE profileId = ?');
        return stmt.all(profileId);
    },
    async deleteRule(id) {
        const stmt = client_1.db.prepare('DELETE FROM PrivacyRule WHERE id = ?');
        stmt.run(id);
    },
    async toggleRule(id, isActive) {
        const stmt = client_1.db.prepare('UPDATE PrivacyRule SET isActive = ? WHERE id = ?');
        stmt.run(isActive ? 1 : 0, id);
    },
    async updateRule(id, rule) {
        const fields = [];
        const values = [];
        if (rule.type !== undefined) {
            fields.push('type = ?');
            values.push(rule.type);
        }
        if (rule.pattern !== undefined) {
            fields.push('pattern = ?');
            values.push(rule.pattern);
        }
        if (rule.replacement !== undefined) {
            fields.push('replacement = ?');
            values.push(rule.replacement);
        }
        if (rule.isActive !== undefined) {
            fields.push('isActive = ?');
            values.push(rule.isActive ? 1 : 0);
        }
        if (fields.length === 0)
            return;
        const stmt = client_1.db.prepare(`UPDATE PrivacyRule SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values, id);
    }
};
