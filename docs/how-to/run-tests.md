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

## Run all tests

```bash
npm run test:all
```

Runs unit tests first, then browser smoke tests.
