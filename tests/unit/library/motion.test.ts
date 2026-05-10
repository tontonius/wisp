import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { MotionEffectsSystem, Wisp } from "../../../src";

describe("MotionEffectsSystem", () => {
  it("does not compound one-shot scale offsets across frames", () => {
    const target = new THREE.Object3D();
    target.scale.set(1, 1, 1);
    const motion = new MotionEffectsSystem();
    motion.motion(target).pop({ strength: 0.4, duration: 0.12 });

    for (let i = 0; i < 30; i += 1) {
      motion.update(1 / 60);
    }

    expect(target.scale.x).toBeCloseTo(1, 4);
    expect(target.scale.y).toBeCloseTo(1, 4);
    expect(target.scale.z).toBeCloseTo(1, 4);
  });

  it("composes position, rotation, and scale offsets in one pass", () => {
    const target = new THREE.Object3D();
    const motion = new MotionEffectsSystem();
    motion.motion(target).hover({ amplitude: 0.1, frequency: 1 }).pop({ strength: 0.2 }).recoil(new THREE.Vector3(0, 0, 1), {
      distance: 0.2,
      rotation: 17,
      duration: 0.2,
    });

    motion.update(1 / 60);

    expect(target.position.length()).toBeGreaterThan(0);
    expect(target.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0);
    expect(target.scale.x).toBeGreaterThan(1);
  });

  it("derives velocity from de-offset base transform", () => {
    const target = new THREE.Object3D();
    const sampledVelocities: number[] = [];
    const motion = new MotionEffectsSystem();
    motion.motion(target).hover({ amplitude: 0.5, frequency: 3 }).leanByVelocity(() => {
      sampledVelocities.push(target.position.y);
      return new THREE.Vector3(0, 0, 0);
    });

    motion.update(1 / 60);
    motion.update(1 / 60);
    motion.update(1 / 60);

    expect(sampledVelocities[1]).toBeCloseTo(0, 5);
    expect(sampledVelocities[2]).toBeCloseTo(0, 5);
  });

  it("reset/clear restores baseline transforms", () => {
    const target = new THREE.Object3D();
    const motion = new MotionEffectsSystem();
    motion.motion(target).hover({ amplitude: 0.3, frequency: 2 });
    motion.update(1 / 60);
    expect(target.position.y).not.toBeCloseTo(0, 5);

    motion.clear();
    expect(target.position.y).toBeCloseTo(0, 5);
    expect(target.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 5);
    expect(target.scale.x).toBeCloseTo(1, 5);
  });
});

describe("Wisp motion integration", () => {
  it("updates motion controllers through Wisp.update", () => {
    const camera = new THREE.PerspectiveCamera();
    const target = new THREE.Object3D();
    const wisp = new Wisp({ camera, motion: {} });
    wisp.motion?.motion(target).hover({ amplitude: 0.2, frequency: 1 });

    wisp.update(1 / 60);

    expect(target.position.y).not.toBeCloseTo(0, 5);
  });

  it("keeps motion disabled when not configured", () => {
    const camera = new THREE.PerspectiveCamera();
    const wisp = new Wisp({ camera });
    expect(wisp.motion).toBeUndefined();
  });
});
