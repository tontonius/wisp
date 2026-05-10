import { describe, expect, it } from "vitest";
import { starterTextureUrls } from "../../../src/starter/textures";

describe("starter-kit assets", () => {
  it("exposes starter texture URLs", () => {
    expect(starterTextureUrls.smokePuffsSheet2x2).toContain("smoke-puffs-2x2");
  });
});
