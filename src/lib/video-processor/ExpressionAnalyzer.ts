import { FaceLandmark, BlendshapeMap, ExpressionResult, HeadPose } from './types';
import { distance2D } from '../utils/geometry';
import { EMA, RollingWindow } from '../utils/smoothing';

// Mouth landmarks (fallback when blendshapes unavailable)
const MOUTH_LEFT = 61;
const MOUTH_RIGHT = 291;
const MOUTH_TOP = 13;
const MOUTH_BOTTOM = 14;
const UPPER_LIP = 0;
const LOWER_LIP = 17;

// Eyebrow landmarks
const LEFT_EYEBROW_INNER = 107;
const LEFT_EYEBROW_TOP = 105;
const LEFT_EYE_TOP = 159;
const RIGHT_EYEBROW_INNER = 336;
const RIGHT_EYEBROW_TOP = 334;
const RIGHT_EYE_TOP = 386;

// Head pose landmarks (nose tip, chin, left/right face edge)
const NOSE_TIP = 1;
const CHIN = 152;
const LEFT_FACE = 234;
const RIGHT_FACE = 454;
const FOREHEAD = 10;

export class ExpressionAnalyzer {
  private valenceEMA = new EMA(0.3);
  private energyEMA = new EMA(0.3);
  private confusionEMA = new EMA(0.25);
  private concentrationEMA = new EMA(0.25);

  // Head pose tracking for nod/shake detection
  private pitchHistory = new RollingWindow<number>(20);  // ~10s at 2Hz
  private yawHistory = new RollingWindow<number>(20);

  analyze(landmarks: FaceLandmark[], blendshapes: BlendshapeMap | null): ExpressionResult | null {
    if (!landmarks || landmarks.length < 400) return null;

    // Prefer blendshapes (52 action units from MediaPipe), fall back to landmarks
    if (blendshapes) {
      return this.analyzeFromBlendshapes(blendshapes, landmarks);
    }
    return this.analyzeFromLandmarks(landmarks);
  }

  private analyzeFromBlendshapes(bs: BlendshapeMap, landmarks: FaceLandmark[]): ExpressionResult {
    // Smile: average of left and right mouth corners
    const smile = ((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) / 2;

    // Brow raise: inner + outer
    const browRaise = Math.max(
      bs.browInnerUp ?? 0,
      ((bs.browOuterUpLeft ?? 0) + (bs.browOuterUpRight ?? 0)) / 2
    );

    // Brow furrow: inner brows pulling down
    const browFurrow = ((bs.browDownLeft ?? 0) + (bs.browDownRight ?? 0)) / 2;

    // Eye squint (concentration or confusion indicator)
    const eyeSquint = ((bs.eyeSquintLeft ?? 0) + (bs.eyeSquintRight ?? 0)) / 2;

    // Eye wide (surprise)
    const eyeWide = ((bs.eyeWideLeft ?? 0) + (bs.eyeWideRight ?? 0)) / 2;

    // Mouth open (talking, surprise)
    const mouthOpen = bs.jawOpen ?? 0;

    // Frown
    const frown = ((bs.mouthFrownLeft ?? 0) + (bs.mouthFrownRight ?? 0)) / 2;

    // Cheek squint (genuine smile indicator — Duchenne)
    const cheekSquint = ((bs.cheekSquintLeft ?? 0) + (bs.cheekSquintRight ?? 0)) / 2;

    // Derived expressions
    const surprise = Math.min(1, (browRaise * 0.5 + eyeWide * 0.3 + mouthOpen * 0.2));
    const confusion = this.confusionEMA.update(
      Math.min(1, browFurrow * 0.5 + eyeSquint * 0.3 + frown * 0.2)
    );
    const concentration = this.concentrationEMA.update(
      Math.min(1, browFurrow * 0.3 + eyeSquint * 0.4 + (1 - mouthOpen) * 0.1 + (1 - smile) * 0.2)
    );

    // Valence: positive expressions minus negative
    const positiveSignals = smile * 0.4 + cheekSquint * 0.2 + browRaise * 0.1;
    const negativeSignals = frown * 0.3 + browFurrow * 0.2;
    const valence = this.valenceEMA.update(
      Math.min(1, Math.max(0, 0.5 + positiveSignals - negativeSignals))
    );

    // Energy: expressiveness regardless of valence
    const energy = this.energyEMA.update(
      Math.min(1, mouthOpen * 0.3 + browRaise * 0.2 + smile * 0.2 + eyeWide * 0.15 + browFurrow * 0.15)
    );

    // Frustration: derived from browFurrow + frown + low valence
    const frustration = Math.min(1, browFurrow * 0.4 + frown * 0.3 + (1 - valence) * 0.3);

    // Interest: derived from browRaise + concentration + eye contact
    const interest = Math.min(1, browRaise * 0.3 + concentration * 0.3 + (1 - frown) * 0.2 + eyeWide * 0.2);

    // Head pose from landmarks
    const headPose = this.estimateHeadPose(landmarks);
    this.pitchHistory.push(headPose.pitch);
    this.yawHistory.push(headPose.yaw);

    const headNod = this.detectNodding();
    const headShake = this.detectShaking();

    return {
      valence,
      energy,
      confusion,
      surprise,
      concentration,
      smile,
      mouthOpen,
      browFurrow,
      browRaise,
      headNod,
      headShake,
      headTilt: headPose.roll,
      frustration,
      interest,
    };
  }

  private analyzeFromLandmarks(landmarks: FaceLandmark[]): ExpressionResult {
    // Landmark-based fallback (less accurate but works without blendshapes)
    const mouthWidth = distance2D(landmarks[MOUTH_LEFT], landmarks[MOUTH_RIGHT]);
    const mouthHeight = distance2D(landmarks[MOUTH_TOP], landmarks[MOUTH_BOTTOM]);
    const mouthRatio = mouthHeight > 0.001 ? mouthWidth / mouthHeight : 3;
    const smile = Math.min(1, Math.max(0, (mouthRatio - 2.5) / 3.5));

    const leftBrowRaise = distance2D(landmarks[LEFT_EYEBROW_TOP], landmarks[LEFT_EYE_TOP]);
    const rightBrowRaise = distance2D(landmarks[RIGHT_EYEBROW_TOP], landmarks[RIGHT_EYE_TOP]);
    const browRaise = Math.min(1, (leftBrowRaise + rightBrowRaise) * 10);

    // Brow furrow from inner brow distance
    const innerBrowDist = distance2D(landmarks[LEFT_EYEBROW_INNER], landmarks[RIGHT_EYEBROW_INNER]);
    const browFurrow = Math.min(1, Math.max(0, 1 - innerBrowDist * 15));

    const lipDistance = distance2D(landmarks[UPPER_LIP], landmarks[LOWER_LIP]);
    const mouthOpen = Math.min(1, lipDistance / 0.05);

    const valence = this.valenceEMA.update(smile * 0.7 + browRaise * 0.3);
    const energy = this.energyEMA.update(mouthOpen * 0.4 + browRaise * 0.3 + smile * 0.3);
    const confusion = this.confusionEMA.update(browFurrow * 0.6 + (1 - smile) * 0.4);
    const concentration = this.concentrationEMA.update(browFurrow * 0.5 + (1 - mouthOpen) * 0.3);

    const headPose = this.estimateHeadPose(landmarks);
    this.pitchHistory.push(headPose.pitch);
    this.yawHistory.push(headPose.yaw);

    const frown = Math.min(1, (1 - smile) * 0.5);
    const valenceValue = Math.min(1, Math.max(0, valence));
    const concentrationValue = Math.min(1, Math.max(0, concentration));

    // Frustration: derived from browFurrow + frown + low valence
    const frustration = Math.min(1, browFurrow * 0.4 + frown * 0.3 + (1 - valenceValue) * 0.3);

    // Interest: derived from browRaise + concentration + eye contact
    const interest = Math.min(1, browRaise * 0.3 + concentrationValue * 0.3 + (1 - frown) * 0.2);

    return {
      valence: valenceValue,
      energy: Math.min(1, Math.max(0, energy)),
      confusion: Math.min(1, Math.max(0, confusion)),
      surprise: Math.min(1, browRaise * 0.6 + mouthOpen * 0.4),
      concentration: concentrationValue,
      smile,
      mouthOpen,
      browFurrow,
      browRaise,
      headNod: this.detectNodding(),
      headShake: this.detectShaking(),
      headTilt: headPose.roll,
      frustration,
      interest,
    };
  }

  private estimateHeadPose(landmarks: FaceLandmark[]): HeadPose {
    const nose = landmarks[NOSE_TIP];
    const chin = landmarks[CHIN];
    const forehead = landmarks[FOREHEAD];
    const leftFace = landmarks[LEFT_FACE];
    const rightFace = landmarks[RIGHT_FACE];

    if (!nose || !chin || !forehead || !leftFace || !rightFace) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Pitch: angle between forehead-nose-chin vertical
    const pitch = Math.atan2(chin.y - forehead.y, chin.z - forehead.z) - Math.PI / 2;

    // Yaw: asymmetry between left and right face edges relative to nose
    const leftDist = Math.abs(nose.x - leftFace.x);
    const rightDist = Math.abs(nose.x - rightFace.x);
    const yaw = Math.atan2(rightDist - leftDist, (leftDist + rightDist) / 2);

    // Roll: tilt of the eye line
    const roll = Math.atan2(rightFace.y - leftFace.y, rightFace.x - leftFace.x);

    return { pitch, yaw, roll };
  }

  /** Detect nodding (yes) — rapid pitch oscillation */
  private detectNodding(): number {
    const pitches = this.pitchHistory.getAll();
    if (pitches.length < 6) return 0;

    // Count direction changes in recent pitch values
    let directionChanges = 0;
    let totalAmplitude = 0;
    for (let i = 2; i < pitches.length; i++) {
      const prev = pitches[i - 1] - pitches[i - 2];
      const curr = pitches[i] - pitches[i - 1];
      if (prev * curr < 0) {
        directionChanges++;
        totalAmplitude += Math.abs(pitches[i] - pitches[i - 2]);
      }
    }

    // Nodding = frequent direction changes with meaningful amplitude
    if (directionChanges >= 2 && totalAmplitude > 0.02) {
      return Math.min(1, directionChanges / 5);
    }
    return 0;
  }

  /** Detect head shake (no) — rapid yaw oscillation */
  private detectShaking(): number {
    const yaws = this.yawHistory.getAll();
    if (yaws.length < 6) return 0;

    let directionChanges = 0;
    let totalAmplitude = 0;
    for (let i = 2; i < yaws.length; i++) {
      const prev = yaws[i - 1] - yaws[i - 2];
      const curr = yaws[i] - yaws[i - 1];
      if (prev * curr < 0) {
        directionChanges++;
        totalAmplitude += Math.abs(yaws[i] - yaws[i - 2]);
      }
    }

    if (directionChanges >= 2 && totalAmplitude > 0.03) {
      return Math.min(1, directionChanges / 5);
    }
    return 0;
  }

  reset() {
    this.valenceEMA.reset();
    this.energyEMA.reset();
    this.confusionEMA.reset();
    this.concentrationEMA.reset();
    this.pitchHistory.clear();
    this.yawHistory.clear();
  }
}
