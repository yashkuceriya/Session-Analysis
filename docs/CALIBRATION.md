# Calibration Methodology

## Eye Contact Threshold

**Parameter:** `GAZE_THRESHOLD = 0.18` in `GazeEstimator.ts`

**Method:** The iris center position is computed relative to the eye inner and outer corners. A ratio of 0.5 in both X and Y means the iris is perfectly centered (looking straight at camera). The threshold defines how far the iris can deviate from center and still count as "looking at camera."

**Calibration:**
- 0.10: Very strict — only direct camera stare counts
- 0.15: Strict — looking at camera area
- **0.18: Default** — allows natural gaze variation while still detecting camera attention
- 0.25: Lenient — most forward-facing gaze counts
- 0.35: Very lenient — only clearly looking away registers as disengaged

**How to adjust:** Modify `GAZE_THRESHOLD` in `src/lib/video-processor/GazeEstimator.ts`. Test with your specific camera setup. If accuracy feels too strict (high false-negative rate), increase toward 0.22.

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

## EMA Smoothing

**Parameter:** `alpha = 0.3` across all metric EMA instances

**Meaning:** Each new measurement contributes 30% to the smoothed value, previous smoothed value contributes 70%.
- Higher alpha (0.5-0.8): More responsive but jittery
- Lower alpha (0.1-0.2): Smoother but slower to react
- **0.3: Default** — reacts to real changes within 1-2 seconds

## Engagement Score Weights

**Parameters in `DEFAULT_METRIC_CONFIG`:**
- Eye contact: 25%
- Speaking time balance: 25%
- Energy level: 20%
- Low interruptions: 15%
- Attention stability: 15%

**Rationale:** Eye contact and speaking time are the most directly observable and actionable metrics. Energy and interruptions are supporting signals. These weights can be adjusted per session type in the `MetricConfig`.

## Interruption Detection

**Parameter:** `OVERLAP_THRESHOLD_MS = 500` in `InterruptionDetector.ts`

Only simultaneous speech lasting >500ms counts as an interruption. This filters out backchannel responses ("mm-hmm", "right") which typically last 200-400ms.

## Coaching Nudge Thresholds

See `src/lib/coaching-system/NudgeRules.ts` for all trigger conditions. Key thresholds:
- Student silent > 3 min: medium nudge
- Student silent > 5 min: high priority nudge
- Student eye contact < 30% declining: medium nudge
- Tutor talk time > 80% after 5 min: low nudge
- Student energy < 25% after 10 min: low nudge

All thresholds are configurable via the sensitivity slider in the session UI.
