# Abhyas Backend

Render-hosted API for workflows that must not run directly from the browser:

- tenant resolution (subdomain / `X-Abhyas-Tenant`)
- alias login (`POST /api/auth/login`)
- RBAC permissions on organization routes
- organization and admin creation
- organization student creation (optional `aliasLocal`) and password reset
- seat usage (`GET /api/org/seats`)
- batches, teachers, Razorpay checkout + webhook
- server-side test session delivery without correct answers
- server-side test grading, attempt writes, answer rows, and leaderboard refresh

The frontend still reads harmless catalog data from Supabase through RLS.

## Local Development

```bash
npm install
npm run env:init   # creates .env from .env.example if missing/empty
# Edit backend/.env — set Supabase keys, then save the file (Ctrl+S)
npm run dev
```

`npm run dev` loads `backend/.env` automatically. Required variables:

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
