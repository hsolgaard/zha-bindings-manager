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
 * Groups that bindings point at but Home Assistant doesn't know: usually
 * made on the devices themselves (Find & Bind, a remote's pairing button, or
 * another Zigbee system). [{groupId, controllers:[{sourceIeee, endpoint,
 * clusters}], others}], by group id. Commands to them still reach every
 * device that joined the group; Home Assistant just can't show or change it.
 */
export function deviceOnlyGroups({ groups, bindings, classify, coordinatorIeee }) {
  const known = new Set((groups || []).map((g) => Number(g.group_id)));
  const ids = new Set();
  for (const b of bindings || []) {
    if (b && b.isGroup && Number.isFinite(Number(b.groupId)) && !known.has(Number(b.groupId))) ids.add(Number(b.groupId));
  }
  const fake = [...ids].map((id) => ({ group_id: id, name: `Group ${groupIdHex(id)}`, members: [] }));
  return groupRows({ groups: fake, bindings, classify, coordinatorIeee })
    .map(({ groupId, controllers, others }) => ({ groupId, controllers, others }))
    .sort((a, b) => a.groupId - b.groupId);
}

/**
 * How to remove one binding to a group (1.10.5; was inside groupUnbindPlan).
 *
 * zha-toolkit's unbind_group only unbinds clusters the source *sends*
 * (checked in its binds.py: it looks for the cluster in the endpoint's
 * out_clusters and silently skips it otherwise). A light reporting its own
 * state to the group is bound on a cluster it *receives*, so that binding
 * needs binds_remove_all filtered to the endpoint and cluster instead. That
 * filter also removes every other binding on the same endpoint and cluster
 * (to other groups, or to the coordinator), so those are listed in `restore`
 * to be bound again straight afterwards.
 * - method "group": unbind_group.
 * - method "remove": binds_remove_all on that endpoint and cluster, then bind
 *   each of `restore` ([{isGroup, groupId} | {isGroup: false, ieee, endpoint}]) again.
 * clusters: ZHA cluster list [{id, endpoint_id, type}] of the source, or undefined.
 */
export function groupBindingOp(binding, bindings, clusters) {
  const op = { sourceIeee: normIeee(binding.sourceIeee), endpoint: Number(binding.sourceEndpoint), clusterId: Number(binding.clusterId) };
  const sends = (clusters || []).some((c) => c.type === "out" && Number(c.id) === op.clusterId && Number(c.endpoint_id) === op.endpoint);
  if (sends || !clusters) return { ...op, method: "group" };
  const gid = Number(binding.groupId);
  const seen = new Set();
  const restore = [];
  for (const x of bindings || []) {
    if (!x || normIeee(x.sourceIeee) !== op.sourceIeee || Number(x.sourceEndpoint) !== op.endpoint || Number(x.clusterId) !== op.clusterId) continue;
    if (x.isGroup && Number(x.groupId) === gid) continue;
    const t = x.isGroup
      ? { isGroup: true, groupId: Number(x.groupId) }
      : { isGroup: false, ieee: normIeee(x.targetIeee), endpoint: x.targetEndpoint != null ? Number(x.targetEndpoint) : 1 };
    const key = t.isGroup ? `g:${t.groupId}` : `d:${t.ieee}:${t.endpoint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    restore.push(t);
  }
  return { ...op, method: "remove", restore };
}

/**
 * The unbinds that clean up every binding pointing at a group before it's
 * deleted: [{sourceIeee, endpoint, clusterId, method, restore?}], one per
 * source endpoint and cluster (see groupBindingOp).
 * clustersFor(ieee) -> ZHA cluster list [{id, endpoint_id, type}] or undefined.
 */
export function groupUnbindPlan(groupId, bindings, { clustersFor = () => undefined } = {}) {
  const seen = new Set();
  const out = [];
  for (const b of bindings || []) {
    if (!b || !b.isGroup || Number(b.groupId) !== Number(groupId)) continue;
    const key = `${normIeee(b.sourceIeee)}:${Number(b.sourceEndpoint)}:${Number(b.clusterId)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const op = groupBindingOp(b, bindings, clustersFor(normIeee(b.sourceIeee)));
    if (op.method === "remove" && !op.restore.length) delete op.restore;
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
