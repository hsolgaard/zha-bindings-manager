// Replace a device (1.9.0). The integration plans and copies the bindings
// (replace_plan / replace_run / replace_cleanup); this is the card-side
// logic around it: which devices to offer as the new one, what the
// community database says about commands, and the wording. Pure only.

import { normIeee } from "./utils.js";
import { slugify } from "./capexplorer.js";

/** New-device candidates, likely ones first: same model, then same type,
 *  then the rest by name. Never the old device or the coordinator. */
export function replacementCandidates(devices, old, { coordinatorIeee = null, typeOf = () => null, nameOf = (d) => d.name || d.ieee } = {}) {
  const oldIeee = normIeee(old.ieee || "");
  const coord = coordinatorIeee ? normIeee(coordinatorIeee) : null;
  const oldType = typeOf(old);
  const score = (d) =>
    d.manufacturer && d.model && d.manufacturer === old.manufacturer && d.model === old.model ? 0 : oldType && typeOf(d) === oldType ? 1 : 2;
  return (devices || [])
    .filter((d) => d && d.ieee && normIeee(d.ieee) !== oldIeee && normIeee(d.ieee) !== coord && d.device_type !== "Coordinator")
    .map((d) => ({ device: d, rank: score(d) }))
    .sort((a, b) => a.rank - b.rank || String(nameOf(a.device)).localeCompare(String(nameOf(b.device))))
    .map(({ device, rank }) => ({ device, why: rank === 0 ? "same model" : rank === 1 ? "same kind of device" : "" }));
}

const confirmedByCluster = (index, dev) => {
  const out = new Map(); // cluster hex -> {present:Set, checked:boolean}
  const m = slugify(dev && dev.manufacturer);
  const mo = slugify(dev && dev.model);
  for (const e of index || []) {
    if (e.manufacturer_slug !== m || e.model_slug !== mo) continue;
    for (const [hex, c] of Object.entries(e.clusters || {})) {
      const key = hex.toLowerCase();
      const cur = out.get(key) || { present: new Set(), checked: false };
      if ((c.commands_received_scan_count || 0) > 0) cur.checked = true;
      for (const r of c.commands_received || []) if (r.present === true) cur.present.add(r.name);
      out.set(key, cur);
    }
  }
  return out;
};

/**
 * Commands the old model accepts that the new model was checked and doesn't,
 * per cluster the replacement receives on, from the community index.
 * [{clusterId, missing:[names]}] plus `unknown` (models or clusters nobody
 * has checked yet).
 */
export function commandGaps(index, oldDev, newDev, clusterIds) {
  const oldC = confirmedByCluster(index, oldDev);
  const newC = confirmedByCluster(index, newDev);
  const gaps = [];
  let unknown = !oldC.size || !newC.size;
  for (const id of clusterIds || []) {
    const hex = `0x${Number(id).toString(16).padStart(4, "0")}`;
    const o = oldC.get(hex);
    const n = newC.get(hex);
    if (!o || !o.checked || !n || !n.checked) {
      unknown = true;
      continue;
    }
    const missing = [...o.present].filter((name) => !n.present.has(name)).sort();
    if (missing.length) gaps.push({ clusterId: Number(id), missing });
  }
  return { gaps, unknown };
}

export const VERDICT = {
  all: { level: "success", icon: "✅", text: "Can do everything the old device did." },
  most: { level: "warning", icon: "⚠", text: "Can do most of it. What it can't do is unticked below." },
  none: { level: "error", icon: "❌", text: "Not suitable: it can't do what the old device did." },
  unknown: { level: "info", icon: "ℹ", text: "The new device's clusters aren't known yet, so nothing could be checked." },
  nothing: { level: "info", icon: "ℹ", text: "Nothing to copy: no bindings to or from the old device, and no groups, in the saved scans." },
};

export const RESULT_LABEL = {
  confirmed: "✅ confirmed",
  rejected: "❌ not accepted",
  waiting: "⏳ waiting for a button press",
  added: "✅ added",
  failed: "❌ failed",
};

/** Items ticked by default: the ones the new device can do. */
export function defaultSelection(plan) {
  return new Set(((plan && plan.items) || []).filter((i) => i.ok !== false && i.new_ep != null).map((i) => i.id));
}

/** Plain-language summary of a run's results. */
export function runSummary(results) {
  const v = Object.values(results || {});
  const n = (s) => v.filter((x) => x === s).length;
  const parts = [];
  if (n("confirmed") + n("added")) parts.push(`${n("confirmed") + n("added")} copied and confirmed`);
  if (n("waiting")) parts.push(`${n("waiting")} waiting for a button press on a battery device (they go on automatically when it wakes up)`);
  if (n("rejected") + n("failed")) parts.push(`${n("rejected") + n("failed")} not accepted`);
  return { level: n("rejected") + n("failed") ? "warning" : n("waiting") ? "info" : "success", text: parts.join(", ") || "Nothing was copied." };
}
