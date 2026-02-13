import { Request, Response } from 'express';
import { appStateRepository } from '../db/repository';
import { AuthRequest } from '../auth';

export const SettingsController = {
    async getPreferences(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const prefs = await appStateRepository.get(userId);
            res.json(prefs || {});
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async setPreferences(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            await appStateRepository.set(userId, req.body);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async getSearchSettings(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const appState = await appStateRepository.get(userId);
            const settings = appState?.search_settings || { allowedExtensions: null }; 
            res.json(settings);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async updateSearchSettings(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { allowedExtensions } = req.body;
            if (!Array.isArray(allowedExtensions)) return res.status(400).json({ error: 'allowedExtensions must be an array' });

            let appState = await appStateRepository.get(userId) || {};
            appState.search_settings = { allowedExtensions };
            await appStateRepository.set(userId, appState);
            res.json({ success: true, settings: appState.search_settings });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
