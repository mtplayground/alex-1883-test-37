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
