import { ExpressionAnalyzer } from '@/lib/video-processor/ExpressionAnalyzer';
import { FaceLandmark, BlendshapeMap } from '@/lib/video-processor/types';

function makeBaseLandmarks(): FaceLandmark[] {
  return Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

function makeSmileBlendshapes(): BlendshapeMap {
  return {
    browDownLeft: 0, browDownRight: 0, browInnerUp: 0.1,
    browOuterUpLeft: 0.1, browOuterUpRight: 0.1,
    eyeSquintLeft: 0.3, eyeSquintRight: 0.3,
    eyeWideLeft: 0, eyeWideRight: 0,
    jawOpen: 0.1,
    mouthSmileLeft: 0.8, mouthSmileRight: 0.8,
    mouthFrownLeft: 0, mouthFrownRight: 0,
    mouthPucker: 0, mouthPress: 0,
    cheekSquintLeft: 0.5, cheekSquintRight: 0.5,
  };
}

function makeConfusedBlendshapes(): BlendshapeMap {
  return {
    browDownLeft: 0.7, browDownRight: 0.7, browInnerUp: 0,
    browOuterUpLeft: 0, browOuterUpRight: 0,
    eyeSquintLeft: 0.6, eyeSquintRight: 0.6,
    eyeWideLeft: 0, eyeWideRight: 0,
    jawOpen: 0,
    mouthSmileLeft: 0, mouthSmileRight: 0,
    mouthFrownLeft: 0.4, mouthFrownRight: 0.4,
    mouthPucker: 0.2, mouthPress: 0.3,
    cheekSquintLeft: 0, cheekSquintRight: 0,
  };
}

describe('ExpressionAnalyzer', () => {
  let analyzer: ExpressionAnalyzer;

  beforeEach(() => {
    analyzer = new ExpressionAnalyzer();
  });

  it('returns null for insufficient landmarks', () => {
    expect(analyzer.analyze([], null)).toBeNull();
    expect(analyzer.analyze(Array(100).fill({ x: 0, y: 0, z: 0 }), null)).toBeNull();
  });

  it('returns all expression fields from landmarks fallback', () => {
    const landmarks = makeBaseLandmarks();
    const result = analyzer.analyze(landmarks, null);
    expect(result).not.toBeNull();
    expect(result!.valence).toBeGreaterThanOrEqual(0);
    expect(result!.valence).toBeLessThanOrEqual(1);
    expect(result!.energy).toBeGreaterThanOrEqual(0);
    expect(result!.energy).toBeLessThanOrEqual(1);
    expect(result).toHaveProperty('confusion');
    expect(result).toHaveProperty('surprise');
    expect(result).toHaveProperty('concentration');
    expect(result).toHaveProperty('smile');
    expect(result).toHaveProperty('browFurrow');
    expect(result).toHaveProperty('headNod');
    expect(result).toHaveProperty('headShake');
    expect(result).toHaveProperty('headTilt');
  });

  it('detects smile from blendshapes', () => {
    const landmarks = makeBaseLandmarks();
    const bs = makeSmileBlendshapes();
    const result = analyzer.analyze(landmarks, bs);
    expect(result).not.toBeNull();
    expect(result!.smile).toBeGreaterThan(0.5);
    expect(result!.valence).toBeGreaterThan(0.4);
  });

  it('detects confusion from blendshapes', () => {
    const landmarks = makeBaseLandmarks();
    const bs = makeConfusedBlendshapes();
    // Feed several frames to build up EMA
    for (let i = 0; i < 5; i++) {
      analyzer.analyze(landmarks, bs);
    }
    const result = analyzer.analyze(landmarks, bs);
    expect(result).not.toBeNull();
    expect(result!.confusion).toBeGreaterThan(0.2);
    expect(result!.browFurrow).toBeGreaterThan(0.5);
  });

  it('resets smoothing state', () => {
    const landmarks = makeBaseLandmarks();
    analyzer.analyze(landmarks, null);
    analyzer.reset();
    const result = analyzer.analyze(landmarks, null);
    expect(result).not.toBeNull();
  });
});
