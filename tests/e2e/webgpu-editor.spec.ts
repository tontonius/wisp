import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __WISP_EDITOR_STATUS__?: {
      phase?: string;
      viewportRenderer?: string;
      selectedBackend?: string;
      selectedGpuBackend?: string;
      selectedComputeMode?: string;
      selectedMotionMode?: string;
      selectedAlive?: number;
    };
  }
}

test.describe("webgpu editor", () => {
  test.skip(!process.env.WISP_WEBGPU_E2E, "Set WISP_WEBGPU_E2E=1 in a WebGPU-capable browser environment.");

  test("boots with WebGPU viewport and reports selected backend status", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto("/editor/?renderer=webgpu");
    await page.waitForFunction(() => window.__WISP_EDITOR_STATUS__?.phase === "ready", null, { timeout: 60_000 });

    const status = await page.evaluate(() => window.__WISP_EDITOR_STATUS__);
    expect(status).toMatchObject({
      phase: "ready",
      viewportRenderer: "webgpu",
    });
    expect(["cpu", "gpu", "none"]).toContain(status?.selectedBackend);
    expect(["none", "webgl", "webgpu"]).toContain(status?.selectedGpuBackend);
    expect(["none", "unavailable", "sidecar", "authoritative"]).toContain(status?.selectedComputeMode);
    expect(["none", "cpu-mirror", "motion-readback-bridge"]).toContain(status?.selectedMotionMode);
    expect(status?.selectedAlive ?? 0).toBeGreaterThanOrEqual(0);
    expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  });
});
