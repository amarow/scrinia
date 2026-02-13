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

    async create(req: Request, res: Response) {
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
            const { name, permissions, privacyProfileId } = req.body;
            await apiKeyRepository.update(userId, Number(id), { name, permissions, privacyProfileId });
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
