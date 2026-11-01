import { describe, it, expect } from "vitest";
import { groupClusterSupport, groupSupportSummary, groupSupportHealth } from "../src/group-support.js";

const LEVEL = 8;
const dimmable = [{ id: 6, endpoint_id: 1, type: "in" }, { id: 8, endpoint_id: 1, type: "in" }];
const onOffOnly = [{ id: 6, endpoint_id: 1, type: "in" }];
const clusters = { a: dimmable, b: onOffOnly, c: onOffOnly, ep2: [{ id: 8, endpoint_id: 2, type: "in" }], remote: [{ id: 8, endpoint_id: 1, type: "out" }] };
const clustersFor = (ieee) => clusters[ieee];
const m = (ieee, name, extra = {}) => ({ ieee, endpoint: 1, name, ...extra });

describe("groupClusterSupport", () => {
  it("splits members into supported, unsupported and not yet read", () => {
    const r = groupClusterSupport({
      members: [m("a", "Lamp A"), m("b", "Plug B"), m("x", "Unread X")],
      clusterId: LEVEL,
      clustersFor,
    });
    expect(r).toEqual({ total: 3, supported: ["Lamp A"], unsupported: ["Plug B"], unknown: ["Unread X"] });
  });
  it("checks the member's own endpoint and only input clusters", () => {
    const r = groupClusterSupport({ members: [m("ep2", "Two-ep"), m("remote", "Remote")], clusterId: LEVEL, clustersFor });
    expect(r.unsupported).toEqual(["Two-ep", "Remote"]);
  });
  it("leaves the coordinator out of the count", () => {
    const r = groupClusterSupport({ members: [m("coord", "Coordinator", { isCoordinator: true }), m("a", "Lamp A")], clusterId: LEVEL, clustersFor });
    expect(r.total).toBe(1);
    expect(r.unknown).toEqual([]);
  });
});

describe("groupSupportSummary", () => {
  it("warns when no member supports the cluster (Hans's Rodret test)", () => {
    const s = groupSupportSummary({ total: 1, supported: [], unsupported: ["Sonoff light"], unknown: [] }, "Level Control", "Test group");
    expect(s.level).toBe("warning");
    expect(s.text).toBe(
      "No device in Test group supports Level Control (Sonoff light). The binding can still be made, but nothing in the group will act on these commands."
    );
  });
  it("lists both sides when only some members support it", () => {
    const s = groupSupportSummary({ total: 3, supported: ["A", "B"], unsupported: ["C"], unknown: [] }, "Level Control", "Kitchen");
    expect(s.level).toBe("info");
    expect(s.text).toBe("2 of 3 devices in Kitchen support Level Control (A, B). Not supported: C, which will ignore these commands.");
  });
  it("is a short positive line when everything supports it", () => {
    expect(groupSupportSummary({ total: 2, supported: ["A", "B"], unsupported: [], unknown: [] }, "On/Off", "Hall").text).toBe(
      "All 2 devices in Hall support On/Off."
    );
    expect(groupSupportSummary({ total: 1, supported: ["A"], unsupported: [], unknown: [] }, "On/Off", "Hall").text).toBe(
      "The device in Hall supports On/Off."
    );
  });
  it("says so when members haven't been read, and when the group is empty", () => {
    expect(groupSupportSummary({ total: 2, supported: [], unsupported: [], unknown: ["A", "B"] }, "On/Off", "Hall").level).toBe("unknown");
    expect(groupSupportSummary({ total: 2, supported: ["A"], unsupported: [], unknown: ["B"] }, "On/Off", "Hall").text).toContain("Not checked yet: B.");
    expect(groupSupportSummary({ total: 0, supported: [], unsupported: [], unknown: [] }, "On/Off", "Hall").level).toBe("empty");
  });
});

describe("groupSupportHealth", () => {
  it("is a warning when nothing in the group can act on the binding", () => {
    const h = groupSupportHealth({ total: 1, supported: [], unsupported: ["Sonoff light"], unknown: [] }, "Level Control", "Test group");
    expect(h.level).toBe("warning");
    expect(h.code).toBe("group_cluster_unsupported");
  });
  it("is info when only some members support it", () => {
    expect(groupSupportHealth({ total: 2, supported: ["A"], unsupported: ["B"], unknown: [] }, "Level Control", "G").code).toBe("group_cluster_partial");
  });
  it("warns about an empty group", () => {
    expect(groupSupportHealth({ total: 0, supported: [], unsupported: [], unknown: [] }, "On/Off", "G").code).toBe("group_empty");
  });
  it("says nothing when all members support it or none have been read", () => {
    expect(groupSupportHealth({ total: 2, supported: ["A", "B"], unsupported: [], unknown: [] }, "On/Off", "G")).toBeNull();
    expect(groupSupportHealth({ total: 2, supported: [], unsupported: [], unknown: ["A", "B"] }, "On/Off", "G")).toBeNull();
  });
});
