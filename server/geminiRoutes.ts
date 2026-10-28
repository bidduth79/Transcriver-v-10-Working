// The browser's Gemini requests (generate, stream, file upload/get/delete), answered through the server
import express from 'express';
import { runWithServerFallback, statusFromError, abortWhenClientLeaves } from './geminiServer.ts';

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
      const signal = abortWhenClientLeaves(res);
      const response = await runWithServerFallback(apiKey, (ai) =>
        ai.models.generateContent({ model, contents, config: { ...config, abortSignal: signal } }), signal
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
      const stream = await runWithServerFallback(apiKey, (ai) =>
        ai.models.generateContentStream({ model, contents, config: { ...config, abortSignal: signal } }), signal
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
};
