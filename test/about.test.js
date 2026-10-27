import { describe, it, expect } from "vitest";
import { aboutIntegrationText } from "../src/about.js";

const base = { checked: true, installed: true, storageOn: true, version: "1.0.0", bundledCardVersion: "1.0.0", cardVersion: "1.0.0" };

describe("aboutIntegrationText", () => {
  it("is empty until the integration check has run", () => {
    expect(aboutIntegrationText({ ...base, checked: false })).toBe("");
  });
  it("describes a card-only install", () => {
    expect(aboutIntegrationText({ ...base, installed: false, storageOn: false })).toMatch(/^Card-only install/);
  });
  it("names the integration version when everything matches", () => {
    expect(aboutIntegrationText(base)).toBe("ZHA Bindings Manager integration v1.0.0 is installed.");
  });
  it("warns when another copy of the card loaded first", () => {
    const t = aboutIntegrationText({ ...base, cardVersion: "0.36.5" });
    expect(t).toMatch(/running card v0\.36\.5, but the integration includes card v1\.0\.0/);
  });
  it("doesn't warn for integrations that don't report a bundled card", () => {
    expect(aboutIntegrationText({ ...base, version: "0.2.0", bundledCardVersion: null })).toBe(
      "ZHA Bindings Manager integration v0.2.0 is installed."
    );
  });
  it("says when shared storage is switched off", () => {
    expect(aboutIntegrationText({ ...base, storageOn: false })).toMatch(/Shared storage is switched off/);
  });
});
