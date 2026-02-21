"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileController = void 0;
const repository_1 = require("../db/repository");
const client_1 = require("../db/client");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const file_service_1 = require("../services/file.service");
const privacy_1 = require("../services/privacy");
exports.FileController = {
    async getAll(req, res) {
        const userId = req.user.id;
        try {
            const files = await repository_1.fileRepository.getAll(userId);
            res.json(files);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getTextContent(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { profileId } = req.query;
            const sql = `SELECT f.path, f.extension FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = client_1.db.prepare(sql).get(id, userId);
            if (!file)
                return res.status(404).json({ error: 'File not found' });
            let text = await file_service_1.fileService.extractText(file.path, file.extension);
            if (profileId) {
                const profileIds = Array.isArray(profileId)
                    ? profileId.map(id => Number(id))
                    : [Number(profileId)];
                text = await privacy_1.privacyService.redactWithMultipleProfiles(text, profileIds, true);
            }
            res.setHeader('Content-Type', 'text/html');
            res.send(text);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getContent(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const sql = `SELECT f.path, f.mimeType, f.extension FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = client_1.db.prepare(sql).get(id, userId);
            if (!file)
                return res.status(404).json({ error: 'File not found' });
            if (file.extension.toLowerCase() === '.heic' || file.extension.toLowerCase() === '.heif') {
                try {
                    const buffer = await file_service_1.fileService.convertHeicToJpeg(file.path);
                    res.setHeader('Content-Type', 'image/jpeg');
                    res.send(buffer);
                    return;
                }
                catch (err) {
                    console.error(`Failed to convert HEIC: ${err}`);
                }
            }
            res.sendFile(file.path, { dotfiles: 'allow' }, (err) => {
                if (err && !res.headersSent)
                    res.status(500).json({ error: 'Failed to send file' });
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getZipContent(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const sql = `SELECT f.path FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = client_1.db.prepare(sql).get(id, userId);
            if (!file)
                return res.status(404).json({ error: 'File not found' });
            const entries = await file_service_1.fileService.getZipEntries(file.path);
            res.json(entries);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getZipEntry(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const entryPath = req.query.path;
            if (!entryPath)
                return res.status(400).json({ error: 'Entry path is required' });
            const sql = `SELECT f.path FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = client_1.db.prepare(sql).get(id, userId);
            if (!file)
                return res.status(404).json({ error: 'File not found' });
            const { buffer, contentType } = await file_service_1.fileService.getZipEntryData(file.path, entryPath);
            res.setHeader('Content-Type', contentType);
            res.send(buffer);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async openFile(req, res) {
        try {
            const { id } = req.params;
            const file = client_1.db.prepare('SELECT * FROM FileHandle WHERE id = ?').get(id);
            if (!file)
                return res.status(404).json({ error: 'File not found' });
            let command = '';
            const args = [];
            if (process.platform === 'linux' && file.extension === '.pdf') {
                command = 'evince';
                args.push(file.path);
            }
            else {
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
                        command = 'xdg-open';
                        args.push(file.path);
                        break;
                }
            }
            const cleanEnv = {
                PATH: process.env.PATH, HOME: process.env.HOME, DISPLAY: process.env.DISPLAY || ':0',
                USER: process.env.USER, LANG: process.env.LANG, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
                XAUTHORITY: process.env.XAUTHORITY, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
                XDG_DATA_DIRS: process.env.XDG_DATA_DIRS, XDG_CONFIG_DIRS: process.env.XDG_CONFIG_DIRS
            };
            const child = (0, child_process_1.spawn)(command, args, { detached: true, stdio: 'inherit', env: cleanEnv });
            child.on('error', (err) => console.error(`Failed to spawn viewer: ${err.message}`));
            child.unref();
            res.json({ success: true, message: 'File opening initiated' });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async openDirectory(req, res) {
        try {
            const { id } = req.params;
            const file = client_1.db.prepare('SELECT * FROM FileHandle WHERE id = ?').get(id);
            if (!file)
                return res.status(404).json({ error: 'File not found' });
            const dirPath = path_1.default.dirname(file.path);
            let command = '';
            const args = [];
            switch (process.platform) {
                case 'darwin':
                    command = 'open';
                    args.push(dirPath);
                    break;
                case 'win32':
                    command = 'explorer';
                    args.push(dirPath);
                    break;
                default:
                    command = 'xdg-open';
                    args.push(dirPath);
                    break;
            }
            const cleanEnv = {
                PATH: process.env.PATH, HOME: process.env.HOME, DISPLAY: process.env.DISPLAY || ':0',
                USER: process.env.USER, LANG: process.env.LANG, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
                XAUTHORITY: process.env.XAUTHORITY, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
                XDG_DATA_DIRS: process.env.XDG_DATA_DIRS, XDG_CONFIG_DIRS: process.env.XDG_CONFIG_DIRS
            };
            const child = (0, child_process_1.spawn)(command, args, { detached: true, stdio: 'inherit', env: cleanEnv });
            child.on('error', (err) => console.error(`Failed to spawn explorer: ${err.message}`));
            child.unref();
            res.json({ success: true, message: 'Directory opening initiated' });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async addTag(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { tagName } = req.body;
            if (!tagName)
                return res.status(400).json({ error: 'Tag name is required' });
            const updatedFile = await repository_1.fileRepository.addTagToFile(userId, Number(id), tagName);
            res.json(updatedFile);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async bulkAddTags(req, res) {
        try {
            const userId = req.user.id;
            const { fileIds, tagName } = req.body;
            if (!fileIds || !Array.isArray(fileIds) || !tagName)
                return res.status(400).json({ error: 'Invalid payload' });
            const result = await repository_1.fileRepository.addTagToFiles(userId, fileIds, tagName);
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async bulkRemoveTags(req, res) {
        try {
            const userId = req.user.id;
            const { fileIds, tagId } = req.body;
            if (!fileIds || !Array.isArray(fileIds) || !tagId)
                return res.status(400).json({ error: 'Invalid payload' });
            const result = await repository_1.fileRepository.removeTagFromFiles(userId, fileIds, Number(tagId));
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async removeTag(req, res) {
        try {
            const userId = req.user.id;
            const { fileId, tagId } = req.params;
            const updatedFile = await repository_1.fileRepository.removeTagFromFile(userId, Number(fileId), Number(tagId));
            res.json(updatedFile);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};
