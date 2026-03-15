'use client';

import { MetricSnapshot } from '@/lib/metrics-engine/types';

interface FacialExpressionCardProps {
  metricsHistory: MetricSnapshot[];
  participant: 'tutor' | 'student';
  participantName: string;
}

interface ExpressionMetrics {
  smile: number;
  concentration: number;
  confusion: number;
  surprise: number;
  valence: number;
  browFurrow: number;
  headNod: number;
  headShake: number;
  headTilt: number;
}

interface HeadMovementMetrics {
  nodFrequency: number;
  shakeFrequency: number;
  tiltAverage: number;
}

function extractExpressionData(
  metricsHistory: MetricSnapshot[],
  participant: 'tutor' | 'student'
): { expressions: ExpressionMetrics | null; headMovement: HeadMovementMetrics } {
  const expressionKey = participant === 'tutor' ? 'tutorExpression' : 'studentExpression';

  // Filter valid expression snapshots
  const validSnapshots = metricsHistory.filter(
    (snapshot) => snapshot[expressionKey] !== null
  );

  if (validSnapshots.length === 0) {
    return {
      expressions: null,
      headMovement: {
        nodFrequency: 0,
        shakeFrequency: 0,
        tiltAverage: 0,
      },
    };
  }

  const expressions = validSnapshots.map((s) => s[expressionKey]!);

  // Compute averages
  const avgExpression: ExpressionMetrics = {
    smile: 0,
    concentration: 0,
    confusion: 0,
    surprise: 0,
    valence: 0,
    browFurrow: 0,
    headNod: 0,
    headShake: 0,
    headTilt: 0,
  };

  expressions.forEach((expr) => {
    avgExpression.smile += expr.smile;
    avgExpression.concentration += expr.concentration;
    avgExpression.confusion += expr.confusion;
    avgExpression.surprise += expr.surprise;
    avgExpression.valence += expr.valence;
    avgExpression.browFurrow += expr.browFurrow;
    avgExpression.headNod += expr.headNod;
    avgExpression.headShake += expr.headShake;
    avgExpression.headTilt += expr.headTilt;
  });

  const n = expressions.length;
  avgExpression.smile = Math.round((avgExpression.smile / n) * 100);
  avgExpression.concentration = Math.round((avgExpression.concentration / n) * 100);
  avgExpression.confusion = Math.round((avgExpression.confusion / n) * 100);
  avgExpression.surprise = Math.round((avgExpression.surprise / n) * 100);
  avgExpression.valence = Math.round((avgExpression.valence / n) * 100);
  avgExpression.browFurrow = Math.round((avgExpression.browFurrow / n) * 100);
  avgExpression.headNod = Math.round((avgExpression.headNod / n) * 100);
  avgExpression.headShake = Math.round((avgExpression.headShake / n) * 100);
  avgExpression.headTilt = Math.round(
    Math.abs((avgExpression.headTilt / n)) * 100
  );

  // Head movement frequencies (count transitions or magnitude)
  let nodCount = 0;
  let shakeCount = 0;

  expressions.forEach((expr) => {
    if (expr.headNod > 0.3) nodCount++;
    if (expr.headShake > 0.3) shakeCount++;
  });

  const headMovement: HeadMovementMetrics = {
    nodFrequency: Math.round((nodCount / n) * 100),
    shakeFrequency: Math.round((shakeCount / n) * 100),
    tiltAverage: Math.round(
      Math.abs(expressions.reduce((sum, e) => sum + e.headTilt, 0) / n) * 100
    ),
  };

  return {
    expressions: avgExpression,
    headMovement,
  };
}

function getFrequencyDescriptor(percentage: number): string {
  if (percentage > 60) return 'frequent';
  if (percentage > 30) return 'moderate';
  if (percentage > 10) return 'occasional';
  return 'rare';
}

function getBarColor(
  metric: string,
  isPositive: boolean
): string {
  if (metric === 'confusion' || metric === 'browFurrow') {
    return 'bg-orange-500';
  }
  if (metric === 'surprise' || metric === 'energy') {
    return 'bg-blue-500';
  }
  if (isPositive) {
    return 'bg-green-500';
  }
  return 'bg-blue-500';
}

function getExpressionLabel(key: string): string {
  const labels: Record<string, string> = {
    smile: 'Smiling',
    concentration: 'Deep Focus',
    confusion: 'Confused',
    surprise: 'Surprised',
    valence: 'Positive Mood',
    browFurrow: 'Brow Tension',
  };
  return labels[key] || key;
}

function getExpressionDescription(key: string, percentage: number): string {
  const positiveMetrics = ['smile', 'concentration', 'valence'];
  const isPositive = positiveMetrics.includes(key);

  if (key === 'confusion') {
    return `${getFrequencyDescriptor(percentage)} confusion detected`;
  }
  if (key === 'browFurrow') {
    return `${getFrequencyDescriptor(percentage)} tension`;
  }
  if (key === 'surprise') {
    return `${getFrequencyDescriptor(percentage)} surprise`;
  }
  if (key === 'smile') {
    if (percentage > 60) return 'indicates positive mood';
    if (percentage > 30) return 'shows some positivity';
    return 'limited positive expression';
  }
  if (key === 'concentration') {
    if (percentage > 70) return 'deeply engaged';
    if (percentage > 50) return 'moderately focused';
    return 'limited focus';
  }
  if (key === 'valence') {
    if (percentage > 70) return 'very positive emotional state';
    if (percentage > 50) return 'generally positive mood';
    return 'more neutral emotional tone';
  }

  return getFrequencyDescriptor(percentage);
}

function getHeadMovementDescription(metric: string, percentage: number): string {
  if (metric === 'nod') {
    if (percentage > 60) {
      return 'Frequent nodding (strong agreement and affirmation)';
    } else if (percentage > 30) {
      return 'Moderate nodding (general agreement)';
    } else {
      return 'Minimal nodding';
    }
  }

  if (metric === 'shake') {
    if (percentage > 60) {
      return 'Frequent head shaking';
    } else if (percentage > 30) {
      return 'Occasional head shaking';
    } else {
      return 'Minimal head shaking';
    }
  }

  if (metric === 'tilt') {
    if (percentage > 20) {
      return 'Attentive lean (engaged posture)';
    } else {
      return 'Upright posture';
    }
  }

  return '';
}

export function FacialExpressionCard({
  metricsHistory,
  participant,
  participantName,
}: FacialExpressionCardProps) {
  const { expressions, headMovement } = extractExpressionData(
    metricsHistory,
    participant
  );

  if (!expressions) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">
          {participantName} – Facial Expressions
        </h3>
        <p className="text-xs text-[var(--muted-light)]">
          No facial expression data available for {participantName}
        </p>
      </div>
    );
  }

  const expressionMetrics = [
    { key: 'smile' as const, label: 'Smiling' },
    { key: 'concentration' as const, label: 'Deep Focus' },
    { key: 'confusion' as const, label: 'Confused' },
    { key: 'surprise' as const, label: 'Surprised' },
    { key: 'valence' as const, label: 'Positive Mood' },
    { key: 'browFurrow' as const, label: 'Brow Tension' },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">
        {participantName} – Facial Expressions
      </h3>

      {/* Expression metrics bars */}
      <div className="space-y-3 mb-6">
        {expressionMetrics.map(({ key, label }) => {
          const value = expressions[key];
          const descriptor = getFrequencyDescriptor(value);
          const barColor = getBarColor(
            key,
            ['smile', 'concentration', 'valence'].includes(key)
          );

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
                <span className="text-xs text-[var(--muted)]">{value}%</span>
              </div>
              <div className="w-full bg-[var(--card-hover)] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all duration-300`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted-light)] mt-1">
                {getExpressionDescription(key, value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Head Movement Section */}
      <div className="border-t border-[var(--card-border)] pt-4">
        <h4 className="text-xs font-medium text-[var(--foreground)] mb-3">Head Movement</h4>
        <div className="space-y-2">
          {/* Nod frequency */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-[var(--foreground)] font-medium mb-1">Nodding</p>
              <p className="text-xs text-[var(--muted-light)]">
                {getHeadMovementDescription('nod', headMovement.nodFrequency)}
              </p>
            </div>
            <span className="text-xs text-[var(--muted)] ml-2 whitespace-nowrap">
              {headMovement.nodFrequency}%
            </span>
          </div>

          {/* Shake frequency */}
          <div className="flex items-start justify-between border-t border-[var(--card-border)] pt-2">
            <div className="flex-1">
              <p className="text-xs text-[var(--foreground)] font-medium mb-1">Head Shaking</p>
              <p className="text-xs text-[var(--muted-light)]">
                {getHeadMovementDescription('shake', headMovement.shakeFrequency)}
              </p>
            </div>
            <span className="text-xs text-[var(--muted)] ml-2 whitespace-nowrap">
              {headMovement.shakeFrequency}%
            </span>
          </div>

          {/* Head tilt */}
          <div className="flex items-start justify-between border-t border-[var(--card-border)] pt-2">
            <div className="flex-1">
              <p className="text-xs text-[var(--foreground)] font-medium mb-1">Head Tilt</p>
              <p className="text-xs text-[var(--muted-light)]">
                {getHeadMovementDescription('tilt', headMovement.tiltAverage)}
              </p>
            </div>
            <span className="text-xs text-[var(--muted)] ml-2 whitespace-nowrap">
              {headMovement.tiltAverage}°
            </span>
          </div>
        </div>
      </div>

      {/* Responsive note */}
      <p className="text-xs text-[var(--muted-light)] mt-4 italic">
        Analysis based on {metricsHistory.filter(
          (s) => s[participant === 'tutor' ? 'tutorExpression' : 'studentExpression']
        ).length} detected frames
      </p>
    </div>
  );
}
