"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("./db/client");
const crawler_1 = require("./services/crawler");
const auth_1 = require("./auth");
// Route Imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const fs_routes_1 = __importDefault(require("./routes/fs.routes"));
const apiKey_routes_1 = __importDefault(require("./routes/apiKey.routes"));
const privacy_routes_1 = __importDefault(require("./routes/privacy.routes"));
const scope_routes_1 = __importDefault(require("./routes/scope.routes"));
const file_routes_1 = __importDefault(require("./routes/file.routes"));
const tag_routes_1 = __importDefault(require("./routes/tag.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
console.log("!!! SERVER STARTUP - MODULAR ROUTER VERSION " + Date.now() + " !!!");
app.use((0, cors_1.default)({
    exposedHeaders: ['X-File-Count']
}));
app.use(express_1.default.json({ limit: '50mb' }));
// --- Public Routes ---
app.get('/', (req, res) => {
    res.send('Scrinia Backend is running!');
});
// --- Register Modular Routes ---
app.use('/api', auth_routes_1.default);
app.use('/api/fs', fs_routes_1.default);
app.use('/api/keys', apiKey_routes_1.default);
app.use('/api/privacy', privacy_routes_1.default);
app.use('/api/scopes', scope_routes_1.default);
app.use('/api/files', file_routes_1.default);
app.use('/api/tags', tag_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api', settings_routes_1.default); // For /api/preferences (compatibility)
app.use('/api/v1', public_routes_1.default);
// Status Route
app.get('/status', auth_1.authenticateToken, async (req, res) => {
    try {
        const fileCount = client_1.db.prepare('SELECT COUNT(*) as count FROM FileHandle').get();
        const scopeCount = client_1.db.prepare('SELECT COUNT(*) as count FROM Scope').get();
        res.json({ status: 'ok', fileCount: fileCount.count, scopeCount: scopeCount.count });
    }
    catch (error) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});
// Start Server & Crawler
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Initialize base service (worker pool)
    await crawler_1.crawlerService.init();
});
