# Publish The Demo To GitHub Pages

The demo is a Vite app. GitHub Pages serves it as a project page for the `tontonius/wisp` repository, so production assets need the `/wisp/` base path.

## Build Locally For Pages

```bash
npm run build:pages
```

This sets `GITHUB_PAGES=true`, which makes `vite.config.ts` build with:

```ts
base: "/wisp/"
```

Normal local builds still use `/`:

```bash
npm run build
```

## Deploy From GitHub Actions

The workflow lives at:

```txt
.github/workflows/deploy-demo.yml
```

It runs on:

- Pushes to `main`.
- Manual `workflow_dispatch`.

The workflow:

1. Checks out the repo.
2. Installs dependencies with `npm ci`.
3. Builds with `npm run build:pages`.
4. Uploads `dist/` as a Pages artifact.
5. Deploys it with `actions/deploy-pages`.

## Repository Settings

In GitHub, configure Pages to use GitHub Actions:

```txt
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

The workflow also passes `enablement: true` to `actions/configure-pages`, so the first successful run can create/enable the Pages site if the repository permits it. If the workflow still fails with a Pages `Not Found` error, enable Pages through the repository settings above and rerun the workflow.

After a successful deploy, the demo should be available at:

```txt
https://tontonius.github.io/wisp/
```

## When To Update This

Update this page if:

- The repository name changes.
- The Pages URL changes.
- The Vite base path changes.
- The deployment workflow changes.
