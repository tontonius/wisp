import * as THREE from "three";
import type { Wisp } from "../../src";

type MotionTestSceneDeps = {
  scene: THREE.Scene;
  wisp: Wisp;
};

type MotionTestParams = {
  hoverEnabled: boolean;
  breatheEnabled: boolean;
  leanEnabled: boolean;
  autoPopEnabled: boolean;
};

/** Isolated motion-preview scene object lifecycle for editor motion-test mode. */
export class MotionTestSceneController {
  private readonly scene: THREE.Scene;
  private readonly wisp: Wisp;
  private readonly cube: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private elapsed = 0;
  private popTimer = 0;
  private readonly velocity = new THREE.Vector3();
  private readonly previousPosition = new THREE.Vector3();
  private readonly params: MotionTestParams = {
    hoverEnabled: true,
    breatheEnabled: true,
    leanEnabled: false,
    autoPopEnabled: true,
  };

  constructor({ scene, wisp }: MotionTestSceneDeps) {
    this.scene = scene;
    this.wisp = wisp;
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.85, 0.85),
      new THREE.MeshStandardMaterial({
        color: "#8bd3ff",
        metalness: 0.2,
        roughness: 0.45,
      })
    );
    this.cube.position.set(0, 1, 0);
    this.cube.castShadow = true;
    this.cube.receiveShadow = false;
  }

  enter(): void {
    if (!this.cube.parent) {
      this.scene.add(this.cube);
    }
    this.elapsed = 0;
    this.popTimer = 0;
    this.previousPosition.copy(this.cube.position);
    this.applyLoopEffects();
  }

  exit(): void {
    this.wisp.motion?.release(this.cube);
    if (this.cube.parent) {
      this.cube.parent.remove(this.cube);
    }
  }

  update(dt: number): void {
    if (!this.cube.parent) {
      return;
    }
    this.previousPosition.copy(this.cube.position);
    this.elapsed += dt;
    this.popTimer += dt;
    this.cube.position.x = Math.sin(this.elapsed * 1.1) * 0.8;
    this.cube.position.z = Math.cos(this.elapsed * 0.65) * 0.35;
    this.velocity.copy(this.cube.position).sub(this.previousPosition).multiplyScalar(1 / Math.max(dt, 1e-6));
    if (this.params.autoPopEnabled && this.popTimer >= 1.5) {
      this.popTimer = 0;
      this.triggerPop();
    }
  }

  getParams(): MotionTestParams {
    return this.params;
  }

  setHoverEnabled(enabled: boolean): void {
    this.params.hoverEnabled = enabled;
    this.applyLoopEffects();
  }

  setBreatheEnabled(enabled: boolean): void {
    this.params.breatheEnabled = enabled;
    this.applyLoopEffects();
  }

  setLeanEnabled(enabled: boolean): void {
    this.params.leanEnabled = enabled;
    this.applyLoopEffects();
  }

  setAutoPopEnabled(enabled: boolean): void {
    this.params.autoPopEnabled = enabled;
    if (!enabled) this.popTimer = 0;
  }

  triggerPop(): void {
    this.wisp.motion?.motion(this.cube).pop({ strength: 0.18, duration: 0.16 });
  }

  triggerSquash(): void {
    this.wisp.motion?.motion(this.cube).squash({ amount: 0.2, duration: 0.2 });
  }

  triggerRecoil(): void {
    this.wisp.motion?.motion(this.cube).recoil(new THREE.Vector3(0, 0, 1), {
      distance: 0.2,
      rotation: 0.22,
      duration: 0.14,
    });
  }

  private applyLoopEffects(): void {
    const motion = this.wisp.motion;
    if (!motion) {
      return;
    }
    const handle = motion.motion(this.cube).clearEffects();
    if (this.params.hoverEnabled) {
      handle.hover({ amplitude: 0.08, frequency: 1.2 });
    }
    if (this.params.breatheEnabled) {
      handle.breathe({ amplitude: 0.04, frequency: 0.8 });
    }
    if (this.params.leanEnabled) {
      handle.leanByVelocity(() => this.velocity, { maxAngle: 0.18, response: 10 });
    }
  }
}
