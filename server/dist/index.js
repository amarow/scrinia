"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("./db/client");
const crawler_1 = require("./services/crawler");
const repository_1 = require("./db/repository");
const child_process_1 = require("child_process");
const auth_1 = require("./auth");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = __importDefault(require("os"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const heic_convert_1 = __importDefault(require("heic-convert"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
console.log("!!! SERVER STARTUP - ASYNC CRAWLER VERSION " + Date.now() + " !!!");
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
// --- Public Routes ---
app.get('/', (req, res) => {
    res.send('Tagzilla Backend is running!');
});
// FS Listing for Directory Chooser
app.get('/api/fs/list', auth_1.authenticateToken, async (req, res) => {
    try {
        let dirPath = req.query.path;
        // Default to Home dir if no path provided
        if (!dirPath) {
            dirPath = os_1.default.homedir();
        }
        // Security check (basic): ensure we can read it
        try {
            await fs.access(dirPath, fs.constants.R_OK);
        }
        catch {
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Missing credentials' });
        await auth_1.authService.register(username, password);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await auth_1.authService.login(username, password);
        if (!result)
            return res.status(401).json({ error: 'Invalid credentials' });
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/user/password', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Missing password fields' });
        await auth_1.authService.changePassword(userId, currentPassword, newPassword);
        res.json({ success: true });
    }
    catch (e) {
        if (e.message === 'Invalid current password') {
            res.status(401).json({ error: e.message });
        }
        else {
            res.status(500).json({ error: e.message });
        }
    }
});
// --- Protected Routes ---
app.get('/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const fileCount = client_1.db.prepare('SELECT COUNT(*) as count FROM FileHandle').get();
        const scopeCount = client_1.db.prepare('SELECT COUNT(*) as count FROM Scope').get();
        res.json({ status: 'ok', fileCount: fileCount.count, scopeCount: scopeCount.count });
    }
    catch (error) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});
// Preferences
app.get('/api/preferences', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const prefs = await repository_1.appStateRepository.get(userId);
        res.json(prefs || {});
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/preferences', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await repository_1.appStateRepository.set(userId, req.body);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Scopes
app.get('/api/scopes', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const scopes = await repository_1.scopeRepository.getAll(userId);
    res.json(scopes);
});
app.post('/api/scopes', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { path } = req.body;
        if (!path) {
            res.status(400).json({ error: 'Path is required' });
            return;
        }
        const scope = await crawler_1.crawlerService.addScope(userId, path);
        res.json(scope);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
const user_1 = require("./db/user");
app.post('/api/scopes/:id/refresh', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        console.log(`[API] Refresh requested for scope ${id} by user ${userId}`);
        const scope = await repository_1.scopeRepository.getById(Number(id));
        if (!scope || scope.userId !== userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // 1. Ensure system tags exist for this user (just in case)
        (0, user_1.ensureSystemTags)(userId);
        // 2. Trigger background scan (Fire and Forget)
        console.log(`[API] Triggering background scan for scope ${id}`);
        crawler_1.crawlerService.scanScope(scope.id, scope.path).then(async () => {
            // 3. After scan (or during), ensure files are tagged correctly
            // This applies system tags to ALL files, which is what we want for "repair"
            await repository_1.fileRepository.applySystemTagsToAllFiles();
        }).catch(err => {
            console.error(`[API] Background scan failed for scope ${scope.id}:`, err);
        });
        res.json({ success: true, message: 'Scan started in background' });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.delete('/api/scopes/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await repository_1.scopeRepository.delete(userId, Number(id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Files
app.get('/api/files', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const start = Date.now();
    try {
        const files = await repository_1.fileRepository.getAll(userId);
        console.log(`[API] Fetched ${files.length} files for user ${userId} in ${Date.now() - start}ms`);
        res.json(files);
    }
    catch (e) {
        console.error(`[API] Failed to fetch files: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/files/:id/content', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const sql = `
            SELECT f.path, f.mimeType, f.extension 
            FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `;
        const file = client_1.db.prepare(sql).get(id, userId);
        if (!file) {
            res.status(404).json({ error: 'File not found or access denied' });
            return;
        }
        // HEIC/HEIF Conversion to JPEG
        if (file.extension.toLowerCase() === '.heic' || file.extension.toLowerCase() === '.heif') {
            try {
                const inputBuffer = await fs.readFile(file.path);
                const outputBuffer = await (0, heic_convert_1.default)({
                    buffer: inputBuffer,
                    format: 'JPEG',
                    quality: 0.8
                });
                res.setHeader('Content-Type', 'image/jpeg');
                res.send(Buffer.from(outputBuffer));
                return;
            }
            catch (err) {
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/files/:id/zip-content', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const sql = `
            SELECT f.path 
            FROM FileHandle f 
            JOIN Scope s ON f.scopeId = s.id 
            WHERE f.id = ? AND s.userId = ?
        `;
        const file = client_1.db.prepare(sql).get(id, userId);
        if (!file) {
            res.status(404).json({ error: 'File not found or access denied' });
            return;
        }
        const zip = new adm_zip_1.default(file.path);
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
    }
    catch (e) {
        console.error("ZIP Error:", e);
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/files/:id/zip-entry', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const entryPath = req.query.path;
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
        const file = client_1.db.prepare(sql).get(id, userId);
        if (!file) {
            res.status(404).json({ error: 'File not found or access denied' });
            return;
        }
        const zip = new adm_zip_1.default(file.path);
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
        if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml'].includes(ext))
            contentType = 'text/plain';
        if (['.jpg', '.jpeg'].includes(ext))
            contentType = 'image/jpeg';
        if (['.png'].includes(ext))
            contentType = 'image/png';
        if (['.pdf'].includes(ext))
            contentType = 'application/pdf';
        res.setHeader('Content-Type', contentType);
        res.send(buffer);
    }
    catch (e) {
        console.error("ZIP Entry Error:", e);
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/files/:id/open', auth_1.authenticateToken, async (req, res) => {
    try {
        // TODO: Ensure file belongs to user (scope check) - implicitly safe via local exec but good practice
        const { id } = req.params;
        const file = client_1.db.prepare('SELECT * FROM FileHandle WHERE id = ?').get(id);
        if (!file) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        let command = '';
        const args = [];
        if (process.platform === 'linux' && file.extension === '.pdf') {
            command = 'evince';
            args.push(file.path);
        }
        else {
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
        const cleanEnv = {
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
        const child = (0, child_process_1.spawn)(command, args, {
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Tags Logic
app.post('/api/files/:id/tags', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { tagName } = req.body;
        if (!tagName) {
            res.status(400).json({ error: 'Tag name is required' });
            return;
        }
        const updatedFile = await repository_1.fileRepository.addTagToFile(userId, Number(id), tagName);
        res.json(updatedFile);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/files/bulk-tags', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileIds, tagName } = req.body;
        console.log(`[API] Bulk tag request: Adding "${tagName}" to ${fileIds?.length} files for user ${userId}`);
        if (!fileIds || !Array.isArray(fileIds) || !tagName) {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }
        const start = Date.now();
        const result = await repository_1.fileRepository.addTagToFiles(userId, fileIds, tagName);
        console.log(`[API] Bulk tag completed in ${Date.now() - start}ms. Updated ${result.updatedFileIds.length} files.`);
        res.json(result);
    }
    catch (e) {
        console.error(`[API] Bulk tag failed:`, e);
        res.status(500).json({ error: e.message });
    }
});
app.delete('/api/files/bulk-tags', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileIds, tagId } = req.body;
        if (!fileIds || !Array.isArray(fileIds) || !tagId) {
            res.status(400).json({ error: 'Invalid payload' });
            return;
        }
        const result = await repository_1.fileRepository.removeTagFromFiles(userId, fileIds, Number(tagId));
        res.json(result);
    }
    catch (e) {
        console.error(`[API] Bulk tag remove failed:`, e);
        res.status(500).json({ error: e.message });
    }
});
app.delete('/api/files/:fileId/tags/:tagId', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileId, tagId } = req.params;
        const updatedFile = await repository_1.fileRepository.removeTagFromFile(userId, Number(fileId), Number(tagId));
        res.json(updatedFile);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/tags', auth_1.authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const tags = await repository_1.tagRepository.getAll(userId);
    res.json(tags);
});
app.post('/api/tags', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, color } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Tag name is required' });
            return;
        }
        const tag = await repository_1.tagRepository.create(userId, name, color);
        res.json(tag);
    }
    catch (e) {
        if (e.code === 'P2002') {
            res.status(409).json({ error: 'Tag already exists' });
            return;
        }
        res.status(500).json({ error: e.message });
    }
});
app.patch('/api/tags/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, color } = req.body;
        const updatedTag = await repository_1.tagRepository.update(userId, Number(id), { name, color });
        if (!updatedTag) {
            res.status(404).json({ error: 'Tag not found' });
            return;
        }
        res.json(updatedTag);
    }
    catch (e) {
        if (e.code === 'P2002') { // Or SQLite unique constraint error
            res.status(409).json({ error: 'Tag name already exists' });
            return;
        }
        res.status(500).json({ error: e.message });
    }
});
app.delete('/api/tags/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await repository_1.tagRepository.delete(userId, Number(id));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Search & Settings
app.get('/api/search', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const q = req.query.q;
        const mode = req.query.mode;
        if (!q) {
            res.status(400).json({ error: 'Query parameter q is required' });
            return;
        }
        const searchMode = (mode === 'content') ? 'content' : 'filename';
        const results = await repository_1.searchRepository.search(userId, q, searchMode);
        res.json(results);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/settings/search', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const appState = await repository_1.appStateRepository.get(userId);
        const settings = appState?.search_settings || { allowedExtensions: null };
        res.json(settings);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.put('/api/settings/search', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { allowedExtensions } = req.body;
        if (!Array.isArray(allowedExtensions)) {
            res.status(400).json({ error: 'allowedExtensions must be an array' });
            return;
        }
        let appState = await repository_1.appStateRepository.get(userId) || {};
        appState.search_settings = { allowedExtensions };
        await repository_1.appStateRepository.set(userId, appState);
        res.json({ success: true, settings: appState.search_settings });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Start Server & Crawler
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Run system tag update on startup (fire and forget or await)
    await repository_1.fileRepository.applySystemTagsToAllFiles();
    await crawler_1.crawlerService.init();
});
