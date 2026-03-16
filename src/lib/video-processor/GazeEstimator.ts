import { FaceLandmark, GazeResult } from './types';
import { irisOffsetRatio } from '../utils/geometry';
import { EMA } from '../utils/smoothing';

// MediaPipe Face Mesh landmark indices
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;

const DEFAULT_GAZE_THRESHOLD = 0.28; // Wider threshold — works without calibration for most webcam setups
const BLINK_ASPECT_RATIO_THRESHOLD = 0.15;
const AUTO_CALIBRATION_SAMPLES = 40; // ~10 seconds at 4Hz — auto-calibrate from initial gaze center

export interface GazeCalibration {
  centerX: number;
  centerY: number;
  threshold: number;
}

export class GazeEstimator {
  private smoothX = new EMA(0.35);
  private smoothY = new EMA(0.35);
  private calibration: GazeCalibration | null = null;
  private calibrationSamples: { x: number; y: number }[] = [];
  private isCalibrating = false;
  private blinkCount = 0;
  private blinkTimestamps: number[] = [];
  private wasBlinking = false;
  // Auto-calibration: silently collect initial samples to find the user's natural "looking at camera" center
  private autoCalSamples: { x: number; y: number }[] = [];
  private autoCalDone = false;

  estimate(landmarks: FaceLandmark[]): GazeResult | null {
    if (!landmarks || landmarks.length < 478) return null;

    // Blink detection: skip frame if eyes are closed
    const blinking = this.isBlinking(landmarks);

    // Track blink count and timestamps
    if (blinking && !this.wasBlinking) {
      this.blinkTimestamps.push(Date.now());
      this.blinkCount++;
    }
    this.wasBlinking = blinking;

    if (blinking) {
      return null; // Don't corrupt gaze estimate during blinks
    }

    const leftIris = landmarks[LEFT_IRIS_CENTER];
    const rightIris = landmarks[RIGHT_IRIS_CENTER];
    const leftInner = landmarks[LEFT_EYE_INNER];
    const leftOuter = landmarks[LEFT_EYE_OUTER];
    const rightInner = landmarks[RIGHT_EYE_INNER];
    const rightOuter = landmarks[RIGHT_EYE_OUTER];

    if (!leftIris || !rightIris) return null;

    const leftRatio = irisOffsetRatio(leftIris, leftInner, leftOuter);
    const rightRatio = irisOffsetRatio(rightIris, rightInner, rightOuter);

    // Weight by eye openness (more open eye = more reliable)
    const leftOpen = this.eyeOpenness(landmarks, 'left');
    const rightOpen = this.eyeOpenness(landmarks, 'right');
    const totalOpen = leftOpen + rightOpen;
    const leftWeight = totalOpen > 0 ? leftOpen / totalOpen : 0.5;
    const rightWeight = totalOpen > 0 ? rightOpen / totalOpen : 0.5;

    const avgX = leftRatio.x * leftWeight + rightRatio.x * rightWeight;
    const avgY = leftRatio.y * leftWeight + rightRatio.y * rightWeight;

    // Collect calibration samples
    if (this.isCalibrating) {
      this.calibrationSamples.push({ x: avgX, y: avgY });
      // Don't return results during calibration to avoid noise
    }

    // Auto-calibration: silently determine the user's natural gaze center
    // from the first ~10 seconds of data (assumes user is roughly looking at camera initially)
    if (!this.autoCalDone && !this.calibration) {
      this.autoCalSamples.push({ x: avgX, y: avgY });
      if (this.autoCalSamples.length >= AUTO_CALIBRATION_SAMPLES) {
        const xs = this.autoCalSamples.map(s => s.x);
        const ys = this.autoCalSamples.map(s => s.y);
        const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
        const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
        // Only auto-calibrate if the center is reasonably close to 0.5 (user was looking at camera)
        if (Math.abs(meanX - 0.5) < 0.25 && Math.abs(meanY - 0.5) < 0.3) {
          this.calibration = {
            centerX: meanX,
            centerY: meanY,
            threshold: DEFAULT_GAZE_THRESHOLD,
          };
        }
        this.autoCalDone = true;
      }
    }

    const smoothedX = this.smoothX.update(avgX);
    const smoothedY = this.smoothY.update(avgY);

    // Use calibrated center or default
    const centerX = this.calibration?.centerX ?? 0.5;
    const centerY = this.calibration?.centerY ?? 0.5;
    const threshold = this.calibration?.threshold ?? DEFAULT_GAZE_THRESHOLD;

    const deviationX = Math.abs(smoothedX - centerX);
    const deviationY = Math.abs(smoothedY - centerY);

    const isLookingAtCamera = deviationX < threshold && deviationY < threshold;

    // Sigmoid confidence (penalizes larger deviations more)
    const maxDeviation = Math.max(deviationX, deviationY);
    const confidence = 1 / (1 + Math.exp(10 * (maxDeviation - threshold)));

    // Normalized deviation (0-1)
    const normalizedDeviation = Math.min(1, maxDeviation / (threshold * 2));

    return {
      isLookingAtCamera,
      gazeDirection: { x: smoothedX - centerX, y: smoothedY - centerY },
      confidence,
      deviation: normalizedDeviation,
    };
  }

  private isBlinking(landmarks: FaceLandmark[]): boolean {
    const leftAR = this.eyeAspectRatio(landmarks, 'left');
    const rightAR = this.eyeAspectRatio(landmarks, 'right');
    return (leftAR + rightAR) / 2 < BLINK_ASPECT_RATIO_THRESHOLD;
  }

  private eyeAspectRatio(landmarks: FaceLandmark[], eye: 'left' | 'right'): number {
    const top = eye === 'left' ? landmarks[LEFT_EYE_TOP] : landmarks[RIGHT_EYE_TOP];
    const bottom = eye === 'left' ? landmarks[LEFT_EYE_BOTTOM] : landmarks[RIGHT_EYE_BOTTOM];
    const inner = eye === 'left' ? landmarks[LEFT_EYE_INNER] : landmarks[RIGHT_EYE_INNER];
    const outer = eye === 'left' ? landmarks[LEFT_EYE_OUTER] : landmarks[RIGHT_EYE_OUTER];

    if (!top || !bottom || !inner || !outer) return 1;

    const vertical = Math.sqrt((top.x - bottom.x) ** 2 + (top.y - bottom.y) ** 2);
    const horizontal = Math.sqrt((inner.x - outer.x) ** 2 + (inner.y - outer.y) ** 2);
    return horizontal > 0 ? vertical / horizontal : 1;
  }

  private eyeOpenness(landmarks: FaceLandmark[], eye: 'left' | 'right'): number {
    return this.eyeAspectRatio(landmarks, eye);
  }

  // Calibration methods
  startCalibration() {
    this.isCalibrating = true;
    this.calibrationSamples = [];
  }

  finishCalibration(): GazeCalibration | null {
    this.isCalibrating = false;
    if (this.calibrationSamples.length < 10) return null;

    // Remove outliers (outside 2 standard deviations)
    const xs = this.calibrationSamples.map(s => s.x);
    const ys = this.calibrationSamples.map(s => s.y);

    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const stdX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / xs.length);
    const stdY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / ys.length);

    // Filter outliers (>2 std deviations) — skip dimension if std is 0 (all identical)
    const filtered = this.calibrationSamples.filter(s =>
      (stdX < 0.0001 || Math.abs(s.x - meanX) < 2 * stdX) &&
      (stdY < 0.0001 || Math.abs(s.y - meanY) < 2 * stdY)
    );

    if (filtered.length < 5) return null;

    const centerX = filtered.reduce((sum, s) => sum + s.x, 0) / filtered.length;
    const centerY = filtered.reduce((sum, s) => sum + s.y, 0) / filtered.length;

    // Threshold = 2x the standard deviation of calibrated samples (covers natural variance)
    const calStdX = Math.sqrt(filtered.reduce((sum, s) => sum + (s.x - centerX) ** 2, 0) / filtered.length);
    const calStdY = Math.sqrt(filtered.reduce((sum, s) => sum + (s.y - centerY) ** 2, 0) / filtered.length);
    const threshold = Math.max(0.08, Math.min(0.25, (calStdX + calStdY) * 2));

    this.calibration = { centerX, centerY, threshold };
    this.calibrationSamples = [];
    return this.calibration;
  }

  getCalibration(): GazeCalibration | null {
    return this.calibration;
  }

  setCalibration(cal: GazeCalibration) {
    this.calibration = cal;
  }

  getBlinkRate(): number {
    const now = Date.now();
    // Keep only blinks from last 60 seconds
    this.blinkTimestamps = this.blinkTimestamps.filter(t => now - t < 60000);
    return this.blinkTimestamps.length; // blinks per minute
  }

  reset() {
    this.smoothX.reset();
    this.smoothY.reset();
    this.isCalibrating = false;
    this.calibrationSamples = [];
    this.blinkCount = 0;
    this.blinkTimestamps = [];
    this.wasBlinking = false;
    // Don't reset calibration — it should persist for the session
    // Don't reset autoCalDone — recalibrating mid-session would be disruptive
  }
}
