# How to run tests

Use these commands from the repository root.

## Run unit tests once

```bash
npm test
```

Runs the Vitest suite (`tests/unit/`) for library and editor logic.

## Run unit tests in watch mode

```bash
npm run test:watch
```

Starts Vitest in watch mode for rapid local iteration.

## Run browser smoke tests

```bash
npm run test:e2e
```

Runs the Playwright smoke suite (`tests/e2e/`) against the visual editor in a real Chromium browser.

## Run the WebGPU smoke harness

```bash
npm run dev
```

Open `http://localhost:5173/editor/webgpu-smoke.html` in a browser with WebGPU enabled. The page should show `ready`, `backend: webgpu`, and a nonzero alive count.

To run the optional Playwright WebGPU status check in a WebGPU-capable browser environment:

```bash
WISP_WEBGPU_E2E=1 npm run test:e2e -- webgpu-smoke
```

This check validates the smoke harness status object, including `compute: authoritative` and `motion: motion-readback-bridge`. It does not use canvas screenshots.

## Run all tests

```bash
npm run test:all
```

Runs unit tests first, then browser smoke tests.
