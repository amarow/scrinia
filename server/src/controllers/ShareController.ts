import { Request, Response } from 'express';
import { shareRepository } from '../db/repository';
import { authService, AuthRequest } from '../auth';

export const ShareController = {
    async getAll(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const shares = await shareRepository.getAll(userId);
            res.json(shares);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async generateKey(req: Request, res: Response) {
        try {
            const key = authService.generateApiKey();
            res.json({ key });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async create(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { name, permissions, privacyProfileIds, tagIds, key: providedKey } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });
            
            const permsString = Array.isArray(permissions) ? permissions.join(',') : (permissions || 'all');
            const key = providedKey || authService.generateApiKey();
            const newShare = await shareRepository.create(userId, name, key, permsString, tagIds || [], privacyProfileIds);
            res.json(newShare);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async delete(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            await shareRepository.delete(userId, Number(id));
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async update(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const { name, permissions, privacyProfileIds, tagIds, cloudSync } = req.body;
            
            const permsString = Array.isArray(permissions) ? permissions.join(',') : permissions;
            await shareRepository.update(userId, Number(id), { 
                name, 
                permissions: permsString, 
                privacyProfileIds, 
                tagIds,
                cloudSync 
            });
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
