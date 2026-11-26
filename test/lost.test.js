import { describe, it, expect } from "vitest";
import { lostSummary, lostFor, putBackMessage, putBackDone, putBackStatus, sinceText } from "../src/lost.js";

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

  it("reads the integration's real Put back result (1.11.1)", () => {
    // Exactly what watch_put_back sends: {results: {ieee: {status, count, still}}}.
    const results = {
      [R]: { status: "put_back", count: 3, still: [] },
      [S]: { status: "waiting", count: 1, still: [{ key: "k2" }] },
    };
    expect(putBackStatus(results[R])).toBe("put_back");
    expect(putBackStatus("still_missing")).toBe("still_missing");
    expect(putBackStatus(null)).toBe("nothing");
    expect(putBackDone(results)).toEqual([R]);
    const m = putBackMessage(results, (i) => (i === R ? "Rocker" : "Alpha"));
    expect(m.text).toContain("Put back on Rocker.");
    expect(m.text).toContain("Alpha didn't answer");
    expect(m.text).not.toContain("Nothing to put back");
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

import { lostBindings, repairedDevices } from "../src/lost.js";

describe("re-paired devices and lost rows (1.12.0)", () => {
  const W = "44:9f:da:ff:fe:a4:a7:6d";
  const L = "aa:aa:aa:aa:aa:aa:aa:09";
  const res = {
    devices: {
      [W]: {
        name: "ZB-LoungeBIG-Switch-Wall2",
        policy: "notify",
        lost: [
          { key: "k1", sourceIeee: W, sourceEndpoint: 1, clusterId: 6, isGroup: false, targetIeee: L.toUpperCase(), targetEndpoint: 1, since: "2026-11-26T18:05:00Z", noticed_by: "repaired" },
          { key: "k2", sourceIeee: W, sourceEndpoint: 2, clusterId: 6, isGroup: true, groupId: 5, since: "2026-11-26T18:05:00Z", noticed_by: "repaired" },
        ],
        repaired: { at: "2026-11-26T18:04:00Z", removed_at: "2026-11-26T13:15:00Z", missing_groups: [{ group_id: 5, endpoint_id: 1, name: "Lounge" }] },
      },
      [L]: { name: "Light", policy: "off", lost: [{ key: "x" }] },
    },
  };

  it("lists lost bindings as rows with their own ids", () => {
    const rows = lostBindings(res);
    expect(rows.map((r) => r.id)).toEqual([`lost:${W}:k1`, `lost:${W}:k2`]);
    expect(rows[0].targetIeee).toBe(L); // normalised for the device filter
    expect(rows[1].isGroup).toBe(true);
    expect(rows.every((r) => r.lost && r.ownerIeee === W)).toBe(true);
  });

  it("lists re-paired devices with what's missing", () => {
    const rep = repairedDevices(res);
    expect(rep).toEqual([
      { ieee: W, name: "ZB-LoungeBIG-Switch-Wall2", at: "2026-11-26T18:04:00Z", removedAt: "2026-11-26T13:15:00Z", missingGroups: [{ group_id: 5, endpoint_id: 1, name: "Lounge" }], lost: 2 },
    ]);
    expect(lostFor(res, W).repaired.removed_at).toBe("2026-11-26T13:15:00Z");
  });
});
