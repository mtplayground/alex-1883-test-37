import express from 'express';
import { checkDatabaseConnection } from './db/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { postsRouter } from './routes/posts.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

export function createApp(): express.Express {
  const app = express();

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

  app.get('/', (_request, response) => {
    response.status(200).json({
      name: 'myClawTeam',
      message: 'API server initialized',
    });
  });

  return app;
}
