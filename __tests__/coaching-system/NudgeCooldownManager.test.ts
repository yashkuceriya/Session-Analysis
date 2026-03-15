import { NudgeCooldownManager } from '@/lib/coaching-system/NudgeCooldownManager';

describe('NudgeCooldownManager', () => {
  it('allows first trigger', () => {
    const mgr = new NudgeCooldownManager(0);
    expect(mgr.canTrigger('rule-1', 5000, 1000)).toBe(true);
  });

  it('blocks trigger within per-rule cooldown', () => {
    const mgr = new NudgeCooldownManager(0);
    mgr.recordTrigger('rule-1', 1000);
    expect(mgr.canTrigger('rule-1', 5000, 3000)).toBe(false);
  });

  it('allows trigger after per-rule cooldown expires', () => {
    const mgr = new NudgeCooldownManager(0);
    mgr.recordTrigger('rule-1', 1000);
    expect(mgr.canTrigger('rule-1', 5000, 7000)).toBe(true);
  });

  it('blocks trigger within global cooldown', () => {
    const mgr = new NudgeCooldownManager(10000);
    mgr.recordTrigger('rule-1', 1000);
    // Different rule, but global cooldown blocks
    expect(mgr.canTrigger('rule-2', 0, 2000)).toBe(false);
  });

  it('allows different rule after global cooldown', () => {
    const mgr = new NudgeCooldownManager(1000);
    mgr.recordTrigger('rule-1', 1000);
    expect(mgr.canTrigger('rule-2', 0, 3000)).toBe(true);
  });

  it('resets all cooldowns', () => {
    const mgr = new NudgeCooldownManager(0);
    mgr.recordTrigger('rule-1', 1000);
    mgr.reset();
    expect(mgr.canTrigger('rule-1', 5000, 2000)).toBe(true);
  });
});
