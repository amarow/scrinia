import express from 'express';
import cors from 'cors';
import { db } from './db/client';
import { crawlerService } from './services/crawler';
import { authenticateToken } from './auth';

// Route Imports
import authRoutes from './routes/auth.routes';
import fsRoutes from './routes/fs.routes';
import apiKeyRoutes from './routes/apiKey.routes';
import privacyRoutes from './routes/privacy.routes';
import scopeRoutes from './routes/scope.routes';
import fileRoutes from './routes/file.routes';
import tagRoutes from './routes/tag.routes';
import searchRoutes from './routes/search.routes';
import settingsRoutes from './routes/settings.routes';
import publicRoutes from './routes/public.routes';

const app = express();
const PORT = process.env.PORT || 3001;

console.log("!!! SERVER STARTUP - MODULAR ROUTER VERSION " + Date.now() + " !!!");

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Public Routes ---
app.get('/', (req, res) => {
  res.send('Tagzilla Backend is running!');
});

// --- Register Modular Routes ---
app.use('/api', authRoutes);
app.use('/api/fs', fsRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/scopes', scopeRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', settingsRoutes); // For /api/preferences (compatibility)
app.use('/api/v1', publicRoutes);

// Status Route
app.get('/status', authenticateToken, async (req, res) => {
  try {
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM FileHandle').get() as { count: number };
    const scopeCount = db.prepare('SELECT COUNT(*) as count FROM Scope').get() as { count: number };
    res.json({ status: 'ok', fileCount: fileCount.count, scopeCount: scopeCount.count });
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Start Server & Crawler
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Initialize base service (worker pool)
  await crawlerService.init();
});
