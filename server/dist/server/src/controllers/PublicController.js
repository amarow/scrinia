"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicController = void 0;
const repository_1 = require("../db/repository");
const privacy_1 = require("../services/privacy");
const file_service_1 = require("../services/file.service");
const client_1 = require("../db/client");
exports.PublicController = {
    async getFiles(req, res) {
        try {
            const userId = req.user.id;
            const apiKey = req.apiKey;
            let allowedTagIds = undefined;
            if (apiKey) {
                allowedTagIds = apiKey.permissions
                    .filter(p => p.startsWith('tag:'))
                    .map(p => parseInt(p.split(':')[1]))
                    .filter(id => !isNaN(id));
            }
            const files = await repository_1.fileRepository.getAll(userId, allowedTagIds);
            res.json(files);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getAllFilesText(req, res) {
        try {
            const userId = req.user.id;
            const apiKey = req.apiKey;
            const { tag, q, limit, format } = req.query;
            const asHtml = format === 'html';
            const fileLimit = Math.min(parseInt(limit || '50'), 200);
            const maxResponseSize = 10 * 1024 * 1024; // 10MB limit
            let allowedTagIds = undefined;
            if (apiKey) {
                allowedTagIds = apiKey.permissions
                    .filter(p => p.startsWith('tag:'))
                    .map(p => parseInt(p.split(':')[1]))
                    .filter(id => !isNaN(id));
            }
            // Allow UI overrides for preview if the owner is authenticated
            const { overrideTags, overrideProfiles } = req.query;
            if (overrideTags !== undefined && req.user) {
                allowedTagIds = overrideTags ? overrideTags.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
            }
            let activeProfileIds = apiKey?.privacyProfileIds || [];
            if (overrideProfiles !== undefined && req.user) {
                activeProfileIds = overrideProfiles ? overrideProfiles.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
            }
            // Get files based on tag, search query, or all
            let files = [];
            if (tag) {
                const tagObj = client_1.db.prepare('SELECT id FROM Tag WHERE userId = ? AND name = ?').get(userId, tag);
                if (tagObj) {
                    files = await repository_1.fileRepository.getAll(userId, [tagObj.id]);
                }
            }
            else if (q) {
                files = await repository_1.searchRepository.search(userId, { content: q });
            }
            else {
                files = await repository_1.fileRepository.getAll(userId, allowedTagIds);
            }
            // Apply slice for limit
            files = files.slice(0, fileLimit);
            let fullContext = "";
            for (const file of files) {
                if (fullContext.length > maxResponseSize) {
                    fullContext += `\n\n[WARNING: Response truncated due to size limit]\n`;
                    break;
                }
                try {
                    if (!['.pdf', '.docx', '.txt', '.md', '.odt', '.rtf'].includes(file.extension.toLowerCase()))
                        continue;
                    let text = await file_service_1.fileService.extractText(file.path, file.extension);
                    if (activeProfileIds.length > 0) {
                        text = await privacy_1.privacyService.redactWithMultipleProfiles(text, activeProfileIds, asHtml);
                    }
                    else if (asHtml) {
                        text = await privacy_1.privacyService.redactWithMultipleProfiles(text, [], true);
                    }
                    if (asHtml) {
                        fullContext += `<div style="margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
                            <h3 style="margin: 0 0 0.5rem 0; font-family: sans-serif;">SOURCE: ${file.name} (ID: ${file.id})</h3>
                            <pre style="white-space: pre-wrap; font-family: monospace; font-size: 13px;">${text}</pre>
                        </div>`;
                    }
                    else {
                        fullContext += `\n=== SOURCE: ${file.name} (ID: ${file.id}) ===\n${text}\n`;
                    }
                }
                catch (err) {
                    fullContext += `\n=== SOURCE: ${file.name} (ID: ${file.id}) ===\n[Error extracting text: ${err.message}]\n`;
                }
            }
            res.setHeader('Content-Type', asHtml ? 'text/html' : 'text/plain');
            res.setHeader('X-File-Count', files.length.toString());
            res.send(fullContext);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getAllFilesJson(req, res) {
        try {
            const userId = req.user.id;
            const apiKey = req.apiKey;
            const { tag, q, limit, format } = req.query;
            const asHtml = format === 'html';
            const fileLimit = Math.min(parseInt(limit || '50'), 200);
            const maxContentSize = 5 * 1024 * 1024; // 5MB per batch for JSON
            let allowedTagIds = undefined;
            if (apiKey) {
                allowedTagIds = apiKey.permissions
                    .filter(p => p.startsWith('tag:'))
                    .map(p => parseInt(p.split(':')[1]))
                    .filter(id => !isNaN(id));
            }
            // Allow UI overrides for preview
            const { overrideTags, overrideProfiles } = req.query;
            if (overrideTags !== undefined && req.user) {
                allowedTagIds = overrideTags ? overrideTags.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
            }
            let activeProfileIds = apiKey?.privacyProfileIds || [];
            if (overrideProfiles !== undefined && req.user) {
                activeProfileIds = overrideProfiles ? overrideProfiles.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];
            }
            // Get files
            let files = [];
            if (tag) {
                const tagObj = client_1.db.prepare('SELECT id FROM Tag WHERE userId = ? AND name = ?').get(userId, tag);
                if (tagObj) {
                    files = await repository_1.fileRepository.getAll(userId, [tagObj.id]);
                }
            }
            else if (q) {
                files = await repository_1.searchRepository.search(userId, { content: q });
            }
            else {
                files = await repository_1.fileRepository.getAll(userId, allowedTagIds);
            }
            files = files.slice(0, fileLimit);
            const results = [];
            let currentTotalSize = 0;
            for (const file of files) {
                if (currentTotalSize > maxContentSize)
                    break;
                try {
                    if (!['.pdf', '.docx', '.txt', '.md', '.odt', '.rtf'].includes(file.extension.toLowerCase())) {
                        results.push({ ...file, content: null, status: 'skipped (non-text)' });
                        continue;
                    }
                    let text = await file_service_1.fileService.extractText(file.path, file.extension);
                    if (activeProfileIds.length > 0) {
                        text = await privacy_1.privacyService.redactWithMultipleProfiles(text, activeProfileIds, asHtml);
                    }
                    else if (asHtml) {
                        text = await privacy_1.privacyService.redactWithMultipleProfiles(text, [], true);
                    }
                    currentTotalSize += text.length;
                    results.push({
                        ...file,
                        content: text,
                        status: 'ok'
                    });
                }
                catch (err) {
                    results.push({
                        ...file,
                        content: null,
                        status: 'error',
                        error: err.message
                    });
                }
            }
            res.setHeader('X-File-Count', results.length.toString());
            res.json(results);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getTags(req, res) {
        try {
            const userId = req.user.id;
            const tags = await repository_1.tagRepository.getAll(userId);
            res.json(tags);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async search(req, res) {
        try {
            const userId = req.user.id;
            const apiKey = req.apiKey;
            const { filename, content, directory } = req.query;
            let results = await repository_1.searchRepository.search(userId, { filename, content, directory });
            if (apiKey && apiKey.privacyProfileIds && apiKey.privacyProfileIds.length > 0) {
                results = await Promise.all(results.map(async (f) => {
                    if (f.snippet) {
                        f.snippet = await privacy_1.privacyService.redactWithMultipleProfiles(f.snippet, apiKey.privacyProfileIds);
                    }
                    return f;
                }));
            }
            res.json(results);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    },
    async getFileText(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const apiKey = req.apiKey;
            const { profileId, format } = req.query;
            const asHtml = format === 'html';
            const asJson = format === 'json';
            let allowedTagIds = undefined;
            if (apiKey) {
                allowedTagIds = apiKey.permissions
                    .filter(p => p.startsWith('tag:'))
                    .map(p => parseInt(p.split(':')[1]))
                    .filter(id => !isNaN(id));
            }
            const sql = `SELECT f.path, f.name, f.extension, f.mimeType, f.size FROM FileHandle f JOIN Scope s ON f.scopeId = s.id WHERE f.id = ? AND s.userId = ?`;
            const file = client_1.db.prepare(sql).get(id, userId);
            if (!file)
                return res.status(404).json({ error: 'File not found' });
            if (allowedTagIds && allowedTagIds.length > 0) {
                const tagCheck = client_1.db.prepare('SELECT 1 FROM _FileHandleToTag WHERE A = ? AND B IN (' + allowedTagIds.map(() => '?').join(',') + ')').get(id, ...allowedTagIds);
                if (!tagCheck)
                    return res.status(403).json({ error: 'Access denied' });
            }
            let text = await file_service_1.fileService.extractText(file.path, file.extension);
            // Use profiles from API Key or manual override (for preview)
            let profileIdsToApply = [];
            if (apiKey && apiKey.privacyProfileIds && apiKey.privacyProfileIds.length > 0) {
                profileIdsToApply = apiKey.privacyProfileIds;
            }
            else if (profileId) {
                profileIdsToApply = Array.isArray(profileId)
                    ? profileId.map(pid => Number(pid))
                    : [Number(profileId)];
            }
            if (profileIdsToApply.length > 0) {
                text = await privacy_1.privacyService.redactWithMultipleProfiles(text, profileIdsToApply, asHtml);
            }
            else if (asHtml) {
                // If HTML requested but no redaction, still escape it
                text = await privacy_1.privacyService.redactWithMultipleProfiles(text, [], true);
            }
            if (asJson) {
                return res.json({
                    id: parseInt(id),
                    name: file.name,
                    extension: file.extension,
                    mimeType: file.mimeType,
                    size: file.size,
                    content: text
                });
            }
            res.setHeader('Content-Type', asHtml ? 'text/html' : 'text/plain');
            res.send(text);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};
