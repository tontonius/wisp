import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Wisp } from "../../../src";
import { MotionTestSceneController } from "../../../editor/scene/motion-test-scene.js";

describe("MotionTestSceneController", () => {
  it("enters and exits without touching particle runtime", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const wisp = new Wisp({ scene, camera, motion: {} });
    const controller = new MotionTestSceneController({ scene, wisp });

    expect(scene.children.length).toBe(0);
    controller.enter();
    expect(scene.children.length).toBe(1);
    expect(wisp.particles).toBeUndefined();

    controller.update(1 / 60);
    const cube = scene.children[0] as THREE.Object3D;
    expect(cube.position.x).not.toBe(0);

    controller.exit();
    expect(scene.children.length).toBe(0);
  });
});
