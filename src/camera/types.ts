export type CameraShakeImpulse = number | { trauma: number };

export type CameraShakeMode = "rotationOnly" | "rotationAndTranslation";

export interface CameraShakeOptions {
  decayRate?: number;
  traumaExponent?: number;
  noiseFrequency?: number;
  mode?: CameraShakeMode;
  maxRotation?: [pitch: number, yaw: number, roll: number];
  maxTranslation?: [x: number, y: number, z: number];
}

export interface CameraEffectsOptions {
  shake?: CameraShakeOptions;
}
