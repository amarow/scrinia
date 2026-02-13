import { Request, Response } from 'express';
import { fileRepository, tagRepository, searchRepository } from '../db/repository';
import { privacyService } from '../services/privacy';
import { db } from '../db/client';
import { AuthRequest } from '../auth';
import * as fs from 'fs/promises';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';

export const PublicController = {
    async getFiles(req: Request, res: Response) {
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
    },

    async getTags(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const tags = await tagRepository.getAll(userId);
            res.json(tags);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async search(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { filename, content, directory } = req.query as { filename?: string, content?: string, directory?: string };
            const results = await searchRepository.search(userId, { filename, content, directory });
            res.json(results);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getFileText(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const apiKey = (req as AuthRequest).apiKey;
            
            let allowedTagIds: number[] | undefined = undefined;
            if (apiKey) {
                allowedTagIds = apiKey.permissions
                    .filter(p => p.startsWith('tag:'))
                    .map(p => parseInt(p.split(':')[1]))
                    .filter(id => !isNaN(id));
            }

            const sql = `SELECT f.path, f.extension FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = db.prepare(sql).get(id, userId) as { path: string, extension: string };
            
            if (!file) return res.status(404).json({ error: 'File not found' });

            if (allowedTagIds && allowedTagIds.length > 0) {
                const tagCheck = db.prepare('SELECT 1 FROM _FileHandleToTag WHERE A = ? AND B IN (' + allowedTagIds.map(() => '?').join(',') + ')').get(id, ...allowedTagIds);
                if (!tagCheck) return res.status(403).json({ error: 'Access denied' });
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
                    text = contentXml.replace(/<text:p[^>]*>/g, '\n\n')
                                     .replace(/<[^>]+>/g, '').trim();
                }
            } else {
                text = await fs.readFile(file.path, 'utf8');
            }

            if (apiKey && apiKey.privacyProfileId) {
                text = await privacyService.redactText(text, apiKey.privacyProfileId);
            }

            res.setHeader('Content-Type', 'text/plain');
            res.send(text);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
