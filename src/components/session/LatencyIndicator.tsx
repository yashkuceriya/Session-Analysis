'use client';

import { useSessionStore } from '@/stores/sessionStore';
import { useMemo } from 'react';

export function LatencyIndicator() {
  const latency = useSessionStore((s) => s.processingLatencyMs);
  const breakdown = useSessionStore((s) => s.latencyBreakdown);
  const latencyHistory = useSessionStore((s) => s.latencyHistory);

  const stats = useMemo(() => {
    if (latencyHistory.length < 5) return null;
    const sorted = [...latencyHistory].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }, [latencyHistory]);

  const getColor = () => {
    if (latency < 100) return 'text-green-400';
    if (latency < 300) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="group relative">
      <div className={`text-xs font-mono ${getColor()} bg-black/40 px-2 py-1 rounded cursor-help`}>
        {latency.toFixed(0)}ms
      </div>
      {/* Tooltip with breakdown */}
      <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs whitespace-nowrap shadow-xl">
          <p className="text-gray-400 font-medium mb-2">Latency Breakdown</p>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Face Mesh</span>
              <span className="text-white">{breakdown.faceMeshMs.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Audio</span>
              <span className="text-white">{breakdown.audioMs.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Metrics</span>
              <span className="text-white">{breakdown.metricsMs.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Coaching</span>
              <span className="text-white">{breakdown.coachingMs.toFixed(0)}ms</span>
            </div>
            <div className="border-t border-gray-700 mt-1 pt-1 flex justify-between gap-4">
              <span className="text-gray-400">Total</span>
              <span className={getColor()}>{breakdown.totalMs.toFixed(0)}ms</span>
            </div>
          </div>
          {stats && (
            <div className="border-t border-gray-700 mt-2 pt-2 space-y-1 font-mono">
              <p className="text-gray-400 font-medium mb-1">Percentiles</p>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">p50</span>
                <span className="text-white">{stats.p50.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">p95</span>
                <span className={stats.p95 < 300 ? 'text-white' : 'text-yellow-400'}>{stats.p95.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">p99</span>
                <span className={stats.p99 < 500 ? 'text-white' : 'text-red-400'}>{stats.p99.toFixed(0)}ms</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
