import { Request, Response } from 'express';
import { authService, AuthRequest } from '../auth';
import { crawlerService } from '../services/crawler';

export const AuthController = {
    async register(req: Request, res: Response) {
        try {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
            await authService.register(username, password);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async login(req: Request, res: Response) {
        try {
            const { username, password } = req.body;
            const result = await authService.login(username, password);
            if (!result) return res.status(401).json({ error: 'Invalid credentials' });
            
            crawlerService.initUser(result.user.id).catch(err => {
                console.error(`Failed to init crawler for user ${result.user.id}:`, err);
            });

            res.json(result);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    },

    async changePassword(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing password fields' });

            await authService.changePassword(userId, currentPassword, newPassword);
            res.json({ success: true });
        } catch (e: any) {
            if (e.message === 'Invalid current password') {
                res.status(401).json({ error: e.message });
            } else {
                res.status(500).json({ error: e.message });
            }
        }
    }
};
