import express from 'express';

const DEFAULT_PORT = 8080;
const HOST = process.env.HOST || '0.0.0.0';
const portValue = process.env.PORT || String(DEFAULT_PORT);
const PORT = Number.parseInt(portValue, 10);

if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`Invalid PORT value: ${portValue}`);
}

const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'myClawTeam' });
});

app.get('/', (_request, response) => {
  response.status(200).json({
    name: 'myClawTeam',
    message: 'API server initialized',
  });
});

app.listen(PORT, HOST, () => {
  console.log(`myClawTeam server listening on http://${HOST}:${PORT}`);
});
