import { Request, Response } from 'express';
import { fileRepository, tagRepository, searchRepository } from '../db/repository';
import { privacyService } from '../services/privacy';
import { fileService } from '../services/file.service';
import { db } from '../db/client';
import { AuthRequest } from '../auth';

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
            const apiKey = (req as AuthRequest).apiKey;
            const { filename, content, directory } = req.query as { filename?: string, content?: string, directory?: string };
            
            let results = await searchRepository.search(userId, { filename, content, directory });
            
            if (apiKey && apiKey.privacyProfileId) {
                results = await Promise.all(results.map(async (f: any) => {
                    if (f.snippet) {
                        f.snippet = await privacyService.redactText(f.snippet, apiKey.privacyProfileId!);
                    }
                    return f;
                }));
            }

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

            let text = await fileService.extractText(file.path, file.extension);

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
