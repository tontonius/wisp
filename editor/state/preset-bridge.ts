import * as THREE from "three";
import { defaultGradientStops, normalizeGradientStops } from "../../demo/tweakpane-gradient-plugin/index.js";
import type { ParticlePreset } from "../../src";
import { curveFromBezierRange, curveFromEndpoints, normalizeCubicBezierValue } from "../lib/curves";
import { gradientToStops } from "../lib/gradients";
import { asRange, ensureEmitter, ensureEmission, ensureStart } from "../lib/preset-utils";
import type { EditorParams } from "./params";

export type PresetSyncApplyContext = {
  params: EditorParams;
  workingPreset: ParticlePreset;
  softDisc: THREE.Texture;
  hardDisc: THREE.Texture;
  spark: THREE.Texture;
  /** Mutable refs for sync/apply to read/write (matches previous `let` bindings). */
  customRendererTexture: { value: THREE.Texture | undefined };
  customDispersalTexture: { value: THREE.Texture | undefined };
  refreshExportJson: () => void;
};

export function syncParamsFromPreset(ctx: PresetSyncApplyContext): void {
  const { params, workingPreset } = ctx;
  const { hardDisc, spark, softDisc } = ctx;
  const start = ensureStart(workingPreset);
  const emission = ensureEmission(workingPreset);
  const emitter = ensureEmitter(workingPreset);
  const life = asRange(start.lifetime, [0.8, 1.2]);
  const speed = asRange(start.speed, [0.3, 1.5]);
  const size = asRange(start.size, [0.08, 0.22]);
  const burst = asRange(emission.bursts?.[0]?.count, [18, 32]);
  const firstBurst = emission.bursts?.[0];

  params.simulation = (workingPreset.simulation ?? "auto") as "auto" | "cpu" | "gpu";
  params.simulationSpace = (workingPreset.simulationSpace ?? "local") as "local" | "world";
  params.maxParticles = workingPreset.maxParticles ?? 256;
  params.duration = workingPreset.duration ?? 1;
  params.loop = workingPreset.loop ?? true;
  params.prewarm = workingPreset.prewarm ?? false;
  params.emitterType = emitter.type;
  params.emitterRadius = (emitter as { radius?: number }).radius ?? 0.4;
  params.emitterEmitFrom = ((emitter as { emitFrom?: "volume" | "shell" }).emitFrom ?? "volume");
  params.emitterAngle = (emitter as { angle?: number }).angle ?? 25;
  params.emitterLength = (emitter as { length?: number }).length ?? 1;
  const boxSize = (emitter as { size?: [number, number, number] }).size ?? [1, 1, 1];
  params.emitterBoxSize = { x: boxSize[0], y: boxSize[1], z: boxSize[2] };
  params.emissionMode = firstBurst ? "burst" : "rate";
  params.burstCount = { x: burst[0], y: burst[1] };
  params.burstTime = firstBurst?.time ?? 0;
  params.burstProbability = firstBurst?.probability ?? 1;
  params.rateOverTime = typeof emission.rateOverTime === "number" ? emission.rateOverTime : 0;
  params.lifetimeRange = { x: life[0], y: life[1] };
  params.speedRange = { x: speed[0], y: speed[1] };
  params.sizeRange = { x: size[0], y: size[1] };
  const opacity = asRange(start.opacity, [1, 1]);
  params.opacityRange = { x: opacity[0], y: opacity[1] };
  const rotation = asRange(start.rotation, [0, 0]);
  params.startRotationRange = { x: rotation[0], y: rotation[1] };
  const angularVelocity = asRange(start.angularVelocity, [0, 0]);
  params.startAngularVelocityRange = { x: angularVelocity[0], y: angularVelocity[1] };
  const color = start.color;
  if (Array.isArray(color)) {
    params.startColorMode = "range";
    params.startColorA = new THREE.Color(color[0]).getStyle();
    params.startColorB = new THREE.Color(color[1]).getStyle();
  } else {
    params.startColorMode = "single";
    params.startColorA = new THREE.Color(color ?? "#ffffff").getStyle();
    params.startColorB = params.startColorA;
  }
  params.drag = workingPreset.forces?.drag ?? 0;
  const accel = workingPreset.forces?.acceleration ?? [0, 0, 0];
  params.acceleration = { x: accel[0], y: accel[1], z: accel[2] };
  const vortex = workingPreset.forces?.vortex;
  params.vortexEnabled = !!vortex;
  params.vortexCenter = {
    x: vortex?.center?.[0] ?? 0,
    y: vortex?.center?.[1] ?? 0,
    z: vortex?.center?.[2] ?? 0,
  };
  params.vortexAxis = {
    x: vortex?.axis?.[0] ?? 0,
    y: vortex?.axis?.[1] ?? 1,
    z: vortex?.axis?.[2] ?? 0,
  };
  params.vortexOrbitalSpeed = vortex?.orbitalSpeed ?? 0;
  params.vortexInward = vortex?.inward ?? 0;
  params.vortexUpward = vortex?.upward ?? 0;
  const noise = workingPreset.forces?.noise;
  params.noiseEnabled = !!noise;
  params.noiseStrength = workingPreset.forces?.noise?.strength ?? 0;
  params.noiseFrequency = workingPreset.forces?.noise?.frequency ?? 1;
  params.noiseScroll = {
    x: noise?.scroll?.[0] ?? 0,
    y: noise?.scroll?.[1] ?? 0,
    z: noise?.scroll?.[2] ?? 0,
  };
  params.noiseOctaves = noise?.octaves ?? 1;
  params.noiseLacunarity = noise?.lacunarity ?? 2;
  params.noisePersistence = noise?.persistence ?? 0.5;
  const linear = workingPreset.velocityOverLifetime?.linear;
  params.velocityOverLifetimeEnabled = !!linear;
  params.velocityLinearX = { x: linear?.x?.[0]?.[1] ?? 0, y: linear?.x?.[linear.x.length - 1]?.[1] ?? 0 };
  params.velocityLinearY = { x: linear?.y?.[0]?.[1] ?? 0, y: linear?.y?.[linear.y.length - 1]?.[1] ?? 0 };
  params.velocityLinearZ = { x: linear?.z?.[0]?.[1] ?? 0, y: linear?.z?.[linear.z.length - 1]?.[1] ?? 0 };
  params.rendererType = (workingPreset.renderer?.type ?? "billboard") as "billboard" | "stretchedBillboard";
  params.rendererBlendMode = (workingPreset.renderer?.blendMode ?? "alpha") as "alpha" | "additive" | "multiply";
  params.rendererAlign = (workingPreset.renderer?.align ?? "camera") as "camera" | "velocity";
  params.rendererSorting = (workingPreset.renderer?.sorting ?? "distance") as "none" | "distance" | "youngestFirst" | "oldestFirst";
  const rendererTexture = workingPreset.renderer?.texture;
  if (rendererTexture === hardDisc || rendererTexture === spark || rendererTexture === softDisc || !rendererTexture) {
    ctx.customRendererTexture.value = undefined;
    params.rendererTexture = rendererTexture === hardDisc ? "hardDisc" : rendererTexture === spark ? "spark" : "softDisc";
    params.rendererTextureSheetTextureName = "Built-in";
  } else if ((rendererTexture as THREE.Texture).isTexture) {
    ctx.customRendererTexture.value = rendererTexture;
    params.rendererTexture = "softDisc";
    params.rendererTextureSheetTextureName = "Custom sheet";
  } else {
    ctx.customRendererTexture.value = undefined;
    params.rendererTexture = "softDisc";
    params.rendererTextureSheetTextureName = "Built-in";
  }
  params.rendererStretchFactor = workingPreset.renderer?.stretchFactor ?? 0.35;
  params.rendererStretchMaxScale = workingPreset.renderer?.stretchMaxScale ?? 4;
  params.rendererDepthWrite = workingPreset.renderer?.depthWrite ?? false;
  params.rendererDepthTest = workingPreset.renderer?.depthTest ?? true;
  params.rendererSoftParticles = workingPreset.renderer?.softParticles ?? false;
  params.rendererSoftness = workingPreset.renderer?.softness ?? 1.5;
  params.rendererAlphaFromLuminanceEnabled = workingPreset.renderer?.alphaFromLuminance?.enabled ?? false;
  params.rendererAlphaFromLuminanceBlackCutoff = workingPreset.renderer?.alphaFromLuminance?.blackCutoff ?? 32;
  params.rendererTextureSheetEnabled = !!workingPreset.renderer?.textureSheet;
  params.rendererTextureSheetColumns = workingPreset.renderer?.textureSheet?.columns ?? 2;
  params.rendererTextureSheetRows = workingPreset.renderer?.textureSheet?.rows ?? 2;
  params.rendererTextureSheetAnimationMode = (
    workingPreset.renderer?.textureSheet?.animationMode ?? "overLifetime"
  ) as "static" | "randomStart" | "overLifetime" | "randomStartOverLifetime";
  const dispersal = workingPreset.renderer?.dispersal;
  params.dispersalEnabled = dispersal ? (dispersal.enabled ?? true) : false;
  params.dispersalStrength = dispersal?.strength ?? 1;
  params.dispersalAmount = {
    x: dispersal?.amount?.[0]?.[1] ?? 0,
    y: dispersal?.amount && dispersal.amount.length > 0
      ? dispersal.amount[dispersal.amount.length - 1]?.[1] ?? 1
      : 1,
  };
  params.dispersalStartAt = dispersal?.amount && dispersal.amount.length >= 3
    ? THREE.MathUtils.clamp(dispersal.amount[1][0], 0, 1)
    : 0;
  params.dispersalNoiseScale = dispersal?.noiseScale ?? 6;
  params.dispersalEdgeSoftness = dispersal?.edgeSoftness ?? 0.12;
  params.dispersalScroll = {
    x: dispersal?.scroll?.[0] ?? 0,
    y: dispersal?.scroll?.[1] ?? 0,
  };
  ctx.customDispersalTexture.value = dispersal?.texture;
  params.dispersalTextureName = dispersal?.texture ? "Custom texture" : "Built-in noise";
  const sizeCurve = workingPreset.overLifetime?.size;
  params.sizeOverLifetimeEnabled = !!sizeCurve;
  params.sizeOverLifetime = { x: sizeCurve?.[0]?.[1] ?? 1, y: sizeCurve?.[sizeCurve.length - 1]?.[1] ?? 0 };
  params.sizeOverLifetimeBezier = normalizeCubicBezierValue(
    [0.33, sizeCurve?.[1]?.[1] ?? 0, 0.66, sizeCurve?.[2]?.[1] ?? 1],
    [0.33, 0, 0.66, 1]
  );
  params.colorOverLifetimeEnabled = !!workingPreset.overLifetime?.color || !!workingPreset.overLifetime?.opacity;
  params.lifetimeGradient = gradientToStops(workingPreset.overLifetime?.color, workingPreset.overLifetime?.opacity);

  const limitVel = workingPreset.limitVelocityOverLifetime;
  params.limitVelocityEnabled = !!limitVel;
  params.limitVelocitySpeed = {
    x: limitVel?.speed?.[0]?.[1] ?? 5,
    y: limitVel?.speed?.[limitVel.speed.length - 1]?.[1] ?? 5,
  };
  params.limitVelocityDampen = limitVel?.dampen ?? 1;

  const cbs = workingPreset.colorBySpeed;
  params.colorBySpeedEnabled = !!cbs;
  params.colorBySpeedRange = { x: cbs?.speedRange?.[0] ?? 0, y: cbs?.speedRange?.[1] ?? 10 };
  params.colorBySpeedGradient = normalizeGradientStops({
    colors: cbs?.gradient?.map(([t, c]) => [t, new THREE.Color(c).getStyle()] as [number, string]) ?? defaultGradientStops().colors,
    opacities: defaultGradientStops().opacities,
  });

  const sbs = workingPreset.sizeBySpeed;
  params.sizeBySpeedEnabled = !!sbs;
  params.sizeBySpeedRange = { x: sbs?.speedRange?.[0] ?? 0, y: sbs?.speedRange?.[1] ?? 10 };
  params.sizeBySpeedMultiplier = {
    x: sbs?.curve?.[0]?.[1] ?? 1,
    y: sbs?.curve?.[sbs.curve.length - 1]?.[1] ?? 1,
  };

  const rbs = workingPreset.rotationBySpeed;
  params.rotationBySpeedEnabled = !!rbs;
  params.rotationBySpeedRange = { x: rbs?.speedRange?.[0] ?? 0, y: rbs?.speedRange?.[1] ?? 10 };
  params.rotationBySpeedAngular = {
    x: rbs?.angularVelocity?.[0]?.[1] ?? 0,
    y: rbs?.angularVelocity?.[rbs.angularVelocity.length - 1]?.[1] ?? 0,
  };
  ctx.refreshExportJson();
}

export function applyParamsToPreset(ctx: PresetSyncApplyContext): void {
  const { params, workingPreset } = ctx;
  const { hardDisc, spark, softDisc } = ctx;
  const start = ensureStart(workingPreset);
  const emission = ensureEmission(workingPreset);
  const emitter = ensureEmitter(workingPreset);
  const forces = (workingPreset.forces ??= {});
  const rendererConfig = (workingPreset.renderer ??= {});
  const overLifetime = (workingPreset.overLifetime ??= {});

  workingPreset.simulation = params.simulation;
  workingPreset.simulationSpace = params.simulationSpace;
  workingPreset.maxParticles = Math.max(1, Math.round(params.maxParticles));
  workingPreset.duration = Math.max(0.01, params.duration);
  workingPreset.loop = params.loop;
  workingPreset.prewarm = params.prewarm;
  emitter.type = params.emitterType;
  if (emitter.type === "sphere" || emitter.type === "hemisphere") {
    (emitter as { emitFrom?: "volume" | "shell" }).emitFrom = params.emitterEmitFrom;
  }
  (emitter as { radius?: number }).radius = Math.max(0, params.emitterRadius);
  if (emitter.type === "cone") {
    (emitter as { angle?: number }).angle = Math.max(0, params.emitterAngle);
    (emitter as { length?: number }).length = Math.max(0, params.emitterLength);
  }
  if (emitter.type === "box") {
    (emitter as { size?: [number, number, number] }).size = [
      Math.max(0, params.emitterBoxSize.x),
      Math.max(0, params.emitterBoxSize.y),
      Math.max(0, params.emitterBoxSize.z),
    ];
  }
  if (params.emissionMode === "burst") {
    emission.bursts = [{
      time: Math.max(0, params.burstTime),
      count: [Math.max(0, params.burstCount.x), Math.max(0, params.burstCount.y)],
      probability: Math.min(1, Math.max(0, params.burstProbability)),
    }];
    delete emission.rateOverTime;
  } else {
    emission.rateOverTime = Math.max(0, params.rateOverTime);
    delete emission.bursts;
  }
  start.lifetime = [Math.max(0.01, params.lifetimeRange.x), Math.max(0.01, params.lifetimeRange.y)];
  start.speed = [params.speedRange.x, params.speedRange.y];
  start.size = [Math.max(0, params.sizeRange.x), Math.max(0, params.sizeRange.y)];
  start.opacity = [Math.max(0, params.opacityRange.x), Math.min(1, Math.max(0, params.opacityRange.y))];
  start.rotation = [params.startRotationRange.x, params.startRotationRange.y];
  start.angularVelocity = [params.startAngularVelocityRange.x, params.startAngularVelocityRange.y];
  start.color = params.startColorMode === "range"
    ? [params.startColorA, params.startColorB]
    : params.startColorA;
  forces.drag = Math.max(0, params.drag);
  forces.acceleration = [params.acceleration.x, params.acceleration.y, params.acceleration.z];
  if (params.vortexEnabled) {
    forces.vortex = {
      center: [params.vortexCenter.x, params.vortexCenter.y, params.vortexCenter.z],
      axis: [params.vortexAxis.x, params.vortexAxis.y, params.vortexAxis.z],
      orbitalSpeed: params.vortexOrbitalSpeed,
      inward: params.vortexInward,
      upward: params.vortexUpward,
    };
  } else {
    delete forces.vortex;
  }
  if (params.noiseEnabled) {
    forces.noise = {
      ...(forces.noise ?? {}),
      strength: Math.max(0, params.noiseStrength),
      frequency: Math.max(0.001, params.noiseFrequency),
      scroll: [params.noiseScroll.x, params.noiseScroll.y, params.noiseScroll.z],
      octaves: Math.max(1, Math.round(params.noiseOctaves)),
      lacunarity: Math.max(0.01, params.noiseLacunarity),
      persistence: Math.max(0, params.noisePersistence),
    };
  } else {
    delete forces.noise;
  }
  rendererConfig.type = params.rendererType;
  rendererConfig.blendMode = params.rendererBlendMode;
  rendererConfig.align = params.rendererAlign;
  rendererConfig.sorting = params.rendererSorting;
  rendererConfig.texture = ctx.customRendererTexture.value
    ?? (params.rendererTexture === "hardDisc" ? hardDisc : params.rendererTexture === "spark" ? spark : softDisc);
  rendererConfig.depthWrite = params.rendererDepthWrite;
  rendererConfig.depthTest = params.rendererDepthTest;
  rendererConfig.softParticles = params.rendererSoftParticles;
  rendererConfig.softness = Math.max(0.01, params.rendererSoftness);
  if (params.rendererType === "stretchedBillboard") {
    rendererConfig.stretchFactor = Math.max(0, params.rendererStretchFactor);
    rendererConfig.stretchMaxScale = Math.max(1, params.rendererStretchMaxScale);
  } else {
    delete rendererConfig.stretchFactor;
    delete rendererConfig.stretchMaxScale;
  }
  if (params.rendererAlphaFromLuminanceEnabled) {
    rendererConfig.alphaFromLuminance = {
      enabled: true,
      blackCutoff: Math.min(255, Math.max(0, Math.round(params.rendererAlphaFromLuminanceBlackCutoff))),
    };
  } else {
    delete rendererConfig.alphaFromLuminance;
  }
  if (params.rendererTextureSheetEnabled) {
    rendererConfig.textureSheet = {
      columns: Math.max(1, Math.round(params.rendererTextureSheetColumns)),
      rows: Math.max(1, Math.round(params.rendererTextureSheetRows)),
      animationMode: params.rendererTextureSheetAnimationMode,
    };
  } else {
    delete rendererConfig.textureSheet;
  }
  if (params.dispersalEnabled) {
    const textureForDispersal = ctx.customDispersalTexture.value ?? rendererConfig.dispersal?.texture;
    const startAmount = THREE.MathUtils.clamp(params.dispersalAmount.x, 0, 1);
    const endAmount = THREE.MathUtils.clamp(params.dispersalAmount.y, 0, 1);
    const startAt = THREE.MathUtils.clamp(params.dispersalStartAt, 0, 1);
    rendererConfig.dispersal = {
      enabled: true,
      strength: Math.min(1, Math.max(0, params.dispersalStrength)),
      amount: [
        [0, startAmount],
        [startAt, startAmount],
        [1, endAmount],
      ],
      noiseScale: Math.max(0.01, params.dispersalNoiseScale),
      edgeSoftness: Math.max(0.001, params.dispersalEdgeSoftness),
      scroll: [params.dispersalScroll.x, params.dispersalScroll.y],
      ...(textureForDispersal ? { texture: textureForDispersal } : {}),
    };
  } else {
    delete rendererConfig.dispersal;
  }
  if (params.velocityOverLifetimeEnabled) {
    const velocityOverLifetime = (workingPreset.velocityOverLifetime ??= {});
    velocityOverLifetime.linear = {
      x: curveFromEndpoints(params.velocityLinearX.x, params.velocityLinearX.y),
      y: curveFromEndpoints(params.velocityLinearY.x, params.velocityLinearY.y),
      z: curveFromEndpoints(params.velocityLinearZ.x, params.velocityLinearZ.y),
    };
  } else {
    delete workingPreset.velocityOverLifetime;
  }

  if (params.sizeOverLifetimeEnabled) {
    overLifetime.size = curveFromBezierRange(
      params.sizeOverLifetime.x,
      params.sizeOverLifetime.y,
      params.sizeOverLifetimeBezier,
      5
    );
  } else {
    delete overLifetime.size;
  }

  if (params.colorOverLifetimeEnabled) {
    overLifetime.color = params.lifetimeGradient.colors.map(([t, c]) => [t, c] as [number, string]);
    overLifetime.opacity = params.lifetimeGradient.opacities.map(([t, a]) => [t, a] as [number, number]);
  } else {
    delete overLifetime.color;
    delete overLifetime.opacity;
  }

  if (params.limitVelocityEnabled) {
    workingPreset.limitVelocityOverLifetime = {
      speed: curveFromEndpoints(params.limitVelocitySpeed.x, params.limitVelocitySpeed.y),
      dampen: params.limitVelocityDampen,
    };
  } else {
    delete workingPreset.limitVelocityOverLifetime;
  }

  if (params.colorBySpeedEnabled) {
    workingPreset.colorBySpeed = {
      speedRange: [params.colorBySpeedRange.x, params.colorBySpeedRange.y],
      gradient: params.colorBySpeedGradient.colors.map(([t, c]) => [t, c] as [number, string]),
    };
  } else {
    delete workingPreset.colorBySpeed;
  }

  if (params.sizeBySpeedEnabled) {
    workingPreset.sizeBySpeed = {
      speedRange: [params.sizeBySpeedRange.x, params.sizeBySpeedRange.y],
      curve: curveFromEndpoints(params.sizeBySpeedMultiplier.x, params.sizeBySpeedMultiplier.y),
    };
  } else {
    delete workingPreset.sizeBySpeed;
  }

  if (params.rotationBySpeedEnabled) {
    workingPreset.rotationBySpeed = {
      speedRange: [params.rotationBySpeedRange.x, params.rotationBySpeedRange.y],
      angularVelocity: curveFromEndpoints(params.rotationBySpeedAngular.x, params.rotationBySpeedAngular.y),
    };
  } else {
    delete workingPreset.rotationBySpeed;
  }

  if (!overLifetime.size && !overLifetime.opacity && !overLifetime.color) {
    delete workingPreset.overLifetime;
  }
  ctx.refreshExportJson();
}
