// 1.10.0: short-address changes and missed presses, from the integration's
// evidence_get, and the anonymised network report a user can choose to share
// with the community database. Pure logic only.

import { normIeee } from "./utils.js";
import { CAPABILITY_DB_REPO } from "./capexplorer-constants.js";

const HOUR = 3600000;

/** Devices whose short address changed, most changes first. */
export function changedDevices(res, nameOf = (i) => i) {
  return Object.entries((res && res.addresses) || {})
    .filter(([, h]) => Array.isArray(h) && h.length > 1)
    .map(([ieee, h]) => ({ ieee: normIeee(ieee), name: nameOf(ieee), history: h, changes: h.length - 1 }))
    .sort((a, b) => b.changes - a.changes || String(a.name).localeCompare(String(b.name)));
}

/** "0x1a2b → 0x5c3d (8 Nov 03:12, rejoined)" style lines, oldest first. */
export function historyLines(history) {
  return (history || []).map((e, i) => {
    const d = new Date(e.from);
    const when = isNaN(d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const how = i === 0 ? "first seen" : e.seen === "joined" ? "announced by the device" : "seen in ZHA's device list";
    return { nwk: e.nwk, when, how };
  });
}

/** The current address and how often it changed, for the side panel. */
export function addressFact(res, ieee) {
  const h = res && res.addresses && res.addresses[normIeee(ieee)];
  if (!h || !h.length) return null;
  const last = h[h.length - 1];
  return { nwk: last.nwk, changes: h.length - 1, since: last.from };
}

/** Banner text, or null when there's nothing to say. */
export function noticeSummary(res, nameOf) {
  const changed = changedDevices(res, nameOf);
  const misses = ((res && res.misses) || []).length;
  const afterChange = ((res && res.misses) || []).filter((m) => m.address_changed_since_last_ok).length;
  if (!changed.length && !misses) return null;
  return { changed: changed.length, misses, afterChange, key: `${changed.reduce((n, c) => n + c.changes, 0)}|${misses}` };
}

const roleOf = (d) => {
  const t = String((d && d.device_type) || "").toLowerCase();
  if (t.includes("coordinator")) return "coordinator";
  if (t.includes("router")) return "router";
  if (t.includes("end")) return "end_device";
  return "unknown";
};

/**
 * The anonymised network report: every ZHA device (make, model, firmware,
 * power, role, address changes as hours since recording started), the
 * remote/light pairs with presses, and the missed presses. Devices become
 * d1, d2…; no IEEE or network addresses, names, areas or times of day.
 */
export function buildNetworkReport(res, devices, { firmwareOf = () => "", cardVersion = "", nowMs = Date.now() } = {}) {
  const since = Date.parse((res && res.since) || "") || nowMs;
  const list = [...(devices || [])].sort((a, b) => roleOf(a).localeCompare(roleOf(b)) || String(a.model || "").localeCompare(String(b.model || "")));
  const ids = new Map();
  list.forEach((d, i) => ids.set(normIeee(d.ieee), `d${i + 1}`));
  const hist = (res && res.addresses) || {};
  const hours = (iso) => Math.round(((Date.parse(iso) - since) / HOUR) * 10) / 10;
  const coord = list.find((d) => roleOf(d) === "coordinator") || {};
  const record = {
    kind: "network_report",
    schema: 1,
    card_version: cardVersion,
    period: { days: Math.round(((nowMs - since) / (24 * HOUR)) * 10) / 10 },
    system: "zha",
    coordinator: { manufacturer: coord.manufacturer || "", model: coord.model || "", firmware: firmwareOf(coord) || "" },
    network: {
      devices: list.length,
      routers: list.filter((d) => roleOf(d) === "router").length,
      end_devices: list.filter((d) => roleOf(d) === "end_device").length,
    },
    devices: list.map((d) => {
      const h = hist[normIeee(d.ieee)] || [];
      return {
        id: ids.get(normIeee(d.ieee)),
        manufacturer: d.manufacturer || "",
        model: d.model || "",
        firmware: firmwareOf(d) || "",
        power: /battery/i.test(d.power_source || "") ? "battery" : /mains/i.test(d.power_source || "") ? "mains" : "unknown",
        role: roleOf(d),
        address_changes: Math.max(0, h.length - 1),
        changes: h.slice(1).map((e) => ({ after_hours: Math.max(0, hours(e.from)), seen: e.seen === "joined" ? "joined" : "snapshot" })),
      };
    }),
    pairs: [],
    misses: [],
  };
  for (const [key, p] of Object.entries((res && res.pairs) || {})) {
    const [remote, light] = key.split("|");
    const r = ids.get(normIeee(remote));
    const l = ids.get(normIeee(light));
    if (r && l) record.pairs.push({ remote: r, light: l, presses: p.presses || 0, followed: p.followed || 0, missed: p.missed || 0 });
  }
  for (const m of (res && res.misses) || []) {
    const r = ids.get(normIeee(m.remote));
    const l = ids.get(normIeee(m.light));
    if (!r || !l) continue;
    record.misses.push({
      remote: r,
      light: l,
      hours_since_last_ok: m.last_ok_at ? Math.round(((Date.parse(m.at) - Date.parse(m.last_ok_at)) / HOUR) * 10) / 10 : null,
      address_changed_since_last_ok: !!m.address_changed_since_last_ok,
      binding_in_last_read: !!m.binding_in_last_read,
    });
  }
  return record;
}

/** GitHub issue for a report: pre-filled when short enough, otherwise the
 *  JSON is copied and pasted (as with large capability scans). */
export function reportIssue(record) {
  const changed = record.devices.filter((d) => d.address_changes).length;
  const title = `[Network Report] ${record.devices.length} devices, ${changed} with address changes`;
  const body = "```json\n" + JSON.stringify(record, null, 2) + "\n```";
  const compact = "Shared from ZHA Bindings Manager (anonymised).\n\n```json\n" + JSON.stringify(record) + "\n```";
  const base = `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&labels=${encodeURIComponent("network-report")}`;
  const full = `${base}&body=${encodeURIComponent(compact)}`;
  const tooLong = full.length > 6000;
  return {
    title,
    body,
    tooLong,
    url: tooLong ? `${base}&body=${encodeURIComponent("Shared from ZHA Bindings Manager (anonymised). Paste the copied JSON below this line:\n\n")}` : full,
  };
}
