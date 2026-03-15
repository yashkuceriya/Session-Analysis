import { FaceLandmark } from '../video-processor/types';

export function distance2D(a: FaceLandmark, b: FaceLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function distance3D(a: FaceLandmark, b: FaceLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

export function midpoint(a: FaceLandmark, b: FaceLandmark): FaceLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

export function irisOffsetRatio(
  irisCenter: FaceLandmark,
  eyeInner: FaceLandmark,
  eyeOuter: FaceLandmark
): { x: number; y: number } {
  const eyeWidth = distance2D(eyeInner, eyeOuter);
  if (eyeWidth < 0.001) return { x: 0.5, y: 0.5 };

  const xDenom = eyeOuter.x - eyeInner.x;
  const yDenom = eyeOuter.y - eyeInner.y;
  const xRatio = Math.abs(xDenom) > 0.001 ? (irisCenter.x - eyeInner.x) / xDenom : 0.5;
  const yRatio = Math.abs(yDenom) > 0.001 ? (irisCenter.y - eyeInner.y) / yDenom : 0.5;

  return { x: xRatio, y: yRatio };
}

export function angleBetween(a: FaceLandmark, b: FaceLandmark): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
