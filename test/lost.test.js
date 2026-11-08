import { describe, it, expect } from "vitest";
import { lostSummary, lostFor, putBackMessage, sinceText } from "../src/lost.js";

const R = "aa:aa:aa:aa:aa:aa:aa:01";
const S = "aa:aa:aa:aa:aa:aa:aa:02";
const res = {
  enabled: true,
  devices: {
    [R]: { name: "Rocker", policy: "notify", expected: 2, lost: [{ key: "k1", text: "On/Off → Spot" }], queued: true, auto_paused: false },
    [S]: { name: "Alpha switch", policy: "auto", expected: 1, lost: [{ key: "k2" }, { key: "k3" }], queued: false, auto_paused: true },
    "aa:aa:aa:aa:aa:aa:aa:03": { name: "Off one", policy: "off", expected: 1, lost: [{ key: "k4" }] },
    "aa:aa:aa:aa:aa:aa:aa:04": { name: "Fine", policy: "notify", expected: 3, lost: [] },
  },
};

describe("lost bindings (1.8.0)", () => {
  it("counts lost bindings, ignoring devices that are off or fine", () => {
    const s = lostSummary(res);
    expect(s.total).toBe(3);
    expect(s.devices.map((d) => d.name)).toEqual(["Alpha switch", "Rocker"]);
    expect(s.queued).toBe(1);
    expect(s.paused).toBe(1);
    expect(lostSummary(null).total).toBe(0);
  });

  it("finds one device, whatever the address case", () => {
    expect(lostFor(res, R.toUpperCase()).queued).toBe(true);
    expect(lostFor(res, "aa:aa:aa:aa:aa:aa:aa:03").lost).toEqual([]);
    expect(lostFor(res, "bb:bb:bb:bb:bb:bb:bb:bb").policy).toBe("notify");
  });

  it("explains what Put back did", () => {
    expect(putBackMessage({ [R]: "put_back" }, () => "Rocker")).toEqual({ level: "success", text: "Put back on Rocker." });
    const m = putBackMessage({ [R]: "waiting", [S]: "still_missing" }, (i) => (i === R ? "Rocker" : "Alpha"));
    expect(m.level).toBe("warning");
    expect(m.text).toContain("Rocker didn't answer");
    expect(m.text).toContain("Alpha answered but still doesn't");
    expect(putBackMessage({}).text).toBe("Nothing to put back.");
  });

  it("says when it was noticed", () => {
    const now = new Date(2026, 10, 8, 12, 0).getTime();
    expect(sinceText(new Date(2026, 10, 8, 3, 17).toISOString(), now)).toBe("today 03:17");
    expect(sinceText(new Date(2026, 10, 7, 23, 0).toISOString(), now)).toBe("yesterday");
    expect(sinceText(new Date(2026, 10, 5, 3, 0).toISOString(), now)).toBe("3 days ago");
    expect(sinceText("nonsense", now)).toBe("");
  });
});

import { deviceOnlyGroups } from "../src/groups.js";

describe("groups only on devices", () => {
  const R = "aa:aa:aa:aa:aa:aa:aa:01";
  it("lists group ids that bindings use but ZHA doesn't know", () => {
    const bindings = [
      { sourceIeee: R, sourceEndpoint: 2, clusterId: 6, isGroup: true, groupId: 0x12ed },
      { sourceIeee: R, sourceEndpoint: 2, clusterId: 8, isGroup: true, groupId: 0x12ed },
      { sourceIeee: R, sourceEndpoint: 1, clusterId: 6, isGroup: true, groupId: 5 },
      { sourceIeee: R, sourceEndpoint: 1, clusterId: 6, isGroup: false, targetIeee: R },
    ];
    const out = deviceOnlyGroups({ groups: [{ group_id: 5, name: "Kitchen" }], bindings, classify: () => "control" });
    expect(out).toHaveLength(1);
    expect(out[0].groupId).toBe(0x12ed);
    expect(out[0].controllers).toEqual([{ sourceIeee: R, endpoint: 2, clusters: [6, 8] }]);
    expect(deviceOnlyGroups({ groups: [], bindings: [], classify: () => "control" })).toEqual([]);
  });
});
