# Universe56

Three independent applications in one Next.js shell (App Router, TypeScript).
Each app is independent: its own route group, its own Postgres schema, its own
API namespace, and its own object-storage prefix. The only shared layer is
Neon infrastructure (Postgres, Managed Auth, Object Storage, AI Gateway,
Functions, Realtime) and the connection registry — all 26 of the owner's API
connections, each grouped into exactly one app and used by that app's
workflow engine.

## The 3 apps

### 1. Reach — Communications & Outreach OS (9 connections)

Routes `/reach`, schema `reach`, API `/api/reach`, storage prefix `reach/`.

Workflow: lead intake → AI draft (Neon AI Gateway) → email channel check →
SMS/voice channel check → social channel check → direct-mail check.
Runs log to `reach.workflow_runs`.

| Connection | Kind | Workflow step |
|---|---|---|
| Gmail | oauth_connector | email channel check |
| AgentMail | custom_api_key | email channel check |
| EngineMailer | custom_api_key | email channel check |
| Telnyx | custom_api_key | sms/voice channel check |
| AgentPhone | custom_api_key | sms/voice channel check |
| ScreenMyCalls Voice | custom_api_key | sms/voice channel check |
| Thanks.io | custom_api_key | direct-mail check |
| Zernio | custom_api_key | social channel check |
| Postforme (Post For Me) | custom_api_key | social channel check |

### 2. Studio — Content & Media OS (6 connections)

Routes `/studio`, schema `studio`, API `/api/studio`, storage prefix `studio/`.

Workflow: content brief → design check → media check → social check →
inbox check → audio check. Runs log to `studio.workflow_runs`.

| Connection | Kind | Workflow step |
|---|---|---|
| Facebook | oauth_connector | social check |
| Instagram | oauth_connector | social check |
| Instagram Messages | oauth_connector | inbox check |
| Figma | oauth_connector | design check |
| Spotify | oauth_connector | audio check |
| MediaVault | custom_api_key | media check |

### 3. Ops — Business Operations & Money OS (11 connections)

Routes `/ops`, schema `ops`, API `/api/ops`, storage prefix `ops/`.

Workflow: prospect research → AI enrichment (Neon AI Gateway + Atlas Cloud)
→ knowledge store check → money check → build/deploy check → infra check.
Runs log to `ops.workflow_runs`.

| Connection | Kind | Workflow step |
|---|---|---|
| Google Docs | oauth_connector | knowledge store check |
| Google Drive | oauth_connector | knowledge store check |
| Google Sheets | oauth_connector | knowledge store check |
| GitHub | oauth_connector | build/deploy check |
| Plaid | oauth_connector | money check |
| Vercel | oauth_connector | build/deploy check |
| Cloudflare | custom_api_key | infra check |
| Neon | custom_api_key | infra check |
| Foursquare | custom_api_key | prospect research |
| Atlas Cloud | custom_api_key | ai enrichment |
| Firecrawl | custom_api_key | prospect research |

## Architecture

- `src/lib/connections.ts` — typed registry of all 26 connections
  (id, app, name, kind, host, purpose, workflow step, S3 prefix).
  `GET /api/connections` returns it as JSON with a count check (== 26).
- `src/lib/clients/<app>/<id>.ts` — one client module per connection,
  each exporting `check(): Promise<{ ok, detail, mode }>`.
  **Honesty rule:** the Next app holds no raw keys for any of the 26
  connections. OAuth connections are mediated by the Muse connector
  layer, and custom API keys live only in the Muse Secure Vault — so
  `check()` verifies registry registration and returns a structured
  "connector-mediated" status instead of faking a live call. Safety rule:
  checks are read/status only — the workflows never send real email,
  texts, posts or mail, and never spend money.
- `src/lib/workflow.ts` — per-app workflow engine: runs every connection
  check for the app, runs the app's AI step against the Neon AI Gateway,
  and inserts the run into `<schema>.workflow_runs`.
- `src/lib/db.ts` — Postgres via `@neondatabase/serverless` (HTTP driver).
  Schemas `reach` / `studio` / `ops`, each with `workflow_runs`
  (id, started_at, finished_at, steps jsonb, status) and `items` tables.
- `src/lib/ai.ts` — Neon AI Gateway (OpenAI-compatible). Discovers an
  enabled model from `GET /v1/models` first; never hardcodes a model id.
- Neon Functions in `neon.ts`: `hello` (existing) plus `reach`, `studio`,
  `ops` (sources in `functions/`), each returning its app's JSON status.
- No credential value is ever hardcoded, logged, or returned by an API
  route — routes report status booleans and hostnames only. All secrets
  come from `.env.local` (gitignored) via `process.env`.

## Neon service endpoints

| Route | Proves |
|---|---|
| `GET /api/neon/init` | Creates the 3 schemas + tables |
| `GET /api/neon/ai-test` | AI Gateway model discovery + one-line completion |
| `GET /api/neon/storage-test` | S3 PUT + GET round-trip per app prefix (`<app>/health-<app>.txt`) |
| `GET /api/neon/auth-status` | Managed Auth reachable (invalid-cred sign-in probe → structured 4xx) |
| `GET /api/neon/realtime-status` | Realtime endpoint configured + HTTPS reachability |
| `GET /api/<app>/run` | Executes the app workflow and returns the logged run row |
| `GET /api/<app>/runs` | Run history from the app's schema |
| `/login` | Browser sign-in form posting to `{NEON_AUTH_BASE_URL}/sign-in/email` |

Note on storage: this sandbox egresses through a proxy that Node `fetch`
honors automatically but the raw `https` module does not, so the S3 client
is given an explicit proxy agent from `HTTPS_PROXY` when one is set
(see `src/app/api/neon/storage-test/route.ts`). In a normal hosting
environment no proxy is set and the plain AWS SDK path is used.

## Run / test

```bash
npm install
npm run build
npm run start        # port 3000
```

Then:

```bash
curl localhost:3000/api/connections        # count must be 26, countOk true
curl localhost:3000/api/neon/init
curl localhost:3000/api/neon/storage-test
curl localhost:3000/api/neon/auth-status
curl localhost:3000/api/neon/realtime-status
curl localhost:3000/api/neon/ai-test
curl localhost:3000/api/reach/run
curl localhost:3000/api/studio/run
curl localhost:3000/api/ops/run
```

## Known service status (verified 2026-11-05)

- Postgres, Object Storage, Auth, Realtime: working end to end.
- **AI Gateway: blocked by the Neon account plan.** `GET /v1/models`
  returns 63 models, all `enabled: false` with
  `unavailable_reason: paid_plan_required`, and a direct
  `POST /v1/chat/completions` returns HTTP 403: "AI Gateway is not
  enabled on this account's current plan." The app code handles this
  honestly: `/api/neon/ai-test` returns 502 with that exact detail, and
  each workflow run logs the AI step as failed with the same reason
  (run status `completed_with_warnings`) instead of faking success.
  Upgrading the Neon plan in Billing enables it with no code change.
