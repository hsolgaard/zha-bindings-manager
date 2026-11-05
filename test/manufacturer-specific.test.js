import { describe, it, expect } from "vitest";
import { isManufacturerSpecific, manufacturerSpecificRule } from "../src/health-rules.js";

describe("isManufacturerSpecific", () => {
  it("is 0xFC00 to 0xFFFF", () => {
    expect(isManufacturerSpecific(0xfffd)).toBe(true);
    expect(isManufacturerSpecific(0xfc00)).toBe(true);
    expect(isManufacturerSpecific(0xfc7c)).toBe(true);
    expect(isManufacturerSpecific(0xfbff)).toBe(false);
    expect(isManufacturerSpecific(0x0006)).toBe(false);
    expect(isManufacturerSpecific(0x1000)).toBe(false);
  });
  it("gives an info note, never a warning or advice to remove", () => {
    const r = manufacturerSpecificRule(0xfffd);
    expect(r.level).toBe("info");
    expect(r.message).toBe("Manufacturer-specific cluster (0xfffd), not checked.");
    expect(r.recommendation).toMatch(/Leave it in place/);
  });
});
