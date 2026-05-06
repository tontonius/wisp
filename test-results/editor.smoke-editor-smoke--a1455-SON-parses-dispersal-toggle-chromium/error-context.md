# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor.smoke.spec.ts >> editor smoke >> boots, export JSON parses, dispersal toggle
- Location: tests/e2e/editor.smoke.spec.ts:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#pane-editor').locator('.tp-lblv').filter({ hasText: /^Enabled$/ }).first().locator('img').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - button "Scene" [ref=e7] [cursor=pointer]:
      - generic [ref=e8]: Scene
    - generic [ref=e11]:
      - button "Layers" [ref=e12] [cursor=pointer]:
        - generic [ref=e13]: Layers
      - generic [ref=e16]:
        - generic [ref=e17]:
          - button "Layers" [ref=e19]:
            - generic [ref=e20]: Layers
          - button "Export" [ref=e22]:
            - generic [ref=e23]: Export
        - generic [ref=e27]:
          - generic [ref=e28]:
            - generic [ref=e29]: Wisp effects JSON
            - textbox [ref=e32]: "{ \"effects\": { \"Layer_1\": { \"simulation\": \"auto\", \"simulationSpace\": \"local\", \"maxParticles\": 512, \"duration\": 1.5, \"loop\": true, \"prewarm\": false, \"emitter\": { \"type\": \"cone\", \"radius\": 0.25, \"angle\": 22, \"length\": 1.25 }, \"emission\": { \"rateOverTime\": 5 }, \"start\": { \"lifetime\": [ 0.8, 1.4000000000000001 ], \"speed\": [ 0.4, 1.8 ], \"size\": [ 1, 1 ], \"color\": \"rgb(255,255,255)\", \"opacity\": [ 1, 1 ], \"rotation\": [ 0, 0 ], \"angularVelocity\": [ 0, 0 ] }, \"forces\": { \"acceleration\": [ 0, 0.2, 0 ], \"drag\": 0.6, \"noise\": { \"strength\": 0.2, \"frequency\": 6, \"scroll\": [ 0, 0, 0 ], \"octaves\": 1, \"lacunarity\": 2, \"persistence\": 0.5 } }, \"velocityOverLifetime\": { \"linear\": { \"x\": [ [ 0, 0 ], [ 1, 0 ] ], \"y\": [ [ 0, 0 ], [ 1, 0.4 ] ], \"z\": [ [ 0, 0 ], [ 1, 0 ] ] } }, \"overLifetime\": { \"size\": [ [ 0, 1 ], [ 0.25, 0.8410833335151586 ], [ 0.5, 0.49436100851937637 ], [ 0.75, 0.15259979821141756 ], [ 1, 0 ] ], \"opacity\": [ [ 0, 0 ], [ 0.1, 1 ], [ 1, 0 ] ], \"color\": [ [ 0, \"#ffffff\" ], [ 0.45, \"#70e7ff\" ], [ 1, \"#ff7ad9\" ] ] }, \"renderer\": { \"texture\": \"[Texture:2b7a53ed-a3ce-4d1d-a955-ca477192bd70]\", \"blendMode\": \"alpha\", \"align\": \"camera\", \"sorting\": \"distance\", \"depthWrite\": false, \"type\": \"billboard\", \"depthTest\": true, \"softParticles\": false, \"softness\": 1.5 } } } }"
          - button "Copy Export JSON" [ref=e36] [cursor=pointer]:
            - generic [ref=e37]: Copy Export JSON
  - generic [ref=e39]:
    - button "Particle Editor" [ref=e40] [cursor=pointer]:
      - generic [ref=e41]: Particle Editor
    - generic [ref=e43]:
      - button "Preset" [ref=e45] [cursor=pointer]:
        - generic [ref=e46]: Preset
      - button "Particle System" [ref=e49] [cursor=pointer]:
        - generic [ref=e50]: Particle System
      - button "Emission" [ref=e53] [cursor=pointer]:
        - generic [ref=e54]: Emission
      - button "Emitter" [ref=e57] [cursor=pointer]:
        - generic [ref=e58]: Emitter
      - button "Start" [ref=e61] [cursor=pointer]:
        - generic [ref=e62]: Start
      - button "Forces" [ref=e65] [cursor=pointer]:
        - generic [ref=e66]: Forces
      - button "Velocity Over Lifetime" [ref=e69] [cursor=pointer]:
        - generic [ref=e70]: Velocity Over Lifetime
      - button "Size Over Lifetime" [ref=e73] [cursor=pointer]:
        - generic [ref=e74]: Size Over Lifetime
      - button "Color Over Lifetime" [ref=e77] [cursor=pointer]:
        - generic [ref=e78]: Color Over Lifetime
      - button "Limit Velocity Over Lifetime" [ref=e81] [cursor=pointer]:
        - generic [ref=e82]: Limit Velocity Over Lifetime
      - button "Color By Speed" [ref=e85] [cursor=pointer]:
        - generic [ref=e86]: Color By Speed
      - button "Size By Speed" [ref=e89] [cursor=pointer]:
        - generic [ref=e90]: Size By Speed
      - button "Rotation By Speed" [ref=e93] [cursor=pointer]:
        - generic [ref=e94]: Rotation By Speed
      - button "Renderer" [ref=e97] [cursor=pointer]:
        - generic [ref=e98]: Renderer
      - generic [ref=e100]:
        - button "Dispersal" [active] [ref=e101] [cursor=pointer]:
          - generic [ref=e102]: Dispersal
        - generic [ref=e105]:
          - generic [ref=e106]:
            - generic [ref=e107]: Enabled
            - generic [ref=e110]:
              - checkbox
              - img [ref=e112] [cursor=pointer]
          - button "Clear Texture" [ref=e117] [cursor=pointer]:
            - generic [ref=e118]: Clear Texture
          - generic [ref=e119]: Mask Preview
      - button "Actions" [ref=e122] [cursor=pointer]:
        - generic [ref=e123]: Actions
  - generic [ref=e126]:
    - button "Diagnostics" [ref=e127] [cursor=pointer]:
      - generic [ref=e128]: Diagnostics
    - generic [ref=e130]:
      - generic [ref=e131]:
        - generic [ref=e132]: FPS
        - generic [ref=e134]:
          - img [ref=e137]
          - generic: 65FPS
      - button "Runtime Stats" [ref=e140] [cursor=pointer]:
        - generic [ref=e141]: Runtime Stats
      - button "Validation" [ref=e144] [cursor=pointer]:
        - generic [ref=e145]: Validation
  - generic [ref=e148]:
    - button "Debug" [ref=e149] [cursor=pointer]:
      - generic [ref=e150]: Debug
    - generic [ref=e152]:
      - generic [ref=e153]:
        - generic [ref=e154]: Debug Gizmos
        - generic [ref=e157]:
          - checkbox
          - img [ref=e159] [cursor=pointer]
      - generic [ref=e161]:
        - button "Camera" [ref=e162] [cursor=pointer]:
          - generic [ref=e163]: Camera
        - generic [ref=e166]:
          - generic [ref=e167]:
            - generic [ref=e168]: Auto orbit
            - generic [ref=e171]:
              - checkbox [checked]
              - img [ref=e173] [cursor=pointer]
          - generic [ref=e175]:
            - generic [ref=e176]: Speed (deg/s)
            - textbox [ref=e185]: "18"
      - button "Movement" [ref=e188] [cursor=pointer]:
        - generic [ref=e189]: Movement
      - generic [ref=e191]:
        - generic [ref=e192]: Playback Speed
        - textbox [ref=e201]: "1.00"
      - generic [ref=e203]:
        - generic [ref=e204]: Playback (s)
        - textbox [ref=e213]: "1.07"
    - generic [ref=e215]:
      - button "Play" [ref=e216] [cursor=pointer]
      - button "Pause" [ref=e217] [cursor=pointer]
      - button "Reset" [ref=e218] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.describe("editor smoke", () => {
  4  |   test("boots, export JSON parses, dispersal toggle", async ({ page, context }) => {
  5  |     await context.grantPermissions(["clipboard-read", "clipboard-write"], {
  6  |       origin: "http://127.0.0.1:5174",
  7  |     });
  8  | 
  9  |     const consoleErrors: string[] = [];
  10 |     page.on("console", (msg) => {
  11 |       if (msg.type() === "error") consoleErrors.push(msg.text());
  12 |     });
  13 |     page.on("pageerror", (err) => {
  14 |       consoleErrors.push(err.message);
  15 |     });
  16 | 
  17 |     await page.goto("/editor/");
  18 |     await expect(page.locator("#viewport-canvas")).toBeVisible({ timeout: 60_000 });
  19 | 
  20 |     await expect(page.locator("#pane-editor")).toContainText(/particle/i);
  21 | 
  22 |     const exportTab = page.locator("#pane-layers").getByRole("button", { name: "Export" });
  23 |     await exportTab.click();
  24 | 
  25 |     const exportArea = page.locator("#pane-layers textarea").first();
  26 |     await expect(exportArea).toBeVisible();
  27 |     const jsonText = await exportArea.inputValue();
  28 |     const parsed = JSON.parse(jsonText) as { effects?: unknown };
  29 |     expect(parsed).toHaveProperty("effects");
  30 | 
  31 |     await page
  32 |       .locator("#pane-layers")
  33 |       .getByRole("button", { name: "Copy Export JSON" })
  34 |       .click({ force: true });
  35 |     const jsonAfterCopy = await exportArea.inputValue();
  36 |     expect(() => JSON.parse(jsonAfterCopy)).not.toThrow();
  37 | 
  38 |     const editor = page.locator("#pane-editor");
  39 |     await editor.getByText("Dispersal", { exact: true }).click();
  40 |     await expect(page.locator(".dispersal-preview-canvas")).toBeVisible();
  41 | 
  42 |     const dispersalEnabledToggle = editor
  43 |       .locator(".tp-lblv")
  44 |       .filter({ hasText: /^Enabled$/ })
  45 |       .first()
  46 |       .locator("img")
  47 |       .first();
> 48 |     await dispersalEnabledToggle.click({ force: true });
     |                                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
  49 |     await page.waitForTimeout(200);
  50 |     await dispersalEnabledToggle.click({ force: true });
  51 |     await page.waitForTimeout(200);
  52 | 
  53 |     expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  54 |   });
  55 | });
  56 | 
```