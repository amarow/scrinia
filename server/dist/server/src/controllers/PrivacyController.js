"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacyController = void 0;
const repository_1 = require("../db/repository");
exports.PrivacyController = {
    async getProfiles(req, res) {
        try {
            const userId = req.user.id;
            const profiles = await repository_1.privacyRepository.getProfiles(userId);
            res.json(profiles);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async createProfile(req, res) {
        try {
            const userId = req.user.id;
            const { name, rules } = req.body;
            if (!name)
                return res.status(400).json({ error: 'Name is required' });
            const profile = await repository_1.privacyRepository.createProfile(userId, name, rules);
            res.json(profile);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async deleteProfile(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            await repository_1.privacyRepository.deleteProfile(userId, Number(id));
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const { name, rules } = req.body;
            if (!name)
                return res.status(400).json({ error: 'Name is required' });
            await repository_1.privacyRepository.updateProfile(userId, Number(id), name, rules);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getRules(req, res) {
        try {
            const { id } = req.params;
            const rules = await repository_1.privacyRepository.getRules(Number(id));
            res.json(rules);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async addRule(req, res) {
        try {
            const { id } = req.params;
            const { type, pattern, replacement } = req.body;
            if (!type || pattern === undefined || replacement === undefined)
                return res.status(400).json({ error: 'Missing rule fields' });
            const rule = await repository_1.privacyRepository.addRule(Number(id), { type, pattern, replacement });
            res.json(rule);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async deleteRule(req, res) {
        try {
            const { id } = req.params;
            await repository_1.privacyRepository.deleteRule(Number(id));
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async toggleRule(req, res) {
        try {
            const { id } = req.params;
            const { isActive } = req.body;
            await repository_1.privacyRepository.toggleRule(Number(id), isActive);
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async updateRule(req, res) {
        try {
            const { id } = req.params;
            const { type, pattern, replacement, isActive } = req.body;
            await repository_1.privacyRepository.updateRule(Number(id), { type, pattern, replacement, isActive });
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};
