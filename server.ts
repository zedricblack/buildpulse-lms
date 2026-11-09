import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from './src/db/seed.ts';
import { syncAllFromSqlToFirestore } from './src/lib/firestore-sync.ts';
import { router as apiRouter } from './server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      system: 'BuildPulse Construction LMS',
      database: 'Cloud SQL for PostgreSQL & Firebase Firestore',
      timestamp: new Date().toISOString()
    });
  });

  // Seed Cloud SQL database if needed
  try {
    const seedResult = await seedDatabase(false);
    console.log('[BuildPulse LMS] Cloud SQL Database status:', seedResult.message);
  } catch (seedErr) {
    console.warn('[BuildPulse LMS] Notice on database seeding:', seedErr);
  }

  // Ensure all Cloud SQL workers and records are synced to Firebase Firestore
  try {
    await syncAllFromSqlToFirestore();
  } catch (fsErr) {
    console.warn('[BuildPulse LMS] Notice on initial Firestore sync:', fsErr);
  }

  if (!isProd) {
    // Mount Vite middlewares in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static production build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BuildPulse LMS] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[BuildPulse LMS] Failed to start server:', err);
  process.exit(1);
});
