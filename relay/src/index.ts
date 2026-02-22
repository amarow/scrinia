import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3002; // Local Relay uses 3002
const STORAGE_DIR = path.join(__dirname, '../storage');
const DB_PATH = path.join(__dirname, '../relay.db');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize Relay Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS Artifact (
    hash TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    mimeType TEXT,
    storedPath TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Share (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    localShareId INTEGER,
    tokenHash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    privacyConfig TEXT, -- JSON rules
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS AccessRule (
    shareId INTEGER NOT NULL,
    artifactHash TEXT NOT NULL,
    virtualFilename TEXT NOT NULL,
    FOREIGN KEY (shareId) REFERENCES Share(id) ON DELETE CASCADE,
    FOREIGN KEY (artifactHash) REFERENCES Artifact(hash) ON DELETE CASCADE,
    PRIMARY KEY (shareId, artifactHash)
  );
`);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer for file uploads
const upload = multer({ dest: '/tmp/scrinia-relay-uploads' });

// --- API Endpoints ---

app.get('/health', (req, res) => {
  res.json({ status: 'ok', component: 'Scrinia Relay (Local Test)' });
});

// 1. Check if artifact exists (CAS HEAD request)
app.head('/api/v1/artifacts/:hash', (req, res) => {
  const hash = req.params.hash as string;
  const artifact = db.prepare('SELECT storedPath FROM Artifact WHERE hash = ?').get(hash) as { storedPath: string } | undefined;
  
  if (artifact && fs.existsSync(artifact.storedPath)) {
    res.status(200).end();
  } else {
    // Even if it's in the DB, if the file is missing on disk, we need it again
    res.status(404).end();
  }
});

// 2. Upload artifact
app.post('/api/v1/artifacts/:hash', upload.single('file'), (req, res) => {
  const hash = req.params.hash as string;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Move file to storage named by hash
  const finalPath = path.join(STORAGE_DIR, hash);
  
  // Verify hash of uploaded file
  const fileBuffer = fs.readFileSync(req.file.path);
  const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  if (actualHash !== hash) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Hash mismatch' });
  }

  if (!fs.existsSync(finalPath)) {
    fs.renameSync(req.file.path, finalPath);
  } else {
    fs.unlinkSync(req.file.path); // Already exists
  }

  db.prepare(`
    INSERT OR IGNORE INTO Artifact (hash, size, mimeType, storedPath)
    VALUES (?, ?, ?, ?)
  `).run(hash, req.file.size, req.file.mimetype, finalPath);

  res.json({ success: true, hash });
});

// 3. Sync Share metadata and rules
app.post('/api/v1/sync', (req, res) => {
  const { shareId, token, name, privacyConfig, files } = req.body;
  // files: Array<{ hash: string, name: string }>

  if (!token || !shareId) return res.status(400).json({ error: 'Missing share metadata' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  db.transaction(() => {
    // Upsert Share
    db.prepare(`
      INSERT INTO Share (localShareId, tokenHash, name, privacyConfig, updatedAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(tokenHash) DO UPDATE SET
        name = excluded.name,
        privacyConfig = excluded.privacyConfig,
        updatedAt = excluded.updatedAt
    `).run(shareId, tokenHash, name, JSON.stringify(privacyConfig));

    const shareRecord = db.prepare('SELECT id FROM Share WHERE tokenHash = ?').get(tokenHash) as { id: number };
    const internalShareId = shareRecord.id;

    // Refresh access rules
    db.prepare('DELETE FROM AccessRule WHERE shareId = ?').run(internalShareId);
    const insertRule = db.prepare('INSERT OR IGNORE INTO AccessRule (shareId, artifactHash, virtualFilename) VALUES (?, ?, ?)');
    
    for (const file of files) {
      insertRule.run(internalShareId, file.hash, file.name);
    }
  })();

  res.json({ success: true });
});

// 4. List shares (for debugging the relay)
app.get('/api/v1/shares', (req, res) => {
    const shares = db.prepare('SELECT * FROM Share').all();
    res.json(shares);
});

app.listen(Number(PORT) , "0.0.0.0" ,() => {
  console.log(`Relay Server running on http://0.0.0.0:${PORT}`);
});
