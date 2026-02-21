"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAny = exports.authenticateToken = exports.authenticateApiKey = exports.authService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("./db/client");
const user_1 = require("./db/user");
const repository_1 = require("./db/repository");
const crawler_1 = require("./services/crawler");
const SECRET_KEY = process.env.JWT_SECRET || 'super-secret-key-change-me';
exports.authService = {
    generateApiKey() {
        return `tz_${crypto_1.default.randomBytes(24).toString('hex')}`;
    },
    async register(username, password) {
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const stmt = client_1.db.prepare('INSERT INTO User (username, password) VALUES (?, ?)');
        const info = stmt.run(username, hashedPassword);
        const userId = Number(info.lastInsertRowid);
        // Create system tags for new user
        (0, user_1.ensureSystemTags)(userId);
        return { id: userId, username };
    },
    async login(username, password) {
        const stmt = client_1.db.prepare('SELECT * FROM User WHERE username = ?');
        const user = stmt.get(username);
        if (!user)
            return null;
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            return null;
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
        return { token, user: { id: user.id, username: user.username } };
    },
    async changePassword(userId, currentPassword, newPassword) {
        console.log(`[Auth] Attempting password change for user ${userId}`);
        const stmt = client_1.db.prepare('SELECT * FROM User WHERE id = ?');
        const user = stmt.get(userId);
        if (!user) {
            console.error(`[Auth] User ${userId} not found`);
            throw new Error('User not found');
        }
        const valid = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!valid) {
            console.error(`[Auth] Invalid current password for user ${userId}`);
            throw new Error('Invalid current password');
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        const updateStmt = client_1.db.prepare('UPDATE User SET password = ? WHERE id = ?');
        const info = updateStmt.run(hashedPassword, userId);
        console.log(`[Auth] Password updated for user ${userId}. Changes: ${info.changes}`);
        if (info.changes === 0) {
            throw new Error('Failed to update password in database');
        }
    }
};
const authenticateApiKey = async (req, res, next) => {
    let key = req.headers['x-api-key'];
    if (!key) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            key = authHeader.substring(7);
        }
    }
    // Also check query parameter for direct browser access
    if (!key && req.query.apiKey) {
        key = req.query.apiKey;
    }
    if (!key)
        return res.status(401).json({ error: 'API key missing' });
    const apiKeyRecord = await repository_1.apiKeyRepository.verify(key);
    if (!apiKeyRecord)
        return res.status(403).json({ error: 'Invalid API key' });
    req.user = { id: apiKeyRecord.userId, username: 'api_user' }; // Map to user for repository compatibility
    req.apiKey = {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        permissions: apiKeyRecord.permissions,
        privacyProfileIds: apiKeyRecord.privacyProfileIds
    };
    // Trigger crawler for this user (background)
    crawler_1.crawlerService.initUser(apiKeyRecord.userId).catch(console.error);
    next();
};
exports.authenticateApiKey = authenticateApiKey;
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (!token)
        return res.sendStatus(401);
    jsonwebtoken_1.default.verify(token, SECRET_KEY, (err, user) => {
        if (err)
            return res.sendStatus(403);
        req.user = user;
        // Trigger crawler for this user (background)
        crawler_1.crawlerService.initUser(user.id).catch(console.error);
        next();
    });
};
exports.authenticateToken = authenticateToken;
const authenticateAny = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    // 1. Try JWT first (UI access)
    if (token && token.split('.').length === 3) {
        jsonwebtoken_1.default.verify(token, SECRET_KEY, async (err, user) => {
            if (!err) {
                req.user = user;
                // If we also have an API Key in query, load its metadata but keep the user
                const apiKeyQuery = req.query.apiKey;
                if (apiKeyQuery) {
                    const apiKeyRecord = await repository_1.apiKeyRepository.verify(apiKeyQuery);
                    if (apiKeyRecord) {
                        req.apiKey = {
                            id: apiKeyRecord.id,
                            name: apiKeyRecord.name,
                            permissions: apiKeyRecord.permissions,
                            privacyProfileIds: apiKeyRecord.privacyProfileIds
                        };
                    }
                }
                return next();
            }
            // If JWT failed but we have an API Key, try API Key
            if (req.headers['x-api-key'] || req.query.apiKey) {
                return (0, exports.authenticateApiKey)(req, res, next);
            }
            return res.status(403).json({ error: 'Invalid token' });
        });
    }
    else if (req.headers['x-api-key'] || req.query.apiKey || (authHeader && authHeader.startsWith('Bearer '))) {
        // 2. Fallback to API Key
        return (0, exports.authenticateApiKey)(req, res, next);
    }
    else {
        return res.status(401).json({ error: 'Authentication required' });
    }
};
exports.authenticateAny = authenticateAny;
