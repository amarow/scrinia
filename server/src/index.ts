import express from 'express';
import cors from 'cors';
import { db } from './db/client';
import { crawlerService } from './services/crawler';
import { scopeRepository, fileRepository, tagRepository, appStateRepository, searchRepository, apiKeyRepository, privacyRepository } from './db/repository';
import { exec, spawn } from 'child_process';
import { authService, authenticateToken, authenticateApiKey, AuthRequest } from './auth';
import { privacyService } from './services/privacy';

// Middleware to allow either JWT or API Key
const authenticateAny = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];
  
  if (apiKeyHeader || (authHeader && authHeader.startsWith('Bearer '))) {
    // If it looks like an API key or Bearer token, we try API Key auth first if it's not a JWT
    // Actually, let's keep it simple: try JWT, if fails try API Key
    const token = authHeader && authHeader.split(' ')[1];
    if (token && token.split('.').length === 3) {
        return authenticateToken(req, res, next);
    }
    return authenticateApiKey(req, res, next);
  }
  return authenticateToken(req, res, next);
};
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import heicConvert from 'heic-convert';
import mammoth from 'mammoth';

const app = express();
const PORT = process.env.PORT || 3001;

console.log("!!! SERVER STARTUP - ASYNC CRAWLER VERSION " + Date.now() + " !!!");

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Public Routes ---

app.get('/', (req, res) => {
  res.send('Tagzilla Backend is running!');
});

// FS Listing for Directory Chooser
app.get('/api/fs/list', authenticateToken, async (req, res) => {
    try {
        let dirPath = req.query.path as string;
        
        // Default to Home dir if no path provided
        if (!dirPath) {
            dirPath = os.homedir();
        }

        // Security check (basic): ensure we can read it
        try {
            await fs.access(dirPath, fs.constants.R_OK);
        } catch {
             res.status(403).json({ error: 'Access denied or path invalid' });
             return;
        }

        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        const directories = entries
            .filter(entry => entry.isDirectory() && !entry.name.startsWith('.')) // Hide hidden folders for simplicity
            .map(entry => ({
                name: entry.name,
                path: path.join(dirPath, entry.name),
                isDir: true
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
            
        // Add parent directory entry if not at root
        const parentDir = path.dirname(dirPath);
        if (parentDir !== dirPath) {
             directories.unshift({
                 name: '..',
                 path: parentDir,
                 isDir: true
             });
        }

        res.json({
            currentPath: dirPath,
            entries: directories
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
        await authService.register(username, password);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await authService.login(username, password);
        if (!result) return res.status(401).json({ error: 'Invalid credentials' });
        
        // Trigger crawler for this user
        crawlerService.initUser(result.user.id).catch(err => {
            console.error(`Failed to init crawler for user ${result.user.id}:`, err);
        });

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing password fields' });

        await authService.changePassword(userId, currentPassword, newPassword);
        res.json({ success: true });
    } catch (e: any) {
        if (e.message === 'Invalid current password') {
            res.status(401).json({ error: e.message });
        } else {
            res.status(500).json({ error: e.message });
        }
    }
});

// API Key Management
app.get('/api/keys', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const keys = await apiKeyRepository.getAll(userId);
        res.json(keys);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/keys', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { name, permissions, privacyProfileId } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const key = authService.generateApiKey();
        const newKey = await apiKeyRepository.create(userId, name, key, permissions || 'files:read,tags:read', privacyProfileId);
        res.json(newKey);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/keys/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        await apiKeyRepository.delete(userId, Number(id));
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/keys/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        const { name, permissions, privacyProfileId } = req.body;
        await apiKeyRepository.update(userId, Number(id), { name, permissions, privacyProfileId });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Privacy Profiles Management
app.get('/api/privacy/profiles', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const profiles = await privacyRepository.getProfiles(userId);
        res.json(profiles);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/privacy/profiles', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const profile = await privacyRepository.createProfile(userId, name);
        res.json(profile);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/privacy/profiles/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        await privacyRepository.deleteProfile(userId, Number(id));
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/privacy/profiles/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const stmt = db.prepare('UPDATE PrivacyProfile SET name = ? WHERE id = ? AND userId = ?');
        stmt.run(name, id, userId);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/privacy/profiles/:id/rules', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const rules = await privacyRepository.getRules(Number(id));
        res.json(rules);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/privacy/profiles/:id/rules', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { type, pattern, replacement } = req.body;
        if (!type || !pattern || replacement === undefined) {
            return res.status(400).json({ error: 'Missing rule fields' });
        }
        const rule = await privacyRepository.addRule(Number(id), { type, pattern, replacement });
        res.json(rule);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/privacy/rules/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await privacyRepository.deleteRule(Number(id));
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/privacy/rules/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        await privacyRepository.toggleRule(Number(id), isActive);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Protected Routes ---

app.get('/status', authenticateToken, async (req, res) => {
  try {
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM FileHandle').get() as { count: number };
    const scopeCount = db.prepare('SELECT COUNT(*) as count FROM Scope').get() as { count: number };
    res.json({ status: 'ok', fileCount: fileCount.count, scopeCount: scopeCount.count });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Preferences
app.get('/api/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const prefs = await appStateRepository.get(userId);
        res.json(prefs || {});
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        await appStateRepository.set(userId, req.body);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Scopes
app.get('/api/scopes', authenticateToken, async (req, res) => {
    const userId = (req as AuthRequest).user!.id;
    const scopes = await scopeRepository.getAll(userId);
    res.json(scopes);
});

app.post('/api/scopes', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { path } = req.body;
        if (!path) {
             res.status(400).json({ error: 'Path is required' });
             return;
        }
        const scope = await crawlerService.addScope(userId, path);
        res.json(scope);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

import { ensureSystemTags } from './db/user';

app.post('/api/scopes/:id/refresh', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        console.log(`[API] Refresh requested for scope ${id} by user ${userId}`);
        const scope = await scopeRepository.getById(Number(id)) as any;
        if (!scope || scope.userId !== userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        // 1. Ensure system tags exist for this user (just in case)
        ensureSystemTags(userId);
        
        // 2. Trigger background scan (Fire and Forget)
        console.log(`[API] Triggering background scan for scope ${id}`);
        crawlerService.scanScope(scope.id, scope.path).then(async () => {
             // 3. After scan (or during), ensure files are tagged correctly
             // This applies system tags to ALL files, which is what we want for "repair"
             await fileRepository.applySystemTagsToAllFiles();
        }).catch(err => {
            console.error(`[API] Background scan failed for scope ${scope.id}:`, err);
        });
        
        res.json({ success: true, message: 'Scan started in background' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/scopes/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        await scopeRepository.delete(userId, Number(id));
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Files
app.get('/api/files', authenticateToken, async (req, res) => {
    const userId = (req as AuthRequest).user!.id;
    const start = Date.now();
    try {
        const files = await fileRepository.getAll(userId);
        console.log(`[API] Fetched ${files.length} files for user ${userId} in ${Date.now() - start}ms`);
        res.json(files);
    } catch (e: any) {
        console.error(`[API] Failed to fetch files: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/files/:id/text-content', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        
        const sql = `
            SELECT f.path, f.extension 
            FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `;
        const file = db.prepare(sql).get(id, userId) as { path: string, extension: string };
        
        if (!file) {
             res.status(404).json({ error: 'File not found or access denied' });
             return;
        }

        const ext = file.extension.toLowerCase();
        let text = "";

        if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: file.path });
            text = result.value;
        } else if (ext === '.odt') {
            const zip = new AdmZip(file.path);
            const contentXml = zip.readAsText('content.xml');
            if (contentXml) {
                let formatted = contentXml;
                
                // Paragraphs -> Newlines
                formatted = formatted.replace(/<text:p[^>]*>/g, '\n\n');
                
                // Headings -> Markdown headers based on level
                formatted = formatted.replace(/<text:h[^>]*text:outline-level="1"[^>]*>/g, '\n\n# ');
                formatted = formatted.replace(/<text:h[^>]*text:outline-level="2"[^>]*>/g, '\n\n## ');
                formatted = formatted.replace(/<text:h[^>]*text:outline-level="3"[^>]*>/g, '\n\n### ');
                // Fallback for headings without explicit level
                formatted = formatted.replace(/<text:h[^>]*>/g, '\n\n# ');
                
                // Tab -> spaces
                formatted = formatted.replace(/<text:tab\/>/g, '    ');
                
                // Line break -> newline
                formatted = formatted.replace(/<text:line-break\/>/g, '\n');

                // Strip all other tags
                text = formatted.replace(/<[^>]+>/g, '').trim();
            }
        } else {
            // For other files, just read as text
            text = await fs.readFile(file.path, 'utf8');
        }

        res.setHeader('Content-Type', 'text/plain');
        res.send(text);

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/files/:id/content', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        
        const sql = `
            SELECT f.path, f.mimeType, f.extension 
            FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `;
        const file = db.prepare(sql).get(id, userId) as { path: string, mimeType: string, extension: string };
        
        if (!file) {
             res.status(404).json({ error: 'File not found or access denied' });
             return;
        }

        // HEIC/HEIF Conversion to JPEG
        if (file.extension.toLowerCase() === '.heic' || file.extension.toLowerCase() === '.heif') {
            try {
                const inputBuffer = await fs.readFile(file.path);
                const outputBuffer = await heicConvert({
                    buffer: inputBuffer as any,
                    format: 'JPEG',
                    quality: 0.8
                });
                
                res.setHeader('Content-Type', 'image/jpeg');
                res.send(Buffer.from(outputBuffer));
                return;
            } catch (err) {
                console.error(`Failed to convert HEIC: ${err}`);
                // Fallback to sending original file if conversion fails
            }
        }

        // Optional: Set Content-Type header explicitly if needed, though sendFile usually handles it.
        // res.setHeader('Content-Type', file.mimeType);
        
        res.sendFile(file.path, { dotfiles: 'allow' }, (err) => {
             if (err) {
                 if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to send file' });
                 }
             }
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/files/:id/zip-content', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        
        const sql = `
            SELECT f.path 
            FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `;
        const file = db.prepare(sql).get(id, userId) as { path: string };
        
        if (!file) {
             res.status(404).json({ error: 'File not found or access denied' });
             return;
        }

        const zip = new AdmZip(file.path);
        const zipEntries = zip.getEntries();
        
        const entries = zipEntries
            .filter(entry => !entry.isDirectory)
            .map(entry => ({
                name: entry.entryName,
                size: entry.header.size,
                compressedSize: entry.header.compressedSize,
                isDirectory: entry.isDirectory,
                path: entry.entryName,
                method: entry.header.method
            }));

        res.json(entries);
    } catch (e: any) {
        console.error("ZIP Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/files/:id/zip-entry', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        const entryPath = req.query.path as string;

        if (!entryPath) {
            res.status(400).json({ error: 'Entry path is required' });
            return;
        }
        
        const sql = `
            SELECT f.path 
            FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `;
        const file = db.prepare(sql).get(id, userId) as { path: string };
        
        if (!file) {
             res.status(404).json({ error: 'File not found or access denied' });
             return;
        }

        const zip = new AdmZip(file.path);
        const entry = zip.getEntry(entryPath);

        if (!entry) {
            res.status(404).json({ error: 'Entry not found in zip' });
            return;
        }

        if (entry.isDirectory) {
            res.status(400).json({ error: 'Cannot download a directory' });
            return;
        }

        const buffer = entry.getData();
        
        // Try to detect mime type simply by extension
        const ext = path.extname(entry.entryName).toLowerCase();
        let contentType = 'application/octet-stream';
        if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml'].includes(ext)) contentType = 'text/plain';
        if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
        if (['.png'].includes(ext)) contentType = 'image/png';
        if (['.pdf'].includes(ext)) contentType = 'application/pdf';

        res.setHeader('Content-Type', contentType);
        res.send(buffer);

    } catch (e: any) {
        console.error("ZIP Entry Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/files/:id/open', authenticateToken, async (req, res) => {
    try {
        // TODO: Ensure file belongs to user (scope check) - implicitly safe via local exec but good practice
        const { id } = req.params;
        const file: any = db.prepare('SELECT * FROM FileHandle WHERE id = ?').get(id);
        
        if (!file) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        let command = '';
        const args: string[] = [];

        if (process.platform === 'linux' && file.extension === '.pdf') {
            command = 'evince';
            args.push(file.path);
        } else {
            // On Linux/Ubuntu, 'gio open' is often more reliable than 'xdg-open' for desktop apps
            switch (process.platform) {
                case 'darwin': 
                    command = 'open'; 
                    args.push(file.path);
                    break;
                case 'win32': 
                    command = 'cmd'; 
                    args.push('/c', 'start', '""', file.path);
                    break;
                default: 
                    // Try gio open first (GNOME), fallback to xdg-open if needed?
                    // Actually xdg-open delegates to gio open, but let's be explicit if we can.
                    // For now, let's stick to xdg-open but ensure env is passed correctly.
                    command = 'xdg-open'; 
                    args.push(file.path);
                    break;
            }
        }

        console.log(`Attempting to open file: "${file.path}"`);
        
        // Aggressive environment sanitization: Only pass essential vars.
        // This strips all Snap/Library specific vars that cause GLIBC errors.
        const cleanEnv: NodeJS.ProcessEnv = {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            DISPLAY: process.env.DISPLAY || ':0',
            USER: process.env.USER,
            LANG: process.env.LANG,
            DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
            XAUTHORITY: process.env.XAUTHORITY,
            XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
            XDG_DATA_DIRS: process.env.XDG_DATA_DIRS,
            XDG_CONFIG_DIRS: process.env.XDG_CONFIG_DIRS
        };

        // Use 'inherit' for stdio to see errors in the server console
        const child = spawn(command, args, {
            detached: true,
            stdio: 'inherit', 
            env: cleanEnv 
        });

        child.on('error', (err) => {
             console.error(`Failed to spawn viewer: ${err.message}`);
        });
        
        child.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Viewer process exited with code ${code}`);
            }
        });

        child.unref(); 
        
        res.json({ success: true, message: 'File opening initiated' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Tags Logic
app.post('/api/files/:id/tags', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        const { tagName } = req.body;
        if (!tagName) {
            res.status(400).json({ error: 'Tag name is required' });
            return;
        }
        const updatedFile = await fileRepository.addTagToFile(userId, Number(id), tagName);
        res.json(updatedFile);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/files/bulk-tags', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { fileIds, tagName } = req.body;
        console.log(`[API] Bulk tag request: Adding "${tagName}" to ${fileIds?.length} files for user ${userId}`);
        
        if (!fileIds || !Array.isArray(fileIds) || !tagName) {
             res.status(400).json({ error: 'Invalid payload' });
             return;
        }
        
        const start = Date.now();
        const result = await fileRepository.addTagToFiles(userId, fileIds, tagName);
        console.log(`[API] Bulk tag completed in ${Date.now() - start}ms. Updated ${result.updatedFileIds.length} files.`);
        
        res.json(result);
    } catch (e: any) {
        console.error(`[API] Bulk tag failed:`, e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/files/bulk-tags', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { fileIds, tagId } = req.body;
        
        if (!fileIds || !Array.isArray(fileIds) || !tagId) {
             res.status(400).json({ error: 'Invalid payload' });
             return;
        }
        
        const result = await fileRepository.removeTagFromFiles(userId, fileIds, Number(tagId));
        res.json(result);
    } catch (e: any) {
        console.error(`[API] Bulk tag remove failed:`, e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/files/:fileId/tags/:tagId', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { fileId, tagId } = req.params;
        const updatedFile = await fileRepository.removeTagFromFile(userId, Number(fileId), Number(tagId));
        res.json(updatedFile);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tags', authenticateToken, async (req, res) => {
    const userId = (req as AuthRequest).user!.id;
    const tags = await tagRepository.getAll(userId);
    res.json(tags);
});

app.post('/api/tags', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { name, color } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Tag name is required' });
            return;
        }
        const tag = await tagRepository.create(userId, name, color);
        res.json(tag);
    } catch (e: any) {
        if (e.code === 'P2002') {
             res.status(409).json({ error: 'Tag already exists' });
             return;
        }
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/tags/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        const { name, color } = req.body;
        
        const updatedTag = await tagRepository.update(userId, Number(id), { name, color });
        if (!updatedTag) {
            res.status(404).json({ error: 'Tag not found' });
            return;
        }
        res.json(updatedTag);
    } catch (e: any) {
        if (e.code === 'P2002') { // Or SQLite unique constraint error
             res.status(409).json({ error: 'Tag name already exists' });
             return;
        }
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/tags/:id', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        await tagRepository.delete(userId, Number(id));
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Search & Settings
app.get('/api/search', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { filename, content, directory } = req.query as { filename?: string, content?: string, directory?: string };
        
        if (!filename && !content && !directory) {
            res.json([]); // No criteria, return empty
            return;
        }
        
        const results = await searchRepository.search(userId, { filename, content, directory });
        res.json(results);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// --- Public API V1 (API Key Support) ---

app.get('/api/v1/files', authenticateAny, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const apiKey = (req as AuthRequest).apiKey;
        
        let allowedTagIds: number[] | undefined = undefined;
        if (apiKey) {
            allowedTagIds = apiKey.permissions
                .filter(p => p.startsWith('tag:'))
                .map(p => parseInt(p.split(':')[1]))
                .filter(id => !isNaN(id));
        }

        const files = await fileRepository.getAll(userId, allowedTagIds);
        res.json(files);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/v1/tags', authenticateAny, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const tags = await tagRepository.getAll(userId);
        res.json(tags);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/v1/search', authenticateAny, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { filename, content, directory } = req.query as { filename?: string, content?: string, directory?: string };
        const results = await searchRepository.search(userId, { filename, content, directory });
        res.json(results);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/v1/files/:id/text', authenticateAny, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { id } = req.params;
        const apiKey = (req as AuthRequest).apiKey;
        
        // 1. Check tag permissions if apiKey is used
        let allowedTagIds: number[] | undefined = undefined;
        if (apiKey) {
            allowedTagIds = apiKey.permissions
                .filter(p => p.startsWith('tag:'))
                .map(p => parseInt(p.split(':')[1]))
                .filter(id => !isNaN(id));
        }

        // 2. Fetch file and verify ownership/tags
        const sql = `
            SELECT f.path, f.extension 
            FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `;
        const file = db.prepare(sql).get(id, userId) as { path: string, extension: string };
        
        if (!file) {
             res.status(404).json({ error: 'File not found or access denied' });
             return;
        }

        // 3. If restricted by tags, verify file has at least one of the allowed tags
        if (allowedTagIds && allowedTagIds.length > 0) {
            const tagCheck = db.prepare('SELECT 1 FROM _FileHandleToTag WHERE A = ? AND B IN (' + allowedTagIds.map(() => '?').join(',') + ')').get(id, ...allowedTagIds);
            if (!tagCheck) {
                res.status(403).json({ error: 'Access denied to this file due to tag restrictions' });
                return;
            }
        }

        // 4. Extract text (Re-using logic from existing internal endpoint)
        const ext = file.extension.toLowerCase();
        let text = "";

        if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: file.path });
            text = result.value;
        } else if (ext === '.odt') {
            const zip = new AdmZip(file.path);
            const contentXml = zip.readAsText('content.xml');
            if (contentXml) {
                text = contentXml.replace(/<text:p[^>]*>/g, '\n\n')
                                 .replace(/<[^>]+>/g, '').trim();
            }
        } else {
            text = await fs.readFile(file.path, 'utf8');
        }

        // 5. Apply Redaction if a profile is assigned to the API Key
        if (apiKey && apiKey.privacyProfileId) {
            text = await privacyService.redactText(text, apiKey.privacyProfileId);
        }

        res.setHeader('Content-Type', 'text/plain');
        res.send(text);

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/settings/search', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const appState = await appStateRepository.get(userId);
        const settings = appState?.search_settings || { allowedExtensions: null }; 
        res.json(settings);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/settings/search', authenticateToken, async (req, res) => {
    try {
        const userId = (req as AuthRequest).user!.id;
        const { allowedExtensions } = req.body;
        
        if (!Array.isArray(allowedExtensions)) {
             res.status(400).json({ error: 'allowedExtensions must be an array' });
             return;
        }

        let appState = await appStateRepository.get(userId) || {};
        appState.search_settings = { allowedExtensions };
        
        await appStateRepository.set(userId, appState);
        res.json({ success: true, settings: appState.search_settings });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server & Crawler
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Initialize base service (worker pool)
  await crawlerService.init();
});
