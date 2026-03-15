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
      className="absolute bottom-0 left-0 right-0 h-8 bg-black/30 backdrop-blur-sm overflow-x-auto scroll-smooth z-20"
    >
      <div className="relative flex items-center h-full min-w-full">
        {/* Segments */}
        <div className="flex items-center h-full gap-px px-1 flex-1">
          {segments.map((segment, idx) => (
            <button
              key={idx}
              onClick={(e) => handleSegmentClick(e, idx)}
              onMouseEnter={() => setHoveredSegmentIndex(idx)}
              onMouseLeave={() => setHoveredSegmentIndex(null)}
              className={`flex-1 h-2 min-w-[6px] rounded-sm transition-all duration-200 hover:h-4 cursor-pointer ${segment.color}`}
              title={
                segment.engagementScore !== null ? `Engagement: ${Math.round(segment.engagementScore)}` : 'No data'
              }
            />
          ))}
        </div>

        {/* Current time indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/60 pointer-events-none" />

        {/* Nudge markers */}
        {nudgePositions.map(({ nudge, percentPos }, idx) => (
          <div
            key={`nudge-${idx}`}
            className="absolute top-0 flex items-start justify-center pointer-events-none"
            style={{ left: `${percentPos}%` }}
          >
            <div className="w-1 h-2 bg-orange-400 rounded-b-sm" />
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && hoveredSegmentIndex === tooltip.segmentIndex && (
        <div
          className="fixed bg-gray-900/95 border border-gray-700 rounded-lg p-2 text-xs text-white shadow-xl z-50 whitespace-nowrap pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            bottom: '48px',
          }}
        >
          <p className="font-mono text-gray-400 text-[10px]">
            {new Date(tooltip.metrics.timestamp).toLocaleTimeString()}
          </p>
          <p>Engagement: <span className="font-semibold">{Math.round(tooltip.metrics.engagementScore)}</span></p>
          <p>State: <span className="font-semibold">{tooltip.metrics.studentState}</span></p>
        </div>
      )}
    </div>
  );
}
