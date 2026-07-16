/**
 * ZHA Bindings Manager
 * --------------------
 * A visual manager for Zigbee (ZHA) direct bindings: a graph/table overview
 * of every binding on your network, plus drag-and-drop bind/unbind.
 *
 * The custom element itself is still named/typed "zha-binding-map-card"
 * (see customElements.define() and window.customCards.push() below) — that
 * must never change, since it's what dashboard YAML references
 * (`type: custom:zha-binding-map-card`). Only the project/display name has
 * grown to "ZHA Bindings Manager" to reflect that this is more than a map.
 *
 * This card is a UI layer on top of two things that already exist on your
 * Home Assistant install:
 *   1. The native ZHA websocket API (read-only device/cluster/group info).
 *   2. The "zha_toolkit" custom integration (https://github.com/mdeweerd/zha-toolkit),
 *      which is used for the actual bind / unbind / "read binding table" operations,
 *      because the native ZHA API does not expose a way to read the current
 *      binding table of a device, and only supports coarse (all-clusters)
 *      device-to-device binding.
 *
 * zha_toolkit MUST be installed (via HACS) and working for bind/unbind/scan
 * to function. See README.md for details.
 *
 * Version: 0.12.0
 */

/* eslint-disable no-console */

const CARD_VERSION = "0.12.0";
// Logged once per script load (not per card instance) so you can confirm
// which build is actually active straight from the browser console —
// useful given HACS caches a pre-gzipped copy of this file that can go
// stale if you ever drop a replacement in manually.
console.info(
  `%c ZHA-BINDING-MAP-CARD %c v${CARD_VERSION} `,
  "color: white; background: #039be5; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #039be5; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
);

const ZTK_DOMAIN = "zha_toolkit";

// Clusters zha-toolkit binds by default when no explicit cluster is given.
const DEFAULT_BINDABLE_OUT_CLUSTERS = [0x0005, 0x0006, 0x0008, 0x0102, 0x0300];

// How many recent binds_get attempts we remember per device for the learned
// response-time/outcome history (see _recordScanOutcome).
const HISTORY_LIMIT = 10;
// Default extra attempts for a deliberate single-device rescan (not the bulk
// network scan, which stays at zha_toolkit's own default of 1 try). Each
// extra try costs ~45s when a device genuinely doesn't respond — confirmed
// via live testing on 2026-07-15 (45s for 1 try, 222s for 5 tries) — so this
// is a real time cost, not a free safety net, and is user-configurable.
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_BINDABLE_IN_CLUSTERS = [0x0402];
// How many devices' binds_get calls _scanBindings fires concurrently, rather
// than one at a time. Confirmed safe and effective via live console testing
// on 2026-07-16: 10 concurrent calls to real, distinct devices (including 2
// simultaneous failing devices at ~45s each) showed no serialization
// anywhere in the chain — every fast device still resolved in under 1.1s,
// and the two failures completed within 0.15s of each other rather than
// stacking (bounded by the single slowest call, not the sum of them). This
// only affects the bulk network scan; single-device rescans are unaffected
// since a batch of 1-2 behaves the same either way. User-configurable (see
// _scanBatchSize) since a fixed batch size means fixed batch boundaries —
// e.g. with 8, three sleepy devices scattered through a device list can each
// land in a different batch and each drag their batch out by ~45s, instead
// of landing in the same batch and only costing ~45s once. A larger batch
// makes that collision less likely without needing to reorder devices —
// but bigger isn't free: confirmed via live testing on 2026-07-16 that a
// batch of 28 on a real ~64-device network caused otherwise-healthy mains
// devices to intermittently fail to respond (different devices on repeat
// runs, all fine when rescanned individually) — almost certainly Zigbee
// airtime/collision contention from that much concurrent traffic, not a
// real device fault. 10-12 tested clean with no induced failures; 10 is the
// default, higher values are available but not necessarily safe for every
// network.
const DEFAULT_SCAN_BATCH_SIZE = 10;

// Floor Plan node radius is normally derived from the uploaded image's raw
// pixel width (see _renderFpNode) so it scales with resolution, but that
// formula has no idea how large your actual rooms are relative to the
// image — a lower-resolution blueprint can leave markers looking oversized
// no matter how well the auto-scaling works. This percentage is a manual
// multiplier on top of that formula, defaulting to no change (100%), so a
// blueprint that doesn't fit the assumption can still be dialed down (or up).
const DEFAULT_FP_MARKER_SCALE = 100;

// Friendly names + rough category for clusters we know how to talk about.
// Anything not in this table is still usable (shown as "Cluster 0xXXXX").
const CLUSTER_INFO = {
  0x0000: { name: "Basic", cat: "misc" },
  0x0003: { name: "Identify", cat: "misc" },
  0x0004: { name: "Groups", cat: "misc" },
  0x0005: { name: "Scenes", cat: "control" },
  0x0006: { name: "On/Off", cat: "control" },
  0x0008: { name: "Level Control", cat: "control" },
  0x0102: { name: "Window Covering", cat: "control" },
  0x0201: { name: "Thermostat", cat: "climate" },
  0x0300: { name: "Color Control", cat: "control" },
  0x0400: { name: "Illuminance", cat: "sensor" },
  0x0402: { name: "Temperature", cat: "sensor" },
  0x0403: { name: "Pressure", cat: "sensor" },
  0x0405: { name: "Humidity", cat: "sensor" },
  0x0406: { name: "Occupancy", cat: "sensor" },
  0x0500: { name: "IAS Zone", cat: "security" },
  0x0502: { name: "IAS WD (Siren)", cat: "security" },
  0x0b04: { name: "Electrical Measurement", cat: "sensor" },
  0x0b05: { name: "Diagnostics", cat: "misc" },
};

const CAT_COLOR = {
  control: "#4c9aff",
  climate: "#ff8a4c",
  sensor: "#4cceac",
  security: "#ff5c5c",
  misc: "#9aa4b2",
};

// Plain-English capability phrases for the small set of clusters bindings
// actually control, used in Binding Health messages so they read like
// "brightness control" instead of "Level Control cluster". Anything not
// listed here falls back to "<cluster name> control".
const CLUSTER_FRIENDLY_PHRASE = {
  0x0005: "scene control",
  0x0006: "on/off control",
  0x0008: "brightness control",
  0x0102: "open/close control",
  0x0201: "temperature control",
  0x0300: "color control",
};
function clusterFriendlyPhrase(id) {
  const n = Number(id);
  return CLUSTER_FRIENDLY_PHRASE[n] || `${clusterName(n)} control`;
}

// Binding Health: icon/label per status level, used by the Bindings-table
// Health column, its detail popover, and the summary card.
const HEALTH_ICON = { ok: "✅", info: "ℹ", warning: "⚠", error: "❌" };
const HEALTH_LABEL = { ok: "OK", info: "Info", warning: "Warning", error: "Error" };
const HEALTH_RANK = { error: 0, warning: 1, info: 2, ok: 3 };

// Friendly labels for the HA entity-domain "types" we classify devices by
// (derived from the domain prefix of each entity a device exposes, e.g.
// "light.kitchen" -> "light"). Anything not listed still works, just shown
// with its raw domain name.
const DOMAIN_LABELS = {
  light: "Light",
  switch: "Switch",
  sensor: "Sensor",
  binary_sensor: "Binary Sensor",
  cover: "Cover",
  fan: "Fan",
  lock: "Lock",
  climate: "Climate",
  alarm_control_panel: "Alarm Panel",
  siren: "Siren",
  number: "Number",
  select: "Select",
  button: "Button",
  update: "Update",
  humidifier: "Humidifier",
  water_heater: "Water Heater",
  vacuum: "Vacuum",
  media_player: "Media Player",
  device_tracker: "Device Tracker",
};
function domainLabel(domain) {
  return DOMAIN_LABELS[domain] || domain;
}

// Refines the generic domain label using the entity's device_class (the same
// signal Home Assistant itself uses to tell a garage-door cover from a blind,
// or a motion binary_sensor from a door sensor), so the "Type" column/filter
// can say "Garage Door" or "Motion Sensor" instead of just "Cover"/"Binary Sensor".
const DEVICE_CLASS_LABELS = {
  cover: {
    garage: "Garage Door",
    gate: "Gate",
    door: "Door",
    window: "Window",
    blind: "Blind",
    curtain: "Curtain",
    shade: "Shade",
    shutter: "Shutter",
    awning: "Awning",
  },
  binary_sensor: {
    motion: "Motion Sensor",
    door: "Door Sensor",
    window: "Window Sensor",
    opening: "Contact Sensor",
    smoke: "Smoke Sensor",
    moisture: "Moisture Sensor",
    occupancy: "Occupancy Sensor",
    vibration: "Vibration Sensor",
    presence: "Presence Sensor",
    safety: "Safety Sensor",
    gas: "Gas Sensor",
    problem: "Problem Sensor",
    battery: "Battery Alert",
    tamper: "Tamper Sensor",
  },
  sensor: {
    temperature: "Temperature Sensor",
    humidity: "Humidity Sensor",
    illuminance: "Illuminance Sensor",
    battery: "Battery Sensor",
    power: "Power Sensor",
    energy: "Energy Sensor",
    pressure: "Pressure Sensor",
    voltage: "Voltage Sensor",
    current: "Current Sensor",
    pm25: "Air Quality Sensor",
    carbon_dioxide: "CO2 Sensor",
    signal_strength: "Signal Sensor",
  },
  switch: {
    outlet: "Outlet",
    switch: "Switch",
  },
};
function refinedDomainLabel(domain, deviceClass) {
  const table = DEVICE_CLASS_LABELS[domain];
  if (table && deviceClass && table[deviceClass]) return table[deviceClass];
  return domainLabel(domain);
}

// When a device exposes several non-diagnostic entities, this ranks which
// domain best answers "what kind of device is this" for the single Type
// label — e.g. a bulb that also reports power draw is a Light, not a
// Sensor. Anything not listed sorts after everything that is.
const TYPE_PRIORITY = [
  "light",
  "switch",
  "cover",
  "climate",
  "lock",
  "fan",
  "media_player",
  "alarm_control_panel",
  "siren",
  "humidifier",
  "vacuum",
  "water_heater",
  "valve",
  "binary_sensor",
  "sensor",
  "button",
  "number",
  "select",
  "text",
  "update",
  "device_tracker",
];

function clusterName(id) {
  const n = Number(id);
  return CLUSTER_INFO[n] ? CLUSTER_INFO[n].name : `Cluster 0x${n.toString(16).padStart(4, "0")}`;
}
function clusterColor(id) {
  const n = Number(id);
  return CAT_COLOR[(CLUSTER_INFO[n] && CLUSTER_INFO[n].cat) || "misc"];
}
function hex4(n) {
  return `0x${Number(n).toString(16).padStart(4, "0")}`;
}
function normIeee(ieee) {
  return (ieee || "").toLowerCase();
}
function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function relTime(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  if (diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Median of successful response durations (ms) — used instead of mean as
 *  the headline number since it resists being skewed by one freak slow
 *  reading. Returns null for an empty list. */
function medianMs(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function meanMs(values) {
  if (!values || !values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Formats a millisecond duration the way a person would say it — "~1s",
 *  "~4s" — never fake precision like "1243ms". */
function formatDurationMs(ms) {
  if (ms == null) return null;
  const s = ms / 1000;
  return s < 1 ? "<1s" : `~${Math.round(s)}s`;
}

/**
 * hass.callService() rejections aren't always plain Error objects — depending
 * on whether it's a websocket-level failure, an auth/connection issue, or a
 * Python exception bubbled up from the service handler, the rejection can be
 * a string, a bare number (e.g. an internal connection error code), or an
 * object shaped like {code, message}. Normalize all of those into one
 * readable string instead of letting them stringify to "[object Object]".
 */
function extractErrorMessage(err) {
  if (err === null || err === undefined) return "unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "number") {
    return `connection error (code ${err}) — check Settings → System → Logs for details`;
  }
  if (err.message) return err.message;
  if (err.error && err.error.message) return err.error.message;
  try {
    const s = JSON.stringify(err);
    if (s && s !== "{}") return s;
  } catch (e) {
    /* fall through */
  }
  return String(err);
}

// ---------------------------------------------------------------------------
// Thin wrapper around the ZHA + zha_toolkit APIs used by this card.
// ---------------------------------------------------------------------------
class ZhaApi {
  constructor(hass) {
    this.hass = hass;
  }

  async fetchDevices() {
    return this.hass.callWS({ type: "zha/devices" });
  }

  async fetchGroups() {
    return this.hass.callWS({ type: "zha/groups" });
  }

  async fetchClusters(ieee) {
    return this.hass.callWS({ type: "zha/devices/clusters", ieee });
  }

  /** Native "bind everything compatible" - used only as a fallback/quick action. */
  async nativeBindDevices(sourceIeee, targetIeee) {
    return this.hass.callWS({
      type: "zha/devices/bind",
      source_ieee: sourceIeee,
      target_ieee: targetIeee,
    });
  }

  async nativeUnbindDevices(sourceIeee, targetIeee) {
    return this.hass.callWS({
      type: "zha/devices/unbind",
      source_ieee: sourceIeee,
      target_ieee: targetIeee,
    });
  }

  async bindDeviceToGroup(sourceIeee, groupId, clusters) {
    return this.hass.callWS({
      type: "zha/groups/bind",
      source_ieee: sourceIeee,
      group_id: groupId,
      bindings: clusters,
    });
  }

  async unbindDeviceFromGroup(sourceIeee, groupId, clusters) {
    return this.hass.callWS({
      type: "zha/groups/unbind",
      source_ieee: sourceIeee,
      group_id: groupId,
      bindings: clusters,
    });
  }

  /** Calls a zha_toolkit service and returns the event_data response object.
   *  On any failure, logs the full request + raw response to the browser
   *  console before throwing — the toast/error message the UI shows is
   *  necessarily short, but the console has everything zha_toolkit sent
   *  back (useful for diagnosing failures with no human-readable "warning"
   *  attached, e.g. a bare `success: false`). */
  async callToolkit(service, data, opts = {}) {
    if (!this.hass.services || !this.hass.services[ZTK_DOMAIN] || !this.hass.services[ZTK_DOMAIN][service]) {
      throw new Error(
        `Service ${ZTK_DOMAIN}.${service} is not available. Is the "zha-toolkit" ` +
          `custom component installed and loaded? (HACS > Integrations)`
      );
    }
    let result;
    try {
      // notifyOnError=false: we always catch and report failures ourselves
      // (status bar, console diagnostics, Binding Health) — HA's own generic
      // "Failed to perform the action..." toast was firing on top of that
      // for every expected sleepy/offline device, which is redundant noise
      // at best and misleading ("unknown error") at worst.
      result = await this.hass.callService(ZTK_DOMAIN, service, data, undefined, false, true);
    } catch (err) {
      console.error(`[ZHA Bindings Manager] ${service} call threw`, { request: data, error: err });
      throw new Error(`${service} failed: ${extractErrorMessage(err)}`);
    }
    const response = result && result.response ? result.response : result;
    if (!response) {
      console.error(`[ZHA Bindings Manager] ${service} returned no response data`, { request: data, result });
      throw new Error(
        `${service} returned no data. Your Home Assistant core version may be older than ` +
          `2023.7 (response data support) or zha-toolkit needs updating.`
      );
    }
    const hasErrors = response.errors && response.errors.length;
    const failed = hasErrors || response.success === false;
    // Callers that can make use of partial data (currently just
    // getDeviceBindings — a later page of a binding table can time out
    // while an earlier page already has valid entries) opt in via
    // allowPartial instead of losing the whole response to a throw. Every
    // other caller (bind/unbind/etc.) keeps the original all-or-nothing
    // behavior, since a partial bind/unbind isn't a meaningful concept.
    if (failed) {
      if (opts.allowPartial) {
        console.warn(`[ZHA Bindings Manager] ${service} reported failure — continuing with any partial data`, {
          request: data,
          response,
        });
      } else if (hasErrors) {
        console.error(`[ZHA Bindings Manager] ${service} reported errors`, { request: data, response });
        throw new Error(`${service}: ${response.errors.join("; ")}`);
      } else {
        console.error(`[ZHA Bindings Manager] ${service} reported failure (full response below)`, {
          request: data,
          response,
        });
        throw new Error(`${service} reported failure${response.warning ? `: ${response.warning}` : ""}`);
      }
    }
    return response;
  }

  /** Reads the on-device binding table for one device via zha_toolkit.binds_get.
   *  Merges both response shapes zha_toolkit versions have used —
   *  `response.result` (a keyed dict) and `response.replies` (raw ZDO pages,
   *  seen on newer zha_toolkit/zigpy) — and keeps whatever valid entries
   *  come back even if the overall call reports failure (e.g. a later page
   *  timing out shouldn't discard an earlier page that already succeeded).
   *  Returns `{bindings, partial, retrievedCount, totalCount}`; `partial`
   *  means the read may be incomplete even though the entries returned are
   *  valid, and `totalCount` (when known) is the device's own reported
   *  binding-table size, so the UI can show "X of Y retrieved".
   *  `opts.tries` (optional) is passed straight through to zha_toolkit's
   *  `tries` parameter — confirmed via live testing (2026-07-15) that each
   *  try costs ~45s when a device doesn't respond at all, and that it's a
   *  real sequential retry loop, not a no-op. Left unset (zha_toolkit's own
   *  default of 1) for the bulk network scan; callers doing a deliberate
   *  single-device rescan can opt into more. */
  async getDeviceBindings(ieee, opts = {}) {
    const data = { ieee };
    if (opts.tries != null) data.tries = opts.tries;
    const response = await this.callToolkit("binds_get", data, { allowPartial: true });
    const failed = (response.errors && response.errors.length) || response.success === false;
    const fromResult =
      response.result && Object.keys(response.result).length
        ? Object.values(response.result).map((b) => normalizeBinding(ieee, b))
        : [];
    const { entries: fromReplies, total: repliesTotal } = extractBindingsFromReplies(ieee, response.replies);
    const seen = new Set();
    // Dedup on normalized identity, not the raw .id string — result-path and
    // replies-path entries for the same real binding format their .id
    // differently (see bindingIdentityKey) and would otherwise both survive
    // as a false "duplicate binding" Health warning.
    const bindings = [...fromResult, ...fromReplies].filter((b) => {
      const key = bindingIdentityKey(b);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (failed && !bindings.length) {
      // Nothing usable came back at all — this is a real failure (e.g. a
      // sleepy device that never replied), not a partial success.
      throw new Error(
        `binds_get reported failure${response.warning ? `: ${response.warning}` : ""}${
          response.errors && response.errors.length ? ` (${response.errors.join("; ")})` : ""
        }`
      );
    }
    return { bindings, partial: failed, retrievedCount: bindings.length, totalCount: repliesTotal };
  }

  /** Create a device -> device binding for one or more clusters. */
  async bindIeee(sourceIeee, targetIeee, clusterIds, opts = {}) {
    const data = {
      ieee: sourceIeee,
      command_data: targetIeee,
    };
    if (clusterIds && clusterIds.length) data.cluster = clusterIds.length === 1 ? clusterIds[0] : clusterIds;
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    if (opts.dstEndpoint != null) data.dst_endpoint = opts.dstEndpoint;
    return this.callToolkit("bind_ieee", data);
  }

  /** Remove binding(s) matching source/target/cluster filters (precise unbind).
   *  dst_endpoint is required to identify the exact binding-table entry on a
   *  target that has more than one endpoint — without it, zha_toolkit can't
   *  tell which entry to remove and reports failure even when the source,
   *  target, and cluster are all correct (see v0.8.1 bug report). */
  async unbindIeee(sourceIeee, targetIeee, clusterIds, opts = {}) {
    const data = {
      ieee: sourceIeee,
      command_data: targetIeee,
    };
    if (clusterIds && clusterIds.length) data.cluster = clusterIds;
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    if (opts.dstEndpoint != null) data.dst_endpoint = opts.dstEndpoint;
    return this.callToolkit("binds_remove_all", data);
  }

  async bindGroup(sourceIeee, groupId, clusterIds, opts = {}) {
    const data = { ieee: sourceIeee, command_data: groupId };
    if (clusterIds && clusterIds.length === 1) data.cluster = clusterIds[0];
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    return this.callToolkit("bind_group", data);
  }

  async unbindGroup(sourceIeee, groupId, clusterIds, opts = {}) {
    const data = { ieee: sourceIeee, command_data: groupId };
    if (clusterIds && clusterIds.length === 1) data.cluster = clusterIds[0];
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    return this.callToolkit("unbind_group", data);
  }
}

/** Stable identity key for a normalized binding — same source/target/
 *  endpoint/cluster identity no matter which raw response shape it was
 *  parsed from. zha_toolkit can (and on a fully successful call, usually
 *  does) return the *same* real binding in both `response.result` (older
 *  dict shape) and `response.replies` (newer ZDO-page shape) at once. The
 *  two parsers' raw `.id` strings format the cluster id differently (a hex
 *  string like "0x0006" from normalizeBinding vs a plain number like "6"
 *  from extractBindingsFromReplies), so they never matched as "the same
 *  entry" for dedup purposes — meaning one real binding could survive into
 *  the list twice and get flagged as a false "duplicate binding" by Binding
 *  Health (found via testing immediately after the 0.9.2 IEEE-parsing fix,
 *  which is what made the two copies' targets finally resolve to the same
 *  real device instead of one being garbled). This key uses each binding's
 *  already-normalized object fields (both parsers agree on those) instead
 *  of the inconsistently-formatted `.id` string. */
function bindingIdentityKey(b) {
  const target = b.isGroup ? `g:${Number(b.groupId)}` : `d:${normIeee(b.targetIeee)}:${Number(b.targetEndpoint)}`;
  return `${normIeee(b.sourceIeee)}|${Number(b.sourceEndpoint)}|${Number(b.clusterId)}|${target}`;
}

/** Normalize a raw binds_get entry into a stable shape used throughout the card. */
function normalizeBinding(sourceIeee, raw) {
  const dst = raw.dst || {};
  const isGroup = Number(dst.addrmode) === 1;
  return {
    id: `${sourceIeee}|${raw.src_ep}|${raw.cluster_id}|${isGroup ? "g" + dst.group : dst.dst_ieee + ":" + dst.dst_ep}`,
    sourceIeee: normIeee(sourceIeee),
    sourceEndpoint: raw.src_ep,
    clusterId: parseInt(raw.cluster_id, 16),
    isGroup,
    targetIeee: isGroup ? null : normIeee((dst.dst_ieee || "").replace(/^0x/i, "")),
    targetEndpoint: isGroup ? null : dst.dst_ep,
    groupId: isGroup ? parseInt(String(dst.group).replace(/^0x/i, ""), 16) : null,
  };
}

/** True if a normalized binding `b` matches the given source/target
 *  identity, comparing on normalized IEEE fields rather than raw ID-string
 *  prefixes (which aren't guaranteed to share exactly the same casing/format
 *  across different call paths). Used to verify bind/unbind outcomes against
 *  a fresh rescan instead of trusting zha_toolkit's own success/failure
 *  report — see the v0.8.2 diagnosis, where that report was misleading in
 *  both directions. `target` is `{isGroup:true, groupId}` or
 *  `{isGroup:false, ieee, endpoint}`. */
function bindingMatches(b, sourceIeee, sourceEp, clusterId, target) {
  if (normIeee(b.sourceIeee) !== normIeee(sourceIeee)) return false;
  if (Number(b.sourceEndpoint) !== Number(sourceEp)) return false;
  if (Number(b.clusterId) !== Number(clusterId)) return false;
  if (target.isGroup) return b.isGroup && Number(b.groupId) === Number(target.groupId);
  return !b.isGroup && normIeee(b.targetIeee) === normIeee(target.ieee) && Number(b.targetEndpoint) === Number(target.endpoint);
}

/** Converts a Zigbee IEEE address serialized as an array of 8 decimal bytes
 *  in little-endian (wire) order — e.g. [255,255,21,126,16,56,193,164] — into
 *  the standard colon-hex string (e.g. "a4:c1:38:10:7e:15:ff:ff") that
 *  normIeee() and every device's own `ieee` field elsewhere use. Confirmed
 *  against a real captured binds_get response (2026-07-14): the same
 *  payload's top-level `ieee_org` array reverses to exactly its own `ieee`
 *  string field. The earlier assumption that DstAddress.ieee was already a
 *  hex string was the root cause of every reply-path binding showing
 *  "target device no longer exists" — this replaces that assumption.
 *  Returns null for anything that isn't exactly 8 bytes. */
function ieeeBytesToString(bytes) {
  if (!Array.isArray(bytes) || bytes.length !== 8) return null;
  return bytes
    .slice()
    .reverse()
    .map((b) => Number(b).toString(16).padStart(2, "0"))
    .join(":");
}

/** Same byte-order idea for a 2-byte little-endian value (e.g. a group/NWK
 *  id). Not yet confirmed against a real group-bound reply — kept as a
 *  defensive fallback since it's the same Struct-serialization layer that
 *  turned out to array-ify the 8-byte IEEE case. */
function le16ToNumber(bytes) {
  if (!Array.isArray(bytes) || bytes.length !== 2) return null;
  return Number(bytes[0]) + Number(bytes[1]) * 256;
}

/** Parses zha_toolkit's newer `response.replies` shape — raw ZDO
 *  Mgmt_Bind_rsp pages, `[Status, BindingTableEntries, StartIndex,
 *  BindingTableList]` per zigpy's zdo/types.py — into the same normalized
 *  shape normalizeBinding() produces from the older `response.result`
 *  shape. Needed because a later page can time out (reporting `success:
 *  false` for the whole call) while an earlier page already contains valid
 *  entries that would otherwise be discarded entirely.
 *  Field names are confirmed against zigpy's actual `Binding` /
 *  `MultiAddress` Struct definitions (SrcAddress/SrcEndpoint/ClusterId/
 *  DstAddress, and addrmode/nwk/ieee/endpoint on the nested address) AND
 *  against a real captured response — IEEE addresses come across as 8-byte
 *  arrays, not hex strings (see ieeeBytesToString above). Alternate-cased
 *  fallbacks are kept only in case Home Assistant's websocket JSON layer
 *  ever re-cases these; unrecognized shapes are skipped (and logged)
 *  per-entry rather than crashing the whole scan.
 *  Returns `{entries, total}` — `total` is the device's own reported
 *  binding-table size (`BindingTableEntries`), used to show "X of Y
 *  retrieved" when a later page times out. */
function extractBindingsFromReplies(sourceIeee, replies) {
  const out = [];
  let total = null;
  if (!Array.isArray(replies)) return { entries: out, total };
  for (const page of replies) {
    let entries = null;
    if (Array.isArray(page)) {
      const last = page[page.length - 1];
      if (Array.isArray(last)) entries = last;
      else if (page.length && page.every((p) => p && typeof p === "object" && !Array.isArray(p))) entries = page;
      // page shape: [Status, BindingTableEntries, StartIndex, BindingTableList]
      if (page.length >= 2 && typeof page[1] === "number") total = page[1];
    }
    if (!entries) continue;
    for (const raw of entries) {
      try {
        const srcEp = raw.SrcEndpoint ?? raw.src_ep ?? raw.srcEndpoint;
        const clusterIdRaw = raw.ClusterId ?? raw.cluster_id ?? raw.clusterId;
        const dst = raw.DstAddress ?? raw.dst ?? {};
        // MultiAddress.addrmode: 0x01 = group (nwk), 0x03 = extended (ieee+endpoint).
        const addrMode = Number(dst.addrmode ?? dst.AddrMode ?? dst.addr_mode ?? raw.DstAddrMode ?? 3);
        const isGroup = addrMode === 1;
        const dstIeeeRaw = dst.ieee ?? dst.IEEE ?? dst.dst_ieee;
        const dstIeee = Array.isArray(dstIeeeRaw) ? ieeeBytesToString(dstIeeeRaw) : dstIeeeRaw;
        const dstEp = dst.endpoint ?? dst.Endpoint ?? dst.dst_ep;
        const groupRaw = dst.nwk ?? dst.NWK ?? dst.group ?? dst.Group ?? dst.group_id;
        const group = Array.isArray(groupRaw) ? le16ToNumber(groupRaw) : groupRaw;
        if (srcEp == null || clusterIdRaw == null) continue;
        if (!isGroup && !dstIeee) {
          // Couldn't resolve a usable target IEEE — skip rather than show a
          // confusing "target device no longer exists" for a device that's
          // actually fine (this is what the byte-array bug used to do).
          console.warn("[ZHA Bindings Manager] skipped a binds_get reply entry with an unparseable target IEEE", raw);
          continue;
        }
        const clusterId =
          typeof clusterIdRaw === "string" ? parseInt(clusterIdRaw.replace(/^0x/i, ""), 16) : Number(clusterIdRaw);
        out.push({
          id: `${sourceIeee}|${srcEp}|${clusterId}|${isGroup ? "g" + group : `${dstIeee}:${dstEp}`}`,
          sourceIeee: normIeee(sourceIeee),
          sourceEndpoint: srcEp,
          clusterId,
          isGroup,
          targetIeee: isGroup ? null : normIeee(String(dstIeee || "").replace(/^0x/i, "")),
          targetEndpoint: isGroup ? null : dstEp,
          groupId: isGroup ? Number(group) : null,
        });
      } catch (err) {
        console.warn("[ZHA Bindings Manager] skipped an unparseable binds_get reply entry", raw, err);
      }
    }
  }
  return { entries: out, total };
}

// ---------------------------------------------------------------------------
// The card itself
// ---------------------------------------------------------------------------
class ZhaBindingMapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._api = null;
    this._config = {};

    this._devices = [];
    this._groups = [];
    this._clusterCache = new Map(); // ieee -> Cluster[]
    this._bindings = new Map(); // ieee(lower) -> [normalized binding, ...]
    this._positions = {}; // nodeKey -> {x,y}
    this._filters = {
      coordinator: true,
      routers: true,
      endDevices: true,
      unbound: true,
      groups: true,
      hideCoordinatorBindings: true, // most devices auto-bind reporting clusters to the coordinator; that's rarely what you're trying to audit
      search: "",
      types: new Set(), // entity-domain filter, e.g. "light", "switch" — empty = show all
      manufacturers: new Set(), // empty = show all
      areas: new Set(), // area_id ("__none__" for "no area") — empty = show all
    };
    this._view = "graph";
    this._status = null; // {level: 'info'|'error'|'success', text}
    this._scanState = { running: false, done: 0, total: 0 };
    this._selectedEdgeId = null;
    this._loaded = false;
    this._dragCtx = null;
    this._fullscreen = false;
    this._lastScanAt = null; // ISO timestamp of the last time bindings were (re)scanned
    this._tableSourceFilter = null; // ieee — set by clicking a source device in the Bindings table
    this._tableSort = { key: null, dir: 1 };
    this._devicesSort = { key: null, dir: 1 };

    // Binding Health: which devices failed to respond on the *most recent*
    // scan attempt (in-memory only, per session — never persisted, and never
    // compared against older scans; see _evalBindingHealth's Rule 7).
    this._scanFailures = new Set();
    // Devices whose most recent binds_get succeeded but only partially — a
    // later page of the binding table timed out while an earlier page
    // already had valid entries (see v0.9.1). The bindings shown for these
    // devices are real, just possibly incomplete.
    this._scanPartial = new Map(); // ieee(lower) -> {retrieved, total}
    // Learned per-device response-time/outcome history, persisted across
    // sessions — see _historyFor()/_recordScanOutcome(). Used to set
    // realistic scan-time expectations and to override the power_source-
    // based sleepy-device guess once we have real observed behavior.
    this._responseHistory = new Map(); // ieee(lower) -> {successMs:[], outcomes:[bool]}
    this._retryCount = DEFAULT_RETRY_COUNT; // single-device rescan only; bulk scan is unaffected
    this._scanBatchSize = DEFAULT_SCAN_BATCH_SIZE; // how many devices _scanBindings reads concurrently
    this._fpMarkerScale = DEFAULT_FP_MARKER_SCALE; // Floor Plan marker size, % of the auto-computed radius
    this._tableHealthFilter = "all"; // "all" | "problems" | "error" | "warning" | "info"
    this._healthReqId = 0; // guards _ensureHealthData against out-of-order fetches

    // Floor plan tab state
    this._fpImageUrl = "";
    this._fpImageSize = null; // {w,h} natural pixel size of the loaded image
    this._fpPositions = {}; // ieee -> {x,y} as fractions (0..1) of the image size
    this._fpViewbox = null;
    this._fpDragCtx = null; // repositioning a placed device
    this._fpPanCtx = null;
    this._fpListDrag = null; // dragging a device from the unplaced list onto the map
    this._fpNodeEls = new Map();

    this._onResize = debounce(() => this._layoutSvgSize(), 150);
  }

  setConfig(config) {
    this._config = config || {};
    this._loadFilters();
    this._render();
  }

  _filtersStorageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:filters`;
  }
  _loadFilters() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._filtersStorageKey()) || "null");
      if (!raw) return;
      ["coordinator", "routers", "endDevices", "unbound", "groups", "hideCoordinatorBindings"].forEach((k) => {
        if (typeof raw[k] === "boolean") this._filters[k] = raw[k];
      });
      if (Array.isArray(raw.types)) this._filters.types = new Set(raw.types);
      if (Array.isArray(raw.manufacturers)) this._filters.manufacturers = new Set(raw.manufacturers);
      if (Array.isArray(raw.areas)) this._filters.areas = new Set(raw.areas);
    } catch (e) {
      /* ignore corrupt cache */
    }
  }
  _saveFilters() {
    try {
      const f = this._filters;
      localStorage.setItem(
        this._filtersStorageKey(),
        JSON.stringify({
          coordinator: f.coordinator,
          routers: f.routers,
          endDevices: f.endDevices,
          unbound: f.unbound,
          groups: f.groups,
          hideCoordinatorBindings: f.hideCoordinatorBindings,
          types: [...f.types],
          manufacturers: [...f.manufacturers],
          areas: [...f.areas],
        })
      );
    } catch (e) {
      /* ignore quota errors */
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._api = new ZhaApi(hass);
    if (first) {
      this._render();
      this._loadAll();
    }
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 10;
  }

  // Sizing hint for Sections-view dashboards: default to full row width and a
  // generous height, but let the user resize freely afterward.
  getGridOptions() {
    return {
      columns: "full",
      rows: 8,
      min_rows: 4,
    };
  }

  connectedCallback() {
    window.addEventListener("resize", this._onResize);
  }
  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
  }

  _storageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:positions`;
  }
  _loadPositions() {
    try {
      this._positions = JSON.parse(localStorage.getItem(this._storageKey()) || "{}");
    } catch (e) {
      this._positions = {};
    }
  }
  _savePositions() {
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify(this._positions));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  // Bindings are read from your Zigbee network live (binds_get), which is
  // slow and can't run in the background, so we cache the last scan result
  // per-browser and load it back on every card render. "Scan bindings" is
  // then a manual refresh rather than something you have to redo every time
  // the dashboard loads.
  _bindingsStorageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:bindings`;
  }
  _loadCachedBindings() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._bindingsStorageKey()) || "null");
      if (raw && raw.bindings) {
        this._bindings = new Map(Object.entries(raw.bindings));
        this._lastScanAt = raw.savedAt || null;
      }
    } catch (e) {
      /* ignore corrupt cache */
    }
  }
  _saveCachedBindings() {
    try {
      const obj = Object.fromEntries(this._bindings);
      this._lastScanAt = new Date().toISOString();
      localStorage.setItem(this._bindingsStorageKey(), JSON.stringify({ savedAt: this._lastScanAt, bindings: obj }));
    } catch (e) {
      /* ignore quota errors (large networks with many bindings) */
    }
  }

  // Learned per-device response-time/outcome history — see the constructor
  // comment and _recordScanOutcome/_historyFor below. Persisted the same way
  // the bindings cache is, so it builds up knowledge across sessions.
  _historyStorageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:history`;
  }
  _loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._historyStorageKey()) || "null");
      this._responseHistory = raw && typeof raw === "object" ? new Map(Object.entries(raw)) : new Map();
    } catch (e) {
      this._responseHistory = new Map();
    }
  }
  _saveHistory() {
    try {
      localStorage.setItem(this._historyStorageKey(), JSON.stringify(Object.fromEntries(this._responseHistory)));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  /** Records one binds_get attempt's outcome for a device. Caps each list at
   *  HISTORY_LIMIT so this can't grow without bound and so old, possibly-
   *  stale conditions (e.g. a device that used to be far from a router)
   *  matter less than recent ones. */
  _recordScanOutcome(ieee, { success, durationMs }) {
    const key = normIeee(ieee);
    const entry = this._responseHistory.get(key) || {
      successMs: [],
      outcomes: [],
      lastAttemptAt: null,
      lastSuccessAt: null,
    };
    if (success && durationMs != null) {
      entry.successMs.push(durationMs);
      if (entry.successMs.length > HISTORY_LIMIT) entry.successMs.shift();
      entry.lastSuccessAt = new Date().toISOString();
    }
    entry.outcomes.push(success);
    if (entry.outcomes.length > HISTORY_LIMIT) entry.outcomes.shift();
    entry.lastAttemptAt = new Date().toISOString();
    this._responseHistory.set(key, entry);
    this._saveHistory();
  }

  /** Summary used for display and for the sleepy-detection override: median
   *  response time from successful attempts, success rate across all
   *  attempts, and when we last tried/last succeeded. Returns null if we've
   *  never attempted this device — callers should fall back to the
   *  power_source/device_type guess in that case. */
  _historyFor(ieee) {
    const entry = this._responseHistory.get(normIeee(ieee));
    if (!entry || !entry.outcomes.length) return null;
    const successCount = entry.outcomes.filter(Boolean).length;
    return {
      medianMs: medianMs(entry.successMs),
      successCount,
      attemptCount: entry.outcomes.length,
      successRate: successCount / entry.outcomes.length,
      lastAttemptAt: entry.lastAttemptAt,
      lastSuccessAt: entry.lastSuccessAt,
    };
  }

  /** Whether "press a button to wake it" is physically meaningful advice for
   *  this device — purely a hardware fact from power_source (including the
   *  ambiguous "Battery or Unknown" ZHA sometimes reports — see the earlier
   *  "heuristic not certainty" discussion), never inferred from success-rate
   *  history. Deliberately NOT history-based: an early version treated a
   *  single failed attempt (successRate 0/1) as "confidently sleepy"
   *  regardless of power_source, which wrongly told Hans to "press a button"
   *  on mains-powered devices he'd physically unplugged for testing — a
   *  mains device can't be asleep, no matter how it's been responding.
   *  Response-time history is still shown as context (see _lastScanCellInfo)
   *  — it just doesn't drive whether wake-advice is physically sensible. */
  _isBatteryDevice(device) {
    return !!(device.power_source && /battery/i.test(device.power_source));
  }

  // Retry-count setting for a deliberate single-device rescan — see
  // DEFAULT_RETRY_COUNT for the reasoning. A small, explicit user setting
  // rather than something baked in, since more retries is a real time cost
  // (~45s each against an unresponsive device), not a free improvement.
  _retryCountStorageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:retry-count`;
  }
  _loadRetryCount() {
    try {
      const raw = parseInt(localStorage.getItem(this._retryCountStorageKey()), 10);
      this._retryCount = Number.isFinite(raw) && raw >= 1 ? raw : DEFAULT_RETRY_COUNT;
    } catch (e) {
      this._retryCount = DEFAULT_RETRY_COUNT;
    }
    // _render() (which wires the input and sets its initial value) runs
    // before _loadAll() calls this, so the input needs updating here too —
    // otherwise it's stuck showing the constructor default until something
    // else happens to re-render it.
    const el = this._q("#rescan-retry-count");
    if (el) el.value = this._retryCount;
  }
  _saveRetryCount(value) {
    this._retryCount = clamp(Number(value) || DEFAULT_RETRY_COUNT, 1, 10);
    try {
      localStorage.setItem(this._retryCountStorageKey(), String(this._retryCount));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  // How many devices _scanBindings reads concurrently — see
  // DEFAULT_SCAN_BATCH_SIZE for the reasoning. User-configurable because a
  // fixed batch size interacts with device ordering: a larger batch makes it
  // less likely several sleepy/offline devices land in different batches and
  // each drag one out by ~45s, but there's no single number that's provably
  // optimal for every network, so it's a setting rather than a constant.
  _scanBatchSizeStorageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:scan-batch-size`;
  }
  _loadScanBatchSize() {
    try {
      const raw = parseInt(localStorage.getItem(this._scanBatchSizeStorageKey()), 10);
      this._scanBatchSize = Number.isFinite(raw) && raw >= 1 ? raw : DEFAULT_SCAN_BATCH_SIZE;
    } catch (e) {
      this._scanBatchSize = DEFAULT_SCAN_BATCH_SIZE;
    }
    // Same reasoning as _loadRetryCount(): _render() wires the input before
    // _loadAll() calls this, so the input needs updating here too.
    const el = this._q("#scan-batch-size");
    if (el) el.value = this._scanBatchSize;
  }
  _saveScanBatchSize(value) {
    this._scanBatchSize = clamp(Number(value) || DEFAULT_SCAN_BATCH_SIZE, 1, 30);
    try {
      localStorage.setItem(this._scanBatchSizeStorageKey(), String(this._scanBatchSize));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  // Floor Plan marker size — see DEFAULT_FP_MARKER_SCALE for the reasoning.
  _fpMarkerScaleStorageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:fp-marker-scale`;
  }
  _loadFpMarkerScale() {
    try {
      const raw = parseInt(localStorage.getItem(this._fpMarkerScaleStorageKey()), 10);
      this._fpMarkerScale = Number.isFinite(raw) && raw >= 10 ? raw : DEFAULT_FP_MARKER_SCALE;
    } catch (e) {
      this._fpMarkerScale = DEFAULT_FP_MARKER_SCALE;
    }
    // Same reasoning as _loadRetryCount(): _render() wires the input before
    // _loadAll() calls this, so the input needs updating here too.
    const el = this._q("#fp-marker-scale");
    if (el) el.value = this._fpMarkerScale;
  }
  _saveFpMarkerScale(value) {
    this._fpMarkerScale = clamp(Number(value) || DEFAULT_FP_MARKER_SCALE, 40, 200);
    try {
      localStorage.setItem(this._fpMarkerScaleStorageKey(), String(this._fpMarkerScale));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  _setStatus(level, text, timeout = 6000) {
    this._status = { level, text };
    this._renderStatus();
    if (this._statusTimer) clearTimeout(this._statusTimer);
    if (timeout) {
      this._statusTimer = setTimeout(() => {
        this._status = null;
        this._renderStatus();
      }, timeout);
    }
  }

  // -------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------
  async _loadAll() {
    this._loadPositions();
    this._loadCachedBindings();
    this._loadHistory();
    this._loadRetryCount();
    this._loadScanBatchSize();
    this._loadFpMarkerScale();
    this._loadFloorplan();
    if (this._fpImageUrl) this._loadFpImage(this._fpImageUrl);
    this._setStatus("info", "Loading ZHA devices…", 0);
    try {
      const [devices, groups] = await Promise.all([this._api.fetchDevices(), this._api.fetchGroups()]);
      this._devices = devices
        .filter((d) => !!d.ieee)
        .map((d) => ({ ...d, ieee: normIeee(d.ieee) }));
      this._groups = groups;
      this._loaded = true;
      this._setStatus("success", `Loaded ${this._devices.length} devices, ${this._groups.length} groups.`);
      this._render();
      this._renderFilterChips();
    } catch (err) {
      console.error(err);
      this._setStatus("error", `Failed to load ZHA devices: ${err.message || err}`, 0);
    }
  }

  async _ensureClusters(ieee) {
    if (this._clusterCache.has(ieee)) return this._clusterCache.get(ieee);
    const clusters = await this._api.fetchClusters(ieee);
    this._clusterCache.set(ieee, clusters);
    return clusters;
  }

  /** Devices worth rescanning after a bind/unbind attempt — source always,
   *  plus the target if it's a device (not a group, and not the same IEEE
   *  as the source). Capped at 2, so this stays fast regardless of outcome. */
  _impactedIeees(sourceIeee, targetIeee) {
    const out = [sourceIeee];
    if (targetIeee && normIeee(targetIeee) !== normIeee(sourceIeee)) out.push(targetIeee);
    return out;
  }

  // -------------------------------------------------------------------
  // Verified bind/unbind outcomes — compares cached state before the
  // attempt against a fresh rescan afterwards, rather than trusting
  // zha_toolkit's own success/failure report (which the v0.8.2 diagnosis
  // showed can be wrong in both directions: reporting failure for a binding
  // that never existed to begin with, or reporting failure when the action
  // actually went through).
  // -------------------------------------------------------------------

  /** Call before the API request, using whatever's currently cached. */
  _bindingPresent(sourceIeee, sourceEp, clusterId, target) {
    return this._rawBindings().some((b) => bindingMatches(b, sourceIeee, sourceEp, clusterId, target));
  }

  /** Call after the post-action rescan completes. */
  _verifyBindOutcome(sourceIeee, sourceEp, clusterId, target) {
    const after = this._bindingPresent(sourceIeee, sourceEp, clusterId, target);
    return after
      ? { ok: true, message: "Binding confirmed on the device." }
      : { ok: false, message: "Bind failed — this binding is not on the device after rescanning." };
  }

  /** Call after the post-action rescan completes; `before` must have been
   *  captured (via _bindingPresent) prior to the unbind API call. */
  _verifyUnbindOutcome(before, sourceIeee, sourceEp, clusterId, target) {
    const after = this._bindingPresent(sourceIeee, sourceEp, clusterId, target);
    if (!after) {
      return before
        ? { ok: true, message: "Binding confirmed removed." }
        : { ok: true, message: "This binding didn't actually exist on the device — table refreshed." };
    }
    return { ok: false, message: "Unbind failed — this binding is still on the device after rescanning." };
  }

  /** Coordinator unbind can target one explicit cluster or (if none is
   *  selected) every coordinator binding currently cached for this source
   *  endpoint — so instead of one true/false outcome, report how many of
   *  the targeted bindings are actually gone after rescanning.
   *  `beforeList` is an array of {clusterId, target} captured before the
   *  API call, for whichever bindings were in scope. */
  _verifyCoordinatorUnbindOutcome(beforeList, sourceIeee, sourceEp) {
    if (!beforeList.length) {
      return { ok: true, message: "No matching coordinator bindings were cached for this endpoint — table refreshed." };
    }
    const stillPresent = beforeList.filter((item) =>
      this._bindingPresent(sourceIeee, sourceEp, item.clusterId, item.target)
    );
    const removedCount = beforeList.length - stillPresent.length;
    if (stillPresent.length === 0) {
      return { ok: true, message: `Confirmed removed: ${removedCount} of ${beforeList.length} coordinator binding(s).` };
    }
    return {
      ok: false,
      message: `Only ${removedCount} of ${beforeList.length} coordinator binding(s) were removed — ${stillPresent.length} still present after rescanning.`,
    };
  }

  /** opts.tries: extra attempts for a deliberate single-device rescan (see
   *  DEFAULT_RETRY_COUNT). Left unset for the bulk network scan so it stays
   *  at zha_toolkit's own default rather than getting slower for everyone.
   *
   *  Devices are scanned in concurrent batches of this._scanBatchSize (see
   *  DEFAULT_SCAN_BATCH_SIZE) rather than one at a time — confirmed via live
   *  testing that this genuinely overlaps end-to-end (browser → HA → zigpy →
   *  radio) rather than just moving the queueing somewhere else, including
   *  when several devices in the same batch fail/time out together. This
   *  matters most for the bulk network scan; single-device rescans just get
   *  a "batch" of 1 and behave exactly as before. */
  async _scanBindings(ieeeList, opts = {}) {
    if (this._scanState.running) return;
    const targets = ieeeList && ieeeList.length ? ieeeList : this._devices.map((d) => d.ieee);
    this._scanState = { running: true, done: 0, total: targets.length };
    this._renderStatus();
    let okCount = 0;
    let failCount = 0;
    let partialCount = 0;

    const scanOne = async (ieee) => {
      const startedAt = Date.now();
      try {
        const { bindings, partial, retrievedCount, totalCount } = await this._api.getDeviceBindings(
          ieee,
          opts.tries != null ? { tries: opts.tries } : {}
        );
        this._recordScanOutcome(ieee, { success: true, durationMs: Date.now() - startedAt });
        this._bindings.set(ieee, bindings);
        this._scanFailures.delete(normIeee(ieee));
        if (partial) {
          this._scanPartial.set(normIeee(ieee), { retrieved: retrievedCount, total: totalCount });
          partialCount++;
        } else {
          this._scanPartial.delete(normIeee(ieee));
        }
        okCount++;
      } catch (err) {
        failCount++;
        this._recordScanOutcome(ieee, { success: false });
        // Tracked for Binding Health's Rule 7 ("unable to verify") — in-memory
        // only, reflects just this most recent attempt for this device.
        this._scanFailures.add(normIeee(ieee));
        this._scanPartial.delete(normIeee(ieee));
        console.warn(`ZHA Binding Map: could not read bindings for ${ieee}:`, err.message || err);
      }
      // done++ and the two renders below are safe to run out of completion
      // order — done is a simple counter, and both renders read current
      // state fresh rather than assuming this device was the most recent.
      this._scanState.done++;
      this._renderStatus();
      this._renderGraphEdges();
    };

    const batchSize = Math.max(1, this._scanBatchSize || DEFAULT_SCAN_BATCH_SIZE);
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      await Promise.all(batch.map(scanOne));
    }

    this._scanState.running = false;
    this._saveCachedBindings();
    const summary = [`${okCount} device(s) read`];
    if (partialCount) summary.push(`${partialCount} partial (a later page timed out — rescan for the rest)`);
    if (failCount) summary.push(`${failCount} did not respond (sleepy/offline devices are normal)`);
    // timeout: 0 — the final scan summary stays on screen until dismissed
    // (via the × button) rather than auto-hiding after a few seconds, since
    // it's easy to miss if you glance away while a larger scan is running.
    this._setStatus(
      failCount ? "error" : partialCount ? "info" : "success",
      `Scan complete: ${summary.join(", ")}.`,
      0
    );
    this._renderGraph();
    this._renderTable();
    this._renderDevicesTab();
    this._renderStatus();
  }

  /** Every scanned binding, unfiltered — use for counts/audits where the
   *  "hide coordinator bindings" display preference shouldn't hide data. */
  _rawBindings() {
    const out = [];
    for (const list of this._bindings.values()) out.push(...list);
    return out;
  }

  /** Bindings as they should be displayed (respects the coordinator-hide toggle). */
  _allBindings() {
    const raw = this._rawBindings();
    if (this._filters.hideCoordinatorBindings) {
      const coord = this._coordinatorIeee();
      return raw.filter((b) => b.isGroup || !coord || b.targetIeee !== coord);
    }
    return raw;
  }

  // -------------------------------------------------------------------
  // Binding Health — structural validation of bindings (see project spec).
  // Deliberately checks structure only: does the source/target/endpoint/
  // cluster referenced by a binding currently exist? It never sends Zigbee
  // commands, never compares against a previous scan, and never persists
  // anything — it's recomputed fresh from whatever's currently loaded.
  // -------------------------------------------------------------------

  /** Fetches endpoint/cluster metadata (cheap local ZHA reads, not a Zigbee
   *  radio operation) for every device referenced by a binding, so Rules 2/3
   *  (missing endpoint / missing cluster) can be evaluated. Safe to call
   *  often — _ensureClusters() is a no-op for anything already cached. */
  async _ensureHealthData() {
    const reqId = (this._healthReqId = this._healthReqId + 1);
    const ieees = new Set();
    this._rawBindings().forEach((b) => {
      if (this._devices.some((d) => d.ieee === b.sourceIeee)) ieees.add(b.sourceIeee);
      if (!b.isGroup && b.targetIeee && this._devices.some((d) => d.ieee === b.targetIeee)) {
        ieees.add(b.targetIeee);
      }
    });
    const toFetch = [...ieees].filter((ieee) => !this._clusterCache.has(ieee));
    if (!toFetch.length) return;
    await Promise.all(toFetch.map((ieee) => this._ensureClusters(ieee).catch(() => {})));
    if (reqId !== this._healthReqId) return; // a newer bindings set has since superseded this fetch
    if (this._view === "table") this._renderTable();
  }

  /** Health for every currently-scanned binding, keyed by binding id. Computed
   *  fresh each call (cheap — O(n) over already-loaded data) rather than
   *  cached, per the "no historical data" design principle. */
  _computeHealthMap() {
    const bindings = this._rawBindings();
    const dupCounts = new Map();
    bindings.forEach((b) => {
      const key = this._healthDupKey(b);
      dupCounts.set(key, (dupCounts.get(key) || 0) + 1);
    });
    const coord = this._coordinatorIeee();
    const map = new Map();
    bindings.forEach((b) => map.set(b.id, this._evalBindingHealth(b, coord, dupCounts)));
    return map;
  }

  _healthDupKey(b) {
    const target = b.isGroup ? `g:${b.groupId}` : `d:${normIeee(b.targetIeee)}:${b.targetEndpoint}`;
    return `${normIeee(b.sourceIeee)}|${b.sourceEndpoint}|${target}|${b.clusterId}`;
  }

  /** The rules engine itself. Checked in order from most definitive to most
   *  contextual; the first match wins (see the spec's precedence notes —
   *  Rule 7 in particular must never be overridden by a Warning/Error). */
  _evalBindingHealth(b, coord, dupCounts) {
    const sourceIeeeN = normIeee(b.sourceIeee);

    // Rule 7 — source didn't respond to the most recent scan attempt. Short-
    // circuits everything else: we're looking at possibly-stale cached data,
    // so no other rule is allowed to escalate this to Warning/Error.
    if (this._scanFailures.has(sourceIeeeN)) {
      return {
        level: "info",
        code: "unable_to_verify",
        message: "This device did not respond during the scan.",
        why: "Without a fresh response from this device, we can't confirm this binding is still valid — but it may well be fine.",
        recommendation: "Wake the device and rescan.",
      };
    }

    // Same short-circuit tier as Rule 7, but for a device that partially
    // responded — an earlier page of its binding table came back fine (so
    // the bindings shown here are real), but a later page timed out, so
    // there may be more bindings on this device that aren't shown yet.
    if (this._scanPartial.has(sourceIeeeN)) {
      const counts = this._scanPartial.get(sourceIeeeN);
      const countText =
        counts && counts.total != null && counts.retrieved != null
          ? ` (${counts.retrieved} of ${counts.total} binding table entries retrieved)`
          : "";
      return {
        level: "info",
        code: "partial_scan",
        message: `Only part of this device's binding table could be read.${countText}`,
        why: "A later page of this device's binding table timed out during the scan, so there may be additional bindings on it that aren't shown yet — the bindings that were read are still valid.",
        recommendation: "Rescan this device to try retrieving the rest of its binding table.",
      };
    }

    // Mirrors Rule 1, for the source side (implied by "source device exists"
    // being an OK condition) — reachable when a device is removed/re-paired
    // after being scanned, since scan results are cached across reloads.
    if (!this._devices.some((d) => normIeee(d.ieee) === sourceIeeeN)) {
      return {
        level: "error",
        code: "source_missing",
        message: "The source device no longer exists.",
        why: "This binding was read from a device that's since been removed or re-paired, so it's leftover data rather than something currently controllable.",
        recommendation: "Remove the binding or recreate it.",
      };
    }

    if (b.isGroup) {
      const groupExists = this._groups.some((g) => g.group_id === b.groupId);
      if (!groupExists) {
        return {
          level: "warning",
          code: "missing_group",
          message: "Referenced Zigbee group no longer exists.",
          why: "This binding sends commands to a Zigbee group that Home Assistant no longer knows about, so nothing receives them.",
          recommendation: "Recreate the group or remove the binding.",
        };
      }
    } else {
      const targetIeeeN = normIeee(b.targetIeee);
      if (coord && targetIeeeN === normIeee(coord)) {
        return {
          level: "info",
          code: "coordinator_binding",
          message: "Standard coordinator reporting binding.",
          why: "Most Zigbee devices automatically bind a reporting cluster to the coordinator so Home Assistant gets status updates — this is normal and not something you created.",
          recommendation: null,
        };
      }
      const targetDevice = this._devices.find((d) => normIeee(d.ieee) === targetIeeeN);
      if (!targetDevice) {
        return {
          level: "error",
          code: "target_missing",
          message: "Target device no longer exists.",
          why: "A binding sends commands from the source straight to this target over Zigbee. Since the target no longer exists, those commands go nowhere.",
          recommendation: "Remove the binding or recreate it.",
        };
      }
      const targetClusters = this._clusterCache.get(targetDevice.ieee);
      if (!targetClusters) {
        // _ensureHealthData() hasn't finished fetching this target's clusters
        // yet — say so rather than guessing OK or Warning.
        return {
          level: "info",
          code: "checking",
          message: "Checking this binding's target…",
          why: "Still confirming the target device's current capabilities.",
          recommendation: null,
        };
      }
      const targetEndpoints = new Set(targetClusters.map((c) => c.endpoint_id));
      if (!targetEndpoints.has(Number(b.targetEndpoint))) {
        return {
          level: "warning",
          code: "missing_endpoint",
          message: "The target endpoint no longer exists.",
          why: "This binding refers to a part of the target device that no longer exists — likely because the device was re-paired or reconfigured.",
          recommendation: "Recreate the binding using a valid endpoint.",
        };
      }
      const hasCluster = targetClusters.some(
        (c) => c.type === "in" && c.endpoint_id === Number(b.targetEndpoint) && c.id === b.clusterId
      );
      if (!hasCluster) {
        return {
          level: "warning",
          code: "missing_cluster",
          message: `The destination no longer supports ${clusterFriendlyPhrase(b.clusterId)}.`,
          why: "The target device no longer exposes the specific capability this binding relies on, so commands sent to it won't be understood.",
          recommendation: "Verify the device capabilities or recreate the binding.",
        };
      }
    }

    if ((dupCounts.get(this._healthDupKey(b)) || 0) > 1) {
      return {
        level: "warning",
        code: "duplicate",
        message: "Duplicate binding detected.",
        why: "Having the same binding twice doesn't break anything, but it's redundant and can make the bindings list harder to read.",
        recommendation: "Consider removing duplicate entries.",
      };
    }

    return {
      level: "ok",
      code: "ok",
      message: "This binding looks structurally valid.",
      why: "The source and target devices, the endpoint, and the required capability all check out.",
      recommendation: null,
    };
  }

  _deviceBindingCount(ieee) {
    return this._rawBindings().filter((b) => b.sourceIeee === ieee || (!b.isGroup && b.targetIeee === ieee))
      .length;
  }

  // -------------------------------------------------------------------
  // Render: shell
  // -------------------------------------------------------------------
  _render() {
    const root = this.shadowRoot;
    if (!root.firstChild) {
      root.innerHTML = SHELL_HTML + `<style>${STYLE}</style>`;
      this._wireShell();
    }
    this._renderStatus();
    this._renderToolbarState();
    if (this._view === "graph") this._renderGraph();
    if (this._view === "table") this._renderTable();
    if (this._view === "advanced") this._renderAdvanced();
    if (this._view === "floorplan") this._renderFloorplan();
    if (this._view === "devices") this._renderDevicesTab();
  }

  _q(sel) {
    return this.shadowRoot.querySelector(sel);
  }
  _qa(sel) {
    return Array.from(this.shadowRoot.querySelectorAll(sel));
  }

  _switchView(view) {
    this._view = view;
    this._qa(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    this._qa(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    this._render();
  }

  _wireShell() {
    this._qa(".tab").forEach((btn) => {
      btn.addEventListener("click", () => this._switchView(btn.dataset.view));
    });

    this._q("#btn-scan").addEventListener("click", () => this._scanBindings());
    this._q("#btn-refresh-devices").addEventListener("click", () => this._loadAll());
    this._q("#btn-rescan-settings").addEventListener("click", () => {
      this._q("#rescan-settings-panel").classList.toggle("open");
    });
    const retryInput = this._q("#rescan-retry-count");
    if (retryInput) {
      retryInput.value = this._retryCount;
      retryInput.addEventListener("change", () => {
        this._saveRetryCount(retryInput.value);
        retryInput.value = this._retryCount; // reflect the clamped value back
      });
    }
    const batchSizeInput = this._q("#scan-batch-size");
    if (batchSizeInput) {
      batchSizeInput.value = this._scanBatchSize;
      batchSizeInput.addEventListener("change", () => {
        this._saveScanBatchSize(batchSizeInput.value);
        batchSizeInput.value = this._scanBatchSize; // reflect the clamped value back
      });
    }
    this._q("#btn-zoom-fit").addEventListener("click", () => this._zoomFit());
    this._q("#btn-zoom-in").addEventListener("click", () => this._zoomBy(1.2));
    this._q("#btn-zoom-out").addEventListener("click", () => this._zoomBy(1 / 1.2));
    this._q("#btn-fullscreen").addEventListener("click", () => this._toggleFullscreen());

    this._q("#btn-filters").addEventListener("click", () => {
      const panel = this._q("#filter-panel");
      const open = panel.classList.toggle("open");
      this._q("#btn-filters").textContent = open ? "Filters ▴" : "Filters ▾";
    });
    this._q("#btn-clear-filters").addEventListener("click", () => {
      this._filters.types.clear();
      this._filters.manufacturers.clear();
      this._filters.areas.clear();
      this._saveFilters();
      this._renderFilterChips();
      this._renderGraph();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._fullscreen) this._toggleFullscreen();
    });

    this._q("#search").addEventListener("input", (e) => {
      this._filters.search = e.target.value.toLowerCase();
      this._renderGraph();
      this._renderTable();
    });

    ["coordinator", "routers", "endDevices", "unbound", "groups", "hideCoordinatorBindings"].forEach((key) => {
      const el = this._q(`#f-${key}`);
      el.checked = this._filters[key];
      el.addEventListener("change", () => {
        this._filters[key] = el.checked;
        this._saveFilters();
        this._renderGraph();
        this._renderTable();
        this._renderFloorplan();
      });
    });

    const svg = this._q("#graph-svg");
    svg.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
    svg.addEventListener("pointerdown", (e) => this._onSvgPointerDown(e));
    window.addEventListener("pointermove", (e) => this._onSvgPointerMove(e));
    window.addEventListener("pointerup", (e) => this._onSvgPointerUp(e));

    this._q("#dialog-close").addEventListener("click", () => this._closeDialog());
    this._q("#dialog-backdrop").addEventListener("click", () => this._closeDialog());

    this._qa("#view-table thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (this._tableSort.key === key) this._tableSort.dir *= -1;
        else {
          this._tableSort.key = key;
          this._tableSort.dir = 1;
        }
        this._renderTable();
      });
    });
    this._qa("#view-devices thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (this._devicesSort.key === key) this._devicesSort.dir *= -1;
        else {
          this._devicesSort.key = key;
          this._devicesSort.dir = 1;
        }
        this._renderDevicesTab();
      });
    });

    this._q("#btn-export-csv").addEventListener("click", () => {
      downloadFile(`zha-bindings-${Date.now()}.csv`, toCsv(this._exportRowsData()), "text/csv");
    });
    this._q("#btn-export-json").addEventListener("click", () => {
      downloadFile(`zha-bindings-${Date.now()}.json`, JSON.stringify(this._exportRowsData(), null, 2), "application/json");
    });
    this._q("#btn-export-print").addEventListener("click", () => this._printBindings());

    this._qa("[data-health-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._tableHealthFilter = btn.dataset.healthFilter;
        this._qa("[data-health-filter]").forEach((b) => b.classList.toggle("active", b === btn));
        this._renderTable();
      });
    });

    // Floor plan tab
    this._q("#fp-set-image").addEventListener("click", () => {
      const url = this._q("#fp-image-url").value.trim();
      this._fpImageUrl = url;
      this._fpImageSize = null;
      this._fpViewbox = null;
      this._saveFloorplan();
      this._loadFpImage(url);
    });
    this._q("#btn-fp-zoom-in").addEventListener("click", () => this._fpZoomBy(1.2));
    this._q("#btn-fp-zoom-out").addEventListener("click", () => this._fpZoomBy(1 / 1.2));
    this._q("#btn-fp-zoom-fit").addEventListener("click", () => this._fpZoomFit());
    const fpMarkerInput = this._q("#fp-marker-scale");
    if (fpMarkerInput) {
      fpMarkerInput.value = this._fpMarkerScale;
      fpMarkerInput.addEventListener("change", () => {
        this._saveFpMarkerScale(fpMarkerInput.value);
        fpMarkerInput.value = this._fpMarkerScale; // reflect the clamped value back
        this._renderFloorplan();
      });
    }
    const fpSvg = this._q("#fp-svg");
    fpSvg.addEventListener("wheel", (e) => this._onFpWheel(e), { passive: false });
    fpSvg.addEventListener("pointerdown", (e) => this._onFpSvgPointerDown(e));
  }

  _renderToolbarState() {
    const btn = this._q("#btn-scan");
    if (!btn) return;
    if (this._scanState.running) {
      btn.disabled = true;
      btn.textContent = `Scanning ${this._scanState.done}/${this._scanState.total}…`;
    } else {
      btn.disabled = false;
      btn.textContent = "Scan bindings";
    }
    this._renderScanInfo();
  }

  _renderScanInfo() {
    const el = this._q("#scan-info");
    if (!el) return;
    if (this._scanState.running) {
      el.textContent = "";
      return;
    }
    el.textContent = this._lastScanAt
      ? `Bindings as of ${relTime(this._lastScanAt)} — click "Scan bindings" to refresh`
      : "Bindings never scanned yet";
  }

  _renderStatus() {
    const el = this._q("#status");
    if (!el) return;
    this._renderToolbarState();
    if (!this._status) {
      el.style.display = "none";
      return;
    }
    el.style.display = "flex";
    el.className = `status status-${this._status.level}`;
    el.innerHTML = `<span class="status-text">${escapeHtml(this._status.text)}</span><button type="button" class="status-close" aria-label="Dismiss">×</button>`;
    const closeBtn = el.querySelector(".status-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (this._statusTimer) clearTimeout(this._statusTimer);
        this._status = null;
        this._renderStatus();
      });
    }
  }

  // -------------------------------------------------------------------
  // Graph view
  // -------------------------------------------------------------------
  _visibleDevices() {
    const s = this._filters.search;
    return this._devices.filter((d) => {
      const isCoord = d.ieee === this._coordinatorIeee();
      if (isCoord && !this._filters.coordinator) return false;
      if (!isCoord) {
        if (d.device_type === "Router" && !this._filters.routers) return false;
        if (d.device_type === "EndDevice" && !this._filters.endDevices) return false;
      }
      if (!this._filters.unbound) {
        const hasBindings =
          (this._bindings.get(d.ieee) || []).length > 0 ||
          this._allBindings().some((b) => b.targetIeee === d.ieee);
        if (!hasBindings) return false;
      }
      if (this._filters.types.size) {
        if (!this._filters.types.has(this._devicePrimaryType(d))) return false;
      }
      if (this._filters.manufacturers.size) {
        if (!this._filters.manufacturers.has(d.manufacturer || "Unknown")) return false;
      }
      if (this._filters.areas.size) {
        if (!this._filters.areas.has(d.area_id || "__none__")) return false;
      }
      if (s) {
        const hay = `${d.user_given_name || d.name || ""} ${d.model || ""} ${d.manufacturer || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }

  _coordinatorIeee() {
    const c = this._devices.find((d) => d.device_type === "Coordinator" || d.active_coordinator);
    return c ? c.ieee : null;
  }

  /** Which entity domains (light, switch, sensor, ...) a device exposes. */
  _deviceDomains(d) {
    const set = new Set();
    (d.entities || []).forEach((e) => {
      if (e && e.entity_id) set.add(e.entity_id.split(".")[0]);
    });
    return [...set];
  }

  /** Entities that represent what a device actually *does* — excludes Home
   *  Assistant's diagnostic/config entities (firmware update status, battery
   *  %, signal strength, internal settings, etc), which is why raw domain
   *  lists were showing noise like "Update, Select, Sensor" for a device
   *  that's really just a light switch. Falls back to the unfiltered entity
   *  list if a device has nothing but diagnostic/config entities, so it
   *  still shows *something* rather than always "—". */
  _deviceFunctionalEntities(d) {
    const entities = d.entities || [];
    const registry = this._hass && this._hass.entities;
    const functional = entities.filter((e) => {
      if (!e || !e.entity_id) return false;
      const reg = registry ? registry[e.entity_id] : null;
      const category = reg ? reg.entity_category : undefined;
      return category !== "diagnostic" && category !== "config";
    });
    return functional.length ? functional : entities;
  }

  _entityDeviceClass(entityId) {
    const state = this._hass && this._hass.states ? this._hass.states[entityId] : null;
    return state && state.attributes ? state.attributes.device_class : undefined;
  }

  /** Refined, human-friendly type tags for a device (e.g. "Garage Door", "Motion Sensor"),
   *  with diagnostic/config entities excluded. Used for hover detail and exports. */
  _deviceTypeTags(d) {
    const tags = new Set();
    this._deviceFunctionalEntities(d).forEach((e) => {
      const domain = e.entity_id.split(".")[0];
      tags.add(refinedDomainLabel(domain, this._entityDeviceClass(e.entity_id)));
    });
    return [...tags];
  }

  /** The single best "what kind of device is this" label — what shows in
   *  the Type column/filter/chips. */
  _devicePrimaryType(d) {
    const entities = this._deviceFunctionalEntities(d);
    if (!entities.length) return "—";
    let best = null;
    let bestRank = Infinity;
    entities.forEach((e) => {
      const domain = e.entity_id.split(".")[0];
      const rank = TYPE_PRIORITY.indexOf(domain);
      const effectiveRank = rank === -1 ? TYPE_PRIORITY.length : rank;
      if (effectiveRank < bestRank) {
        bestRank = effectiveRank;
        best = refinedDomainLabel(domain, this._entityDeviceClass(e.entity_id));
      }
    });
    return best || "—";
  }

  _areaName(areaId) {
    if (!areaId) return "No area";
    const areas = this._hass && this._hass.areas;
    if (areas && areas[areaId] && areas[areaId].name) return areas[areaId].name;
    return areaId;
  }

  /** Builds the (type, manufacturer, area) option lists shown as filter chips, from the currently loaded devices. */
  _computeFilterOptions() {
    const types = new Map();
    const manufacturers = new Map();
    const areas = new Map();
    this._devices.forEach((d) => {
      const tag = this._devicePrimaryType(d);
      types.set(tag, (types.get(tag) || 0) + 1);
      const man = d.manufacturer || "Unknown";
      manufacturers.set(man, (manufacturers.get(man) || 0) + 1);
      const key = d.area_id || "__none__";
      const existing = areas.get(key);
      areas.set(key, { name: this._areaName(d.area_id), count: (existing ? existing.count : 0) + 1 });
    });
    return {
      types: [...types.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      manufacturers: [...manufacturers.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      areas: [...areas.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)),
    };
  }

  _renderFilterChips() {
    if (!this._q("#chips-types")) return;
    const { types, manufacturers, areas } = this._computeFilterOptions();
    this._renderChipGroup(
      "#chips-types",
      types.map(([id, count]) => ({ id, label: `${id} (${count})` })),
      this._filters.types
    );
    this._renderChipGroup(
      "#chips-manufacturers",
      manufacturers.map(([id, count]) => ({ id, label: `${id} (${count})` })),
      this._filters.manufacturers
    );
    this._renderChipGroup(
      "#chips-areas",
      areas.map(([id, info]) => ({ id, label: `${info.name} (${info.count})` })),
      this._filters.areas
    );
  }

  _renderChipGroup(sel, items, activeSet) {
    const el = this._q(sel);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<span class="muted">None found</span>`;
      return;
    }
    el.innerHTML = items
      .map(
        ({ id, label }) =>
          `<button type="button" class="chip ${activeSet.has(id) ? "active" : ""}" data-chip="${escapeHtml(
            id
          )}">${escapeHtml(label)}</button>`
      )
      .join("");
    el.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.chip;
        if (activeSet.has(val)) activeSet.delete(val);
        else activeSet.add(val);
        btn.classList.toggle("active");
        this._saveFilters();
        this._renderGraph();
      });
    });
  }

  _nodeKey(ieee) {
    return `d:${ieee}`;
  }
  _groupNodeKey(gid) {
    return `g:${gid}`;
  }

  _autoLayout(nodes) {
    // Simple layout: coordinator in the middle, everything else on a ring
    // (or several concentric rings once there are many devices), unless a
    // saved drag position exists.
    const cx = 600,
      cy = 420;
    const withoutSaved = nodes.filter((n) => !this._positions[n.key]);
    const perRing = 14;
    withoutSaved.forEach((n, i) => {
      if (n.isCoordinator) {
        this._positions[n.key] = this._positions[n.key] || { x: cx, y: cy };
        return;
      }
      const ring = Math.floor(i / perRing) + 1;
      const idxInRing = i % perRing;
      const count = Math.min(perRing, withoutSaved.length - Math.floor(i / perRing) * perRing);
      const angle = (2 * Math.PI * idxInRing) / Math.max(count, 1);
      const radius = 150 * ring;
      this._positions[n.key] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }

  _deviceIcon(d) {
    if (d.device_type === "Coordinator" || d.active_coordinator) return "⌂";
    const battery = d.power_source && /battery/i.test(d.power_source);
    // crude "role" guess just for the icon, not used for logic
    if (battery) return "🔘";
    return "💡";
  }

  _deviceLabel(d) {
    return d.user_given_name || d.name || d.model || d.ieee;
  }

  _renderGraph() {
    const svg = this._q("#graph-svg");
    const empty = this._q("#graph-empty");
    if (!svg) return;
    if (!this._loaded) {
      empty.style.display = "flex";
      empty.textContent = "Loading devices…";
      return;
    }
    const devices = this._visibleDevices();
    const groupNodes = this._filters.groups ? this._groups : [];
    if (devices.length === 0) {
      empty.style.display = "flex";
      empty.textContent = "No devices match the current filters.";
    } else {
      empty.style.display = "none";
    }

    const nodes = devices.map((d) => ({
      key: this._nodeKey(d.ieee),
      kind: "device",
      device: d,
      isCoordinator: d.ieee === this._coordinatorIeee(),
    }));
    groupNodes.forEach((g) =>
      nodes.push({ key: this._groupNodeKey(g.group_id), kind: "group", group: g })
    );
    this._autoLayout(nodes);
    this._graphNodes = nodes;

    // clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const defs = this._svgEl("defs");
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a94a6"></path>
      </marker>`;
    svg.appendChild(defs);

    this._edgesLayer = this._svgEl("g", { class: "edges-layer" });
    this._nodesLayer = this._svgEl("g", { class: "nodes-layer" });
    svg.appendChild(this._edgesLayer);
    svg.appendChild(this._nodesLayer);

    this._nodeEls = new Map();
    nodes.forEach((n) => this._renderNode(n));
    this._renderGraphEdges();
    this._applyViewbox();
  }

  _renderNode(n) {
    const pos = this._positions[n.key] || { x: 600, y: 420 };
    const g = this._svgEl("g", { class: "node", "data-key": n.key, transform: `translate(${pos.x},${pos.y})` });

    if (n.kind === "group") {
      const size = 22;
      const rect = this._svgEl("rect", {
        x: -size,
        y: -size,
        width: size * 2,
        height: size * 2,
        rx: 6,
        class: "node-shape node-group",
      });
      g.appendChild(rect);
      const label = this._svgEl("text", { class: "node-label", y: size + 16 });
      label.textContent = n.group.name || `Group ${n.group.group_id}`;
      g.appendChild(label);
    } else {
      const r = n.isCoordinator ? 26 : 20;
      const circle = this._svgEl("circle", {
        r,
        class: `node-shape ${n.isCoordinator ? "node-coordinator" : "node-device"}`,
      });
      g.appendChild(circle);
      const icon = this._svgEl("text", { class: "node-icon", "text-anchor": "middle", dy: "0.35em" });
      icon.textContent = this._deviceIcon(n.device);
      g.appendChild(icon);
      const label = this._svgEl("text", { class: "node-label", y: r + 16 });
      label.textContent = this._deviceLabel(n.device);
      g.appendChild(label);
    }

    g.addEventListener("pointerdown", (e) => this._onNodePointerDown(e, n));
    this._nodesLayer.appendChild(g);
    this._nodeEls.set(n.key, g);
  }

  _renderGraphEdges() {
    if (!this._edgesLayer) return;
    while (this._edgesLayer.firstChild) this._edgesLayer.removeChild(this._edgesLayer.firstChild);
    const bindings = this._allBindings();
    const visibleKeys = new Set((this._graphNodes || []).map((n) => n.key));

    // group parallel edges between the same pair so they fan out a little
    const pairCount = new Map();

    bindings.forEach((b) => {
      const fromKey = this._nodeKey(b.sourceIeee);
      const toKey = b.isGroup ? this._groupNodeKey(b.groupId) : this._nodeKey(b.targetIeee);
      if (!visibleKeys.has(fromKey) || !visibleKeys.has(toKey)) return;

      const pairKey = `${fromKey}->${toKey}`;
      const idx = pairCount.get(pairKey) || 0;
      pairCount.set(pairKey, idx + 1);

      const line = this._svgEl("path", {
        class: "edge",
        "data-id": b.id,
        "data-from": fromKey,
        "data-to": toKey,
        "data-offset": idx,
        stroke: clusterColor(b.clusterId),
        fill: "none",
        "marker-end": "url(#arrow)",
      });
      line.style.setProperty("--edge-color", clusterColor(b.clusterId));
      line.addEventListener("click", (e) => {
        e.stopPropagation();
        this._onEdgeClick(b);
      });
      this._edgesLayer.appendChild(line);
    });
    this._updateEdgePositions();
  }

  /** Matches the radius used in _renderNode() for each node kind, so edges
   *  can be trimmed back to the actual drawn edge of the icon rather than
   *  its center — see _updateEdgePositions(). */
  _nodeRadius(key) {
    const n = (this._graphNodes || []).find((nn) => nn.key === key);
    if (!n) return 20;
    if (n.kind === "group") return 22;
    return n.isCoordinator ? 26 : 20;
  }

  _updateEdgePositions() {
    if (!this._edgesLayer) return;
    this._edgesLayer.querySelectorAll(".edge").forEach((el) => {
      const from = this._positions[el.dataset.from];
      const to = this._positions[el.dataset.to];
      if (!from || !to) return;
      const offset = Number(el.dataset.offset || 0);
      const dx = to.x - from.x,
        dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist,
        ny = dx / dist;
      const bend = offset * 18;
      const mx = (from.x + to.x) / 2 + nx * bend;
      const my = (from.y + to.y) / 2 + ny * bend;
      // Pull the endpoint back from the target's center to just outside its
      // icon (radius + a small gap), using the curve's actual incoming
      // direction (control point -> target) rather than the straight
      // source-to-target line, so the arrowhead lands next to the icon
      // instead of hidden underneath it — previously the line ran all the
      // way to dead center, putting marker-end directly behind the circle.
      const tdx = to.x - mx,
        tdy = to.y - my;
      const tdist = Math.hypot(tdx, tdy) || 1;
      const targetGap = this._nodeRadius(el.dataset.to) + 3;
      const ex = to.x - (tdx / tdist) * targetGap;
      const ey = to.y - (tdy / tdist) * targetGap;
      el.setAttribute("d", `M ${from.x} ${from.y} Q ${mx} ${my} ${ex} ${ey}`);
    });
  }

  _svgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // --- pan/zoom ---
  _applyViewbox() {
    const svg = this._q("#graph-svg");
    if (!svg) return;
    if (!this._viewbox) this._viewbox = { x: 0, y: 0, w: 1200, h: 840 };
    svg.setAttribute("viewBox", `${this._viewbox.x} ${this._viewbox.y} ${this._viewbox.w} ${this._viewbox.h}`);
  }
  _layoutSvgSize() {
    this._applyViewbox();
  }
  _zoomBy(factor) {
    const vb = this._viewbox || { x: 0, y: 0, w: 1200, h: 840 };
    const cx = vb.x + vb.w / 2,
      cy = vb.y + vb.h / 2;
    const w = clamp(vb.w / factor, 200, 6000);
    const h = clamp(vb.h / factor, 140, 4200);
    this._viewbox = { x: cx - w / 2, y: cy - h / 2, w, h };
    this._applyViewbox();
  }
  _zoomFit() {
    this._viewbox = { x: 0, y: 0, w: 1200, h: 840 };
    this._applyViewbox();
  }
  _onWheel(e) {
    e.preventDefault();
    this._zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  /** Expands the card to fill the browser window — a normal dashboard card is
   *  cramped for a network graph, especially on a laptop with room to spare. */
  _toggleFullscreen() {
    this._fullscreen = !this._fullscreen;
    const card = this._q(".card");
    card.classList.toggle("fullscreen", this._fullscreen);
    this._q("#btn-fullscreen").textContent = this._fullscreen ? "⤢" : "⛶";
    this._q("#btn-fullscreen").title = this._fullscreen ? "Exit fullscreen (Esc)" : "Toggle fullscreen";
    // Give the browser a frame to apply the new layout before re-measuring.
    requestAnimationFrame(() => this._applyViewbox());
  }

  _svgPoint(evt) {
    const svg = this._q("#graph-svg");
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  _onSvgPointerDown(e) {
    if (e.target.closest(".node")) return; // handled by node handler
    this._panCtx = { startX: e.clientX, startY: e.clientY, vb0: { ...this._viewbox } };
  }
  _onSvgPointerMove(e) {
    if (this._panCtx) {
      const svg = this._q("#graph-svg");
      const rect = svg.getBoundingClientRect();
      const scale = this._viewbox.w / rect.width;
      const dx = (e.clientX - this._panCtx.startX) * scale;
      const dy = (e.clientY - this._panCtx.startY) * scale;
      this._viewbox = { ...this._panCtx.vb0, x: this._panCtx.vb0.x - dx, y: this._panCtx.vb0.y - dy };
      this._applyViewbox();
    }
    if (this._dragCtx) this._onNodeDragMove(e);
    if (this._fpPanCtx) this._onFpPanMove(e);
    if (this._fpDragCtx) this._onFpNodeDragMove(e);
    if (this._fpListDrag) this._onFpListDragMove(e);
  }
  _onSvgPointerUp(e) {
    this._panCtx = null;
    if (this._dragCtx) this._onNodeDragEnd();
    this._fpPanCtx = null;
    if (this._fpDragCtx) this._onFpNodeDragEnd();
    if (this._fpListDrag) this._onFpListDragEnd(e);
  }

  // --- node drag / drop-to-bind ---
  _onNodePointerDown(e, n) {
    e.stopPropagation();
    const p = this._svgPoint(e);
    const pos = this._positions[n.key];
    this._dragCtx = {
      node: n,
      offsetX: p.x - pos.x,
      offsetY: p.y - pos.y,
      moved: false,
      startClient: { x: e.clientX, y: e.clientY },
    };
  }

  _onNodeDragMove(e) {
    const ctx = this._dragCtx;
    if (!ctx) return;
    const dist = Math.hypot(e.clientX - ctx.startClient.x, e.clientY - ctx.startClient.y);
    if (dist > 4) ctx.moved = true;
    if (!ctx.moved) return;
    const p = this._svgPoint(e);
    const newPos = { x: p.x - ctx.offsetX, y: p.y - ctx.offsetY };
    this._positions[ctx.node.key] = newPos;
    const el = this._nodeEls.get(ctx.node.key);
    if (el) el.setAttribute("transform", `translate(${newPos.x},${newPos.y})`);
    this._updateEdgePositions();
    this._highlightDropTarget(newPos, ctx.node.key);
  }

  _highlightDropTarget(pos, ignoreKey) {
    let closest = null,
      closestDist = Infinity;
    (this._graphNodes || []).forEach((n) => {
      if (n.key === ignoreKey) return;
      const p2 = this._positions[n.key];
      if (!p2) return;
      const d = Math.hypot(p2.x - pos.x, p2.y - pos.y);
      if (d < closestDist) {
        closestDist = d;
        closest = n;
      }
    });
    this._nodeEls.forEach((el) => el.classList.remove("drop-target"));
    if (closest && closestDist < 46) {
      this._dragCtx.dropTarget = closest;
      const el = this._nodeEls.get(closest.key);
      if (el) el.classList.add("drop-target");
    } else {
      this._dragCtx.dropTarget = null;
    }
  }

  _onNodeDragEnd() {
    const ctx = this._dragCtx;
    this._dragCtx = null;
    this._nodeEls.forEach((el) => el.classList.remove("drop-target"));
    if (!ctx) return;
    if (!ctx.moved) return; // treat as a click, not a drag
    this._savePositions();
    if (ctx.dropTarget) {
      if (ctx.node.kind !== "device") {
        this._setStatus("error", "You can only bind from a device (not a group).");
        return;
      }
      const target =
        ctx.dropTarget.kind === "group"
          ? { kind: "group", group: ctx.dropTarget.group }
          : { kind: "device", device: ctx.dropTarget.device };
      this._jumpToAdvancedBind(ctx.node.device, target);
    }
  }

  _onEdgeClick(binding) {
    this._openUnbindPopover(binding);
  }


  _closeDialog() {
    this._q("#dialog").classList.remove("open");
  }

  // -------------------------------------------------------------------
  // Unbind popover (triggered from clicking an edge, or a row in the table)
  // -------------------------------------------------------------------
  _openUnbindPopover(binding) {
    const dialog = this._q("#dialog");
    this._q("#dialog-title").textContent = "Binding details";
    const source = this._devices.find((d) => d.ieee === binding.sourceIeee);
    const target = binding.isGroup
      ? this._groups.find((g) => g.group_id === binding.groupId)
      : this._devices.find((d) => d.ieee === binding.targetIeee);
    const sourceLabel = source ? this._deviceLabel(source) : binding.sourceIeee;
    const targetLabel = binding.isGroup
      ? target
        ? target.name
        : `Group ${binding.groupId}`
      : target
      ? this._deviceLabel(target)
      : binding.targetIeee;

    this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Source</td><td>${escapeHtml(sourceLabel)} (ep ${binding.sourceEndpoint})</td></tr>
        <tr><td>Target</td><td>${escapeHtml(targetLabel)}${
      binding.isGroup ? "" : ` (ep ${binding.targetEndpoint})`
    }</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
      </table>
      <div class="dialog-actions">
        <button class="btn btn-danger" id="unbind-confirm">Remove binding</button>
        <button class="btn" id="unbind-cancel">Close</button>
      </div>`;
    this._q("#dialog").classList.add("open");
    this._q("#unbind-cancel").addEventListener("click", () => this._closeDialog());
    this._q("#unbind-confirm").addEventListener("click", async () => {
      this._closeDialog();
      this._setStatus("info", "Removing binding…", 0);
      const bindTarget = binding.isGroup
        ? { isGroup: true, groupId: binding.groupId }
        : { isGroup: false, ieee: binding.targetIeee, endpoint: binding.targetEndpoint };
      const before = this._bindingPresent(binding.sourceIeee, binding.sourceEndpoint, binding.clusterId, bindTarget);
      const rescanTargets = binding.isGroup
        ? [binding.sourceIeee]
        : this._impactedIeees(binding.sourceIeee, binding.targetIeee);
      try {
        if (binding.isGroup) {
          await this._api.unbindDeviceFromGroup(binding.sourceIeee, binding.groupId, [
            { id: binding.clusterId, endpoint_id: binding.sourceEndpoint },
          ]);
        } else {
          await this._api.unbindIeee(binding.sourceIeee, binding.targetIeee, [binding.clusterId], {
            endpoint: binding.sourceEndpoint,
            dstEndpoint: binding.targetEndpoint,
          });
        }
      } catch (err) {
        // Not trusted alone — the outcome below is verified against a fresh
        // rescan instead (see v0.8.2 diagnosis).
        console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
      } finally {
        await this._scanBindings(rescanTargets);
        const outcome = this._verifyUnbindOutcome(
          before,
          binding.sourceIeee,
          binding.sourceEndpoint,
          binding.clusterId,
          bindTarget
        );
        this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
      }
    });
  }

  // -------------------------------------------------------------------
  // Table view
  // -------------------------------------------------------------------
  _sortRows(rows, sortState) {
    if (!sortState.key) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortState.key];
      const bv = b[sortState.key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortState.dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sortState.dir;
    });
  }

  _updateSortIndicators(scopeSel, sortState) {
    this._qa(`${scopeSel} thead th[data-sort]`).forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === sortState.key) th.classList.add(sortState.dir === 1 ? "sort-asc" : "sort-desc");
    });
  }

  /** `healthMap` is optional — pass the one _renderTable() already computed
   *  to avoid a redundant pass; callers like _exportRowsData() that don't
   *  have one handy get a freshly-computed one for free. */
  _filteredBindingRows(healthMap) {
    const map = healthMap || this._computeHealthMap();
    const s = this._filters.search;
    return this._allBindings().filter((b) => {
      if (this._tableSourceFilter && b.sourceIeee !== this._tableSourceFilter) return false;
      if (this._tableHealthFilter !== "all") {
        const level = (map.get(b.id) || {}).level;
        if (this._tableHealthFilter === "problems") {
          if (level !== "warning" && level !== "error") return false;
        } else if (level !== this._tableHealthFilter) {
          return false;
        }
      }
      if (!s) return true;
      const source = this._devices.find((d) => d.ieee === b.sourceIeee);
      const target = b.isGroup
        ? this._groups.find((g) => g.group_id === b.groupId)
        : this._devices.find((d) => d.ieee === b.targetIeee);
      const hay = `${source ? this._deviceLabel(source) : ""} ${
        target ? target.name || this._deviceLabel(target) : ""
      } ${clusterName(b.clusterId)} ${source ? this._areaName(source.area_id) : ""} ${
        source ? source.manufacturer || "" : ""
      } ${source ? source.model || "" : ""}`.toLowerCase();
      return hay.includes(s);
    });
  }

  _renderTable() {
    const wrap = this._q("#table-body");
    if (!wrap) return;

    // Fire-and-forget: fetches target endpoint/cluster metadata needed for
    // Rules 2/3 (cheap local reads, not Zigbee radio calls) and re-renders
    // itself once done. No-ops instantly if everything's already cached.
    this._ensureHealthData();

    const filterInfo = this._q("#table-filter-info");
    if (filterInfo) {
      if (this._tableSourceFilter) {
        const dev = this._devices.find((d) => d.ieee === this._tableSourceFilter);
        const name = dev ? this._deviceLabel(dev) : this._tableSourceFilter;
        filterInfo.innerHTML = `Filtering to bindings sourced from <strong>${escapeHtml(name)}</strong>
          <button class="btn btn-small" id="btn-clear-source-filter">Clear filter</button>
          <button class="btn btn-small btn-primary" id="btn-add-binding-from-filter">+ Add binding</button>`;
        filterInfo.style.display = "flex";
        this._q("#btn-clear-source-filter").addEventListener("click", () => {
          this._tableSourceFilter = null;
          this._renderTable();
        });
        this._q("#btn-add-binding-from-filter").addEventListener("click", () => this._openAddBindingFromFilter());
      } else {
        filterInfo.style.display = "none";
      }
    }

    const healthMap = this._computeHealthMap();
    this._renderHealthSummary(healthMap);

    this._updateSortIndicators("#view-table", this._tableSort);

    let rows = this._filteredBindingRows(healthMap).map((b) => {
      const source = this._devices.find((d) => d.ieee === b.sourceIeee);
      const target = b.isGroup
        ? this._groups.find((g) => g.group_id === b.groupId)
        : this._devices.find((d) => d.ieee === b.targetIeee);
      const sourceLabel = source ? this._deviceLabel(source) : b.sourceIeee;
      const targetLabel = b.isGroup
        ? (target && target.name) || `Group ${b.groupId}`
        : target
        ? this._deviceLabel(target)
        : b.targetIeee;
      const typeLabel = source ? this._devicePrimaryType(source) : "—";
      const typeFull = source ? this._deviceTypeTags(source).join(", ") : "";
      const areaLabel = source ? this._areaName(source.area_id) : "—";
      const manModel = source ? [source.manufacturer, source.model].filter(Boolean).join(" / ") || "—" : "—";
      const health = healthMap.get(b.id) || {
        level: "ok",
        code: "ok",
        message: "",
        why: "",
        recommendation: null,
      };
      return {
        binding: b,
        sourceLabel,
        targetLabel,
        typeLabel,
        typeFull,
        areaLabel,
        manModel,
        clusterLabel: clusterName(b.clusterId),
        health,
        healthRank: HEALTH_RANK[health.level] ?? 9,
      };
    });
    rows = this._sortRows(rows, this._tableSort);

    if (!rows.length) {
      wrap.innerHTML = `<tr><td colspan="8" class="muted">No bindings loaded yet. Click "Scan bindings" above.</td></tr>`;
      return;
    }

    wrap.innerHTML = rows
      .map((r) => {
        const b = r.binding;
        const h = r.health;
        return `
        <tr data-id="${b.id}">
          <td><a href="#" class="src-link" data-ieee="${escapeHtml(b.sourceIeee)}">${escapeHtml(
          r.sourceLabel
        )}</a> <span class="muted">(ep ${b.sourceEndpoint})</span></td>
          <td title="${escapeHtml(r.typeFull)}">${escapeHtml(r.typeLabel)}</td>
          <td>${escapeHtml(r.areaLabel)}</td>
          <td>${escapeHtml(r.manModel)}</td>
          <td><span class="dot" style="background:${clusterColor(b.clusterId)}"></span> ${escapeHtml(
          r.clusterLabel
        )}</td>
          <td>${escapeHtml(r.targetLabel)} ${
          b.isGroup ? "(group)" : `<span class="muted">(ep ${b.targetEndpoint})</span>`
        }</td>
          <td><button class="health-badge health-${h.level}" data-health="${b.id}" title="${escapeHtml(
          h.message
        )}">${HEALTH_ICON[h.level]} ${escapeHtml(HEALTH_LABEL[h.level])}</button></td>
          <td><button class="btn btn-small btn-danger" data-unbind="${b.id}">Unbind</button></td>
        </tr>`;
      })
      .join("");

    this._qa("[data-unbind]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const binding = this._allBindings().find((b) => b.id === btn.dataset.unbind);
        if (binding) this._openUnbindPopover(binding);
      });
    });

    this._qa(".src-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        this._tableSourceFilter = el.dataset.ieee;
        this._renderTable();
      });
    });

    this._qa("[data-health]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const binding = this._allBindings().find((b) => b.id === btn.dataset.health);
        const health = healthMap.get(btn.dataset.health);
        if (binding && health) this._openHealthDetail(binding, health);
      });
    });
  }

  /** Summary card above the Bindings table — counts across every scanned
   *  binding (not just what's currently filtered/searched), so it always
   *  reflects overall network health. */
  _renderHealthSummary(healthMap) {
    const el = this._q("#health-summary");
    if (!el) return;
    const bindings = this._rawBindings();
    if (!bindings.length) {
      el.style.display = "none";
      return;
    }
    const counts = { ok: 0, info: 0, warning: 0, error: 0 };
    bindings.forEach((b) => {
      const h = healthMap.get(b.id);
      if (h) counts[h.level] = (counts[h.level] || 0) + 1;
    });
    el.style.display = "flex";
    el.innerHTML = `
      <span class="health-summary-title">Binding Health</span>
      <span class="muted">${bindings.length} binding${bindings.length === 1 ? "" : "s"} scanned</span>
      <span class="health-chip health-ok">${HEALTH_ICON.ok} ${counts.ok} OK</span>
      ${
        counts.warning
          ? `<span class="health-chip health-warning">${HEALTH_ICON.warning} ${counts.warning} Warning${
              counts.warning === 1 ? "" : "s"
            }</span>`
          : ""
      }
      ${
        counts.error
          ? `<span class="health-chip health-error">${HEALTH_ICON.error} ${counts.error} Error${
              counts.error === 1 ? "" : "s"
            }</span>`
          : ""
      }
      ${counts.info ? `<span class="health-chip health-info">${HEALTH_ICON.info} ${counts.info} Info</span>` : ""}
    `;
  }

  /** Detail popover for a Health badge — answers what's wrong, why it
   *  matters, and what to do next, reusing the generic dialog. */
  _openHealthDetail(binding, health) {
    const source = this._devices.find((d) => d.ieee === binding.sourceIeee);
    const target = binding.isGroup
      ? this._groups.find((g) => g.group_id === binding.groupId)
      : this._devices.find((d) => d.ieee === binding.targetIeee);
    const sourceLabel = source ? this._deviceLabel(source) : binding.sourceIeee;
    const targetLabel = binding.isGroup
      ? (target && target.name) || `Group ${binding.groupId}`
      : target
      ? this._deviceLabel(target)
      : binding.targetIeee;
    this._q("#dialog-title").textContent = `${HEALTH_ICON[health.level]} ${HEALTH_LABEL[health.level]}`;
    // OK bindings have nothing "wrong" to report, so they skip the
    // What's wrong / Why it matters / Next steps framing used for the
    // other three statuses and just get a single plain confirmation line.
    const detailHtml =
      health.level === "ok"
        ? `<p>${escapeHtml(health.message)}</p>`
        : `
      <p><strong>What's wrong:</strong> ${escapeHtml(health.message)}</p>
      <p><strong>Why it matters:</strong> ${escapeHtml(health.why)}</p>
      ${health.recommendation ? `<p><strong>Next steps:</strong> ${escapeHtml(health.recommendation)}</p>` : ""}`;
    this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Binding</td><td>${escapeHtml(sourceLabel)} (ep ${binding.sourceEndpoint}) → ${escapeHtml(
      targetLabel
    )}${binding.isGroup ? " (group)" : ` (ep ${binding.targetEndpoint})`}</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
      </table>
      ${detailHtml}
      <div class="dialog-actions">
        ${
          (health.code === "unable_to_verify" || health.code === "partial_scan") && source
            ? `<button class="btn" id="health-detail-rescan" data-ieee="${escapeHtml(source.ieee)}">Rescan now</button>`
            : ""
        }
        <button class="btn" id="health-detail-close">Close</button>
      </div>`;
    this._q("#dialog").classList.add("open");
    this._q("#health-detail-close").addEventListener("click", () => this._closeDialog());
    const rescanBtn = this._q("#health-detail-rescan");
    if (rescanBtn) {
      rescanBtn.addEventListener("click", async () => {
        rescanBtn.disabled = true;
        rescanBtn.textContent = "Scanning…";
        await this._scanBindings([rescanBtn.dataset.ieee], { tries: this._retryCount });
        this._closeDialog();
      });
    }
  }

  /** "+ Add binding" from a filtered Bindings-tab source device now jumps straight to the
   *  Advanced tab with that device pre-selected as Source, instead of showing a separate
   *  target-picker popup first — see _jumpToAdvancedBind for why the popup was retired. */
  _openAddBindingFromFilter() {
    const sourceIeee = this._tableSourceFilter;
    const sourceDevice = this._devices.find((d) => d.ieee === sourceIeee);
    if (!sourceDevice) return;
    this._jumpToAdvancedBind(sourceDevice, null);
  }

  /** Row data for the currently-filtered/searched Bindings table, used by
   *  every export format. Includes IEEE addresses, which the visible table
   *  doesn't show but which you need for manual zha_toolkit calls. */
  _exportRowsData() {
    const healthMap = this._computeHealthMap();
    return this._filteredBindingRows(healthMap).map((b) => {
      const source = this._devices.find((d) => d.ieee === b.sourceIeee);
      const target = b.isGroup
        ? this._groups.find((g) => g.group_id === b.groupId)
        : this._devices.find((d) => d.ieee === b.targetIeee);
      const health = healthMap.get(b.id) || { level: "ok", message: "" };
      return {
        source_name: source ? this._deviceLabel(source) : "",
        source_ieee: b.sourceIeee,
        source_endpoint: b.sourceEndpoint,
        type: source ? this._devicePrimaryType(source) : "",
        area: source ? this._areaName(source.area_id) : "",
        manufacturer: source ? source.manufacturer || "" : "",
        model: source ? source.model || "" : "",
        cluster: clusterName(b.clusterId),
        cluster_id: hex4(b.clusterId),
        target_name: b.isGroup ? (target && target.name) || `Group ${b.groupId}` : target ? this._deviceLabel(target) : "",
        target_ieee_or_group: b.isGroup ? `group:${b.groupId}` : b.targetIeee,
        target_endpoint: b.isGroup ? "" : b.targetEndpoint,
        health_status: HEALTH_LABEL[health.level] || health.level,
        health_details: health.message || "",
      };
    });
  }

  _printBindings() {
    const rows = this._exportRowsData();
    const win = window.open("", "_blank");
    if (!win) {
      this._setStatus("error", "Pop-up blocked — allow pop-ups for this page to print/save as PDF.");
      return;
    }
    const cols = [
      "source_name",
      "source_ieee",
      "type",
      "area",
      "manufacturer",
      "model",
      "cluster",
      "target_name",
      "target_ieee_or_group",
      "health_status",
      "health_details",
    ];
    const titles = {
      source_name: "Source",
      source_ieee: "Source IEEE",
      type: "Type",
      area: "Area",
      manufacturer: "Manufacturer",
      model: "Model",
      cluster: "Cluster",
      target_name: "Target",
      target_ieee_or_group: "Target IEEE / Group",
      health_status: "Health",
      health_details: "Health details",
    };
    const html = `<!DOCTYPE html><html><head><title>ZHA Bindings</title><meta charset="utf-8"><style>
      body { font-family: sans-serif; padding: 20px; color: #111; }
      h1 { font-size: 16px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      th { background: #eee; }
      tr:nth-child(even) { background: #fafafa; }
    </style></head><body>
      <h1>ZHA Bindings</h1>
      <div class="meta">Exported ${escapeHtml(new Date().toLocaleString())} — ${rows.length} binding(s)</div>
      <table><thead><tr>${cols.map((c) => `<th>${titles[c]}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(r[c])}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  // -------------------------------------------------------------------
  // Devices view — flat list of every ZHA device with its identifying info,
  // independent of any bindings.
  // -------------------------------------------------------------------
  /** Builds the combined status/rescan/wake cell for one device — status +
   *  when + learned response-time stats, doubling as the rescan trigger.
   *  scanRank orders worst-first (never/failed before ok) so sorting the
   *  column surfaces what needs attention. */
  _lastScanCellInfo(device) {
    const key = normIeee(device.ieee);
    const known = this._bindings.has(device.ieee) || this._bindings.has(key);
    const history = this._historyFor(device.ieee);
    const isBattery = this._isBatteryDevice(device);
    let status, scanRank;
    if (this._scanFailures.has(key)) {
      status = "failed";
      scanRank = 0;
    } else if (this._scanPartial.has(key)) {
      status = "partial";
      scanRank = 1;
    } else if (known) {
      status = "ok";
      scanRank = 3;
    } else {
      status = "never";
      scanRank = 0;
    }
    const whenIso = (history && (history.lastSuccessAt || history.lastAttemptAt)) || (status === "ok" ? this._lastScanAt : null);
    const statusLabel = { failed: "Failed", partial: "Partial", ok: "OK", never: "Never scanned" }[status];
    const bits = [statusLabel];
    if (whenIso) bits.push(relTime(whenIso));
    if (history && history.medianMs != null) bits.push(`typical ${formatDurationMs(history.medianMs)}`);
    if (history && history.attemptCount > 1) {
      bits.push(`responded ${history.successCount}/${history.attemptCount}`);
    }
    // Wake-advice is only physically meaningful for a battery device, and
    // only when there's an actual current failure/partial to explain — a
    // mains device that's not responding needs a completely different
    // message (check power/wiring, not "press a button").
    const needsExplanation = status === "failed" || status === "partial";
    const wakeHint = !needsExplanation
      ? ""
      : isBattery
      ? `<div class="scan-wake-hint">May be asleep — press a button on it, then rescan.</div>`
      : `<div class="scan-wake-hint">Not responding — check it's powered on and in range, then rescan.</div>`;
    const btnLabel = isBattery && needsExplanation ? "Wake & rescan" : "Rescan";
    return {
      scanRank,
      html: `<div class="scan-cell scan-cell-${status}">
        <span class="scan-cell-status">${escapeHtml(bits.join(" · "))}</span>
        ${wakeHint}
        <button type="button" class="btn btn-small scan-cell-btn" data-ieee="${escapeHtml(device.ieee)}">${btnLabel}</button>
      </div>`,
    };
  }

  _renderDevicesTab() {
    const wrap = this._q("#devices-table-body");
    if (!wrap) return;
    this._updateSortIndicators("#view-devices", this._devicesSort);
    if (!this._loaded) {
      wrap.innerHTML = `<tr><td colspan="8" class="muted">Loading devices…</td></tr>`;
      return;
    }
    let rows = this._devices.map((d) => {
      const scanCell = this._lastScanCellInfo(d);
      return {
        device: d,
        name: this._deviceLabel(d),
        type: this._devicePrimaryType(d),
        typeFull: this._deviceTypeTags(d).join(", "),
        manufacturer: d.manufacturer || "—",
        model: d.model || "—",
        area: this._areaName(d.area_id),
        power: d.power_source || "—",
        count: this._deviceBindingCount(d.ieee),
        scanRank: scanCell.scanRank,
        scanHtml: scanCell.html,
      };
    });
    rows = this._devicesSort.key ? this._sortRows(rows, this._devicesSort) : rows.sort((a, b) => a.name.localeCompare(b.name));

    if (!rows.length) {
      wrap.innerHTML = `<tr><td colspan="8" class="muted">No devices found.</td></tr>`;
      return;
    }
    wrap.innerHTML = rows
      .map(
        (r) => `
        <tr>
          <td><a href="#" class="src-link" data-ieee="${escapeHtml(r.device.ieee)}">${escapeHtml(r.name)}</a></td>
          <td title="${escapeHtml(r.typeFull)}">${escapeHtml(r.type)}</td>
          <td>${escapeHtml(r.manufacturer)}</td>
          <td>${escapeHtml(r.model)}</td>
          <td>${escapeHtml(r.area)}</td>
          <td>${escapeHtml(r.power)}</td>
          <td>${r.count}</td>
          <td>${r.scanHtml}</td>
        </tr>`
      )
      .join("");

    this._qa("#devices-table-body .src-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        this._tableSourceFilter = el.dataset.ieee;
        this._switchView("table");
      });
    });
    this._qa("#devices-table-body .scan-cell-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = "Scanning…";
        this._scanBindings([btn.dataset.ieee], { tries: this._retryCount }).finally(() => {
          // _renderDevicesTab() (called at the end of _scanBindings) will
          // have already replaced this button — nothing to reset if so.
          if (btn.isConnected) {
            btn.disabled = false;
            btn.textContent = original;
          }
        });
      });
    });
  }

  // -------------------------------------------------------------------
  // Floor plan view — place devices on a house/floor image instead of the
  // auto-arranged graph. Positions are stored as fractions (0..1) of the
  // image's natural size, so they stay correct if the image is swapped for
  // a different resolution later.
  // -------------------------------------------------------------------
  _fpStorageKey() {
    return `zha-binding-map-card:${this._config.id || "default"}:floorplan`;
  }
  _loadFloorplan() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._fpStorageKey()) || "null");
      if (raw) {
        this._fpImageUrl = raw.imageUrl || "";
        this._fpPositions = raw.positions || {};
      }
    } catch (e) {
      /* ignore corrupt cache */
    }
  }
  _saveFloorplan() {
    try {
      localStorage.setItem(
        this._fpStorageKey(),
        JSON.stringify({ imageUrl: this._fpImageUrl, positions: this._fpPositions })
      );
    } catch (e) {
      /* ignore quota errors */
    }
  }

  _loadFpImage(url) {
    if (!url) {
      this._fpImageSize = null;
      this._renderFloorplan();
      return;
    }
    const img = new Image();
    img.onload = () => {
      this._fpImageSize = { w: img.naturalWidth, h: img.naturalHeight };
      this._fpViewbox = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      this._renderFloorplan();
    };
    img.onerror = () => {
      this._fpImageSize = null;
      this._setStatus("error", `Could not load floor plan image: ${url}`, 0);
      this._renderFloorplan();
    };
    img.src = url;
  }

  _renderFloorplan() {
    const svg = this._q("#fp-svg");
    const empty = this._q("#fp-empty");
    if (!svg) return;
    const urlInput = this._q("#fp-image-url");
    if (urlInput && document.activeElement !== urlInput) urlInput.value = this._fpImageUrl || "";

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    this._fpEdgesLayer = null;
    this._fpNodesLayer = null;

    if (!this._fpImageUrl || !this._fpImageSize) {
      empty.style.display = "flex";
      empty.textContent = this._fpImageUrl ? "Loading image…" : "Set a floor plan image URL above to get started.";
      this._renderFpUnplacedList();
      return;
    }
    empty.style.display = "none";

    if (!this._fpViewbox) this._fpViewbox = { x: 0, y: 0, w: this._fpImageSize.w, h: this._fpImageSize.h };
    svg.setAttribute(
      "viewBox",
      `${this._fpViewbox.x} ${this._fpViewbox.y} ${this._fpViewbox.w} ${this._fpViewbox.h}`
    );

    const defs = this._svgEl("defs");
    defs.innerHTML = `
      <marker id="fp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#8a94a6"></path>
      </marker>`;
    svg.appendChild(defs);

    const bg = this._svgEl("image", {
      x: 0,
      y: 0,
      width: this._fpImageSize.w,
      height: this._fpImageSize.h,
      href: this._fpImageUrl,
    });
    bg.setAttributeNS("http://www.w3.org/1999/xlink", "href", this._fpImageUrl);
    svg.appendChild(bg);

    this._fpEdgesLayer = this._svgEl("g");
    this._fpNodesLayer = this._svgEl("g");
    svg.appendChild(this._fpEdgesLayer);
    svg.appendChild(this._fpNodesLayer);

    const placedIeees = Object.keys(this._fpPositions).filter((ieee) =>
      this._devices.some((d) => d.ieee === ieee)
    );
    this._fpNodeEls = new Map();
    placedIeees.forEach((ieee) => this._renderFpNode(ieee));
    this._renderFpEdges(placedIeees);
    this._renderFpUnplacedList();
  }

  /** Base radius auto-derived from the image's raw pixel width, times the
   *  user's manual marker-size setting (see DEFAULT_FP_MARKER_SCALE) — the
   *  formula alone has no way to know how large your rooms actually are
   *  relative to the image, so a lower-resolution blueprint can leave
   *  markers looking oversized no matter what the formula guesses. */
  _fpNodeRadius() {
    if (!this._fpImageSize) return 20;
    const base = clamp(this._fpImageSize.w * 0.012, 14, 34);
    return base * ((this._fpMarkerScale || DEFAULT_FP_MARKER_SCALE) / 100);
  }

  _renderFpNode(ieee) {
    const d = this._devices.find((dd) => dd.ieee === ieee);
    const frac = this._fpPositions[ieee];
    if (!d || !frac || !this._fpImageSize) return;
    const x = frac.x * this._fpImageSize.w;
    const y = frac.y * this._fpImageSize.h;
    const r = this._fpNodeRadius();
    const g = this._svgEl("g", { class: "node fp-node", "data-key": ieee, transform: `translate(${x},${y})` });
    const circle = this._svgEl("circle", { r, class: "node-shape node-device" });
    g.appendChild(circle);
    const icon = this._svgEl("text", { class: "node-icon", "text-anchor": "middle", dy: "0.35em" });
    icon.setAttribute("style", `font-size:${Math.round(r * 0.9)}px`);
    icon.textContent = this._deviceIcon(d);
    g.appendChild(icon);
    const label = this._svgEl("text", { class: "node-label", y: r + 15 });
    label.textContent = this._deviceLabel(d);
    g.appendChild(label);
    g.addEventListener("pointerdown", (e) => this._onFpNodePointerDown(e, ieee));
    this._fpNodesLayer.appendChild(g);
    this._fpNodeEls.set(ieee, g);
  }

  _renderFpEdges(placedIeees) {
    if (!this._fpEdgesLayer) return;
    while (this._fpEdgesLayer.firstChild) this._fpEdgesLayer.removeChild(this._fpEdgesLayer.firstChild);
    const placedSet = new Set(placedIeees);
    const bindings = this._allBindings().filter(
      (b) => !b.isGroup && placedSet.has(b.sourceIeee) && placedSet.has(b.targetIeee)
    );
    const pairCount = new Map();
    bindings.forEach((b) => {
      const pairKey = `${b.sourceIeee}->${b.targetIeee}`;
      const idx = pairCount.get(pairKey) || 0;
      pairCount.set(pairKey, idx + 1);
      const line = this._svgEl("path", {
        class: "edge",
        "data-id": b.id,
        "data-from": b.sourceIeee,
        "data-to": b.targetIeee,
        "data-offset": idx,
        stroke: clusterColor(b.clusterId),
        fill: "none",
        "marker-end": "url(#fp-arrow)",
      });
      line.addEventListener("click", (e) => {
        e.stopPropagation();
        this._onEdgeClick(b);
      });
      this._fpEdgesLayer.appendChild(line);
    });
    this._updateFpEdgePositions();
  }

  _updateFpEdgePositions() {
    if (!this._fpEdgesLayer || !this._fpImageSize) return;
    // Matches _renderFpNode()'s radius (including the manual marker-size
    // setting) so the trim below lines up with the actual drawn circle.
    const nodeRadius = this._fpNodeRadius();
    this._fpEdgesLayer.querySelectorAll(".edge").forEach((el) => {
      const fromFrac = this._fpPositions[el.dataset.from];
      const toFrac = this._fpPositions[el.dataset.to];
      if (!fromFrac || !toFrac) return;
      const from = { x: fromFrac.x * this._fpImageSize.w, y: fromFrac.y * this._fpImageSize.h };
      const to = { x: toFrac.x * this._fpImageSize.w, y: toFrac.y * this._fpImageSize.h };
      const offset = Number(el.dataset.offset || 0);
      const dx = to.x - from.x,
        dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist,
        ny = dx / dist;
      const bend = offset * 18;
      const mx = (from.x + to.x) / 2 + nx * bend;
      const my = (from.y + to.y) / 2 + ny * bend;
      // Same fix as the Map view: pull the endpoint back to just outside the
      // target icon along the curve's actual incoming direction, so the
      // arrowhead is visible next to the icon instead of hidden under it.
      const tdx = to.x - mx,
        tdy = to.y - my;
      const tdist = Math.hypot(tdx, tdy) || 1;
      const targetGap = nodeRadius + 3;
      const ex = to.x - (tdx / tdist) * targetGap;
      const ey = to.y - (tdy / tdist) * targetGap;
      el.setAttribute("d", `M ${from.x} ${from.y} Q ${mx} ${my} ${ex} ${ey}`);
    });
  }

  _renderFpUnplacedList() {
    const list = this._q("#fp-unplaced-list");
    if (!list) return;
    if (!this._loaded) {
      list.innerHTML = `<span class="muted">Loading devices…</span>`;
      return;
    }
    const placed = new Set(Object.keys(this._fpPositions));
    const unplaced = this._devices.filter((d) => !placed.has(d.ieee));
    if (!unplaced.length) {
      list.innerHTML = `<span class="muted">All devices placed.</span>`;
      return;
    }
    list.innerHTML = unplaced
      .map((d) => `<div class="fp-chip" data-ieee="${escapeHtml(d.ieee)}">${escapeHtml(this._deviceLabel(d))}</div>`)
      .join("");
    list.querySelectorAll(".fp-chip").forEach((el) => {
      el.addEventListener("pointerdown", (e) => this._onFpListPointerDown(e, el.dataset.ieee));
    });
  }

  // --- drag a device from the unplaced list onto the image ---
  _onFpListPointerDown(e, ieee) {
    e.preventDefault();
    if (!this._fpImageSize) {
      this._setStatus("error", "Set a floor plan image first.");
      return;
    }
    const device = this._devices.find((d) => d.ieee === ieee);
    const ghost = document.createElement("div");
    ghost.className = "fp-ghost";
    ghost.textContent = device ? this._deviceLabel(device) : ieee;
    this.shadowRoot.appendChild(ghost);
    this._fpListDrag = { ieee, ghost };
    this._moveFpGhost(e);
  }
  _moveFpGhost(e) {
    if (!this._fpListDrag) return;
    this._fpListDrag.ghost.style.left = `${e.clientX + 12}px`;
    this._fpListDrag.ghost.style.top = `${e.clientY + 12}px`;
  }
  _onFpListDragMove(e) {
    this._moveFpGhost(e);
  }
  _onFpListDragEnd(e) {
    const { ieee, ghost } = this._fpListDrag;
    ghost.remove();
    this._fpListDrag = null;
    const wrap = this._q("#view-floorplan .graph-wrap");
    if (!wrap || !e) return;
    const rect = wrap.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return; // dropped outside the map — leave it in the unplaced list
    }
    const svg = this._q("#fp-svg");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    this._fpPositions[ieee] = {
      x: clamp(svgPt.x / this._fpImageSize.w, 0, 1),
      y: clamp(svgPt.y / this._fpImageSize.h, 0, 1),
    };
    this._saveFloorplan();
    this._renderFloorplan();
  }

  // --- reposition (or click-to-remove) a device already placed on the map ---
  _onFpNodePointerDown(e, ieee) {
    e.stopPropagation();
    const svg = this._q("#fp-svg");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const frac = this._fpPositions[ieee];
    this._fpDragCtx = {
      ieee,
      offsetX: p.x - frac.x * this._fpImageSize.w,
      offsetY: p.y - frac.y * this._fpImageSize.h,
      moved: false,
      startClient: { x: e.clientX, y: e.clientY },
    };
  }
  _onFpNodeDragMove(e) {
    const ctx = this._fpDragCtx;
    if (!ctx) return;
    const dist = Math.hypot(e.clientX - ctx.startClient.x, e.clientY - ctx.startClient.y);
    if (dist > 4) ctx.moved = true;
    if (!ctx.moved) return;
    const svg = this._q("#fp-svg");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const nx = clamp((p.x - ctx.offsetX) / this._fpImageSize.w, 0, 1);
    const ny = clamp((p.y - ctx.offsetY) / this._fpImageSize.h, 0, 1);
    this._fpPositions[ctx.ieee] = { x: nx, y: ny };
    const el = this._fpNodeEls.get(ctx.ieee);
    if (el) el.setAttribute("transform", `translate(${nx * this._fpImageSize.w},${ny * this._fpImageSize.h})`);
    this._updateFpEdgePositions();
  }
  _onFpNodeDragEnd() {
    const ctx = this._fpDragCtx;
    this._fpDragCtx = null;
    if (!ctx) return;
    if (ctx.moved) {
      this._saveFloorplan();
    } else {
      // A plain click (no drag) sends the device back to the unplaced list.
      delete this._fpPositions[ctx.ieee];
      this._saveFloorplan();
      this._renderFloorplan();
    }
  }

  // --- pan/zoom for the floor plan image ---
  _onFpPanMove(e) {
    if (!this._fpPanCtx || !this._fpViewbox) return;
    const svg = this._q("#fp-svg");
    const rect = svg.getBoundingClientRect();
    const scale = this._fpViewbox.w / rect.width;
    const dx = (e.clientX - this._fpPanCtx.startX) * scale;
    const dy = (e.clientY - this._fpPanCtx.startY) * scale;
    this._fpViewbox = { ...this._fpPanCtx.vb0, x: this._fpPanCtx.vb0.x - dx, y: this._fpPanCtx.vb0.y - dy };
    svg.setAttribute(
      "viewBox",
      `${this._fpViewbox.x} ${this._fpViewbox.y} ${this._fpViewbox.w} ${this._fpViewbox.h}`
    );
  }
  _onFpSvgPointerDown(e) {
    if (e.target.closest(".node")) return;
    if (!this._fpViewbox) return;
    this._fpPanCtx = { startX: e.clientX, startY: e.clientY, vb0: { ...this._fpViewbox } };
  }
  _fpZoomBy(factor) {
    if (!this._fpViewbox) return;
    const vb = this._fpViewbox;
    const cx = vb.x + vb.w / 2,
      cy = vb.y + vb.h / 2;
    const w = clamp(vb.w / factor, 100, 20000);
    const h = clamp(vb.h / factor, 60, 20000);
    this._fpViewbox = { x: cx - w / 2, y: cy - h / 2, w, h };
    this._q("#fp-svg").setAttribute(
      "viewBox",
      `${this._fpViewbox.x} ${this._fpViewbox.y} ${this._fpViewbox.w} ${this._fpViewbox.h}`
    );
  }
  _fpZoomFit() {
    if (!this._fpImageSize) return;
    this._fpViewbox = { x: 0, y: 0, w: this._fpImageSize.w, h: this._fpImageSize.h };
    this._q("#fp-svg").setAttribute(
      "viewBox",
      `${this._fpViewbox.x} ${this._fpViewbox.y} ${this._fpViewbox.w} ${this._fpViewbox.h}`
    );
  }
  _onFpWheel(e) {
    e.preventDefault();
    this._fpZoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  // -------------------------------------------------------------------
  // Advanced (manual) view — a thin form over zha_toolkit's raw fields,
  // for cases the automatic matching above doesn't handle well.
  // -------------------------------------------------------------------
  _renderAdvanced() {
    const el = this._q("#view-advanced");
    if (!el || el.dataset.wired) {
      if (el) this._populateAdvancedSelects();
      return;
    }
    el.dataset.wired = "1";
    el.innerHTML = `
      <div class="advanced-form-wrap">
        <div class="advanced-form">
          <p class="muted">Direct access to <code>zha_toolkit.bind_ieee</code> / <code>binds_remove_all</code> /
            <code>bind_group</code> for edge cases (specific endpoints, clusters not auto-detected, etc).</p>
          <label>Source device
            <select id="adv-source"></select>
          </label>
          <label>Source endpoint
            <select id="adv-src-ep"><option value="">Loading…</option></select>
          </label>
          <label>Target type
            <select id="adv-target-type">
              <option value="device">Device</option>
              <option value="group">Group</option>
              <option value="coordinator">Coordinator</option>
            </select>
          </label>
          <label id="adv-target-device-wrap">Target device
            <select id="adv-target-device"></select>
          </label>
          <label id="adv-target-group-wrap" style="display:none">Target group
            <select id="adv-target-group"></select>
          </label>
          <label id="adv-target-ep-wrap">Target endpoint
            <select id="adv-dst-ep"><option value="">Loading…</option></select>
          </label>
          <label>Cluster
            <select id="adv-cluster"><option value="">— zha-toolkit default —</option></select>
          </label>
          <div class="dialog-actions">
            <button class="btn btn-primary" id="adv-bind">Bind</button>
            <button class="btn btn-danger" id="adv-unbind">Unbind</button>
          </div>
        </div>
        <div class="advanced-side">
          <div class="advanced-panel">
            <div class="filter-group-title">Existing bindings on this source endpoint</div>
            <div id="adv-source-bindings" class="advanced-binding-list"></div>
          </div>
          <div class="advanced-panel" id="adv-target-panel-wrap">
            <div class="filter-group-title">Existing bindings pointing at this target</div>
            <div id="adv-target-bindings" class="advanced-binding-list"></div>
          </div>
        </div>
      </div>`;

    this._populateAdvancedSelects();

    this._q("#adv-target-type").addEventListener("change", (e) => this._advApplyTargetType(e.target.value));

    this._q("#adv-source").addEventListener("change", () => this._advPopulateSourceEndpoints());
    this._q("#adv-src-ep").addEventListener("change", () => {
      this._advPopulateClusterOptions();
      this._advRenderSourceBindings();
    });
    this._q("#adv-target-device").addEventListener("change", () => this._advPopulateTargetEndpoints());
    this._q("#adv-dst-ep").addEventListener("change", () => this._advRenderTargetBindings());

    const getClusterIds = () => {
      const v = this._q("#adv-cluster").value;
      return v === "" ? [] : [Number(v)];
    };
    const getOpts = () => {
      const opts = {};
      const srcEp = this._q("#adv-src-ep").value;
      const dstEp = this._q("#adv-dst-ep").value;
      if (srcEp) opts.endpoint = Number(srcEp);
      if (dstEp) opts.dstEndpoint = Number(dstEp);
      return opts;
    };

    this._q("#adv-bind").addEventListener("click", async () => {
      const sourceIeee = this._q("#adv-source").value;
      const type = this._q("#adv-target-type").value;
      const clusters = getClusterIds();
      const opts = getOpts();
      this._setStatus("info", "Binding…", 0);
      // Group targets have no device IEEE of their own to rescan; coordinator
      // and device targets do — resolve it up front so the finally block can
      // rescan both ends regardless of how the bind call turns out.
      let targetIeeeForRescan = null;
      if (type === "coordinator") targetIeeeForRescan = this._coordinatorIeee();
      else if (type === "device") targetIeeeForRescan = this._q("#adv-target-device").value;
      let callErr = null;
      try {
        if (type === "group") {
          const groupId = Number(this._q("#adv-target-group").value);
          await this._api.bindGroup(sourceIeee, groupId, clusters, opts);
        } else {
          await this._api.bindIeee(sourceIeee, targetIeeeForRescan, clusters, opts);
        }
      } catch (err) {
        callErr = err;
        console.warn("[ZHA Bindings Manager] bind call raised, verifying against rescan anyway", err);
      } finally {
        // Rescan regardless of outcome — see v0.8.2 diagnosis: a failure here
        // often just means the cache was already stale, so refreshing both
        // ends clears phantom entries instead of leaving a confusing error.
        await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan));
        this._advRenderSourceBindings();
        this._advRenderTargetBindings();

        // Precise verification only makes sense when exactly one cluster and
        // a complete target (endpoint included) were specified — otherwise
        // ("bind default clusters", or a target endpoint zha_toolkit picked
        // on its own) we don't know exactly what to check, so fall back to
        // relaying zha_toolkit's own report instead of guessing.
        const bindTarget =
          type === "group"
            ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) }
            : { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint };
        const canVerify =
          clusters.length === 1 && opts.endpoint != null && (bindTarget.isGroup || bindTarget.endpoint != null);
        if (canVerify) {
          const outcome = this._verifyBindOutcome(sourceIeee, opts.endpoint, clusters[0], bindTarget);
          this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
        } else {
          this._setStatus(
            callErr ? "error" : "success",
            callErr ? callErr.message || String(callErr) : "Bind command sent.",
            callErr ? 0 : undefined
          );
        }
      }
    });

    this._q("#adv-unbind").addEventListener("click", async () => {
      const sourceIeee = this._q("#adv-source").value;
      const type = this._q("#adv-target-type").value;
      const clusters = getClusterIds();
      const opts = getOpts();
      this._setStatus("info", "Unbinding…", 0);
      let targetIeeeForRescan = null;
      if (type === "coordinator") targetIeeeForRescan = sourceIeee; // no separate device to add
      else if (type === "device") targetIeeeForRescan = this._q("#adv-target-device").value;

      // Capture "before" state ahead of the call so the finally block can
      // verify what actually changed, instead of trusting zha_toolkit's own
      // report (see v0.8.2 diagnosis). Coordinator unbind is a bulk op — it
      // can hit every cluster bound to the coordinator on this endpoint if
      // no single cluster was chosen — so its "before" is a list, not one
      // binding.
      const coord = this._coordinatorIeee();
      const beforeCoordList =
        type === "coordinator"
          ? this._rawBindings()
              .filter(
                (b) =>
                  normIeee(b.sourceIeee) === normIeee(sourceIeee) &&
                  !b.isGroup &&
                  normIeee(b.targetIeee) === normIeee(coord) &&
                  (opts.endpoint == null || Number(b.sourceEndpoint) === Number(opts.endpoint)) &&
                  (clusters.length === 0 || clusters.includes(b.clusterId))
              )
              .map((b) => ({
                clusterId: b.clusterId,
                target: { isGroup: false, ieee: b.targetIeee, endpoint: b.targetEndpoint },
              }))
          : null;
      const bindTarget =
        type === "group"
          ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) }
          : type === "device"
          ? { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint }
          : null;
      const before =
        bindTarget && clusters.length === 1 && opts.endpoint != null && (bindTarget.isGroup || bindTarget.endpoint != null)
          ? this._bindingPresent(sourceIeee, opts.endpoint, clusters[0], bindTarget)
          : null;

      let callErr = null;
      try {
        if (type === "group") {
          const groupId = Number(this._q("#adv-target-group").value);
          await this._api.unbindGroup(sourceIeee, groupId, clusters, opts);
        } else if (type === "coordinator") {
          await this._api.callToolkit("unbind_coordinator", {
            ieee: sourceIeee,
            ...(clusters.length ? { cluster: clusters } : {}),
          });
        } else {
          await this._api.unbindIeee(sourceIeee, targetIeeeForRescan, clusters, opts);
        }
      } catch (err) {
        callErr = err;
        console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
      } finally {
        await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan));
        this._advRenderSourceBindings();
        this._advRenderTargetBindings();

        if (type === "coordinator") {
          const outcome = this._verifyCoordinatorUnbindOutcome(beforeCoordList, sourceIeee, opts.endpoint);
          this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
        } else if (before !== null) {
          const outcome = this._verifyUnbindOutcome(before, sourceIeee, opts.endpoint, clusters[0], bindTarget);
          this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
        } else {
          this._setStatus(
            callErr ? "error" : "success",
            callErr ? callErr.message || String(callErr) : "Unbind command sent.",
            callErr ? 0 : undefined
          );
        }
      }
    });
  }

  _populateAdvancedSelects() {
    const src = this._q("#adv-source");
    const tgtDev = this._q("#adv-target-device");
    const tgtGroup = this._q("#adv-target-group");
    if (!src) return;
    const sortedDevices = [...this._devices].sort((a, b) =>
      this._deviceLabel(a).localeCompare(this._deviceLabel(b), undefined, { sensitivity: "base" })
    );
    const options = sortedDevices
      .map((d) => `<option value="${d.ieee}">${escapeHtml(this._deviceLabel(d))}</option>`)
      .join("");
    src.innerHTML = options;
    tgtDev.innerHTML = options;
    tgtGroup.innerHTML = [...this._groups]
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
      .map((g) => `<option value="${g.group_id}">${escapeHtml(g.name)} (${g.group_id})</option>`)
      .join("");
    this._advPopulateSourceEndpoints();
    this._advApplyTargetType(this._q("#adv-target-type").value);
  }

  /** Shows/hides the right target fields for "device" / "group" / "coordinator", and (re)loads
   *  the target endpoint list + reverse-binding panel when the type is "device". Shared by the
   *  Target-type dropdown's change handler and by pre-filling the form from Map drag-drop. */
  _advApplyTargetType(type) {
    const typeSel = this._q("#adv-target-type");
    if (typeSel) typeSel.value = type;
    this._q("#adv-target-device-wrap").style.display = type === "device" ? "" : "none";
    this._q("#adv-target-group-wrap").style.display = type === "group" ? "" : "none";
    this._q("#adv-target-ep-wrap").style.display = type === "device" ? "" : "none";
    this._q("#adv-target-panel-wrap").style.display = type === "device" ? "" : "none";
    if (type === "device") this._advPopulateTargetEndpoints();
  }

  /** Unique endpoint ids present on a device, from its cluster list (source of truth: zha/devices/clusters). */
  async _advDeviceEndpoints(ieee) {
    if (!ieee) return [];
    const clusters = await this._ensureClusters(ieee);
    return [...new Set(clusters.map((c) => c.endpoint_id))].sort((a, b) => a - b);
  }

  async _advPopulateSourceEndpoints() {
    const sel = this._q("#adv-src-ep");
    const ieee = this._q("#adv-source").value;
    if (!sel || !ieee) return;
    // Guard against out-of-order responses: if the source device is changed
    // again (or a pre-fill happens) before this fetch resolves, a stale
    // response must not clobber the newer one's dropdown.
    const reqId = (this._advSourceReqId = (this._advSourceReqId || 0) + 1);
    sel.innerHTML = `<option value="">Loading…</option>`;
    let endpoints = [];
    let failed = false;
    try {
      endpoints = await this._advDeviceEndpoints(ieee);
    } catch (err) {
      failed = true;
    }
    if (reqId !== this._advSourceReqId) return;
    sel.innerHTML = failed
      ? `<option value="">(failed to load)</option>`
      : endpoints.length
      ? endpoints.map((ep) => `<option value="${ep}">${ep}</option>`).join("")
      : `<option value="">(none found)</option>`;
    this._advPopulateClusterOptions();
    this._advRenderSourceBindings();
  }

  async _advPopulateTargetEndpoints() {
    const sel = this._q("#adv-dst-ep");
    const ieee = this._q("#adv-target-device").value;
    if (!sel || !ieee) return;
    const reqId = (this._advTargetReqId = (this._advTargetReqId || 0) + 1);
    sel.innerHTML = `<option value="">Loading…</option>`;
    let endpoints = [];
    let failed = false;
    try {
      endpoints = await this._advDeviceEndpoints(ieee);
    } catch (err) {
      failed = true;
    }
    if (reqId !== this._advTargetReqId) return;
    sel.innerHTML = failed
      ? `<option value="">(failed to load)</option>`
      : endpoints.length
      ? endpoints.map((ep) => `<option value="${ep}">${ep}</option>`).join("")
      : `<option value="">(none found)</option>`;
    this._advRenderTargetBindings();
  }

  /** Cluster dropdown = the selected source endpoint's OUTPUT clusters (the only clusters a bind can legally reference). */
  _advPopulateClusterOptions() {
    const clusterSel = this._q("#adv-cluster");
    const ieee = this._q("#adv-source").value;
    const ep = Number(this._q("#adv-src-ep").value);
    if (!clusterSel) return;
    const clusters = this._clusterCache.get(ieee) || [];
    const outClusters = uniqueClusters(clusters.filter((c) => c.type === "out" && c.endpoint_id === ep));
    const opts = [`<option value="">— zha-toolkit default —</option>`].concat(
      outClusters.map((c) => `<option value="${c.id}">${escapeHtml(clusterName(c.id))} (${hex4(c.id)})</option>`)
    );
    clusterSel.innerHTML = opts.join("");
  }

  _advRenderSourceBindings() {
    const wrap = this._q("#adv-source-bindings");
    if (!wrap) return;
    const ieee = this._q("#adv-source").value;
    const ep = Number(this._q("#adv-src-ep").value);
    const scanned = this._bindings.has(normIeee(ieee));
    if (!scanned) {
      wrap.innerHTML = `<p class="advanced-empty">Not scanned yet.</p>
        <button class="btn btn-small" id="adv-scan-source">Scan this device</button>`;
      const btn = this._q("#adv-scan-source");
      if (btn) {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "Scanning…";
          await this._scanBindings([ieee], { tries: this._retryCount });
          this._advRenderSourceBindings();
        });
      }
      return;
    }
    const rows = (this._bindings.get(normIeee(ieee)) || []).filter((b) => Number(b.sourceEndpoint) === ep);
    wrap.innerHTML = this._advBindingRows(rows, "target");
  }

  _advRenderTargetBindings() {
    const wrap = this._q("#adv-target-bindings");
    if (!wrap) return;
    const ieee = this._q("#adv-target-device").value;
    const epRaw = this._q("#adv-dst-ep").value;
    if (!ieee || epRaw === "") {
      wrap.innerHTML = `<p class="advanced-empty">Pick a target device and endpoint.</p>`;
      return;
    }
    const ep = Number(epRaw);
    const rows = this._rawBindings().filter(
      (b) => !b.isGroup && normIeee(b.targetIeee) === normIeee(ieee) && Number(b.targetEndpoint) === ep
    );
    wrap.innerHTML =
      this._advBindingRows(rows, "source") +
      `<p class="hint" style="margin-top:6px;">Based on devices scanned so far — run a full scan for complete results.</p>`;
  }

  /** Renders a list of binding rows; `otherEnd` is "target" (for the source panel) or "source" (for the target panel). */
  _advBindingRows(rows, otherEnd) {
    if (!rows.length) return `<p class="advanced-empty">No matching bindings found.</p>`;
    return rows
      .map((b) => {
        let label;
        if (otherEnd === "target") {
          if (b.isGroup) {
            const g = this._groups.find((gr) => gr.group_id === b.groupId);
            label = `Group: ${escapeHtml(g ? g.name : `#${b.groupId}`)}`;
          } else {
            const d = this._devices.find((dv) => dv.ieee === b.targetIeee);
            label = `${escapeHtml(d ? this._deviceLabel(d) : b.targetIeee)} <span class="muted">(ep ${b.targetEndpoint})</span>`;
          }
        } else {
          const d = this._devices.find((dv) => dv.ieee === b.sourceIeee);
          label = `${escapeHtml(d ? this._deviceLabel(d) : b.sourceIeee)} <span class="muted">(ep ${b.sourceEndpoint})</span>`;
        }
        return `<div class="advanced-binding-row">
          <span class="dot" style="background:${clusterColor(b.clusterId)}"></span>
          <span>${escapeHtml(clusterName(b.clusterId))}</span>
          <span class="spacer"></span>
          <span>${label}</span>
        </div>`;
      })
      .join("");
  }

  /** Switches to the Advanced tab with a source device (and optionally a target device/group)
   *  pre-filled — the single entry point for "create a binding" from both Map drag-drop and the
   *  Bindings-tab "+ Add binding" button, now that both need endpoint-aware binding (see the
   *  Advanced tab itself) rather than the old auto-cluster-matching popup, which had no way to
   *  target a specific endpoint and so didn't suit multi-gang switches. */
  async _jumpToAdvancedBind(sourceDevice, target) {
    this._switchView("advanced");
    const srcSel = this._q("#adv-source");
    if (!srcSel) return;
    srcSel.value = sourceDevice.ieee;
    await this._advPopulateSourceEndpoints();

    if (target && target.kind === "device") {
      this._advApplyTargetType("device");
      this._q("#adv-target-device").value = target.device.ieee;
      await this._advPopulateTargetEndpoints();
      this._advAutoSelectCluster(sourceDevice, target.device);
      this._setStatus("info", "Pick the endpoint(s) and cluster, then click Bind.");
    } else if (target && target.kind === "group") {
      this._advApplyTargetType("group");
      this._q("#adv-target-group").value = target.group.group_id;
      this._setStatus("info", "Pick the source endpoint and cluster, then click Bind.");
    } else {
      this._setStatus("info", `Source set to ${this._deviceLabel(sourceDevice)} — pick a target below.`);
    }
  }

  /** Best-effort convenience: if the chosen source endpoint's output clusters and the target
   *  device's input clusters (any endpoint) overlap, pre-select one — preferring the common
   *  "expected" clusters (On/Off, Level Control, etc.) — instead of leaving it on "default". */
  _advAutoSelectCluster(sourceDevice, targetDevice) {
    const clusterSel = this._q("#adv-cluster");
    if (!clusterSel) return;
    const srcEp = Number(this._q("#adv-src-ep").value);
    const srcClusters = this._clusterCache.get(sourceDevice.ieee) || [];
    const tgtClusters = this._clusterCache.get(targetDevice.ieee) || [];
    const outIds = new Set(srcClusters.filter((c) => c.type === "out" && c.endpoint_id === srcEp).map((c) => c.id));
    const inIds = new Set(tgtClusters.filter((c) => c.type === "in").map((c) => c.id));
    const common = [...outIds].filter((id) => inIds.has(id));
    if (!common.length) return;
    const preferred = new Set(DEFAULT_BINDABLE_OUT_CLUSTERS.concat(DEFAULT_BINDABLE_IN_CLUSTERS));
    const best = common.find((id) => preferred.has(id)) || common[0];
    if ([...clusterSel.options].some((o) => Number(o.value) === best)) {
      clusterSel.value = String(best);
    }
  }
}

function uniqueClusters(clusters) {
  const seen = new Set();
  const out = [];
  clusters.forEach((c) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  });
  return out;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------------------
// Static shell markup / styling
// ---------------------------------------------------------------------------
const SHELL_HTML = `
<div class="card">
  <div class="toolbar">
    <div class="tabs">
      <button class="tab active" data-view="graph">Map</button>
      <button class="tab" data-view="floorplan">Floor Plan</button>
      <button class="tab" data-view="table">Bindings</button>
      <button class="tab" data-view="devices">Devices</button>
      <button class="tab" data-view="advanced">Advanced</button>
    </div>
    <input id="search" class="search" placeholder="Search devices…">
    <button class="btn" id="btn-refresh-devices" title="Reload device list">⟳ Devices</button>
    <button class="btn btn-primary" id="btn-scan" title="Read current bindings from your Zigbee devices">Scan bindings</button>
    <button class="btn btn-small" id="btn-rescan-settings" title="Scan settings">⚙</button>
  </div>
  <div id="rescan-settings-panel" class="filter-panel">
    <div class="filter-group">
      <label class="row" for="scan-batch-size">Devices scanned at once (full network scan)
        <input type="number" id="scan-batch-size" min="1" max="30" style="width:4em; margin-left:6px;">
      </label>
      <p class="hint">Only applies to the full "Scan bindings" network scan — devices are read in concurrent
        batches of this size rather than one at a time, confirmed via live testing to genuinely overlap rather
        than just queue behind each other. A larger batch makes it less likely that several sleepy/offline
        devices happen to land in different batches and each drag their own batch out by ~45 seconds — but
        bigger isn't free: testing found that batches much above ~10-12 can cause otherwise-healthy devices to
        occasionally fail to respond (Zigbee airtime/collision contention from that much traffic at once, not
        a real device problem — retrying individually or rescanning usually succeeds). Increase cautiously and
        only if you've confirmed it holds up reliably on your own network. Default is ${DEFAULT_SCAN_BATCH_SIZE}.</p>
    </div>
    <div class="filter-group">
      <label class="row" for="rescan-retry-count">Retries for single-device rescan
        <input type="number" id="rescan-retry-count" min="1" max="10" style="width:4em; margin-left:6px;">
      </label>
      <p class="hint">Only applies when you rescan one device (e.g. the Devices tab or "Scan this device") —
        the full "Scan bindings" network scan is unaffected. Each extra retry costs about 45 seconds if the
        device genuinely doesn't respond, so more isn't free — it's a real trade-off between a better chance
        of catching a briefly-unreachable device and a longer wait. Default is ${DEFAULT_RETRY_COUNT}.</p>
    </div>
  </div>
  <div id="status" class="status" style="display:none"></div>

  <div id="view-graph" class="view active">
    <div class="graph-toolbar">
      <label class="row"><input type="checkbox" id="f-coordinator"> Coordinator</label>
      <label class="row"><input type="checkbox" id="f-routers"> Routers</label>
      <label class="row"><input type="checkbox" id="f-endDevices"> End devices</label>
      <label class="row"><input type="checkbox" id="f-groups"> Groups</label>
      <label class="row"><input type="checkbox" id="f-unbound"> Unbound devices</label>
      <label class="row" title="Also filters the Bindings tab, not just this Map view"><input type="checkbox" id="f-hideCoordinatorBindings" checked> Hide coordinator bindings (Map &amp; Bindings tab)</label>
      <span class="spacer"></span>
      <span id="scan-info" class="scan-info muted"></span>
      <button class="btn btn-small" id="btn-filters">Filters ▾</button>
      <button class="btn btn-small" id="btn-zoom-out">－</button>
      <button class="btn btn-small" id="btn-zoom-fit">Fit</button>
      <button class="btn btn-small" id="btn-zoom-in">＋</button>
      <button class="btn btn-small" id="btn-fullscreen" title="Toggle fullscreen">⛶</button>
    </div>
    <div id="filter-panel" class="filter-panel">
      <div class="filter-group">
        <div class="filter-group-title">Type</div>
        <div id="chips-types" class="chips"></div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">Manufacturer</div>
        <div id="chips-manufacturers" class="chips"></div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">Area</div>
        <div id="chips-areas" class="chips"></div>
      </div>
      <button class="btn btn-small" id="btn-clear-filters">Clear type / manufacturer / area filters</button>
    </div>
    <div class="graph-wrap">
      <svg id="graph-svg" viewBox="0 0 1200 840" preserveAspectRatio="xMidYMid meet"></svg>
      <div id="graph-empty" class="graph-empty"></div>
    </div>
    <p class="hint">Drag a device onto another device (or onto a group) to create a binding. Click a line to inspect / remove it.</p>
  </div>

  <div id="view-table" class="view">
    <div id="health-summary" class="health-summary" style="display:none"></div>
    <div id="table-filter-info" class="table-filter-info" style="display:none"></div>
    <div class="table-toolbar">
      <span class="health-filters" id="health-filters">
        <button class="chip active" data-health-filter="all">All</button>
        <button class="chip" data-health-filter="problems">Problems Only</button>
        <button class="chip" data-health-filter="error">Errors</button>
        <button class="chip" data-health-filter="warning">Warnings</button>
        <button class="chip" data-health-filter="info">Info</button>
      </span>
      <span class="spacer"></span>
      <button class="btn btn-small" id="btn-export-csv">Export CSV</button>
      <button class="btn btn-small" id="btn-export-json">Export JSON</button>
      <button class="btn btn-small" id="btn-export-print">Print / Save as PDF</button>
    </div>
    <div class="table-scroll">
    <table class="bindings-table">
      <thead><tr>
        <th data-sort="sourceLabel">Source</th>
        <th data-sort="typeLabel">Type</th>
        <th data-sort="areaLabel">Area</th>
        <th data-sort="manModel">Manufacturer / Model</th>
        <th data-sort="clusterLabel">Cluster</th>
        <th data-sort="targetLabel">Target</th>
        <th data-sort="healthRank">Health</th>
        <th></th>
      </tr></thead>
      <tbody id="table-body"></tbody>
    </table>
    </div>
  </div>

  <div id="view-devices" class="view">
    <div class="table-scroll">
    <table class="bindings-table">
      <thead><tr>
        <th data-sort="name">Name</th>
        <th data-sort="type">Type</th>
        <th data-sort="manufacturer">Manufacturer</th>
        <th data-sort="model">Model</th>
        <th data-sort="area">Area</th>
        <th data-sort="power">Power</th>
        <th data-sort="count">Bindings</th>
        <th data-sort="scanRank">Last scan</th>
      </tr></thead>
      <tbody id="devices-table-body"></tbody>
    </table>
    </div>
  </div>

  <div id="view-floorplan" class="view">
    <div class="graph-toolbar">
      <label class="row fp-image-row">Image URL
        <input type="text" id="fp-image-url" placeholder="/local/floorplan.png">
      </label>
      <button class="btn btn-small" id="fp-set-image">Set image</button>
      <span class="spacer"></span>
      <button class="btn btn-small" id="btn-fp-zoom-out">－</button>
      <button class="btn btn-small" id="btn-fp-zoom-fit">Fit</button>
      <button class="btn btn-small" id="btn-fp-zoom-in">＋</button>
      <label class="row fp-marker-row" for="fp-marker-scale" title="Scales device markers independently of image resolution — useful when a lower-resolution floor plan leaves markers looking oversized.">Marker size
        <input type="number" id="fp-marker-scale" min="40" max="200" step="10" style="width:4.5em; margin-left:6px;">%
      </label>
    </div>
    <div class="floorplan-layout">
      <div class="fp-sidebar">
        <div class="filter-group-title">Unplaced devices</div>
        <div id="fp-unplaced-list" class="fp-unplaced-list"></div>
      </div>
      <div class="graph-wrap">
        <svg id="fp-svg" viewBox="0 0 1200 840" preserveAspectRatio="xMidYMid meet"></svg>
        <div id="fp-empty" class="graph-empty"></div>
      </div>
    </div>
    <p class="hint">Drop an image into your <code>www/</code> folder (e.g. <code>config/www/floorplan.png</code>) and reference it above as <code>/local/floorplan.png</code>. Drag a device from the list onto its spot on the plan to place it; drag a placed device to move it; click a placed device (without dragging) to send it back to the list.</p>
  </div>

  <div id="view-advanced" class="view"></div>

  <div id="dialog" class="dialog">
    <div id="dialog-backdrop" class="dialog-backdrop"></div>
    <div class="dialog-panel">
      <div class="dialog-header">
        <span id="dialog-title"></span>
        <button id="dialog-close" class="btn btn-small">✕</button>
      </div>
      <div id="dialog-body" class="dialog-body"></div>
    </div>
  </div>
</div>`;

const STYLE = `
:host { display:block; max-width:100%; }
.card {
  background: var(--ha-card-background, var(--card-background-color, #fff));
  border-radius: var(--ha-card-border-radius, 12px);
  box-shadow: var(--ha-card-box-shadow, none);
  border: 1px solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
  padding: 12px 16px 16px;
  color: var(--primary-text-color);
  font-family: var(--paper-font-body1_-_font-family, inherit);
  box-sizing: border-box; max-width:100%; overflow-x:hidden;
}
.toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
.tabs { display:flex; gap:4px; flex-wrap:wrap; }
/* Any element that would otherwise force the card wider than the screen
   (a wide table, a long unbreakable label) scrolls within itself instead. */
.table-scroll { max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; }
.tab {
  background: none; border: none; padding: 6px 12px; border-radius: 8px;
  color: var(--secondary-text-color); cursor: pointer; font-weight:500;
}
.tab.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }
.search {
  flex: 1 1 160px; min-width: 120px; padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color);
}
.btn {
  border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.9em;
}
.btn:hover { filter: brightness(0.97); }
.btn:disabled { opacity: 0.6; cursor: default; }
.btn-primary { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: transparent; }
.btn-danger { background: var(--error-color, #db4437); color: #fff; border-color: transparent; }
.btn-small { padding: 3px 8px; font-size: 0.8em; }
.status { margin: 4px 0 10px; padding: 8px 12px; border-radius: 8px; font-size: 0.9em; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.status-info { background: rgba(3,169,244,0.12); color: var(--primary-text-color); }
.status-success { background: rgba(76,175,80,0.15); color: var(--primary-text-color); }
.status-error { background: rgba(244,67,54,0.15); color: var(--primary-text-color); }
.status-text { flex: 1; }
.status-close {
  flex: none; border: none; background: transparent; cursor: pointer; font-size: 1.1em;
  line-height: 1; padding: 0 2px; color: inherit; opacity: 0.6;
}
.status-close:hover { opacity: 1; }
.scan-cell { display:flex; flex-direction:column; align-items:flex-start; gap:4px; min-width:150px; }
.scan-cell-status { font-size:0.85em; }
.scan-cell-failed .scan-cell-status, .scan-cell-never .scan-cell-status { color: var(--error-color, #db4437); }
.scan-cell-partial .scan-cell-status { color: var(--warning-color, #ff9800); }
.scan-cell-ok .scan-cell-status { color: var(--success-color, #4caf50); }
.scan-wake-hint { font-size:0.78em; color: var(--secondary-text-color); font-style:italic; }
.scan-cell-btn { align-self:flex-start; }
.view { display:none; }
.view.active { display:block; }
.graph-toolbar { display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:6px; font-size:0.85em; }
.graph-toolbar .row { display:flex; align-items:center; gap:4px; cursor:pointer; user-select:none; }
.spacer { flex:1; }
.scan-info { font-size: 0.85em; white-space: nowrap; }
.filter-panel { display:none; border:1px solid var(--divider-color, #e0e0e0); border-radius:10px;
  padding:10px 12px 12px; margin-bottom:10px; background: var(--secondary-background-color, #fafafa); }
.filter-panel.open { display:block; }
.filter-group { margin-bottom:8px; }
.filter-group-title { font-size:0.72em; text-transform:uppercase; letter-spacing:.04em;
  color: var(--secondary-text-color); margin-bottom:5px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chip { border:1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color); border-radius: 999px; padding: 3px 10px; font-size: 0.78em; cursor: pointer; }
.chip:hover { filter: brightness(0.97); }
.chip.active { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: transparent; }
/* Base (in-dashboard card) graph height scales with viewport so it isn't
   cramped on a laptop-sized window, but stays reasonable on small screens. */
.graph-wrap { position:relative; width:100%; height: clamp(420px, 62vh, 820px); border-radius: 10px; overflow:hidden;
  background: var(--secondary-background-color, #fafafa); border: 1px solid var(--divider-color, #e0e0e0); }
#graph-svg { width:100%; height:100%; touch-action:none; cursor: grab; }
/* Fullscreen mode: card takes over the whole browser viewport, graph fills
   all remaining vertical space after the toolbars. */
.card.fullscreen {
  position: fixed; inset: 0; z-index: 1000; border-radius: 0;
  display: flex; flex-direction: column; overflow: auto;
}
.card.fullscreen #view-graph.active { display:flex; flex-direction:column; flex:1; min-height:0; }
.card.fullscreen .graph-wrap { flex:1; height:auto; min-height: 260px; }

/* Floor plan tab */
.fp-image-row { flex: 1 1 320px; display:flex; align-items:center; gap:6px; }
.fp-image-row input { flex:1; padding:5px 8px; border-radius:6px; border:1px solid var(--divider-color, #ccc);
  background: var(--card-background-color); color: var(--primary-text-color); }
.floorplan-layout { display:flex; gap:10px; align-items:stretch; }
.fp-sidebar { flex: 0 0 180px; width:180px; border:1px solid var(--divider-color, #e0e0e0); border-radius:10px;
  padding:8px; overflow-y:auto; max-height: clamp(420px, 62vh, 820px);
  background: var(--secondary-background-color, #fafafa); }
.fp-unplaced-list { display:flex; flex-direction:column; gap:6px; }
.fp-chip { border:1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color); border-radius:8px; padding:5px 8px; font-size:0.8em; cursor:grab; user-select:none; }
.fp-chip:active { cursor:grabbing; }
.floorplan-layout .graph-wrap { flex:1; min-width:0; }
.fp-ghost { position:fixed; z-index:2000; background: var(--primary-color); color: var(--text-primary-color, #fff);
  padding:4px 10px; border-radius:8px; font-size:0.8em; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.3); }
.card.fullscreen #view-floorplan.active { display:flex; flex-direction:column; flex:1; min-height:0; }
.card.fullscreen #view-floorplan.active .floorplan-layout { flex:1; min-height:0; }
.card.fullscreen #view-floorplan.active .graph-wrap { height:auto; }
.card.fullscreen #view-floorplan.active .fp-sidebar { max-height:none; }
.graph-empty { position:absolute; inset:0; display:none; align-items:center; justify-content:center; color: var(--secondary-text-color); }
.hint { font-size: 0.8em; color: var(--secondary-text-color); margin: 8px 2px 0; }
.node { cursor: grab; }
.node-shape { stroke: var(--card-background-color, #fff); stroke-width: 2; }
.node-device { fill: #607d8b; }
.node-coordinator { fill: #ffb300; }
.node-group { fill: none; stroke: #8e24aa; stroke-width: 2.5; }
.node.drop-target .node-shape { filter: drop-shadow(0 0 6px var(--primary-color)); stroke: var(--primary-color); }
.node-icon { font-size: 18px; pointer-events:none; }
.node-label { font-size: 11px; text-anchor: middle; fill: var(--primary-text-color); pointer-events:none; }
/* Floor Plan labels sit on an arbitrary uploaded image, not the card's own
   background, so trusting the theme's text color (as the Map view safely
   does) can go invisible — e.g. dark theme = light text, sitting on a white
   blueprint. A halo outline in the card's background color keeps the label
   readable against light or dark image content either way. */
.fp-node .node-label {
  paint-order: stroke;
  stroke: var(--card-background-color, #fff);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.edge { stroke-width: 2.5; cursor:pointer; opacity: 0.85; }
.edge:hover { stroke-width: 4; opacity: 1; }
.table-filter-info { display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:6px 10px;
  border-radius:8px; background: rgba(76,154,255,0.12); font-size:0.85em; }
.table-toolbar { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.85em; flex-wrap:wrap; }
.health-filters { display:flex; gap:6px; flex-wrap:wrap; }
.bindings-table { width:100%; border-collapse: collapse; font-size: 0.9em; }
.bindings-table th, .bindings-table td { text-align:left; padding: 8px 10px; border-bottom: 1px solid var(--divider-color, #eee); }
.bindings-table th[data-sort] { cursor: pointer; user-select: none; white-space: nowrap; }
.bindings-table th[data-sort]:hover { color: var(--primary-color); }
.bindings-table th.sort-asc::after { content: " \\25B2"; font-size: 0.75em; }
.bindings-table th.sort-desc::after { content: " \\25BC"; font-size: 0.75em; }
.health-summary { display:flex; align-items:center; gap:10px; margin-bottom:10px; padding:8px 12px;
  border-radius:8px; background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee);
  font-size:0.85em; flex-wrap:wrap; }
.health-summary-title { font-weight:600; }
.health-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:12px; font-size:0.9em; }
.health-badge { border:none; border-radius:12px; padding:4px 10px; font-size:0.85em; cursor:pointer; white-space:nowrap; }
.health-ok, .health-badge.health-ok, .health-chip.health-ok { background: rgba(76,206,172,0.15); color: #2e9e83; }
.health-info, .health-badge.health-info, .health-chip.health-info { background: rgba(76,154,255,0.15); color: #2f6fce; }
.health-warning, .health-badge.health-warning, .health-chip.health-warning { background: rgba(255,179,0,0.18); color: #b26a00; }
.health-error, .health-badge.health-error, .health-chip.health-error { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.src-link { color: var(--primary-color); cursor: pointer; text-decoration: none; }
.src-link:hover { text-decoration: underline; }
.muted { color: var(--secondary-text-color); }
.dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.advanced-form-wrap { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.advanced-form { display:flex; flex-direction:column; gap:10px; flex: 1 1 340px; max-width: 480px; }
.advanced-form label { display:flex; flex-direction:column; gap:4px; font-size:0.85em; color: var(--secondary-text-color); }
.advanced-form select, .advanced-form input { padding:6px 8px; border-radius:6px; border:1px solid var(--divider-color, #ccc);
  background: var(--card-background-color); color: var(--primary-text-color); }
.advanced-side { display:flex; flex-direction:column; gap:12px; flex: 1 1 280px; min-width:0; }
.advanced-panel { border:1px solid var(--divider-color, #e0e0e0); border-radius:10px; padding:8px 10px;
  background: var(--secondary-background-color, #fafafa); }
.advanced-binding-list { display:flex; flex-direction:column; gap:6px; font-size:0.85em; max-height:280px; overflow-y:auto; margin-top:6px; }
.advanced-binding-row { display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:6px;
  background: var(--card-background-color); }
.advanced-empty { color: var(--secondary-text-color); font-size:0.85em; padding:4px 0 0; margin:0; }
.dialog { position: fixed; inset:0; display:none; z-index: 20; align-items:center; justify-content:center; }
.dialog.open { display:flex; }
.dialog-backdrop { position:absolute; inset:0; background: rgba(0,0,0,0.4); }
.dialog-panel { position:relative; background: var(--card-background-color, #fff); color: var(--primary-text-color);
  border-radius: 12px; padding: 16px 18px; width: min(560px, 92vw); max-height: 82vh; overflow:auto; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
.dialog-header { display:flex; align-items:center; justify-content:space-between; font-weight:600; margin-bottom:10px; }
.row { display:flex; align-items:center; gap:6px; font-size:0.92em; }
.dialog-actions { display:flex; gap:8px; margin-top:14px; }
.detail-table td { padding: 4px 8px; font-size: 0.9em; }

/* Narrow (phone) screens: stack the floor-plan sidebar above the map
   instead of beside it, and trim padding so nothing forces extra width. */
@media (max-width: 600px) {
  .card { padding: 10px 10px 12px; }
  .floorplan-layout { flex-direction: column; }
  .fp-sidebar { width:100%; flex: 0 0 auto; max-height: 160px; }
  .card.fullscreen #view-floorplan.active .fp-sidebar { max-height: 160px; }
  .dialog-panel { width: min(560px, 96vw); padding: 12px 14px; }
}
`;

customElements.define("zha-binding-map-card", ZhaBindingMapCard);

window.customCards = window.customCards || [];
window.customCards.push({
  // NOTE: "type" and the customElements.define() name above must never change —
  // existing dashboards reference `custom:zha-binding-map-card` in their YAML.
  // Only the display name/description below (shown in the card picker and HACS)
  // reflect the "ZHA Bindings Manager" project name.
  type: "zha-binding-map-card",
  name: "ZHA Bindings Manager",
  description: "Visual manager for ZHA Zigbee direct bindings — graph/table overview plus drag-and-drop bind/unbind, built on top of zha-toolkit.",
});
