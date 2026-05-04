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

Before the first deploy succeeds, turn on Pages and point it at Actions (the workflow does **not** auto-enable Pages; doing that from Actions often hits `Resource not accessible by integration` because the default token cannot create the Pages site for every repository).

In GitHub:

```txt
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

Save, then push to `main` (or run the workflow manually). If you see `Get Pages site failed` / `Not Found` in logs before changing this, that usually means Pages was not configured yet; set the source as above and rerun.

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
