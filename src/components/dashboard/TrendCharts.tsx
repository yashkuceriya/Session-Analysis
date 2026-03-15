/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import { SessionSummary } from '@/lib/reports/SessionSummarizer';
import styles from './TrendCharts.module.css';

interface TrendChartsProps {
  sessions: SessionSummary[];
}

export function TrendCharts({ sessions }: TrendChartsProps) {
  if (sessions.length === 0) {
    return <div className={styles.empty}>No session data available</div>;
  }

  const lastTenSessions = sessions.slice(-10);

  return (
    <div className={styles.container}>
      <div className={styles.chartGroup}>
        <h3>Engagement Trend (Last 10 Sessions)</h3>
        <EngagementTrendChart sessions={lastTenSessions} />
      </div>

      <div className={styles.chartGroup}>
        <h3>Session Duration</h3>
        <DurationChart sessions={lastTenSessions} />
      </div>

      <div className={styles.chartGroup}>
        <h3>Student State Distribution (Average)</h3>
        <StateDistributionChart sessions={lastTenSessions} />
      </div>
    </div>
  );
}

function EngagementTrendChart({ sessions }: { sessions: SessionSummary[] }) {
  const width = 300;
  const height = 150;
  const padding = 20;
  const graphWidth = width - 2 * padding;
  const graphHeight = height - 2 * padding;

  const engagementScores = sessions.map((s) => s.overallEngagement);
  const maxEngagement = 100;
  const minEngagement = 0;

  const points = engagementScores.map((score, i) => {
    const x = padding + (i / (engagementScores.length - 1 || 1)) * graphWidth;
    const y = height - padding - (score / (maxEngagement - minEngagement)) * graphHeight;
    return { x, y, score };
  });

  const pathData = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');

  return (
    <svg width={width} height={height} className={styles.svg}>
      <defs>
        <linearGradient id="engagementGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 0.3 }} />
          <stop offset="100%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[25, 50, 75].map((value) => (
        <line
          key={value}
          x1={padding}
          y1={height - padding - (value / 100) * graphHeight}
          x2={width - padding}
          y2={height - padding - (value / 100) * graphHeight}
          stroke="rgb(60, 60, 60)"
          strokeWidth="1"
          strokeDasharray="4"
        />
      ))}

      {/* Path with fill */}
      {points.length > 1 && (
        <>
          <path d={pathData} stroke="rgb(59, 130, 246)" strokeWidth="2" fill="none" />
          <path
            d={`${pathData} L${points[points.length - 1].x},${height - padding} L${points[0].x},${
              height - padding
            } Z`}
            fill="url(#engagementGradient)"
          />
        </>
      )}

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="rgb(59, 130, 246)"
          className={styles.dataPoint}
        >
          <title>{Math.round(p.score)}%</title>
        </circle>
      ))}

      {/* Axes */}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgb(100, 100, 100)" strokeWidth="1" />
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="rgb(100, 100, 100)"
        strokeWidth="1"
      />

      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map((value) => (
        <text
          key={`y-${value}`}
          x={padding - 8}
          y={height - padding - (value / 100) * graphHeight + 4}
          fontSize="10"
          fill="rgb(150, 150, 150)"
          textAnchor="end"
        >
          {value}
        </text>
      ))}
    </svg>
  );
}

function DurationChart({ sessions }: { sessions: SessionSummary[] }) {
  const width = 300;
  const height = 150;
  const padding = 20;
  const graphWidth = width - 2 * padding;
  const graphHeight = height - 2 * padding;

  const durations = sessions.map((s) => s.duration / 60000); // Convert to minutes
  const maxDuration = Math.max(...durations, 30);
  const barWidth = graphWidth / durations.length;

  return (
    <svg width={width} height={height} className={styles.svg}>
      {durations.map((duration, i) => {
        const barHeight = (duration / maxDuration) * graphHeight;
        const x = padding + i * barWidth + barWidth * 0.1;
        const y = height - padding - barHeight;
        const displayDuration = Math.round(duration);

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth * 0.8}
              height={barHeight}
              fill="rgb(34, 197, 94)"
              rx="2"
              className={styles.bar}
            >
              <title>{displayDuration} min</title>
            </rect>
            <text
              x={x + barWidth * 0.4}
              y={height - padding + 12}
              fontSize="9"
              fill="rgb(150, 150, 150)"
              textAnchor="middle"
            >
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* Y-axis */}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgb(100, 100, 100)" strokeWidth="1" />
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="rgb(100, 100, 100)"
        strokeWidth="1"
      />

      {/* Y-axis label */}
      <text x={10} y={padding + 10} fontSize="10" fill="rgb(150, 150, 150)">
        min
      </text>
    </svg>
  );
}

function StateDistributionChart({ sessions }: { sessions: SessionSummary[] }) {
  const width = 300;
  const height = 150;

  // Calculate average state distribution
  const avgStates = {
    engaged: 0,
    passive: 0,
    confused: 0,
    drifting: 0,
    struggling: 0,
  };

  sessions.forEach((session) => {
    Object.keys(avgStates).forEach((state) => {
      avgStates[state as keyof typeof avgStates] += session.studentStateBreakdown[state as keyof typeof avgStates] || 0;
    });
  });

  Object.keys(avgStates).forEach((state) => {
    avgStates[state as keyof typeof avgStates] /= sessions.length;
  });

  const states = [
    { label: 'Engaged', value: avgStates.engaged, color: 'rgb(34, 197, 94)' },
    { label: 'Passive', value: avgStates.passive, color: 'rgb(156, 163, 175)' },
    { label: 'Confused', value: avgStates.confused, color: 'rgb(248, 113, 113)' },
    { label: 'Drifting', value: avgStates.drifting, color: 'rgb(251, 146, 60)' },
    { label: 'Struggling', value: avgStates.struggling, color: 'rgb(239, 68, 68)' },
  ];

  const total = states.reduce((sum, s) => sum + s.value, 0) || 100;
  const barHeight = 20;
  const padding = 10;

  const currentX = padding;

  return (
    <svg width={width} height={height} className={styles.svg}>
      {states.map((state) => {
        const barWidth = (state.value / total) * (width - 2 * padding);
        const label = `${state.label}: ${Math.round(state.value)}%`;

        return (
          <g key={state.label}>
            <rect x={currentX} y={padding} width={barWidth} height={barHeight} fill={state.color} rx="2">
              <title>{label}</title>
            </rect>
            {barWidth > 35 && (
              <text
                x={currentX + barWidth / 2}
                y={padding + barHeight / 2 + 4}
                fontSize="11"
                fill="white"
                textAnchor="middle"
                fontWeight="500"
                pointerEvents="none"
              >
                {Math.round(state.value)}%
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      {states.map((state, i) => (
        <g key={`legend-${state.label}`}>
          <rect
            x={padding}
            y={padding + barHeight + 10 + i * 18}
            width={12}
            height={12}
            fill={state.color}
            rx="1"
          />
          <text
            x={padding + 18}
            y={padding + barHeight + 10 + i * 18 + 10}
            fontSize="11"
            fill="rgb(150, 150, 150)"
          >
            {state.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
