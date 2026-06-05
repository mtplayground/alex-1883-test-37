import express from 'express';
import { getAppConfig } from './config/env.js';
import { checkDatabaseConnection } from './db/health.js';
import { prisma } from './db/prisma.js';
import { authRouter } from './routes/auth.js';

const appConfig = getAppConfig();

const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use('/auth', authRouter);

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

const server = app.listen(appConfig.server.port, appConfig.server.host, () => {
  console.log(
    `myClawTeam server listening on http://${appConfig.server.host}:${appConfig.server.port}`,
  );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Received ${signal}. Shutting down myClawTeam server.`);

  server.close(async (error) => {
    if (error) {
      console.error('Error while closing HTTP server', error);
      process.exitCode = 1;
    }

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Error while disconnecting Prisma client', disconnectError);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', (signal) => {
  void shutdown(signal);
});

process.on('SIGTERM', (signal) => {
  void shutdown(signal);
});
