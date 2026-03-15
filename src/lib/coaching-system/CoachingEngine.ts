import { Nudge, NudgeRule, CoachingConfig, SensitivityLevel, DEFAULT_COACHING_CONFIG } from './types';
import { DEFAULT_NUDGE_RULES, createNudgeRules } from './NudgeRules';
import { NudgeCooldownManager } from './NudgeCooldownManager';
import { MetricSnapshot } from '../metrics-engine/types';

const SENSITIVITY_LEVELS: SensitivityLevel[] = ['low', 'medium', 'high'];

function sensitivityIncludes(current: SensitivityLevel, ruleLevel: SensitivityLevel): boolean {
  return SENSITIVITY_LEVELS.indexOf(current) >= SENSITIVITY_LEVELS.indexOf(ruleLevel);
}

let nudgeCounter = 0;

export class CoachingEngine {
  private rules: NudgeRule[];
  private config: CoachingConfig;
  private cooldownManager: NudgeCooldownManager;

  constructor(config: Partial<CoachingConfig> = {}, rules?: NudgeRule[], sessionType?: 'lecture' | 'discussion' | 'practice') {
    this.config = { ...DEFAULT_COACHING_CONFIG, ...config };
    this.rules = rules ?? (sessionType ? createNudgeRules(sessionType) : DEFAULT_NUDGE_RULES);
    this.cooldownManager = new NudgeCooldownManager(this.config.minIntervalMs);
  }

  evaluate(metrics: MetricSnapshot): Nudge[] {
    if (!this.config.enabled) return [];

    const now = metrics.timestamp;
    const triggered: Nudge[] = [];

    for (const rule of this.rules) {
      if (this.config.disabledRules.includes(rule.id)) continue;
      if (!sensitivityIncludes(this.config.sensitivity, rule.sensitivity)) continue;
      if (!this.cooldownManager.canTrigger(rule.id, rule.cooldownMs, now)) continue;

      try {
        if (rule.trigger(metrics)) {
          const nudge: Nudge = {
            id: `nudge-${++nudgeCounter}-${Date.now()}`,
            ruleId: rule.id,
            message: rule.message,
            icon: rule.icon,
            priority: rule.priority,
            timestamp: now,
            dismissed: false,
            triggerMetrics: {
              engagementScore: metrics.engagementScore,
              student: { ...metrics.student },
              tutor: { ...metrics.tutor },
            },
          };
          triggered.push(nudge);
          this.cooldownManager.recordTrigger(rule.id, now);
        }
      } catch {
        // Rule evaluation failed, skip
      }
    }

    return triggered;
  }

  updateConfig(config: Partial<CoachingConfig>) {
    this.config = { ...this.config, ...config };
    this.cooldownManager.setGlobalMinInterval(this.config.minIntervalMs);
  }

  getConfig(): CoachingConfig {
    return { ...this.config };
  }

  reset() {
    this.cooldownManager.reset();
  }
}
