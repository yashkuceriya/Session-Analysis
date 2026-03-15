'use client';

import { useState } from 'react';

interface AIAnalysisData {
  summary: string;
  teachingEffectiveness: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
  studentEngagement: {
    overview: string;
    confusionMoments: string[];
    breakthroughMoments: string[];
  };
  actionPlan: {
    immediate: string[];
    nextSession: string[];
    longTerm: string[];
  };
  sessionGrade: string;
  detailedFeedback: string;
}

interface AIAnalysisProps {
  sessionId: string;
}

export function AIAnalysis({ sessionId }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AIAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/analyze`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze session');
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">AI Coaching Analysis</h3>
          <span className="text-[10px] text-gray-600">Powered by Claude</span>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <button
          onClick={runAnalysis}
          disabled={loading}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
            loading
              ? 'bg-gray-700 text-gray-400 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {loading ? 'Analyzing session...' : 'Get AI Coaching Feedback'}
        </button>
        <p className="text-[10px] text-gray-600 mt-2 text-center">
          Sends engagement metrics to Claude for personalized teaching feedback
        </p>
      </div>
    );
  }

  const gradeColor: Record<string, string> = {
    A: 'text-green-400', B: 'text-blue-400', C: 'text-yellow-400', D: 'text-orange-400', F: 'text-red-400',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">AI Coaching Analysis</h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${gradeColor[analysis.sessionGrade] || 'text-gray-400'}`}>
            {analysis.sessionGrade}
          </span>
          <span className="text-xs text-gray-500">
            {analysis.teachingEffectiveness.score}/10
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>

      {/* Strengths & Improvements */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-green-400 font-medium mb-2">Strengths</p>
          <ul className="space-y-1">
            {analysis.teachingEffectiveness.strengths.map((s, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                <span className="text-green-500 flex-shrink-0">+</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-yellow-400 font-medium mb-2">Areas to Improve</p>
          <ul className="space-y-1">
            {analysis.teachingEffectiveness.improvements.map((s, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                <span className="text-yellow-500 flex-shrink-0">-</span> {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Student Engagement */}
      <div>
        <p className="text-xs text-blue-400 font-medium mb-1">Student Engagement</p>
        <p className="text-xs text-gray-400">{analysis.studentEngagement.overview}</p>
      </div>

      {/* Action Plan */}
      <div>
        <p className="text-xs text-purple-400 font-medium mb-2">Action Plan</p>
        <div className="space-y-2">
          {analysis.actionPlan.immediate.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Do Now</p>
              {analysis.actionPlan.immediate.map((a, i) => (
                <p key={i} className="text-xs text-gray-400 ml-2">- {a}</p>
              ))}
            </div>
          )}
          {analysis.actionPlan.nextSession.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Next Session</p>
              {analysis.actionPlan.nextSession.map((a, i) => (
                <p key={i} className="text-xs text-gray-400 ml-2">- {a}</p>
              ))}
            </div>
          )}
          {analysis.actionPlan.longTerm.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Long Term</p>
              {analysis.actionPlan.longTerm.map((a, i) => (
                <p key={i} className="text-xs text-gray-400 ml-2">- {a}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Feedback */}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-1">Detailed Feedback</p>
        <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">
          {analysis.detailedFeedback}
        </p>
      </div>

      <button
        onClick={runAnalysis}
        className="w-full py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
      >
        Re-analyze
      </button>
    </div>
  );
}
