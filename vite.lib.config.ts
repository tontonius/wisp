import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        webgpu: resolve(__dirname, "src/webgpu.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [/^three(\/.*)?$/],
    },
  },
});
