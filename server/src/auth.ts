import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db/client';
import { ensureSystemTags } from './db/user';
import { shareRepository } from './db/repository';
import { crawlerService } from './services/crawler';
import type { User, Share } from '@shared/types';

const SECRET_KEY = process.env.JWT_SECRET || 'super-secret-key-change-me';

export interface AuthRequest extends Request {
  user?: User;
  share?: {
    id: number;
    name: string;
    permissions: string[];
    tagIds: number[];
    privacyProfileIds: number[];
  };
}

export const authService = {
  generateApiKey() {
    return `tz_${crypto.randomBytes(24).toString('hex')}`;
  },

  async register(username: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO User (username, password) VALUES (?, ?)');
    const info = stmt.run(username, hashedPassword);
    const userId = Number(info.lastInsertRowid);
    
    // Create system tags for new user
    ensureSystemTags(userId);
    
    return { id: userId, username };
  },

  async login(username: string, password: string) {
    const stmt = db.prepare('SELECT * FROM User WHERE username = ?');
    const user: any = stmt.get(username);
    
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
    return { token, user: { id: user.id, username: user.username } };
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    console.log(`[Auth] Attempting password change for user ${userId}`);
    const stmt = db.prepare('SELECT * FROM User WHERE id = ?');
    const user: any = stmt.get(userId);
    
    if (!user) {
        console.error(`[Auth] User ${userId} not found`);
        throw new Error('User not found');
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
        console.error(`[Auth] Invalid current password for user ${userId}`);
        throw new Error('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateStmt = db.prepare('UPDATE User SET password = ? WHERE id = ?');
    const info = updateStmt.run(hashedPassword, userId);
    
    console.log(`[Auth] Password updated for user ${userId}. Changes: ${info.changes}`);

    if (info.changes === 0) {
        throw new Error('Failed to update password in database');
    }
  }
};

export const authenticateShare = async (req: Request, res: Response, next: NextFunction) => {
  let key = req.headers['x-api-key'] as string;
  
  if (!key) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      key = authHeader.substring(7);
    }
  }

  // Also check query parameter for direct browser access
  if (!key && req.query.apiKey) {
    key = req.query.apiKey as string;
  }

  if (!key) return res.status(401).json({ error: 'Authentication (Share Token) missing' });

  const shareRecord = await shareRepository.verify(key);
  if (!shareRecord) return res.status(403).json({ error: 'Invalid Share token' });

  (req as AuthRequest).user = { id: shareRecord.userId, username: 'api_user' }; // Map to user for repository compatibility
  (req as AuthRequest).share = {
    id: shareRecord.id,
    name: shareRecord.name,
    permissions: shareRecord.permissions,
    tagIds: shareRecord.tagIds,
    privacyProfileIds: shareRecord.privacyProfileIds
  };
  
  // Trigger crawler for this user (background)
  crawlerService.initUser(shareRecord.userId).catch(console.error);

  next();
};

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token && req.query.token) {
      token = req.query.token as string;
  }

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    (req as AuthRequest).user = user;

    // Trigger crawler for this user (background)
    crawlerService.initUser(user.id).catch(console.error);

    next();
  });
};

export const authenticateAny = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // 1. Try JWT first (UI access)
  if (token && token.split('.').length === 3) {
    jwt.verify(token, SECRET_KEY, async (err: any, user: any) => {
      if (!err) {
        (req as AuthRequest).user = user;
        
        // If we also have a Share Key in query, load its metadata but keep the user
        const shareQuery = req.query.apiKey as string;
        if (shareQuery) {
            const shareRecord = await shareRepository.verify(shareQuery);
            if (shareRecord) {
                (req as AuthRequest).share = {
                    id: shareRecord.id,
                    name: shareRecord.name,
                    permissions: shareRecord.permissions,
                    tagIds: shareRecord.tagIds,
                    privacyProfileIds: shareRecord.privacyProfileIds
                };
            }
        }
        return next();
      }
      
      // If JWT failed but we have a Share Token, try it
      if (req.headers['x-api-key'] || req.query.apiKey) {
        return authenticateShare(req, res, next);
      }
      return res.status(403).json({ error: 'Invalid token' });
    });
  } else if (req.headers['x-api-key'] || req.query.apiKey || (authHeader && authHeader.startsWith('Bearer '))) {
    // 2. Fallback to Share Token
    return authenticateShare(req, res, next);
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
};
