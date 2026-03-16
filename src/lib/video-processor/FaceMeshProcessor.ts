/* eslint-disable @typescript-eslint/no-explicit-any */
import { FaceFrame, BlendshapeMap } from './types';

let FaceLandmarkerClass: any = null;
let FilesetResolverClass: any = null;

async function loadMediaPipe() {
  if (FaceLandmarkerClass) return;
  const vision = await import('@mediapipe/tasks-vision');
  FaceLandmarkerClass = vision.FaceLandmarker;
  FilesetResolverClass = vision.FilesetResolver;
}

export class FaceMeshProcessor {
  private landmarker: any = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private consecutiveLowConfidence = 0;
  private _qualityWarning: string | null = null;

  async initialize(): Promise<void> {
    if (this.landmarker) return;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      await loadMediaPipe();
      const filesetResolver = await FilesetResolverClass.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      this.landmarker = await FaceLandmarkerClass.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,  // Enable 52 blendshape coefficients
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    } finally {
      this.isInitializing = false;
    }
  }

  private lastMediaPipeTimestamp = 0;

  /**
   * Estimate video brightness from the video element.
   * Uses a small canvas sample to compute average luminance.
   * Returns a value 0-255; below ~40 is considered low-light.
   */
  private estimateBrightness(videoElement: HTMLVideoElement): number {
    try {
      const canvas = document.createElement('canvas');
      // Sample a small region in the center for speed
      const sampleSize = 64;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 128; // Default to mid-range if no context
      ctx.drawImage(videoElement, 0, 0, sampleSize, sampleSize);
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const data = imageData.data;
      let totalLuminance = 0;
      const pixelCount = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        // Perceived luminance: 0.299*R + 0.587*G + 0.114*B
        totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return totalLuminance / pixelCount;
    } catch {
      return 128;
    }
  }

  processFrame(videoElement: HTMLVideoElement, wallClockTimestamp: number): FaceFrame | null {
    if (!this.landmarker) return null;
    if (videoElement.readyState < 2) return null;
    // Video must have real dimensions for MediaPipe to process
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null;

    try {
      // Low-light / variable quality detection
      // Check brightness periodically (every ~20 frames via consecutive null tracking)
      if (this.consecutiveLowConfidence % 20 === 0) {
        const brightness = this.estimateBrightness(videoElement);
        if (brightness < 40) {
          this._qualityWarning = 'low-light';
        } else if (brightness < 70) {
          this._qualityWarning = 'dim';
        } else {
          this._qualityWarning = null;
        }
      }

      // MediaPipe requires strictly monotonically increasing timestamps (performance.now() based)
      const mediaPipeTs = performance.now();
      if (mediaPipeTs <= this.lastMediaPipeTimestamp) return null;
      this.lastMediaPipeTimestamp = mediaPipeTs;

      const results = this.landmarker.detectForVideo(videoElement, mediaPipeTs);
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        this.consecutiveLowConfidence++;
        return null;
      }

      // Reset the consecutive miss counter on a successful detection
      this.consecutiveLowConfidence = 0;

      // Extract blendshapes into a flat map
      let blendshapes: BlendshapeMap | null = null;
      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const categories = results.faceBlendshapes[0].categories;
        blendshapes = {} as BlendshapeMap;
        for (const cat of categories) {
          blendshapes[cat.categoryName] = cat.score;
        }
      }

      return {
        landmarks: results.faceLandmarks[0],
        blendshapes,
        // Use wall-clock timestamp (Date.now()) so staleness checks work correctly
        timestamp: wallClockTimestamp,
      };
    } catch {
      this.consecutiveLowConfidence++;
      return null;
    }
  }

  /** Returns a quality warning string if video conditions are suboptimal, or null if OK */
  getQualityWarning(): string | null {
    if (this._qualityWarning) return this._qualityWarning;
    if (this.consecutiveLowConfidence > 15) return 'no-face-detected';
    return null;
  }

  isReady(): boolean {
    return this.landmarker !== null;
  }

  destroy() {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}
