import { Request, Response } from 'express';
import { privacyRepository } from '../db/repository';
import { db } from '../db/client';
import { AuthRequest } from '../auth';

export const PrivacyController = {
    async getProfiles(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const profiles = await privacyRepository.getProfiles(userId);
            res.json(profiles);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async createProfile(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { name } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });
            const profile = await privacyRepository.createProfile(userId, name);
            res.json(profile);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async deleteProfile(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            await privacyRepository.deleteProfile(userId, Number(id));
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async updateProfile(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { id } = req.params;
            const { name } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });
            
            const stmt = db.prepare('UPDATE PrivacyProfile SET name = ? WHERE id = ? AND userId = ?');
            stmt.run(name, id, userId);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getRules(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const rules = await privacyRepository.getRules(Number(id));
            res.json(rules);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async addRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { type, pattern, replacement } = req.body;
            if (!type || !pattern || replacement === undefined) return res.status(400).json({ error: 'Missing rule fields' });
            const rule = await privacyRepository.addRule(Number(id), { type, pattern, replacement });
            res.json(rule);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async deleteRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await privacyRepository.deleteRule(Number(id));
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async toggleRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { isActive } = req.body;
            await privacyRepository.toggleRule(Number(id), isActive);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
