import express from 'express';
import http from 'http';
import path from 'path';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3000;

const getServerEnvKey = (): string =>
  (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_API_KEY_1 ||
    ''
  ).trim();

const resolveApiKey = (providedKey?: unknown): string => {
  const candidate = typeof providedKey === 'string' ? providedKey.trim() : '';
  if (candidate && candidate !== 'SERVER_KEY') return candidate;
  return getServerEnvKey();
};

const createServerGeminiClient = (apiKey: string) =>
  new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

const statusFromError = (err: unknown): number => {
  const status = (err as { status?: number } | null | undefined)?.status;
  if (typeof status === 'number' && status >= 400 && status < 600) return status;
  const msg = String((err as { message?: string } | null | undefined)?.message ?? err ?? '');
  if (/\b429\b|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  if (/\b503\b|UNAVAILABLE|high demand|overloaded/i.test(msg)) return 503;
  if (/\b403\b|PERMISSION_DENIED|denied access|suspended/i.test(msg)) return 403;
  if (/\b400\b|INVALID_ARGUMENT|API_KEY_INVALID|api key not valid/i.test(msg)) return 400;
  return 500;
};

const runWithServerFallback = async <T>(
  requestedKey: unknown,
  op: (ai: GoogleGenAI) => Promise<T>
): Promise<T> => {
  const primaryKey = resolveApiKey(requestedKey);
  if (!primaryKey) {
    throw Object.assign(new Error('No API Key configured on server.'), { status: 400 });
  }
  try {
    return await op(createServerGeminiClient(primaryKey));
  } catch (err) {
    const serverKey = getServerEnvKey();
    if (serverKey && serverKey !== primaryKey) {
      return await op(createServerGeminiClient(serverKey));
    }
    throw err;
  }
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    next();
  });

  app.post(
    '/api/gemini/files/upload',
    express.raw({ type: '*/*', limit: '550mb' }),
    async (req, res) => {
      try {
        const mimeType = String(req.headers['x-gemini-mime-type'] || req.headers['content-type'] || 'audio/mpeg');
        const requestedKey = req.headers['x-gemini-key'];
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
        const blob = new Blob([buffer], { type: mimeType });
        const file = await runWithServerFallback(requestedKey, (ai) =>
          ai.files.upload({ file: blob, config: { mimeType } })
        );
        res.json({ name: file.name, uri: file.uri, state: file.state });
      } catch (err) {
        const status = statusFromError(err);
        res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
      }
    }
  );

  app.use(express.json({ limit: '50mb' }));

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { apiKey, model, contents, config } = req.body ?? {};
      const response = await runWithServerFallback(apiKey, (ai) =>
        ai.models.generateContent({ model, contents, config })
      );
      res.json({
        ...response,
        text: response.text,
        candidates: response.candidates,
        usageMetadata: response.usageMetadata,
        promptFeedback: response.promptFeedback,
      });
    } catch (err) {
      const status = statusFromError(err);
      res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
    }
  });

  app.post('/api/gemini/stream', async (req, res) => {
    try {
      const { apiKey, model, contents, config } = req.body ?? {};
      const stream = await runWithServerFallback(apiKey, (ai) =>
        ai.models.generateContentStream({ model, contents, config })
      );
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      for await (const chunk of stream) {
        res.write(
          `data: ${JSON.stringify({
            text: chunk.text,
            candidates: chunk.candidates,
            usageMetadata: chunk.usageMetadata,
          })}\n\n`
        );
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const status = statusFromError(err);
      if (!res.headersSent) {
        res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
      } else {
        res.write(`data: ${JSON.stringify({ error: (err as Error)?.message || String(err) })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/gemini/files/get', async (req, res) => {
    try {
      const { apiKey, name } = req.body ?? {};
      const file = await runWithServerFallback(apiKey, (ai) => ai.files.get({ name }));
      res.json({ name: file.name, uri: file.uri, state: file.state });
    } catch (err) {
      const status = statusFromError(err);
      res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
    }
  });

  app.post('/api/gemini/files/delete', async (req, res) => {
    try {
      const { apiKey, name } = req.body ?? {};
      await runWithServerFallback(apiKey, (ai) => ai.files.delete({ name }));
      res.json({ ok: true });
    } catch (err) {
      const status = statusFromError(err);
      res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
    if (pathname === '/api/gemini/live' || pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs) => {
    const apiKey = getServerEnvKey();
    if (!apiKey) {
      clientWs.close(1011, 'No API Key configured');
      return;
    }
    const ai = createServerGeminiClient(apiKey);
    const sessionPromise = ai.live.connect({
      model: 'gemini-3.5-transcribe-live',
      config: { responseModalities: [Modality.AUDIO] },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          clientWs.send(JSON.stringify(message));
        },
      },
    });
    clientWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        sessionPromise.then((session) => {
          if (parsed.audio) {
            session.sendRealtimeInput({ audio: parsed.audio });
          } else if (parsed.text) {
            session.sendRealtimeInput({ text: parsed.text });
          }
        });
      } catch {
        // Ignore malformed frame
      }
    });
    clientWs.on('close', () => {
      sessionPromise.then((session) => session.close()).catch(() => {});
    });
  });

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

  server.listen(PORT, '0.0.0.0', () => {
    console.info(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
