// The browser's Gemini requests (generate, stream, file upload/get/delete), answered through the server
import express from 'express';
import { runWithKey, statusFromError, abortWhenClientLeaves } from './geminiServer.ts';

export const registerGeminiRoutes = (app: express.Express) => {
  app.post(
    '/api/gemini/files/upload',
    express.raw({ type: '*/*', limit: '550mb' }),
    async (req, res) => {
      try {
        const mimeType = String(req.headers['x-gemini-mime-type'] || req.headers['content-type'] || 'audio/mpeg');
        const requestedKey = req.headers['x-gemini-key'];
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
        const blob = new Blob([buffer], { type: mimeType });
        const file = await runWithKey(requestedKey, (ai) =>
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

  // The models a key can use, for "Find new models" in Settings (listing spends no quota)
  app.post('/api/gemini/models', async (req, res) => {
    try {
      const models = await runWithKey(req.body?.apiKey, async (ai) => {
        const found: { id: string; label: string; inputTokenLimit?: number; actions: string[] }[] = [];
        for await (const model of await ai.models.list({ config: { pageSize: 1000 } })) {
          found.push({
            id: String(model.name ?? '').replace(/^models\//, ''),
            label: model.displayName ?? '',
            inputTokenLimit: model.inputTokenLimit,
            actions: model.supportedActions ?? [],
          });
        }
        return found;
      });
      res.json({ models });
    } catch (err) {
      const status = statusFromError(err);
      res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
    }
  });

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { apiKey, model, contents, config } = req.body ?? {};
      const signal = abortWhenClientLeaves(res);
      const response = await runWithKey(apiKey, (ai) =>
        ai.models.generateContent({ model, contents, config: { ...config, abortSignal: signal } })
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
      const signal = abortWhenClientLeaves(res);
      const stream = await runWithKey(apiKey, (ai) =>
        ai.models.generateContentStream({ model, contents, config: { ...config, abortSignal: signal } })
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
      const file = await runWithKey(apiKey, (ai) => ai.files.get({ name }));
      res.json({ name: file.name, uri: file.uri, state: file.state });
    } catch (err) {
      const status = statusFromError(err);
      res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
    }
  });

  app.post('/api/gemini/files/delete', async (req, res) => {
    try {
      const { apiKey, name } = req.body ?? {};
      await runWithKey(apiKey, (ai) => ai.files.delete({ name }));
      res.json({ ok: true });
    } catch (err) {
      const status = statusFromError(err);
      res.status(status).json({ error: { message: (err as Error)?.message || String(err), status } });
    }
  });
};
