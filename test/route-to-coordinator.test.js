import { describe, it, expect } from "vitest";
import { buildMesh, routeToCoordinator, routersOnPath, oldestHopRead, pathVerdict } from "../src/mesh.js";

// Coordinator C (0x0000). R1 hears C weakly but routes via R2; R2 is C's neighbour.
// R3 routes via R1. Battery device E is R3's child. R4 has no routing table.
const C = "00:00:00:00:00:00:00:0c", R1 = "00:00:00:00:00:00:00:01", R2 = "00:00:00:00:00:00:00:02";
const R3 = "00:00:00:00:00:00:00:03", R4 = "00:00:00:00:00:00:00:04", E = "00:00:00:00:00:00:00:0e";
const devices = [
  { ieee: C, nwk: "0x0000", device_type: "Coordinator" },
  { ieee: R1, nwk: "0x0001", device_type: "Router" },
  { ieee: R2, nwk: "0x0002", device_type: "Router" },
  { ieee: R3, nwk: "0x0003", device_type: "Router" },
  { ieee: R4, nwk: "0x0004", device_type: "Router" },
  { ieee: E, nwk: "0x000e", device_type: "EndDevice" },
];
const nb = (ieee, type, rel, lqi) => ({ ieee, nwk: null, type, rel, lqi });
// Inactive slots for 0x0000 are how empty routing-table entries come back.
const empty = { dst: 0, next: 0, status: "Inactive", many_to_one: false };
const snapshot = {
  [C]: { ok: true, at: "2026-11-22T21:48:00Z", routes: [empty], neighbours: [nb(R2, "Router", "Sibling", 200), nb(R1, "Router", "Sibling", 50)] },
  [R1]: { ok: true, at: "2026-11-22T21:49:00Z", routes: [empty, { dst: 0, next: 2, status: "Active" }], neighbours: [nb(C, "Coordinator", "Sibling", 48), nb(R2, "Router", "Sibling", 170), nb(R3, "Router", "Sibling", 140)] },
  [R2]: { ok: true, at: "2026-11-22T21:50:00Z", routes: [{ dst: 0, next: 0, status: "Active" }], neighbours: [nb(C, "Coordinator", "Sibling", 190), nb(R1, "Router", "Sibling", 160)] },
  [R3]: { ok: true, at: "2026-11-03T17:35:00Z", routes: [{ dst: 0, next: 1, status: "Active" }], neighbours: [nb(R1, "Router", "Sibling", 130), nb(E, "EndDevice", "Child", 120)] },
  [R4]: { ok: true, at: "2026-11-22T21:51:00Z", routes: [], neighbours: [nb(R3, "Router", "Sibling", 100)] },
};

describe("route to the coordinator (1.11.0)", () => {
  const mesh = buildMesh(snapshot, devices);

  it("follows the active route, not the weak direct link, and ignores empty slots", () => {
    const p = routeToCoordinator(mesh, R1, C);
    expect(p.status).toBe("ok");
    expect(p.hops.map((h) => [h.from, h.to])).toEqual([[R1, R2], [R2, C]]);
    expect(p.hops.map((h) => h.lqi)).toEqual([160, 190]);
  });

  it("walks several hops and records when each hop's router was read", () => {
    const p = routeToCoordinator(mesh, R3, C);
    expect(p.hops.map((h) => h.from)).toEqual([R3, R1, R2]);
    expect(p.hops[0].readAt).toBe("2026-11-03T17:35:00Z");
    expect(oldestHopRead(p)).toBe("2026-11-03T17:35:00.000Z");
    expect(routersOnPath(mesh, p)).toEqual([R3, R1, R2]);
  });

  it("starts a battery device at its parent, dated by the parent's read", () => {
    const p = routeToCoordinator(mesh, E, C);
    expect(p.hops[0]).toMatchObject({ from: E, to: R3, lqi: 120, readAt: "2026-11-03T17:35:00Z" });
    expect(p.hops.map((h) => h.to)).toEqual([R3, R1, R2, C]);
    expect(routersOnPath(mesh, p)).toEqual([R3, R1, R2]);
    expect(pathVerdict(p).level).toBe("good");
  });

  it("says so when a router has no route to the coordinator", () => {
    const p = routeToCoordinator(mesh, R4, C);
    expect(p.status).toBe("none");
    expect(p.note).toMatch(/No active route/);
  });

  it("handles the coordinator itself and a missing coordinator", () => {
    expect(routeToCoordinator(mesh, C, C)).toMatchObject({ status: "ok", hops: [] });
    expect(routeToCoordinator(mesh, R1, null).status).toBe("none");
  });
});
