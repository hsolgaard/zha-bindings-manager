import { describe, it, expect } from "vitest";
import { changedDevices, noticeSummary, buildNetworkReport, reportIssue, addressFact } from "../src/evidence.js";

const C = "00:00:00:00:00:00:00:01";
const L = "aa:aa:aa:aa:aa:aa:aa:02";
const R = "aa:aa:aa:aa:aa:aa:aa:03";
const res = {
  since: "2026-11-08T00:00:00+00:00",
  addresses: {
    [C]: [{ nwk: "0x0000", from: "2026-11-08T00:00:00+00:00", seen: "snapshot" }],
    [L]: [
      { nwk: "0x1a2b", from: "2026-11-08T00:00:00+00:00", seen: "snapshot" },
      { nwk: "0x5c3d", from: "2026-11-08T06:30:00+00:00", seen: "joined" },
    ],
    [R]: [{ nwk: "0x0042", from: "2026-11-08T00:00:00+00:00", seen: "snapshot" }],
  },
  pairs: { [`${R}|${L}|1`]: { presses: 5, followed: 3, missed: 2 } },
  misses: [
    { at: "2026-11-08T09:00:00+00:00", remote: R, light: L, last_ok_at: "2026-11-08T05:00:00+00:00", address_changed_since_last_ok: true, binding_in_last_read: true },
  ],
};
const devices = [
  { ieee: C, manufacturer: "SONOFF", model: "Dongle-M", device_type: "Coordinator", power_source: "Mains", user_given_name: "Coord" },
  { ieee: L, manufacturer: "IKEA of Sweden", model: "TRADFRI bulb", device_type: "Router", power_source: "Mains", user_given_name: "Kitchen spots" },
  { ieee: R, manufacturer: "IKEA of Sweden", model: "TRADFRI on/off switch", device_type: "EndDevice", power_source: "Battery", user_given_name: "Hall switch" },
];

describe("address changes and missed presses (1.10.0)", () => {
  it("lists changed devices and sums up for the notice", () => {
    expect(changedDevices(res).map((d) => d.ieee)).toEqual([L]);
    expect(noticeSummary(res)).toEqual({ changed: 1, misses: 1, afterChange: 1, key: "1|1" });
    expect(noticeSummary({ addresses: {}, misses: [] })).toBeNull();
    expect(addressFact(res, L.toUpperCase())).toEqual({ nwk: "0x5c3d", changes: 1, since: "2026-11-08T06:30:00+00:00" });
  });

  it("builds an anonymous report with the coordinator and every device", () => {
    const rec = buildNetworkReport(res, devices, { firmwareOf: (d) => (d.model === "Dongle-M" ? "8.0.2" : "1.0"), cardVersion: "1.10.0", nowMs: Date.parse("2026-11-09T00:00:00Z") });
    const json = JSON.stringify(rec);
    for (const secret of [C, L, R, "0x5c3d", "Kitchen spots", "Hall switch", "06:30"]) expect(json).not.toContain(secret);
    expect(rec.coordinator).toEqual({ manufacturer: "SONOFF", model: "Dongle-M", firmware: "8.0.2" });
    expect(rec.network).toEqual({ devices: 3, routers: 1, end_devices: 1 });
    const bulb = rec.devices.find((d) => d.model === "TRADFRI bulb");
    expect(bulb.address_changes).toBe(1);
    expect(bulb.changes).toEqual([{ after_hours: 6.5, seen: "joined" }]);
    expect(rec.period.days).toBe(1);
    expect(rec.misses).toEqual([{ remote: expect.stringMatching(/^d\d$/), light: bulb.id, hours_since_last_ok: 4, address_changed_since_last_ok: true, binding_in_last_read: true }]);
    expect(rec.pairs[0]).toMatchObject({ light: bulb.id, presses: 5, missed: 2 });
    const issue = reportIssue(rec);
    expect(issue.title).toBe("[Network Report] 3 devices, 1 with address changes");
    expect(issue.url).toContain("labels=network-report");
  });
});
