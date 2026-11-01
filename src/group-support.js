// Which members of a ZHA group can act on a cluster bound to that group.
// A remote bound to a group on Level Control sends dim commands to every
// member, but only members whose endpoint has Level Control as an input
// cluster will do anything with them. Before 1.0.5 the card bound it and
// said "confirmed" with no hint that nothing in the group could dim
// (Hans, testing an IKEA Rodret bound to a group of on/off-only lights).

/**
 * @param {object} p
 * @param {Array<{ieee:string, endpoint:number, name:string, isCoordinator?:boolean}>} p.members
 * @param {number} p.clusterId
 * @param {(ieee:string) => Array<{id:number, endpoint_id:number, type:string}>|undefined} p.clustersFor
 *        cluster list for a device, or undefined if not read yet
 * @returns {{total:number, supported:string[], unsupported:string[], unknown:string[]}}
 *   The coordinator is left out: it's often a group member but never acts on commands.
 */
export function groupClusterSupport({ members, clusterId, clustersFor }) {
  const out = { total: 0, supported: [], unsupported: [], unknown: [] };
  for (const m of members || []) {
    if (m.isCoordinator) continue;
    out.total++;
    const clusters = clustersFor(m.ieee);
    if (!clusters) {
      out.unknown.push(m.name);
      continue;
    }
    const has = clusters.some(
      (c) => c.type === "in" && Number(c.endpoint_id) === Number(m.endpoint) && Number(c.id) === Number(clusterId)
    );
    (has ? out.supported : out.unsupported).push(m.name);
  }
  return out;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const list = (names) => names.join(", ");

/**
 * One-line summary for the Advanced tab and the post-bind status.
 * level: "ok" | "info" | "warning" | "unknown" | "empty"
 */
export function groupSupportSummary(res, clusterLabel, groupName) {
  if (!res.total) {
    return {
      level: "empty",
      text: `${groupName} has no members yet, so nothing will act on ${clusterLabel} commands sent to it.`,
    };
  }
  const known = res.supported.length + res.unsupported.length;
  const unknownNote = res.unknown.length
    ? ` Not checked yet: ${list(res.unknown)}.`
    : "";
  if (!known) {
    return { level: "unknown", text: `Checking which devices in ${groupName} support ${clusterLabel}…` };
  }
  if (!res.unsupported.length) {
    return {
      level: "ok",
      text: `${res.supported.length === res.total ? (res.total === 1 ? "The device" : `All ${res.total} devices`) : plural(res.supported.length, "device", "devices")} in ${groupName} support${
        res.supported.length === 1 ? "s" : ""
      } ${clusterLabel}.${unknownNote}`,
    };
  }
  if (!res.supported.length) {
    return {
      level: "warning",
      text: `No device in ${groupName} supports ${clusterLabel} (${list(res.unsupported)}). The binding can still be made, but nothing in the group will act on these commands.${unknownNote}`,
    };
  }
  return {
    level: "info",
    text: `${res.supported.length} of ${res.total} devices in ${groupName} support ${clusterLabel} (${list(
      res.supported
    )}). Not supported: ${list(res.unsupported)}, which will ignore these commands.${unknownNote}`,
  };
}

/**
 * Binding Health result for an existing group binding, or null when there's
 * nothing to say (all members support it, or nothing has been read yet).
 */
export function groupSupportHealth(res, clusterLabel, groupName) {
  if (!res.total) {
    return {
      level: "warning",
      code: "group_empty",
      message: `${groupName} has no members.`,
      why: "Commands sent to an empty group reach nothing. This often happens when the lights in a group were removed or re-paired.",
      recommendation: "Add devices to the group in ZHA, or remove this binding.",
    };
  }
  if (!res.unsupported.length) return null;
  if (!res.supported.length) {
    return {
      level: "warning",
      code: "group_cluster_unsupported",
      message: `No device in ${groupName} supports ${clusterLabel}.`,
      why: `The source sends ${clusterLabel} commands to the group, but none of its members (${list(
        res.unsupported
      )}) can act on them. The binding is valid but does nothing, and it uses one of the source's binding-table slots.`,
      recommendation: `Remove this binding, or add a device that supports ${clusterLabel} to the group.`,
    };
  }
  return {
    level: "info",
    code: "group_cluster_partial",
    message: `${res.supported.length} of ${res.total} devices in ${groupName} support ${clusterLabel}.`,
    why: `Not supported: ${list(res.unsupported)}. Those devices ignore these commands, while the others act on them.`,
    recommendation: null,
  };
}
