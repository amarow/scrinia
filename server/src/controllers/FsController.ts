import { Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

export const FsController = {
    async list(req: Request, res: Response) {
        try {
            let dirPath = req.query.path as string;
            if (!dirPath) dirPath = os.homedir();

            try {
                await fs.access(dirPath, fs.constants.R_OK);
            } catch {
                 return res.status(403).json({ error: 'Access denied or path invalid' });
            }

            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const directories = entries
                .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
                .map(entry => ({
                    name: entry.name,
                    path: path.join(dirPath, entry.name),
                    isDir: true
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
                
            const parentDir = path.dirname(dirPath);
            if (parentDir !== dirPath) {
                 directories.unshift({
                     name: '..',
                     path: parentDir,
                     isDir: true
                 });
            }

            res.json({ currentPath: dirPath, entries: directories });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
};
