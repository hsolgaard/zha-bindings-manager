import { describe, it, expect } from "vitest";
import { unusualDeviceBindingRule } from "../src/health-rules.js";

describe("unusualDeviceBindingRule", () => {
  it("warns about a Basic binding between two devices, whatever its direction", () => {
    for (const classification of ["control", "reporting", "unknown"]) {
      const r = unusualDeviceBindingRule({ clusterId: 0x0000, classification });
      expect(r.level).toBe("warning");
      expect(r.code).toBe("unusual_basic");
    }
  });
  it("notes a reporting binding to another device as info, not a problem", () => {
    const r = unusualDeviceBindingRule({ clusterId: 0x0402, classification: "reporting" });
    expect(r.level).toBe("info");
    expect(r.code).toBe("reporting_to_device");
  });
  it("leaves ordinary control bindings and not-yet-classified ones alone", () => {
    expect(unusualDeviceBindingRule({ clusterId: 0x0006, classification: "control" })).toBeNull();
    expect(unusualDeviceBindingRule({ clusterId: 0x0008, classification: "unknown" })).toBeNull();
  });
});
