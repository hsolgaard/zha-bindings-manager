import { describe, it, expect } from "vitest";
import {
  DIRECTION_ALL,
  DIRECTION_OUTBOUND,
  DIRECTION_INBOUND,
  bindingDirection,
  matchesDeviceFilter,
  directionRank,
  directionLabel,
  emptyTableState,
  deviceNameText,
  findSingleDeviceBySearch,
} from "../src/table-filter.js";

const A = "aa:aa";
const B = "bb:bb";
const C = "cc:cc";

const aToB = { sourceIeee: A, targetIeee: B, isGroup: false };
const bToA = { sourceIeee: B, targetIeee: A, isGroup: false };
const bToC = { sourceIeee: B, targetIeee: C, isGroup: false };
const aSelf = { sourceIeee: A, targetIeee: A, isGroup: false };
const aToGroup = { sourceIeee: A, groupId: 5, isGroup: true };
const bToGroup = { sourceIeee: B, groupId: 5, isGroup: true };

describe("bindingDirection", () => {
  it("is outbound when the device is the source", () => {
    expect(bindingDirection(aToB, A)).toBe(DIRECTION_OUTBOUND);
  });
  it("is inbound when the device is the direct target of another device", () => {
    expect(bindingDirection(aToB, B)).toBe(DIRECTION_INBOUND);
  });
  it("is null for a binding that does not involve the device", () => {
    expect(bindingDirection(bToC, A)).toBeNull();
  });
  it("treats a self-bound row as outbound only, so it is never double counted", () => {
    expect(bindingDirection(aSelf, A)).toBe(DIRECTION_OUTBOUND);
  });
  it("does not treat group bindings as inbound", () => {
    expect(bindingDirection(bToGroup, A)).toBeNull();
    expect(bindingDirection(aToGroup, A)).toBe(DIRECTION_OUTBOUND);
  });
  it("is null when no device is given", () => {
    expect(bindingDirection(aToB, null)).toBeNull();
  });
});

describe("matchesDeviceFilter", () => {
  const all = [aToB, bToA, bToC, aSelf, aToGroup, bToGroup];
  const pick = (ieee, dir) => all.filter((b) => matchesDeviceFilter(b, ieee, dir));

  it("matches everything when no device is filtered", () => {
    expect(pick(null, DIRECTION_ALL)).toHaveLength(all.length);
  });
  it("All shows outbound and inbound for the device", () => {
    expect(pick(A, DIRECTION_ALL)).toEqual([aToB, bToA, aSelf, aToGroup]);
  });
  it("Outbound shows only rows the device sources", () => {
    expect(pick(A, DIRECTION_OUTBOUND)).toEqual([aToB, aSelf, aToGroup]);
  });
  it("Inbound shows only rows another device aims at it", () => {
    expect(pick(A, DIRECTION_INBOUND)).toEqual([bToA]);
  });
  it("lists a self-bound row once under All", () => {
    expect(pick(A, DIRECTION_ALL).filter((b) => b === aSelf)).toHaveLength(1);
  });
  it("defaults to All", () => {
    expect(matchesDeviceFilter(bToA, A)).toBe(true);
  });
  it("shows the Rodret to dimmer case from both sides", () => {
    const rodret = "rodret";
    const dimmer = "dimmer";
    const control = { sourceIeee: rodret, targetIeee: dimmer, isGroup: false };
    expect(matchesDeviceFilter(control, rodret, DIRECTION_ALL)).toBe(true);
    expect(matchesDeviceFilter(control, dimmer, DIRECTION_ALL)).toBe(true);
    expect(bindingDirection(control, rodret)).toBe(DIRECTION_OUTBOUND);
    expect(bindingDirection(control, dimmer)).toBe(DIRECTION_INBOUND);
  });
});

describe("direction display helpers", () => {
  it("ranks outbound before inbound", () => {
    expect(directionRank(DIRECTION_OUTBOUND)).toBeLessThan(directionRank(DIRECTION_INBOUND));
  });
  it("labels each direction", () => {
    expect(directionLabel(DIRECTION_OUTBOUND)).toBe("→ Outbound");
    expect(directionLabel(DIRECTION_INBOUND)).toBe("← Inbound");
    expect(directionLabel(null)).toBe("");
  });
});

describe("emptyTableState", () => {
  it("reports nothing scanned when there are no bindings at all", () => {
    const s = emptyTableState({ total: 0, deviceFilterActive: false, deviceMatches: 0, direction: DIRECTION_ALL });
    expect(s.kind).toBe("not-scanned");
    expect(s.message).toContain("Scan bindings");
  });
  it("does not blame the scan when a device filter hides everything", () => {
    const s = emptyTableState({
      total: 12,
      deviceFilterActive: true,
      deviceMatches: 0,
      direction: DIRECTION_ALL,
      deviceName: "Kitchen light",
    });
    expect(s.kind).toBe("device-filter");
    expect(s.message).toContain("No bindings involve Kitchen light");
    expect(s.message).toContain("hiding 12 other bindings");
    expect(s.message).not.toContain("Scan bindings");
  });
  it("names the direction when Outbound or Inbound is empty", () => {
    const base = { total: 3, deviceFilterActive: true, deviceMatches: 0, deviceName: "Lamp" };
    expect(emptyTableState({ ...base, direction: DIRECTION_OUTBOUND }).message).toContain("No outbound bindings from Lamp");
    expect(emptyTableState({ ...base, direction: DIRECTION_INBOUND }).message).toContain("No inbound bindings to Lamp");
  });
  it("explains that hiding coordinator bindings is why the coordinator looks empty", () => {
    const s = emptyTableState({
      total: 9,
      deviceFilterActive: true,
      deviceMatches: 0,
      direction: DIRECTION_ALL,
      deviceName: "Coordinator",
      coordinatorHidden: true,
    });
    expect(s.kind).toBe("device-filter");
    expect(s.message).toContain("Hide coordinator bindings");
    expect(s.message).not.toContain("hiding 9");
  });
  it("uses singular wording for a single hidden binding", () => {
    const s = emptyTableState({ total: 1, deviceFilterActive: true, deviceMatches: 0, direction: DIRECTION_ALL, deviceName: "X" });
    expect(s.message).toContain("hiding 1 other binding.");
    expect(s.message).toContain("see it");
  });
  it("says filters match nothing when the device filter itself has matches", () => {
    const s = emptyTableState({ total: 12, deviceFilterActive: true, deviceMatches: 4, direction: DIRECTION_ALL, deviceName: "X" });
    expect(s.kind).toBe("other-filters");
    expect(s.message).toBe("No bindings match the current filters.");
  });
  it("says filters match nothing when health chips or search empty an unfiltered table", () => {
    const s = emptyTableState({ total: 12, deviceFilterActive: false, deviceMatches: 12, direction: DIRECTION_ALL });
    expect(s.kind).toBe("other-filters");
  });
});

describe("deviceNameText", () => {
  it("includes both the user-given name and the original ZHA name, lowercased", () => {
    expect(deviceNameText({ user_given_name: "ZB-TestBed-Switch-Dim1", name: "Repenic RD-250ZG" })).toBe(
      "zb-testbed-switch-dim1 repenic rd-250zg"
    );
  });
  it("copes with a missing user-given name or a missing device", () => {
    expect(deviceNameText({ name: "Lamp" })).toBe("lamp");
    expect(deviceNameText(null)).toBe("");
  });
});

describe("findSingleDeviceBySearch", () => {
  const devices = [
    { ieee: "1", user_given_name: "ZB-TestBed-Switch-Dim1", name: "Repenic RD-250ZG" },
    { ieee: "2", user_given_name: "Test dimmer", name: "IKEA of Sweden RODRET wireless dimmer" },
    { ieee: "3", user_given_name: "ZB-MainBR-Switch-ORB1", name: "SONOFF SNZB-01M" },
  ];
  it("finds the device by its original name", () => {
    expect(findSingleDeviceBySearch(devices, "repenic").ieee).toBe("1");
  });
  it("finds the same device by the name the user gave it", () => {
    expect(findSingleDeviceBySearch(devices, "Dim1").ieee).toBe("1");
  });
  it("returns null when several devices match, so search stays an ordinary text filter", () => {
    expect(findSingleDeviceBySearch(devices, "switch")).toBeNull();
    expect(findSingleDeviceBySearch(devices, "zb-")).toBeNull();
  });
  it("returns null when nothing matches", () => {
    expect(findSingleDeviceBySearch(devices, "zzz")).toBeNull();
  });
  it("ignores terms shorter than three characters so the layout does not jump while typing", () => {
    expect(findSingleDeviceBySearch(devices, "re")).toBeNull();
    expect(findSingleDeviceBySearch(devices, "rep").ieee).toBe("1");
  });
  it("ignores surrounding spaces and empty or missing input", () => {
    expect(findSingleDeviceBySearch(devices, "  repenic ").ieee).toBe("1");
    expect(findSingleDeviceBySearch(devices, "")).toBeNull();
    expect(findSingleDeviceBySearch(devices, undefined)).toBeNull();
    expect(findSingleDeviceBySearch(null, "repenic")).toBeNull();
  });
});
