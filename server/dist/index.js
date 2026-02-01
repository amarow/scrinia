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
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
console.log("!!! SERVER STARTUP - ASYNC CRAWLER VERSION " + Date.now() + " !!!");
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
        // Trigger scan in background (Fire and Forget)
        console.log(`[API] Triggering background scan for scope ${id}`);
        crawler_1.crawlerService.scanScope(scope.id, scope.path).catch(err => {
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
// Start Server & Crawler
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await crawler_1.crawlerService.init();
});
