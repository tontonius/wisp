/** Shake impulse input. Number form is treated as trauma amount. */
export type CameraShakeImpulse = number | { trauma: number };

/** Camera shake output mode. */
export type CameraShakeMode = "rotationOnly" | "rotationAndTranslation";

/** Runtime tuning options for trauma-based camera shake. */
export interface CameraShakeOptions {
  /** Trauma decay per second. Default `1.4`. */
  decayRate?: number;
  /** Nonlinear trauma response exponent. Default `2`. */
  traumaExponent?: number;
  /** Coherent noise time scale in Hz-like units. Default `22`. */
  noiseFrequency?: number;
  /** Rotation-only is recommended for most 3D gameplay cameras. Default `"rotationOnly"`. */
  mode?: CameraShakeMode;
  /** Maximum angular offsets `[pitch, yaw, roll]` in radians. */
  maxRotation?: [pitch: number, yaw: number, roll: number];
  /** Maximum positional offsets `[x, y, z]` in world units. Used only in translation mode. */
  maxTranslation?: [x: number, y: number, z: number];
}

/** Top-level camera module options used by `WispOptions.cameraEffects`. */
export interface CameraEffectsOptions {
  /** Optional trauma-based shake module configuration. */
  shake?: CameraShakeOptions;
}
