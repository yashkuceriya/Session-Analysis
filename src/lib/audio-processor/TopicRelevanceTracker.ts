import { RollingWindow } from '../utils/smoothing';

/**
 * Tracks whether tutor speech is relevant to the configured session topic/subject.
 * Uses keyword extraction and matching against transcript segments.
 */
export class TopicRelevanceTracker {
  private topicKeywords: string[] = [];
  private recentTranscripts = new RollingWindow<string>(50); // Last 50 segments
  private relevanceHistory = new RollingWindow<number>(30); // Last 30 checks
  private totalSegments = 0;
  private relevantSegments = 0;
  private lastCheckTime = 0;

  /**
   * Set the session topic/subject. Extracts keywords for matching.
   */
  setTopic(subject: string) {
    if (!subject || subject.trim().length === 0) {
      this.topicKeywords = [];
      return;
    }

    // Extract meaningful keywords from the subject
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but',
      'or', 'not', 'no', 'nor', 'so', 'yet', 'both', 'each', 'every', 'all',
      'any', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too',
      'very', 'just', 'about', 'up', 'out', 'it', 'its', 'this', 'that',
      'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
      'she', 'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where',
      'how', 'why', 'lesson', 'session', 'class', 'teaching', 'learning',
      'introduction', 'basics', 'advanced', 'review', 'practice',
    ]);

    // Split subject into words and extract keywords
    const words = subject.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Also generate compound keywords (bigrams) for multi-word topics
    const bigrams: string[] = [];
    const rawWords = subject.toLowerCase().split(/\s+/);
    for (let i = 0; i < rawWords.length - 1; i++) {
      bigrams.push(`${rawWords[i]} ${rawWords[i + 1]}`);
    }

    // Add topic-related synonyms/expanded keywords
    const expanded = this.expandKeywords(words);

    this.topicKeywords = [...new Set([...words, ...expanded, ...bigrams])];
  }

  /**
   * Expand keywords with common related terms
   */
  private expandKeywords(keywords: string[]): string[] {
    const expansions: Record<string, string[]> = {
      math: ['algebra', 'geometry', 'calculus', 'equation', 'formula', 'number', 'variable', 'function', 'graph', 'solve'],
      algebra: ['equation', 'variable', 'expression', 'polynomial', 'linear', 'quadratic', 'factor'],
      geometry: ['angle', 'triangle', 'circle', 'area', 'perimeter', 'shape', 'polygon', 'theorem'],
      calculus: ['derivative', 'integral', 'limit', 'function', 'slope', 'rate', 'change'],
      physics: ['force', 'energy', 'motion', 'velocity', 'acceleration', 'mass', 'gravity', 'wave', 'electric'],
      chemistry: ['element', 'compound', 'reaction', 'molecule', 'atom', 'bond', 'acid', 'base', 'solution'],
      biology: ['cell', 'dna', 'gene', 'protein', 'organism', 'evolution', 'ecology', 'photosynthesis'],
      english: ['grammar', 'vocabulary', 'reading', 'writing', 'essay', 'literature', 'poetry', 'sentence'],
      programming: ['code', 'function', 'variable', 'loop', 'array', 'class', 'object', 'algorithm', 'debug'],
      history: ['war', 'revolution', 'civilization', 'empire', 'president', 'century', 'era', 'treaty'],
      science: ['experiment', 'hypothesis', 'theory', 'data', 'observation', 'method', 'result', 'evidence'],
    };

    const expanded: string[] = [];
    for (const keyword of keywords) {
      if (expansions[keyword]) {
        expanded.push(...expansions[keyword]);
      }
    }
    return expanded;
  }

  /**
   * Process a new transcript segment and check relevance
   */
  processTranscript(transcript: string): {
    isRelevant: boolean;
    relevanceScore: number;
    matchedKeywords: string[];
  } {
    if (this.topicKeywords.length === 0) {
      return { isRelevant: true, relevanceScore: 1.0, matchedKeywords: [] };
    }

    const lowerTranscript = transcript.toLowerCase();
    this.recentTranscripts.push(lowerTranscript);
    this.totalSegments++;

    // Check for keyword matches
    const matchedKeywords: string[] = [];
    for (const keyword of this.topicKeywords) {
      if (lowerTranscript.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    const isRelevant = matchedKeywords.length > 0;
    if (isRelevant) this.relevantSegments++;

    // Score: proportion of keywords found (boosted for multi-match)
    const rawScore = matchedKeywords.length / Math.max(1, Math.min(5, this.topicKeywords.length));
    const relevanceScore = Math.min(1, rawScore * 1.5);

    this.relevanceHistory.push(relevanceScore);

    return { isRelevant, relevanceScore, matchedKeywords };
  }

  /**
   * Get overall topic relevance score (0-1) over the recent window
   */
  getRelevanceScore(): number {
    if (this.relevanceHistory.length === 0) return 1.0; // Assume relevant if no data
    return this.relevanceHistory.average(v => v);
  }

  /**
   * Get the ratio of relevant segments to total segments
   */
  getRelevanceRatio(): number {
    if (this.totalSegments === 0) return 1.0;
    return this.relevantSegments / this.totalSegments;
  }

  /**
   * Check if tutor has been off-topic for an extended period
   */
  isOffTopic(windowSize: number = 10): boolean {
    if (this.topicKeywords.length === 0) return false;
    if (this.relevanceHistory.length < windowSize) return false;

    // Check last `windowSize` transcripts: if none are relevant, flag as off-topic
    const recent = this.relevanceHistory.getAll().slice(-windowSize);
    const avgRelevance = recent.reduce((a, b) => a + b, 0) / recent.length;
    return avgRelevance < 0.1;
  }

  reset() {
    this.recentTranscripts.clear();
    this.relevanceHistory.clear();
    this.totalSegments = 0;
    this.relevantSegments = 0;
    this.lastCheckTime = 0;
  }
}
