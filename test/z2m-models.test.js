import { describe, it, expect } from "vitest";
import { z2mProductCode } from "../src/capexplorer.js";

const map = {
  models: {
    "CH2AX/SWITCH/1": "41E2PBSWMZ/356PB2MBTZ",
    "RODRET wireless dimmer": "E2201",
    TS011F: "TS011F_plug_1",
  },
  fingerprints: {
    "_TZ3000_j0ktmul1|TS011F": "AUT000069",
  },
};

describe("z2mProductCode", () => {
  it("maps a Zigbee model string to the zigbee2mqtt product code", () => {
    expect(z2mProductCode(map, "Schneider Electric", "CH2AX/SWITCH/1")).toBe("41E2PBSWMZ/356PB2MBTZ");
    expect(z2mProductCode(map, "IKEA of Sweden", "RODRET wireless dimmer")).toBe("E2201");
  });

  it("prefers the manufacturer|model fingerprint over the bare model", () => {
    expect(z2mProductCode(map, "_TZ3000_j0ktmul1", "TS011F")).toBe("AUT000069");
  });

  it("only accepts a fingerprint match for ambiguous models", () => {
    expect(z2mProductCode(map, "_TZ3000_j0ktmul1", "TS011F", { ambiguous: true })).toBe("AUT000069");
    expect(z2mProductCode(map, "_TZ3000_other", "TS011F", { ambiguous: true })).toBe(null);
    expect(z2mProductCode(map, "_TZ3000_other", "TS011F")).toBe("TS011F_plug_1");
  });

  it("returns null with no map, no model or no match", () => {
    expect(z2mProductCode(null, "x", "CH2AX/SWITCH/1")).toBe(null);
    expect(z2mProductCode(map, "x", "")).toBe(null);
    expect(z2mProductCode(map, "x", "Unknown thing")).toBe(null);
    expect(z2mProductCode({}, "x", "CH2AX/SWITCH/1")).toBe(null);
  });
});
