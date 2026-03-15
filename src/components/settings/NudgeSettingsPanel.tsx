'use client';

import { useSessionStore } from '@/stores/sessionStore';
import { SensitivityLevel } from '@/lib/coaching-system/types';

interface NudgeSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SENSITIVITY_OPTIONS: { value: SensitivityLevel; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Only critical nudges (5+ min silence, attention drift)' },
  { value: 'medium', label: 'Medium', description: 'Default set — balanced feedback' },
  { value: 'high', label: 'High', description: 'All nudges including encouragement' },
];

const INTERVAL_OPTIONS = [
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1m' },
  { value: 120000, label: '2m' },
];

interface RuleCategory {
  id: string;
  name: string;
  icon: string;
  ruleIds: string[];
}

const RULE_CATEGORIES: RuleCategory[] = [
  {
    id: 'silence-participation',
    name: 'Silence & Participation',
    icon: '💬',
    ruleIds: ['student-silent-long', 'student-silent-critical', 'student-passive', 'tutor-dominating'],
  },
  {
    id: 'attention-engagement',
    name: 'Attention & Engagement',
    icon: '👁',
    ruleIds: ['low-student-eye-contact', 'attention-drift', 'energy-drop', 'engagement-plummeting'],
  },
  {
    id: 'student-state',
    name: 'Student State',
    icon: '🧠',
    ruleIds: ['student-confused', 'student-struggling', 'student-drifting'],
  },
  {
    id: 'pacing-interaction',
    name: 'Pacing & Interaction',
    icon: '⚡',
    ruleIds: ['interruption-spike', 'tutor-too-fast'],
  },
  {
    id: 'positive-feedback',
    name: 'Positive Feedback',
    icon: '🌟',
    ruleIds: ['great-turn-taking', 'great-engagement', 'session-recovery'],
  },
];

export function NudgeSettingsPanel({ isOpen, onClose }: NudgeSettingsPanelProps) {
  const config = useSessionStore((s) => s.coachingConfig);
  const updateConfig = useSessionStore((s) => s.updateCoachingConfig);

  if (!isOpen) return null;

  const isCategoryDisabled = (category: RuleCategory): boolean => {
    return category.ruleIds.every((ruleId) => config.disabledRules.includes(ruleId));
  };

  const toggleCategory = (category: RuleCategory) => {
    const isCurrentlyDisabled = isCategoryDisabled(category);
    const newDisabledRules = new Set(config.disabledRules);

    if (isCurrentlyDisabled) {
      // Enable: remove all rules in this category
      category.ruleIds.forEach((ruleId) => newDisabledRules.delete(ruleId));
    } else {
      // Disable: add all rules in this category
      category.ruleIds.forEach((ruleId) => newDisabledRules.add(ruleId));
    }

    updateConfig({ disabledRules: Array.from(newDisabledRules) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Coaching Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Enable/disable */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-800">
          <div>
            <p className="text-sm text-white">Coaching Nudges</p>
            <p className="text-xs text-gray-500">Show real-time suggestions during session</p>
          </div>
          <button
            onClick={() => updateConfig({ enabled: !config.enabled })}
            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
              config.enabled ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Sensitivity */}
        <div className="mb-5">
          <p className="text-sm text-white mb-2">Sensitivity</p>
          <div className="space-y-2">
            {SENSITIVITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateConfig({ sensitivity: opt.value })}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  config.sensitivity === opt.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <p className="text-sm text-white">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Minimum interval */}
        <div className="mb-5 pb-5 border-b border-gray-800">
          <p className="text-sm text-white mb-2">Minimum Interval Between Nudges</p>
          <div className="flex gap-2">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateConfig({ minIntervalMs: opt.value })}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  config.minIntervalMs === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rule Categories */}
        <div className="mb-5">
          <p className="text-sm text-white mb-3 font-medium">Rule Categories</p>
          <div className="space-y-2">
            {RULE_CATEGORIES.map((category) => {
              const isDisabled = isCategoryDisabled(category);
              return (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                    isDisabled
                      ? 'border-gray-700 bg-gray-800/50'
                      : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">{category.icon}</span>
                    <div className="text-left min-w-0">
                      <p className={`text-sm font-medium ${isDisabled ? 'text-gray-500' : 'text-white'}`}>
                        {category.name}
                      </p>
                      <p className={`text-xs ${isDisabled ? 'text-gray-600' : 'text-gray-500'}`}>
                        {category.ruleIds.length} rule{category.ruleIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                      isDisabled ? 'bg-gray-700' : 'bg-blue-600'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                        isDisabled ? 'translate-x-0.5' : 'translate-x-[18px]'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
