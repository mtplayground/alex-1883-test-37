import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { checkDatabaseConnection } from './db/health.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { postsRouter } from './routes/posts.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

const serverModuleDir = dirname(fileURLToPath(import.meta.url));
const clientDistPath = join(serverModuleDir, '..', '..', 'client', 'dist');
const clientIndexPath = join(clientDistPath, 'index.html');
const clientRoutePattern = /^\/(?:$|create\/?$|posts\/[^/]+\/?$|users\/[^/]+\/?$)/;

function requestPrefersHtml(request: express.Request): boolean {
  const accept = request.get('accept') ?? '';

  return accept.includes('text/html') && !accept.includes('application/json');
}

function mountClientApp(app: express.Express): boolean {
  if (!existsSync(clientIndexPath)) {
    return false;
  }

  app.use(express.static(clientDistPath));
  app.get(clientRoutePattern, (request, response, next) => {
    if (!requestPrefersHtml(request)) {
      next();
      return;
    }

    response.sendFile(clientIndexPath);
  });

  return true;
}

export function createApp(): express.Express {
  const app = express();
  const hasClientApp = mountClientApp(app);

  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use(meRouter);
  app.use(postsRouter);
  app.use(uploadsRouter);
  app.use(usersRouter);

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok', service: 'myClawTeam' });
  });

  app.get('/health/database', async (_request, response) => {
    try {
      const database = await checkDatabaseConnection();
      response.status(200).json({ status: 'ok', database });
    } catch (error) {
      console.error('Database health check failed', error);
      response.status(503).json({
        status: 'error',
        database: { connected: false },
      });
    }
  });

  if (!hasClientApp) {
    app.get('/', (_request, response) => {
      response.status(200).json({
        name: 'myClawTeam',
        message: 'API server initialized',
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
