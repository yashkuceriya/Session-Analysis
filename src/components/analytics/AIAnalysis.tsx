'use client';

import { useState } from 'react';
import type { AISessionAnalysis } from '@/lib/ai/claude-analyzer';
import type { MetricSnapshot } from '@/lib/metrics-engine/types';
import type { Nudge } from '@/lib/coaching-system/types';
import type { SessionConfig } from '@/lib/session/types';

interface AIAnalysisProps {
  sessionId: string;
  metricsHistory?: MetricSnapshot[];
  nudgeHistory?: Nudge[];
  sessionConfig?: SessionConfig;
}

function ScoreBar({ label, score, color = 'blue' }: { label: string; score: number; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500',
    amber: 'bg-amber-500', rose: 'bg-rose-500',
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="text-[var(--foreground)] font-mono">{score}</span>
      </div>
      <div className="h-2 bg-[var(--card-hover)] rounded-full">
        <div
          className={`h-2 ${colors[color] || colors.blue} rounded-full transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function TextBlock({ label, text }: { label?: string; text: string }) {
  if (!text) return null;
  return (
    <div className="mb-3">
      {label && <p className="text-[10px] text-[var(--muted-light)] uppercase tracking-wider mb-1">{label}</p>}
      <p className="text-sm text-[var(--foreground)]/80 leading-relaxed">{text}</p>
    </div>
  );
}

function BulletList({ items, color = 'blue' }: { items: string[]; color?: string }) {
  if (!items || items.length === 0) return null;
  const dotColors: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-green-500', red: 'bg-red-500',
    amber: 'bg-amber-500', purple: 'bg-purple-500',
  };
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted)]">
          <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color] || dotColors.blue} mt-1.5 flex-shrink-0`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function AIAnalysis({ sessionId, metricsHistory, nudgeHistory, sessionConfig }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AISessionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      // Prepare fallback data from props or client store
      let metrics = metricsHistory;
      let nudges = nudgeHistory;
      let config = sessionConfig;

      // If not passed as props, try to get from store
      if (!metrics || !nudges || !config) {
        try {
          const { useSessionStore } = await import('@/stores/sessionStore');
          const state = useSessionStore.getState();
          metrics = metrics || state.getFullHistory();
          nudges = nudges || state.nudgeHistory;
          config = config || state.sessionConfig;
        } catch {
          // Store unavailable, will proceed with whatever we have
        }
      }

      const res = await fetch(`/api/sessions/${sessionId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, nudges, config }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }
      setAnalysis(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze');
    } finally {
      setLoading(false);
    }
  };

  // Not yet analyzed
  if (!analysis) {
    return (
      <div className="bg-[var(--accent-light)] border border-[var(--accent)]/20 rounded-xl p-6 mt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[var(--foreground)] font-semibold">AI Deep Analysis</h3>
            <p className="text-xs text-[var(--muted)]">Powered by Claude — get personalized coaching feedback</p>
          </div>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
            {error.includes('ANTHROPIC_API_KEY') ? (
              <div>
                <p className="text-red-400 text-xs font-medium mb-1">Configuration Required</p>
                <p className="text-red-400/80 text-xs">AI analysis requires <code className="bg-red-500/20 px-1 rounded">ANTHROPIC_API_KEY</code> environment variable. Set it in your <code className="bg-red-500/20 px-1 rounded">.env.local</code> file to enable AI-powered coaching feedback.</p>
              </div>
            ) : (
              <p className="text-red-400 text-xs">{error}</p>
            )}
          </div>
        )}
        <button
          onClick={runAnalysis}
          disabled={loading}
          className={`w-full py-3 rounded-lg text-sm font-medium transition-all ${
            loading
              ? 'bg-[var(--card-border)] text-[var(--muted)] cursor-wait'
              : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-blue-600/20'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-1 h-1 bg-white rounded-full animate-pulse"></span>
              <span className="inline-block w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
              <span className="inline-block w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              Analyzing session with AI
            </span>
          ) : (
            'Generate Deep Session Report'
          )}
        </button>
      </div>
    );
  }

  const gradeColor: Record<string, string> = {
    A: 'from-green-500 to-emerald-600', B: 'from-blue-500 to-blue-600',
    C: 'from-yellow-500 to-amber-600', D: 'from-orange-500 to-orange-600',
    F: 'from-red-500 to-red-600',
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Header with grade */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--muted-light)] uppercase tracking-wider mb-1">AI Session Report</p>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Deep Analysis</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradeColor[analysis.sessionGrade] || gradeColor.C} flex items-center justify-center shadow-lg`}>
              <span className="text-2xl font-black text-[var(--foreground)]">{analysis.sessionGrade}</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--foreground)]">{analysis.overallScore}</p>
              <p className="text-[10px] text-[var(--muted-light)]">/ 100</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--foreground)]/80 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Score breakdown */}
      <Section title="Performance Scores" icon="📊">
        <div className="space-y-3">
          <ScoreBar label="Engagement" score={analysis.scores.engagement} color="green" />
          <ScoreBar label="Communication" score={analysis.scores.communication} color="blue" />
          <ScoreBar label="Pedagogy" score={analysis.scores.pedagogy} color="purple" />
          <ScoreBar label="Rapport" score={analysis.scores.rapport} color="amber" />
          <ScoreBar label="Pacing" score={analysis.scores.pacing} color="rose" />
        </div>
      </Section>

      {/* Teaching effectiveness */}
      <Section title={`Teaching Effectiveness (${analysis.teachingEffectiveness.score}/10)`} icon="🎓">
        <TextBlock label="Methodology" text={analysis.teachingEffectiveness.methodology} />
        <TextBlock label="Pedagogy Notes" text={analysis.teachingEffectiveness.pedagogyNotes} />
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div>
            <p className="text-xs text-green-400 font-medium mb-2">Strengths</p>
            <BulletList items={analysis.teachingEffectiveness.strengths} color="green" />
          </div>
          <div>
            <p className="text-xs text-amber-400 font-medium mb-2">Areas to Improve</p>
            <BulletList items={analysis.teachingEffectiveness.improvements} color="amber" />
          </div>
        </div>
      </Section>

      {/* Student engagement deep dive */}
      <Section title={`Student Engagement (${analysis.studentEngagement.score}/10)`} icon="👁">
        <TextBlock label="Overview" text={analysis.studentEngagement.overview} />
        <TextBlock label="Attention Patterns" text={analysis.studentEngagement.attentionPatterns} />
        <TextBlock label="Confusion Analysis" text={analysis.studentEngagement.confusionAnalysis} />
        <TextBlock label="Emotional Journey" text={analysis.studentEngagement.emotionalJourney} />
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div>
            <p className="text-xs text-green-400 font-medium mb-2">Breakthrough Moments</p>
            <BulletList items={analysis.studentEngagement.breakthroughMoments} color="green" />
          </div>
          <div>
            <p className="text-xs text-red-400 font-medium mb-2">Struggling Moments</p>
            <BulletList items={analysis.studentEngagement.strugglingMoments} color="red" />
          </div>
        </div>
      </Section>

      {/* Communication */}
      <Section title="Communication Analysis" icon="💬">
        <TextBlock label="Talk Time Assessment" text={analysis.communicationAnalysis.talkTimeAssessment} />
        <TextBlock label="Questioning Quality" text={analysis.communicationAnalysis.questioningQuality} />
        <TextBlock label="Listening Skills" text={analysis.communicationAnalysis.listeningSkills} />
        <TextBlock label="Turn-Taking Dynamics" text={analysis.communicationAnalysis.turnTakingDynamics} />
        <TextBlock label="Interruption Patterns" text={analysis.communicationAnalysis.interruptionPatterns} />
      </Section>

      {/* Eye contact + Energy side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Eye Contact" icon="👀">
          <TextBlock label="Tutor" text={analysis.eyeContactAnalysis.tutorAssessment} />
          <TextBlock label="Student" text={analysis.eyeContactAnalysis.studentAssessment} />
          <TextBlock label="Connection" text={analysis.eyeContactAnalysis.connectionQuality} />
        </Section>
        <Section title="Energy & Pacing" icon="⚡">
          <TextBlock text={analysis.energyAnalysis.overview} />
          <TextBlock label="Pace" text={analysis.energyAnalysis.paceRecommendation} />
          <TextBlock label="Best Moments" text={analysis.energyAnalysis.optimalMoments} />
          {analysis.energyAnalysis.fatigueDetected && (
            <p className="text-xs text-amber-400 mt-2">Fatigue was detected during this session</p>
          )}
        </Section>
      </div>

      {/* Session highlights */}
      <Section title="Session Highlights" icon="✨">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--accent-subtle)] rounded-lg p-3">
            <p className="text-[10px] text-green-400 uppercase mb-1">Best Moment</p>
            <p className="text-xs text-[var(--foreground)]/80">{analysis.sessionHighlights.bestMoment}</p>
          </div>
          <div className="bg-[var(--accent-subtle)] rounded-lg p-3">
            <p className="text-[10px] text-red-400 uppercase mb-1">Biggest Challenge</p>
            <p className="text-xs text-[var(--foreground)]/80">{analysis.sessionHighlights.biggestChallenge}</p>
          </div>
          <div className="bg-[var(--accent-subtle)] rounded-lg p-3">
            <p className="text-[10px] text-blue-400 uppercase mb-1">Most Improved</p>
            <p className="text-xs text-[var(--foreground)]/80">{analysis.sessionHighlights.mostImprovedArea}</p>
          </div>
          <div className="bg-[var(--accent-subtle)] rounded-lg p-3">
            <p className="text-[10px] text-purple-400 uppercase mb-1">Key Takeaway</p>
            <p className="text-xs text-[var(--foreground)]/80">{analysis.sessionHighlights.keyTakeaway}</p>
          </div>
        </div>
      </Section>

      {/* Action plan */}
      <Section title="Action Plan" icon="🎯">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-red-400 font-medium mb-2">Do Now</p>
            <BulletList items={analysis.actionPlan.immediate} color="red" />
          </div>
          <div>
            <p className="text-xs text-amber-400 font-medium mb-2">Next Session</p>
            <BulletList items={analysis.actionPlan.nextSession} color="amber" />
          </div>
          <div>
            <p className="text-xs text-blue-400 font-medium mb-2">This Week</p>
            <BulletList items={analysis.actionPlan.weeklyGoals} color="blue" />
          </div>
          <div>
            <p className="text-xs text-purple-400 font-medium mb-2">Long Term</p>
            <BulletList items={analysis.actionPlan.longTerm} color="purple" />
          </div>
        </div>
      </Section>

      {/* Detailed narrative */}
      <Section title="Detailed Coaching Feedback" icon="📝">
        <div className="text-sm text-[var(--foreground)]/80 leading-relaxed whitespace-pre-line">
          {analysis.detailedNarrative}
        </div>
      </Section>

      {/* Re-analyze button */}
      <button
        onClick={runAnalysis}
        disabled={loading}
        className="w-full py-2 bg-[var(--card-hover)] hover:bg-[var(--card-border)] text-[var(--muted)] text-xs rounded-lg transition-colors"
      >
        {loading ? 'Re-analyzing...' : 'Re-analyze Session'}
      </button>
    </div>
  );
}
