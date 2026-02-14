"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyController = void 0;
const repository_1 = require("../db/repository");
const auth_1 = require("../auth");
exports.ApiKeyController = {
    async getAll(req, res) {
        try {
            const userId = req.user.id;
            const keys = await repository_1.apiKeyRepository.getAll(userId);
            res.json(keys);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async generateKey(req, res) {
        try {
            const key = auth_1.authService.generateApiKey();
            res.json({ key });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async create(req, res) {
        try {
            const userId = req.user.id;
            const { name, permissions, privacyProfileIds, key: providedKey } = req.body;
            if (!name)
                return res.status(400).json({ error: 'Name is required' });
            const permsString = Array.isArray(permissions) ? permissions.join(',') : (permissions || 'files:read,tags:read');
            const key = providedKey || auth_1.authService.generateApiKey();
            const newKey = await repository_1.apiKeyRepository.create(userId, name, key, permsString, privacyProfileIds);
            res.json(newKey);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async delete(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            await repository_1.apiKeyRepository.delete(userId, Number(id));
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async update(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { name, permissions, privacyProfileIds } = req.body;
            const permsString = Array.isArray(permissions) ? permissions.join(',') : permissions;
            await repository_1.apiKeyRepository.update(userId, Number(id), { name, permissions: permsString, privacyProfileIds });
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};
