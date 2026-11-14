# Job Search

Search jobs (JSearch), upload a resume, and let Claude rank the best matches. Invite-only: the admin
(`AUTH_USERNAME` / `AUTH_PASSWORD`) adds people on the **Users** page. Each user has their own
resume, matches and saved jobs; the job/search cache is shared. Non-admins get daily limits
(`MATCH_DAILY_LIMIT`, `COVER_DAILY_LIMIT`).

See `.env.example` for all settings.

## Local / Docker

```bash
npm install
npm run dev            # http://localhost:3000, SQLite file in ./data
docker compose up -d   # http://localhost:6973, SQLite file in ./data
```

## Vercel + Turso (free tiers)

Vercel's filesystem doesn't persist, so production uses [Turso](https://turso.tech) (hosted SQLite).

1. Create the database:
   ```bash
   turso db create job-search
   turso db show job-search --url      # → TURSO_DATABASE_URL
   turso db tokens create job-search   # → TURSO_AUTH_TOKEN
   ```
2. Import the repo into Vercel and set these environment variables: `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET`, `RAPIDAPI_KEY`,
   `ANTHROPIC_API_KEY` (optional: `ANTHROPIC_MODEL`, `MATCH_DAILY_LIMIT`, `COVER_DAILY_LIMIT`).
3. Deploy. Tables are created on first request. Sign in as the admin and invite people from **Users**.

To move your local data to Turso: `turso db shell job-search < dump.sql` after
`sqlite3 data/job-search.db .dump > dump.sql`.

## Tests

```bash
npm test && npm run typecheck && npm run lint
```
