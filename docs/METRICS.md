# Session Analysis Metrics Reference

This document provides comprehensive documentation for all metrics tracked by the Session Analysis platform, how they are computed, and how they are used to assess tutoring session quality.

## Overview

The platform tracks metrics across three dimensions:

1. **Participant Metrics** — Individual characteristics of tutor and student
2. **Session Metrics** — Aggregate session-level statistics
3. **Expression Metrics** — Facial expression and body language signals

All metrics are captured at regular intervals (typically 500ms-1s) throughout the session, creating a detailed timeline of engagement dynamics.

## Participant Metrics

### Eye Contact Score

**Type:** `number` (0-1)
**Updated:** Every frame (video enabled) or every 1s (video disabled)
**Formula:** Ratio of time looking at camera vs. away

#### Calculation

The system uses MediaPipe Face Landmarker to detect 478 facial landmarks, including iris position and eye corners.

**Iris-to-Eye Ratio:**
```
iris_x_ratio = (iris_center_x - inner_corner_x) / (outer_corner_x - inner_corner_x)
iris_y_ratio = (iris_center_y - top_corner_y) / (bottom_corner_y - top_corner_y)
```

A ratio of **0.5 in both X and Y** indicates eyes centered on the camera (perfect eye contact).

**Gaze Threshold:** Deviation > 0.18 (18% from center) classifies as "not looking at camera"

**Score Smoothing:** Uses exponential moving average (EMA) with alpha=0.15:
```
smoothed = 0.15 * current_frame + 0.85 * previous_smoothed
```

#### Interpretation

| Score | Quality | Implication |
|-------|---------|------------|
| 0.8-1.0 | Strong focus | Student maintained eye contact throughout |
| 0.6-0.8 | Good | Generally attentive with brief lapses |
| 0.4-0.6 | Fair | Frequent eye contact lapses |
| 0.2-0.4 | Poor | Minimal eye contact |
| 0.0-0.2 | Very Poor | Almost never looking at camera |

#### Known Issues

- **Glasses/Reflections** — Reflective lenses can hide iris position
- **Lighting** — Backlit or low-light conditions degrade accuracy
- **Camera Angle** — Off-center camera position shifts baseline
- **Mitigations:** Calibration modes allow adjusting thresholds per user

### Talk Time Percent

**Type:** `number` (0-1)
**Updated:** Every 500ms-1s
**Formula:** Fraction of time speaking in the recent window

#### Calculation

Audio analysis detects speech vs. silence:
1. **Audio Energy:** Extract RMS (root mean square) from audio buffer
2. **Energy Threshold:** If energy > threshold, classify as "speaking"
3. **Smoothing:** Apply moving average over 5-second window
4. **Ratio:** `speaking_time / window_duration`

**Threshold Calibration:** Automatically adjusted to 2x baseline noise energy

#### Ideal Ratios by Session Type

| Session Type | Tutor % | Student % | Rationale |
|-------------|---------|-----------|-----------|
| **Lecture** | 75% | 25% | Tutor delivering content; student listening |
| **Practice** | 40% | 60% | Student solving problems; tutor guiding |
| **Discussion** | 50% | 50% | Balanced peer-like exchange |

#### Scoring Impact

The system compares actual ratio to ideal:
```
balance_score = 1 - abs(student_actual - student_ideal)
```

A perfect match scores 1.0; deviation reduces score.

### Energy Score

**Type:** `number` (0-1)
**Updated:** Every 500ms-1s
**Components:** Audio energy (0.5) + Expression valence (0.5)

#### Audio Energy Component

**Calculation:**
```
audio_energy = RMS(audio_buffer) / max_possible_RMS
normalized = clamp(audio_energy, 0, 1)
smoothed = EMA(normalized, alpha=0.15)
```

**Interpretation:**
- Low energy: Monotone, quiet voice
- High energy: Animated, expressive delivery

#### Expression Valence Component

**Calculation:**
```
valence = 0.4 * smile + 0.3 * browRaise + 0.3 * concentration - 0.3 * confusion
clamped = clamp(valence, 0, 1)
```

**Interpretation:**
- Positive valence: Smile, raised brows, visible interest
- Negative valence: Furrowed brows, confusion signals

#### Combined Score

```
energy_score = 0.5 * audio_energy + 0.5 * expression_valence
smoothed = EMA(energy_score, alpha=0.15)
```

### Speech Rate

**Type:** `number` (0-1)
**Updated:** Every 1s
**Formula:** Fraction of time speaking in recent window (separate from talk time %)

#### Calculation

Detects rapid speech transitions:
```
speech_rate = (time_speaking_in_window / window_duration)
```

Typically used to detect:
- Rapid-fire questions (high speech rate)
- Slow, deliberate explanation (low speech rate)
- Comfortable pacing (0.3-0.7)

### Pitch Variance

**Type:** `number` (0+)
**Updated:** Every 1s
**Formula:** Standard deviation of fundamental frequency

#### Calculation

1. **Fundamental Frequency (F0):** Extract using autocorrelation or YIN algorithm
2. **Variance:** `stdev(f0_values_in_window)`
3. **Interpretation:** Higher variance = more expressive/animated speaking

#### Interpretation

| Range | Quality | Implication |
|-------|---------|------------|
| > 100 Hz | Very High | Highly animated, theatrical |
| 50-100 Hz | High | Expressive, engaging tone |
| 20-50 Hz | Moderate | Natural conversation |
| < 20 Hz | Low | Monotone, disengaged |

### Head Movement

**Type:** `number` (0-1)
**Updated:** Every frame
**Formula:** Magnitude of head position changes

#### Calculation

MediaPipe tracks head pose (rotation + translation):
```
head_movement = sqrt(
  (rotation_delta_x)^2 +
  (rotation_delta_y)^2 +
  (rotation_delta_z)^2
) / max_expected_movement
```

**Normalization:** Calibrated so fidgeting = 0.5-1.0, stillness = 0.0-0.2

#### Interpretation

| Score | Behavior | Implication |
|-------|----------|------------|
| 0.0-0.1 | Stationary | Focused, possibly rigidly still |
| 0.1-0.3 | Normal | Natural body movement |
| 0.3-0.6 | Active | Engaged but somewhat restless |
| 0.6-1.0 | Fidgeting | High distraction or anxiety |

### Blink Rate

**Type:** `number` (blinks per minute)
**Updated:** Every 1-2s
**Formula:** Frequency of eye closure/opening events

#### Calculation

1. **Eye Closure Detection:** Eye aspect ratio falls below threshold
2. **Blink Identification:** Closure lasts 100-400ms (excludes squints/winks)
3. **Rate:** Count per 60-second window

**Normal Range:** 15-20 blinks/minute
**Elevated:** 25+ blinks/minute (stress, fatigue, dryness)
**Low:** < 10 blinks/minute (rare; may indicate intense focus)

#### Interpretation

| Rate | State | Possible Cause |
|------|-------|----------------|
| < 10 | Hyper-focus | Intense concentration |
| 15-20 | Normal | Baseline relaxed state |
| 25-30 | Elevated | Stress, cognitive load |
| 30+ | Very Elevated | Severe anxiety or fatigue |

### Distraction Score

**Type:** `number` (0-1)
**Updated:** Every 1-2s
**Formula:** Composite of gaze deviation + head movement + expression

#### Calculation

```
distraction = 0.5 * gaze_deviation
            + 0.3 * head_movement
            + 0.2 * (1 - concentration)
smoothed = EMA(distraction, alpha=0.15)
```

#### Interpretation

| Score | State | Trigger |
|-------|-------|---------|
| 0.0-0.2 | Focused | Minimal distraction signals |
| 0.2-0.4 | Normal | Expected level of attention shifts |
| 0.4-0.6 | Distracted | Noticeable but manageable |
| 0.6-0.8 | Very Distracted | Significant attention issues |
| 0.8-1.0 | Severely Distracted | Critical engagement loss |

### Gaze Deviation

**Type:** `number` (0-1)
**Updated:** Every frame
**Formula:** Distance of gaze from center (camera direction)

#### Calculation

Normalized distance from iris center to ideal gaze point:
```
gaze_deviation = sqrt((iris_x - 0.5)^2 + (iris_y - 0.5)^2) / sqrt(2)
```

- 0.0 = Perfect center gaze
- 0.5 = 45-degree off-angle
- 1.0 = Looking completely away

### Posture

**Type:** `string` ("upright" | "leaning" | "slouching")
**Updated:** Every 1-2s
**Formula:** Head position relative to shoulder baseline

#### Calculation

Uses head position (from MediaPipe) relative to shoulder landmarks:
```
head_shoulder_distance = norm(head_position - shoulder_center)

if distance > upright_threshold:
  posture = "upright"
elif distance < slouch_threshold:
  posture = "slouching"
else:
  posture = "leaning"
```

#### Interpretation

| Posture | Energy Level | Engagement |
|---------|-------------|-----------|
| Upright | High | Actively engaged |
| Leaning | Moderate | Interested but relaxed |
| Slouching | Low | Disengaged or fatigued |

## Session Metrics

### Interruption Count

**Type:** `number`
**Updated:** Real-time
**Formula:** Count of speech overlaps

#### Calculation

Detects when both participants are speaking:
```
if speaker1_active AND speaker2_active:
  interruption_count += 1 (per overlap window)
```

**Smoothing:** Counts continuous overlaps as single interruption

#### Interpretation

| Count | Rate | Quality |
|-------|------|---------|
| 0-2 | Very Low | Highly respectful, perhaps disengaged |
| 2-5 | Low | Natural dialogue with minimal cross-talk |
| 5-10 | Moderate | Some interruptions; typical conversation |
| 10+ | High | Frequent overlaps; power dynamics issue |

### Silence Duration Current

**Type:** `number` (milliseconds)
**Updated:** Real-time
**Formula:** Continuous silence length

#### Calculation

Tracks the current uninterrupted silence:
```
if no_speaker_detected():
  current_silence_ms += 1000
else:
  silence_duration_current = current_silence_ms
  current_silence_ms = 0
```

#### Thresholds

| Duration | Implication |
|----------|------------|
| 0-2s | Natural pacing |
| 2-5s | Think time (acceptable) |
| 5-10s | Too long; engagement risk |
| 10s+ | Critical; tutor should intervene |

### Engagement Trend

**Type:** `string` ("rising" | "stable" | "declining")
**Updated:** Every 10-20 metrics
**Formula:** Slope of engagement score over time

#### Calculation

Linear regression over recent engagement scores:
```
trend = slope(engagement_scores_recent_window)

if trend > 5 points per minute:
  trend = "rising"
elif trend < -5 points per minute:
  trend = "declining"
else:
  trend = "stable"
```

#### Interpretation

- **Rising:** Session is improving; keep current approach
- **Stable:** Engagement maintaining; can stay course
- **Declining:** Intervention needed; consider nudge

### Attention Drift Detected

**Type:** `boolean`
**Updated:** Real-time
**Formula:** Rapid drop in eye contact + gaze deviation

#### Calculation

Triggers when both conditions hold:
```
eye_contact_delta < -0.3 AND
gaze_deviation > 0.4
```

Indicates sudden shift away from camera.

### Turn Taking Gap Ms

**Type:** `number` (milliseconds)
**Updated:** On each speaker transition
**Formula:** Time between speaker transitions

#### Calculation

Measures pause between one speaker stopping and another starting:
```
gap_ms = time_speaker2_starts - time_speaker1_stops
```

#### Interpretation

| Gap | Quality | Implication |
|-----|---------|------------|
| 0-500ms | Excellent | Natural conversation flow |
| 500ms-2s | Good | Comfortable think time |
| 2-5s | Fair | Some hesitation |
| 5s+ | Poor | Too much dead air |

### Turn Count

**Type:** `number`
**Updated:** On each speaker transition
**Formula:** Total number of speaker exchanges

#### Calculation

Increments each time speaker changes:
```
if previous_speaker != current_speaker:
  turn_count += 1
```

#### Interpretation

| Count | Quality | Time | Ratio |
|-------|---------|------|-------|
| < 3 | Limited | < 5 min | Very tutor-heavy |
| 3-5 | Minimal | 5-10 min | Mostly tutor |
| 5-10 | Good | 10-20 min | Balanced |
| 10+ | Active | 20+ min | Dynamic dialogue |

### Focus Streak Ms

**Type:** `number` (milliseconds)
**Updated:** Periodically
**Formula:** Longest continuous focus duration

#### Calculation

Tracks sustained periods of high engagement (engagement > 70):
```
if engagement_score > 70:
  current_focus_streak += elapsed_ms
  max_focus_streak = max(max_focus_streak, current_focus_streak)
else:
  current_focus_streak = 0
```

#### Interpretation

| Duration | Capability | Session Quality |
|----------|-----------|-----------------|
| < 1 min | Poor focus | Highly distractible |
| 1-3 min | Fair | Needs break structure |
| 3-10 min | Good | Normal attention span |
| 10+ min | Excellent | Deep engagement |

### Distraction Events

**Type:** `number`
**Updated:** Periodically
**Formula:** Count of distraction episodes

#### Calculation

Counts transitions from focused to distracted:
```
if distraction_score increases from < 0.4 to > 0.6:
  distraction_events += 1
```

#### Interpretation

| Count | Pattern | Implication |
|-------|---------|------------|
| 0-1 | Stable | Excellent focus throughout |
| 1-3 | Few breaks | Normal attention with minor shifts |
| 3-5 | Several | Moderate attention issues |
| 5+ | Frequent | Significant engagement problems |

## Expression Metrics

### Smile (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** MediaPipe mouth corner landmarks; smile curves lips upward

**Interpretation:**
- 0.0 = Neutral/straight mouth
- 0.5 = Moderate smile
- 1.0 = Full Duchenne smile

**Implication:** Positive emotion, comfort, engagement

### Confusion (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Furrowed brows + mouth shape + eye narrowing

**Interpretation:**
- 0.0 = No confusion signals
- 0.5 = Mild uncertainty
- 1.0 = Clear confusion or concentration

**Implication:** Misunderstanding, cognitive effort, or uncertainty

### Concentration (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Eye narrowing + brow position + steady gaze

**Interpretation:**
- 0.0 = Relaxed, not focused
- 0.5 = Normal attention
- 1.0 = Intense focus

**Implication:** Cognitive effort, deep engagement

### Surprise (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Eyebrow raise + mouth open + eye widening

**Interpretation:**
- 0.0 = No surprise
- 0.5 = Mild shock
- 1.0 = Acute surprise/alarm

**Implication:** Unexpected information, reaction to new concept

### Energy (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Overall facial movement intensity + expression magnitude

**Interpretation:**
- 0.0 = Blank, no expression
- 0.5 = Moderate animation
- 1.0 = Highly animated

**Implication:** Engagement level, enthusiasm, attention

### Valence (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Balance of positive (smile, brow raise) vs. negative (frown, furrowed brows)

**Interpretation:**
- 0.0 = Very negative mood
- 0.5 = Neutral
- 1.0 = Very positive mood

**Implication:** Overall sentiment, emotional state

### Brow Furrow (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Inner eyebrow position; closer = more furrowed

**Interpretation:**
- 0.0 = No furrow; relaxed brows
- 0.5 = Mild furrow
- 1.0 = Deep furrowing

**Implication:** Frustration, effort, concentration

### Brow Raise (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Eyebrow height; higher = more raised

**Interpretation:**
- 0.0 = Normal/lowered brows
- 0.5 = Moderately raised
- 1.0 = Fully elevated

**Implication:** Surprise, interest, engagement

### Head Nod (-1 to 1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Head vertical rotation; positive = downward, negative = upward

**Interpretation:**
- -1.0 = Head shake (disagreement)
- 0.0 = Still
- 1.0 = Nodding (agreement)

**Implication:** Agreement signal, active listening, encouragement

### Head Shake (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Head horizontal rotation magnitude

**Interpretation:**
- 0.0 = No shake
- 0.5 = Mild shake
- 1.0 = Vigorous shake

**Implication:** Disagreement, skepticism, refusal

### Mouth Open (0-1)

**Type:** `number`
**Updated:** Every frame

**Detection:** Vertical distance between lips

**Interpretation:**
- 0.0 = Closed mouth
- 0.5 = Partially open
- 1.0 = Fully open

**Implication:** Speaking, surprise, engagement

### Head Tilt (radians)

**Type:** `number`
**Updated:** Every frame

**Detection:** Head rotation around forward-backward axis

**Interpretation:**
- -π/2 = Tilted fully left
- 0 = Upright
- π/2 = Tilted fully right

**Implication:** Curiosity, interest, confusion (context-dependent)

## Derived Metrics

### Frustration

**Formula:**
```
frustration = 0.5 * brow_furrow
            + 0.3 * (1 - valence)
            + 0.2 * (1 - smile)
```

**Interpretation:** Combined signal of frustration from facial cues

### Interest

**Formula:**
```
interest = 0.4 * brow_raise
         + 0.4 * concentration
         + 0.2 * eye_contact_score
```

**Interpretation:** Composite engagement and attention signal

## Student State Classification

Based on the metrics above, students are classified into one of five states:

### Engaged

**Conditions:**
- Engagement score > 70
- Eye contact > 0.5
- Valence > 0.4
- Concentration > 0.6

**Characteristics:** Active participation, positive expressions, strong attention

### Passive

**Conditions:**
- Engagement score 40-70
- Eye contact 0.3-0.6
- Energy < 0.4
- Minimal head movement

**Characteristics:** Present but not actively engaged; may be listening passively

### Confused

**Conditions:**
- Confusion > 0.5
- Concentration > 0.5
- Valence < 0.4
- Brow furrow > 0.4

**Characteristics:** Shows signs of not understanding; cognitive struggle evident

### Drifting

**Conditions:**
- Engagement score declining
- Eye contact < 0.4
- Gaze deviation > 0.6
- Attention drift detected

**Characteristics:** Attention is shifting away from the task; becoming distracted

### Struggling

**Conditions:**
- Distraction score > 0.7
- Energy < 0.3
- Frustration > 0.6
- Engagement score < 50

**Characteristics:** Overwhelmed or frustrated; may need significant intervention

## Engagement Score Deep Dive

### Complete Formula

```
engagement_score =
  0.25 * eye_contact_score                           // Eye Contact Weight
  + 0.25 * (1 - abs(student_ratio - ideal_ratio))   // Speaking Balance
  + 0.20 * energy_score                              // Energy Weight
  + 0.15 * (1 - interruption_penalty)               // Interruption Weight
  + 0.15 * attention_stability_score                 // Attention Stability
```

All components are normalized to 0-1, then weighted and summed. Final score is on 0-100 scale.

### Component Details

#### Eye Contact Score (25% by default)
```
eye_contact_score = smoothed_eye_contact_ratio
```
Direct measurement of looking at camera

#### Speaking Balance (25% by default)
```
student_ratio = student_talk_time / total_talk_time
ideal_ratio = SESSION_TYPE_WEIGHTS[sessionType].studentIdealRatio
balance_score = 1 - abs(student_ratio - ideal_ratio)
```
Penalizes deviations from ideal talk time ratio

#### Energy Score (20% by default)
```
energy_score = 0.5 * audio_energy + 0.5 * expression_valence
```
Combined audio and expression vitality

#### Interruption Penalty (15% by default)
```
expected_interruptions = (duration_min / 5)  // ~1 per 5 min is normal
interruption_penalty = min(1, actual_interruptions / expected_interruptions)
interruption_score = 1 - interruption_penalty
```
Penalizes excessive overlapping speech

#### Attention Stability (15% by default)
```
recent_scores = engagement_scores[-10:]  // Last 10 measurements
stability_score = 1 - (stdev(recent_scores) / 100)
```
Rewards consistent engagement; penalizes wild swings

## Session Type Weighting

Weights are adjusted based on pedagogical intent:

### Lecture (Tutor-Heavy)
```
eyeContactWeight: 0.30      // Eye contact critical for attention
speakingTimeWeight: 0.15    // Student talks less
energyWeight: 0.25          // Tutor energy drives engagement
interruptionWeight: 0.10    // Interruptions less relevant
attentionWeight: 0.20       // Attention stability paramount
```

### Practice (Student-Heavy)
```
eyeContactWeight: 0.20      // Some looking away while problem-solving OK
speakingTimeWeight: 0.30    // Student talking is central
energyWeight: 0.15          // Energy less critical
interruptionWeight: 0.15    // Some overlap expected in discussion
attentionWeight: 0.20       // Still need focus on task
```

### Discussion (Balanced)
```
eyeContactWeight: 0.25      // Peer-to-peer engagement
speakingTimeWeight: 0.25    // Equal participation expected
energyWeight: 0.20          // Moderate energy
interruptionWeight: 0.15    // Natural conversation overlap
attentionWeight: 0.15       // Less critical than lecture
```

## Limitations & Calibration

### Known Limitations

1. **Camera Dependency** — All computer vision metrics assume front-facing camera
2. **Glasses/Reflections** — Reflective lenses interfere with iris detection
3. **Lighting** — Low/inconsistent light degrades facial detection
4. **Audio Quality** — Background noise affects audio analysis
5. **Cultural Bias** — Expression training data may not cover all cultures
6. **Single-Person Focus** — Designed for 1-on-1; multi-student support limited

### Calibration Options

- **Gaze Threshold:** Adjustable per user to account for camera angle
- **Energy Baseline:** Calibrated against user's normal audio level
- **Interrupt Threshold:** Tuned to conversation style (overlapping vs. turn-taking)

See `docs/CALIBRATION.md` for detailed calibration procedures.

## Summary

The Session Analysis metrics system provides a comprehensive, real-time assessment of tutoring quality by tracking:
- **Individual behaviors** through participant metrics
- **Session dynamics** through aggregate metrics
- **Emotional/cognitive state** through expression analysis

These are combined into actionable engagement scores and student state classifications, enabling instant feedback and post-session insights.

For detailed methodology and limitations, see `docs/METHODOLOGY.md` and `docs/LIMITATIONS.md`.
