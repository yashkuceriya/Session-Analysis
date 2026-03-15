import { BlendshapeMap } from './types';
import { EmotionResult, EmotionLabel } from '../analysis/types';
import { EMA, RollingWindow } from '../utils/smoothing';

/**
 * 7-class emotion classifier using MediaPipe blendshapes
 * Maps facial action units to: happy, sad, angry, neutral, surprised, fearful, confused
 */
export class EmotionClassifier {
  private emotionEMA = new EMA(0.3); // Temporal smoothing
  private classificationHistory = new RollingWindow<{ emotion: EmotionLabel; timestamp: number }>(30);
  private lastUpdate: number = 0;

  /**
   * Classify emotion from blendshape coefficients
   * Returns structured emotion with confidence and all scores
   */
  classify(blendshapes: Record<string, number>): EmotionResult {
    const scores = this.computeEmotionScores(blendshapes);
    const emotion = this.selectDominantEmotion(scores);
    const confidence = scores[emotion];

    return {
      emotion,
      confidence,
      allScores: scores,
    };
  }

  /**
   * Get emotion timeline (last N classifications)
   */
  getEmotionTimeline(): Array<{ emotion: EmotionLabel; timestamp: number }> {
    return this.classificationHistory.getAll();
  }

  /**
   * Get dominant emotion over a time window
   * If windowMs not specified, uses entire history
   */
  getDominantEmotion(windowMs?: number): EmotionLabel {
    const now = Date.now();
    const timeline = this.classificationHistory.getAll();

    let recentEntries = timeline;
    if (windowMs) {
      recentEntries = timeline.filter(e => now - e.timestamp <= windowMs);
    }

    if (recentEntries.length === 0) return 'neutral';

    // Count emotion occurrences
    const counts: Record<EmotionLabel, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      neutral: 0,
      surprised: 0,
      fearful: 0,
      confused: 0,
    };

    for (const entry of recentEntries) {
      counts[entry.emotion]++;
    }

    // Return most common
    return (Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral') as EmotionLabel;
  }

  /**
   * Internal: compute confidence scores for all 7 emotions
   */
  private computeEmotionScores(bs: Record<string, number>): Record<EmotionLabel, number> {
    // Extract relevant blendshapes (safely with defaults)
    const mouthSmile = Math.max((bs.mouthSmileLeft ?? 0), (bs.mouthSmileRight ?? 0));
    const cheekSquint = Math.max((bs.cheekSquintLeft ?? 0), (bs.cheekSquintRight ?? 0));
    const mouthFrown = Math.max((bs.mouthFrownLeft ?? 0), (bs.mouthFrownRight ?? 0));
    const browInnerUp = bs.browInnerUp ?? 0;
    const browDown = Math.max((bs.browDownLeft ?? 0), (bs.browDownRight ?? 0));
    const jawClench = bs.jawOpen ? Math.max(0, 1 - (bs.jawOpen ?? 0)) : 0;
    const mouthPress = bs.mouthPress ?? 0;
    const browOuterUp = Math.max((bs.browOuterUpLeft ?? 0), (bs.browOuterUpRight ?? 0));
    const jawOpen = bs.jawOpen ?? 0;
    const eyeWide = Math.max((bs.eyeWideLeft ?? 0), (bs.eyeWideRight ?? 0));
    const mouthStretch = Math.max((bs.mouthPucker ?? 0) * -1 + 1, 0); // Inverse pucker
    const eyeSquint = Math.max((bs.eyeSquintLeft ?? 0), (bs.eyeSquintRight ?? 0));
    const mouthPucker = bs.mouthPucker ?? 0;

    // Asymmetry detection for confused (one brow up, one down)
    const browAsymmetry = Math.abs((bs.browDownLeft ?? 0) - (bs.browDownRight ?? 0));

    const scores: Record<EmotionLabel, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      neutral: 0,
      surprised: 0,
      fearful: 0,
      confused: 0,
    };

    // Happy: mouth smile (Duchenne smile with cheek squint)
    scores.happy = Math.min(
      1,
      (mouthSmile > 0.5 && cheekSquint > 0.3 ? 1 : 0.5) * mouthSmile
    );

    // Sad: mouth frown + inner brow raise
    scores.sad = Math.min(
      1,
      (mouthFrown > 0.4 && browInnerUp > 0.3 ? 1 : 0.6) * Math.max(mouthFrown, browInnerUp)
    );

    // Angry: brow down + jaw clench + mouth press
    if (browDown > 0.5 && jawClench > 0.3 && mouthPress > 0.3) {
      scores.angry = Math.min(1, (browDown + jawClench + mouthPress) / 3);
    } else if (browDown > 0.4) {
      scores.angry = browDown * 0.6;
    } else {
      scores.angry = 0;
    }

    // Surprised: brow raise + jaw open + eye wide
    if (browOuterUp > 0.5 && jawOpen > 0.4 && eyeWide > 0.4) {
      scores.surprised = Math.min(1, (browOuterUp + jawOpen + eyeWide) / 3);
    } else if (browOuterUp > 0.4 || eyeWide > 0.4) {
      scores.surprised = Math.max(browOuterUp, eyeWide) * 0.7;
    } else {
      scores.surprised = 0;
    }

    // Fearful: inner brow raise + eye wide + mouth stretch
    if (browInnerUp > 0.5 && eyeWide > 0.5 && mouthStretch > 0.3) {
      scores.fearful = Math.min(1, (browInnerUp + eyeWide + mouthStretch) / 3);
    } else if (browInnerUp > 0.4 && eyeWide > 0.4) {
      scores.fearful = Math.max(browInnerUp, eyeWide) * 0.7;
    } else {
      scores.fearful = 0;
    }

    // Confused: asymmetric brows + mouth pucker (or no clear expression)
    if (browAsymmetry > 0.2 && mouthPucker > 0.2) {
      scores.confused = Math.min(1, (browAsymmetry + mouthPucker) / 2);
    } else if (browAsymmetry > 0.25 || eyeSquint > 0.4) {
      scores.confused = Math.max(browAsymmetry, eyeSquint * 0.6);
    } else {
      scores.confused = 0;
    }

    // Neutral: when all signals are below thresholds
    const emotionEnergy =
      scores.happy + scores.sad + scores.angry + scores.surprised + scores.fearful + scores.confused;
    scores.neutral = Math.max(0, 1 - emotionEnergy);

    // Normalize to 0-1
    for (const emotion of Object.keys(scores) as EmotionLabel[]) {
      scores[emotion] = Math.min(1, Math.max(0, scores[emotion]));
    }

    return scores;
  }

  /**
   * Select dominant emotion from all scores
   */
  private selectDominantEmotion(scores: Record<EmotionLabel, number>): EmotionLabel {
    let maxScore = 0;
    let maxEmotion: EmotionLabel = 'neutral';

    for (const [emotion, score] of Object.entries(scores) as Array<[EmotionLabel, number]>) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion;
      }
    }

    return maxEmotion;
  }

  /**
   * Update internal history (called after each classify)
   */
  recordClassification(emotion: EmotionLabel, timestamp: number = Date.now()) {
    this.classificationHistory.push({ emotion, timestamp });
    this.lastUpdate = timestamp;
  }

  /**
   * Reset all internal state
   */
  reset() {
    this.emotionEMA.reset();
    this.classificationHistory.clear();
    this.lastUpdate = 0;
  }
}
