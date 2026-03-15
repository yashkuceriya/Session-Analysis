import { GazeEstimator } from '@/lib/video-processor/GazeEstimator';
import { FaceLandmark } from '@/lib/video-processor/types';

function makeLandmarks(leftIrisX: number, rightIrisX: number): FaceLandmark[] {
  const landmarks: FaceLandmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Left eye: inner=133, outer=33 (slight Y spread so Y ratio isn't NaN)
  landmarks[133] = { x: 0.35, y: 0.38, z: 0 };
  landmarks[33] = { x: 0.45, y: 0.42, z: 0 };
  // Right eye: inner=362, outer=263
  landmarks[362] = { x: 0.55, y: 0.38, z: 0 };
  landmarks[263] = { x: 0.65, y: 0.42, z: 0 };
  // Left iris center=468 (Y centered between inner/outer Y)
  landmarks[468] = { x: leftIrisX, y: 0.40, z: 0 };
  // Right iris center=473
  landmarks[473] = { x: rightIrisX, y: 0.40, z: 0 };

  // Eye top/bottom landmarks needed for blink detection (aspect ratio)
  landmarks[159] = { x: 0.40, y: 0.36, z: 0 };  // LEFT_EYE_TOP
  landmarks[145] = { x: 0.40, y: 0.44, z: 0 };  // LEFT_EYE_BOTTOM
  landmarks[386] = { x: 0.60, y: 0.36, z: 0 };  // RIGHT_EYE_TOP
  landmarks[374] = { x: 0.60, y: 0.44, z: 0 };  // RIGHT_EYE_BOTTOM

  return landmarks;
}

describe('GazeEstimator', () => {
  let estimator: GazeEstimator;

  beforeEach(() => {
    estimator = new GazeEstimator();
  });

  it('returns null for insufficient landmarks', () => {
    const result = estimator.estimate([]);
    expect(result).toBeNull();
  });

  it('returns null for landmarks array < 478', () => {
    const landmarks = Array.from({ length: 100 }, () => ({ x: 0, y: 0, z: 0 }));
    expect(estimator.estimate(landmarks)).toBeNull();
  });

  it('detects looking at camera when iris is centered', () => {
    // Iris centered between inner and outer corners
    const landmarks = makeLandmarks(0.40, 0.60);
    const result = estimator.estimate(landmarks);
    expect(result).not.toBeNull();
    expect(result!.isLookingAtCamera).toBe(true);
    expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('detects looking away when iris is offset', () => {
    // Iris pushed to one side
    const landmarks = makeLandmarks(0.35, 0.55);
    // Need multiple frames for EMA to settle
    estimator.estimate(landmarks);
    estimator.estimate(landmarks);
    const result = estimator.estimate(landmarks);
    expect(result).not.toBeNull();
    expect(result!.isLookingAtCamera).toBe(false);
  });

  it('resets smoothing state', () => {
    const landmarks = makeLandmarks(0.40, 0.60);
    estimator.estimate(landmarks);
    estimator.reset();
    // After reset, first estimate should equal raw value
    const result = estimator.estimate(landmarks);
    expect(result).not.toBeNull();
  });
});
