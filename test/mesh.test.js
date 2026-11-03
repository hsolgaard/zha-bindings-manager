import { describe, it, expect } from "vitest";
import { buildMesh, routePath, pathVerdict, rateLqi, groupCheck, weakestLinks, meshSuggestions, nwkNumber } from "../src/mesh.js";

// C coordinator, A and B routers, L light (router), D remote (end device, child of A), E end device child of B
const C = "00:00:00:00:00:00:00:0c", A = "00:00:00:00:00:00:00:0a", B = "00:00:00:00:00:00:00:0b";
const L = "00:00:00:00:00:00:00:01", D = "00:00:00:00:00:00:00:0d", E = "00:00:00:00:00:00:00:0e";
const devices = [
  { ieee: C, nwk: 0, device_type: "Coordinator" },
  { ieee: A, nwk: "0x000a", device_type: "Router" },
  { ieee: B, nwk: "0x000b", device_type: "Router" },
  { ieee: L, nwk: "0x0001", device_type: "Router" },
  { ieee: D, nwk: "0x000d", device_type: "EndDevice" },
  { ieee: E, nwk: "0x000e", device_type: "EndDevice" },
];
const nb = (ieee, type, rel, lqi) => ({ ieee, nwk: null, type, rel, lqi });
const snapshot = {
  [C]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 200), nb(B, "Router", "Sibling", 190)] },
  [A]: { ok: true, routes: [{ dst: 1, next: 0x0b, status: "Active" }], neighbours: [nb(C, "Coordinator", "Sibling", 210), nb(B, "Router", "Sibling", 60), nb(D, "EndDevice", "Child", 170)] },
  [B]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 70), nb(L, "Router", "Sibling", 160), nb(C, "Coordinator", "Sibling", 180), nb(E, "EndDevice", "Child", 40)] },
  [L]: { ok: true, routes: [], neighbours: [nb(B, "Router", "Sibling", 150)] },
};

describe("mesh", () => {
  const mesh = buildMesh(snapshot, devices);

  it("parses nwk and rates LQI", () => {
    expect(nwkNumber("0x1A2B")).toBe(0x1a2b);
    expect(nwkNumber("1a2b")).toBeNull();
    expect(rateLqi(150)).toBe("good");
    expect(rateLqi(80)).toBe("fair");
    expect(rateLqi(79)).toBe("weak");
    expect(rateLqi(100, { good: 90, weak: 50 })).toBe("good");
  });

  it("builds links with the weaker direction, and parents", () => {
    expect(mesh.links.get(`${A}|${B}`.split("|").sort().join("|")).lqi).toBe(60);
    expect(mesh.parentOf.get(D)).toEqual({ parent: A, lqi: 170 });
    expect(mesh.children.get(B)).toBe(1);
  });

  it("walks remote → parent → routing table → light", () => {
    const p = routePath(mesh, D, L);
    expect(p.status).toBe("ok");
    expect(p.hops.map((h) => [h.from, h.to, h.lqi])).toEqual([[D, A, 170], [A, B, 60], [B, L, 150]]);
    const v = pathVerdict(p);
    expect(v.level).toBe("weak");
    expect(v.weakest.from).toBe(A);
  });

  it("stops honestly when there's no route", () => {
    const p = routePath(mesh, C, L); // C has no route entry and L isn't its neighbour
    expect(p.status).toBe("none");
    expect(pathVerdict(p).level).toBe("none");
    const unknown = routePath(mesh, "00:00:00:00:00:00:00:99", L);
    expect(unknown.status).toBe("none");
  });

  it("reaches an end-device target through its parent", () => {
    const p = routePath(mesh, A, E);
    // A has no route to B's child, but B is A's neighbour? goal is B (E's parent) → neighbour → hop
    expect(p.hops.map((h) => h.to)).toEqual([B, E]);
    expect(p.status).toBe("ok");
  });

  it("group check reports the parent link and each member's best router link", () => {
    const g = groupCheck(mesh, D, [L, E]);
    expect(g.parent).toEqual({ parent: A, lqi: 170 });
    expect(g.members[0].best).toEqual({ other: B, lqi: 150 });
    expect(g.members[1].best).toEqual({ other: B, lqi: 40 });
  });

  it("lists the weakest links and makes suggestions", () => {
    expect(weakestLinks(mesh, 2).map((l) => l.lqi)).toEqual([40, 60]);
    const s = meshSuggestions(mesh, { routers: [A, B, L], nameOf: (i) => i.slice(-2), areaOf: (i) => (i === E ? "Garage" : "") });
    const kinds = s.map((x) => x.kind);
    expect(kinds).toContain("weak_parent");
    expect(kinds).toContain("area_without_router");
    expect(s.find((x) => x.kind === "weak_parent").text).toMatch(/0e hears its parent 0b poorly \(LQI 40\)/);
  });
});

describe("route preference", () => {
  it("follows an active route entry even when the target is also a neighbour", () => {
    const snap = {
      [A]: { ok: true, routes: [{ dst: 1, next: 0x0b, status: "Active" }], neighbours: [nb(L, "Router", "Sibling", 40), nb(B, "Router", "Sibling", 200)] },
      [B]: { ok: true, routes: [], neighbours: [nb(L, "Router", "Sibling", 180), nb(A, "Router", "Sibling", 190)] },
    };
    const m = buildMesh(snap, devices);
    expect(routePath(m, A, L).hops.map((h) => h.to)).toEqual([B, L]);
  });
});

describe("1.5.0b2: stale entries and suggestions", () => {
  it("treats LQI 0 as stale: the other direction counts, or the link has no quality", () => {
    const snap = {
      [A]: { ok: true, routes: [], neighbours: [nb(B, "Router", "Sibling", 0), nb(L, "Router", "Sibling", 0)] },
      [B]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 170)] },
    };
    const m = buildMesh(snap, devices);
    expect(m.links.get([A, B].sort().join("|")).lqi).toBe(170);
    expect(m.links.get([A, L].sort().join("|")).lqi).toBeNull();
    expect(m.staleEntries).toBe(2);
    expect(weakestLinks(m).map((l) => l.lqi)).toEqual([170]);
  });

  it("single point of failure counts routers only; parents of 3+ battery devices get an info line", () => {
    const D2 = "00:00:00:00:00:00:00:d2", D3 = "00:00:00:00:00:00:00:d3";
    const snap = {
      [C]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 200)] },
      [A]: { ok: true, routes: [], neighbours: [nb(C, "Coordinator", "Sibling", 200), nb(B, "Router", "Sibling", 160), nb(L, "Router", "Sibling", 160), nb(D, "EndDevice", "Child", 150), nb(D2, "EndDevice", "Child", 150), nb(D3, "EndDevice", "Child", 150)] },
      [B]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 160)] },
      [L]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 160)] },
    };
    const m = buildMesh(snap, devices);
    const s = meshSuggestions(m, { routers: [A, B, L], nameOf: (i) => i.slice(-2) });
    const spof = s.find((x) => x.kind === "single_point");
    expect(spof.text).toMatch(/2 routers have no other good or fair link than 0a \(0b, 01\)/);
    expect(s.find((x) => x.kind === "many_children").text).toMatch(/0a is the parent of 3 battery devices/);
  });

  it("draws each router's strongest links only", async () => {
    const { visibleRouterLinks } = await import("../src/mesh.js");
    const m = buildMesh(snapshot, devices);
    const v = visibleRouterLinks(m, undefined, 1);
    expect(v.every((l) => typeof l.lqi === "number")).toBe(true);
    expect(v.length).toBeLessThan([...m.links.values()].length);
  });
});

describe("1.5.0b3: hangs on one link", () => {
  it("flags a router with a single usable link, even to the coordinator", () => {
    const snap = {
      [C]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 200), nb(L, "Router", "Sibling", 120)] },
      [A]: { ok: true, routes: [], neighbours: [nb(C, "Coordinator", "Sibling", 200), nb(B, "Router", "Sibling", 160)] },
      [B]: { ok: true, routes: [], neighbours: [nb(A, "Router", "Sibling", 160), nb(L, "Router", "Sibling", 8)] },
      [L]: { ok: true, routes: [], neighbours: [nb(C, "Coordinator", "Sibling", 130), nb(B, "Router", "Sibling", 12)] },
    };
    const m = buildMesh(snap, devices);
    const s = meshSuggestions(m, { routers: [A, B, L], nameOf: (i) => i.slice(-2) });
    const single = s.filter((x) => x.kind === "single_link").map((x) => x.text);
    expect(single).toContain("01 has only one usable link (to 0c, fair 120). A router nearer to it would give it a second route.");
    expect(single.some((t) => t.startsWith("0b has only one usable link (to 0a"))).toBe(true);
  });
});
