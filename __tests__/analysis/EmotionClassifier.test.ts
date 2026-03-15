import { EmotionClassifier } from '@/lib/video-processor/EmotionClassifier';

describe('EmotionClassifier', () => {
  let classifier: EmotionClassifier;

  beforeEach(() => {
    classifier = new EmotionClassifier();
  });

  it('should return emotion scores summing close to 1.0', () => {
    const blendshapes = {
      mouthSmileLeft: 0.5,
      mouthSmileRight: 0.5,
      cheekSquintLeft: 0.4,
      cheekSquintRight: 0.4,
      browInnerUp: 0.1,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.2,
      eyeWideRight: 0.2,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.1,
      eyeSquintRight: 0.1,
    };

    const result = classifier.classify(blendshapes);

    const sum =
      result.allScores.happy +
      result.allScores.sad +
      result.allScores.angry +
      result.allScores.neutral +
      result.allScores.surprised +
      result.allScores.fearful +
      result.allScores.confused;

    expect(sum).toBeCloseTo(1.0, 1); // Within 0.1
  });

  it('should classify surprised emotion from high jawOpen and browInnerUp', () => {
    const blendshapes = {
      browOuterUpLeft: 0.6,
      browOuterUpRight: 0.6,
      jawOpen: 0.5,
      eyeWideLeft: 0.5,
      eyeWideRight: 0.5,
      mouthSmileLeft: 0.1,
      mouthSmileRight: 0.1,
      cheekSquintLeft: 0.1,
      cheekSquintRight: 0.1,
      browInnerUp: 0.1,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.1,
      eyeSquintRight: 0.1,
    };

    const result = classifier.classify(blendshapes);

    expect(result.emotion).toBe('surprised');
    expect(result.allScores.surprised).toBeGreaterThan(0.3);
  });

  it('should classify angry emotion from high browDown and jawClench', () => {
    const blendshapes = {
      browDownLeft: 0.6,
      browDownRight: 0.6,
      jawOpen: 0.1,
      mouthPress: 0.4,
      jawClench: 0.5,
      mouthSmileLeft: 0.0,
      mouthSmileRight: 0.0,
      cheekSquintLeft: 0.0,
      cheekSquintRight: 0.0,
      browInnerUp: 0.0,
      mouthFrownLeft: 0.2,
      mouthFrownRight: 0.2,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.2,
      eyeSquintRight: 0.2,
    };

    const result = classifier.classify(blendshapes);

    expect(result.emotion).toBe('angry');
    expect(result.allScores.angry).toBeGreaterThan(0.3);
  });

  it('should classify neutral when blendshapes are mostly zero', () => {
    const blendshapes = {
      mouthSmileLeft: 0.1,
      mouthSmileRight: 0.1,
      cheekSquintLeft: 0.0,
      cheekSquintRight: 0.0,
      browInnerUp: 0.0,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.0,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.0,
      eyeSquintRight: 0.0,
    };

    const result = classifier.classify(blendshapes);

    expect(result.emotion).toBe('neutral');
    expect(result.allScores.neutral).toBeGreaterThan(0.7);
  });

  it('should classify happy from mouth smile and cheek squint', () => {
    const blendshapes = {
      mouthSmileLeft: 0.7,
      mouthSmileRight: 0.7,
      cheekSquintLeft: 0.5,
      cheekSquintRight: 0.5,
      browInnerUp: 0.1,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.2,
      browOuterUpRight: 0.2,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.1,
      eyeSquintRight: 0.1,
    };

    const result = classifier.classify(blendshapes);

    expect(result.emotion).toBe('happy');
    expect(result.allScores.happy).toBeGreaterThan(0.5);
  });

  it('should classify sad from mouth frown', () => {
    const blendshapes = {
      mouthFrownLeft: 0.6,
      mouthFrownRight: 0.6,
      browInnerUp: 0.4,
      mouthSmileLeft: 0.0,
      mouthSmileRight: 0.0,
      cheekSquintLeft: 0.0,
      cheekSquintRight: 0.0,
      browDownLeft: 0.1,
      browDownRight: 0.1,
      jawOpen: 0.2,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.1,
      browOuterUpRight: 0.1,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.1,
      eyeSquintRight: 0.1,
    };

    const result = classifier.classify(blendshapes);

    expect(result.emotion).toBe('sad');
    expect(result.allScores.sad).toBeGreaterThan(0.3);
  });

  it('should classify confused from asymmetric brows', () => {
    const blendshapes = {
      browDownLeft: 0.5,
      browDownRight: 0.1, // Asymmetry
      mouthPucker: 0.3,
      eyeSquintLeft: 0.4,
      eyeSquintRight: 0.4,
      mouthSmileLeft: 0.1,
      mouthSmileRight: 0.1,
      cheekSquintLeft: 0.0,
      cheekSquintRight: 0.0,
      browInnerUp: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
    };

    const result = classifier.classify(blendshapes);

    expect(result.emotion).toBe('confused');
    expect(result.allScores.confused).toBeGreaterThan(0.2);
  });

  it('should maintain valid emotion confidence between 0-1', () => {
    const blendshapes = {
      mouthSmileLeft: 0.8,
      mouthSmileRight: 0.8,
      cheekSquintLeft: 0.6,
      cheekSquintRight: 0.6,
      browInnerUp: 0.2,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.1,
      eyeSquintRight: 0.1,
    };

    const result = classifier.classify(blendshapes);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should record and retrieve emotion timeline', () => {
    const blendshapes = {
      mouthSmileLeft: 0.5,
      mouthSmileRight: 0.5,
      cheekSquintLeft: 0.4,
      cheekSquintRight: 0.4,
      browInnerUp: 0.0,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.0,
      eyeSquintRight: 0.0,
    };

    const result1 = classifier.classify(blendshapes);
    classifier.recordClassification(result1.emotion, Date.now());

    const result2 = classifier.classify(blendshapes);
    classifier.recordClassification(result2.emotion, Date.now() + 100);

    const timeline = classifier.getEmotionTimeline();
    expect(timeline.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle missing blendshape properties', () => {
    const incompleteBs: Record<string, number> = {
      mouthSmileLeft: 0.5,
      // Missing many properties
    };

    const result = classifier.classify(incompleteBs);

    expect(result.emotion).toBeDefined();
    expect(['happy', 'sad', 'angry', 'neutral', 'surprised', 'fearful', 'confused']).toContain(result.emotion);
  });

  it('should get dominant emotion from timeline', () => {
    const happy: Record<string, number> = {
      mouthSmileLeft: 0.7,
      mouthSmileRight: 0.7,
      cheekSquintLeft: 0.5,
      cheekSquintRight: 0.5,
      browInnerUp: 0.0,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.0,
      eyeSquintRight: 0.0,
    };

    for (let i = 0; i < 5; i++) {
      const result = classifier.classify(happy);
      classifier.recordClassification(result.emotion);
    }

    const dominant = classifier.getDominantEmotion();
    expect(dominant).toBe('happy');
  });

  it('should reset internal state', () => {
    const blendshapes = {
      mouthSmileLeft: 0.7,
      mouthSmileRight: 0.7,
      cheekSquintLeft: 0.5,
      cheekSquintRight: 0.5,
      browInnerUp: 0.0,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.0,
      eyeSquintRight: 0.0,
    };

    const result = classifier.classify(blendshapes);
    classifier.recordClassification(result.emotion);

    let timeline = classifier.getEmotionTimeline();
    expect(timeline.length).toBeGreaterThan(0);

    classifier.reset();

    timeline = classifier.getEmotionTimeline();
    expect(timeline.length).toBe(0);
  });

  it('should classify fearful emotion correctly', () => {
    const fearful = {
      browInnerUp: 0.6,
      eyeWideLeft: 0.6,
      eyeWideRight: 0.6,
      mouthStretch: 0.4,
      mouthSmileLeft: 0.0,
      mouthSmileRight: 0.0,
      cheekSquintLeft: 0.0,
      cheekSquintRight: 0.0,
      browDownLeft: 0.1,
      browDownRight: 0.1,
      jawOpen: 0.2,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.1,
      browOuterUpRight: 0.1,
      mouthFrownLeft: 0.1,
      mouthFrownRight: 0.1,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.1,
      eyeSquintRight: 0.1,
    };

    const result = classifier.classify(fearful);

    expect(result.emotion).toBe('fearful');
    expect(result.allScores.fearful).toBeGreaterThan(0.3);
  });

  it('should handle extreme values gracefully', () => {
    const extreme = {
      mouthSmileLeft: 10.0, // Out of range
      mouthSmileRight: 10.0,
      cheekSquintLeft: -5.0, // Negative
      cheekSquintRight: 0.5,
      browInnerUp: 0.0,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      jawOpen: 0.1,
      eyeWideLeft: 0.1,
      eyeWideRight: 0.1,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      jawClench: 0.0,
      mouthPress: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      mouthPucker: 0.0,
      eyeSquintLeft: 0.0,
      eyeSquintRight: 0.0,
    };

    const result = classifier.classify(extreme);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    // All scores should be clamped to 0-1
    Object.values(result.allScores).forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
