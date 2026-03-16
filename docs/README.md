# Nerdy: Real-Time Tutoring Session Analysis Platform

Nerdy is an intelligent tutoring platform that uses AI-powered real-time analysis to enhance the quality of online tutoring sessions. The system automatically analyzes student engagement, emotional state, and learning signals through computer vision and audio processing, providing instant coaching feedback to tutors.

## Overview

Nerdy captures real-time metrics during video tutoring sessions and provides:
- **Live Engagement Analysis** — Continuous engagement scoring (0-100)
- **Student State Detection** — Classification into engaged, passive, confused, drifting, or struggling states
- **Facial Expression Tracking** — Smile, confusion, concentration, surprise detection
- **Eye Contact Monitoring** — Gaze estimation via MediaPipe Face Landmarker
- **Speaking Time Analysis** — Turn-taking and dialogue balance metrics
- **Smart Coaching Nudges** — Context-aware suggestions for tutors to improve engagement
- **Post-Session Analytics** — Comprehensive visual reports with actionable insights
- **AI-Powered Analysis** — Claude-based session summaries and reflections

## Architecture Overview

### Technology Stack

**Frontend:**
- **Next.js 16** — Full-stack React framework with App Router
- **React 19** — UI rendering and state management
- **TypeScript** — Type-safe application code
- **Tailwind CSS 4** — Utility-first styling
- **Zustand** — Lightweight state management for session data
- **Recharts** — Interactive data visualization

**Backend:**
- **Next.js API Routes** — Serverless backend for analysis and signaling
- **Supabase** — PostgreSQL database + real-time subscriptions
- **Anthropic Claude API** — AI analysis and recommendations
- **WebRTC** — Peer-to-peer video/audio transmission

**AI/ML:**
- **MediaPipe Face Landmarker** — 478-point facial landmark detection
- **Web Audio API** — Audio feature extraction
- **Claude 3.5 Sonnet** — Session analysis and feedback generation

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MediaPipe Face Landmarker  Web Audio API             │   │
│  │  (gaze, expressions)        (pitch, energy)          │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│                    Metrics Engine (Real-time)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Eye Contact Scoring                                 │   │
│  │  Speaking Time Tracking                              │   │
│  │  Engagement Score Computation                        │   │
│  │  Student State Classification                        │   │
│  │  Nudge Triggering                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│              ┌───────────────┴───────────────┐               │
│              │                               │               │
│        Store Locally              Send to Server            │
│     (Zustand + IndexedDB)        (WebRTC + API)             │
└──────────────┼───────────────────┼───────────────────────────┘
              │                       │
┌─────────────┴───────────────────────┴───────────────────────┐
│                   Next.js Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Signaling API         Session Storage API            │   │
│  │  /api/signaling/*      /api/sessions/*               │   │
│  │  (room coordination)   (persist metrics)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
└──────────────┬───────────────┼───────────────────────────────┘
               │               │
       ┌───────┴───────┐       │
       │               │       │
    WebRTC        Anthropic  Supabase
  (P2P Video)   (AI Analysis) (Database)
```

## Metrics & Engagement Scoring

### Metrics Tracked

The system tracks comprehensive metrics across three categories:

#### 1. Student Metrics (`ParticipantMetrics`)

| Metric | Range | Description |
|--------|-------|-------------|
| **eyeContactScore** | 0-1 | Fraction of time looking at camera (gaze estimation) |
| **talkTimePercent** | 0-1 | Fraction of speaking time in recent window |
| **energyScore** | 0-1 | Audio energy and expression valence combined |
| **isSpeaking** | boolean | Currently speaking or not |
| **silenceDurationMs** | ms | Current silence duration |
| **eyeContactTrend** | rising/stable/declining | Direction of eye contact change |
| **pitchVariance** | 0+ | Audio pitch variation (higher = more expressive) |
| **speechRate** | 0-1 | Fraction of time speaking in recent window |
| **headMovement** | 0-1 | Head motion intensity (fidgeting indicator) |
| **blinkRate** | blinks/min | Blink frequency (elevates under stress) |
| **distractionScore** | 0-1 | Combined gaze deviation + movement + expression |
| **gazeDeviation** | 0-1 | How far off-center gaze is from camera |
| **posture** | upright/leaning/slouching | Body positioning estimate |

#### 2. Session Metrics (`SessionMetrics`)

| Metric | Description |
|--------|-------------|
| **interruptionCount** | Number of speech overlaps detected |
| **silenceDurationCurrent** | Current continuous silence length |
| **engagementTrend** | Is engagement rising, stable, or declining? |
| **attentionDriftDetected** | Boolean: has attention drift been detected? |
| **elapsedMs** | Total session duration in milliseconds |
| **turnTakingGapMs** | Time between speaker transitions |
| **turnCount** | Number of speaker exchanges |
| **focusStreakMs** | Longest continuous focus duration |
| **distractionEvents** | Count of distraction episodes |

#### 3. Expression Metrics (`ExpressionSnapshot`)

| Metric | Range | Description |
|--------|-------|-------------|
| **smile** | 0-1 | Smile intensity |
| **confusion** | 0-1 | Confusion signal (furrowed brows, etc.) |
| **concentration** | 0-1 | Focus intensity |
| **surprise** | 0-1 | Surprise/shock expression |
| **energy** | 0-1 | Overall facial activity |
| **valence** | 0-1 | Positive/negative sentiment |
| **browFurrow** | 0-1 | Brow furrowing (frustration) |
| **browRaise** | 0-1 | Brow raising (interest) |
| **headNod** | -1 to 1 | Head nodding intensity |
| **headShake** | 0-1 | Head shaking intensity |
| **mouthOpen** | 0-1 | Mouth openness |
| **headTilt** | radians | Head tilt angle |
| **frustration** | 0-1 | Derived from browFurrow + valence |
| **interest** | 0-1 | Derived from browRaise + concentration |

### Engagement Score Computation

The **Engagement Score (0-100)** is computed from five weighted factors:

```
Engagement = 25% * Eye_Contact
           + 25% * Speaking_Balance
           + 20% * Energy
           + 15% * Interruption_Frequency
           + 15% * Attention_Stability
```

**Weights are adjusted by session type:**

| Factor | Lecture | Practice | Discussion |
|--------|---------|----------|------------|
| Eye Contact | 30% | 20% | 25% |
| Speaking Time Balance | 15% | 30% | 25% |
| Energy | 25% | 15% | 20% |
| Interruptions | 10% | 15% | 15% |
| Attention Stability | 20% | 20% | 15% |

**Rationale:**
- **Lecture:** Students should maintain eye contact while tutor delivers content
- **Practice:** Student talking time is critical for problem-solving and dialogue
- **Discussion:** Balanced participation and mutual eye contact

**EMA Smoothing:** All metrics are smoothed using exponential moving average (alpha = 0.15) to prevent jitter while reacting to real changes within 1-2 seconds.

### Student State Classification

Based on facial expressions, gaze, and engagement metrics, students are classified into one of five states:

| State | Characteristics | Detection Signals |
|-------|-----------------|-------------------|
| **engaged** | Active participation, eye contact, positive expression | High engagement score, smiling, eye contact |
| **passive** | Present but not actively participating | Low energy, neutral expression, minimal interaction |
| **confused** | Shows signs of not understanding | Furrowed brows, low confidence signals |
| **drifting** | Attention is shifting away | Gaze deviation, reduced eye contact |
| **struggling** | Frustrated or overwhelmed | High distraction, low energy, expressions of frustration |

## Nudge System

The Nudge System delivers real-time, context-aware coaching feedback to tutors during sessions.

### Nudge Categories

1. **Eye Contact Nudges** — When student eye contact drops below baseline
2. **Engagement Nudges** — When overall engagement score declines significantly
3. **Speaking Time Nudges** — When talk time balance deviates from session type ideal
4. **Pacing Nudges** — When silences are too long or interruptions too frequent
5. **Expression Nudges** — When confusion or frustration signals are detected
6. **Positive Nudges** — Encouragement when engagement peaks

### Nudge Effectiveness

The system tracks whether nudges correlate with engagement improvements using:
- Engagement delta before/after nudge
- User action response (did tutor acknowledge?)
- Time to recovery (seconds to engagement stabilization)

## API Endpoints

### Session Management

**GET** `/api/sessions/:sessionId`
- Retrieve a stored session with all metrics and nudges
- Returns: `{ session, metrics, nudges }`

**POST** `/api/sessions`
- Create a new session
- Body: `{ sessionConfig: SessionConfig }`
- Returns: `{ sessionId, room: string }`

**PUT** `/api/sessions/:sessionId`
- Update session (end time, status, etc.)
- Body: partial session object
- Returns: updated session

### Signaling (WebRTC Coordination)

**GET** `/api/signaling/messages?roomId=...`
- Poll for pending WebRTC signaling messages
- Used for offer/answer/ICE candidate exchange

**POST** `/api/signaling/messages`
- Send a signaling message to the room
- Body: `{ roomId, type, payload }`

### Analysis

**POST** `/api/analyze-session`
- Trigger AI analysis of a completed session
- Body: `{ sessionId }`
- Returns: `{ analysis, summary, recommendations }`

**GET** `/api/nudges`
- Get nudge history for a session
- Query: `?sessionId=...`

## Setup & Development

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (for database)
- Anthropic API key (for AI features)

### Local Development

1. **Clone and install:**
```bash
git clone <repo>
cd nerdy-product2
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Fill in:
```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
AUTH_SECRET=<generate: openssl rand -base64 32>
ROOM_TOKEN_SECRET=<generate: openssl rand -base64 32>

# Supabase (use dev/test values)
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

3. **Initialize database:**
```bash
# In Supabase dashboard, run docs/supabase-schema.sql
# Then run docs/supabase-rls-fix.sql
```

4. **Start development server:**
```bash
npm run dev
# Opens http://localhost:3789
```

5. **Run tests:**
```bash
npm test
```

### Folder Structure

```
nerdy-product2/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Home page
│   │   ├── analytics/         # Analytics dashboard
│   │   ├── auth/              # Authentication flows
│   │   └── session/           # Active session pages
│   ├── components/            # React components
│   │   ├── analytics/         # Charts and visualizations
│   │   ├── session/           # Session UI components
│   │   └── common/            # Shared components
│   ├── lib/
│   │   ├── metrics-engine/    # Core metrics computation
│   │   ├── coaching-system/   # Nudge triggering logic
│   │   ├── session/           # Session management
│   │   ├── persistence/       # IndexedDB storage
│   │   └── analysis/          # AI analysis functions
│   └── stores/                # Zustand state management
├── server/                     # Express server (for local signaling)
├── docs/
│   ├── README.md             # This file
│   ├── METHODOLOGY.md        # Detailed metrics methodology
│   ├── METRICS.md            # Metrics documentation
│   ├── PRODUCTION.md         # Deployment guide
│   └── supabase-schema.sql   # Database schema
├── __tests__/                # Jest tests
├── public/                   # Static assets
├── tailwind.config.ts        # Tailwind configuration
├── next.config.ts            # Next.js configuration
└── package.json
```

## Production Deployment

Detailed deployment instructions are in `docs/PRODUCTION.md`.

### Quick Summary

1. **Supabase:**
   - Create a Supabase project
   - Run database schema from `docs/supabase-schema.sql`
   - Enable Realtime on `signal_messages` table
   - Get URL and API keys

2. **Environment Setup:**
   ```env
   ANTHROPIC_API_KEY=your-key
   NEXTAUTH_URL=https://yourdomain.com
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Deploy to Vercel:**
   ```bash
   vercel deploy --prod
   ```

4. **Optional: Custom TURN Servers**
   - For better video reliability on restrictive networks
   - Use Metered.ca ($10/month) or Twilio
   - Set `NEXT_PUBLIC_TURN_*` environment variables

## Key Limitations

### Known Limitations

1. **Camera Angle Dependency** — Gaze estimation assumes frontal face in frame; side angles degrade accuracy
2. **Glasses/Occlusions** — Reflective glasses can interfere with iris detection
3. **Lighting Sensitivity** — Low or inconsistent lighting affects facial landmark detection
4. **Cultural Expression Bias** — Facial expression analysis trained on limited datasets; may have cultural biases
5. **Audio Quality Dependency** — Background noise reduces audio feature accuracy
6. **Single Student** — Currently designed for 1-on-1 tutoring; multi-student support limited
7. **Heuristic Nature** — Engagement metrics are calibrated heuristics, not validated psychometric instruments

See `docs/LIMITATIONS.md` for detailed discussion and mitigation strategies.

## Features

### Live Session Analysis

- Real-time metrics computation in the browser
- Instant nudge delivery to tutors
- Student state tracking
- Facial expression analysis
- Eye contact monitoring
- Turn-taking analysis
- Energy and prosody estimation

### Post-Session Analytics

- Engagement timeline visualization
- Facial expression distribution charts
- Speaking time breakdowns
- Student state progression
- Nudge effectiveness analysis
- Key moments identification
- Personalized recommendations
- AI-generated session summaries

### Coaching System

- Context-aware nudge triggering
- Session-type-specific suggestions
- Baseline-relative deviation detection
- Effectiveness tracking
- Real-time feedback delivery

## Contributing

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally: `npm run dev && npm test`
3. Commit with meaningful messages
4. Push and create a pull request

### Testing

- Unit tests: `npm test`
- E2E tests: Manual testing in dev mode
- Test coverage: Run `npm test -- --coverage`

### Code Style

- TypeScript for type safety
- Prettier for formatting (configured in `.prettierrc`)
- ESLint for linting (configured in `eslint.config.mjs`)

## Support & Documentation

- **Methodology:** See `docs/METHODOLOGY.md` for detailed metrics explanation
- **Metrics Reference:** See `docs/METRICS.md` for individual metric definitions
- **Limitations:** See `docs/LIMITATIONS.md` for known constraints
- **Production:** See `docs/PRODUCTION.md` for deployment details

## License

Proprietary. All rights reserved.

## Contact

For questions or feedback, reach out to the Nerdy team.
