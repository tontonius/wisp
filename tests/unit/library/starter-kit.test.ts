import { describe, expect, it } from "vitest";
import { starterBillboardUrls } from "../../../src/particles/starter-kit";

describe("starter-kit assets", () => {
  it("exposes billboard sheet URL for smoke puffs", () => {
    expect(starterBillboardUrls.smokePuffsSheet4x4).toContain("4x4_smoke_puffs");
  });
});
