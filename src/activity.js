// Experimental (1.7.0): messages each device sends to Home Assistant, from
// the integration's activity_get. Prompted by tube0013's WTH thread "Did my
// ZHA Zigbee light turn on 40 seconds after I toggled it?": one plug flooded
// the network and claimed the coordinator's address. Pure logic only.

import { normIeee } from "./utils.js";
import { clusterName } from "./constants.js";

/** A device is "chatty" when its last-5-minute average is at least this
 *  many messages a minute… */
export const CHATTY_MIN_RATE = 20;
/** …and at least this many times its typical rate over the hour… */
export const CHATTY_FACTOR = 10;
/** …or, whatever its typical rate, at least this many (a device that's
 *  been flooding all hour has a high "typical" too). */
export const FLOOD_RATE = 60;
/** Rows shown in the table. */
export const TOP_ROWS = 8;
/** Minutes of counting needed before a "usual" rate means anything. */
export const MIN_MINUTES_FOR_USUAL = 10;

/** Cluster label for the table: manufacturer-specific clusters (0xFC00 and
 *  up) are named as such instead of "Cluster 0xfc11". */
export function clusterLabel(id) {
  const n = Number(id);
  if (n >= 0xfc00) return `Manufacturer-specific (0x${n.toString(16).toUpperCase().padStart(4, "0")})`;
  return clusterName(n);
}

/** Whole minutes of per_minute that fall after counting started (`since`),
 *  current minute included, capped at the window. */
export function countedMinutes(snapshot, nowMs = Date.now()) {
  const len = ((snapshot && snapshot.window_minutes) || 60);
  const since = snapshot && snapshot.since ? Date.parse(snapshot.since) : NaN;
  if (!Number.isFinite(since)) return len;
  const minutes = Math.floor(nowMs / 60000) - Math.floor(since / 60000) + 1;
  return Math.max(1, Math.min(len, minutes));
}

export function median(values) {
  const v = [...(values || [])].sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Rows for the "Messages to Home Assistant" section, busiest first.
 * snapshot: activity_get's result. Returns
 * { rows: [{ieee, nwk, now, hour, typical, clusters:[[id,count]], chatty}],
 *   chatty: [rows], fromCoordinator: row|null }.
 * `now` = average per minute over the last 5 minutes (the current, partial
 * minute included); `typical` = median per minute over the minutes counted
 * so far (up to the hour), or null before MIN_MINUTES_FOR_USUAL minutes:
 * right after a restart most of the hour is empty, and a median of zeros
 * would make every device look unusual. Without a usual rate, only the
 * flood rule can flag a device.
 * Messages "from" the coordinator itself are reported separately: the
 * coordinator doesn't send to itself, so they come from a device using its
 * address (0x0000).
 */
export function activityRows(snapshot, { coordinatorIeee = null, nowMs = Date.now() } = {}) {
  const counted = countedMinutes(snapshot, nowMs);
  const coord = normIeee(coordinatorIeee || (snapshot && snapshot.coordinator_ieee) || "");
  const rows = [];
  let fromCoordinator = null;
  for (const [ieee, d] of Object.entries((snapshot && snapshot.by_device) || {})) {
    const pm = Array.isArray(d.per_minute) ? d.per_minute.map(Number) : [];
    if (!pm.length) continue;
    const last5 = pm.slice(-Math.min(5, counted));
    const now = round1(last5.reduce((a, b) => a + b, 0) / last5.length);
    const hour = Math.round(pm.reduce((a, b) => a + b, 0));
    const typical = counted >= MIN_MINUTES_FOR_USUAL ? round1(median(pm.slice(-counted))) : null;
    const clusters = Object.entries(d.clusters || {})
      .map(([id, n]) => [id, Number(n)])
      .sort((a, b) => b[1] - a[1]);
    const chatty =
      now >= CHATTY_MIN_RATE && ((typical != null && now >= CHATTY_FACTOR * Math.max(typical, 0.5)) || now >= FLOOD_RATE);
    const row = { ieee: normIeee(ieee), nwk: d.nwk, now, hour, typical, clusters, chatty };
    if (coord && row.ieee === coord) fromCoordinator = row;
    else rows.push(row);
  }
  rows.sort((a, b) => b.now - a.now || b.hour - a.hour);
  return { rows, chatty: rows.filter((r) => r.chatty), fromCoordinator };
}

/** "×12" style ratio against the typical rate, or "" when not meaningful. */
export function timesTypical(row) {
  if (!row || row.typical == null || row.typical <= 0) return "";
  const x = row.now / row.typical;
  return x >= 2 ? `×${Math.round(x)}` : "";
}

/** Coordinator counters worth showing: non-zero, biggest first. */
export function interestingCounters(snapshot) {
  return ((snapshot && snapshot.coordinator_counters) || [])
    .filter((c) => c && Number(c.value) > 0)
    .sort((a, b) => b.value - a.value);
}
