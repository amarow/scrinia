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

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

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

      CREATE TABLE IF NOT EXISTS ApiKey (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        permissions TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastUsedAt DATETIME,
        userId INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
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

    // Migration: Add isEditable column if not exists
    const tagColumns = db.pragma('table_info(Tag)') as any[];
    const hasIsEditable = tagColumns.some(col => col.name === 'isEditable');
    if (!hasIsEditable) {
        db.prepare("ALTER TABLE Tag ADD COLUMN isEditable BOOLEAN NOT NULL DEFAULT 1").run();
        console.log("Migration: Added 'isEditable' column to Tag table");
    }

    createDefaultUserAndTags();
}