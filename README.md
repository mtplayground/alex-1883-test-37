# myClawTeam

Monorepo for the myClawTeam web application.

## Packages

- `client/`: React + Vite frontend.
- `server/`: Express backend API.

## Commands

Install dependencies:

```bash
npm install
```

Build all packages:

```bash
npm run build
```

Run the backend API on `0.0.0.0:8080`:

```bash
npm run dev:server
```

Run the frontend development server:

```bash
npm run dev:client
```

Generate the Prisma client:

```bash
npm run prisma:generate --workspace server
```

Apply committed database migrations:

```bash
export DATABASE_URL=$(cat /workspace/.database_url)
npm run prisma:migrate --workspace server
```

Object storage uses an S3-compatible client. Configure these environment
variables before calling storage helpers:

```bash
OBJECT_STORAGE_ACCESS_KEY_ID=...
OBJECT_STORAGE_SECRET_ACCESS_KEY=...
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_ENDPOINT=...
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_PREFIX=myclawteam
OBJECT_STORAGE_FORCE_PATH_STYLE=true
```
