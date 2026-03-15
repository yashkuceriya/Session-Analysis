/**
 * AdaptiveQuality.ts
 * Bandwidth-aware video encoding adaptation
 * Monitors RTCPeerConnection stats and adjusts encoding parameters dynamically
 */

type QualityTier = 'high' | 'medium' | 'low' | 'audio-only';

interface QualityPreset {
  tier: QualityTier;
  width: number;
  height: number;
  bitrate: number; // kbps
  fps: number;
  minBandwidth: number; // kbps
  maxBandwidth: number; // kbps
}

const QUALITY_PRESETS: QualityPreset[] = [
  {
    tier: 'high',
    width: 1280,
    height: 720,
    bitrate: 2500,
    fps: 30,
    minBandwidth: 2000,
    maxBandwidth: Infinity,
  },
  {
    tier: 'medium',
    width: 640,
    height: 480,
    bitrate: 1000,
    fps: 24,
    minBandwidth: 500,
    maxBandwidth: 2000,
  },
  {
    tier: 'low',
    width: 320,
    height: 240,
    bitrate: 300,
    fps: 15,
    minBandwidth: 100,
    maxBandwidth: 500,
  },
  {
    tier: 'audio-only',
    width: 0,
    height: 0,
    bitrate: 0,
    fps: 0,
    minBandwidth: 0,
    maxBandwidth: 100,
  },
];

const STATS_INTERVAL = 2000; // 2 seconds
const EMA_ALPHA = 0.2; // Exponential moving average smoothing factor

export class AdaptiveQualityManager {
  private peerConnection: RTCPeerConnection;
  private statsIntervalId: NodeJS.Timeout | null = null;
  private estimatedBandwidth: number = 0;
  private currentQuality: QualityTier = 'medium';
  private qualityChangeCallbacks: ((quality: QualityTier) => void)[] = [];
  private videoSenders: RTCRtpSender[] = [];

  constructor(peerConnection: RTCPeerConnection) {
    this.peerConnection = peerConnection;
    this.initializeVideoSenders();
  }

  private initializeVideoSenders(): void {
    this.videoSenders = this.peerConnection
      .getSenders()
      .filter((sender) => sender.track?.kind === 'video');
  }

  start(): void {
    if (this.statsIntervalId) {
      return; // Already running
    }

    this.statsIntervalId = setInterval(() => {
      this.updateStats();
    }, STATS_INTERVAL);

    // Initial stats update
    this.updateStats();
  }

  stop(): void {
    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const stats = await this.peerConnection.getStats();
      this.processBandwidthStats(stats);
      this.adjustQuality();
    } catch (error) {
      console.error('Error updating adaptive quality stats:', error);
    }
  }

  private processBandwidthStats(stats: RTCStatsReport): void {
    let totalBytesSent = 0;
    let totalBytesReceived = 0;
    let timestampMs = 0;

    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        totalBytesReceived = (report as any).bytesReceived || 0;
        timestampMs = report.timestamp;
      }
      if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
        totalBytesSent = (report as any).bytesSent || 0;
        timestampMs = report.timestamp;
      }
    });

    // Calculate bandwidth estimate from bytes sent/received
    // Using a simple heuristic based on outbound stats
    const bandwidth = this.estimateBandwidth(stats);

    // Apply exponential moving average for smoothing
    if (this.estimatedBandwidth === 0) {
      this.estimatedBandwidth = bandwidth;
    } else {
      this.estimatedBandwidth =
        EMA_ALPHA * bandwidth + (1 - EMA_ALPHA) * this.estimatedBandwidth;
    }
  }

  private estimateBandwidth(stats: RTCStatsReport): number {
    let maxBandwidth = 0;

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && (report as any).state === 'succeeded') {
        const availableOutgoingBitrate = (report as any).availableOutgoingBitrate;
        if (availableOutgoingBitrate) {
          maxBandwidth = Math.max(maxBandwidth, availableOutgoingBitrate / 1000); // Convert to kbps
        }
      }

      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        const bytesReceived = (report as any).bytesReceived || 0;
        const timestamp = report.timestamp || 0;
        // Rough bandwidth estimate from bitrate
        if (bytesReceived > 0) {
          const estimatedBitrate = (bytesReceived * 8) / (timestamp / 1000); // bits per second
          maxBandwidth = Math.max(maxBandwidth, estimatedBitrate / 1000); // Convert to kbps
        }
      }
    });

    return maxBandwidth || this.estimatedBandwidth;
  }

  private adjustQuality(): void {
    const newQuality = this.selectQualityTier(this.estimatedBandwidth);

    if (newQuality !== this.currentQuality) {
      this.currentQuality = newQuality;
      this.applyQualityPreset(newQuality);
      this.notifyQualityChange(newQuality);
    }
  }

  private selectQualityTier(bandwidth: number): QualityTier {
    for (const preset of QUALITY_PRESETS) {
      if (
        bandwidth >= preset.minBandwidth &&
        bandwidth < preset.maxBandwidth
      ) {
        return preset.tier;
      }
    }
    return 'audio-only';
  }

  private applyQualityPreset(quality: QualityTier): void {
    const preset = QUALITY_PRESETS.find((p) => p.tier === quality);
    if (!preset) return;

    this.videoSenders.forEach(async (sender) => {
      if (!sender.track) return;

      try {
        const params = sender.getParameters();

        if (quality === 'audio-only') {
          // Disable video track
          if (sender.track.enabled) {
            sender.track.enabled = false;
          }
        } else {
          // Enable video track and update encoding
          if (!sender.track.enabled) {
            sender.track.enabled = true;
          }

          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0] = {
              ...params.encodings[0],
              maxBitrate: preset.bitrate * 1000, // Convert kbps to bps
              maxFramerate: preset.fps,
              scaleResolutionDownBy: preset.width > 0 ?
                1280 / preset.width : undefined,
            };

            await sender.setParameters(params);
          }
        }
      } catch (error) {
        console.error('Error applying quality preset:', error);
      }
    });
  }

  getCurrentQuality(): QualityTier {
    return this.currentQuality;
  }

  getBandwidthEstimate(): number {
    return Math.round(this.estimatedBandwidth);
  }

  onQualityChange(callback: (quality: QualityTier) => void): void {
    this.qualityChangeCallbacks.push(callback);
  }

  private notifyQualityChange(quality: QualityTier): void {
    this.qualityChangeCallbacks.forEach((callback) => {
      try {
        callback(quality);
      } catch (error) {
        console.error('Error in quality change callback:', error);
      }
    });
  }

  destroy(): void {
    this.stop();
    this.qualityChangeCallbacks = [];
    this.videoSenders = [];
  }
}
