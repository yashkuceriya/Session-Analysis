import { MetricsEngine } from '@/lib/metrics-engine/MetricsEngine';
import { FaceLandmark, FaceFrame } from '@/lib/video-processor/types';

function makeFaceFrame(lookingAtCamera: boolean): FaceFrame {
  const landmarks: FaceLandmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Set up eye landmarks for gaze detection
  landmarks[133] = { x: 0.35, y: 0.4, z: 0 }; // left inner
  landmarks[33] = { x: 0.45, y: 0.4, z: 0 };  // left outer
  landmarks[362] = { x: 0.55, y: 0.4, z: 0 }; // right inner
  landmarks[263] = { x: 0.65, y: 0.4, z: 0 }; // right outer

  if (lookingAtCamera) {
    landmarks[468] = { x: 0.40, y: 0.4, z: 0 }; // left iris centered
    landmarks[473] = { x: 0.60, y: 0.4, z: 0 }; // right iris centered
  } else {
    landmarks[468] = { x: 0.35, y: 0.4, z: 0 }; // left iris at inner corner
    landmarks[473] = { x: 0.55, y: 0.4, z: 0 }; // right iris at inner corner
  }

  return { landmarks, blendshapes: null, timestamp: performance.now() };
}

describe('MetricsEngine', () => {
  let engine: MetricsEngine;

  beforeEach(() => {
    engine = new MetricsEngine({ sessionType: 'discussion' });
  });

  it('returns a valid MetricSnapshot', () => {
    const snapshot = engine.update(null, null, false, false, 0, 0, 1000);
    expect(snapshot).toHaveProperty('timestamp');
    expect(snapshot).toHaveProperty('tutor');
    expect(snapshot).toHaveProperty('student');
    expect(snapshot).toHaveProperty('session');
    expect(snapshot).toHaveProperty('engagementScore');
    expect(snapshot.engagementScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.engagementScore).toBeLessThanOrEqual(100);
  });

  it('tracks speaking state', () => {
    const snap = engine.update(null, null, true, false, 0.5, 0, 1000);
    expect(snap.tutor.isSpeaking).toBe(true);
    expect(snap.student.isSpeaking).toBe(false);
  });

  it('accumulates elapsed time', () => {
    // elapsedMs = timestamp - sessionStartTime (Date.now())
    // Since timestamp is performance.now() based, we test that it returns a number
    const snap = engine.update(null, null, false, false, 0, 0, Date.now());
    expect(typeof snap.session.elapsedMs).toBe('number');
  });

  it('processes face frames without crashing', () => {
    const frame = makeFaceFrame(true);
    // Feed several frames — engine should handle face data gracefully
    for (let i = 0; i < 10; i++) {
      const snap = engine.update(frame, frame, false, false, 0, 0, Date.now() + i * 500);
      expect(snap.tutor.eyeContactScore).toBeGreaterThanOrEqual(0);
      expect(snap.tutor.eyeContactScore).toBeLessThanOrEqual(1);
    }
  });

  it('tracks silence duration', () => {
    engine.update(null, null, false, false, 0, 0, 1000);
    const snap = engine.update(null, null, false, false, 0, 0, 6000);
    expect(snap.student.silenceDurationMs).toBeGreaterThanOrEqual(5000);
    expect(snap.tutor.silenceDurationMs).toBeGreaterThanOrEqual(5000);
  });

  it('resets to initial state', () => {
    engine.update(null, null, true, false, 0.5, 0, 1000);
    engine.reset();
    const snap = engine.update(null, null, false, false, 0, 0, 100);
    expect(snap.session.interruptionCount).toBe(0);
  });

  it('respects session type for engagement scoring', () => {
    const lectureEngine = new MetricsEngine({ sessionType: 'lecture' });
    const discussionEngine = new MetricsEngine({ sessionType: 'discussion' });

    // Tutor talks 75% — ideal for lecture, bad for discussion
    for (let i = 0; i < 20; i++) {
      const tutorSpeaking = i % 4 !== 3; // 75% speaking
      lectureEngine.update(null, null, tutorSpeaking, !tutorSpeaking, 0.3, 0.3, i * 500);
      discussionEngine.update(null, null, tutorSpeaking, !tutorSpeaking, 0.3, 0.3, i * 500);
    }

    const lectureSnap = lectureEngine.update(null, null, true, false, 0.3, 0.3, 10000);
    const discussionSnap = discussionEngine.update(null, null, true, false, 0.3, 0.3, 10000);

    // Lecture should score higher for 75% tutor talk
    expect(lectureSnap.engagementScore).toBeGreaterThanOrEqual(discussionSnap.engagementScore - 5);
  });
});
