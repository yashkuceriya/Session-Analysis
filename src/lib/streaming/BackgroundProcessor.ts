/**
 * BackgroundProcessor.ts
 * Video background blur/replace effect using Canvas
 * Applies Gaussian blur or custom background images
 */

type BackgroundMode = 'none' | 'blur' | 'image';

const DEFAULT_BLUR_STRENGTH = 10;
const OUTPUT_FPS = 30;
const FRAME_INTERVAL = 1000 / OUTPUT_FPS;

export class BackgroundProcessor {
  private videoElement: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private outputStream: MediaStream;
  private mode: BackgroundMode = 'none';
  private blurStrength: number = DEFAULT_BLUR_STRENGTH;
  private backgroundImage: HTMLImageElement | null = null;
  private isProcessing = false;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;

  constructor(videoElement: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.videoElement = videoElement;
    this.canvas = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    this.ctx = ctx;

    // Initialize output stream from canvas
    this.outputStream = this.canvas.captureStream(OUTPUT_FPS);
  }

  setMode(mode: BackgroundMode): void {
    this.mode = mode;
    if (mode === 'none' && this.animationFrameId !== null) {
      // If switching to none, we can stop processing
      this.stop();
    } else if (mode !== 'none' && !this.isProcessing) {
      // If switching to blur or image from none, start processing
      this.start();
    }
  }

  setBlurStrength(strength: number): void {
    this.blurStrength = Math.max(0, Math.min(20, strength));
  }

  async setBackgroundImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.backgroundImage = img;
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load background image: ${imageUrl}`));
      };
      img.src = imageUrl;
    });
  }

  start(): void {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    this.lastFrameTime = Date.now();
    this.processFrame();
  }

  stop(): void {
    this.isProcessing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getOutputStream(): MediaStream {
    return this.outputStream;
  }

  private processFrame = (): void => {
    if (!this.isProcessing) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= FRAME_INTERVAL) {
      this.lastFrameTime = now - (elapsed % FRAME_INTERVAL);
      this.drawFrame();
    }

    this.animationFrameId = requestAnimationFrame(this.processFrame);
  };

  private drawFrame(): void {
    const video = this.videoElement;

    // Set canvas size to match video
    if (
      this.canvas.width !== video.videoWidth ||
      this.canvas.height !== video.videoHeight
    ) {
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
    }

    if (this.mode === 'none') {
      // Just copy video to canvas
      this.ctx.drawImage(video, 0, 0);
      return;
    }

    // Get full video frame
    this.ctx.drawImage(video, 0, 0);

    if (this.mode === 'blur') {
      this.applyBlurEffect();
    } else if (this.mode === 'image') {
      this.applyImageBackground();
    }
  }

  private applyBlurEffect(): void {
    const video = this.videoElement;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Create temporary canvas for blurred version
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) return;

    // Draw video to temp canvas
    tempCtx.drawImage(video, 0, 0);

    // Apply blur filter to temp canvas
    tempCtx.filter = `blur(${this.blurStrength}px)`;
    tempCtx.drawImage(video, 0, 0);

    // Draw blurred background to main canvas
    this.ctx.drawImage(tempCanvas, 0, 0);

    // Create a face detection region (simplified - center area)
    // In a real implementation, this would use MediaPipe or TensorFlow.js
    const faceRegionScale = 0.7; // Region size as % of video
    const faceWidth = width * faceRegionScale;
    const faceHeight = height * faceRegionScale;
    const faceX = (width - faceWidth) / 2;
    const faceY = (height - faceHeight) / 2;

    // Composite clear face region from original video
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(
      video,
      faceX,
      faceY,
      faceWidth,
      faceHeight,
      faceX,
      faceY,
      faceWidth,
      faceHeight,
    );
    this.ctx.restore();
  }

  private applyImageBackground(): void {
    const video = this.videoElement;
    const width = this.canvas.width;
    const height = this.canvas.height;

    if (this.backgroundImage) {
      // Draw background image
      const imgAspect = this.backgroundImage.width / this.backgroundImage.height;
      const canvasAspect = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let drawX = 0;
      let drawY = 0;

      if (imgAspect > canvasAspect) {
        drawWidth = height * imgAspect;
        drawX = (width - drawWidth) / 2;
      } else {
        drawHeight = width / imgAspect;
        drawY = (height - drawHeight) / 2;
      }

      this.ctx.drawImage(
        this.backgroundImage,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    }

    // Create face detection region (simplified - center area)
    const faceRegionScale = 0.75;
    const faceWidth = width * faceRegionScale;
    const faceHeight = height * faceRegionScale;
    const faceX = (width - faceWidth) / 2;
    const faceY = (height - faceHeight) / 2;

    // Composite face region from original video
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(
      video,
      faceX,
      faceY,
      faceWidth,
      faceHeight,
      faceX,
      faceY,
      faceWidth,
      faceHeight,
    );
    this.ctx.restore();
  }

  cleanup(): void {
    this.stop();
    this.backgroundImage = null;
    // Clean up stream tracks
    this.outputStream.getTracks().forEach((track) => track.stop());
  }

  destroy(): void {
    this.cleanup();
  }
}
