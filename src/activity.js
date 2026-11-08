// Experimental (1.7.0): messages each device sends to Home Assistant, from
// the integration's activity_get. Prompted by tube0013's WTH thread "Did my
// ZHA Zigbee light turn on 40 seconds after I toggled it?": one plug flooded
// the network and claimed the coordinator's address. Pure logic only.

import { normIeee } from "./utils.js";

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
 * minute included); `typical` = median per minute over the hour.
 * Messages "from" the coordinator itself are reported separately: the
 * coordinator doesn't send to itself, so they come from a device using its
 * address (0x0000).
 */
export function activityRows(snapshot, { coordinatorIeee = null } = {}) {
  const coord = normIeee(coordinatorIeee || (snapshot && snapshot.coordinator_ieee) || "");
  const rows = [];
  let fromCoordinator = null;
  for (const [ieee, d] of Object.entries((snapshot && snapshot.by_device) || {})) {
    const pm = Array.isArray(d.per_minute) ? d.per_minute.map(Number) : [];
    if (!pm.length) continue;
    const last5 = pm.slice(-5);
    const now = round1(last5.reduce((a, b) => a + b, 0) / last5.length);
    const hour = pm.reduce((a, b) => a + b, 0);
    const typical = round1(median(pm));
    const clusters = Object.entries(d.clusters || {})
      .map(([id, n]) => [id, Number(n)])
      .sort((a, b) => b[1] - a[1]);
    const chatty = now >= CHATTY_MIN_RATE && (now >= CHATTY_FACTOR * Math.max(typical, 0.5) || now >= FLOOD_RATE);
    const row = { ieee: normIeee(ieee), nwk: d.nwk, now, hour, typical, clusters, chatty };
    if (coord && row.ieee === coord) fromCoordinator = row;
    else rows.push(row);
  }
  rows.sort((a, b) => b.now - a.now || b.hour - a.hour);
  return { rows, chatty: rows.filter((r) => r.chatty), fromCoordinator };
}

/** "×12" style ratio against the typical rate, or "" when not meaningful. */
export function timesTypical(row) {
  if (!row || row.typical <= 0) return "";
  const x = row.now / row.typical;
  return x >= 2 ? `×${Math.round(x)}` : "";
}

/** Coordinator counters worth showing: non-zero, biggest first. */
export function interestingCounters(snapshot) {
  return ((snapshot && snapshot.coordinator_counters) || [])
    .filter((c) => c && Number(c.value) > 0)
    .sort((a, b) => b.value - a.value);
}
