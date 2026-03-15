# Nerdy: AI-Powered Live Session Analysis

Real-time engagement analysis and non-intrusive coaching for video tutoring sessions. Uses computer vision and audio analysis to track eye contact, speaking time balance, energy, and attention — then surfaces coaching nudges to help tutors improve session quality.

All processing happens in the browser. No video data leaves your machine.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3789 in your browser. Configure a session, then click "Start." Use a webcam and microphone; for demo mode, place a video file at `public/demo/student-sample.mp4`.

**Test accounts** (if using Supabase auth):
- Email: `demo@example.com` / Password: `demo123`
- Create your own at the signup page

## Architecture Overview

The system has four main components:

1. **Session Runtime** — Browser-based video/audio capture, participant management, and room mode (WebRTC peer connection)
2. **Metrics Pipeline** — Real-time face detection (MediaPipe), voice activity detection (VAD), and engagement score computation at ~2Hz
3. **Coaching Engine** — Rule-based nudge system with configurable sensitivity and thresholds
4. **Persistence** — Dual-layer storage: Supabase (primary) + IndexedDB (offline fallback)

For full details, see **[Architecture Overview](#architecture)** below.

## How to Read the Stats (for Tutors)

When a session is active, the metrics sidebar shows:

- **Engagement Score** (0-100) — Composite metric combining eye contact, speaking time, energy, interruptions, and attention stability. Colored ring: green (>70), yellow (50-70), red (<50).
- **Student State** — One of: engaged, passive, confused, drifting, struggling. Shown as a badge on the student video.
- **Speaking Time %** — Tutor vs. student. Green if balanced for session type; red if imbalanced.
- **Eye Contact %** — Student's proportion of time looking at camera in recent window. Green if >50%, yellow 30-50%, red <30%.
- **Energy** — Combined proxy from audio prosody + facial expression. Higher = more engaged.

**Nudges** appear at the top as non-dismissible suggestions when engagement drops (e.g., "Student silent for 3 minutes"). You can configure sensitivity in session settings.

For deeper understanding of what these metrics mean and their limitations, see **[METHODOLOGY.md](docs/METHODOLOGY.md)**.

## How Metrics are Computed (for Reviewers)

See **[docs/METHODOLOGY.md](docs/METHODOLOGY.md)** for the canonical reference. Quick summary:

- **Eye Contact:** MediaPipe iris tracking; ratio of time iris is centered on camera vs. looking away (GAZE_THRESHOLD=0.18, 120-sample rolling window)
- **Speaking Time:** Adaptive energy threshold VAD (ENERGY_THRESHOLD_RATIO=0.15, 200ms hangover) per audio stream; ratio computed over session duration
- **Energy:** 60% audio prosody (pitch variance, loudness) + 40% facial valence (smile, frown detection)
- **Interruptions:** Overlapping speech >500ms; assumes separate audio streams per participant
- **Attention Stability:** Eye contact trend + silence duration; drifting detected when eye contact declines AND silence >60s
- **Engagement Score:** Weighted combination of the above. Weights vary by session type (lecture/practice/discussion); EMA smoothed with alpha=0.15

### Calibration

Key tunable parameters are documented in **[docs/CALIBRATION.md](docs/CALIBRATION.md)**:
- `GAZE_THRESHOLD` — Iris offset tolerance (default 0.18)
- `ENERGY_THRESHOLD_RATIO` — Speech detection sensitivity (default 0.15)
- `OVERLAP_THRESHOLD_MS` — Interruption detection (default 500ms)
- EMA alpha — Metric smoothing (default 0.15)
- Nudge thresholds — Silence duration, eye contact decline, etc.

## Deployment

### Docker

```bash
docker-compose up
```

Starts the Next.js app on port 3000 (or configured PORT). Requires:
- `NEXTAUTH_URL` — Session callback URL (e.g., http://localhost:3000)
- `NEXTAUTH_SECRET` — Random string for session encryption
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — Optional; if not set, uses file-based backend

See `.env.local` example and `docker-compose.yml` for config.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_URL` | NextAuth session callback (required for auth) |
| `NEXTAUTH_SECRET` | Session encryption key (required for auth) |
| `SUPABASE_URL` | Supabase project URL (optional; uses file backend if omitted) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (optional) |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for server-side operations) |

## Documentation

- **[docs/METHODOLOGY.md](docs/METHODOLOGY.md)** — Canonical reference for metrics, formulas, heuristics, and limitations
- **[docs/CALIBRATION.md](docs/CALIBRATION.md)** — Tuning parameters for gaze, VAD, smoothing, and nudge thresholds
- **[docs/LIMITATIONS.md](docs/LIMITATIONS.md)** — Known limits and hardware dependencies
- **[docs/PRIVACY.md](docs/PRIVACY.md)** — Data handling and privacy guarantees

## Architecture

### Browser-Based Processing

All video/audio processing runs in the browser using:
- **MediaPipe Face Landmarker** — 478 facial landmarks including iris position (GPU-accelerated via WebGL)
- **Web Audio API** — Real-time frequency analysis for voice activity detection
- **getUserMedia** — Webcam and microphone capture

**End-to-end latency:** ~35-85ms (varies by hardware).

### Components

| Module | Purpose |
|--------|---------|
| `src/lib/video-processor/` | Face detection, gaze estimation, expression analysis |
| `src/lib/audio-processor/` | Voice activity detection, speaking time tracking, interruption detection |
| `src/lib/metrics-engine/` | Combines signals into unified engagement metrics (2Hz) |
| `src/lib/coaching-system/` | Rule-based nudge evaluation with configurable sensitivity |
| `src/lib/persistence/` | IndexedDB (offline cache) + Supabase API (primary storage) |
| `src/lib/realtime/` | WebRTC peer connection and signaling (room mode) |
| `src/hooks/` | React hooks bridging processing to UI state |
| `src/stores/` | Zustand stores for session, metrics, coaching, accessibility state |

### Data Flow

1. **Live capture:** Video frames + audio streams
2. **Processing:** MediaPipe + VAD run in browser (~2Hz metric updates)
3. **Storage (dual-path):**
   - Primary: Server API → Supabase/file backend (batched every 5s)
   - Fallback: IndexedDB (local cache, every 5s)
4. **UI:** Zustand store → React components (real-time metrics, nudges, student state)
5. **Analytics:** Post-session, load from server or IndexedDB and render timeline

### Room Mode (Multi-Participant)

When using a room URL (e.g., `/session?room=abc123`):
- **Local stream** sent via WebRTC to peer
- **Remote stream** received and analyzed
- **Metrics computed separately** for tutor and student
- **Signaling:** WebSocket-based (see `src/lib/realtime/PeerConnectionV2.ts`)

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **MediaPipe Face Landmarker** (GPU-accelerated face detection)
- **Web Audio API** (real-time audio analysis)
- **WebRTC** (peer-to-peer video/audio when in room mode)
- **Zustand** (state management)
- **Tailwind CSS** (styling)
- **IndexedDB** (offline persistence)
- **Supabase** (optional server-side storage)
- **NextAuth.js** (authentication)

## Privacy

- **No video upload:** All frames processed locally via WebGL
- **Metrics only:** Only numeric metrics (eye contact %, energy score, etc.) are sent to server
- **Audio not recorded:** Audio is analyzed in real-time via FFT; waveforms are never stored
- **Session control:** Data persists locally in browser; clearing browser storage clears all sessions

See **[docs/PRIVACY.md](docs/PRIVACY.md)** for details.
