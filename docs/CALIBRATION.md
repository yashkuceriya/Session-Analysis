# Calibration Methodology

## Eye Contact / Gaze Threshold

**Parameter:** `DEFAULT_GAZE_THRESHOLD = 0.28` in `GazeEstimator.ts`

**Method:** The iris center position is computed relative to the eye inner and outer corners, weighted by eye openness. A ratio of 0.5 in both X and Y means the iris is perfectly centered (looking straight at camera). The threshold defines how far the iris can deviate from center and still count as "looking at camera."

**Threshold scale:**
- 0.10: Very strict -- only direct camera stare counts
- 0.15: Strict -- looking at camera area
- 0.20: Moderate -- reasonable for calibrated setups
- **0.28: Default** -- wider threshold that works across varied webcam setups without manual calibration
- 0.35: Very lenient -- only clearly looking away registers as disengaged

**How to adjust:** Modify `DEFAULT_GAZE_THRESHOLD` in `src/lib/video-processor/GazeEstimator.ts`. Test with your specific camera setup.

### Auto-Calibration

**Parameter:** `AUTO_CALIBRATION_SAMPLES = 20` (~5 seconds at 4Hz)

The system automatically calibrates the gaze center from the first 20 non-blink frames. During this window it assumes the user is roughly looking at the camera (typical during session setup). If the computed mean gaze center is within a reasonable range of the expected center (|meanX - 0.5| < 0.25, |meanY - 0.5| < 0.3), the calibration is accepted. Otherwise the system falls back to the default center of 0.5.

Auto-calibration personalizes the gaze center to each user's webcam position and head angle, improving accuracy without requiring explicit user interaction.

### Manual Calibration

When manual calibration is triggered:
- Outliers beyond 2 standard deviations are removed
- Dynamic threshold = 2x standard deviation of filtered samples, clamped to [0.08, 0.25]

Manual calibration overrides auto-calibration.

### Blink Detection

**Parameter:** `BLINK_ASPECT_RATIO_THRESHOLD = 0.15`

Eye aspect ratio (vertical / horizontal distance) below 0.15 is classified as a blink. Blinks are excluded from gaze estimation to avoid corrupting the signal.

### Gaze EMA Smoothing

**Parameter:** `alpha = 0.35` for gaze X and Y

Applied to the raw iris ratio before threshold comparison. Reduces frame-to-frame noise while remaining responsive to real gaze shifts.

## Voice Activity Detection

**Parameters in `VoiceActivityDetector.ts`:**
- `ENERGY_THRESHOLD_RATIO = 0.15`: Fraction of recent max energy that counts as speech
- `HANGOVER_MS = 200`: How long "speaking" state persists after energy drops
- `energyDecay = 0.995`: How quickly the adaptive max energy decays

**Calibration:**
- The adaptive threshold (`0.15 * maxRecentEnergy + baseline`) handles varying microphone gains automatically
- `HANGOVER_MS` prevents rapid on/off toggling during natural speech pauses between words
- If VAD is too sensitive (detecting breathing as speech), increase `ENERGY_THRESHOLD_RATIO` to 0.20-0.25
- If VAD misses quiet speech, decrease to 0.10

## EMA Smoothing (Per Component)

Different components use different EMA alpha values tuned to their signal characteristics:

| Component | Alpha | Rationale |
|-----------|-------|-----------|
| Engagement score | 0.15 | Slow-moving; avoids jitter from momentary lapses |
| Gaze X/Y smoothing | 0.35 | Needs responsiveness to track eye movement |
| Valence | 0.3 | Moderate; facial expressions shift gradually |
| Energy (expression) | 0.3 | Moderate; tracks animation level |
| Confusion | 0.25 | Slightly slower; confusion is a sustained state |
| Concentration | 0.25 | Slightly slower; concentration is a sustained state |

**General guidance:**
- Higher alpha (0.5-0.8): More responsive but jittery
- Lower alpha (0.1-0.2): Smoother but slower to react
- 0.25-0.35: Good balance for facial expression signals

## Expression Analysis Thresholds

### Frustration (Blendshape Path)

```
frustration = browFurrow * 0.45 + frown * 0.35 + facialTension * 0.2
```

Where `facialTension = max(mouthPress, mouthPucker)`. This avoids double-counting through valence.

### Interest (Blendshape Path)

```
interest = browRaise * 0.25 + concentration * 0.35 + eyeWide * 0.15 + smile * 0.1 + (1 - max(frown, browFurrow)) * 0.15
```

Uses direct curiosity signals rather than `(1 - frown)` to avoid baseline-high bias.

### Student State Thresholds

| Condition | Threshold | Used For |
|-----------|-----------|----------|
| Eye contact low | < 0.3 | Drifting, confused detection |
| Silence long | > 15,000 ms | Struggling, confused detection |
| Energy low | < 0.25 | Struggling detection |
| Engagement low | < 0.4 | Struggling, passive detection |
| Confusion high | > 0.45 | Confused state |
| BrowFurrow high | > 0.5 | Struggling state |
| Concentration low | < 0.3 | Drifting state |
| Drifting silence | > 8,000 ms | Drifting state |
| Talk time low | < 15% | Passive state |
| Warmup period | First 8s | Always reports "engaged" |

## Engagement Score Weights

**Default weights (Discussion session type):**
- Eye contact: 25%
- Speaking time balance: 25%
- Energy level: 20%
- Low interruptions: 15%
- Attention stability: 15%

**Rationale:** Eye contact and speaking time are the most directly observable and actionable metrics. Energy and interruptions are supporting signals. These weights are adjusted per session type (see METHODOLOGY.md).

## Interruption Detection

**Parameter:** `OVERLAP_THRESHOLD_MS = 1500` in `InterruptionDetector.ts`

Only simultaneous speech lasting >1500ms counts as an interruption. This was increased from 500ms to reduce false positives from backchannel responses ("mm-hmm", "right", "yeah") and brief co-speaking.

## Turn-Taking

**Parameter:** Max gap for turn detection = 30,000ms in `TurnTakingTracker.ts`

Gaps longer than 30 seconds between speakers are excluded (treated as silence, not a conversational turn).

## Prosody / Pitch Analysis

**Parameters in `ProsodyAnalyzer.ts`:**
- Volume rolling window: 100 samples (~10 seconds at 10Hz)
- Pitch rolling window: 50 samples (~5 seconds)
- Speech frame window: 100 samples (10 seconds)
- Valid pitch range: 60-500 Hz (human voice)
- Minimum RMS for pitch detection: 0.01

## Video Quality Detection

**Parameters in `FaceMeshProcessor.ts`:**
- Brightness sample size: 64x64 pixels (center of frame)
- Low-light threshold: luminance < 40 (of 255)
- Dim threshold: luminance < 70 (of 255)
- No-face-detected threshold: 15+ consecutive frames with no face

## Adaptive Frame Rate

**Parameters in `useFaceMesh.ts`:**
- Default interval: 250ms (4 Hz)
- Fast interval: 150ms (~6-7 Hz) -- when processing is fast and face is detected
- Slow interval: 1000ms (1 Hz) -- after 10 consecutive null frames or slow processing (>200ms)
- Processing too slow threshold: 200ms -- triggers gradual slowdown (1.5x current interval)

## Coaching Nudge Thresholds

See `src/lib/coaching-system/NudgeRules.ts` for all trigger conditions. Key thresholds:
- Student silent > 3 min: medium nudge
- Student silent > 5 min: high priority nudge
- Student eye contact < 30% declining: medium nudge
- Tutor talk time > 80% after 5 min: low nudge
- Student energy < 25% after 10 min: low nudge

All thresholds are configurable via the sensitivity slider in the session UI.
