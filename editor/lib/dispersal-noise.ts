import * as THREE from "three";

export function dispersalHash2D(x: number, y: number): number {
  return (Math.sin(x * 127.1 + y * 311.7) * 43758.5453123) % 1;
}

export function dispersalValueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const n00 = dispersalHash2D(ix, iy);
  const n10 = dispersalHash2D(ix + 1, iy);
  const n01 = dispersalHash2D(ix, iy + 1);
  const n11 = dispersalHash2D(ix + 1, iy + 1);
  const nx0 = THREE.MathUtils.lerp(n00, n10, ux);
  const nx1 = THREE.MathUtils.lerp(n01, n11, ux);
  return THREE.MathUtils.clamp(THREE.MathUtils.lerp(nx0, nx1, uy), 0, 1);
}
