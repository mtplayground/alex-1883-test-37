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
