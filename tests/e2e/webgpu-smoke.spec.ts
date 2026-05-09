import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __WISP_WEBGPU_SMOKE__?: {
      phase?: string;
      backend?: string;
      computeMode?: string;
      motionMode?: string;
      aliveCount?: number;
    };
  }
}

test.describe("webgpu smoke", () => {
  test.skip(!process.env.WISP_WEBGPU_E2E, "Set WISP_WEBGPU_E2E=1 in a WebGPU-capable browser environment.");

  test("reports authoritative status fields", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto("/editor/webgpu-smoke.html");
    await page.waitForFunction(() => window.__WISP_WEBGPU_SMOKE__?.phase === "ready", null, { timeout: 60_000 });

    const state = await page.evaluate(() => window.__WISP_WEBGPU_SMOKE__);
    expect(state).toMatchObject({
      phase: "ready",
      backend: "webgpu",
      computeMode: "authoritative",
      motionMode: "motion-readback-bridge",
    });
    expect(state?.aliveCount ?? 0).toBeGreaterThan(0);
    expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  });
});
