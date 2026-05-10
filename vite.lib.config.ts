import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        webgpu: resolve(__dirname, "src/webgpu.ts"),
        starter: resolve(__dirname, "src/starter/index.ts"),
        "starter/textures": resolve(__dirname, "src/starter/textures/index.ts"),
        "starter/effects": resolve(__dirname, "src/starter/effects/index.ts"),
        "starter/effects/explosion": resolve(__dirname, "src/starter/effects/explosion.ts"),
        "starter/effects/muzzle-flash": resolve(__dirname, "src/starter/effects/muzzle-flash.ts"),
        "starter/effects/smoke-puff": resolve(__dirname, "src/starter/effects/smoke-puff.ts"),
        "starter/effects/hit-sparks": resolve(__dirname, "src/starter/effects/hit-sparks.ts"),
        "starter/effects/magic-burst": resolve(__dirname, "src/starter/effects/magic-burst.ts"),
        "starter/effects/run-smoke": resolve(__dirname, "src/starter/effects/run-smoke.ts"),
        "starter/effects/jump-smoke-ring": resolve(__dirname, "src/starter/effects/jump-smoke-ring.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [/^three(\/.*)?$/],
    },
  },
});
