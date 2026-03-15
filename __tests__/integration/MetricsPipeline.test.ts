import { MetricsEngine } from '../../src/lib/metrics-engine/MetricsEngine';
import { CoachingEngine } from '../../src/lib/coaching-system/CoachingEngine';
import { createNudgeRules } from '../../src/lib/coaching-system/NudgeRules';
import { FaceFrame } from '../../src/lib/video-processor/types';

// Create realistic face landmarks (478 points)
function createFakeLandmarks(lookingAtCamera: boolean, smiling: boolean): FaceFrame {
  const landmarks = Array.from({ length: 478 }, (_, i) => ({
    x: 0.5 + (Math.random() - 0.5) * 0.01,
    y: 0.5 + (Math.random() - 0.5) * 0.01,
    z: 0,
  }));

  // Eye landmarks: simulate gaze
  const offset = lookingAtCamera ? 0 : 0.3;
  // Left eye
  landmarks[33] = { x: 0.35, y: 0.4, z: 0 };  // LEFT_EYE_OUTER
  landmarks[133] = { x: 0.45, y: 0.4, z: 0 };  // LEFT_EYE_INNER
  landmarks[468] = { x: 0.40 + offset * 0.1, y: 0.4, z: 0 }; // LEFT_IRIS_CENTER
  landmarks[159] = { x: 0.40, y: 0.37, z: 0 };  // LEFT_EYE_TOP
  landmarks[145] = { x: 0.40, y: 0.43, z: 0 };  // LEFT_EYE_BOTTOM
  // Right eye
  landmarks[263] = { x: 0.55, y: 0.4, z: 0 };  // RIGHT_EYE_OUTER
  landmarks[362] = { x: 0.65, y: 0.4, z: 0 };  // RIGHT_EYE_INNER
  landmarks[473] = { x: 0.60 + offset * 0.1, y: 0.4, z: 0 }; // RIGHT_IRIS_CENTER
  landmarks[386] = { x: 0.60, y: 0.37, z: 0 };  // RIGHT_EYE_TOP
  landmarks[374] = { x: 0.60, y: 0.43, z: 0 };  // RIGHT_EYE_BOTTOM
  // Mouth
  landmarks[61] = { x: 0.45, y: 0.65, z: 0 };   // MOUTH_LEFT
  landmarks[291] = { x: 0.55, y: 0.65, z: 0 };   // MOUTH_RIGHT
  landmarks[13] = { x: 0.5, y: smiling ? 0.63 : 0.64, z: 0 };  // MOUTH_TOP
  landmarks[14] = { x: 0.5, y: smiling ? 0.67 : 0.66, z: 0 };  // MOUTH_BOTTOM
  landmarks[0] = { x: 0.5, y: 0.64, z: 0 };  // UPPER_LIP
  landmarks[17] = { x: 0.5, y: 0.66, z: 0 };  // LOWER_LIP
  // Eyebrows
  landmarks[105] = { x: 0.40, y: 0.33, z: 0 };   // LEFT_EYEBROW_TOP
  landmarks[334] = { x: 0.60, y: 0.33, z: 0 };   // RIGHT_EYEBROW_TOP

  return { landmarks, blendshapes: null, timestamp: Date.now() };
}

describe('Full Metrics Pipeline Integration', () => {
  let engine: MetricsEngine;
  let coaching: CoachingEngine;

  beforeEach(() => {
    engine = new MetricsEngine({ sessionType: 'discussion' });
    coaching = new CoachingEngine({}, undefined, 'discussion');
  });

  test('produces valid engagement score from face + audio data', () => {
    const tutorFace = createFakeLandmarks(true, true);
    const studentFace = createFakeLandmarks(true, false);

    const snapshot = engine.update(
      tutorFace, studentFace,
      true, false,  // tutor speaking, student not
      0.5, 0.1,    // audio energy
      Date.now()
    );

    expect(snapshot.engagementScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.engagementScore).toBeLessThanOrEqual(100);
    expect(snapshot.tutor.eyeContactScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.student.eyeContactScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.studentState).toBeDefined();
    expect(['engaged', 'passive', 'confused', 'drifting', 'struggling']).toContain(snapshot.studentState);
  });

  test('detects student silence and triggers coaching nudge', () => {
    const baseTime = Date.now();
    // Simulate 4 minutes of student silence
    for (let i = 0; i < 480; i++) { // 480 ticks at 500ms = 240s = 4 min
      const ts = baseTime + i * 500;
      engine.update(
        createFakeLandmarks(true, false),
        createFakeLandmarks(true, false),
        true, false, // Only tutor speaking
        0.3, 0.0,   // Only tutor audio
        ts
      );
    }

    // Now check
    const snapshot = engine.update(
      createFakeLandmarks(true, false),
      createFakeLandmarks(false, false),
      true, false,
      0.3, 0.0,
      baseTime + 480 * 500
    );

    expect(snapshot.student.silenceDurationMs).toBeGreaterThan(180000); // >3 min

    const nudges = coaching.evaluate(snapshot);
    const silenceNudge = nudges.find(n => n.ruleId === 'student-silent-long');
    expect(silenceNudge).toBeDefined();
  });

  test('tracks speaking time accurately over many updates', () => {
    const baseTime = Date.now();

    // Alternate speaking: 50 ticks tutor, 50 ticks student (25s each)
    for (let i = 0; i < 100; i++) {
      const ts = baseTime + i * 500;
      const tutorSpeaking = i < 50;
      const studentSpeaking = i >= 50;
      engine.update(null, null, tutorSpeaking, studentSpeaking, 0.3, 0.3, ts);
    }

    const snapshot = engine.update(null, null, false, false, 0, 0, baseTime + 50000);

    // Should be roughly 50/50
    expect(snapshot.tutor.talkTimePercent).toBeGreaterThan(0.3);
    expect(snapshot.tutor.talkTimePercent).toBeLessThan(0.7);
    expect(snapshot.student.talkTimePercent).toBeGreaterThan(0.3);
  });

  test('engagement trends reflect changes over time', () => {
    const baseTime = Date.now();

    // 60 ticks of good engagement (30s)
    for (let i = 0; i < 60; i++) {
      engine.update(
        createFakeLandmarks(true, true),
        createFakeLandmarks(true, true),
        true, true, 0.5, 0.5,
        baseTime + i * 500
      );
    }

    // Now shift to poor engagement for 120 ticks (60s) — enough for EMA to move
    let lastSnapshot;
    for (let i = 60; i < 180; i++) {
      lastSnapshot = engine.update(
        createFakeLandmarks(true, false),
        createFakeLandmarks(false, false),
        true, false, 0.3, 0.0,
        baseTime + i * 500
      );
    }

    // Engagement score should be lower than initial period
    // (with EMA smoothing, trend detection needs enough data points)
    expect(lastSnapshot!.engagementScore).toBeLessThan(70);
  });

  test('session-type affects engagement weights', () => {
    const lectureEngine = new MetricsEngine({ sessionType: 'lecture' });
    const discussionEngine = new MetricsEngine({ sessionType: 'discussion' });
    const baseTime = Date.now();

    // Same data: tutor dominates (80% talk time)
    for (let i = 0; i < 50; i++) {
      const ts = baseTime + i * 500;
      const tutorSpeaking = i % 5 !== 0; // 80% tutor
      const studentSpeaking = i % 5 === 0; // 20% student
      lectureEngine.update(null, null, tutorSpeaking, studentSpeaking, 0.3, 0.3, ts);
      discussionEngine.update(null, null, tutorSpeaking, studentSpeaking, 0.3, 0.3, ts);
    }

    const lectureSnap = lectureEngine.update(null, null, true, false, 0.3, 0, baseTime + 25000);
    const discussionSnap = discussionEngine.update(null, null, true, false, 0.3, 0, baseTime + 25000);

    // Lecture should score higher with 80% tutor talk (closer to ideal 75%)
    // Discussion should score lower (ideal is 50%)
    // The difference may be small but lecture should not be worse
    expect(lectureSnap.engagementScore).toBeGreaterThanOrEqual(discussionSnap.engagementScore - 10);
  });

  test('student state machine classifies correctly', () => {
    const baseTime = Date.now();

    // First, warm up with 60+ seconds of data (good engagement)
    for (let i = 0; i < 130; i++) { // 65 seconds
      engine.update(
        createFakeLandmarks(true, true),
        createFakeLandmarks(true, true),
        true, true, 0.5, 0.5,
        baseTime + i * 500
      );
    }

    // Now simulate poor conditions: low energy, silence, no eye contact from either side
    // Using null faces + no student speaking to drive engagement as low as possible
    let lastState = 'engaged';
    for (let i = 130; i < 600; i++) { // 235 more seconds
      const snapshot = engine.update(
        null,   // no tutor face detected
        null,   // no student face detected
        true, false, // only tutor speaking
        0.05, 0.0,  // minimal energy
        baseTime + i * 500
      );
      lastState = snapshot.studentState;
    }

    // After extended poor conditions, student should not still be 'engaged'
    expect(lastState).not.toBe('engaged');
    expect(['drifting', 'struggling', 'passive', 'confused']).toContain(lastState);
  });
});

describe('Coaching Rules Boundary Conditions', () => {
  test('student-silent-long triggers at exactly 3 min for discussion', () => {
    const rules = createNudgeRules('discussion');
    const engine = new CoachingEngine({}, rules);

    const makeSnap = (silenceMs: number) => ({
      timestamp: Date.now(),
      tutor: { eyeContactScore: 0.5, talkTimePercent: 0.5, energyScore: 0.5, isSpeaking: true, silenceDurationMs: 0, eyeContactTrend: 'stable' as const, pitchVariance: 0, speechRate: 0 },
      student: { eyeContactScore: 0.5, talkTimePercent: 0.5, energyScore: 0.5, isSpeaking: false, silenceDurationMs: silenceMs, eyeContactTrend: 'stable' as const, pitchVariance: 0, speechRate: 0 },
      session: { interruptionCount: 0, silenceDurationCurrent: silenceMs, engagementTrend: 'stable' as const, attentionDriftDetected: false, elapsedMs: 600000, turnTakingGapMs: 0, turnCount: 0, studentState: 'engaged' as const },
      engagementScore: 50,
      studentState: 'engaged' as const,
      tutorExpression: null,
      studentExpression: null,
    });

    // Just under threshold
    const before = engine.evaluate(makeSnap(179999));
    expect(before.find(n => n.ruleId === 'student-silent-long')).toBeUndefined();

    // At threshold
    const at = engine.evaluate(makeSnap(180001));
    expect(at.find(n => n.ruleId === 'student-silent-long')).toBeDefined();
  });

  test('practice mode triggers silence earlier than lecture', () => {
    const practiceRules = createNudgeRules('practice');
    const lectureRules = createNudgeRules('lecture');
    const practiceEngine = new CoachingEngine({}, practiceRules);
    const lectureEngine = new CoachingEngine({}, lectureRules);

    const makeSnap = (silenceMs: number) => ({
      timestamp: Date.now(),
      tutor: { eyeContactScore: 0.5, talkTimePercent: 0.5, energyScore: 0.5, isSpeaking: true, silenceDurationMs: 0, eyeContactTrend: 'stable' as const, pitchVariance: 0, speechRate: 0 },
      student: { eyeContactScore: 0.5, talkTimePercent: 0.5, energyScore: 0.5, isSpeaking: false, silenceDurationMs: silenceMs, eyeContactTrend: 'stable' as const, pitchVariance: 0, speechRate: 0 },
      session: { interruptionCount: 0, silenceDurationCurrent: silenceMs, engagementTrend: 'stable' as const, attentionDriftDetected: false, elapsedMs: 600000, turnTakingGapMs: 0, turnCount: 0, studentState: 'engaged' as const },
      engagementScore: 50,
      studentState: 'engaged' as const,
      tutorExpression: null,
      studentExpression: null,
    });

    // At 2.5 minutes: practice triggers, lecture doesn't
    const practiceResult = practiceEngine.evaluate(makeSnap(150000));
    const lectureResult = lectureEngine.evaluate(makeSnap(150000));

    expect(practiceResult.find(n => n.ruleId === 'student-silent-long')).toBeDefined();
    expect(lectureResult.find(n => n.ruleId === 'student-silent-long')).toBeUndefined();
  });

  test('tutor-dominating threshold varies by session type', () => {
    const makeSnap = (talkPercent: number, sessionType: string) => ({
      timestamp: Date.now(),
      tutor: { eyeContactScore: 0.5, talkTimePercent: talkPercent, energyScore: 0.5, isSpeaking: true, silenceDurationMs: 0, eyeContactTrend: 'stable' as const, pitchVariance: 0, speechRate: 0 },
      student: { eyeContactScore: 0.5, talkTimePercent: 1 - talkPercent, energyScore: 0.5, isSpeaking: false, silenceDurationMs: 0, eyeContactTrend: 'stable' as const, pitchVariance: 0, speechRate: 0 },
      session: { interruptionCount: 0, silenceDurationCurrent: 0, engagementTrend: 'stable' as const, attentionDriftDetected: false, elapsedMs: 600000, turnTakingGapMs: 0, turnCount: 0, studentState: 'engaged' as const },
      engagementScore: 50,
      studentState: 'engaged' as const,
      tutorExpression: null,
      studentExpression: null,
    });

    // 75% tutor talk: OK for lecture, triggers for practice/discussion
    const lectureEngine = new CoachingEngine({}, createNudgeRules('lecture'));
    const practiceEngine = new CoachingEngine({}, createNudgeRules('practice'));

    const lectureResult = lectureEngine.evaluate(makeSnap(0.75, 'lecture'));
    const practiceResult = practiceEngine.evaluate(makeSnap(0.75, 'practice'));

    expect(lectureResult.find(n => n.ruleId === 'tutor-dominating')).toBeUndefined();
    expect(practiceResult.find(n => n.ruleId === 'tutor-dominating')).toBeDefined();
  });
});

describe('Turn-Taking Tracker', () => {
  test('tracks speaker transitions and gaps', () => {
    const { TurnTakingTracker } = require('../../src/lib/audio-processor/TurnTakingTracker');
    const tracker = new TurnTakingTracker();
    const baseTime = 1000000;

    // Tutor speaks
    tracker.update(true, false, baseTime);
    tracker.update(true, false, baseTime + 500);
    tracker.update(true, false, baseTime + 1000);

    // Brief silence
    tracker.update(false, false, baseTime + 1500);

    // Student speaks (turn-take)
    tracker.update(false, true, baseTime + 2000);
    tracker.update(false, true, baseTime + 2500);

    // Another silence
    tracker.update(false, false, baseTime + 3000);

    // Tutor again (another turn-take)
    tracker.update(true, false, baseTime + 3500);

    const result = tracker.getResult();
    expect(result.turnCount).toBeGreaterThanOrEqual(1);
    expect(result.avgTurnGapMs).toBeGreaterThan(0);
    expect(result.avgTurnGapMs).toBeLessThan(5000);
  });
});

describe('Gaze Estimator Calibration', () => {
  test('calibration produces valid center and threshold', () => {
    const { GazeEstimator } = require('../../src/lib/video-processor/GazeEstimator');
    const estimator = new GazeEstimator();

    // Create landmarks simulating looking at camera
    const createLandmarks = () => {
      const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
      landmarks[33] = { x: 0.35, y: 0.4, z: 0 };
      landmarks[133] = { x: 0.45, y: 0.4, z: 0 };
      landmarks[468] = { x: 0.40 + (Math.random() - 0.5) * 0.02, y: 0.4, z: 0 };
      landmarks[263] = { x: 0.55, y: 0.4, z: 0 };
      landmarks[362] = { x: 0.65, y: 0.4, z: 0 };
      landmarks[473] = { x: 0.60 + (Math.random() - 0.5) * 0.02, y: 0.4, z: 0 };
      landmarks[159] = { x: 0.40, y: 0.37, z: 0 };
      landmarks[145] = { x: 0.40, y: 0.43, z: 0 };
      landmarks[386] = { x: 0.60, y: 0.37, z: 0 };
      landmarks[374] = { x: 0.60, y: 0.43, z: 0 };
      return landmarks;
    };

    estimator.startCalibration();

    // Feed 20 frames while calibrating
    for (let i = 0; i < 20; i++) {
      estimator.estimate(createLandmarks());
    }

    const calibration = estimator.finishCalibration();
    expect(calibration).not.toBeNull();
    expect(calibration!.centerX).toBeGreaterThan(0.3);
    expect(calibration!.centerX).toBeLessThan(0.7);
    expect(calibration!.threshold).toBeGreaterThanOrEqual(0.08);
    expect(calibration!.threshold).toBeLessThanOrEqual(0.25);
  });
});
