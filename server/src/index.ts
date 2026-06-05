import { createApp } from './app.js';
import { getAppConfig } from './config/env.js';
import { prisma } from './db/prisma.js';

const appConfig = getAppConfig();
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
