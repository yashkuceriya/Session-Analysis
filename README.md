# AI-Powered Live Session Analysis

Real-time engagement analysis and coaching for video tutoring sessions. Analyzes live video calls to measure eye contact, speaking time balance, energy levels, and attention drift — then delivers non-intrusive coaching nudges to help tutors improve session quality.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3789 in your browser.

## How It Works

1. **Setup** — Configure subject, session type, and participant names on the landing page
2. **Live Session** — A Zoom/Meet-style video call UI with real-time metrics sidebar
3. **Analysis** — MediaPipe Face Mesh (in-browser, GPU-accelerated) tracks eye contact and facial expressions; Web Audio API analyzes speaking patterns
4. **Coaching** — Non-intrusive nudges appear when engagement drops (e.g., "Student hasn't spoken in 3 minutes")
5. **Post-Session** — Analytics dashboard with engagement timeline, key moments, and recommendations

## Architecture

All video/audio processing runs **entirely in the browser**. No video data leaves your machine.

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Webcam /    │────→│  FaceMeshProcessor│────→│  GazeEstimator   │
│  Video Feed  │     │  (MediaPipe GPU) │     │  ExpressionAnalyzer│
└─────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
┌─────────────┐     ┌──────────────────┐               │
│  Microphone  │────→│  VoiceActivity   │               │
│  / Audio     │     │  Detector (VAD)  │               │
└─────────────┘     └────────┬─────────┘     ┌─────────▼────────┐
                             │               │  MetricsEngine   │
                    ┌────────▼─────────┐     │  (2Hz updates)   │
                    │  SpeakingTime    │────→│                  │
                    │  Tracker         │     └─────────┬────────┘
                    │  Interruption    │               │
                    │  Detector        │     ┌─────────▼────────┐
                    └──────────────────┘     │  CoachingEngine  │
                                             │  (nudge rules)   │
                                             └──────────────────┘
```

### Modules

| Module | Purpose |
|--------|---------|
| `src/lib/video-processor/` | MediaPipe Face Mesh, gaze estimation, expression analysis |
| `src/lib/audio-processor/` | Voice activity detection, speaking time, interruptions, prosody |
| `src/lib/metrics-engine/` | Combines signals into unified engagement metrics at 2Hz |
| `src/lib/coaching-system/` | Rule-based nudge evaluation with cooldowns and sensitivity |
| `src/lib/persistence/` | IndexedDB session storage for durable post-session analytics |
| `src/hooks/` | React hooks bridging processing to UI state |
| `src/stores/` | Zustand store for real-time session state |

## Student Input Modes

| Mode | URL | Description |
|------|-----|-------------|
| Demo video | `/session` | Plays `public/demo/student-sample.mp4` with real audio VAD |
| Live camera | `/session?student=webcam` | Second camera/mic for a real student |
| Placeholder | (fallback) | Animated canvas if no video file present |

For the best demo, place a video of someone talking into `public/demo/student-sample.mp4`.

## Engagement Metrics

- **Eye Contact** — Iris landmark offset from eye corners via MediaPipe (85%+ accuracy target)
- **Speaking Time Balance** — Real-time ratio vs ideal for session type (lecture/practice/discussion)
- **Interruptions** — Overlapping speech detection with 500ms threshold
- **Energy Level** — Combined audio prosody (60%) + facial expression valence (40%)
- **Attention Drift** — Composite of declining eye contact + prolonged student silence

## Performance

| Pipeline Stage | Measured | Budget |
|---------------|----------|--------|
| Frame capture | ~1ms | — |
| Face Mesh (GPU) | 30-80ms | <200ms |
| Audio VAD | <5ms | — |
| Metric assembly | <2ms | — |
| **End-to-end** | **~35-85ms** | **<500ms** |

The latency indicator in the bottom-left of the session UI shows real measured end-to-end pipeline latency.

## Privacy

- All video processing is local (MediaPipe runs in-browser via WebGL)
- No video frames are sent to any server
- Only aggregated numeric metrics are stored (in browser IndexedDB)
- Audio is analyzed locally and never recorded
- Session data persists in the browser only

## Limitations

- Eye gaze accuracy depends on camera angle and lighting — works best with a front-facing webcam at eye level
- Single face per video tile (does not handle multiple faces in one feed)
- Speaking time tracking assumes separate audio streams per participant; with a single mic, cross-talk affects accuracy
- Energy level is a proxy based on prosody and facial cues, not validated against ground truth
- Demo mode student video needs manual placement (`public/demo/student-sample.mp4`)

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **MediaPipe Face Mesh** (478 landmarks including iris, GPU-accelerated)
- **Web Audio API** (AnalyserNode for VAD)
- **Zustand** (state management)
- **Tailwind CSS** (styling)
- **IndexedDB** (session persistence)
