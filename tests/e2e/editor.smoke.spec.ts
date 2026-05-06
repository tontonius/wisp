import { expect, test } from "@playwright/test";

test.describe("editor smoke", () => {
  test("boots, export JSON parses, dispersal toggle", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://127.0.0.1:5174",
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto("/editor/");
    await expect(page.locator("#viewport-canvas")).toBeVisible({ timeout: 60_000 });

    await expect(page.locator("#pane-editor")).toContainText(/particle/i);

    const exportTab = page.locator("#pane-layers").getByRole("button", { name: "Export" });
    await exportTab.click();

    const exportArea = page.locator("#pane-layers textarea").first();
    await expect(exportArea).toBeVisible();
    const jsonText = await exportArea.inputValue();
    const parsed = JSON.parse(jsonText) as { effects?: unknown };
    expect(parsed).toHaveProperty("effects");

    await page
      .locator("#pane-layers")
      .getByRole("button", { name: "Copy Export JSON" })
      .click({ force: true });
    const jsonAfterCopy = await exportArea.inputValue();
    expect(() => JSON.parse(jsonAfterCopy)).not.toThrow();

    const editor = page.locator("#pane-editor");
    await editor.getByText("Dispersal", { exact: true }).click();
    await expect(page.locator(".dispersal-preview-canvas")).toBeVisible();

    const dispersalEnabledToggle = editor
      .locator(".tp-lblv")
      .filter({ hasText: /^Enabled$/ })
      .first()
      .locator("img")
      .first();
    await dispersalEnabledToggle.click({ force: true });
    await page.waitForTimeout(200);
    await dispersalEnabledToggle.click({ force: true });
    await page.waitForTimeout(200);

    expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  });
});
