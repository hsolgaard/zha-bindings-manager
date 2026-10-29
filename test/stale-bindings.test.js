import { describe, it, expect } from "vitest";
import {
  removedSources,
  deadTargetBindings,
  pruneRemovedSources,
  forgetSource,
  vanishedDevices,
  rememberDevices,
  knownDevicesToSave,
} from "../src/stale-bindings.js";

const LIVE = "aa:aa:aa:aa:aa:aa:aa:01";
const LIVE2 = "aa:aa:aa:aa:aa:aa:aa:02";
const GONE = "00:0d:6f:ff:fe:bc:cc:e0";
const GONE_TARGET = "bc:02:6e:ff:fe:d2:62:23";

const devices = [{ ieee: LIVE }, { ieee: LIVE2.toUpperCase() }];

function makeMap() {
  return new Map([
    [LIVE, [
      { id: "1", sourceIeee: LIVE, targetIeee: LIVE2, isGroup: false },
      { id: "2", sourceIeee: LIVE, targetIeee: GONE_TARGET, isGroup: false },
      { id: "3", sourceIeee: LIVE, isGroup: true, groupId: 5 },
    ]],
    [GONE, [
      { id: "4", sourceIeee: GONE, targetIeee: LIVE, isGroup: false },
      { id: "5", sourceIeee: GONE, targetIeee: LIVE2, isGroup: false },
    ]],
  ]);
}

describe("removedSources", () => {
  it("lists saved sources ZHA no longer has, with their binding counts", () => {
    expect(removedSources(makeMap(), devices)).toEqual([{ ieee: GONE, count: 2 }]);
  });
  it("matches IEEE addresses regardless of case", () => {
    const m = new Map([[LIVE2, []]]);
    expect(removedSources(m, devices)).toEqual([]);
  });
});

describe("deadTargetBindings", () => {
  it("returns bindings on live devices whose target was removed, never group bindings", () => {
    expect(deadTargetBindings(makeMap(), devices).map((b) => b.id)).toEqual(["2"]);
  });
  it("ignores bindings held by removed sources (those are forgotten, not unbound)", () => {
    const m = new Map([[GONE, [{ id: "x", sourceIeee: GONE, targetIeee: GONE_TARGET, isGroup: false }]]]);
    expect(deadTargetBindings(m, devices)).toEqual([]);
  });
});

describe("pruneRemovedSources", () => {
  it("deletes removed sources in place and returns their keys", () => {
    const m = makeMap();
    expect(pruneRemovedSources(m, devices)).toEqual([GONE]);
    expect([...m.keys()]).toEqual([LIVE]);
  });
  it("does nothing when the device list is empty, so a failed ZHA load can't wipe saved data", () => {
    const m = makeMap();
    expect(pruneRemovedSources(m, [])).toEqual([]);
    expect(m.size).toBe(2);
  });
});

describe("forgetSource", () => {
  it("drops one source's saved entry whatever its case, returning the binding count", () => {
    const m = makeMap();
    expect(forgetSource(m, GONE.toUpperCase())).toBe(2);
    expect(m.has(GONE)).toBe(false);
    expect(m.has(LIVE)).toBe(true);
  });
});

describe("vanishedDevices", () => {
  it("lists devices missing from the new list", () => {
    expect(vanishedDevices([{ ieee: LIVE }, { ieee: GONE }], [{ ieee: LIVE.toUpperCase() }])).toEqual([GONE]);
  });
  it("reports nothing when the new list is empty (failed load)", () => {
    expect(vanishedDevices([{ ieee: LIVE }], [])).toEqual([]);
  });
});

describe("rememberDevices / knownDevicesToSave", () => {
  const label = (d) => d.name;
  it("records names and reports changes only when something differs", () => {
    const known = new Map();
    expect(rememberDevices(known, [{ ieee: GONE.toUpperCase(), name: "Hall switch", model: "M" }], label)).toBe(true);
    expect(known.get(GONE).name).toBe("Hall switch");
    expect(rememberDevices(known, [{ ieee: GONE, name: "Hall switch", model: "M" }], label)).toBe(false);
    expect(rememberDevices(known, [{ ieee: GONE, name: "Renamed", model: "M" }], label)).toBe(true);
  });
  it("keeps live devices and removed devices still in saved bindings, drops the rest", () => {
    const known = new Map([
      [LIVE, { name: "live" }],
      [GONE, { name: "gone, still saved" }],
      [GONE_TARGET, { name: "gone, still a target" }],
      ["ff:ff:ff:ff:ff:ff:ff:ff", { name: "gone and forgotten" }],
    ]);
    const saved = knownDevicesToSave(known, devices, makeMap());
    expect(Object.keys(saved)).toEqual([GONE, GONE_TARGET, LIVE].sort());
  });
});
