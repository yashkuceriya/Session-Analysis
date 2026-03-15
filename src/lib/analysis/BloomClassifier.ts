import { BloomLevel, BloomResult } from './types';
import { RollingWindow } from '../utils/smoothing';

/**
 * Classifies questions and statements into Bloom's Taxonomy levels
 * Remember -> Understand -> Apply -> Analyze -> Evaluate -> Create
 */
export class BloomClassifier {
  private classificationHistory = new RollingWindow<{ level: BloomLevel; timestamp: number }>(200);

  private readonly REMEMBER_KEYWORDS = ['what is', 'define', 'name', 'list', 'recall', 'state', 'tell', 'know', 'remember', 'identify'];
  private readonly UNDERSTAND_KEYWORDS = ['explain', 'describe', 'summarize', 'interpret', 'classify', 'discuss', 'outline', 'restate', 'review', 'infer'];
  private readonly APPLY_KEYWORDS = ['how would you', 'demonstrate', 'solve', 'use', 'apply', 'calculate', 'construct', 'practice', 'show', 'implement'];
  private readonly ANALYZE_KEYWORDS = ['compare', 'contrast', 'examine', 'differentiate', 'why does', 'analyze', 'distinguish', 'break down', 'separate', 'categorize'];
  private readonly EVALUATE_KEYWORDS = ['do you agree', 'judge', 'assess', 'justify', 'which is better', 'evaluate', 'critique', 'defend', 'support', 'appraise'];
  private readonly CREATE_KEYWORDS = ['design', 'propose', 'create', 'what if', 'how might', 'invent', 'construct', 'plan', 'compose', 'develop'];

  /**
   * Classify a question or statement into Bloom's Taxonomy level
   */
  classifyQuestion(text: string): BloomResult {
    const lowerText = text.toLowerCase().trim();

    // Check for question ending
    const isQuestion = lowerText.endsWith('?');
    if (!isQuestion) {
      // Statements might be prompts or commands
      // Treat as questions for classification purposes
    }

    // Match against keyword sets in reverse order (highest to lowest)
    const levels: Array<[BloomLevel, string[], number]> = [
      ['create', this.CREATE_KEYWORDS, 1],
      ['evaluate', this.EVALUATE_KEYWORDS, 1],
      ['analyze', this.ANALYZE_KEYWORDS, 1],
      ['apply', this.APPLY_KEYWORDS, 1],
      ['understand', this.UNDERSTAND_KEYWORDS, 1],
      ['remember', this.REMEMBER_KEYWORDS, 1],
    ];

    for (const [level, keywords, baseWeight] of levels) {
      const { matchCount, confidence } = this.matchKeywords(lowerText, keywords);
      if (matchCount > 0) {
        const result: BloomResult = {
          level,
          confidence: Math.min(1, confidence),
          keywords: keywords.filter(kw => lowerText.includes(kw)),
        };

        this.classificationHistory.push({ level, timestamp: Date.now() });
        return result;
      }
    }

    // No keywords matched - classify as remember (basic recall)
    const result: BloomResult = {
      level: 'remember',
      confidence: 0.3,
      keywords: [],
    };

    this.classificationHistory.push({ level: 'remember', timestamp: Date.now() });
    return result;
  }

  /**
   * Get distribution of Bloom levels in the session
   */
  getSessionBloomProfile(): Record<BloomLevel, number> {
    const profile: Record<BloomLevel, number> = {
      remember: 0,
      understand: 0,
      apply: 0,
      analyze: 0,
      evaluate: 0,
      create: 0,
    };

    const history = this.classificationHistory.getAll();
    for (const entry of history) {
      profile[entry.level]++;
    }

    return profile;
  }

  /**
   * Detect if questions are getting deeper over the session
   * Returns progression: 'deepening' | 'stable' | 'regressing'
   */
  getProgression(): 'deepening' | 'stable' | 'regressing' {
    const history = this.classificationHistory.getAll();
    if (history.length < 10) return 'stable';

    // Split into two halves
    const midpoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midpoint);
    const secondHalf = history.slice(midpoint);

    // Calculate average Bloom level in each half (remember=1, understand=2, etc.)
    const levelValues: Record<BloomLevel, number> = {
      remember: 1,
      understand: 2,
      apply: 3,
      analyze: 4,
      evaluate: 5,
      create: 6,
    };

    const avgFirstHalf = firstHalf.length > 0
      ? firstHalf.reduce((sum, e) => sum + levelValues[e.level], 0) / firstHalf.length
      : 0;

    const avgSecondHalf = secondHalf.length > 0
      ? secondHalf.reduce((sum, e) => sum + levelValues[e.level], 0) / secondHalf.length
      : 0;

    const diff = avgSecondHalf - avgFirstHalf;

    if (diff > 0.5) return 'deepening';
    if (diff < -0.5) return 'regressing';
    return 'stable';
  }

  /**
   * Get recent classifications (last N)
   */
  getRecentClassifications(count: number = 10): Array<{ level: BloomLevel; timestamp: number }> {
    const history = this.classificationHistory.getAll();
    return history.slice(-count);
  }

  /**
   * Reset all history
   */
  reset() {
    this.classificationHistory.clear();
  }

  /**
   * Internal: match keywords in text
   */
  private matchKeywords(text: string, keywords: string[]): { matchCount: number; confidence: number } {
    let matchCount = 0;
    let totalKeywordLength = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        matchCount++;
        totalKeywordLength += keyword.length;
      }
    }

    if (matchCount === 0) {
      return { matchCount: 0, confidence: 0 };
    }

    // Confidence based on how many keywords matched and their length
    // More keywords = higher confidence; longer keywords = higher confidence
    const keywordDensity = totalKeywordLength / text.length;
    const matchRatio = matchCount / Math.max(1, keywords.length);
    const confidence = Math.min(1, 0.3 + matchRatio * 0.4 + keywordDensity * 0.3);

    return { matchCount, confidence };
  }
}
