export class NudgeCooldownManager {
  private lastTriggered = new Map<string, number>();
  private globalLastNudge = 0;
  private globalMinInterval: number;

  constructor(globalMinInterval: number = 30000) {
    this.globalMinInterval = globalMinInterval;
  }

  canTrigger(ruleId: string, cooldownMs: number, now: number): boolean {
    // Check global cooldown
    if (now - this.globalLastNudge < this.globalMinInterval) return false;

    // Check per-rule cooldown
    const lastTime = this.lastTriggered.get(ruleId);
    if (lastTime && now - lastTime < cooldownMs) return false;

    return true;
  }

  recordTrigger(ruleId: string, now: number) {
    this.lastTriggered.set(ruleId, now);
    this.globalLastNudge = now;
  }

  setGlobalMinInterval(ms: number) {
    this.globalMinInterval = ms;
  }

  reset() {
    this.lastTriggered.clear();
    this.globalLastNudge = 0;
  }
}
