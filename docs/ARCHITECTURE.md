# Session Analysis — Architecture & Design Decisions

## 1. Problem Statement

Online tutoring is a black box. Parents pay $40-80/hr, a session happens on video, and nobody knows
if it actually worked. Did the student zone out? Did the tutor lecture for 45 minutes without checking
understanding? Was the student confused but too shy to say anything?

**Session Analysis** turns that black box into a glass box — providing real-time, AI-powered
engagement analytics for live tutoring sessions without sending any video data to a server.

### Who benefits?

| Stakeholder | Problem | What we provide |
|-------------|---------|-----------------|
| **Tutors** | No feedback loop between sessions | Real-time nudges + post-session analytics with actionable coaching |
| **Parents** | "How do I know the money is working?" | Engagement trends across sessions, progress reports |
| **Platform** | Can't review 10,000+ daily sessions manually | Automated quality signals, tutor scoring, early-warning on bad sessions |
| **Students** | Can't self-assess focus/engagement | Post-session reflection data, state breakdown |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ MediaPipe│  │ Web Audio│  │  Zustand  │  │   React    │ │
│  │FaceMesh  │  │  VAD     │  │  Stores   │  │ Components │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └─────┬──────┘ │
│       │             │              │               │        │
│       └──────┬──────┘              │               │        │
│              │                     │               │        │
│       ┌──────▼──────┐      ┌──────▼──────┐        │        │
│       │   Metrics   │─────▶│  Coaching   │────────▶│        │
│       │   Engine    │      │   System    │         │        │
│       └──────┬──────┘      └─────────────┘        │        │
│              │                                     │        │
│       ┌──────▼──────┐                             │        │
│       │  IndexedDB  │                             │        │
│       │ Persistence │                             │        │
│       └─────────────┘                             │        │
│                                                    │        │
│  ┌─────────────┐  ┌──────────────┐                │        │
│  │  WebRTC     │  │  Signaling   │◄───────────────┘        │
│  │  PeerConn   │  │  Client      │                         │
│  └──────┬──────┘  └──────┬───────┘                         │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          │ (peer-to-peer) │ (HTTP polling / WebSocket)
          │                │
┌─────────▼────────────────▼──────────────────────────────────┐
│                     Server                                   │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Next.js    │  │ Signaling  │  │  Supabase  │            │
│  │ API Routes │  │ Server     │  │  (Postgres) │            │
│  └──────┬─────┘  └────────────┘  └──────┬─────┘            │
│         │                               │                    │
│  ┌──────▼──────┐                        │                    │
│  │  Claude AI  │◄───────────────────────┘                    │
│  │  Analyzer   │  (post-session analysis)                    │
│  └─────────────┘                                             │
└──────────────────────────────────────────────────────────────┘
```

### Key architectural principle: **Privacy-first, client-heavy**

All video/audio processing happens in the browser. The server never sees a single video frame
or audio sample. This is a deliberate design choice:

1. **Privacy**: Tutoring often involves minors. Sending face data to a server creates regulatory
   risk (COPPA, FERPA, GDPR). Processing locally eliminates this entirely.
2. **Latency**: Real-time engagement feedback must be instant (<100ms). Round-tripping to a server
   adds unacceptable delay.
3. **Cost**: Video processing at scale is expensive. Offloading to client GPUs/CPUs means zero
   compute cost per session.
4. **Scalability**: Each browser is its own compute node. 10,000 concurrent sessions = 10,000
   distributed processors, at zero marginal server cost.

---

## 3. Technology Choices

### Frontend: Next.js 16 + React 19

**Why Next.js?**
- App Router gives us file-based routing with layouts, loading states, and error boundaries built in
- API routes co-located with the frontend — no separate backend to deploy for the web layer
- Server components for static pages (dashboard, reports) with client components for interactive ones (session)
- Built-in image/font optimization, middleware for auth

**Why React 19?**
- `use()` hook for cleaner async data loading
- Improved Suspense boundaries (critical for the session page which lazy-loads heavy deps like MediaPipe)
- Server Actions for form handling (auth)

**Alternatives considered:**
- *Remix* — Good DX but less ecosystem support for the MediaPipe/WebRTC integration we need
- *SvelteKit* — Smaller bundle but team familiarity with React ecosystem is higher; MediaPipe has React-specific wrappers
- *Plain Vite + React* — No SSR, no API routes, would need a separate backend

### State Management: Zustand

**Why Zustand over Redux/Jotai/Recoil?**
- Minimal boilerplate — the session store has ~30 state fields that change at 1-4Hz. Redux would triple the code.
- `getState()` outside React — the metrics engine runs in requestAnimationFrame callbacks, not inside components. Zustand's vanilla API is critical.
- Subscriptions with selectors — components only re-render when their specific slice changes. With 60+ snapshots/min updating, this prevents render storms.
- Tiny bundle (~1KB gzipped) — every KB matters when we're also loading MediaPipe (~3MB).

**Alternatives considered:**
- *Redux Toolkit* — Too much ceremony for this use case. Action creators, reducers, selectors for state that updates every second.
- *Jotai* — Good for atomic state but our session state is deeply interconnected (engagement depends on eye contact + speaking + expression). A single store is simpler.
- *React Context* — Would cause catastrophic re-renders with the update frequency we need.

### Face Analysis: MediaPipe Face Mesh (via @mediapipe/tasks-vision)

**Why MediaPipe?**
- Runs entirely in-browser via WebAssembly + GPU acceleration — no server round-trip
- 468 3D facial landmarks at 30+ FPS on modern hardware
- Blendshape coefficients for 52 facial expressions (smile, brow furrow, eye squint, etc.)
- Free, open-source, maintained by Google
- Works on low-end hardware with graceful degradation (we drop to 15 FPS if needed)

**What we extract from it:**
- **Eye contact**: Gaze direction vector from iris landmarks → "is the person looking at the camera?"
- **Expressions**: Blendshape weights → smile, confusion (brow furrow + frown), concentration (brow lower + eye squint), surprise (brow raise + mouth open)
- **Head pose**: Rotation matrix → nodding (agreement), shaking (disagreement), tilting (confusion)
- **Energy**: Composite of movement magnitude, blink rate, expression variance over time
- **Distraction**: Gaze deviation from center + excessive head movement + low blink rate

**Alternatives considered:**
- *TensorFlow.js BlazeFace* — Detection only, no landmarks or blendshapes
- *face-api.js* — Older, slower, no blendshapes, unmaintained
- *Amazon Rekognition / Google Vision* — Server-side, violates our privacy-first principle
- *OpenCV.js* — Lower-level, would need custom ML models for expression classification

### Audio Analysis: Web Audio API + Custom VAD

**Why custom VAD instead of a library?**
- Web Audio API's `AnalyserNode` gives us raw frequency data at near-zero cost
- Our VAD (Voice Activity Detection) uses energy thresholding + spectral flatness — simple, fast, and tuned for speech
- We need both *who is speaking* and *how they're speaking* (pitch variance, speech rate, energy)
- Libraries like `vad-web` only detect speech/silence, not the acoustic features we need

**What we extract:**
- **Speaking detection**: Energy threshold + spectral analysis → boolean "is speaking"
- **Talk time ratio**: Rolling window of speaking time per participant
- **Pitch variance**: FFT peak tracking → monotone (low variance) vs. expressive (high variance)
- **Interruption detection**: Both participants speaking simultaneously for >500ms
- **Silence duration**: Gaps between speech acts → potential confusion or disengagement

### Real-time Communication: WebRTC (PeerConnection V2)

**Why WebRTC peer-to-peer?**
- Direct browser-to-browser video/audio — lowest possible latency
- No media server needed (SFU/MCU) for 1:1 tutoring sessions
- Built-in echo cancellation, noise suppression, bandwidth adaptation
- Data channel for signaling session events (end session, reactions, chat)

**Signaling**: HTTP long-polling with WebSocket upgrade. The signaling server is a minimal Node.js
process that relays SDP offers/answers and ICE candidates. It never touches media.

**TURN/STUN**: Metered.ca relay servers for NAT traversal. Configurable via env vars.

### Persistence: IndexedDB (local) + Supabase (remote)

**Dual-storage strategy:**
1. **IndexedDB** (always available): Session data is saved locally immediately. Works offline.
   No account required. This is the primary store for the demo/solo mode.
2. **Supabase** (optional sync): When configured, session metrics are synced to Postgres for
   cross-device access, dashboards, and AI analysis. Graceful fallback if unavailable.

**Why this dual approach?**
- Demo mode works with zero setup — no database, no account, just open and go
- Production deployments get full persistence with Supabase
- API routes check Supabase first, fall back to request body / local data
- No data loss if network drops mid-session (IndexedDB saves first, syncs later)

### AI Analysis: Claude (Anthropic)

**Why Claude for post-session analysis?**
- Generates nuanced, pedagogically-informed coaching feedback (not just number crunching)
- Can interpret complex multi-dimensional data (engagement + expression + talk time + eye contact) holistically
- Produces natural language that tutors can actually act on ("Try asking more open-ended questions when the student's confusion peaks — around the 12-minute mark, they were furrowing their brow but didn't speak up")
- Structured output with session grade, teaching effectiveness, student engagement, communication analysis, and action plans

**When is AI used?**
- Only post-session, server-side, via `/api/sessions/[id]/analyze`
- Never during a live session (latency budget is too tight)
- Requires `ANTHROPIC_API_KEY` env var — gracefully disabled when not set
- All real-time analysis (engagement score, student state, nudges) uses deterministic algorithms, not LLMs

### Authentication: NextAuth v5 + bcrypt

**Why NextAuth?**
- Supports credentials (email/password) + OAuth (Google, GitHub) out of the box
- JWT-based sessions — no server-side session store needed
- Middleware integration for protected routes
- Role-based access (tutor vs. student) via JWT claims

**Security measures:**
- Password hashing with bcrypt (cost factor 10)
- Rate limiting on auth endpoints (5 attempts per 15 minutes)
- Input validation (email format, password strength requirements)
- CSRF protection via NextAuth's built-in token rotation

---

## 4. Metrics Engine Design

### The Engagement Score (0-100)

The engagement score is not a single metric — it's a weighted composite that adapts based on session type:

```
Score = (eyeContact × w1) + (speakingBalance × w2) + (energy × w3)
      - (interruptions × w4) + (attention × w5)
```

| Weight | Lecture | Practice | Discussion |
|--------|---------|----------|------------|
| Eye Contact | 0.30 | 0.20 | 0.25 |
| Speaking Time | 0.15 | 0.30 | 0.25 |
| Energy | 0.25 | 0.15 | 0.20 |
| Interruption (penalty) | 0.10 | 0.15 | 0.15 |
| Attention | 0.20 | 0.20 | 0.15 |

**Why different weights per session type?**
- In a *lecture*, eye contact and energy matter most (is the student paying attention?)
- In *practice*, speaking time is king (is the student actually practicing?)
- In *discussion*, balanced talk time + eye contact signal genuine dialogue

### Student State Classification

We classify the student into one of 5 states every metric cycle:

| State | Signals | Threshold |
|-------|---------|-----------|
| **Engaged** | High eye contact + speaking + positive expression | Score > 65 |
| **Passive** | Looking at camera but not speaking, neutral expression | Score 40-65, low talk time |
| **Confused** | Brow furrow + head tilt + silence after question | Confusion expression > 0.4 |
| **Drifting** | Gaze deviation + low energy + no head movement | Distraction > 0.5 |
| **Struggling** | High confusion + low engagement + long silence | Score < 30 + confusion |

### Talk Time Ratios

Ideal ratios vary by session type (based on pedagogical research):

- **Lecture**: 75% tutor / 25% student
- **Practice**: 40% tutor / 60% student
- **Discussion**: 50/50

Deviation from ideal triggers coaching nudges.

---

## 5. Coaching System (Nudge Rules)

The coaching system runs a rule engine against each metric snapshot. Rules have:
- **Condition**: A predicate on the current metrics (e.g., "student drifting for > 2 min")
- **Priority**: low / medium / high
- **Cooldown**: Minimum time between repeated nudges of the same type
- **Message**: The coaching suggestion shown to the tutor

Examples:
- "Student hasn't spoken in 3 minutes — try asking an open-ended question" (high priority)
- "Eye contact is declining — the student may be distracted" (medium priority)
- "Great engagement! The discussion flow is well-balanced" (low priority, positive reinforcement)

Nudges are shown as non-intrusive banners during the session and logged for post-session review.

---

## 6. Data Flow

### During a session (real-time, every ~1 second):

```
Camera Frame → MediaPipe Face Mesh → Blendshapes + Landmarks
                                           │
Audio Stream → Web Audio AnalyserNode → VAD + Pitch + Energy
                                           │
                                    ┌──────▼──────┐
                                    │   Metrics    │
                                    │   Engine     │
                                    │  (combines   │
                                    │   all signals)│
                                    └──────┬──────┘
                                           │
                              ┌─────────────┼─────────────┐
                              │             │             │
                       ┌──────▼──────┐ ┌────▼────┐ ┌─────▼─────┐
                       │  Zustand    │ │ Nudge   │ │ IndexedDB │
                       │  Store      │ │ Rules   │ │ (batch    │
                       │  (UI update)│ │ Engine  │ │  save)    │
                       └─────────────┘ └─────────┘ └───────────┘
```

### After a session (asynchronous):

```
IndexedDB Session Data ──▶ /api/sessions (Supabase sync)
                                │
                         /api/sessions/[id]/analyze
                                │
                         Claude AI Analysis
                                │
                         Detailed coaching report
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              Analytics    Reports    Dashboard
                Page        Page       (trends)
```

---

## 7. Performance Considerations

### Client-side budget

We have ~16ms per frame (60 FPS target). Our budget:
- MediaPipe inference: ~8-12ms (GPU accelerated)
- Audio analysis: ~1ms (AnalyserNode is near-free)
- Metrics computation: ~0.5ms
- React render: ~2-4ms (only changed components)
- **Total: ~12-18ms** — we hit 30-60 FPS on modern hardware

### Graceful degradation

If the device can't keep up:
- `useAdaptiveQuality` drops video resolution (720p → 480p → 360p)
- Face mesh inference rate drops (30 FPS → 15 FPS → 5 FPS)
- Metrics collection interval increases (1s → 2s → 5s)
- Background effects are disabled first

### Memory management

- `metricsHistory` in Zustand is capped and downsampled (every Nth snapshot archived)
- `metricsArchive` holds downsampled historical data; full-res stays in rolling window
- IndexedDB writes are batched (not every snapshot)
- MediaPipe WASM memory is released on session end

---

## 8. Testing Strategy

### What we test:

| Layer | Tool | Coverage |
|-------|------|----------|
| Analysis engine (classifiers, detectors) | Jest unit tests | High |
| Audio processor (VAD, speaking time) | Jest unit tests | High |
| Coaching system (nudge rules, cooldowns) | Jest unit tests | High |
| Reports (summarizer, recommendations) | Jest unit tests | High |
| Auth (rate limiting, tokens) | Jest unit tests | High |
| Zustand stores (state transitions) | Jest integration | Medium |
| Streaming (adaptive quality) | Jest unit tests | Medium |

### What we intentionally don't test:

- **MediaPipe output** — We trust Google's model. We test our *interpretation* of blendshapes, not MediaPipe itself.
- **WebRTC connectivity** — Network-dependent, tested manually. The signaling client has error handling.
- **UI rendering** — Component tests would need browser-level MediaPipe/WebRTC mocks that are brittle. We rely on type safety + manual QA.

---

## 9. Security Model

| Concern | Mitigation |
|---------|------------|
| Video/audio data exposure | All processing is client-side. No media data leaves the browser. |
| Session data in transit | HTTPS for all API calls. WebRTC uses DTLS encryption. |
| Authentication bypass | NextAuth middleware protects all routes except public ones. |
| Brute-force login | Rate limiting (5 attempts / 15 min) with exponential backoff. |
| XSS | React's default escaping. No `dangerouslySetInnerHTML`. CSP headers via Next.js. |
| CSRF | NextAuth's built-in CSRF token rotation. |
| Credential storage | bcrypt with cost factor 10. Passwords never logged or returned in API responses. |
| IndexedDB access | Same-origin policy. Data is only accessible from the application domain. |

---

## 10. Deployment

### Local development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in: AUTH_SECRET, ANTHROPIC_API_KEY, SUPABASE_* (optional), GOOGLE/GITHUB OAuth (optional)

# Run dev server
npm run dev          # → http://localhost:3789

# Run signaling server (for multi-participant mode)
cd server && npm install && npx ts-node signaling.ts
```

### Production

- **Frontend**: Vercel / any Node.js host (Next.js 16)
- **Signaling server**: Separate Node.js process (Docker provided)
- **Database**: Supabase (managed Postgres)
- **AI**: Anthropic API (Claude) — only needed for post-session analysis

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_SECRET` | Yes | NextAuth session signing key |
| `ANTHROPIC_API_KEY` | No | Enables AI post-session analysis |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase admin key (server-side only) |
| `GOOGLE_CLIENT_ID` / `SECRET` | No | Google OAuth |
| `GITHUB_CLIENT_ID` / `SECRET` | No | GitHub OAuth |
| `NEXT_PUBLIC_TURN_URL` | No | Custom TURN server (defaults to Metered.ca) |

---

## 11. Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes (auth, sessions, rooms, health)
│   ├── analytics/[id]/     # Post-session analytics page
│   ├── auth/               # Login & signup pages
│   ├── dashboard/          # Tutor dashboard with trends + tutor effectiveness
│   ├── highlights/[id]/    # Shareable parent-friendly session summary ("Moments of Learning")
│   ├── join/[roomId]/      # Student join page
│   ├── progress/[name]/    # Multi-session student progress tracking (shareable)
│   ├── reports/[id]/       # Detailed session report with export
│   ├── session/            # Live session page
│   └── session-ended/      # Post-session summary with share links
│
├── components/
│   ├── session/            # 29 session UI components (video, controls, metrics, chat)
│   ├── analytics/          # Charts and visualizations
│   ├── dashboard/          # Dashboard-specific components
│   ├── auth/               # Auth forms and guards
│   ├── accessibility/      # A11y panel, focus trap, screen reader
│   └── ui/                 # Shared UI primitives
│
├── hooks/                  # Custom React hooks (media, face mesh, audio, recording, etc.)
│
├── lib/
│   ├── ai/                 # Claude AI analyzer
│   ├── analysis/           # Bloom taxonomy, comprehension detector, session analyzer
│   ├── audio-processor/    # VAD, pitch analysis, speaking time
│   ├── coaching-system/    # Nudge rules engine
│   ├── metrics-engine/     # Core metrics computation + types
│   ├── video-processor/    # Face mesh integration, emotion classifier
│   ├── streaming/          # Adaptive quality, bandwidth management
│   ├── realtime/           # WebRTC peer connection, signaling client
│   ├── reports/            # Report generator, summarizer, recommendations
│   ├── persistence/        # IndexedDB session storage
│   ├── auth/               # NextAuth config, user store
│   ├── supabase/           # Supabase client/server helpers
│   └── session/            # Session config types
│
├── stores/                 # Zustand stores (session, participant, accessibility)
└── middleware.ts            # Auth middleware for protected routes

server/                     # WebRTC signaling server (separate process)
__tests__/                  # Test suites organized by domain
docs/                       # Architecture documentation
```

---

## 12. Alignment with the Live+AI Platform

This project directly addresses capabilities being built into their Live+AI platform
(launched October 2025, expanded April 2025). Here's how our work maps to their product:

| Live+AI Feature | Our Implementation | Status |
|---|---|---|
| AI Session Insights & Video Playback | Claude analyzer + analytics page with full metrics timeline | Built |
| Real-time engagement tracking | Metrics engine with weighted scoring, student state classification | Built |
| Teacher Copilot (in-session AI assistant) | Nudge coaching system with rule engine + cooldowns | Built (lighter-weight) |
| Predictive Analytics Dashboards | Dashboard with trends, student insights, sparklines | Built (missing standards alignment) |
| Admin portal (track by student/school/subject) | Not yet implemented | Planned |
| AI-powered practice & adaptive quizzes | Not in scope | — |
| 40+ AI teacher tools (lesson plans, IEP generator) | Not in scope | — |

### Key differentiator: Privacy-first architecture

the platform processes data server-side. Our approach is fundamentally different:
all video/audio analysis happens client-side using MediaPipe and Web Audio APIs. This
eliminates COPPA/FERPA/GDPR concerns when tutoring minors, reduces server costs to near-zero
per session, and provides sub-100ms feedback latency impossible with server round-trips.

This positions the project as a **complementary module** that could be embedded in the
existing Live Learning Platform to add real-time engagement analytics without infrastructure
changes or privacy regulatory overhead.

---

## 13. Future Directions

These are features that would significantly increase platform value:

1. **Parent Dashboard**: Read-only view showing student progress across sessions. Engagement trend,
   session summaries, tutor ratings. This is the retention play — parents who see progress keep paying.

2. **Tutor Leaderboard**: Aggregate tutor quality scores across all their sessions. Surface top
   performers, flag underperformers for coaching. Critical for the quality-at-scale problem.

3. **Session Recording Highlights**: Auto-clip peak engagement and "aha" moments. 30-second clips
   that parents can watch instead of full session recordings.

4. **Predictive Alerts**: "Based on the last 3 sessions, this student's engagement is trending down.
   Consider switching tutors or adjusting difficulty." Early warning system.

5. **Bloom's Taxonomy Tracking**: Already partially built (`BloomClassifier`). Surface cognitive depth
   of learning — are questions just recall, or are they pushing into analysis/synthesis? Parents
   and tutors both want to know the learning is going deeper over time.

6. **Multi-participant Support**: Scale beyond 1:1 to small group sessions (3-5 students). Track
   individual engagement within a group. Requires SFU architecture change.
