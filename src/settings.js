// 1.12.0: device configuration backups and firmware update servers.
//
// The integration reads and writes the settings (zha_bindings_manager/
// settings_*); this file turns its answers into what the card shows. Pure
// functions only, so they can be tested without Home Assistant.

export const EXPORT_FORMAT = "zha-bindings-manager/settings";

const REASONS = {
  manual: "backed up by hand",
  auto: "backed up automatically",
  after_reset: "read after a reset (its factory settings)",
  import: "imported from a file",
};

function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

/** "26 Nov 2026 18:30 · backed up by hand". */
export function snapshotLabel(snap) {
  if (!snap) return "";
  return [shortDate(snap.taken_at), REASONS[snap.reason] || ""].filter(Boolean).join(" · ");
}

/** Every backup of a device, newest first, the after-reset read last. */
export function snapshotChoices(saved) {
  const list = [...((saved && saved.snapshots) || [])];
  if (saved && saved.after_reset) list.push(saved.after_reset);
  return list.map((s) => ({ id: s.reason === "after_reset" ? "after_reset" : s.id, label: snapshotLabel(s), snap: s }));
}

/** How many settings a backup holds. */
export function settingsCount(snap) {
  let n = 0;
  for (const clusters of Object.values((snap && snap.endpoints) || {}))
    for (const c of Object.values(clusters || {})) n += Object.keys((c && c.attributes) || {}).length;
  return n;
}

/** A setting's name for people: "start_up_on_off" -> "Start up on off". */
export function settingName(name) {
  const s = String(name || "").replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/** A value as shown: an enum's name with its number, true/false as On/Off. */
export function formatValue(value, label) {
  if (value === undefined) return "—";
  if (label && label !== "None") return `${label} (${value})`;
  if (value === true) return "On";
  if (value === false) return "Off";
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  if (value === null) return "—";
  return String(value);
}

export const rowKey = (r) => `${r.endpoint}|${r.cluster}|${r.attribute}`;

/** The rows that are offered for writing: different from now, and on the device. */
export function defaultSelection(rows) {
  return new Set((rows || []).filter((r) => r.state === "differs").map(rowKey));
}

/** Plan rows grouped for the table: [{endpoint, clusters: [{cluster, name, rows}]}]. */
export function groupRows(rows) {
  const eps = new Map();
  for (const r of rows || []) {
    if (!eps.has(r.endpoint)) eps.set(r.endpoint, new Map());
    const cl = eps.get(r.endpoint);
    if (!cl.has(r.cluster)) cl.set(r.cluster, { cluster: r.cluster, name: r.cluster_name || `0x${Number(r.cluster).toString(16).padStart(4, "0")}`, rows: [] });
    cl.get(r.cluster).rows.push(r);
  }
  return [...eps.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([endpoint, cl]) => ({ endpoint, clusters: [...cl.values()].sort((a, b) => a.cluster - b.cluster) }));
}

/** What settings_apply gets: the saved value of each ticked row. */
export function applyItems(rows, selected) {
  return (rows || [])
    .filter((r) => r.state === "differs" && selected.has(rowKey(r)))
    .map((r) => ({ endpoint: r.endpoint, cluster: r.cluster, attribute: r.attribute, value: r.saved }));
}

/** Counts per state, for the plan's summary line. */
export function planCounts(rows) {
  const c = { differs: 0, same: 0, not_on_device: 0, not_read: 0 };
  for (const r of rows || []) c[r.state] = (c[r.state] || 0) + 1;
  return c;
}

const RESULT_TEXT = {
  restored: "done",
  refused: "refused by the device",
  didnt_stick: "accepted, but it reads back differently",
  no_answer: "no answer",
  not_on_device: "not on this device",
};

export function resultText(r) {
  const base = RESULT_TEXT[r.result] || r.result;
  if (r.result === "refused" && r.status) return `${base} (${r.status})`;
  if (r.result === "didnt_stick") return `${base}: ${formatValue(r.now, r.now_label)}`;
  return base;
}

/** Status line after writing settings. */
export function applySummary(res, deviceName) {
  const results = (res && res.results) || [];
  const done = results.filter((r) => r.result === "restored").length;
  const bad = results.length - done;
  if (!results.length) return { level: "info", text: "Nothing to write." };
  if (!bad) return { level: "success", text: `${deviceName}: ${done} setting${done === 1 ? "" : "s"} written and checked.` };
  return {
    level: done ? "warning" : "error",
    text: `${deviceName}: ${done} of ${results.length} settings written; ${bad} didn't go through (see the list).`,
  };
}

/** A backup as a file someone can keep, or import into another install. */
export function exportFile(snap, device) {
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exported_at: new Date().toISOString(),
    device: device ? { ieee: device.ieee, name: device.name, manufacturer: device.manufacturer, model: device.model } : null,
    snapshot: snap,
  };
}

/** The backup inside an exported file (or a bare backup). Throws on anything else. */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("That file isn't JSON.");
  }
  const snap = data && data.format === EXPORT_FORMAT ? data.snapshot : data;
  if (!snap || typeof snap !== "object" || !snap.endpoints || typeof snap.endpoints !== "object")
    throw new Error("That file isn't a ZHA Bindings Manager settings backup.");
  return { snapshot: snap, device: (data && data.device) || null };
}

export function exportFileName(device, snap) {
  const name = String((device && (device.name || device.ieee)) || "device").replace(/[^A-Za-z0-9._-]+/g, "-");
  const day = String((snap && snap.taken_at) || "").slice(0, 10);
  return `zbm-settings-${name}${day ? `-${day}` : ""}.json`;
}

// --- firmware update servers ---------------------------------------------------

/** Side panel text for where a device gets its firmware updates.
 *  res: the integration's ota_server answer; nameOf(ieee) -> name or null. */
export function updateServerText(res, nameOf = () => null) {
  if (!res) return { level: "info", text: "" };
  switch (res.status) {
    case "ok":
      if (res.is_coordinator) return { level: "ok", text: "the coordinator (as it should)" };
      if (res.not_set)
        return {
          level: "info",
          text: "not set: it hasn't found an update server yet. It looks for one when it starts up, or when it's told an update is ready.",
        };
      return {
        level: "warning",
        text: `${nameOf(res.server) || res.server}, not the coordinator. Its update requests go there, so firmware updates for it time out.`,
        server: res.server,
      };
    case "no_answer":
      return { level: "info", text: "it didn't answer. A battery device has to be awake: press one of its buttons, then check again." };
    case "no_ota":
      return { level: "info", text: "it doesn't support firmware updates over Zigbee." };
    case "not_in_zha":
      return { level: "info", text: "it's not in ZHA." };
    default:
      return { level: "info", text: "ZHA isn't available." };
  }
}

/** Devices-tab notice for devices that claim to be an update server. */
export function claimantsText(claimants, nameOf = (i) => i) {
  const list = claimants || [];
  if (!list.length) return "";
  const names = list.map((c) => nameOf(c.ieee) || c.ieee);
  const n = list.length;
  return `${n} device${n === 1 ? " claims" : "s claim"} to be a firmware update server (${names.join(", ")}). Other devices can pick ${
    n === 1 ? "it" : "one of them"
  } instead of the coordinator, and their firmware updates then time out.`;
}

export function isClaimant(claimants, ieee) {
  const key = String(ieee || "").toLowerCase();
  return (claimants || []).find((c) => String(c.ieee).toLowerCase() === key) || null;
}

/** Devices tab cell for a device's update server (1.12.0).
 *  {text, level, rank}: rank sorts problems first. */
export function updateServerCell(res, nameOf = () => null, { battery = false, hasOta = true } = {}) {
  if (!hasOta) return { text: "—", level: "none", rank: 5, title: "It doesn't support firmware updates over Zigbee." };
  if (!res) return { text: battery ? "Not checked (battery)" : "Not checked", level: "unknown", rank: 4, title: "" };
  if (res.status === "no_ota") return { text: "—", level: "none", rank: 5, title: "It doesn't support firmware updates over Zigbee." };
  if (res.status !== "ok") return { text: "Didn't answer", level: "unknown", rank: 3, title: "A battery device has to be awake." };
  if (res.is_coordinator) return { text: "Coordinator", level: "ok", rank: 2, title: "As it should be." };
  if (res.not_set) return { text: "Not set", level: "info", rank: 1, title: "It hasn't found an update server yet." };
  return {
    text: nameOf(res.server) || res.server,
    level: "warning",
    rank: 0,
    title: "Not the coordinator: its update requests go to this device, so firmware updates for it time out.",
  };
}

/** How many checked devices get their updates from a device other than the coordinator. */
export function devicesWithWrongServer(results) {
  return Object.values(results || {}).filter((r) => r && r.status === "ok" && !r.is_coordinator && !r.not_set).length;
}
