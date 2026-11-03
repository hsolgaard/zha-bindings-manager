// -----------------------------------------------------------------------
// Experimental (1.5.0 local build): route check and network map.
// Pure functions over a mesh snapshot — the routing and neighbour tables
// each router reported (read by the integration with zha-toolkit), shaped:
//   { "<router ieee>": { at, ok, error,
//       routes: [{dst, next, status, many_to_one}],          // nwk numbers
//       neighbours: [{ieee, nwk, type, rel, lqi}] } }        // lqi 0..255
// A neighbour entry in R's table gives the quality R hears that neighbour
// with, so a link's two directions can differ; the weaker one counts.
// Everything here is a prediction from snapshots: Zigbee has no traceroute.
// An LQI of 0 means "not heard recently" (a stale neighbour entry), not a
// terrible link, so 0 readings are ignored (1.5.0b2, from Hans's network).
// -----------------------------------------------------------------------
import { normIeee } from "./utils.js";

export const LQI_RECOMMENDED = Object.freeze({ good: 150, weak: 80 });
export const MAX_HOPS = 10;
// A router this many children or more gets an informational note.
export const MANY_CHILDREN = 10;

export function nwkNumber(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0xffff) return value;
  if (typeof value === "string" && /^0x[0-9a-f]{1,4}$/i.test(value.trim())) return parseInt(value.trim(), 16);
  return null;
}

export function rateLqi(lqi, thr = LQI_RECOMMENDED) {
  if (typeof lqi !== "number") return "unknown";
  if (lqi >= thr.good) return "good";
  if (lqi >= thr.weak) return "fair";
  return "weak";
}

const RANK = { weak: 0, unknown: 1, fair: 2, good: 3 };

function linkKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** devices: the card's ZHA device list ({ieee, nwk, device_type}). */
export function buildMesh(snapshot, devices = []) {
  const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
  const nwkToIeee = new Map();
  const typeOf = new Map();
  for (const d of devices) {
    const ieee = normIeee(d.ieee);
    const n = nwkNumber(d.nwk);
    if (n != null) nwkToIeee.set(n, ieee);
    if (d.device_type) typeOf.set(ieee, d.device_type === "EndDevice" ? "EndDevice" : d.device_type);
  }
  const links = new Map();
  const parentOf = new Map();
  const children = new Map();
  let staleEntries = 0;
  for (const [rawReporter, entry] of Object.entries(snap)) {
    const reporter = normIeee(rawReporter);
    for (const n of (entry && entry.neighbours) || []) {
      const other = normIeee(n.ieee);
      if (!other || other === reporter) continue;
      if (n.nwk != null && !nwkToIeee.has(n.nwk)) nwkToIeee.set(n.nwk, other);
      if (n.type && !typeOf.has(other)) typeOf.set(other, n.type);
      const key = linkKey(reporter, other);
      if (!links.has(key)) {
        const [a, b] = reporter < other ? [reporter, other] : [other, reporter];
        links.set(key, { a, b, heard: {} });
      }
      // heard[x] = how well x hears the other end; 0 = stale, not a reading
      const usable = typeof n.lqi === "number" && n.lqi > 0;
      links.get(key).heard[reporter] = usable ? n.lqi : null;
      if (!usable) staleEntries++;
      if (n.rel === "Child" && n.type === "EndDevice") {
        parentOf.set(other, { parent: reporter, lqi: typeof n.lqi === "number" && n.lqi > 0 ? n.lqi : null });
        children.set(reporter, (children.get(reporter) || 0) + 1);
      }
    }
  }
  for (const l of links.values()) {
    const vals = Object.values(l.heard).filter((v) => typeof v === "number");
    l.lqi = vals.length ? Math.min(...vals) : null;
  }
  return { snapshot: snap, nwkToIeee, typeOf, links, parentOf, children, staleEntries };
}

export function linkBetween(mesh, a, b) {
  return mesh.links.get(linkKey(normIeee(a), normIeee(b))) || null;
}

export function isRouterLike(mesh, ieee) {
  const t = mesh.typeOf.get(normIeee(ieee));
  return t === "Router" || t === "Coordinator";
}

function ieeeToNwk(mesh, ieee) {
  for (const [n, i] of mesh.nwkToIeee.entries()) if (i === ieee) return n;
  return null;
}

/** Predicted path for a command from source to target.
 *  Returns {status: "ok" | "partial" | "none", hops: [{from, to, lqi}], note} */
export function routePath(mesh, sourceIeee, targetIeee) {
  const source = normIeee(sourceIeee);
  const target = normIeee(targetIeee);
  const hops = [];
  const hop = (from, to) => {
    const l = linkBetween(mesh, from, to);
    hops.push({ from, to, lqi: l ? l.lqi : null });
  };
  if (source === target) return { status: "ok", hops, note: null };
  let current = source;
  if (!mesh.snapshot[source]) {
    const p = mesh.parentOf.get(source);
    if (!p) {
      if (linkBetween(mesh, source, target)) {
        hop(source, target);
        return { status: "ok", hops, note: null };
      }
      return { status: "none", hops, note: "Its parent router isn't known: no router listed it as a child. Scan again, or wake it first." };
    }
    hop(source, p.parent);
    current = p.parent;
  }
  // An end-device target is reached through its parent.
  const targetParent = !mesh.snapshot[target] && mesh.parentOf.get(target) ? mesh.parentOf.get(target).parent : null;
  const visited = new Set([current]);
  for (let i = 0; i < MAX_HOPS; i++) {
    if (current === target) return { status: "ok", hops, note: null };
    if (targetParent && current === targetParent) {
      hop(current, target);
      return { status: "ok", hops, note: null };
    }
    const entry = mesh.snapshot[current];
    if (!entry || !entry.ok) {
      return { status: "partial", hops, note: `${current} wasn't read, so the path stops there.` };
    }
    // An active routing-table entry is the route this router discovered;
    // without one, a direct neighbour is reached in one hop.
    const goal = targetParent || target;
    const goalNwk = ieeeToNwk(mesh, goal);
    const route = goalNwk == null ? null : (entry.routes || []).find((r) => r.dst === goalNwk && r.status === "Active");
    let next = null;
    if (route) {
      next = mesh.nwkToIeee.get(route.next) || null;
      if (!next) return { status: "partial", hops, note: `The next hop (0x${route.next.toString(16).padStart(4, "0")}) isn't a known device.` };
    } else if ((entry.neighbours || []).some((n) => normIeee(n.ieee) === goal)) {
      next = goal;
    }
    if (!next) {
      return { status: hops.length ? "partial" : "none", hops, note: "No active route to the target in this router's routing table (routes appear after recent traffic)." };
    }
    if (visited.has(next)) return { status: "partial", hops, note: "The routing tables loop back on themselves; they're probably out of date." };
    visited.add(next);
    hop(current, next);
    current = next;
  }
  return { status: "partial", hops, note: `Stopped after ${MAX_HOPS} hops.` };
}

/** {level: "good" | "weak" | "unknown" | "none", weakest} for a path. */
export function pathVerdict(path, thr = LQI_RECOMMENDED) {
  if (!path || path.status === "none") return { level: "none", weakest: null };
  let weakest = null;
  for (const h of path.hops) {
    if (typeof h.lqi !== "number") continue;
    if (!weakest || h.lqi < weakest.lqi) weakest = h;
  }
  const anyUnknown = path.hops.some((h) => typeof h.lqi !== "number");
  if (weakest && rateLqi(weakest.lqi, thr) === "weak") return { level: "weak", weakest };
  if (path.status !== "ok" || anyUnknown) return { level: "unknown", weakest };
  return { level: "good", weakest };
}

/** Best link a device has to any router or the coordinator. */
export function bestRouterLink(mesh, ieee) {
  const id = normIeee(ieee);
  let best = null;
  for (const l of mesh.links.values()) {
    if (l.a !== id && l.b !== id) continue;
    const other = l.a === id ? l.b : l.a;
    if (!isRouterLike(mesh, other) || typeof l.lqi !== "number") continue;
    if (!best || l.lqi > best.lqi) best = { other, lqi: l.lqi };
  }
  return best;
}

/** Group binding: no single route (it's a broadcast). Report the remote's
 *  parent link and each member's best link to a router. */
export function groupCheck(mesh, sourceIeee, memberIeees) {
  const src = normIeee(sourceIeee);
  const p = mesh.parentOf.get(src);
  return {
    parent: p ? { parent: p.parent, lqi: p.lqi } : null,
    sourceIsRouter: !!mesh.snapshot[src],
    members: memberIeees.map((m) => ({ ieee: normIeee(m), best: bestRouterLink(mesh, m) })),
  };
}

/** Links worth drawing: each router's `perRouter` strongest links to other
 *  routers, plus weak links that leave a router without a good one. */
export function visibleRouterLinks(mesh, thr = LQI_RECOMMENDED, perRouter = 3) {
  const keep = new Set();
  const byRouter = new Map();
  for (const l of mesh.links.values()) {
    if (typeof l.lqi !== "number" || !isRouterLike(mesh, l.a) || !isRouterLike(mesh, l.b)) continue;
    for (const end of [l.a, l.b]) {
      if (!byRouter.has(end)) byRouter.set(end, []);
      byRouter.get(end).push(l);
    }
  }
  for (const list of byRouter.values()) {
    list.sort((x, y) => y.lqi - x.lqi);
    list.slice(0, perRouter).forEach((l) => keep.add(l));
  }
  return [...keep];
}

/** All links with a known quality, weakest first. */
export function weakestLinks(mesh, limit = 10) {
  return [...mesh.links.values()]
    .filter((l) => typeof l.lqi === "number")
    .sort((x, y) => x.lqi - y.lqi)
    .slice(0, limit);
}

/** Plain suggestions. areaOf(ieee) → area name or "" ; nameOf(ieee) → label. */
export function meshSuggestions(mesh, { thr = LQI_RECOMMENDED, areaOf = () => "", nameOf = (i) => i, routers = [] } = {}) {
  const out = [];
  const routerSet = new Set(routers.map(normIeee));
  // Weak parent links.
  for (const [child, p] of mesh.parentOf.entries()) {
    if (rateLqi(p.lqi, thr) === "weak") {
      out.push({
        kind: "weak_parent",
        level: "warning",
        ieees: [child, p.parent],
        text: `${nameOf(child)} hears its parent ${nameOf(p.parent)} poorly (LQI ${p.lqi}). A router nearer to it would help.`,
      });
    }
  }
  // Single points of failure: routers whose only fair-or-better link to
  // another router is one router. (A battery device always has exactly one
  // parent by design, so it isn't counted here.)
  const dependsOn = new Map();
  const consider = new Set(routerSet);
  for (const dev of consider) {
    const ok = [];
    for (const l of mesh.links.values()) {
      if (l.a !== dev && l.b !== dev) continue;
      const other = l.a === dev ? l.b : l.a;
      if (!isRouterLike(mesh, other)) continue;
      if (RANK[rateLqi(l.lqi, thr)] >= RANK.fair) ok.push(other);
    }
    if (ok.length === 1) {
      if (!dependsOn.has(ok[0])) dependsOn.set(ok[0], []);
      dependsOn.get(ok[0]).push(dev);
    }
  }
  for (const [router, devs] of dependsOn.entries()) {
    if (devs.length === 1 || mesh.typeOf.get(router) === "Coordinator") {
      // 1.5.0b3: one router hanging on a single usable link.
      for (const dev of devs) {
        const l = linkBetween(mesh, dev, router);
        out.push({
          kind: "single_link",
          level: "warning",
          ieees: [dev, router],
          text: `${nameOf(dev)} has only one usable link (to ${nameOf(router)}, ${rateLqi(l && l.lqi, thr)} ${l && l.lqi}). A router nearer to it would give it a second route.`,
        });
      }
      continue;
    }
    out.push({
      kind: "single_point",
      level: "warning",
      ieees: [router, ...devs],
      text: `Single point of failure: ${devs.length} routers have no other good or fair link than ${nameOf(router)} (${devs.map(nameOf).join(", ")}). If it goes offline, they lose their way to the rest of the mesh.`,
    });
  }
  // Routers that hear nothing well.
  for (const r of routerSet) {
    const best = bestRouterLink(mesh, r);
    if (best && rateLqi(best.lqi, thr) === "weak") {
      out.push({
        kind: "isolated_router",
        level: "warning",
        ieees: [r],
        text: `${nameOf(r)} has no good or fair link to another router (best LQI ${best.lqi}).`,
      });
    }
  }
  // Parents of several battery devices: those all go quiet if it does.
  for (const [router, n] of mesh.children.entries()) {
    if (n >= 3) {
      const kids = [...mesh.parentOf.entries()].filter(([, p]) => p.parent === router).map(([c]) => nameOf(c));
      out.push({
        kind: "many_children",
        level: "info",
        ieees: [router],
        text: `${nameOf(router)} is the parent of ${n} battery devices (${kids.join(", ")}). If it's switched off at the wall, they lose contact until they find a new parent.`,
      });
    }
  }
  // Areas with devices but no router.
  const areas = new Map();
  for (const ieee of mesh.typeOf.keys()) {
    const a = areaOf(ieee);
    if (!a) continue;
    if (!areas.has(a)) areas.set(a, { routers: 0, devices: 0 });
    const e = areas.get(a);
    e.devices++;
    if (isRouterLike(mesh, ieee)) e.routers++;
  }
  for (const [area, e] of areas.entries()) {
    if (e.devices >= 1 && e.routers === 0) {
      out.push({ kind: "area_without_router", level: "info", ieees: [], text: `${area} has ${e.devices} Zigbee device${e.devices === 1 ? "" : "s"} but no router.` });
    }
  }
  const order = { warning: 0, info: 1 };
  return out.sort((x, y) => order[x.level] - order[y.level]);
}
