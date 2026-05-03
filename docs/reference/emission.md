# Emission Reference

Emission controls how particles are born over system time.

```ts
emission?: {
  rateOverTime?: Range;
  bursts?: Array<{
    time: number;
    count: Range;
    probability?: number;
  }>;
};
```

If `emission` is omitted, no particles spawn automatically. You can still call `system.emit(count)`.

## `rateOverTime`

```ts
emission: {
  rateOverTime: 120,
}
```

`rateOverTime` is particles per second.

It accepts a `Range`:

```ts
rateOverTime: [80, 140]
```

The current implementation samples `rateOverTime` during emission updates. For stable continuous emission, use a scalar.

## Bursts

```ts
emission: {
  bursts: [
    { time: 0, count: [20, 30] },
    { time: 0.18, count: 12, probability: 0.7 },
  ],
}
```

Fields:

| Field | Default | Description |
| --- | --- | --- |
| `time` | Required | System emission time in seconds when the burst fires. |
| `count` | Required | Number of particles to spawn. Can be a scalar or range. |
| `probability` | `1` | Chance that the burst fires when reached. |

Bursts are sorted by `time` internally.

## Duration And Loop Interaction

`duration` controls how long emission advances:

```ts
duration: 0.5,
loop: false,
```

For one-shots:

- Emission stops after `duration`.
- Existing particles continue updating until their lifetime expires.

For loops:

- Elapsed emission time wraps after `duration`.
- Burst cursor resets, allowing bursts to fire again each loop.

## Manual Emission

```ts
system.emit(40);
```

CPU backend:

- Spawns immediately until capacity is full.

GPU backend:

- Queues spawn ranges into GPU state slots.
- Respects `gpu.maxSpawnPerFrame`.
- Uses a cyclic spawn cursor.

## Common Patterns

One-shot burst:

```ts
duration: 0.1,
emission: {
  bursts: [{ time: 0, count: [20, 40] }],
}
```

Looping ambience:

```ts
duration: 4,
loop: true,
prewarm: true,
autoDispose: false,
emission: {
  rateOverTime: 600,
}
```

Layered burst:

```ts
emission: {
  bursts: [
    { time: 0, count: [60, 90] },
    { time: 0.08, count: [10, 20] },
    { time: 0.2, count: 8, probability: 0.5 },
  ],
}
```

