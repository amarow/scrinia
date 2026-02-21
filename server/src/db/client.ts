import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { isMainThread } from 'worker_threads';

import { createDefaultUserAndTags } from './user';

// Ensure the directory exists and use absolute path
let dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(process.cwd(), dbPath);
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Schema only in main thread
if (isMainThread) {
    const schema = `
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Scope (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        name TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        userId INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
        UNIQUE(userId, path)
      );

      CREATE TABLE IF NOT EXISTS Tag (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT,
        isEditable BOOLEAN NOT NULL DEFAULT 1,
        userId INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
        UNIQUE(userId, name)
      );

      CREATE TABLE IF NOT EXISTS FileHandle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        extension TEXT NOT NULL,
        size INTEGER NOT NULL,
        mimeType TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        scopeId INTEGER NOT NULL,
        FOREIGN KEY (scopeId) REFERENCES Scope(id) ON DELETE CASCADE,
        UNIQUE(scopeId, path)
      );

      CREATE TABLE IF NOT EXISTS _FileHandleToTag (
        A INTEGER NOT NULL, -- FileHandle ID
        B INTEGER NOT NULL, -- Tag ID
        FOREIGN KEY (A) REFERENCES FileHandle(id) ON DELETE CASCADE,
        FOREIGN KEY (B) REFERENCES Tag(id) ON DELETE CASCADE,
        UNIQUE(A, B)
      );

      CREATE TABLE IF NOT EXISTS AppState (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT NOT NULL,
        userId INTEGER UNIQUE NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS Share (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        permissions TEXT NOT NULL,
        cloudSync BOOLEAN NOT NULL DEFAULT 0,
        lastSyncedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastUsedAt DATETIME,
        userId INTEGER NOT NULL,
        privacyProfileId INTEGER,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
        FOREIGN KEY (privacyProfileId) REFERENCES PrivacyProfile(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS PrivacyProfile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        userId INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS PrivacyRule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profileId INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'LITERAL' or 'REGEX'
        pattern TEXT NOT NULL,
        replacement TEXT NOT NULL,
        isActive BOOLEAN NOT NULL DEFAULT 1,
        FOREIGN KEY (profileId) REFERENCES PrivacyProfile(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS SharePrivacyProfile (
        shareId INTEGER NOT NULL,
        privacyProfileId INTEGER NOT NULL,
        sequence INTEGER NOT NULL,
        FOREIGN KEY (shareId) REFERENCES Share(id) ON DELETE CASCADE,
        FOREIGN KEY (privacyProfileId) REFERENCES PrivacyProfile(id) ON DELETE CASCADE,
        PRIMARY KEY (shareId, privacyProfileId)
      );

      CREATE TABLE IF NOT EXISTS _ShareToTag (
        A INTEGER NOT NULL, -- Share ID
        B INTEGER NOT NULL, -- Tag ID
        FOREIGN KEY (A) REFERENCES Share(id) ON DELETE CASCADE,
        FOREIGN KEY (B) REFERENCES Tag(id) ON DELETE CASCADE,
        UNIQUE(A, B)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS FileContentIndex USING fts5(
        content,
        tokenize='porter'
      );

      CREATE TRIGGER IF NOT EXISTS FileHandle_AD AFTER DELETE ON FileHandle BEGIN
        DELETE FROM FileContentIndex WHERE rowid = old.id;
      END;
    `;
    db.exec(schema);
    console.log(`Database initialized at ${dbPath}`);

    // Migration: Add hash to FileHandle
    const fileColumns = db.pragma('table_info(FileHandle)') as any[];
    if (!fileColumns.some(col => col.name === 'hash')) {
        db.prepare("ALTER TABLE FileHandle ADD COLUMN hash TEXT").run();
        console.log("Migration: Added 'hash' column to FileHandle table");
    }

    // Migration: Add isEditable column if not exists
    const tagColumns = db.pragma('table_info(Tag)') as any[];
    const hasIsEditable = tagColumns.some(col => col.name === 'isEditable');
    if (!hasIsEditable) {
        db.prepare("ALTER TABLE Tag ADD COLUMN isEditable BOOLEAN NOT NULL DEFAULT 1").run();
        console.log("Migration: Added 'isEditable' column to Tag table");
    }

    // Migration: Migrate ApiKey to Share
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name: string}[];
    const hasApiKey = tables.some(t => t.name === 'ApiKey');
    if (hasApiKey) {
        console.log("Migration: Found old ApiKey table, migrating to Share...");
        db.transaction(() => {
            // Copy data to the already created Share table (from schema)
            db.prepare(`
                INSERT OR IGNORE INTO Share (id, key, name, permissions, createdAt, lastUsedAt, userId, privacyProfileId)
                SELECT id, key, name, permissions, createdAt, lastUsedAt, userId, privacyProfileId FROM ApiKey
            `).run();
            
            // Migrate ApiKeyPrivacyProfile
            const hasAKPP = tables.some(t => t.name === 'ApiKeyPrivacyProfile');
            if (hasAKPP) {
                 db.prepare(`
                    INSERT OR IGNORE INTO SharePrivacyProfile (shareId, privacyProfileId, sequence)
                    SELECT apiKeyId, privacyProfileId, sequence FROM ApiKeyPrivacyProfile
                 `).run();
                 db.prepare("DROP TABLE ApiKeyPrivacyProfile").run();
            }
            
            db.prepare("DROP TABLE ApiKey").run();
            console.log("Migration: Successfully migrated ApiKey data to Share.");
        })();
    } else {
        // If no old ApiKey table, just ensure Share columns are correct (for existing Share tables)
        const shareCols = db.pragma('table_info(Share)') as any[];
        if (shareCols.length > 0 && !shareCols.some(col => col.name === 'privacyProfileId')) {
            db.prepare("ALTER TABLE Share ADD COLUMN privacyProfileId INTEGER").run();
            console.log("Migration: Added 'privacyProfileId' column to Share table");
        }
    }

    createDefaultUserAndTags();
}