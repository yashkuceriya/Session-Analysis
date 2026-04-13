# Session Analysis

Real-time AI-powered engagement analytics for live tutoring sessions. Tracks eye contact, facial expressions, speaking patterns, and attention — then delivers coaching nudges to tutors and shareable progress reports to parents.

**All video/audio processing happens in the browser.** No video frames or audio samples ever leave the device. Privacy-first by design.

## What It Does

| For Tutors | For Parents | For Platforms |
|---|---|---|
| Real-time engagement score + coaching nudges during sessions | Shareable session highlights with key "Moments of Learning" | Tutor effectiveness scoring across all sessions |
| Post-session analytics with expression timeline, talk time, eye contact | Multi-session progress tracking with engagement trends | Automated session quality signals at scale — no human QA |
| AI-generated coaching feedback via Claude | No login required to view shared reports | Dashboard with student insights and consistency metrics |

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3789](http://localhost:3789). Configure a session and click **Start Solo Session** to try it with your webcam.

For multi-participant mode (tutor + student on separate devices), also start the signaling server:

```bash
cd server && npm install && npx ts-node signaling.ts
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | Yes | NextAuth session signing key (`openssl rand -base64 32`) |
| `ANTHROPIC_API_KEY` | No | Enables AI post-session coaching analysis |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL (enables cloud sync) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase admin key for server-side ops |
| `DEV_SKIP_AUTH` | No | Set to `true` to bypass login during development |

The app works fully without Supabase or Anthropic — sessions are stored in IndexedDB and AI analysis is simply disabled.

## Key Features

### During a Session
- **Engagement Score (0-100)** — Weighted composite of eye contact, speaking balance, energy, interruptions, and attention. Adapts weights by session type (lecture/practice/discussion).
- **Student State Classification** — Engaged, passive, confused, drifting, or struggling — detected from facial expressions, gaze, and audio signals.
- **AI Coaching Nudges** — Rule-based suggestions surface when engagement drops ("Student hasn't spoken in 3 min — try an open-ended question").
- **Live Metrics HUD** — Eye contact %, talk time ratio, energy level, and engagement ring overlay.

### After a Session
- **Full Analytics Page** — Engagement timeline, expression radar chart, emotion distribution, speaking time breakdown, student state timeline, key moments detection.
- **AI Analysis** — Claude-powered coaching feedback with session grade, teaching effectiveness assessment, communication analysis, and action plans.
- **Detailed Reports** — Downloadable JSON/CSV exports with per-second metric data.
- **Session Highlights** (`/highlights/[id]`) — Parent-friendly shareable summary with engagement score, key moments, talk time, and recommendations. No login required.
- **Student Progress** (`/progress/[name]`) — Multi-session engagement trends, improvement tracking, and aggregate statistics. Shareable with parents.

### Dashboard
- Session history with engagement trend chart
- Student insights with per-student sparklines and trend indicators
- Tutor effectiveness metrics (consistency, best subject, high-engagement rate)
- Direct links to analytics, reports, highlights, and student progress pages

## How Metrics Are Computed

| Signal | Source | Method |
|---|---|---|
| Eye Contact | MediaPipe Face Mesh (468 landmarks) | Iris position vs. camera center; auto-calibrating threshold |
| Facial Expressions | MediaPipe Blendshapes (52 coefficients) | Smile, confusion (brow furrow + frown), concentration, surprise, energy |
| Voice Activity | Web Audio API AnalyserNode | Adaptive energy threshold + spectral flatness; per-participant |
| Speaking Balance | Custom VAD | Rolling window talk-time ratio; compared to ideal for session type |
| Interruptions | Overlap detection | Both participants speaking simultaneously > 500ms |
| Engagement Score | Weighted composite | Session-type-aware weights with EMA smoothing (alpha=0.15) |

Engagement weights by session type:

| Weight | Lecture | Practice | Discussion |
|---|---|---|---|
| Eye Contact | 0.30 | 0.20 | 0.25 |
| Speaking Time | 0.15 | 0.30 | 0.25 |
| Energy | 0.25 | 0.15 | 0.20 |
| Interruption (penalty) | 0.10 | 0.15 | 0.15 |
| Attention | 0.20 | 0.20 | 0.15 |

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16, React 19, TypeScript | App Router, server components, API routes co-located |
| State | Zustand | Vanilla API for non-React metric callbacks; selector-based re-renders |
| Face Analysis | MediaPipe Face Mesh (@mediapipe/tasks-vision) | 468 landmarks + 52 blendshapes, runs in-browser via WASM+GPU |
| Audio | Web Audio API (custom VAD) | Near-zero cost frequency analysis; pitch variance + energy tracking |
| Video Calls | WebRTC (PeerConnection) | Peer-to-peer, no media server needed for 1:1 |
| Persistence | IndexedDB (local) + Supabase (cloud) | Dual-layer: works offline, syncs when available |
| AI Analysis | Anthropic Claude API | Post-session coaching feedback; server-side only |
| Auth | NextAuth v5 + bcrypt | JWT sessions, credentials + OAuth (Google, GitHub) |
| Styling | Tailwind CSS 4 | Warm light theme with CSS custom properties |
| Charts | Recharts + custom SVG | Interactive charts on analytics; lightweight SVG on shareable pages |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # REST API routes
│   ├── analytics/[id]/     # Post-session analytics
│   ├── dashboard/          # Tutor dashboard + effectiveness metrics
│   ├── highlights/[id]/    # Shareable parent-friendly session summary
│   ├── progress/[name]/    # Multi-session student progress (shareable)
│   ├── reports/[id]/       # Detailed report with export
│   ├── session/            # Live session page
│   └── session-ended/      # Post-session summary with share links
├── components/
│   ├── session/            # 29 session UI components
│   ├── analytics/          # Charts and visualizations
│   └── ...                 # auth, dashboard, accessibility, ui
├── hooks/                  # 16 custom hooks (media, face mesh, audio, etc.)
├── lib/
│   ├── ai/                 # Claude AI session analyzer
│   ├── analysis/           # Bloom taxonomy, comprehension detection
│   ├── audio-processor/    # VAD, pitch analysis, interruption detection
│   ├── coaching-system/    # Nudge rules engine with cooldowns
│   ├── metrics-engine/     # Core engagement computation + types
│   ├── video-processor/    # Face mesh, gaze estimation, emotion classifier
│   ├── realtime/           # WebRTC peer connection + signaling
│   ├── reports/            # Report generator, summarizer, recommendations
│   └── persistence/        # IndexedDB session storage
├── stores/                 # Zustand stores (session, participant, accessibility)
└── middleware.ts            # Auth middleware

server/                     # WebRTC signaling server (Node.js)
docs/                       # Architecture documentation
__tests__/                  # 23 test suites, 204 tests
```

## Testing

```bash
npm test              # Run all 204 tests
npm run lint          # ESLint (0 errors)
npm run build         # Production build
```

Tests cover: metrics engine, audio processor (VAD, speaking time, interruptions), coaching system (nudge rules, cooldowns), reports (summarizer, recommendations), auth (rate limiting, tokens), stores (state transitions), and streaming (adaptive quality).

## Privacy & Security

- **No video/audio upload** — All MediaPipe + Web Audio processing runs client-side
- **Metrics only** — Only numeric engagement scores are sent to server (if Supabase configured)
- **bcrypt password hashing** — Cost factor 10, never logged or returned
- **Rate-limited auth** — 5 attempts per 15 minutes with lockout
- **Room token verification** — Invalid tokens redirect with error; tokenless rooms for backward compat
- **Role validation** — Session store role checked before URL parameter to prevent spoofing
- **Edge-compatible auth** — No Node.js crypto imports; uses Web Crypto API

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Full architecture deep-dive: design decisions, tech choices with alternatives considered, metrics engine design, data flow, performance budget, security model, and alignment with the Live+AI platform
