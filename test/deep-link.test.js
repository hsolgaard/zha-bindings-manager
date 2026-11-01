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
