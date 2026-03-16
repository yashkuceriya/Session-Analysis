'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { MetricSnapshot } from '@/lib/metrics-engine/types';
import { Nudge } from '@/lib/coaching-system/types';

interface TimelineStripProps {
  metricsHistory: MetricSnapshot[];
  nudgeHistory?: Nudge[];
}

const SEGMENT_DURATION_MS = 10000; // 10 seconds per segment
const TIMELINE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SEGMENTS_COUNT = Math.floor(TIMELINE_DURATION_MS / SEGMENT_DURATION_MS); // 30 segments

export function TimelineStrip({ metricsHistory, nudgeHistory = [] }: TimelineStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; segmentIndex: number; metrics: MetricSnapshot } | null>(null);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);

  // Get the earliest timestamp to calculate time windows
  const [mountTime] = useState(() => Date.now());
  const startTimestamp = useMemo(() => {
    if (metricsHistory.length === 0) return mountTime;
    return metricsHistory[0].timestamp;
  }, [metricsHistory, mountTime]);

  // Create segments with engagement data
  const segments = useMemo(() => {
    const segs = Array.from({ length: SEGMENTS_COUNT }, (_, i) => {
      const segmentStartMs = i * SEGMENT_DURATION_MS;
      const segmentEndMs = segmentStartMs + SEGMENT_DURATION_MS;
      const windowStart = startTimestamp + segmentStartMs;
      const windowEnd = startTimestamp + segmentEndMs;

      // Find metrics in this segment
      const metricsInSegment = metricsHistory.filter(
        (m) => m.timestamp >= windowStart && m.timestamp < windowEnd
      );

      if (metricsInSegment.length === 0) {
        return { engagementScore: null, latestMetric: null, color: 'bg-gray-700/30' };
      }

      const avgEngagement =
        metricsInSegment.reduce((sum, m) => sum + m.engagementScore, 0) / metricsInSegment.length;
      const latestMetric = metricsInSegment[metricsInSegment.length - 1];

      let color: string;
      if (avgEngagement > 70) {
        color = 'bg-green-500/80';
      } else if (avgEngagement >= 40) {
        color = 'bg-yellow-500/80';
      } else {
        color = 'bg-red-500/80';
      }

      return { engagementScore: avgEngagement, latestMetric, color };
    });

    return segs;
  }, [metricsHistory, startTimestamp]);

  // Calculate nudge positions
  const nudgePositions = useMemo(() => {
    return nudgeHistory
      .filter((nudge) => !nudge.dismissed)
      .map((nudge) => {
        const nudgeAgeMs = mountTime - nudge.timestamp;
        if (nudgeAgeMs > TIMELINE_DURATION_MS) return null;
        const relativePos = 1 - nudgeAgeMs / TIMELINE_DURATION_MS;
        const percentPos = relativePos * 100;
        return { nudge, percentPos };
      })
      .filter(Boolean) as { nudge: Nudge; percentPos: number }[];
  }, [nudgeHistory, mountTime]);

  // Handle segment click for tooltip
  const handleSegmentClick = (e: React.MouseEvent, segmentIndex: number) => {
    const segment = segments[segmentIndex];
    if (segment.latestMetric) {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      setTooltip({
        x: rect.left,
        segmentIndex,
        metrics: segment.latestMetric,
      });
    }
  };

  // Auto-scroll to the right as new data comes in
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [segments]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/40 to-black/20 backdrop-blur-sm overflow-x-auto scroll-smooth z-20 border-t border-gray-800/50"
    >
      <div className="relative flex items-center h-full min-w-full px-0.5">
        {/* Segments */}
        <div className="flex items-center h-full gap-0.5 py-1.5">
          {segments.map((segment, idx) => (
            <button
              key={idx}
              onClick={(e) => handleSegmentClick(e, idx)}
              onMouseEnter={() => setHoveredSegmentIndex(idx)}
              onMouseLeave={() => setHoveredSegmentIndex(null)}
              className={`flex-1 h-1 min-w-[4px] rounded-full transition-all duration-200 hover:h-2.5 hover:-translate-y-1 cursor-pointer ${segment.color} opacity-90 hover:opacity-100`}
              title={
                segment.engagementScore !== null ? `Engagement: ${Math.round(segment.engagementScore)}` : 'No data'
              }
            />
          ))}
        </div>

        {/* Current time indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/50 pointer-events-none shadow-lg" />

        {/* Nudge markers */}
        {nudgePositions.map(({ nudge, percentPos }, idx) => (
          <div
            key={`nudge-${idx}`}
            className="absolute top-0 flex items-start justify-center pointer-events-none"
            style={{ left: `${percentPos}%` }}
          >
            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full shadow-md ring-1 ring-orange-500/40 transform -translate-y-1.5" title={nudge.message} />
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && hoveredSegmentIndex === tooltip.segmentIndex && (
        <div
          className="fixed bg-gray-950/95 border border-gray-700/60 rounded-lg px-3 py-2 text-xs text-white shadow-xl z-50 whitespace-nowrap pointer-events-none backdrop-blur-md"
          style={{
            left: `${tooltip.x}px`,
            bottom: '32px',
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-mono text-gray-400 text-[10px] mb-1">
            {new Date(tooltip.metrics.timestamp).toLocaleTimeString()}
          </p>
          <p className="mb-0.5">Engagement: <span className="font-semibold text-blue-300">{Math.round(tooltip.metrics.engagementScore)}</span></p>
          <p>State: <span className="font-semibold text-purple-300 capitalize">{tooltip.metrics.studentState}</span></p>
          <div className="absolute -bottom-1.5 left-1/2 w-2.5 h-2.5 bg-gray-950/95 transform -translate-x-1/2 rotate-45 border-r border-b border-gray-700/60" />
        </div>
      )}
    </div>
  );
}
