import { describe, it, expect } from "vitest";
import { deviceHaUrl } from "../src/utils.js";

describe("deviceHaUrl", () => {
  it("points at Home Assistant's device page for the device's registry id", () => {
    expect(deviceHaUrl({ device_reg_id: "a1b2c3d4e5f6" })).toBe("/config/devices/device/a1b2c3d4e5f6");
  });
  it("returns null when the device has no registry id, so no link is shown", () => {
    expect(deviceHaUrl({ ieee: "aa:bb" })).toBeNull();
    expect(deviceHaUrl({ device_reg_id: "" })).toBeNull();
    expect(deviceHaUrl(null)).toBeNull();
    expect(deviceHaUrl(undefined)).toBeNull();
  });
  it("encodes unexpected characters in the id", () => {
    expect(deviceHaUrl({ device_reg_id: "a/b?c" })).toBe("/config/devices/device/a%2Fb%3Fc");
  });
});
