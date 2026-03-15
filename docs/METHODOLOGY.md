# Methodology: Real-Time Engagement Analysis in Tutoring Sessions

## Section 1: Overview

Nerdy uses real-time computer vision and audio analysis to estimate tutoring engagement during live sessions. The system runs entirely in the browser, processing video frames via MediaPipe Face Landmarker and analyzing audio using the Web Audio API.

**Important:** These are heuristic estimates, not validated psychometric instruments. The engagement metrics are designed to surface actionable patterns (e.g., declining eye contact, prolonged silence) to help tutors reflect on session dynamics. They should not be treated as definitive measures of learning, comprehension, or psychological state.

The system has known limitations (camera angle, glasses, background noise, cultural bias in expression analysis) and should be used as a relative indicator within sessions rather than an absolute measure across students or tutors.

## Section 2: Engagement Score

The engagement score is a composite metric (0-100) that combines five weighted factors:

1. **Eye Contact** (25% by default) — Student looking at camera
2. **Speaking Time Balance** (25% by default) — Ratio of student-to-tutor speaking time vs. ideal for session type
3. **Energy** (20% by default) — Audio prosody + facial expression valence
4. **Interruption Frequency** (15% by default) — Lower interruption overlap counts as engagement
5. **Attention Stability** (15% by default) — Absence of sudden eye contact drops or prolonged silence

### Weight Variations by Session Type

Weights are adjusted based on session type to reflect different pedagogical goals:

| Factor | Lecture | Practice | Discussion |
|--------|---------|----------|------------|
| Eye Contact | 30% | 20% | 25% |
| Speaking Time Balance | 15% | 30% | 25% |
| Energy | 25% | 15% | 20% |
| Interruptions | 10% | 15% | 15% |
| Attention Stability | 20% | 20% | 15% |

**Rationale:**
- **Lecture:** Eye contact and attention are critical when the tutor is delivering content. Student speaking time is naturally lower.
- **Practice:** Student speaking (asking questions, discussing solutions) is paramount. Energy supports active problem-solving.
- **Discussion:** Balanced participation and eye contact reflect peer-to-peer exchange.

### EMA Smoothing

Each component metric is smoothed using exponential moving average (EMA) with **alpha = 0.15**:

```
smoothed_value = alpha * new_measurement + (1 - alpha) * previous_smoothed_value
```

- Alpha of 0.15 means new measurements contribute 15%, previous history contributes 85%.
- This prevents jitter from momentary lapses while reacting to real changes within 1-2 seconds.

### Baseline Tracking

During the first 2 minutes of a session, baseline metrics are established for each student:
- Typical eye contact percentage
- Typical energy level
- Typical interruption rate

Deviations from baseline trigger coaching nudges.

## Section 3: Eye Contact / Gaze Estimation

### Input: MediaPipe Face Landmarker

MediaPipe Face Landmarker detects 478 facial landmarks, including:
- Eye corners (inner and outer)
- Iris center position

### Gaze Calculation

The iris position is computed as a 2D ratio relative to the eye inner and outer corners:
- **iris_x_ratio = (iris_center_x - inner_corner_x) / (outer_corner_x - inner_corner_x)**
- **iris_y_ratio = (iris_center_y - top_corner_y) / (bottom_corner_y - top_corner_y)**

A ratio of **0.5 in both X and Y** indicates the iris is perfectly centered (looking straight ahead at camera).

### Threshold

**GAZE_THRESHOLD = 0.18**

Deviation from center in either direction beyond 0.18 is classified as "not looking at camera."

Calibration options:
- 0.10: Very strict (only direct stare)
- 0.15: Strict (camera area)
- **0.18: Default** (allows natural gaze variation)
- 0.25: Lenient (most forward-facing gaze)
- 0.35: Very lenient (only clearly looking away)

### Rolling Window

A rolling window of **120 samples** (approximately 60 seconds at 2Hz) is used to compute the eye contact percentage:
```
eye_contact_score = samples_with_gaze_on_camera / 120
```

This smooths momentary glances while still detecting sustained attention changes.

### Known Limitations

- **Camera angle sensitivity:** Accuracy drops when camera is not at eye level. Side-mounted or low-angle cameras produce higher false-negative rates.
- **Glasses/reflections:** Strong reflections on glasses can occlude iris landmarks, reducing gaze accuracy.
- **Multi-monitor setups:** Looking at a second monitor registers as "not looking at camera" even if the student is engaged with shared content.
- **Lighting:** Low light or strong backlighting degrades MediaPipe face detection reliability.

## Section 4: Voice Activity Detection (VAD)

### Adaptive Energy Threshold

The VAD uses an adaptive energy threshold to detect speech:

```
threshold = ENERGY_THRESHOLD_RATIO * max_recent_energy + baseline_noise
```

**Parameters:**
- **ENERGY_THRESHOLD_RATIO = 0.15** — Speech is detected when energy exceeds 15% of the recent maximum
- **Baseline noise:** Estimated from the first 500ms of the session
- **energyDecay = 0.995** — How quickly the adaptive max energy decays (prevents stale peaks)

### Hangover

**HANGOVER_MS = 200**

Once speech drops below the threshold, the "speaking" state persists for an additional 200ms. This prevents rapid on/off toggling during natural speech pauses between words.

### Separate Audio Streams

The system assumes **separate audio streams per participant:**
- Tutor's microphone = tutor's audio stream
- Student's microphone or remote participant audio = student's audio stream

This allows accurate speaking time tracking. If audio is mixed (e.g., both in the same room with one microphone), accuracy is reduced.

### Speaking Time Tracker

Speaking time is accumulated over a sliding window:
- For each participant, track milliseconds spent speaking in recent windows
- Compute ratio: **student_talk_ms / (student_talk_ms + tutor_talk_ms)**
- Compare against ideal ratio for session type

### Interruption Detection

Overlapping speech lasting **>500ms** counts as an interruption. Brief backchannel responses ("mm-hmm", "right") are typically 200-400ms and are not flagged.

```
overlap_duration = tutor_speak_end - student_speak_start
if overlap_duration > OVERLAP_THRESHOLD_MS (500ms):
  increment interruption_count
```

## Section 5: Student State Classification

The system classifies the student into one of five states based on facial expressions, voice activity, eye contact, and engagement trends.

### States

| State | Meaning | Typical Triggers |
|-------|---------|-----------------|
| **Engaged** | Active participation, good eye contact, normal energy | Speaking or listening with attention; eye contact >50%; no extended silence |
| **Passive** | Listening but not speaking; attention present | Silent >30s; eye contact >40%; low energy; no confusion signals |
| **Confused** | Shows signs of confusion without engagement | Furrowed brow, head tilt, low eye contact; often silent; possible frown |
| **Drifting** | Attention degrading; losing focus | Eye contact declining; extended silence (>60s); head down; vacant expression |
| **Struggling** | Signaling difficulty; may need immediate help | Furrowed brow + silence >3min; frustrated expression; energy very low; high body tension |

### Decision Tree Logic

1. **Check for confusion signals:**
   - browFurrow > 0.5 OR (confusion expression detected AND eye_contact < 0.4)
   - → State = "confused"

2. **Check for struggle signals:**
   - (browFurrow > 0.6 OR frustrated expression) AND silence_duration_ms > 180000 (3 min)
   - → State = "struggling"

3. **Check for drifting:**
   - eye_contact_trend = "declining" AND eye_contact_score < 0.3 AND silence_duration_ms > 60000 (60 sec)
   - → State = "drifting"

4. **Check for engagement:**
   - isSpeaking AND energy > 0.3 AND eye_contact > 0.5
   - → State = "engaged"

5. **Default to passive:**
   - Otherwise → State = "passive"

### Known Limitations

- **Facial expression bias:** Expression norms vary across cultures. Smile detection and frown detection may not generalize.
- **Multi-face detection:** The system processes only one face per video tile. Group sessions are not supported.
- **Silent = disengaged assumption:** The heuristic treats prolonged silence as disengagement. Engaged-but-quiet students (e.g., reading shared content) may be misclassified.
- **Composite heuristic:** State classification is probabilistic and context-dependent. It is not validated against ground-truth behavioral data.

## Section 6: Coaching Nudges

The coaching system monitors for conditions that may warrant tutor attention and surfaces non-intrusive nudges in the session UI.

### Rule-Based Triggers

Nudges are triggered by conditions such as:

| Trigger | Condition | Sensitivity |
|---------|-----------|-------------|
| Student silent > 3 min | `silence_duration_ms > 180000` | Medium |
| Student silent > 5 min | `silence_duration_ms > 300000` | High priority |
| Student eye contact < 30% (declining) | `eye_contact_score < 0.3 AND trend = "declining"` | Medium |
| Tutor talk time > 80% | `tutor_talk_time_percent > 0.8` after 5 min | Low |
| Student energy < 25% | `energy_score < 0.25` after 10 min | Low |
| Interruption spike | `interruptions_in_recent_window > baseline + 2 stdev` | Medium |

### Sensitivity Levels

The sensitivity slider adjusts which rules fire:

- **Low:** Only critical conditions (student silent >5min, attention drift)
- **Medium:** Default — balanced set
- **High:** All conditions including encouragement nudges

### Configurable Parameters

- **minIntervalMs:** Minimum time between nudges (default 30s). Prevents nudge spam.
- **enabled:** Toggle nudges on/off
- **disabledRules:** Individual rules can be disabled by category

### Cooldown

Once a nudge is dismissed by the tutor, the same rule will not trigger again for **minIntervalMs** milliseconds. This respects tutor flow.

## Section 7: Data Flow

### Live Session

1. **Browser processing pipeline:**
   - Video frames → MediaPipe Face Landmarker → Gaze estimation + expression analysis
   - Audio stream → VAD + speaking time + prosody analysis
   - Combined signals → Metrics Engine (runs at ~2Hz)
   - Metrics → Zustand store (session state)

2. **Persistence (dual-path):**
   - **Primary:** Server API (`POST /api/sessions/{sessionId}/metrics`)
     - Metric snapshots are batched and sent every 5 seconds
     - Supabase or file-based backend stores data persistently
   - **Fallback:** IndexedDB (offline cache)
     - Full session data saved locally every 5 seconds
     - Used if server is unavailable
     - Survives browser refresh

3. **Metric snapshots** are stored at approximately **4Hz** (every 250ms) in memory, then:
   - Flushed to IndexedDB every 5 seconds
   - Sent to server API in batches every 5 seconds

### Analytics (Post-Session)

- **Initial load:** Try server API first
- **Fallback:** If server unavailable, load from IndexedDB
- **Dashboard:** Displays metrics timeline, student state transitions, nudge history

## Section 8: Known Limitations

See **[LIMITATIONS.md](LIMITATIONS.md)** for a comprehensive overview. Key architectural limitations:

- **Browser-only persistence:** Session data stored in IndexedDB in the tutor's browser. Clearing browser data loses all sessions. No cross-device sync.
- **Single face per tile:** Does not handle multiple faces in one feed.
- **Separate audio streams assumption:** With a single mixed audio source, interruption and speaking time accuracy is reduced.
- **WebRTC signaling:** When in multi-participant ("room") mode, uses a WebSocket-based signaling server. Real-time latency depends on network conditions.

For a full inventory, see **[LIMITATIONS.md](LIMITATIONS.md)**.

## Section 9: For Reviewers

### What to Trust

- **Engagement score as a relative indicator:** Comparing segment A (first 10 min) vs. segment B (last 10 min) within a single session is meaningful. The trend (rising/stable/declining) is more reliable than the absolute value.
- **Eye contact percentage:** The 120-sample rolling window is a reasonable proxy for "paying attention to the camera." It is accurate within ±5% on front-facing setups with proper lighting.
- **Speaking time ratio:** If audio streams are clean and separate, the ratio is accurate. If audio is mixed or noisy, take results with caution.
- **Student state transitions:** The state machine provides a useful narrative of session flow (engaged → drifting → confused). Treat each state as probabilistic, not absolute.

### What to Treat as Approximate

- **Absolute engagement score:** Do not compare a session with score 72 to one with score 69 as if they are measurably different. Use bands (e.g., "high" >70, "medium" 50-70, "low" <50).
- **Eye contact accuracy with glasses/multi-monitor:** If the student is wearing glasses or has multiple monitors, eye contact estimates may have ±10-20% error.
- **Facial expression valence (energy level):** The "energy" component relies on smile detection and audio prosody. It is not validated against ground-truth measures. Treat it as a rough indicator, not a fact.
- **Interruption detection with overlapping speech:** The 500ms threshold is a heuristic. Very brief backchannel responses are correctly filtered, but longer overlaps may be false positives if participants are intentionally co-speaking.

### Hardware-Dependent Accuracy

Accuracy of gaze, expression, and interruption detection depends heavily on:
- **Camera quality and angle** — Front-facing at eye level is optimal
- **Microphone quality and placement** — Clear audio with minimal background noise
- **Lighting** — Even, frontal lighting without backlighting
- **Display setup** — Single monitor; multi-monitor setups confound gaze estimation

For best results, use in a quiet room with good lighting and a front-facing camera.

