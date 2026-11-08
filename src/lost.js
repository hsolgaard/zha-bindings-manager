// 1.8.0: lost bindings. The integration remembers which bindings each device
// had and notices when one disappears (a reset, a firmware update, a full
// binding table). This turns its watch_get / watch_put_back results into what
// the Bindings tab and the side panel show. Pure logic only.

import { normIeee } from "./utils.js";

export const POLICIES = ["off", "notify", "auto"];

export const POLICY_LABELS = {
  off: "Off",
  notify: "Tell me",
  auto: "Put back automatically",
};

export const POLICY_HINTS = {
  off: "Not watched: nothing is checked or put back for this device.",
  notify: "Checked every night and whenever its bindings are read. A lost binding shows here and in Settings → Repairs.",
  auto: "Lost bindings are put back straight away, at most 3 times a day; after that it stops and tells you instead.",
};

/** Devices with lost bindings, by name, from watch_get's result:
 *  { total, queued, paused, devices: [{ieee, name, policy, lost, queued, autoPaused, lastCheck}] }. */
export function lostSummary(res) {
  const devices = [];
  for (const [ieee, d] of Object.entries((res && res.devices) || {})) {
    if (!d || d.policy === "off" || !Array.isArray(d.lost) || !d.lost.length) continue;
    devices.push({
      ieee: normIeee(ieee),
      name: d.name || ieee,
      policy: d.policy || "notify",
      lost: d.lost,
      queued: !!d.queued,
      autoPaused: !!d.auto_paused,
      lastCheck: d.last_check || null,
    });
  }
  devices.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return {
    total: devices.reduce((n, d) => n + d.lost.length, 0),
    queued: devices.filter((d) => d.queued).length,
    paused: devices.filter((d) => d.autoPaused).length,
    devices,
  };
}

/** One device's entry (policy and lost bindings), or a default. */
export function lostFor(res, ieee) {
  const key = normIeee(ieee || "");
  for (const [k, d] of Object.entries((res && res.devices) || {})) {
    if (normIeee(k) === key) {
      return {
        policy: d.policy || "notify",
        lost: d.policy === "off" ? [] : d.lost || [],
        queued: !!d.queued,
        autoPaused: !!d.auto_paused,
        lastCheck: d.last_check || null,
        expected: d.expected || 0,
      };
    }
  }
  return { policy: "notify", lost: [], queued: false, autoPaused: false, lastCheck: null, expected: 0 };
}

/** Status line after Put back. results: {ieee: "put_back"|"still_missing"|"waiting"|"nothing"}. */
export function putBackMessage(results, nameOf = (i) => i) {
  const by = { put_back: [], still_missing: [], waiting: [], nothing: [] };
  for (const [ieee, st] of Object.entries(results || {})) (by[st] || by.nothing).push(nameOf(ieee));
  const parts = [];
  if (by.put_back.length) parts.push(`Put back on ${by.put_back.join(", ")}.`);
  if (by.waiting.length)
    parts.push(
      `${by.waiting.join(", ")} didn't answer (probably asleep). It'll be done the next time ${
        by.waiting.length === 1 ? "it wakes up" : "they wake up"
      }: press one of its buttons.`
    );
  if (by.still_missing.length)
    parts.push(
      `${by.still_missing.join(", ")} answered but still ${by.still_missing.length === 1 ? "doesn't" : "don't"} have ${
        by.still_missing.length === 1 ? "it" : "them"
      }: its binding table may be full.`
    );
  if (!parts.length) parts.push("Nothing to put back.");
  const level = by.still_missing.length ? "warning" : by.waiting.length ? "info" : "success";
  return { level, text: parts.join(" ") };
}

/** "today 03:17", "yesterday", "3 days ago", or "" for nothing usable. */
export function sinceText(iso, nowMs = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const day = (ms) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(nowMs) - day(t)) / 86400000);
  if (days <= 0) {
    const d = new Date(t);
    return `today ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export const NOTICED_BY = {
  scan: "noticed by a scan",
  nightly: "noticed by the nightly check",
  press: "noticed after a button press",
  check: "noticed by Check for lost bindings",
  put_back: "still missing after Put back",
};
