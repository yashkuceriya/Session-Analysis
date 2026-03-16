# Methodology: Real-Time Engagement Analysis in Tutoring Sessions

## Section 1: Overview

Nerdy uses real-time computer vision and audio analysis to estimate tutoring engagement during live sessions. The system runs entirely in the browser, processing video frames via MediaPipe Face Landmarker and analyzing audio using the Web Audio API.

**Important:** These are heuristic estimates, not validated psychometric instruments. The engagement metrics are designed to surface actionable patterns (e.g., declining eye contact, prolonged silence) to help tutors reflect on session dynamics. They should not be treated as definitive measures of learning, comprehension, or psychological state.

The system has known limitations (camera angle, glasses, background noise, cultural bias in expression analysis) and should be used as a relative indicator within sessions rather than an absolute measure across students or tutors.

## Section 2: Engagement Score

The engagement score is a composite metric (0-100) that combines five weighted factors:

1. **Eye Contact** (25% by default) — Student looking at camera
2. **Speaking Time Balance** (25% by default) — Ratio of student-to-tutor speaking time vs. ideal for session type
3. **Energy** (20% by default) — Audio prosody (60%) + facial expression energy (40%)
4. **Interruption Frequency** (15% by default) — Lower interruption overlap counts as engagement
5. **Attention Stability** (15% by default) — Absence of sudden eye contact drops or prolonged silence; turn-taking bonus rewards active dialogue

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

### Weight Redistribution When No Face Data

When face detection is unavailable (e.g., camera off, persistent low-light), the system redistributes half of the eye contact weight to audio-based signals:
- 40% of redistributed weight goes to speaking time balance
- 30% to energy
- 30% to attention stability

This prevents engagement scores from collapsing when the camera feed is unreliable.

### EMA Smoothing

The engagement score uses EMA with **alpha = 0.15**:

```
smoothed_value = alpha * new_measurement + (1 - alpha) * previous_smoothed_value
```

- Alpha of 0.15 means new measurements contribute 15%, previous history contributes 85%.
- This prevents jitter from momentary lapses while reacting to real changes within 1-2 seconds.

Note: Individual sub-components use different EMA alphas tuned to their signal characteristics. See the Calibration section for per-component values.

### Temporal Weighting

The engagement score applies a temporal decay so that recent measurements carry slightly more weight than older ones:

```
temporalWeight = 0.85 + 0.15 * exp(-elapsedMs / 120000)
```

This means the first ~2 minutes have a mild boost (the system is "warming up"), gradually settling to a steady-state weight of 0.85.

### Baseline Tracking

During the first 2 minutes of a session, baseline engagement is established by averaging all smoothed engagement values. Deviations from baseline can trigger coaching nudges.

## Section 3: Eye Contact / Gaze Estimation

### Input: MediaPipe Face Landmarker

MediaPipe Face Landmarker detects 478 facial landmarks, including:
- Eye corners (inner and outer)
- Iris center position (landmarks 468, 473)

### Gaze Calculation

The iris position is computed as a 2D ratio relative to the eye inner and outer corners using `irisOffsetRatio()`:
- **iris_x_ratio = (iris_center_x - inner_corner_x) / (outer_corner_x - inner_corner_x)**
- **iris_y_ratio** similarly computed from vertical landmarks

A ratio of **0.5 in both X and Y** indicates the iris is perfectly centered (looking straight ahead at camera).

The left and right eye ratios are combined using a **weighted average based on eye openness** (the more open eye contributes more to the estimate, reducing noise from partial blinks or asymmetric squinting).

Results are smoothed with an EMA (alpha = 0.35) to reduce frame-to-frame jitter.

### Blink Detection

Eye aspect ratio (vertical / horizontal distance) is computed per frame. When the average of both eyes falls below **0.15**, the frame is classified as a blink and excluded from gaze estimation. Blinks are counted and tracked for blink-rate metrics (blinks per minute, rolling 60-second window).

### Auto-Calibration

The system automatically calibrates the gaze center during the first ~5 seconds of a session:

1. The first **20 non-blink frames** are collected silently (assumes the user is roughly looking at the camera during setup).
2. The mean X and Y iris ratios are computed.
3. If the mean is within a reasonable range of the expected center (|meanX - 0.5| < 0.25 and |meanY - 0.5| < 0.3), the calibration is accepted as the user's natural "looking at camera" center.
4. Once auto-calibration completes, the calibrated center replaces the default 0.5 for all subsequent gaze-on-camera decisions.

If auto-calibration is rejected (mean too far from center), the system falls back to the default center of 0.5.

### Manual Calibration

A manual calibration flow is also available:
1. Call `startCalibration()` — the estimator begins collecting samples.
2. The user looks at the camera for several seconds.
3. Call `finishCalibration()` — outliers beyond 2 standard deviations are removed, and the calibrated center and dynamic threshold are computed.
4. The dynamic threshold is set to 2x the standard deviation of the filtered samples, clamped to [0.08, 0.25].

Manual calibration overrides auto-calibration.

### Threshold

**DEFAULT_GAZE_THRESHOLD = 0.28**

Deviation from center in either direction beyond 0.28 is classified as "not looking at camera."

This is a wider default than strict thresholds to reduce false negatives across varied webcam setups without requiring explicit calibration.

### Confidence Score

A sigmoid-based confidence score penalizes larger deviations smoothly:

```
confidence = 1 / (1 + exp(10 * (maxDeviation - threshold)))
```

This provides a soft boundary rather than a hard cutoff, useful for downstream weighting.

### Known Limitations

- **Camera angle sensitivity:** Accuracy drops when camera is not at eye level. Side-mounted or low-angle cameras produce higher false-negative rates.
- **Glasses/reflections:** Strong reflections on glasses can occlude iris landmarks, reducing gaze accuracy.
- **Multi-monitor setups:** Looking at a second monitor registers as "not looking at camera" even if the student is engaged with shared content.
- **Lighting:** Low light or strong backlighting degrades MediaPipe face detection reliability. The FaceMeshProcessor now detects low-light conditions and surfaces a quality warning.

## Section 4: Blendshape-Based Expression Analysis

### Primary Path: 52 Blendshape Coefficients

When MediaPipe returns blendshapes (enabled by default with `outputFaceBlendshapes: true`), the system uses **action-unit-style blendshape coefficients** for expression analysis. This is significantly more accurate than landmark-distance heuristics.

Key blendshapes used:
- **Smile:** average of `mouthSmileLeft` and `mouthSmileRight`
- **Brow raise:** max of `browInnerUp` and average of `browOuterUpLeft`/`browOuterUpRight`
- **Brow furrow:** average of `browDownLeft` and `browDownRight`
- **Eye squint:** average of `eyeSquintLeft` and `eyeSquintRight` (concentration/confusion indicator)
- **Eye wide:** average of `eyeWideLeft` and `eyeWideRight` (surprise indicator)
- **Mouth open:** `jawOpen`
- **Frown:** average of `mouthFrownLeft` and `mouthFrownRight`
- **Cheek squint:** average of `cheekSquintLeft` and `cheekSquintRight` (Duchenne smile / genuine smile indicator)

### Derived Expressions

| Expression | Formula | EMA Alpha |
|-----------|---------|-----------|
| **Surprise** | `browRaise * 0.5 + eyeWide * 0.3 + mouthOpen * 0.2` | None (instantaneous) |
| **Confusion** | `browFurrow * 0.5 + eyeSquint * 0.3 + frown * 0.2` | 0.25 |
| **Concentration** | `browFurrow * 0.3 + eyeSquint * 0.4 + (1-mouthOpen) * 0.1 + (1-smile) * 0.2` | 0.25 |
| **Valence** | `0.5 + (smile * 0.4 + cheekSquint * 0.2 + browRaise * 0.1) - (frown * 0.3 + browFurrow * 0.2)` | 0.3 |
| **Energy** | `mouthOpen * 0.3 + browRaise * 0.2 + smile * 0.2 + eyeWide * 0.15 + browFurrow * 0.15` | 0.3 |
| **Frustration** | `browFurrow * 0.45 + frown * 0.35 + facialTension * 0.2` (where facialTension = max(mouthPress, mouthPucker)) | None |
| **Interest** | `browRaise * 0.25 + concentration * 0.35 + eyeWide * 0.15 + smile * 0.1 + (1-max(frown,browFurrow)) * 0.15` | None |

### Frustration and Interest Design Notes

**Frustration** uses `mouthPress` and `mouthPucker` as facial tension signals rather than `(1 - valence)`, which would double-count since valence already incorporates frown and smile. This provides a more orthogonal frustration signal.

**Interest** avoids the `(1 - frown)` term that would create a baseline-high bias (interest would always read high when frown is simply absent). Instead it weights positive curiosity signals (brow raise, eye widening, smile) and uses the complement of `max(frown, browFurrow)` as a smaller penalty term.

### Fallback Path: Landmark-Distance Heuristics

When blendshapes are unavailable (rare with current MediaPipe builds), the system falls back to computing expression metrics from raw landmark distances:
- Mouth width/height ratio for smile
- Eyebrow-to-eye distance for brow raise
- Inner eyebrow distance for brow furrow
- Upper-to-lower lip distance for mouth open

This path is less accurate but ensures the system degrades gracefully.

### Head Pose Estimation

Head pose (pitch, yaw, roll) is estimated from facial landmark geometry:
- **Pitch:** Angle between forehead-nose-chin vertical axis
- **Yaw:** Asymmetry between left and right face edge distances from the nose
- **Roll:** Tilt of the eye line

### Nod and Shake Detection

Head nodding (yes) and shaking (no) are detected by analyzing oscillation patterns in pitch and yaw history over a rolling window of ~10 seconds:
- **Nod:** 2+ pitch direction changes with total amplitude > 0.02 radians
- **Shake:** 2+ yaw direction changes with total amplitude > 0.03 radians

## Section 5: Voice Activity Detection (VAD)

### Adaptive Energy Threshold

The VAD uses an adaptive energy threshold to detect speech:

```
threshold = ENERGY_THRESHOLD_RATIO * max_recent_energy + baseline_noise
```

**Parameters:**
- **ENERGY_THRESHOLD_RATIO = 0.15** -- Speech is detected when energy exceeds 15% of the recent maximum
- **Baseline noise:** Estimated from the first 500ms of the session
- **energyDecay = 0.995** -- How quickly the adaptive max energy decays (prevents stale peaks)

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

Overlapping speech lasting **>1500ms** counts as an interruption. The threshold was increased from 500ms to reduce false positives from backchannel responses and brief co-speaking.

```
overlap_duration = overlap_end - overlap_start
if overlap_duration >= OVERLAP_THRESHOLD_MS (1500ms):
  increment interruption_count
```

## Section 6: Turn-Taking Metrics

The `TurnTakingTracker` monitors conversational flow by tracking speaker transitions:

- **Turn detection:** A "turn" is registered when the active speaker changes (excluding simultaneous speech).
- **Turn gap:** The time (ms) between one speaker stopping and another starting. Gaps > 30 seconds are excluded (silence, not a turn-take).
- **Metrics exposed:**
  - `turnCount` -- Total speaker transitions in the session
  - `avgTurnGapMs` -- Average gap between turns (lower = more fluid conversation)
  - `lastTurnGapMs` -- Most recent turn gap

Turn-taking feeds into the engagement score as a bonus: active dialogue (more turns) slightly boosts the attention stability component, up to +0.15.

## Section 7: Pitch / Prosody Analysis

The `ProsodyAnalyzer` computes vocal characteristics from the audio stream:

### Volume Analysis
- Rolling window of ~10 seconds of energy samples
- Computes average volume, variance, and a normalized energy score combining dB-scale level with expressiveness (variance)

### Pitch Estimation
- Uses **autocorrelation-based pitch detection** on the time-domain audio buffer
- Searches in the human voice range of **60-500 Hz**
- Only accepts samples with sufficient RMS energy (> 0.01)
- Computes rolling mean pitch and pitch variance over ~5 seconds

### Energy Score
The energy score combines audio and visual signals:
```
energy = audioProsody.energyScore * 0.6 + facialExpression.energy * 0.4
```

Audio contributes 60% and facial expression 40%, weighting the more reliable audio signal higher.

### Speech Rate
Percentage of recent frames (10-second window) where speech was detected. Higher speech rate indicates more active participation.

## Section 8: Student State Classification

The system classifies the student into one of five states based on facial expressions (including blendshape-derived signals), voice activity, eye contact, and engagement trends.

### States

| State | Meaning | Typical Triggers |
|-------|---------|-----------------|
| **Engaged** | Active participation, good eye contact, normal energy | Speaking or listening with attention; nodding; smiling; high concentration |
| **Passive** | Listening but not speaking; attention present | Low talk time; no declining eye contact; no confusion signals |
| **Confused** | Shows signs of confusion without engagement | High confusion expression (>0.45) + low speech rate; or low eye contact + browFurrow |
| **Drifting** | Attention degrading; losing focus | Eye contact declining below 30%; silence >8s; low concentration |
| **Struggling** | Signaling difficulty; may need immediate help | Low energy + long silence + low engagement; or browFurrow >0.5 + confusion >0.4 + silence |

### Decision Logic

The classifier uses expression signals from the blendshape-based analyzer:

1. **Struggling** (checked first -- highest priority):
   - (energyLow AND silenceLong AND engagementLow) OR (browFurrow > 0.5 AND confusion > 0.4 AND silenceLong)

2. **Confused:**
   - confusion > 0.45 AND speechRate < 0.2
   - OR: eyeContact < 0.3 AND energy > 0.3 AND speechRate < 0.2 AND browFurrow > 0.3

3. **Drifting:**
   - eyeContact declining AND eyeContact < 0.3 AND silence > 8s AND concentration < 0.3

4. **Passive:**
   - engagement < 0.4 AND talkTime < 15% AND not declining AND confusion < 0.2

5. **Engaged** (default):
   - headNod > 0.3, smile > 0.4, or concentration > 0.5 all indicate engagement
   - Fallback default is "engaged" (first 8 seconds always report "engaged" as warmup)

### Known Limitations

- **Facial expression bias:** Expression norms vary across cultures. Smile detection and frown detection may not generalize.
- **Multi-face detection:** The system processes only one face per video tile. Group sessions are not supported.
- **Silent = disengaged assumption:** The heuristic treats prolonged silence as disengagement. Engaged-but-quiet students (e.g., reading shared content) may be misclassified.
- **Composite heuristic:** State classification is probabilistic and context-dependent. It is not validated against ground-truth behavioral data.

## Section 9: Video Quality Awareness

The `FaceMeshProcessor` includes a brightness estimation step to detect low-light and variable-quality conditions:

- A 64x64 canvas sample is taken from the video feed periodically
- Average luminance is computed using the perceived-brightness formula (0.299R + 0.587G + 0.114B)
- **Below 40:** `low-light` warning -- face detection may be unreliable
- **Below 70:** `dim` warning -- accuracy may be reduced
- **15+ consecutive frames with no face detected:** `no-face-detected` warning

The quality warning is exposed via `getQualityWarning()` and can be used by the UI to show the user a prompt to improve lighting or camera positioning.

## Section 10: Coaching Nudges

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
- **Medium:** Default -- balanced set
- **High:** All conditions including encouragement nudges

### Configurable Parameters

- **minIntervalMs:** Minimum time between nudges (default 30s). Prevents nudge spam.
- **enabled:** Toggle nudges on/off
- **disabledRules:** Individual rules can be disabled by category

### Cooldown

Once a nudge is dismissed by the tutor, the same rule will not trigger again for **minIntervalMs** milliseconds. This respects tutor flow.

## Section 11: Data Flow

### Live Session

1. **Browser processing pipeline:**
   - Video frames -> MediaPipe Face Landmarker -> Gaze estimation + blendshape-based expression analysis
   - Audio stream -> VAD + speaking time + prosody/pitch analysis + turn-taking tracking
   - Combined signals -> Metrics Engine (runs at ~2-4Hz adaptive)
   - Metrics -> Zustand store (session state)

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

### Adaptive Frame Rate

The face mesh processor uses an adaptive frame rate to balance accuracy and performance:
- **Default:** 250ms (4 Hz)
- **Fast mode:** 150ms (~6-7 Hz) -- activated when processing is fast (<50ms) or when attention is declining
- **Slow mode:** 1000ms (1 Hz) -- activated after 10 consecutive missed frames or when processing takes >200ms

The `setFastMode()` API is exposed for external callers (e.g., the coaching system) to request higher frame rates when attention signals are declining.

### Analytics (Post-Session)

- **Initial load:** Try server API first
- **Fallback:** If server unavailable, load from IndexedDB
- **Dashboard:** Displays metrics timeline, student state transitions, nudge history

## Section 12: Known Limitations

See **[LIMITATIONS.md](LIMITATIONS.md)** for a comprehensive overview. Key architectural limitations:

- **Browser-only persistence:** Session data stored in IndexedDB in the tutor's browser. Clearing browser data loses all sessions. No cross-device sync.
- **Single face per tile:** Does not handle multiple faces in one feed.
- **Separate audio streams assumption:** With a single mixed audio source, interruption and speaking time accuracy is reduced.
- **WebRTC signaling:** When in multi-participant ("room") mode, uses a WebSocket-based signaling server. Real-time latency depends on network conditions.

For a full inventory, see **[LIMITATIONS.md](LIMITATIONS.md)**.

## Section 13: For Reviewers

### What to Trust

- **Engagement score as a relative indicator:** Comparing segment A (first 10 min) vs. segment B (last 10 min) within a single session is meaningful. The trend (rising/stable/declining) is more reliable than the absolute value.
- **Eye contact percentage:** The 120-sample rolling window is a reasonable proxy for "paying attention to the camera." It is accurate within +/-5% on front-facing setups with proper lighting. Auto-calibration improves this further.
- **Speaking time ratio:** If audio streams are clean and separate, the ratio is accurate. If audio is mixed or noisy, take results with caution.
- **Student state transitions:** The state machine provides a useful narrative of session flow (engaged -> drifting -> confused). Treat each state as probabilistic, not absolute.
- **Turn-taking metrics:** Turn count and gap times are reliable when audio streams are separate.

### What to Treat as Approximate

- **Absolute engagement score:** Do not compare a session with score 72 to one with score 69 as if they are measurably different. Use bands (e.g., "high" >70, "medium" 50-70, "low" <50).
- **Eye contact accuracy with glasses/multi-monitor:** If the student is wearing glasses or has multiple monitors, eye contact estimates may have +/-10-20% error.
- **Facial expression valence (energy level):** The "energy" component relies on smile detection and audio prosody. It is not validated against ground-truth measures. Treat it as a rough indicator, not a fact.
- **Interruption detection with overlapping speech:** The 1500ms threshold is a heuristic. Brief backchannel responses are correctly filtered, but some legitimate co-speaking may still be counted.
- **Pitch estimation:** The autocorrelation-based pitch detector is a simple heuristic and may be inaccurate in noisy environments or with non-speech audio.

### Hardware-Dependent Accuracy

Accuracy of gaze, expression, and interruption detection depends heavily on:
- **Camera quality and angle** -- Front-facing at eye level is optimal
- **Microphone quality and placement** -- Clear audio with minimal background noise
- **Lighting** -- Even, frontal lighting without backlighting; the system now warns when low-light is detected
- **Display setup** -- Single monitor; multi-monitor setups confound gaze estimation

For best results, use in a quiet room with good lighting and a front-facing camera.
