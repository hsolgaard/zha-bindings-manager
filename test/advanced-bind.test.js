import { describe, it, expect } from "vitest";
import { bindingMatchesLoose, bindingKey } from "../src/parser.js";

// Advanced-tab bind checked against the device's table (zigbee-capabilities#387).
const b = (o) => ({ sourceIeee: "aa", sourceEndpoint: 1, clusterId: 0x0102, isGroup: false, targetIeee: "bb", targetEndpoint: 1, ...o });

describe("bindingMatchesLoose", () => {
  it("treats a missing endpoint, cluster list or target endpoint as 'any'", () => {
    const target = { isGroup: false, ieee: "BB", endpoint: null };
    expect(bindingMatchesLoose(b(), { sourceIeee: "AA", target })).toBe(true);
    expect(bindingMatchesLoose(b(), { sourceIeee: "aa", clusterIds: [6, 0x0102], sourceEp: 1, target })).toBe(true);
    expect(bindingMatchesLoose(b(), { sourceIeee: "aa", clusterIds: [6], target })).toBe(false);
    expect(bindingMatchesLoose(b(), { sourceIeee: "aa", sourceEp: 2, target })).toBe(false);
    expect(bindingMatchesLoose(b(), { sourceIeee: "aa", target: { isGroup: false, ieee: "bb", endpoint: 2 } })).toBe(false);
  });
  it("matches groups by id only", () => {
    const g = b({ isGroup: true, groupId: 5, targetIeee: null, targetEndpoint: null });
    expect(bindingMatchesLoose(g, { sourceIeee: "aa", target: { isGroup: true, groupId: 5 } })).toBe(true);
    expect(bindingMatchesLoose(g, { sourceIeee: "aa", target: { isGroup: false, ieee: "bb" } })).toBe(false);
  });
  it("gives each binding a stable key", () => {
    expect(bindingKey(b())).toBe(bindingKey(b({ sourceIeee: "AA", targetIeee: "BB" })));
    expect(bindingKey(b())).not.toBe(bindingKey(b({ clusterId: 6 })));
  });
});
