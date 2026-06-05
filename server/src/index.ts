import { ConfigError, getAppConfig, type AppConfig } from './config/env.js';

function readBootConfig(): AppConfig {
  try {
    return getAppConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error('Invalid myClawTeam server configuration', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      process.exit(1);
    }

    throw error;
  }
}

const appConfig = readBootConfig();
const [{ createApp }, { prisma }] = await Promise.all([
  import('./app.js'),
  import('./db/prisma.js'),
]);
const app = createApp();

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
