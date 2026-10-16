# BioEvidence AI Supabase Setup

Run these migrations in the Supabase SQL Editor before testing account pages or
live QA:

1. `migrations/202608130001_auth_workspace.sql`
2. `migrations/202608130002_live_qa_jobs.sql`
3. `migrations/202608150001_adaptive_evidence_sources.sql`
4. `migrations/202608150002_worker_heartbeat_and_recovery.sql`

Required project settings:

- Authentication > URL Configuration > Site URL: your local or deployed BioEvidence URL.
- Authentication > URL Configuration > Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback` if you use that host
  - your own preview or production URL with `/auth/callback`
- Authentication > Providers > Google: enable after creating a Google OAuth client.

For Google OAuth, use the callback URL shown by **your Supabase project**:

`https://<your-project-ref>.supabase.co/auth/v1/callback`

Live QA requires these server-only environment variables in Vercel:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVE_QA_WORKER_SECRET`

Use the same `LIVE_QA_WORKER_SECRET` when starting the local worker. The worker
does not need the Supabase service role key because it talks to protected
BioEvidence worker endpoints.
