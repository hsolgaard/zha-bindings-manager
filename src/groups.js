// Pure logic for the Groups tab (1.5.0). card.js does the calls and renders.

import { normIeee } from "./utils.js";

/**
 * One row per ZHA group: its members and what's bound to it.
 * - groups: ZHA's zha/groups records.
 * - bindings: every known binding (flat list of normalized bindings).
 * - classify(b): "control" | "reporting" | "unknown" (the card's own rule).
 * - coordinatorIeee: left out of members (ZHA adds it to every group).
 * Returns [{groupId, name, members:[{ieee, endpoint}], controllers:[{sourceIeee,
 * endpoint, clusters:[ids]}], others: n}] sorted by name.
 */
export function groupRows({ groups, bindings, classify, coordinatorIeee }) {
  const coord = coordinatorIeee ? normIeee(coordinatorIeee) : null;
  return (groups || [])
    .map((g) => {
      const groupId = Number(g.group_id);
      const members = (g.members || [])
        .filter((m) => m && m.device && m.device.ieee && normIeee(m.device.ieee) !== coord)
        .map((m) => ({ ieee: normIeee(m.device.ieee), endpoint: Number(m.endpoint_id) }));
      const byController = new Map();
      let others = 0;
      for (const b of bindings || []) {
        if (!b || !b.isGroup || Number(b.groupId) !== groupId) continue;
        const cls = classify(b);
        if (cls === "reporting" || cls === "manufacturer") {
          others++;
          continue;
        }
        const key = `${normIeee(b.sourceIeee)}:${Number(b.sourceEndpoint)}`;
        if (!byController.has(key)) byController.set(key, { sourceIeee: normIeee(b.sourceIeee), endpoint: Number(b.sourceEndpoint), clusters: new Set() });
        byController.get(key).clusters.add(Number(b.clusterId));
      }
      const controllers = [...byController.values()].map((c) => ({ ...c, clusters: [...c.clusters].sort((a, b) => a - b) }));
      return { groupId, name: g.name || `Group ${groupId}`, members, controllers, others };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * The unbinds that clean up every binding pointing at a group before it's
 * deleted: [{sourceIeee, endpoint, clusterId, method}], one per binding.
 *
 * zha-toolkit's unbind_group only unbinds clusters the source *sends*
 * (checked in its binds.py: it looks for the cluster in the endpoint's
 * out_clusters and silently skips it otherwise). A light reporting its own
 * state to the group is bound on a cluster it *receives*, so that binding
 * needs binds_remove_all filtered to the endpoint and cluster instead. That
 * filter also removes every other binding on the same endpoint and cluster
 * (to other groups, or to the coordinator), so it's only used when the last
 * scan shows nothing else there.
 * - method "group": unbind_group.
 * - method "remove": binds_remove_all on that endpoint and cluster.
 * - method "skip": can't be removed without removing other bindings too.
 * clustersFor(ieee) -> ZHA cluster list [{id, endpoint_id, type}] or undefined.
 */
export function groupUnbindPlan(groupId, bindings, { clustersFor = () => undefined } = {}) {
  const seen = new Set();
  const out = [];
  const all = bindings || [];
  for (const b of all) {
    if (!b || !b.isGroup || Number(b.groupId) !== Number(groupId)) continue;
    const op = { sourceIeee: normIeee(b.sourceIeee), endpoint: Number(b.sourceEndpoint), clusterId: Number(b.clusterId) };
    const key = `${op.sourceIeee}:${op.endpoint}:${op.clusterId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const clusters = clustersFor(op.sourceIeee);
    const sends = (clusters || []).some((c) => c.type === "out" && Number(c.id) === op.clusterId && Number(c.endpoint_id) === op.endpoint);
    if (sends || !clusters) {
      op.method = "group";
    } else {
      const others = all.some(
        (x) =>
          x &&
          normIeee(x.sourceIeee) === op.sourceIeee &&
          Number(x.sourceEndpoint) === op.endpoint &&
          Number(x.clusterId) === op.clusterId &&
          !(x.isGroup && Number(x.groupId) === Number(groupId))
      );
      op.method = others ? "skip" : "remove";
    }
    out.push(op);
  }
  return out;
}

/** Whether a zha-toolkit error means the device didn't answer. An offline
 *  device typically comes back as an empty "unknown_error". */
export function noAnswerError(text) {
  return !text || /unknown[_ ]error|no details|timeout|timed out|delivery|not ?responding|didn't answer|no answer|deliveryerror|mac_no_ack|nwk_route/i.test(text);
}

/**
 * One line per device whose bindings to the group are still there after the
 * clean-up, saying why. devices: [{ieee, name, battery, skipped, errors:[], answered}].
 */
export function groupDeleteReasons(devices) {
  return devices.map((d) => {
    if (d.skipped) {
      return `${d.name}: it reports its own state to the group on a cluster it also uses for other bindings, and zha-toolkit can only remove them all together, so this one was left.`;
    }
    const errs = [...new Set((d.errors || []).filter(Boolean))];
    if (!d.answered || (errs.length && errs.every(noAnswerError))) {
      return d.battery
        ? `${d.name} didn't answer: it's on battery, so wake it (press a button) and try again.`
        : `${d.name} didn't answer: it may be offline or switched off at the wall.`;
    }
    if (errs.length) return `${d.name}: zha-toolkit said ${errs.slice(0, 2).join("; ")}.`;
    return `${d.name}: zha-toolkit reported success, but the binding is still there.`;
  });
}

/** Group IDs are shown the way ZHA shows them: 0x0005. */
export const groupIdHex = (id) => `0x${Number(id).toString(16).padStart(4, "0")}`;
