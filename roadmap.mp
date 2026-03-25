# AI Cycling Coach — roadmap

## Decisions (2026-03-25)

- **Onboarding profile:** Removed optional preferred session duration. Added free-text `notes` (max 2000 chars) stored on `UserProfile`, shown in system prompt as athlete context. Gemini API key is verified server-side via Google `v1beta/models` list before leaving the API key step (route `POST /api/gemini/validate-key`).
- **npm / Node on PATH:** A legacy `node` npm package in `~/node_modules` (v15.4) shadowed Homebrew Node 20 via `~/node_modules/.bin/node`. That old runtime does not resolve `require("node:fs")`, which broke `napi-postinstall` (used by `unrs-resolver` → ESLint). Removed with `npm uninstall node` from the home directory so `which node` points at the real Node 20 binary.
- **Stack:** Next.js App Router, Tailwind, shadcn-style UI (Radix primitives in repo), Strava OAuth, Gemini via `@google/generative-ai`, Vercel Analytics.
- **Persistence (v1):** In-memory `Map` for user records + Strava tokens + encrypted Gemini key (dev/single-instance). Production should use **Vercel KV or Postgres** as in PRD; swap `lib/store.ts` implementation without changing route handlers.
- **Session:** `iron-session` cookie with `athleteId` only; Strava user id is the identifier. `SESSION_SECRET` must be at least 32 characters; a shorter value makes `iron-session` throw on save (HTTP 500 on Strava callback). Dev uses a safe fallback + console warning when the secret is missing or too short; production must set a long secret.
- **Strava OAuth `redirect_uri`:** Must be a full URL (e.g. `http://localhost:3000/api/auth/strava/callback`), not `localhost:3000` — Strava rejects missing scheme/path. Match Strava app Authorization Callback Domain (e.g. `localhost` for dev).
- **TLS to Strava from Node:** Node 20 bundled OpenSSL root CA store does not include GoDaddy Root G2 (Strava's CA). Fix: `NODE_EXTRA_CA_CERTS=./certs/godaddy-root-g2.pem` baked into the `dev` script in package.json. The PEM is a public root cert, safe to commit. Callback catches TLS errors and redirects with `error=strava_tls`.
- **Strava cache:** 5-minute TTL in-memory for activity JSON before each chat context build.
- **LLM:** Provider interface in `lib/llm/` with Gemini implementation; swap providers later.
- **Git:** Dedicated repository in this project folder (not the parent `Documents` tree). Remote: [kbogers/cycling-coach-chat](https://github.com/kbogers/cycling-coach-chat).
- **iron-session v8:** Session shape is not merged from a `SessionData` module augmentation; pass `getIronSession<SessionData>(...)` with an explicit `SessionData` type in `lib/session.ts` so `session.athleteId` type-checks on Vercel.

## Completed

- [x] Initial commit pushed to GitHub (`main` → `origin/main`).
- [x] Scaffold Next.js app, Tailwind, UI primitives, layout (Inter + JetBrains Mono, purple accent).
- [x] Onboarding wizard (5 steps), local draft + server pending + Strava OAuth callback.
- [x] Chat UI with streaming, markdown, localStorage history, settings sheet.
- [x] API routes: onboarding pending, Strava OAuth, session, profile PATCH, chat stream, disconnect, Strava prepare (reconnect), Gemini validate-key.
- [x] Vercel Analytics + `track` events from PRD.

## Next

- [ ] Replace in-memory store with Vercel KV / Postgres for production.
- [ ] Optional: Zod validation, stricter rate limits, IP-based limits.
- [ ] Optional: dark mode, HR-only / unknown FTP modes (open question in PRD).
