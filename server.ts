import express from 'express';
import http from 'http';
import path from 'path';
import { registerGeminiRoutes } from './server/geminiRoutes.ts';
import { attachLiveSocket } from './server/liveSocket.ts';

const PORT = Number(process.env.PORT) || 3000;
// On this computer the server answers only this computer, so nobody on the same network can use it.
// A host (AI Studio, Cloud Run) sets PORT and must reach the server from outside, so it listens on all addresses.
const HOST = process.env.HOST || (process.env.PORT || process.env.K_SERVICE ? '0.0.0.0' : '127.0.0.1');

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    next();
  });

  registerGeminiRoutes(app);
  attachLiveSocket(server);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.info(`Server running on http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`);
  });
}

startServer();
