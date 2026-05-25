# Abhyas Backend

Render-hosted API for workflows that must not run directly from the browser:

- organization and admin creation
- organization student creation and password reset
- server-side test session delivery without correct answers
- server-side test grading, attempt writes, answer rows, and leaderboard refresh

The frontend still reads harmless catalog data from Supabase through RLS.

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` or set these environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN`
- `PORT`

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

## Verification

```bash
npm test
npm run build
npm run lint
```

## Load Test

The lightweight load script checks backend HTTP behavior and latency. It requires a real Supabase user token.

```bash
API_URL=http://localhost:8080 AUTH_TOKEN=<supabase-access-token> TEST_ID=<uuid> npm run load:test
```

This is not a substitute for production load testing, but it is useful before deployment.
