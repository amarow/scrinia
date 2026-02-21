"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const worker_threads_1 = require("worker_threads");
const user_1 = require("./user");
// Ensure the directory exists and use absolute path
let dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
if (!path_1.default.isAbsolute(dbPath)) {
    dbPath = path_1.default.resolve(process.cwd(), dbPath);
}
const dbDir = path_1.default.dirname(dbPath);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
exports.db = new better_sqlite3_1.default(dbPath);
// Enable WAL mode and foreign keys
exports.db.pragma('journal_mode = WAL');
exports.db.pragma('foreign_keys = ON');
// Initialize Schema only in main thread
if (worker_threads_1.isMainThread) {
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

      CREATE TABLE IF NOT EXISTS ApiKeyPrivacyProfile (
        apiKeyId INTEGER NOT NULL,
        privacyProfileId INTEGER NOT NULL,
        sequence INTEGER NOT NULL,
        FOREIGN KEY (apiKeyId) REFERENCES ApiKey(id) ON DELETE CASCADE,
        FOREIGN KEY (privacyProfileId) REFERENCES PrivacyProfile(id) ON DELETE CASCADE,
        PRIMARY KEY (apiKeyId, privacyProfileId)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS FileContentIndex USING fts5(
        content,
        tokenize='porter'
      );

      CREATE TRIGGER IF NOT EXISTS FileHandle_AD AFTER DELETE ON FileHandle BEGIN
        DELETE FROM FileContentIndex WHERE rowid = old.id;
      END;
    `;
    exports.db.exec(schema);
    console.log(`Database initialized at ${dbPath}`);
    // Migration: Add isEditable column if not exists
    const tagColumns = exports.db.pragma('table_info(Tag)');
    const hasIsEditable = tagColumns.some(col => col.name === 'isEditable');
    if (!hasIsEditable) {
        exports.db.prepare("ALTER TABLE Tag ADD COLUMN isEditable BOOLEAN NOT NULL DEFAULT 1").run();
        console.log("Migration: Added 'isEditable' column to Tag table");
    }
    // Migration: Add privacyProfileId to ApiKey if not exists
    const apiKeyColumns = exports.db.pragma('table_info(ApiKey)');
    const hasPrivacyProfileId = apiKeyColumns.some(col => col.name === 'privacyProfileId');
    if (!hasPrivacyProfileId) {
        exports.db.prepare("ALTER TABLE ApiKey ADD COLUMN privacyProfileId INTEGER").run();
        console.log("Migration: Added 'privacyProfileId' column to ApiKey table");
    }
    (0, user_1.createDefaultUserAndTags)();
}
