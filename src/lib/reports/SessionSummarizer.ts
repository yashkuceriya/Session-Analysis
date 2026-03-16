import { MetricSnapshot, StudentState } from '../metrics-engine/types';
import { Nudge } from '../coaching-system/types';
import { SessionConfig } from '../session/types';

export interface KeyMoment {
  timestamp: number;
  type: 'peak' | 'valley' | 'state_change' | 'nudge';
  description: string;
  engagementScore: number;
}

export interface SessionSummary {
  duration: number; // ms
  overallEngagement: number; // 0-100 average
  engagementTrend: 'improving' | 'declining' | 'stable';
  keyMoments: KeyMoment[];
  studentStateBreakdown: Record<StudentState, number>; // % in each state
  talkTimeRatio: { tutor: number; student: number };
  eyeContactAvg: { tutor: number; student: number };
  nudgesSummary: {
    total: number;
    byPriority: Record<string, number>;
    mostFrequent: string;
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
}

export class SessionSummarizer {
  summarize(
    history: MetricSnapshot[],
    nudgeHistory: Nudge[],
    config: SessionConfig
  ): SessionSummary {
    if (history.length === 0) {
      return this.createEmptySummary();
    }

    // Calculate duration
    const duration = history[history.length - 1].timestamp - history[0].timestamp;

    // Calculate engagement metrics
    const engagementScores = history.map((m) => m.engagementScore);
    const overallEngagement = this.calculateAverage(engagementScores);
    const engagementTrend = this.calculateTrend(engagementScores);

    // Calculate talk time ratio
    const talkTimeRatio = this.calculateTalkTimeRatio(history);

    // Calculate eye contact averages
    const eyeContactAvg = this.calculateEyeContactAverage(history);

    // Calculate student state breakdown
    const studentStateBreakdown = this.calculateStateBreakdown(history);

    // Generate key moments
    const keyMoments = this.identifyKeyMoments(history, nudgeHistory);

    // Calculate nudge summary
    const nudgesSummary = this.summarizeNudges(nudgeHistory);

    // Generate insights
    const { strengths, areasForImprovement, recommendations } = this.generateInsights(
      {
        duration,
        overallEngagement,
        engagementTrend,
        talkTimeRatio,
        eyeContactAvg,
        studentStateBreakdown,
        nudgesSummary: nudgesSummary,
      },
      nudgeHistory,
      config
    );

    return {
      duration,
      overallEngagement,
      engagementTrend,
      keyMoments: keyMoments.slice(0, 5), // Top 5 moments
      studentStateBreakdown,
      talkTimeRatio,
      eyeContactAvg,
      nudgesSummary,
      strengths,
      areasForImprovement,
      recommendations,
    };
  }

  private createEmptySummary(): SessionSummary {
    return {
      duration: 0,
      overallEngagement: 0,
      engagementTrend: 'stable',
      keyMoments: [],
      studentStateBreakdown: {
        engaged: 0,
        passive: 0,
        confused: 0,
        drifting: 0,
        struggling: 0,
      },
      talkTimeRatio: { tutor: 0.5, student: 0.5 },
      eyeContactAvg: { tutor: 0, student: 0 },
      nudgesSummary: { total: 0, byPriority: {}, mostFrequent: 'none' },
      strengths: [],
      areasForImprovement: [],
      recommendations: [],
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  private calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' {
    if (values.length < 10) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);

    const difference = secondAvg - firstAvg;
    const threshold = 5; // 5 point difference

    if (difference > threshold) return 'improving';
    if (difference < -threshold) return 'declining';
    return 'stable';
  }

  private calculateTalkTimeRatio(
    history: MetricSnapshot[]
  ): { tutor: number; student: number } {
    if (history.length === 0) return { tutor: 0.5, student: 0.5 };

    const tutorTalkTime = history.reduce((sum, m) => sum + m.tutor.talkTimePercent, 0);
    const studentTalkTime = history.reduce((sum, m) => sum + m.student.talkTimePercent, 0);

    const total = tutorTalkTime + studentTalkTime;
    if (total === 0) return { tutor: 0.5, student: 0.5 };

    return {
      tutor: tutorTalkTime / total,
      student: studentTalkTime / total,
    };
  }

  private calculateEyeContactAverage(
    history: MetricSnapshot[]
  ): { tutor: number; student: number } {
    if (history.length === 0) return { tutor: 0, student: 0 };

    const tutorEyeContact = this.calculateAverage(
      history.map((m) => m.tutor.eyeContactScore)
    );
    const studentEyeContact = this.calculateAverage(
      history.map((m) => m.student.eyeContactScore)
    );

    return {
      tutor: tutorEyeContact,
      student: studentEyeContact,
    };
  }

  private calculateStateBreakdown(
    history: MetricSnapshot[]
  ): Record<StudentState, number> {
    const states: StudentState[] = ['engaged', 'passive', 'confused', 'drifting', 'struggling'];
    const breakdown: Record<StudentState, number> = {
      engaged: 0,
      passive: 0,
      confused: 0,
      drifting: 0,
      struggling: 0,
    };

    if (history.length === 0) return breakdown;

    states.forEach((state) => {
      const count = history.filter((m) => m.studentState === state).length;
      breakdown[state] = (count / history.length) * 100;
    });

    return breakdown;
  }

  private identifyKeyMoments(
    history: MetricSnapshot[],
    nudgeHistory: Nudge[]
  ): KeyMoment[] {
    const moments: KeyMoment[] = [];
    const sortedByEngagement = [...history].sort((a, b) => a.engagementScore - b.engagementScore);
    const lowestMoments = sortedByEngagement.slice(0, Math.min(2, sortedByEngagement.length));
    const highestMoments = [...sortedByEngagement]
      .reverse()
      .slice(0, Math.min(2, sortedByEngagement.length));

    lowestMoments.forEach((metric) => {
      moments.push({
        timestamp: metric.timestamp,
        type: 'valley',
        description: `Low engagement: ${Math.round(metric.engagementScore)}%`,
        engagementScore: metric.engagementScore,
      });
    });

    highestMoments.forEach((metric) => {
      moments.push({
        timestamp: metric.timestamp,
        type: 'peak',
        description: `High engagement: ${Math.round(metric.engagementScore)}%`,
        engagementScore: metric.engagementScore,
      });
    });

    // Find state changes.
    for (let i = 1; i < history.length; i++) {
      if (history[i].studentState !== history[i - 1].studentState) {
        moments.push({
          timestamp: history[i].timestamp,
          type: 'state_change',
          description: `State changed: ${history[i - 1].studentState} → ${history[i].studentState}`,
          engagementScore: history[i].engagementScore,
        });
      }
    }

    // Add nudge moments
    nudgeHistory.forEach((nudge) => {
      if (!nudge.dismissed) {
        moments.push({
          timestamp: nudge.timestamp,
          type: 'nudge',
          description: nudge.message,
          engagementScore: nudge.triggerMetrics.engagementScore || 0,
        });
      }
    });

    const uniqueMoments = moments.filter((moment, index, allMoments) => {
      return allMoments.findIndex(
        (candidate) =>
          candidate.timestamp === moment.timestamp &&
          candidate.type === moment.type &&
          candidate.description === moment.description
      ) === index;
    });

    const getPriority = (moment: KeyMoment) => {
      switch (moment.type) {
        case 'valley':
          return 0;
        case 'nudge':
          return 1;
        case 'state_change':
          return 2;
        case 'peak':
          return 3;
      }
    };

    return uniqueMoments
      .sort((a, b) => {
        const priorityDiff = getPriority(a) - getPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        if (a.type === 'valley') return a.engagementScore - b.engagementScore;
        if (a.type === 'peak') return b.engagementScore - a.engagementScore;
        return a.timestamp - b.timestamp;
      })
      .slice(0, 5)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private summarizeNudges(
    nudgeHistory: Nudge[]
  ): { total: number; byPriority: Record<string, number>; mostFrequent: string } {
    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
    };

    nudgeHistory.forEach((nudge) => {
      byPriority[nudge.priority]++;
    });

    // Find most frequent nudge message
    const messageCounts: Record<string, number> = {};
    nudgeHistory.forEach((nudge) => {
      messageCounts[nudge.message] = (messageCounts[nudge.message] || 0) + 1;
    });

    let mostFrequent = 'none';
    let maxCount = 0;
    Object.entries(messageCounts).forEach(([message, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = message;
      }
    });

    return {
      total: nudgeHistory.length,
      byPriority,
      mostFrequent,
    };
  }

  private generateInsights(
    metrics: {
      duration: number;
      overallEngagement: number;
      engagementTrend: string;
      talkTimeRatio: { tutor: number; student: number };
      eyeContactAvg: { tutor: number; student: number };
      studentStateBreakdown: Record<StudentState, number>;
      nudgesSummary: { total: number; byPriority: Record<string, number>; mostFrequent: string };
    },
    nudgeHistory: Nudge[],
    config: SessionConfig
  ): {
    strengths: string[];
    areasForImprovement: string[];
    recommendations: string[];
  } {
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];
    const recommendations: string[] = [];

    // Eye contact insights
    if (metrics.eyeContactAvg.tutor > 0.7) {
      strengths.push('Excellent eye contact maintained throughout the session');
    }
    if (metrics.eyeContactAvg.student > 0.7) {
      strengths.push('Student maintained strong engagement through consistent eye contact');
    }
    if (metrics.eyeContactAvg.tutor < 0.4) {
      areasForImprovement.push('Consider improving eye contact with the student');
    }
    if (metrics.eyeContactAvg.student < 0.4) {
      areasForImprovement.push('Student showed limited eye contact—may indicate distraction or discomfort');
    }

    // Talk time insights
    const studentTalkPercent = metrics.talkTimeRatio.student * 100;
    const tutorTalkPercent = metrics.talkTimeRatio.tutor * 100;

    if (config.sessionType === 'practice' && studentTalkPercent < 40) {
      areasForImprovement.push(
        'Student spoke less than expected for a practice session—encourage more participation'
      );
      recommendations.push('Use more open-ended questions to increase student speaking time');
    }
    if (tutorTalkPercent > 85) {
      areasForImprovement.push('Tutor dominated the conversation—limit instructional talk time');
      recommendations.push('Try incorporating more Socratic questioning techniques');
    }
    if (studentTalkPercent > 70) {
      strengths.push('Good balance with student taking lead in discussion');
    }

    // Engagement insights
    if (metrics.overallEngagement > 75) {
      strengths.push('Strong overall engagement throughout the session');
    }
    if (metrics.overallEngagement < 50) {
      areasForImprovement.push('Overall engagement was low—consider varying instructional approach');
      recommendations.push('Try interactive activities or real-world examples to boost engagement');
    }

    // State breakdown insights
    const confusedPercent = metrics.studentStateBreakdown.confused || 0;
    const driftingPercent = metrics.studentStateBreakdown.drifting || 0;
    const strugglingPercent = metrics.studentStateBreakdown.struggling || 0;

    if (confusedPercent > 30) {
      areasForImprovement.push(
        'Student showed frequent signs of confusion—consider reviewing prerequisites'
      );
      recommendations.push('Slow down pacing and break complex concepts into smaller steps');
    }
    if (driftingPercent > 20) {
      areasForImprovement.push('Attention drifting detected multiple times');
      recommendations.push('Increase interaction frequency and vary instructional methods');
    }
    if (strugglingPercent > 20) {
      areasForImprovement.push('Student showed signs of struggling—may need additional support');
      recommendations.push('Provide more scaffolding and check for understanding more frequently');
    }

    // Trend insights
    if (metrics.engagementTrend === 'improving') {
      strengths.push('Engagement improved throughout the session');
    }
    if (metrics.engagementTrend === 'declining') {
      recommendations.push('Engagement declined—consider shorter sessions or more variety next time');
    }

    // Duration insights
    const durationMinutes = metrics.duration / 60000;
    if (durationMinutes < 15) {
      recommendations.push('Consider longer sessions for deeper exploration of topics');
    }

    // Nudge insights
    if (metrics.nudgesSummary.total > 10) {
      recommendations.push('Many coaching nudges triggered—review and adjust difficulty level');
    }

    return {
      strengths: strengths.slice(0, 3),
      areasForImprovement: areasForImprovement.slice(0, 3),
      recommendations: recommendations.slice(0, 3),
    };
  }
}
