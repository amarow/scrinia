import { Request, Response } from 'express';
import { apiKeyRepository } from '../db/repository';
import { authService, AuthRequest } from '../auth';

export const ApiKeyController = {
    async getAll(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const keys = await apiKeyRepository.getAll(userId);
            res.json(keys);
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
            const { name, permissions, privacyProfileIds, key: providedKey } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });
            
            const permsString = Array.isArray(permissions) ? permissions.join(',') : (permissions || 'files:read,tags:read');
            const key = providedKey || authService.generateApiKey();
            const newKey = await apiKeyRepository.create(userId, name, key, permsString, privacyProfileIds);
            res.json(newKey);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async delete(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            await apiKeyRepository.delete(userId, Number(id));
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async update(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const { name, permissions, privacyProfileIds } = req.body;
            
            const permsString = Array.isArray(permissions) ? permissions.join(',') : permissions;
            await apiKeyRepository.update(userId, Number(id), { name, permissions: permsString, privacyProfileIds });
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
