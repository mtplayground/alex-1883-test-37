# myClawTeam Product Contract

myClawTeam is a social photo-sharing web application for posting images with
captions, viewing a personalized feed, and interacting through likes, comments,
and follow relationships.

## Current Product

- Users sign in with Google OAuth. The backend exchanges the Google code,
  upserts the user, and issues JWT bearer sessions.
- The signed-in header shows the current user's name and avatar, and the client
  stores and sends the bearer token through a shared API client.
- Users can upload post images, create posts with optional captions, view a
  paginated feed, open post detail pages, and delete their own posts.
- Post cards and detail views show author information, image URLs generated from
  object storage, captions, like counts, comment counts, like/unlike controls,
  comment lists, and comment input.
- Users can view profiles with post grids, follower/following counts, and a
  follow/unfollow control.

## Architecture

- Monorepo with `client/` for the React + Vite frontend and `server/` for the
  Express API.
- In production, the Express server serves the built React app from
  `client/dist` and exposes API routes from the same origin.
- Persistent state is PostgreSQL only, accessed through Prisma models and
  migrations. The schema includes `users`, `posts`, `likes`, `comments`, and
  `follows`.
- Uploaded images are stored in S3-compatible object storage. Storage keys are
  normalized through the configured object storage prefix before upload or
  signed URL generation.
- Runtime configuration is centralized in environment loading. PostgreSQL and a
  sufficiently long JWT secret are required; Google OAuth and object storage are
  enabled only when their full credential sets are configured. Invalid required
  deployment configuration fails during server boot.
- The server listens on `0.0.0.0:8080` by default and exposes JSON APIs plus
  `/health` and `/health/database`.

## Conventions

- Use environment variables documented in `.env.example`; never hardcode
  database or storage credentials.
- Use committed Prisma migrations for database changes.
- API errors return structured JSON. Unhandled Express errors are logged with
  name, message, stack, method, and path before returning a generic `500`.
- Client API requests use `VITE_API_BASE_URL` only when the API is on a
  different origin.
- Primary validation commands are `npm run format`, `npm run test`,
  `npm run lint`, and `npm run build`.

## Test Coverage

- Backend tests cover auth/session behavior, config validation, centralized
  error responses, posts, likes, comments, follows, profiles, and feed logic.
- Frontend component tests cover header/auth, post activity, create-post form,
  feed, and profile/detail rendering.
- Playwright E2E covers mocked Google sign-in, creating a post, and seeing it in
  the feed.
