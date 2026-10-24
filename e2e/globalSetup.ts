import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';

// Serves the production build (`npm run e2e` builds it first) for the browser tests
export const E2E_PORT = 4174;
export const E2E_URL = `http://localhost:${E2E_PORT}/`;

let server: ChildProcess | null = null;

const waitForServer = async (timeoutMs: number) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(E2E_URL)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Preview server did not start on ${E2E_URL}`);
};

export const setup = async () => {
  if (!existsSync('dist/index.html')) throw new Error('No build found: run "npm run e2e", which builds first');
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(E2E_PORT), '--strictPort'], { stdio: 'ignore' });
  await waitForServer(30000);
};

export const teardown = () => {
  server?.kill();
  server = null;
};
