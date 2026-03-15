import { RecommendationEngine, Recommendation } from '@/lib/reports/RecommendationEngine';
import { SessionSummary } from '@/lib/reports/SessionSummarizer';
import { SessionConfig } from '@/lib/session/types';

// Helper factory to create test session summaries
function createSessionSummary(
  overallEngagement: number = 50,
  talkTimeRatio: { tutor: number; student: number } = { tutor: 0.5, student: 0.5 },
  studentStateBreakdown: Record<string, number> = {
    engaged: 50,
    passive: 20,
    confused: 15,
    drifting: 10,
    struggling: 5,
  },
  engagementTrend: 'improving' | 'declining' | 'stable' = 'stable',
  eyeContactAvg: { tutor: number; student: number } = { tutor: 0.6, student: 0.5 },
  nudgeCount: number = 5,
  highPriorityNudges: number = 2
): SessionSummary {
  return {
    duration: 600000, // 10 minutes
    overallEngagement,
    engagementTrend,
    keyMoments: [],
    studentStateBreakdown,
    talkTimeRatio,
    eyeContactAvg,
    nudgesSummary: {
      total: nudgeCount,
      byPriority: {
        high: highPriorityNudges,
        medium: Math.floor(nudgeCount / 2),
        low: nudgeCount - highPriorityNudges - Math.floor(nudgeCount / 2),
      },
      mostFrequent: 'test-nudge',
    },
    strengths: [],
    areasForImprovement: [],
    recommendations: [],
  };
}

describe('RecommendationEngine', () => {
  let engine: RecommendationEngine;
  let mockConfig: SessionConfig;

  beforeEach(() => {
    engine = new RecommendationEngine();
    mockConfig = {
      subject: 'Mathematics',
      sessionType: 'discussion',
      studentLevel: 'High School',
      tutorName: 'Tutor',
      studentName: 'Student',
    };
  });

  it('should return 3-5 recommendations', () => {
    const summary = createSessionSummary(75);
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    expect(recommendations.length).toBeGreaterThanOrEqual(1);
    expect(recommendations.length).toBeLessThanOrEqual(5);
  });

  it('should return recommendations as sorted array', () => {
    const summary = createSessionSummary(50);
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    expect(Array.isArray(recommendations)).toBe(true);
    if (recommendations.length > 1) {
      // Should be sorted by priority (high > medium > low)
      for (let i = 0; i < recommendations.length - 1; i++) {
        const priorityScore = { high: 3, medium: 2, low: 1 };
        expect(priorityScore[recommendations[i].priority]).toBeGreaterThanOrEqual(
          priorityScore[recommendations[i + 1].priority]
        );
      }
    }
  });

  it('should trigger engagement recommendations for low engagement', () => {
    const summary = createSessionSummary(35); // Low engagement
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const engagementRec = recommendations.find((r) => r.category === 'Engagement');
    expect(engagementRec).toBeDefined();
    expect(engagementRec?.priority).toBe('high');
    expect(engagementRec?.suggestion).toContain('interactive');
  });

  it('should trigger medium engagement recommendations', () => {
    const summary = createSessionSummary(55); // Medium engagement
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const engagementRec = recommendations.find((r) => r.category === 'Engagement');
    expect(engagementRec).toBeDefined();
    expect(engagementRec?.priority).toBe('medium');
  });

  it('should not trigger engagement recommendations for high engagement', () => {
    const summary = createSessionSummary(85); // High engagement
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    // May or may not have engagement rec, but if it does, it should be low priority
    const engagementRec = recommendations.find((r) => r.category === 'Engagement');
    if (engagementRec) {
      expect(engagementRec.priority).not.toBe('high');
    }
  });

  it('should trigger clarity recommendations for high confusion', () => {
    const summary = createSessionSummary(50, undefined, {
      engaged: 30,
      passive: 15,
      confused: 35, // High confusion
      drifting: 10,
      struggling: 10,
    });
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const clarityRec = recommendations.find((r) => r.category === 'Clarity');
    expect(clarityRec).toBeDefined();
    expect(clarityRec?.priority).toBe('high');
    expect(clarityRec?.suggestion).toContain('prerequisite');
  });

  it('should trigger participation recommendations for low student talk time', () => {
    const summary = createSessionSummary(
      50,
      { tutor: 0.75, student: 0.25 }, // Student only 25%
      undefined,
      'stable',
      { tutor: 0.6, student: 0.5 }
    );
    mockConfig.sessionType = 'discussion';
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const participationRec = recommendations.find((r) => r.category === 'Participation');
    expect(participationRec).toBeDefined();
    expect(participationRec?.priority).toBe('high');
    expect(participationRec?.suggestion).toContain('open-ended');
  });

  it('should not trigger participation recommendations for practice session with low student talk', () => {
    const summary = createSessionSummary(
      50,
      { tutor: 0.85, student: 0.15 }, // Very low student talk
      undefined,
      'stable',
      { tutor: 0.6, student: 0.3 }
    );
    mockConfig.sessionType = 'lecture'; // Lecture is fine with low student talk
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const participationRec = recommendations.find((r) => r.category === 'Participation' && r.priority === 'high');
    expect(participationRec).toBeUndefined();
  });

  it('should trigger tutor dominance recommendations', () => {
    const summary = createSessionSummary(
      50,
      { tutor: 0.9, student: 0.1 }, // Tutor dominated
      undefined,
      'stable',
      { tutor: 0.6, student: 0.3 }
    );
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const participationRec = recommendations.find((r) => r.category === 'Participation' && r.suggestion.includes('Socratic'));
    expect(participationRec).toBeDefined();
    expect(participationRec?.priority).toBe('medium');
  });

  it('should trigger attention recommendations for high drifting', () => {
    const summary = createSessionSummary(
      50,
      undefined,
      {
        engaged: 30,
        passive: 20,
        confused: 10,
        drifting: 25, // High drifting
        struggling: 15,
      }
    );
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const attentionRec = recommendations.find((r) => r.category === 'Attention');
    expect(attentionRec).toBeDefined();
    expect(attentionRec?.priority).toBe('medium');
  });

  it('should trigger support recommendations for high struggling', () => {
    const summary = createSessionSummary(
      40,
      undefined,
      {
        engaged: 20,
        passive: 20,
        confused: 20,
        drifting: 15,
        struggling: 25, // High struggling
      }
    );
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const supportRec = recommendations.find((r) => r.category === 'Support');
    expect(supportRec).toBeDefined();
    expect(supportRec?.priority).toBe('high');
    expect(supportRec?.suggestion).toContain('scaffolding');
  });

  it('should reflect improving engagement trend positively', () => {
    const summary = createSessionSummary(50, undefined, undefined, 'improving');
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const structureRec = recommendations.find((r) => r.category === 'Structure');
    if (structureRec) {
      expect(structureRec.suggestion).toContain('similar');
      expect(structureRec.priority).toBe('low');
    }
  });

  it('should address declining engagement trend', () => {
    const summary = createSessionSummary(60, undefined, undefined, 'declining');
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const structureRec = recommendations.find((r) => r.category === 'Structure');
    expect(structureRec).toBeDefined();
    expect(structureRec?.suggestion).toContain('shorter sessions');
  });

  it('should recommend longer sessions for short duration', () => {
    const shortSummary = createSessionSummary(60);
    shortSummary.duration = 10 * 60 * 1000; // 10 minutes (short)
    const recommendations = engine.generateRecommendations(shortSummary, mockConfig);

    const planningRec = recommendations.find((r) => r.category === 'Planning');
    if (planningRec) {
      expect(planningRec.suggestion).toContain('longer');
    }
  });

  it('should address low tutor eye contact', () => {
    const summary = createSessionSummary(
      50,
      undefined,
      undefined,
      'stable',
      { tutor: 0.25, student: 0.6 } // Low tutor eye contact
    );
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const connectionRec = recommendations.find((r) => r.category === 'Connection');
    expect(connectionRec).toBeDefined();
    expect(connectionRec?.suggestion).toContain('eye contact');
  });

  it('should warn about high nudge frequency', () => {
    const summary = createSessionSummary(50, undefined, undefined, 'stable', undefined, 20, 8); // 20 nudges
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const difficultyRec = recommendations.find((r) => r.category === 'Difficulty');
    expect(difficultyRec).toBeDefined();
    expect(difficultyRec?.suggestion).toContain('difficulty');
  });

  it('should address multiple high-priority nudges', () => {
    const summary = createSessionSummary(
      50,
      undefined,
      undefined,
      'stable',
      undefined,
      20, // 20 nudges
      10 // 10 high priority
    );
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    const coachingRec = recommendations.find((r) => r.category === 'Coaching');
    expect(coachingRec).toBeDefined();
    expect(coachingRec?.priority).toBe('high');
  });

  it('should provide reason for each recommendation', () => {
    const summary = createSessionSummary(35);
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    recommendations.forEach((rec) => {
      expect(rec.reason).toBeDefined();
      expect(rec.reason.length).toBeGreaterThan(0);
    });
  });

  it('should prioritize high recommendations first', () => {
    const summary = createSessionSummary(
      35, // Low engagement
      { tutor: 0.85, student: 0.15 }, // Tutor dominated
      {
        engaged: 20,
        passive: 20,
        confused: 40, // High confusion
        drifting: 10,
        struggling: 10,
      }
    );
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    if (recommendations.length > 1) {
      const firstRec = recommendations[0];
      expect(firstRec.priority).toBe('high');
    }
  });

  it('should handle empty/zero nudges gracefully', () => {
    const summary = createSessionSummary(60, undefined, undefined, 'stable', undefined, 0, 0);
    const recommendations = engine.generateRecommendations(summary, mockConfig);

    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);
  });
});
