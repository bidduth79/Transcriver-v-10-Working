// Live transcription over a WebSocket (/api/gemini/live), using the server's own key
import type http from 'http';
import { LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';
import { getServerEnvKey, createServerGeminiClient } from './geminiServer.ts';

export const attachLiveSocket = (server: http.Server) => {
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
};
