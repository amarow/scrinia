import { Request, Response } from 'express';
import { searchRepository } from '../db/repository';
import { AuthRequest } from '../auth';

export const SearchController = {
    async search(req: Request, res: Response) {
        try {
            const userId = (req as AuthRequest).user!.id;
            const { filename, content, directory } = req.query as { filename?: string, content?: string, directory?: string };
            
            if (!filename && !content && !directory) return res.json([]);
            
            const results = await searchRepository.search(userId, { filename, content, directory });
            res.json(results);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
