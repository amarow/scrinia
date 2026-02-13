import { Request, Response } from 'express';
import { fileRepository } from '../db/repository';
import { db } from '../db/client';
import { spawn } from 'child_process';
import { AuthRequest } from '../auth';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';
import heicConvert from 'heic-convert';
import mammoth from 'mammoth';

export const FileController = {
    async getAll(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id;
        try {
            const files = await fileRepository.getAll(userId);
            res.json(files);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getTextContent(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const sql = `SELECT f.path, f.extension FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = db.prepare(sql).get(id, userId) as { path: string, extension: string };
            
            if (!file) return res.status(404).json({ error: 'File not found' });

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
                    formatted = formatted.replace(/<text:p[^>]*>/g, '\n\n')
                                         .replace(/<text:h[^>]*text:outline-level="1"[^>]*>/g, '\n\n# ')
                                         .replace(/<text:h[^>]*text:outline-level="2"[^>]*>/g, '\n\n## ')
                                         .replace(/<text:h[^>]*text:outline-level="3"[^>]*>/g, '\n\n### ')
                                         .replace(/<text:h[^>]*>/g, '\n\n# ')
                                         .replace(/<text:tab\/>/g, '    ')
                                         .replace(/<text:line-break\/>/g, '\n');
                    text = formatted.replace(/<[^>]+>/g, '').trim();
                }
            } else {
                text = await fs.readFile(file.path, 'utf8');
            }

            res.setHeader('Content-Type', 'text/plain');
            res.send(text);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getContent(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const sql = `SELECT f.path, f.mimeType, f.extension FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = db.prepare(sql).get(id, userId) as { path: string, mimeType: string, extension: string };
            
            if (!file) return res.status(404).json({ error: 'File not found' });

            if (file.extension.toLowerCase() === '.heic' || file.extension.toLowerCase() === '.heif') {
                try {
                    const inputBuffer = await fs.readFile(file.path);
                    const outputBuffer = await heicConvert({ buffer: inputBuffer as any, format: 'JPEG', quality: 0.8 });
                    res.setHeader('Content-Type', 'image/jpeg');
                    res.send(Buffer.from(outputBuffer));
                    return;
                } catch (err) {
                    console.error(`Failed to convert HEIC: ${err}`);
                }
            }

            res.sendFile(file.path, { dotfiles: 'allow' }, (err) => {
                 if (err && !res.headersSent) res.status(500).json({ error: 'Failed to send file' });
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getZipContent(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const sql = `SELECT f.path FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = db.prepare(sql).get(id, userId) as { path: string };
            if (!file) return res.status(404).json({ error: 'File not found' });

            const zip = new AdmZip(file.path);
            const entries = zip.getEntries().filter(entry => !entry.isDirectory).map(entry => ({
                name: entry.entryName, size: entry.header.size, compressedSize: entry.header.compressedSize,
                isDirectory: entry.isDirectory, path: entry.entryName, method: entry.header.method
            }));
            res.json(entries);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getZipEntry(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const entryPath = req.query.path as string;
            if (!entryPath) return res.status(400).json({ error: 'Entry path is required' });
            
            const sql = `SELECT f.path FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = db.prepare(sql).get(id, userId) as { path: string };
            if (!file) return res.status(404).json({ error: 'File not found' });

            const zip = new AdmZip(file.path);
            const entry = zip.getEntry(entryPath);
            if (!entry || entry.isDirectory) return res.status(404).json({ error: 'Entry not found' });

            const buffer = entry.getData();
            const ext = path.extname(entry.entryName).toLowerCase();
            let contentType = 'application/octet-stream';
            if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml'].includes(ext)) contentType = 'text/plain';
            if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
            if (['.png'].includes(ext)) contentType = 'image/png';
            if (['.pdf'].includes(ext)) contentType = 'application/pdf';

            res.setHeader('Content-Type', contentType);
            res.send(buffer);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async openFile(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const file: any = db.prepare('SELECT * FROM FileHandle WHERE id = ?').get(id);
            if (!file) return res.status(404).json({ error: 'File not found' });

            let command = '';
            const args: string[] = [];
            if (process.platform === 'linux' && file.extension === '.pdf') {
                command = 'evince'; args.push(file.path);
            } else {
                switch (process.platform) {
                    case 'darwin': command = 'open'; args.push(file.path); break;
                    case 'win32': command = 'cmd'; args.push('/c', 'start', '""', file.path); break;
                    default: command = 'xdg-open'; args.push(file.path); break;
                }
            }

            const cleanEnv: NodeJS.ProcessEnv = {
                PATH: process.env.PATH, HOME: process.env.HOME, DISPLAY: process.env.DISPLAY || ':0',
                USER: process.env.USER, LANG: process.env.LANG, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
                XAUTHORITY: process.env.XAUTHORITY, XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
                XDG_DATA_DIRS: process.env.XDG_DATA_DIRS, XDG_CONFIG_DIRS: process.env.XDG_CONFIG_DIRS
            };

            const child = spawn(command, args, { detached: true, stdio: 'inherit', env: cleanEnv });
            child.on('error', (err) => console.error(`Failed to spawn viewer: ${err.message}`));
            child.unref(); 
            res.json({ success: true, message: 'File opening initiated' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async addTag(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const { tagName } = req.body;
            if (!tagName) return res.status(400).json({ error: 'Tag name is required' });
            const updatedFile = await fileRepository.addTagToFile(userId, Number(id), tagName);
            res.json(updatedFile);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async bulkAddTags(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { fileIds, tagName } = req.body;
            if (!fileIds || !Array.isArray(fileIds) || !tagName) return res.status(400).json({ error: 'Invalid payload' });
            const result = await fileRepository.addTagToFiles(userId, fileIds, tagName);
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async bulkRemoveTags(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { fileIds, tagId } = req.body;
            if (!fileIds || !Array.isArray(fileIds) || !tagId) return res.status(400).json({ error: 'Invalid payload' });
            const result = await fileRepository.removeTagFromFiles(userId, fileIds, Number(tagId));
            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async removeTag(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { fileId, tagId } = req.params;
            const updatedFile = await fileRepository.removeTagFromFile(userId, Number(fileId), Number(tagId));
            res.json(updatedFile);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
