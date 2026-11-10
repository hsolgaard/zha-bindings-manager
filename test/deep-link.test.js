import { describe, it, expect } from "vitest";
import { deepLinkIeee, withoutDeviceParam } from "../src/deep-link.js";

describe("deepLinkIeee", () => {
  it("normalises the address however it's written", () => {
    expect(deepLinkIeee("?device=08:FD:52:FF:FE:0B:3F:86")).toBe("08:fd:52:ff:fe:0b:3f:86");
    expect(deepLinkIeee("?device=08fd52fffe0b3f86")).toBe("08:fd:52:ff:fe:0b:3f:86");
    expect(deepLinkIeee("?x=1&device=08-fd-52-ff-fe-0b-3f-86")).toBe("08:fd:52:ff:fe:0b:3f:86");
  });
  it("ignores missing or malformed values", () => {
    expect(deepLinkIeee("")).toBeNull();
    expect(deepLinkIeee("?device=kitchen")).toBeNull();
    expect(deepLinkIeee(undefined)).toBeNull();
  });
});

describe("withoutDeviceParam", () => {
  it("drops only the device parameter", () => {
    expect(withoutDeviceParam("?device=08fd52fffe0b3f86")).toBe("");
    expect(withoutDeviceParam("?a=1&device=08fd52fffe0b3f86")).toBe("?a=1");
  });
});

import { TAB_NAMES, viewFromHash, hashForView } from "../src/deep-link.js";
describe("tab in the address (1.10.2)", () => {
  it("maps readable tab names to views and back", () => {
    expect(viewFromHash("#bindings")).toBe("table");
    expect(viewFromHash("#Floor-Plan")).toBe("floorplan");
    expect(viewFromHash("network")).toBe("mesh");
    expect(viewFromHash("#capabilities")).toBe("capexplorer");
    for (const view of Object.keys(TAB_NAMES)) expect(viewFromHash(hashForView(view))).toBe(view);
  });
  it("ignores anything that isn't a tab", () => {
    expect(viewFromHash("")).toBeNull();
    expect(viewFromHash("#")).toBeNull();
    expect(viewFromHash("#table")).toBeNull();
    expect(viewFromHash("#device=1")).toBeNull();
    expect(hashForView("nonsense")).toBe("#map");
  });
});
