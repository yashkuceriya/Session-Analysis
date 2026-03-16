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

  processFrame(videoElement: HTMLVideoElement, wallClockTimestamp: number): FaceFrame | null {
    if (!this.landmarker) return null;
    if (videoElement.readyState < 2) return null;
    // Video must have real dimensions for MediaPipe to process
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null;

    try {
      // MediaPipe requires strictly monotonically increasing timestamps (performance.now() based)
      const mediaPipeTs = performance.now();
      if (mediaPipeTs <= this.lastMediaPipeTimestamp) return null;
      this.lastMediaPipeTimestamp = mediaPipeTs;

      const results = this.landmarker.detectForVideo(videoElement, mediaPipeTs);
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        return null;
      }

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
      return null;
    }
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
