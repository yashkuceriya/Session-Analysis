export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceFrame {
  landmarks: FaceLandmark[];
  blendshapes: BlendshapeMap | null;
  timestamp: number;
}

export interface GazeResult {
  isLookingAtCamera: boolean;
  gazeDirection: { x: number; y: number };
  confidence: number;
}

export interface ExpressionResult {
  valence: number;         // 0-1, higher = more positive
  energy: number;          // 0-1, higher = more energetic
  confusion: number;       // 0-1, furrowed brows + squinting
  surprise: number;        // 0-1, raised brows + open mouth
  concentration: number;   // 0-1, slight frown + focused eyes
  smile: number;           // 0-1, mouth corners up
  mouthOpen: number;       // 0-1, talking/surprised
  browFurrow: number;      // 0-1, inner brows down
  browRaise: number;       // 0-1, brows lifted
  headNod: number;         // -1 to 1, positive = nodding yes
  headShake: number;       // 0-1, shaking no
  headTilt: number;        // radians, lateral head tilt
}

/** Subset of MediaPipe FaceLandmarker blendshape categories we use */
export interface BlendshapeMap {
  browDownLeft: number;
  browDownRight: number;
  browInnerUp: number;
  browOuterUpLeft: number;
  browOuterUpRight: number;
  eyeSquintLeft: number;
  eyeSquintRight: number;
  eyeWideLeft: number;
  eyeWideRight: number;
  jawOpen: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthFrownLeft: number;
  mouthFrownRight: number;
  mouthPucker: number;
  mouthPress: number;
  cheekSquintLeft: number;
  cheekSquintRight: number;
  [key: string]: number;
}

export interface HeadPose {
  pitch: number;  // nodding up/down (radians)
  yaw: number;    // turning left/right (radians)
  roll: number;   // tilting left/right (radians)
}
