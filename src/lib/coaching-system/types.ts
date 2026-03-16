import { MetricSnapshot } from '../metrics-engine/types';

export interface NudgeRule {
  id: string;
  trigger: (metrics: MetricSnapshot) => boolean;
  message: string;
  icon: string;
  priority: 'low' | 'medium' | 'high';
  cooldownMs: number;
  sensitivity: 'low' | 'medium' | 'high';
}

export interface Nudge {
  id: string;
  ruleId: string;
  message: string;
  icon: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
  dismissed: boolean;
  triggerMetrics: Partial<MetricSnapshot>;
}

export type SensitivityLevel = 'low' | 'medium' | 'high';

export interface CoachingConfig {
  sensitivity: SensitivityLevel;
  enabled: boolean;
  minIntervalMs: number;
  disabledRules: string[];
}

export const DEFAULT_COACHING_CONFIG: CoachingConfig = {
  sensitivity: 'high',
  enabled: true,
  minIntervalMs: 15000,
  disabledRules: [],
};
