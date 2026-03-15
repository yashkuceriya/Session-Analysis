import { SessionConfig } from '../session/types';
import { SessionSummary } from './SessionSummarizer';

export interface Recommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  reason: string;
}

export class RecommendationEngine {
  generateRecommendations(
    summary: SessionSummary,
    config: SessionConfig
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check engagement level
    if (summary.overallEngagement < 40) {
      recommendations.push({
        category: 'Engagement',
        priority: 'high',
        suggestion: 'Try more interactive exercises and real-world examples',
        reason: 'Overall engagement was below 40% - consider varying instructional approach',
      });
    } else if (summary.overallEngagement < 60) {
      recommendations.push({
        category: 'Engagement',
        priority: 'medium',
        suggestion: 'Incorporate more hands-on activities to boost engagement',
        reason: 'Engagement could be improved with more interactive elements',
      });
    }

    // Check confusion level
    const confusedPercent = summary.studentStateBreakdown.confused || 0;
    if (confusedPercent > 30) {
      recommendations.push({
        category: 'Clarity',
        priority: 'high',
        suggestion: 'Review prerequisites and slow down pacing in next session',
        reason: 'Student was confused more than 30% of the time',
      });
    }

    // Check talk time ratio
    const studentTalkPercent = summary.talkTimeRatio.student * 100;
    if (config.sessionType === 'discussion' || config.sessionType === 'practice') {
      if (studentTalkPercent < 30) {
        recommendations.push({
          category: 'Participation',
          priority: 'high',
          suggestion: 'Use more open-ended questions to increase student speaking time',
          reason: 'Student spoke less than 30% - aim for more balanced discussion',
        });
      }
    }

    // Check tutor dominance
    const tutorTalkPercent = summary.talkTimeRatio.tutor * 100;
    if (tutorTalkPercent > 85) {
      recommendations.push({
        category: 'Participation',
        priority: 'medium',
        suggestion: 'Incorporate Socratic questioning techniques for more student-led learning',
        reason: 'Tutor dominated conversation at 85%+ - aim for more balanced exchange',
      });
    }

    // Check attention drifting
    const driftingPercent = summary.studentStateBreakdown.drifting || 0;
    if (driftingPercent > 20) {
      recommendations.push({
        category: 'Attention',
        priority: 'medium',
        suggestion: 'Increase interaction frequency and vary instructional methods',
        reason: 'Student attention drifted more than 20% of the time',
      });
    }

    // Check struggling
    const strugglingPercent = summary.studentStateBreakdown.struggling || 0;
    if (strugglingPercent > 20) {
      recommendations.push({
        category: 'Support',
        priority: 'high',
        suggestion: 'Provide more scaffolding and check understanding more frequently',
        reason: 'Student showed signs of struggling in more than 20% of session',
      });
    }

    // Check engagement trend
    if (summary.engagementTrend === 'declining') {
      recommendations.push({
        category: 'Structure',
        priority: 'medium',
        suggestion: 'Engagement declined over time - consider shorter sessions or more variety',
        reason: 'Energy levels decreased as session progressed',
      });
    } else if (summary.engagementTrend === 'improving') {
      recommendations.push({
        category: 'Structure',
        priority: 'low',
        suggestion: 'Continue with similar pacing and structure - it\'s working well',
        reason: 'Engagement improved throughout the session',
      });
    }

    // Check session duration
    const durationMinutes = summary.duration / 60000;
    if (durationMinutes < 15 && durationMinutes > 0) {
      recommendations.push({
        category: 'Planning',
        priority: 'low',
        suggestion: 'Consider longer sessions for deeper exploration of complex topics',
        reason: 'Session was quite short - longer sessions allow more depth',
      });
    }

    // Check eye contact
    if (summary.eyeContactAvg.tutor < 0.3) {
      recommendations.push({
        category: 'Connection',
        priority: 'medium',
        suggestion: 'Focus on maintaining stronger eye contact with the student',
        reason: 'Low eye contact can reduce perceived engagement and connection',
      });
    }

    // Check nudge frequency
    if (summary.nudgesSummary.total > 15) {
      recommendations.push({
        category: 'Difficulty',
        priority: 'medium',
        suggestion: 'Review content difficulty level and adjust pacing accordingly',
        reason: 'Many coaching nudges were triggered - content may be misaligned',
      });
    }

    // Check high interruptions
    if (summary.nudgesSummary.byPriority.high && summary.nudgesSummary.byPriority.high > 5) {
      recommendations.push({
        category: 'Coaching',
        priority: 'high',
        suggestion: 'Address high-priority issues from coaching nudges in next session',
        reason: 'Multiple high-priority coaching nudges were triggered',
      });
    }

    // Sort by priority and return top 3-5
    const sortedByPriority = recommendations.sort((a, b) => {
      const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return priorityScore[b.priority] - priorityScore[a.priority];
    });

    return sortedByPriority.slice(0, 5);
  }
}
