import { MetricSnapshot } from '../metrics-engine/types';
import { SessionSummary } from './SessionSummarizer';

export interface TimelineEntry {
  timestamp: number;
  engagementScore: number;
  studentState: string;
  tutorTalkPercent: number;
  studentTalkPercent: number;
}

export interface ChartData {
  engagementOverTime: Array<{ x: number; y: number }>;
  stateDistribution: Record<string, number>;
  talkTimeChart: Array<{ label: string; value: number }>;
}

export interface SessionReport {
  metadata: {
    sessionId: string;
    date: number;
    duration: number;
    subject: string;
    sessionType: string;
    studentName: string;
    tutorName: string;
  };
  summary: SessionSummary;
  timeline: TimelineEntry[];
  charts: ChartData;
}

export class ReportGenerator {
  generateReport(summary: SessionSummary, metricsHistory: MetricSnapshot[], sessionId: string, subject: string, sessionType: string, studentName: string, tutorName: string): SessionReport {
    const timeline = this.generateTimeline(metricsHistory);
    const charts = this.generateCharts(metricsHistory, summary);

    const metadata = {
      sessionId,
      date: metricsHistory.length > 0 ? metricsHistory[0].timestamp : Date.now(),
      duration: summary.duration,
      subject,
      sessionType,
      studentName,
      tutorName,
    };

    return {
      metadata,
      summary,
      timeline,
      charts,
    };
  }

  private generateTimeline(metricsHistory: MetricSnapshot[]): TimelineEntry[] {
    if (metricsHistory.length === 0) return [];

    // Generate entries every 30 seconds (adjust based on metric frequency)
    const intervalMs = 30000;
    const timeline: TimelineEntry[] = [];

    let lastTimestamp = metricsHistory[0].timestamp;
    for (let i = 0; i < metricsHistory.length; i++) {
      const metric = metricsHistory[i];

      if (metric.timestamp - lastTimestamp >= intervalMs || i === metricsHistory.length - 1) {
        timeline.push({
          timestamp: metric.timestamp,
          engagementScore: metric.engagementScore,
          studentState: metric.studentState,
          tutorTalkPercent: metric.tutor.talkTimePercent * 100,
          studentTalkPercent: metric.student.talkTimePercent * 100,
        });
        lastTimestamp = metric.timestamp;
      }
    }

    return timeline;
  }

  private generateCharts(metricsHistory: MetricSnapshot[], summary: SessionSummary): ChartData {
    // Engagement over time
    const engagementOverTime = metricsHistory.map((metric, index) => ({
      x: index,
      y: metric.engagementScore,
    }));

    // State distribution from summary
    const stateDistribution = summary.studentStateBreakdown;

    // Talk time chart
    const talkTimeChart = [
      { label: 'Tutor', value: Math.round(summary.talkTimeRatio.tutor * 100) },
      { label: 'Student', value: Math.round(summary.talkTimeRatio.student * 100) },
    ];

    return {
      engagementOverTime,
      stateDistribution,
      talkTimeChart,
    };
  }

  exportToJSON(report: SessionReport): string {
    return JSON.stringify(report, null, 2);
  }

  exportToCSV(history: MetricSnapshot[]): string {
    if (history.length === 0) return '';

    const headers = [
      'timestamp',
      'engagementScore',
      'studentState',
      'tutorEyeContact',
      'studentEyeContact',
      'tutorTalkPercent',
      'studentTalkPercent',
      'tutorEnergy',
      'studentEnergy',
      'interruptionCount',
      'silenceDuration',
    ];

    const rows = history.map((metric) => [
      metric.timestamp,
      metric.engagementScore.toFixed(2),
      metric.studentState,
      metric.tutor.eyeContactScore.toFixed(2),
      metric.student.eyeContactScore.toFixed(2),
      (metric.tutor.talkTimePercent * 100).toFixed(2),
      (metric.student.talkTimePercent * 100).toFixed(2),
      metric.tutor.energyScore.toFixed(2),
      metric.student.energyScore.toFixed(2),
      metric.session.interruptionCount,
      metric.session.silenceDurationCurrent,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return csvContent;
  }

  downloadJSON(report: SessionReport, filename?: string): void {
    const json = this.exportToJSON(report);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `report-${report.metadata.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadCSV(history: MetricSnapshot[], filename?: string): void {
    const csv = this.exportToCSV(history);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `metrics-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
