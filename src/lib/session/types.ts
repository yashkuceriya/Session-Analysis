import { MetricSnapshot, SessionType } from '../metrics-engine/types';
import { Nudge, CoachingConfig } from '../coaching-system/types';

export interface SessionConfig {
  subject: string;
  sessionType: SessionType;
  studentLevel: string;
  tutorName: string;
  studentName: string;
}

export interface Session {
  id: string;
  config: SessionConfig;
  startTime: number;
  endTime: number | null;
  status: 'active' | 'completed';
  metricsHistory: MetricSnapshot[];
  nudgeHistory: Nudge[];
  coachingConfig: CoachingConfig;
}

export interface SessionSummary {
  id: string;
  config: SessionConfig;
  durationMinutes: number;
  avgEngagement: number;
  talkTimeRatio: { tutor: number; student: number };
  avgEyeContact: { tutor: number; student: number };
  totalInterruptions: number;
  nudgesTriggered: number;
  keyMoments: KeyMoment[];
  recommendations: string[];
}

export interface KeyMoment {
  timestamp: number;
  type: 'attention_drop' | 'engagement_peak' | 'long_silence' | 'interruption_spike';
  description: string;
  metricValue: number;
}
