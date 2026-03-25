# PRD: AI Cycling Coach

**Status:** Draft  
**Last Updated:** 2026-03-25  
**Stack:** Next.js · Vercel · Strava OAuth · Google Gemini API

---

## 1. Overview

AI Cycling Coach is a web application that gives cyclists a personalised, conversational training assistant. Users connect their Strava account, describe their goal, and enter basic physiological data. They then chat freely — asking questions about their training history, fatigue, fitness trends, or upcoming workouts — and receive answers that are informed by their real Strava data and tailored to their individual profile.

---

## 2. Problem Statement

Cyclists who don't have access to a human coach lack a way to interpret their own training data in context. Strava surfaces raw numbers but provides no guidance. Generic training plans ignore individual physiology and history. This product bridges that gap by combining a user's real activity data with an LLM that understands their goal, physical properties, and current fitness state.

---

## 3. Goals and Non-Goals

### Goals
- Let users onboard in under 5 minutes with no technical knowledge required.
- Answer any natural-language question about a user's Strava training data.
- Ground every LLM response in the user's stated goal and physiological profile.
- Ship a working web product deployable on Vercel.

### Non-Goals (v1)
- Native iOS or Android apps (possible in future).
- Generating or pushing structured training plans to Strava or a calendar.
- Supporting training platforms other than Strava (e.g. TrainingPeaks, Garmin).
- Supporting LLM providers other than Google Gemini (initially).
- Social or community features.

---

## 4. User Flow

### 4.1 Onboarding (one-time, sequential)

```
Step 1 – Goal
  ↓
Step 2 – Training availability
  ↓
Step 3 – Physical profile (DOB, weight, max HR, LTHR, FTP)
  ↓
Step 4 – LLM API key (Gemini)
  ↓
Step 5 – Connect Strava (OAuth)
  ↓
Chat interface
```

All onboarding state is persisted locally (localStorage) and/or server-side after Strava auth is complete. Users can edit any field from a Settings page post-onboarding.

### 4.2 Chat (ongoing)

Once onboarded, the user lands directly on the chat interface. Each conversation turn:

1. User submits a natural-language message.
2. The app fetches relevant Strava data (recent activities, segment efforts, HR data, etc.) via the Strava API.
3. A system prompt is assembled that includes the user's goal, physical profile, and the fetched Strava data.
4. The message + context is sent to the Gemini API using the user's API key.
5. The response is streamed back and rendered in the chat window.

---

## 5. Screens and Components

### 5.1 Onboarding Wizard

A single-page multi-step form. Progress is shown via a step indicator. Users can go back but not skip forward.

| Step | Fields |
|------|--------|
| Goal | Free text, max 280 characters (tweet length). Placeholder: "e.g. Finish a gran fondo in under 5 hours by August." |
| Availability | Weekly training days (1–7, selector). Optional: preferred session duration. |
| Physical Profile | Date of birth (date picker), weight (kg or lbs with unit toggle), Max HR (bpm), LTHR (bpm), FTP (watts). All numeric. |
| LLM Setup | Gemini API key (password input, stored encrypted). Link to Google AI Studio for users who need to create a key. |
| Strava Connect | "Connect with Strava" button triggering OAuth flow. Displays Strava branding per their guidelines. |

**Validation:** All fields required except preferred session duration. FTP, Max HR, and LTHR must be plausible numeric ranges (soft validation with warnings, not hard blocks).

### 5.2 Chat Interface

Matches the familiar LLM chat pattern:

- Scrollable message history (user bubbles right, coach bubbles left).
- Input bar pinned to bottom with send button and Enter-to-send.
- Streamed responses rendered with Markdown support (for lists, bold, etc.).
- Loading indicator during API calls.
- Thin header bar with app name and a Settings icon.

### 5.3 Settings

Accessible from the chat header. Allows editing all onboarding fields. "Disconnect Strava" option. "Clear chat history" option.

---

## 6. LLM Integration

### 6.1 System Prompt Structure

Every request to Gemini includes a system prompt assembled from:

```
You are an expert cycling coach. Your role is to help the athlete understand
their training data and make progress toward their goal.

ATHLETE PROFILE
- Goal: {goal}
- Weekly training availability: {days} days/week
- Date of birth: {dob} (age: {age})
- Weight: {weight} kg
- Max HR: {max_hr} bpm
- LTHR: {lthr} bpm
- FTP: {ftp} W
- W/kg: {ftp / weight}

RECENT STRAVA DATA
{strava_context}

Answer questions based on the athlete's actual data. Be specific, not generic.
If data is missing or unclear, say so. Use cycling terminology appropriately.
```

### 6.2 Strava Context Injection

The `{strava_context}` block is dynamically assembled before each request. It includes:

- Last 10–20 activities: date, type, duration, distance, elevation, average HR, average power (if available), TSS estimate.
- A short summary of the last 4 weeks: total hours, total distance, number of rides.
- Any activity specifically referenced in the user's message (resolved by name/date if mentioned).

Strava API calls are made server-side (Next.js API routes) to keep the Strava access token secure.

### 6.3 Gemini API

- Model: `gemini-1.5-pro` (or latest stable equivalent at launch).
- API key is provided by the user and stored encrypted server-side (associated with their session/account).
- Requests are made from Next.js API routes, not from the browser, so the key is never exposed in client-side code.
- Streaming is used for responsive UX.

### 6.4 Future LLM Providers

The LLM integration layer should be abstracted behind a provider interface from day one, so OpenAI, Anthropic, or others can be added without rearchitecting the chat pipeline.

---

## 7. Strava Integration

### 7.1 OAuth Flow

- Uses standard Strava OAuth 2.0.
- Scopes required: `activity:read_all` (to read all activities including private ones).
- After successful auth, store the access token and refresh token server-side, associated with the user's session.
- Handle token refresh automatically before Strava API calls.

### 7.2 Data Fetched

| Endpoint | Usage |
|----------|-------|
| `GET /athlete` | Athlete name, profile photo (for display) |
| `GET /athlete/activities` | List of recent activities |
| `GET /activities/{id}` | Detailed activity data including HR streams |
| `GET /activities/{id}/streams` | Power, HR, cadence streams for specific questions |

All Strava API calls are rate-limited (100 requests per 15 minutes per user). The app should cache activity data with a short TTL (e.g. 5 minutes) to avoid redundant calls during a single chat session.

---

## 8. Data Storage

For v1, persistence requirements are minimal:

| Data | Storage |
|------|---------|
| User profile (goal, physical data) | Server-side, tied to session |
| Gemini API key | Server-side, encrypted at rest |
| Strava access + refresh tokens | Server-side, encrypted at rest |
| Chat history | Client-side (localStorage) for simplicity; server-side optional |
| Strava activity cache | Server-side, short TTL (5 min) |

**No user authentication system is required in v1** — Strava OAuth is the login mechanism. The Strava user ID serves as the unique user identifier.

---

## 9. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js (App Router) | Full-stack, Vercel-native, streaming support |
| Deployment | Vercel | Zero-config, edge functions, easy env var management |
| Styling | Tailwind CSS | Fast, consistent UI |
| Auth / Identity | Strava OAuth (via NextAuth.js or custom) | No separate auth system needed |
| LLM | Google Gemini API | v1 target; abstracted for future providers |
| Storage | Vercel KV (Redis) or Vercel Postgres | Token + profile storage; lightweight |
| Strava client | Custom fetch wrapper around Strava REST API | Simple, no heavy SDK needed |

---

## 10. Security Considerations

- Gemini API key and Strava tokens are never sent to or stored in the browser.
- All third-party API calls are made from Next.js API routes (server-side).
- Gemini API key is encrypted at rest using a server-side secret.
- Rate limiting on chat API route to prevent abuse of user's Gemini key.
- HTTPS enforced via Vercel (default).
- Strava OAuth state parameter validated to prevent CSRF.

---

## 11. Design

### UI Kit: shadcn/ui

All UI components are built with **shadcn/ui** on top of Tailwind CSS. Components are copied into `components/ui/` and owned by the codebase — no external component dependency to manage.

### Typography

| Role | Style |
|------|-------|
| App name / headings | Inter, semibold |
| Body / chat messages | Inter, regular |
| Code / metrics (HR, FTP, watts) | Mono (JetBrains Mono or system mono) |

Inter ships with Next.js via `next/font` at zero cost.

### Colour Palette

Neutral base (shadcn default slate scale) with a **deep purple** accent (`#6B21A8` / Tailwind `purple-800`) for CTAs, active states, and focus rings. One accent, not a palette.

Light mode only for v1. Dark mode is a natural follow-on given shadcn's built-in support.

### Key Components

| Screen | shadcn Components Used |
|--------|----------------------|
| Onboarding wizard | `Card`, `Input`, `Button`, `Progress`, `Select`, `Label` |
| Chat interface | `ScrollArea`, `Input`, `Button`, `Avatar`, `Badge` |
| Settings | `Sheet` (slide-over panel), `Input`, `Switch`, `Button` |
| Strava connect | `Button` (Strava-branded variant), `Alert` |

### Design Principles

- **Density:** Comfortable, not cramped. Chat bubbles need breathing room.
- **Focus:** One primary action visible at a time, especially during onboarding.
- **Data readability:** Training metrics (HR, power, TSS) rendered in monospace with units always shown.
- **Mobile-friendly:** Responsive layout from day one even though native apps are out of scope. The chat interface in particular should work well on a phone browser.

---

## 12. Usage Analytics

Analytics are implemented via **Vercel Analytics** (zero-config, no third-party SDK required). It is enabled by adding the `@vercel/analytics` package and the `<Analytics />` component to the root layout.

### Events to Track

| Event | Trigger | Properties |
|-------|---------|------------|
| `onboarding_started` | User lands on step 1 | — |
| `onboarding_step_completed` | User advances past each step | `step` (1–5) |
| `onboarding_completed` | Strava OAuth succeeds and user reaches chat | — |
| `chat_message_sent` | User submits a message | `message_index` (nth message in session) |
| `chat_session` | Session ends / page unloads | `message_count` |
| `settings_opened` | User opens Settings | — |
| `strava_reconnected` | User re-runs Strava OAuth from Settings | — |

### Key Funnel

Onboarding step completion rates (steps 1–5) give the primary drop-off signal. Chat session depth (messages per session) is the primary engagement signal.

Vercel Analytics dashboard surfaces page views and Web Vitals automatically. Custom events above are tracked via `track()` from `@vercel/analytics`.

---

## 12. Out of Scope for v1 (Backlog)

- Push notifications or scheduled check-ins.
- Automated training plan generation.
- Calendar integration.
- Native mobile apps.
- Multi-provider LLM support (architecture supports it; UI will follow).
- Uploading or importing activities manually.
- Power curve analysis, VO2max estimation, or other derived metrics.
- Sharing or exporting chat history.

---

## 12. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should chat history be persisted server-side so users can access it across devices? | Product | Open |
| 2 | What is the right TTL for cached Strava activity data? | Eng | Open |
| 3 | Do we need to handle users with no power meter (FTP unknown)? HR-only coaching mode? | Product | Open |

---

## 13. Success Metrics (v1)

- Onboarding completion rate > 70% of users who start.
- Users send at least 3 chat messages per session (indicates useful responses).
- Strava OAuth success rate > 95%.
- P95 response latency (first token) < 3 seconds.
