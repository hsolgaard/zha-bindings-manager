// Pure logic for the "Control lights with this remote" flow (1.1.0).
// See the project PRD "Group-Based Binding Setup". Nothing here talks to
// Home Assistant; card.js does the calls and renders.

import { groupClusterSupport } from "./group-support.js";

/** Clusters the flow binds: what a light-control remote sends. */
export const FLOW_CLUSTERS = [0x0006, 0x0008, 0x0300];

/** Up to this many lights, binding to each light directly is offered as an
 *  alternative to a group (each costs one binding-table slot per cluster). */
export const DIRECT_BINDING_MAX_LIGHTS = 4;

export const RESULTS = ["works", "partial", "stored_ignored", "rejected"];

/** Endpoints of a device that send at least one FLOW_CLUSTERS cluster,
 *  as [{endpoint, clusters:[ids]}], sorted by endpoint. */
export function controllerEndpoints(clusters) {
  const byEp = new Map();
  for (const c of clusters || []) {
    if (c.type !== "out" || !FLOW_CLUSTERS.includes(Number(c.id))) continue;
    const ep = Number(c.endpoint_id);
    if (!byEp.has(ep)) byEp.set(ep, new Set());
    byEp.get(ep).add(Number(c.id));
  }
  return [...byEp.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([endpoint, set]) => ({ endpoint, clusters: [...set].sort((a, b) => a - b) }));
}

/**
 * Device endpoints that can receive at least one of `clusterIds`, excluding
 * the source device and the coordinator. `devices` are ZHA devices with a
 * display `name` already attached; `clustersFor(ieee)` returns the cached
 * cluster list or undefined.
 * Returns [{ieee, endpoint, name, clusters:[ids it accepts]}], sorted by name.
 */
export function candidateTargets({ devices, clustersFor, sourceIeee, clusterIds }) {
  const out = [];
  for (const d of devices || []) {
    if (d.isCoordinator || String(d.ieee).toLowerCase() === String(sourceIeee).toLowerCase()) continue;
    const clusters = clustersFor(d.ieee);
    if (!clusters) continue;
    const byEp = new Map();
    for (const c of clusters) {
      if (c.type !== "in" || !clusterIds.includes(Number(c.id))) continue;
      const ep = Number(c.endpoint_id);
      if (!byEp.has(ep)) byEp.set(ep, new Set());
      byEp.get(ep).add(Number(c.id));
    }
    const multi = byEp.size > 1;
    for (const [endpoint, set] of byEp) {
      out.push({
        ieee: d.ieee,
        endpoint,
        name: multi ? `${d.name} (ep ${endpoint})` : d.name,
        clusters: [...set].sort((a, b) => a - b),
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export const targetKey = (t) => `${String(t.ieee).toLowerCase()}:${Number(t.endpoint)}`;

/** An existing group whose non-coordinator members are exactly `targets`. */
export function findMatchingGroup(groups, targets, coordinatorIeee) {
  const want = new Set(targets.map(targetKey));
  const coord = String(coordinatorIeee || "").toLowerCase();
  return (
    (groups || []).find((g) => {
      const have = (g.members || [])
        .filter((m) => m.device && String(m.device.ieee).toLowerCase() !== coord)
        .map((m) => targetKey({ ieee: m.device.ieee, endpoint: m.endpoint_id }));
      return have.length === want.size && have.every((k) => want.has(k));
    }) || null
  );
}

/** Members of `targets` missing from `group` (to add to an existing group). */
export function missingMembers(group, targets) {
  const have = new Set(
    ((group && group.members) || [])
      .filter((m) => m.device)
      .map((m) => targetKey({ ieee: m.device.ieee, endpoint: m.endpoint_id }))
  );
  return targets.filter((t) => !have.has(targetKey(t)));
}

/**
 * Which of the source endpoint's clusters to bind, with support across the
 * selected lights. Clusters no selected light supports are returned with
 * `include: false` so the plan can say why they're left out.
 */
export function planClusters(sourceClusters, targets, clustersFor) {
  return (sourceClusters || []).map((clusterId) => {
    const support = groupClusterSupport({
      members: targets.map((t) => ({ ieee: t.ieee, endpoint: t.endpoint, name: t.name })),
      clusterId,
      clustersFor,
    });
    return { clusterId, support, include: support.supported.length > 0 };
  });
}

/**
 * The flow's overall result from the bind outcomes (one per bind attempt:
 * "confirmed" | "unconfirmed" | "failed") and the user's button test
 * ("all" | "some" | "none" | null when not asked yet).
 * Returns one of RESULTS, or "unconfirmed" / "pending_test" while it can't
 * be decided yet.
 */
export function flowResult(bindOutcomes, testAnswer) {
  const outs = bindOutcomes || [];
  if (outs.length && outs.every((o) => o === "failed")) return "rejected";
  if (outs.some((o) => o === "unconfirmed")) return "unconfirmed";
  if (!testAnswer) return "pending_test";
  if (testAnswer === "all") return outs.some((o) => o === "failed") ? "partial" : "works";
  if (testAnswer === "some") return "partial";
  return "stored_ignored";
}

const hex = (id) => `0x${Number(id).toString(16).padStart(4, "0")}`;

/** The JSON behaviour report shared to the capabilities database. No names,
 *  areas or IEEE addresses. */
export function buildBehaviourReport({ manufacturer, model, firmware, mode, endpoint, clusters, targetCount, result, cardVersion, now }) {
  return {
    kind: "behaviour_report",
    schema: 1,
    behaviour: mode === "direct" ? "direct_binding" : "group_binding",
    manufacturer: manufacturer || null,
    model: model || null,
    firmware: {
      sw_build_id: (firmware && firmware.sw_build_id) || null,
      registry_sw_version: (firmware && firmware.registry_sw_version) || null,
    },
    endpoint,
    clusters: (clusters || []).map(hex),
    target_count: targetCount,
    result,
    card_version: cardVersion,
    provenance: { submitted_at: (now || new Date()).toISOString() },
  };
}

export const RESULT_TEXT = {
  works: "works",
  partial: "works for some lights",
  stored_ignored: "stored but ignored",
  rejected: "rejected",
};

/** Firmware label used to group reports: sw_build_id, else the registry
 *  version, else "unknown". */
export function firmwareKey(fw) {
  return (fw && (fw.sw_build_id || fw.registry_sw_version)) || "unknown";
}

/**
 * What the community has reported for a remote, from data/behaviour.json:
 * { "<manufacturer_slug>/<model_slug>": { group_binding: { counts, by_firmware: { fw: counts } }, ... } }
 * Returns {state, total, counts, firmwareCounts, firmwareMatched, text}.
 * state: "unknown" | "works" | "problems" | "mixed".
 */
export function knownBehaviour(doc, slugKey, behaviour, firmware) {
  const entry = doc && doc[slugKey] && doc[slugKey][behaviour];
  if (!entry || !entry.counts) {
    return {
      state: "unknown",
      total: 0,
      text: "Nobody has reported how this remote handles this yet. The card will test it, and you can share the result.",
    };
  }
  const fwKey = firmwareKey(firmware);
  const fwCounts = entry.by_firmware && entry.by_firmware[fwKey];
  const counts = fwCounts || entry.counts;
  const total = RESULTS.reduce((n, r) => n + (counts[r] || 0), 0);
  const good = (counts.works || 0) + (counts.partial || 0);
  const bad = (counts.stored_ignored || 0) + (counts.rejected || 0);
  const state = !total ? "unknown" : bad === 0 ? "works" : good === 0 ? "problems" : "mixed";
  const parts = RESULTS.filter((r) => counts[r]).map((r) => `${counts[r]} ${RESULT_TEXT[r]}`);
  const scope = fwCounts
    ? fwKey === "unknown"
      ? ""
      : ` on firmware ${fwKey}`
    : ` (on other firmware than yours${fwKey === "unknown" ? "" : `, ${fwKey}`})`;
  const lead =
    state === "works"
      ? "Reported to work"
      : state === "problems"
      ? "Other users found this doesn't work"
      : "Reports are mixed";
  return {
    state,
    total,
    counts,
    firmwareMatched: !!fwCounts,
    text: `${lead}${scope}: ${parts.join(", ")} (${total} report${total === 1 ? "" : "s"}).`,
  };
}

/** Group name suggestion: "<area> lights" or "<remote> lights". */
export function suggestGroupName(areaName, remoteName) {
  const base = areaName && areaName !== "No area" ? areaName : remoteName || "Remote";
  return `${base} lights`;
}
