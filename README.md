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

Create local environment settings:

```bash
cp .env.example .env
```

Build all packages:

```bash
npm run build
```

Run all tests, including backend, frontend component, and Playwright E2E tests:

```bash
npm run test
```

Run the backend API on `0.0.0.0:8080`:

```bash
npm run dev:server
```

Start Google sign-in from the backend:

```bash
http://localhost:8080/auth/google
```

Fetch the current signed-in user:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8080/me
```

Upload an image and create a post:

```bash
curl -H "Authorization: Bearer <token>" -F "image=@/path/to/image.jpg" http://localhost:8080/uploads/images
curl -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"imageKey":"<uploaded image key>","caption":"First win"}' \
  http://localhost:8080/posts
```

Run the frontend development server:

```bash
npm run dev:client
```

Set `VITE_API_BASE_URL` when the frontend should call a backend on a different
origin. When it is unset, client API requests use the current origin.

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

## Deployment Runbook

This app is a two-package Node.js monorepo:

- `client/` builds a static React/Vite bundle.
- `server/` runs the Express API and serves JSON endpoints.

### Required Services

- PostgreSQL for all persistent state.
- S3-compatible object storage for uploaded post images.
- Google OAuth credentials for sign-in.
- A long random `JWT_SECRET` with at least 32 characters.

### Environment

Copy `.env.example` and provide production values. The server validates required
environment variables on boot and exits before listening when configuration is
missing or malformed.

Important deployment values:

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
DATABASE_URL=postgresql://...
OBJECT_STORAGE_ACCESS_KEY_ID=...
OBJECT_STORAGE_SECRET_ACCESS_KEY=...
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_ENDPOINT=https://...
OBJECT_STORAGE_PREFIX=myclawteam
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://<api-origin>/auth/google/callback
JWT_SECRET=<32+ character random secret>
```

Set `VITE_API_BASE_URL` at frontend build time only when the browser must call an
API on a different origin. Leave it empty for same-origin deployments.

### Build And Migrate

```bash
npm ci
npm run build
npm run prisma:migrate --workspace server
```

The migration command uses `DATABASE_URL` and applies committed Prisma
migrations. Do not use SQLite or file-based persistence for production state.

### Start

```bash
npm run start
```

The API listens on `HOST` and `PORT`; the default production-compatible binding
is `0.0.0.0:8080`.

### Health Checks

Use these endpoints after deployment:

```bash
curl http://<host>:8080/health
curl http://<host>:8080/health/database
```

`/health/database` returns `503` when PostgreSQL cannot be reached.

### Smoke Test

1. Open `/auth/google` and complete Google sign-in.
2. Use the returned bearer token with `/me`.
3. Upload an image through `/uploads/images`.
4. Create a post through `/posts`.
5. Confirm `/feed` returns the new post for the signed-in user.

The automated equivalent is:

```bash
npm run test:e2e
```

### Operational Notes

- Server request fallthroughs return JSON `404` responses.
- Unhandled Express errors are logged with name, message, stack, method, and path
  before returning a generic JSON `500`.
- Invalid JSON request bodies return a JSON `400`.
- Object storage keys are normalized through the configured storage prefix before
  upload and signed URL generation.
