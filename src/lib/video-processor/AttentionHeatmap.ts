import { HeatmapSnapshot, Hotspot } from '../analysis/types';

/**
 * Gaze-based attention heatmap
 * Divides screen into grid and accumulates attention over time
 */
export class AttentionHeatmap {
  private gridSize: number = 10; // 10x10 grid
  private grid: number[][];
  private gazePoints: Array<{ x: number; y: number; timestamp: number }> = [];
  private totalGazeCount = 0;
  private offScreenPoints = 0;

  constructor(gridSize: number = 10) {
    this.gridSize = gridSize;
    this.grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
  }

  /**
   * Add a gaze point to the heatmap
   * Coordinates should be normalized (0-1)
   */
  addGazePoint(x: number, y: number, timestamp: number = Date.now()) {
    this.gazePoints.push({ x, y, timestamp });
    this.totalGazeCount++;

    // Check if off-screen
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      this.offScreenPoints++;
      return;
    }

    // Calculate grid cell
    const cellX = Math.floor(x * this.gridSize);
    const cellY = Math.floor(y * this.gridSize);

    const gridX = Math.min(cellX, this.gridSize - 1);
    const gridY = Math.min(cellY, this.gridSize - 1);

    // Add weight with Gaussian blur for smooth visualization
    this.addGaussianBlur(gridX, gridY, 1.0);
  }

  /**
   * Get current heatmap as 2D array
   * Values normalized to 0-1
   */
  getHeatmap(): number[][] {
    if (this.totalGazeCount === 0) {
      return this.grid;
    }

    // Normalize by max value
    let max = 0;
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        max = Math.max(max, this.grid[i][j]);
      }
    }

    if (max === 0) {
      return this.grid;
    }

    // Create normalized copy
    const normalized = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(0));
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        normalized[i][j] = this.grid[i][j] / max;
      }
    }

    return normalized;
  }

  /**
   * Get top attention hotspots
   */
  getHotspots(count: number = 3): Hotspot[] {
    const heatmap = this.getHeatmap();
    const spots: Hotspot[] = [];

    // Find all cells with attention
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        if (heatmap[i][j] > 0.1) {
          spots.push({
            x: (i + 0.5) / this.gridSize,
            y: (j + 0.5) / this.gridSize,
            intensity: heatmap[i][j],
            durationMs: this.estimateDuration(i, j),
          });
        }
      }
    }

    // Sort by intensity and return top N
    spots.sort((a, b) => b.intensity - a.intensity);
    return spots.slice(0, count);
  }

  /**
   * Get percentage of time gaze was off-screen
   */
  getOffScreenTime(windowMs?: number): number {
    if (this.totalGazeCount === 0) return 0;

    let points = this.gazePoints;
    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      points = this.gazePoints.filter(p => p.timestamp > cutoff);
    }

    if (points.length === 0) return 0;

    const offScreen = points.filter(p => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1).length;
    return Math.round((offScreen / points.length) * 100);
  }

  /**
   * Get focused region (highest attention area)
   */
  getFocusedRegion(): { centerX: number; centerY: number; radius: number; confidence: number } | null {
    const hotspots = this.getHotspots(1);
    if (hotspots.length === 0) {
      return null;
    }

    const hotspot = hotspots[0];
    return {
      centerX: hotspot.x,
      centerY: hotspot.y,
      radius: 0.15, // Approximate radius around hotspot
      confidence: hotspot.intensity,
    };
  }

  /**
   * Get gaze distribution summary
   */
  getSummary(): {
    totalPoints: number;
    onScreenPoints: number;
    offScreenPercent: number;
    focusedRegions: number;
    avgIntensity: number;
  } {
    const heatmap = this.getHeatmap();
    const nonZeroCells = heatmap.flat().filter(v => v > 0.05).length;

    let totalIntensity = 0;
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        totalIntensity += heatmap[i][j];
      }
    }

    const avgIntensity = nonZeroCells > 0 ? totalIntensity / nonZeroCells : 0;

    return {
      totalPoints: this.totalGazeCount,
      onScreenPoints: this.totalGazeCount - this.offScreenPoints,
      offScreenPercent: this.getOffScreenTime(),
      focusedRegions: nonZeroCells,
      avgIntensity,
    };
  }

  /**
   * Get heatmap snapshot for specific time window
   */
  getSnapshot(windowMs?: number): HeatmapSnapshot {
    const heatmap = this.getHeatmap();
    const hotspots = this.getHotspots(3);
    const offScreenPercent = this.getOffScreenTime(windowMs);

    return {
      grid: heatmap,
      hotspots,
      offScreenTimePercent: offScreenPercent,
      totalGazePointsCount: this.totalGazeCount,
    };
  }

  /**
   * Reset accumulated data
   */
  reset() {
    this.grid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(0));
    this.gazePoints = [];
    this.totalGazeCount = 0;
    this.offScreenPoints = 0;
  }

  /**
   * Clear old data (older than maxAgeMs)
   */
  clearOldData(maxAgeMs: number = 60000) {
    const cutoff = Date.now() - maxAgeMs;
    this.gazePoints = this.gazePoints.filter(p => p.timestamp > cutoff);

    // Rebuild grid from remaining points
    this.grid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(0));
    this.totalGazeCount = 0;
    this.offScreenPoints = 0;

    for (const point of this.gazePoints) {
      if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        this.offScreenPoints++;
      } else {
        const cellX = Math.floor(point.x * this.gridSize);
        const cellY = Math.floor(point.y * this.gridSize);
        const gridX = Math.min(cellX, this.gridSize - 1);
        const gridY = Math.min(cellY, this.gridSize - 1);
        this.addGaussianBlur(gridX, gridY, 1.0);
      }
      this.totalGazeCount++;
    }
  }

  /**
   * Internal: add Gaussian blur around a point for smooth visualization
   */
  private addGaussianBlur(centerX: number, centerY: number, weight: number, radius: number = 1) {
    const sigma = radius / 2;
    const sigma2 = sigma * sigma * 2;

    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const x = centerX + i;
        const y = centerY + j;

        if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
          const distance2 = i * i + j * j;
          const gaussian = Math.exp(-distance2 / sigma2);
          this.grid[x][y] += weight * gaussian;
        }
      }
    }
  }

  /**
   * Internal: estimate duration spent on a grid cell
   */
  private estimateDuration(cellX: number, cellY: number): number {
    const pointsInCell = this.gazePoints.filter(p => {
      const x = Math.floor(p.x * this.gridSize);
      const y = Math.floor(p.y * this.gridSize);
      return x === cellX && y === cellY;
    });

    if (pointsInCell.length === 0) return 0;
    if (pointsInCell.length === 1) return 100; // At least 100ms

    const firstTime = pointsInCell[0].timestamp;
    const lastTime = pointsInCell[pointsInCell.length - 1].timestamp;
    return lastTime - firstTime;
  }
}
