import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app.ts';
import { startAutomaticBackupScheduler } from './server/backup.ts';

async function startServer() {
  const app = createApiApp();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
  const PORT = !Number.isNaN(cliPort) && cliPort > 0
    ? cliPort
    : isProduction
    ? Number(process.env.PORT) || 3000
    : 3000;

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    app.use((req, res, next) => {
      if (req.url === '/@vite/client' || req.url.startsWith('/@vite/client?')) {
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];

        res.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8'));
          }
          if (typeof encoding === 'function') {
            (encoding as () => void)();
          } else if (typeof cb === 'function') {
            (cb as () => void)();
          }
          return true;
        }) as typeof res.write;

        res.end = ((chunk?: unknown, encoding?: unknown, cb?: unknown) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8'));
          }
          let body = Buffer.concat(chunks).toString('utf8');
          body = body.replace(
            /new WebSocket\([^)]*\)/g,
            '({ OPEN: 1, readyState: 1, addEventListener() {}, removeEventListener() {}, send() {}, close() {} })'
          );
          res.removeHeader('Content-Length');
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          const callback = typeof chunk === 'function' ? chunk : typeof encoding === 'function' ? encoding : cb;
          return origEnd(body, 'utf8', callback as (() => void) | undefined);
        }) as typeof res.end;
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bajrang Dal, VHP & Durga Vahini platform running on http://0.0.0.0:${PORT}`);
    startAutomaticBackupScheduler();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
