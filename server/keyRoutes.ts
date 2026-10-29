// The .env Gemini keys as the Settings modal sees them: names and last four characters, never the keys
import express from 'express';
import { loadEnvKeys, publicEnvKeys, keyFromToken } from './envKeys.ts';
import { createServerGeminiClient, statusFromError } from './geminiServer.ts';

export const registerKeyRoutes = (app: express.Express) => {
  app.get('/api/keys', (_req, res) => {
    res.json({ keys: publicEnvKeys() });
  });

  // After .env was edited: read it again, no restart needed
  app.post('/api/keys/reload', (_req, res) => {
    loadEnvKeys();
    res.json({ keys: publicEnvKeys() });
  });

  // Whether a key works, without spending any quota (reading a model's details is free)
  app.post('/api/keys/test', express.json(), async (req, res) => {
    const key = keyFromToken(String(req.body?.token ?? ''));
    if (!key) return void res.status(404).json({ ok: false, message: 'Key not found in .env' });
    try {
      await createServerGeminiClient(key).models.get({ model: 'gemini-3.5-flash' });
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, status: statusFromError(err), message: (err as Error)?.message || String(err) });
    }
  });
};
