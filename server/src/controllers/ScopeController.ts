import { Request, Response } from 'express';
import { scopeRepository, fileRepository } from '../db/repository';
import { crawlerService } from '../services/crawler';
import { ensureSystemTags } from '../db/user';
import { AuthRequest } from '../auth';

export const ScopeController = {
    async getAll(req: Request, res: Response) {
        const userId = (req as AuthRequest).user!.id;
        const scopes = await scopeRepository.getAll(userId);
        res.json(scopes);
    },

    async create(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { path } = req.body;
            if (!path) return res.status(400).json({ error: 'Path is required' });
            const scope = await crawlerService.addScope(userId, path);
            res.json(scope);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async refresh(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const scope = await scopeRepository.getById(Number(id)) as any;
            if (!scope || scope.userId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            ensureSystemTags(userId);
            crawlerService.scanScope(scope.id, scope.path).then(async () => {
                 await fileRepository.applySystemTagsToAllFiles();
            }).catch(err => {
                console.error(`[API] Background scan failed for scope ${scope.id}:`, err);
            });
            
            res.json({ success: true, message: 'Scan started in background' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async delete(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            await scopeRepository.delete(userId, Number(id));
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
