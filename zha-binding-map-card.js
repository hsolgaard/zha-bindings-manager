/**
 * ZHA Bindings Manager
 * --------------------
 * A visual manager for Zigbee (ZHA) direct bindings: a graph/table overview
 * of every binding on your network, plus drag-and-drop bind/unbind.
 *
 * GENERATED FILE — built from src/ via `npm run build` (see build.js).
 * Don't hand-edit this file directly; edit the source in src/ and rebuild.
 *
 * The custom element itself is still named/typed "zha-binding-map-card"
 * (see customElements.define() and window.customCards.push() below) — that
 * must never change, since it's what dashboard YAML references
 * (`type: custom:zha-binding-map-card`).
 *
 * This card is a UI layer on top of two things that already exist on your
 * Home Assistant install:
 *   1. The native ZHA websocket API (read-only device/cluster/group info).
 *   2. The "zha_toolkit" custom integration (https://github.com/mdeweerd/zha-toolkit),
 *      used for the actual bind / unbind / "read binding table" operations.
 *
 * zha_toolkit MUST be installed (via HACS) and working for bind/unbind/scan
 * to function. See README.md for details.
 *
 * Version: 0.24.0
 */
(() => {
  // src/constants.js
  var ZTK_DOMAIN = "zha_toolkit";
  var CARD_VERSION = "0.24.0";
  var CAPABILITY_DB_REPO = "hsolgaard/zigbee-capabilities";
  var DEFAULT_BINDABLE_OUT_CLUSTERS = [5, 6, 8, 258, 768];
  var MEMBERSHIP_EDGE_COLOR = "#8e24aa";
  var HISTORY_LIMIT = 10;
  var DEFAULT_RETRY_COUNT = 2;
  var DEFAULT_BINDABLE_IN_CLUSTERS = [1026];
  var DEFAULT_SCAN_BATCH_SIZE = 10;
  var DEFAULT_FP_MARKER_SCALE = 100;
  var GREEN_POWER_ENDPOINT = 242;
  var ENDPOINT_CONTROL_TYPES = [
    "Not set",
    "Light",
    "Fan",
    "Outlet / socket",
    "Heating / valve",
    "Cover / curtain",
    "Other appliance"
  ];
  var CLUSTER_INFO = {
    0: { name: "Basic", cat: "misc" },
    1: { name: "Power Configuration", cat: "misc" },
    2: { name: "Device Temperature Configuration", cat: "misc" },
    3: { name: "Identify", cat: "misc" },
    4: { name: "Groups", cat: "misc" },
    5: { name: "Scenes", cat: "control" },
    6: { name: "On/Off", cat: "control" },
    7: { name: "On/Off Switch Configuration", cat: "control" },
    8: { name: "Level Control", cat: "control" },
    9: { name: "Alarms", cat: "misc" },
    10: { name: "Time", cat: "misc" },
    21: { name: "Commissioning", cat: "misc" },
    25: { name: "OTA Upgrade", cat: "misc" },
    32: { name: "Poll Control", cat: "misc" },
    33: { name: "Green Power", cat: "misc" },
    257: { name: "Door Lock", cat: "security" },
    258: { name: "Window Covering", cat: "control" },
    512: { name: "Pump Configuration and Control", cat: "climate" },
    513: { name: "Thermostat", cat: "climate" },
    514: { name: "Fan Control", cat: "climate" },
    515: { name: "Dehumidification Control", cat: "climate" },
    516: { name: "Thermostat UI Configuration", cat: "climate" },
    768: { name: "Color Control", cat: "control" },
    769: { name: "Ballast Configuration", cat: "control" },
    1024: { name: "Illuminance", cat: "sensor" },
    1025: { name: "Illuminance Level Sensing", cat: "sensor" },
    1026: { name: "Temperature", cat: "sensor" },
    1027: { name: "Pressure", cat: "sensor" },
    1028: { name: "Flow Measurement", cat: "sensor" },
    1029: { name: "Humidity", cat: "sensor" },
    1030: { name: "Occupancy", cat: "sensor" },
    1280: { name: "IAS Zone", cat: "security" },
    1281: { name: "IAS ACE", cat: "security" },
    1282: { name: "IAS WD (Siren)", cat: "security" },
    1794: { name: "Metering", cat: "sensor" },
    2817: { name: "Meter Identification", cat: "sensor" },
    2820: { name: "Electrical Measurement", cat: "sensor" },
    2821: { name: "Diagnostics", cat: "misc" },
    4096: { name: "Touchlink Commissioning", cat: "misc" }
  };
  var CAT_COLOR = {
    control: "#4c9aff",
    climate: "#ff8a4c",
    sensor: "#4cceac",
    security: "#ff5c5c",
    misc: "#9aa4b2"
  };
  var CLUSTER_FRIENDLY_PHRASE = {
    5: "scene control",
    6: "on/off control",
    7: "on/off switch configuration",
    8: "brightness control",
    257: "lock control",
    258: "open/close control",
    513: "temperature control",
    514: "fan speed control",
    768: "color control",
    769: "ballast control"
  };
  function clusterFriendlyPhrase(id) {
    const n = Number(id);
    return CLUSTER_FRIENDLY_PHRASE[n] || `${clusterName(n)} control`;
  }
  var CAPABILITY_OUTCOME_PHRASE = {
    5: "Scene control",
    6: "On/off control",
    7: "On/off switch configuration",
    8: "Brightness control",
    257: "Lock control",
    258: "Open/close control",
    512: "Pump control",
    513: "Thermostat control",
    514: "Fan speed control",
    515: "Dehumidification control",
    768: "Color control",
    769: "Ballast control",
    1024: "Illuminance sensing",
    1025: "Illuminance level sensing",
    1026: "Temperature sensing",
    1027: "Pressure sensing",
    1028: "Flow sensing",
    1029: "Humidity sensing",
    1030: "Occupancy sensing",
    1280: "Motion/intrusion alarm",
    1281: "Alarm control (ACE)",
    1282: "Siren/warning device",
    1794: "Energy metering",
    2817: "Meter identification",
    2820: "Electrical measurement"
  };
  function capabilityOutcomePhrase(id, fallbackName) {
    const n = Number(id);
    return CAPABILITY_OUTCOME_PHRASE[n] || fallbackName || clusterName(n);
  }
  var CLUSTER_COMMANDS = {
    5: {
      0: "Add",
      1: "View",
      2: "Remove",
      3: "Remove all",
      4: "Store",
      5: "Recall",
      6: "Get scene membership",
      64: "Enhanced add",
      65: "Enhanced view",
      66: "Copy"
    },
    6: {
      0: "Off",
      1: "On",
      2: "Toggle",
      64: "Off with effect",
      65: "On with recall global scene",
      66: "On with timed off"
    },
    8: {
      0: "Move to level",
      1: "Move",
      2: "Step",
      3: "Stop",
      4: "Move to level (with on/off)",
      5: "Move (with on/off)",
      6: "Step (with on/off)",
      7: "Stop (with on/off)"
    },
    9: {
      0: "Reset alarm",
      1: "Reset all alarms",
      2: "Get alarm",
      3: "Reset alarm log"
    },
    257: {
      0: "Lock door",
      1: "Unlock door",
      2: "Toggle door",
      3: "Unlock with timeout",
      4: "Get log record",
      5: "Set PIN code",
      6: "Get PIN code",
      7: "Clear PIN code",
      8: "Clear all PIN codes",
      9: "Set user status",
      10: "Get user status",
      11: "Set week day schedule",
      12: "Get week day schedule",
      13: "Clear week day schedule",
      14: "Set year day schedule",
      15: "Get year day schedule",
      16: "Clear year day schedule",
      17: "Set holiday schedule",
      18: "Get holiday schedule",
      19: "Clear holiday schedule",
      20: "Set user type",
      21: "Get user type",
      22: "Set RFID code",
      23: "Get RFID code",
      24: "Clear RFID code",
      25: "Clear all RFID codes"
    },
    258: {
      0: "Up/open",
      1: "Down/close",
      2: "Stop",
      4: "Go to lift value",
      5: "Go to lift percentage",
      7: "Go to tilt value",
      8: "Go to tilt percentage"
    },
    513: {
      0: "Setpoint raise/lower",
      1: "Set weekly schedule",
      2: "Get weekly schedule",
      3: "Clear weekly schedule",
      4: "Get relay status log"
    },
    768: {
      0: "Move to hue",
      1: "Move hue",
      2: "Step hue",
      3: "Move to saturation",
      4: "Move saturation",
      5: "Step saturation",
      6: "Move to hue and saturation",
      7: "Move to color",
      8: "Move color",
      9: "Step color",
      10: "Move to color temperature",
      64: "Enhanced move to hue",
      65: "Enhanced move hue",
      66: "Enhanced step hue",
      67: "Enhanced move to hue and saturation",
      68: "Color loop set",
      71: "Stop move/step",
      75: "Move color temperature",
      76: "Step color temperature"
    },
    1280: {
      0: "Enroll response",
      1: "Initiate normal operation mode",
      2: "Initiate test mode"
    },
    1281: {
      0: "Arm",
      1: "Bypass",
      2: "Emergency",
      3: "Fire",
      4: "Panic",
      5: "Get zone ID map",
      6: "Get zone info",
      7: "Get panel status",
      8: "Get bypassed zone list",
      9: "Get zone status"
    },
    1282: {
      0: "Start warning",
      1: "Squawk"
    }
  };
  var HEALTH_ICON = { ok: "\u2705", info: "\u2139", warning: "\u26A0", error: "\u274C" };
  var HEALTH_LABEL = { ok: "OK", info: "Info", warning: "Warning", error: "Error" };
  var HEALTH_RANK = { error: 0, warning: 1, info: 2, ok: 3 };
  var DOMAIN_LABELS = {
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
    device_tracker: "Device Tracker"
  };
  function domainLabel(domain) {
    return DOMAIN_LABELS[domain] || domain;
  }
  var DEVICE_CLASS_LABELS = {
    cover: {
      garage: "Garage Door",
      gate: "Gate",
      door: "Door",
      window: "Window",
      blind: "Blind",
      curtain: "Curtain",
      shade: "Shade",
      shutter: "Shutter",
      awning: "Awning"
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
      tamper: "Tamper Sensor"
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
      signal_strength: "Signal Sensor"
    },
    switch: {
      outlet: "Outlet",
      switch: "Switch"
    }
  };
  function refinedDomainLabel(domain, deviceClass) {
    const table = DEVICE_CLASS_LABELS[domain];
    if (table && deviceClass && table[deviceClass]) return table[deviceClass];
    return domainLabel(domain);
  }
  var TYPE_PRIORITY = [
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
    "device_tracker"
  ];
  function clusterName(id) {
    const n = Number(id);
    return CLUSTER_INFO[n] ? CLUSTER_INFO[n].name : `Cluster 0x${n.toString(16).padStart(4, "0")}`;
  }
  function clusterColor(id) {
    const n = Number(id);
    return CAT_COLOR[CLUSTER_INFO[n] && CLUSTER_INFO[n].cat || "misc"];
  }
  function hex4(n) {
    return `0x${Number(n).toString(16).padStart(4, "0")}`;
  }

  // src/utils.js
  function parseClusterIdInput(raw) {
    const s = (raw || "").trim();
    if (!s) return null;
    const n = /^0x/i.test(s) ? parseInt(s, 16) : Number(s);
    if (!Number.isInteger(n) || n < 0 || n > 65535) return null;
    return n;
  }
  function normIeee(ieee) {
    return (ieee || "").toLowerCase();
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
    if (diff < 6e4) return "just now";
    const mins = Math.floor(diff / 6e4);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }
  function medianMs(values) {
    if (!values || !values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function formatDurationMs(ms) {
    if (ms == null) return null;
    const s = ms / 1e3;
    return s < 1 ? "<1s" : `~${Math.round(s)}s`;
  }
  function extractErrorMessage(err) {
    if (err === null || err === void 0) return "unknown error";
    if (typeof err === "string") return err;
    if (typeof err === "number") {
      return `connection error (code ${err}) \u2014 check Settings \u2192 System \u2192 Logs for details`;
    }
    if (err.message) return err.message;
    if (err.error && err.error.message) return err.error.message;
    try {
      const s = JSON.stringify(err);
      if (s && s !== "{}") return s;
    } catch (e) {
    }
    return String(err);
  }
  function uniqueClusters(clusters) {
    const seen = /* @__PURE__ */ new Set();
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
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
  }

  // src/parser.js
  function bindingIdentityKey(b) {
    const target = b.isGroup ? `g:${Number(b.groupId)}` : `d:${normIeee(b.targetIeee)}:${Number(b.targetEndpoint)}`;
    return `${normIeee(b.sourceIeee)}|${Number(b.sourceEndpoint)}|${Number(b.clusterId)}|${target}`;
  }
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
      groupId: isGroup ? parseInt(String(dst.group).replace(/^0x/i, ""), 16) : null
    };
  }
  function bindingMatches(b, sourceIeee, sourceEp, clusterId, target) {
    if (normIeee(b.sourceIeee) !== normIeee(sourceIeee)) return false;
    if (Number(b.sourceEndpoint) !== Number(sourceEp)) return false;
    if (Number(b.clusterId) !== Number(clusterId)) return false;
    if (target.isGroup) return b.isGroup && Number(b.groupId) === Number(target.groupId);
    return !b.isGroup && normIeee(b.targetIeee) === normIeee(target.ieee) && Number(b.targetEndpoint) === Number(target.endpoint);
  }
  function ieeeBytesToString(bytes) {
    if (!Array.isArray(bytes) || bytes.length !== 8) return null;
    return bytes.slice().reverse().map((b) => Number(b).toString(16).padStart(2, "0")).join(":");
  }
  function le16ToNumber(bytes) {
    if (!Array.isArray(bytes) || bytes.length !== 2) return null;
    return Number(bytes[0]) + Number(bytes[1]) * 256;
  }
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
        if (page.length >= 2 && typeof page[1] === "number") total = page[1];
      }
      if (!entries) continue;
      for (const raw of entries) {
        try {
          const srcEp = raw.SrcEndpoint ?? raw.src_ep ?? raw.srcEndpoint;
          const clusterIdRaw = raw.ClusterId ?? raw.cluster_id ?? raw.clusterId;
          const dst = raw.DstAddress ?? raw.dst ?? {};
          const addrMode = Number(dst.addrmode ?? dst.AddrMode ?? dst.addr_mode ?? raw.DstAddrMode ?? 3);
          const isGroup = addrMode === 1;
          const dstIeeeRaw = dst.ieee ?? dst.IEEE ?? dst.dst_ieee;
          const dstIeee = Array.isArray(dstIeeeRaw) ? ieeeBytesToString(dstIeeeRaw) : dstIeeeRaw;
          const dstEp = dst.endpoint ?? dst.Endpoint ?? dst.dst_ep;
          const groupRaw = dst.nwk ?? dst.NWK ?? dst.group ?? dst.Group ?? dst.group_id;
          const group = Array.isArray(groupRaw) ? le16ToNumber(groupRaw) : groupRaw;
          if (srcEp == null || clusterIdRaw == null) continue;
          if (!isGroup && !dstIeee) {
            console.warn("[ZHA Bindings Manager] skipped a binds_get reply entry with an unparseable target IEEE", raw);
            continue;
          }
          const clusterId = typeof clusterIdRaw === "string" ? parseInt(clusterIdRaw.replace(/^0x/i, ""), 16) : Number(clusterIdRaw);
          out.push({
            id: `${sourceIeee}|${srcEp}|${clusterId}|${isGroup ? "g" + group : `${dstIeee}:${dstEp}`}`,
            sourceIeee: normIeee(sourceIeee),
            sourceEndpoint: srcEp,
            clusterId,
            isGroup,
            targetIeee: isGroup ? null : normIeee(String(dstIeee || "").replace(/^0x/i, "")),
            targetEndpoint: isGroup ? null : dstEp,
            groupId: isGroup ? Number(group) : null
          });
        } catch (err) {
          console.warn("[ZHA Bindings Manager] skipped an unparseable binds_get reply entry", raw, err);
        }
      }
    }
    return { entries: out, total };
  }

  // src/api-client.js
  var ZhaApi = class {
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
        target_ieee: targetIeee
      });
    }
    async nativeUnbindDevices(sourceIeee, targetIeee) {
      return this.hass.callWS({
        type: "zha/devices/unbind",
        source_ieee: sourceIeee,
        target_ieee: targetIeee
      });
    }
    // Native HA's zha/groups/bind and zha/groups/unbind websocket commands
    // used to live here (bindDeviceToGroup/unbindDeviceFromGroup). Removed —
    // bindDeviceToGroup had zero callers, and unbindDeviceFromGroup was the
    // confirmed root cause of "still on the device after rescanning" on group
    // unbinds (Hans tested zha_toolkit's unbind_group directly and it worked
    // immediately, while this native path kept failing). unbindGroup() below,
    // which goes through zha_toolkit like every other bind/unbind action in
    // this card, replaced its one real caller.
    /** Calls a zha_toolkit service and returns the event_data response object.
     *  On any failure, logs the full request + raw response to the browser
     *  console before throwing — the toast/error message the UI shows is
     *  necessarily short, but the console has everything zha_toolkit sent
     *  back (useful for diagnosing failures with no human-readable "warning"
     *  attached, e.g. a bare `success: false`). */
    async callToolkit(service, data, opts = {}) {
      if (!this.hass.services || !this.hass.services[ZTK_DOMAIN] || !this.hass.services[ZTK_DOMAIN][service]) {
        throw new Error(
          `Service ${ZTK_DOMAIN}.${service} is not available. Is the "zha-toolkit" custom component installed and loaded? (HACS > Integrations)`
        );
      }
      let result;
      try {
        result = await this.hass.callService(ZTK_DOMAIN, service, data, void 0, false, true);
      } catch (err) {
        console.error(`[ZHA Bindings Manager] ${service} call threw`, { request: data, error: err });
        throw new Error(`${service} failed: ${extractErrorMessage(err)}`);
      }
      const response = result && result.response ? result.response : result;
      if (!response) {
        console.error(`[ZHA Bindings Manager] ${service} returned no response data`, { request: data, result });
        throw new Error(
          `${service} returned no data. Your Home Assistant core version may be older than 2023.7 (response data support) or zha-toolkit needs updating.`
        );
      }
      const hasErrors = response.errors && response.errors.length;
      const failed = hasErrors || response.success === false;
      if (failed) {
        if (opts.allowPartial) {
          console.warn(`[ZHA Bindings Manager] ${service} reported failure \u2014 continuing with any partial data`, {
            request: data,
            response
          });
        } else if (hasErrors) {
          console.error(`[ZHA Bindings Manager] ${service} reported errors`, { request: data, response });
          throw new Error(`${service}: ${response.errors.join("; ")}`);
        } else {
          console.error(`[ZHA Bindings Manager] ${service} reported failure (full response below)`, {
            request: data,
            response
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
      const failed = response.errors && response.errors.length || response.success === false;
      const fromResult = response.result && Object.keys(response.result).length ? Object.values(response.result).map((b) => normalizeBinding(ieee, b)) : [];
      const { entries: fromReplies, total: repliesTotal } = extractBindingsFromReplies(ieee, response.replies);
      const seen = /* @__PURE__ */ new Set();
      const bindings = [...fromResult, ...fromReplies].filter((b) => {
        const key = bindingIdentityKey(b);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (failed && !bindings.length) {
        throw new Error(
          `binds_get reported failure${response.warning ? `: ${response.warning}` : ""}${response.errors && response.errors.length ? ` (${response.errors.join("; ")})` : ""}`
        );
      }
      return { bindings, partial: failed, retrievedCount: bindings.length, totalCount: repliesTotal };
    }
    /** Create a device -> device binding for one or more clusters. */
    async bindIeee(sourceIeee, targetIeee, clusterIds, opts = {}) {
      const data = {
        ieee: sourceIeee,
        command_data: targetIeee
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
        command_data: targetIeee
      };
      if (clusterIds && clusterIds.length) data.cluster = clusterIds;
      if (opts.endpoint != null) data.endpoint = opts.endpoint;
      if (opts.dstEndpoint != null) data.dst_endpoint = opts.dstEndpoint;
      return this.callToolkit("binds_remove_all", data);
    }
    /** Live per-device command-discovery scan via zha_toolkit.scan_device —
     *  separate from the passive binds_get-based network scan this card
     *  otherwise relies on. Sends the real ZCL Discover_Commands_Received/
     *  Generated requests to the device itself, so it's slower and heavier
     *  than everything else the card does (multiple round-trips per cluster)
     *  and zha_toolkit also writes a copy of the result to
     *  config/scan/*_result.txt on the HA side — deliberately not run
     *  automatically, only on explicit user action.
     *  Returns the raw `scan` object zha_toolkit produces (see its
     *  scan_device.py: {ieee, nwk, model, manufacturer, endpoints: [...]});
     *  parsing which clusters/commands came back is left to the caller.
     *  Not every device implements command discovery — an empty
     *  commands_received/generated for a cluster can mean either "confirmed
     *  zero commands" or "device didn't answer discovery at all"; zha_toolkit
     *  doesn't currently preserve that distinction in the data it returns
     *  (only in its own HA-side log), so callers must present an empty
     *  result as ambiguous, not as a confirmed negative. */
    async scanDeviceCommands(ieee, opts = {}) {
      const data = { ieee };
      if (opts.endpoint != null) data.endpoint = opts.endpoint;
      if (opts.tries != null) data.tries = opts.tries;
      const response = await this.callToolkit("scan_device", data);
      return response.scan || null;
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
  };

  // src/template.js
  var SHELL_HTML = `
<div class="card">
  <div class="toolbar">
    <div class="tabs">
      <button class="tab active" data-view="graph">Map</button>
      <button class="tab" data-view="floorplan">Floor Plan</button>
      <button class="tab" data-view="table">Bindings</button>
      <button class="tab" data-view="devices">Devices</button>
      <button class="tab" data-view="capexplorer">Zigbee Capability Explorer</button>
      <button class="tab" data-view="advanced">Advanced</button>
    </div>
    <input id="search" class="search" placeholder="Search devices\u2026">
    <button class="btn" id="btn-refresh-devices" title="Reload device list">\u27F3 Devices</button>
    <button class="btn btn-primary" id="btn-scan" title="Read current bindings from your Zigbee devices">Scan bindings</button>
    <button class="btn btn-small" id="btn-rescan-settings" title="Scan settings">\u2699</button>
  </div>
  <div id="rescan-settings-panel" class="filter-panel">
    <div class="filter-group">
      <label class="row" for="scan-batch-size">Devices scanned at once (full network scan)
        <input type="number" id="scan-batch-size" min="1" max="30" style="width:4em; margin-left:6px;">
      </label>
      <p class="hint">Only applies to the full "Scan bindings" network scan \u2014 devices are read in concurrent
        batches of this size rather than one at a time, confirmed via live testing to genuinely overlap rather
        than just queue behind each other. A larger batch makes it less likely that several sleepy/offline
        devices happen to land in different batches and each drag their own batch out by ~45 seconds \u2014 but
        bigger isn't free: testing found that batches much above ~10-12 can cause otherwise-healthy devices to
        occasionally fail to respond (Zigbee airtime/collision contention from that much traffic at once, not
        a real device problem \u2014 retrying individually or rescanning usually succeeds). Increase cautiously and
        only if you've confirmed it holds up reliably on your own network. Default is ${DEFAULT_SCAN_BATCH_SIZE}.</p>
    </div>
    <div class="filter-group">
      <label class="row" for="rescan-retry-count">Retries for single-device rescan
        <input type="number" id="rescan-retry-count" min="1" max="10" style="width:4em; margin-left:6px;">
      </label>
      <p class="hint">Only applies when you rescan one device (e.g. the Devices tab or "Scan this device") \u2014
        the full "Scan bindings" network scan is unaffected. Each extra retry costs about 45 seconds if the
        device genuinely doesn't respond, so more isn't free \u2014 it's a real trade-off between a better chance
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
      <label class="row" title="Some real bindings are a device reporting its own state (e.g. a light reporting to a group it belongs to) rather than controlling anything. These are hidden here by default so the map reads as &quot;who controls what&quot; \u2014 they're still real and still shown in full on the Bindings tab."><input type="checkbox" id="f-showReportingBindings"> Show reporting-only bindings (Map only)</label>
      <span class="spacer"></span>
      <span id="scan-info" class="scan-info muted"></span>
      <button class="btn btn-small" id="btn-filters">Filters \u25BE</button>
      <button class="btn btn-small" id="btn-zoom-out">\uFF0D</button>
      <button class="btn btn-small" id="btn-zoom-fit">Fit</button>
      <button class="btn btn-small" id="btn-zoom-in">\uFF0B</button>
      <button class="btn btn-small" id="btn-fullscreen" title="Toggle fullscreen">\u26F6</button>
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
    <p id="graph-role-legend" class="hint" style="display:none">\u{1F579} badge = this device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here (e.g. a wired/local load alongside a Zigbee-bound one) \u2014 click the device to see the full per-endpoint breakdown.</p>
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
        <th>Endpoints</th>
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
      <button class="btn btn-small" id="btn-fp-zoom-out">\uFF0D</button>
      <button class="btn btn-small" id="btn-fp-zoom-fit">Fit</button>
      <button class="btn btn-small" id="btn-fp-zoom-in">\uFF0B</button>
      <label class="row fp-marker-row" for="fp-marker-scale" title="Scales device markers independently of image resolution \u2014 useful when a lower-resolution floor plan leaves markers looking oversized.">Marker size
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
    <p id="fp-role-legend" class="hint" style="display:none">\u{1F579} badge = this device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here (e.g. a wired/local load alongside a Zigbee-bound one) \u2014 click the device to see the full per-endpoint breakdown.</p>
  </div>

  <div id="view-capexplorer" class="view"></div>

  <div id="view-advanced" class="view"></div>

  <div id="dialog" class="dialog">
    <div id="dialog-backdrop" class="dialog-backdrop"></div>
    <div class="dialog-panel">
      <div class="dialog-header">
        <span id="dialog-title"></span>
        <button id="dialog-close" class="btn btn-small">\u2715</button>
      </div>
      <div id="dialog-body" class="dialog-body"></div>
    </div>
  </div>
</div>`;

  // src/styles.js
  var STYLE = `
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
.node-role-badge-bg { fill: var(--card-background-color, #fff); stroke: #8e24aa; stroke-width: 1.5; }
.node-role-badge-icon { pointer-events:none; }
.node-label { font-size: 11px; text-anchor: middle; fill: var(--primary-text-color); pointer-events:none; }
/* Floor Plan labels sit on an arbitrary uploaded image, not the card's own
   background, so trusting the theme's text color (as the Map view safely
   does) can go invisible \u2014 e.g. dark theme = light text, sitting on a white
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
/* Reporting-type bindings (see _isControlBinding) \u2014 only ever drawn when
   "Show reporting-only bindings" is on, so they need to read as secondary
   background info rather than compete with real control arrows. */
.edge-reporting { stroke-width: 1.2; stroke-dasharray: 4,3; opacity: 0.45; }
.edge-reporting:hover { stroke-width: 2; opacity: 0.8; }
/* Distinct from both control (solid) and reporting (faint dashed) \u2014 this
   binding hasn't been classified yet (device not cluster-scanned, or the
   cluster isn't declared on this endpoint at all), and stays visible by
   default same as control, just visually flagged as unresolved. */
.edge-unknown { stroke-width: 1.6; stroke-dasharray: 2,2; opacity: 0.7; }
.edge-unknown:hover { stroke-width: 2.2; opacity: 1; }
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
.dialog-panel.wide { width: min(760px, 94vw); }
.dialog-header { display:flex; align-items:center; justify-content:space-between; font-weight:600; margin-bottom:10px; }
.row { display:flex; align-items:center; gap:6px; font-size:0.92em; }
.dialog-actions { display:flex; gap:8px; margin-top:14px; }
.detail-table td { padding: 4px 8px; font-size: 0.9em; }

/* Exploded device view \u2014 per-endpoint cards inside the (widened) dialog. */
.ep-photo-toggle { font-size:0.82em; color: var(--secondary-text-color); margin-bottom:10px; }
.ep-device-header { display:flex; align-items:flex-start; gap:14px; }
.ep-device-visual { flex: 0 0 auto; width:64px; }
.ep-device-photo { width:64px; max-height:110px; object-fit:contain; border-radius:6px;
  background: var(--card-background-color); }
.ep-device-shape { width:64px; }
.ep-shape-svg { display:block; }
.ep-shape-plate { fill: var(--secondary-background-color, #eee); stroke: var(--divider-color, #ccc); }
.ep-shape-gang { fill: var(--primary-color, #039be5); opacity:0.75; }
.ep-device-header .detail-table { flex:1; }
.ep-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap:10px; margin-top:12px; }
.ep-card { border:1px solid var(--divider-color, #e0e0e0); border-radius:10px; padding:10px 12px;
  background: var(--secondary-background-color, #fafafa); }
.ep-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.ep-card-title { font-weight:600; font-size:0.95em; }
.ep-badges { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }
.ep-badge { display:inline-block; font-size:0.78em; padding:3px 8px; border-radius:10px; line-height:1.5; }
.ep-badge-clusters { display:block; font-size:0.88em; opacity:0.75; }
.ep-badge-self { background:#ede7f6; color:#4a2f8f; }
.ep-badge-out { background:#e1f5ee; color:#0a5c46; }
.ep-badge-in { background:#faece7; color:#8f3d1c; }
.ep-badge-member { background:#f3e5f5; color:#6a1b78; }
.ep-badge-unknown { background:#fff3e0; color:#8a5a00; }
.ep-badge-reporting { background: var(--divider-color, #e0e0e0); color: var(--secondary-text-color); }
.ep-badge-muted { background: var(--divider-color, #e0e0e0); color: var(--secondary-text-color); }
.ep-report { font-size:0.82em; color: var(--secondary-text-color); margin: 4px 0 8px; }
.ep-picker-label { display:block; font-size:0.8em; color: var(--secondary-text-color); margin-bottom:3px; }
.ep-cmd-section { margin:10px 0; padding:8px 0; border-top:1px solid var(--divider-color, #e0e0e0); border-bottom:1px solid var(--divider-color, #e0e0e0); }
.ep-cmd-status { margin:4px 0; }
.ep-cmd-actions { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
.ep-cmd-results { display:flex; flex-direction:column; gap:6px; margin-bottom:8px; }
.ep-cmd-cluster { border:1px solid var(--divider-color, #e0e0e0); border-radius:8px; padding:6px 8px; }
.ep-cmd-cluster-head {
  display:flex; align-items:center; gap:6px; width:100%; text-align:left;
  border:none; background:none; padding:0; margin:0; font: inherit; font-size:0.85em; font-weight:600;
  color:inherit; cursor:pointer;
}
.ep-cmd-cluster-head:hover { color: var(--primary-color); }
.ep-cmd-chevron { flex:none; opacity:0.6; font-size:0.9em; }
.ep-cmd-cluster-title { flex:1; }
.ep-cmd-summary { flex:none; font-weight:400; font-size:0.82em; opacity:0.7; white-space:nowrap; }
.ep-cmd-cluster-body { margin-top:6px; display:flex; flex-direction:column; gap:4px; }
.ep-cmd-cluster-id { font-weight:400; opacity:0.65; margin-left:4px; }
.ep-cmd-row { display:flex; align-items:center; gap:6px; padding:3px 6px; border-radius:6px; font-size:0.82em; }
.ep-cmd-row.ep-cmd-yes { }
.ep-cmd-row.ep-cmd-no { background:#faece7; }
.ep-cmd-yes .ep-cmd-icon { color:#0a5c46; }
.ep-cmd-no .ep-cmd-icon { color:#8f3d1c; }
.ep-cmd-no .ep-cmd-name, .ep-cmd-no .ep-cmd-hex { color:#8f3d1c; }
.ep-cmd-name { flex:1; }
.ep-cmd-hex { opacity:0.65; font-size:0.9em; }
.ep-cmd-share-draft { border:1px dashed var(--divider-color, #ccc); border-radius:8px; padding:8px; margin-top:4px; }
.ep-cmd-share-json {
  width:100%; box-sizing:border-box; font-family: var(--code-font-family, monospace); font-size:0.72em;
  background: var(--card-background-color); color: var(--primary-text-color);
  border:1px solid var(--divider-color, #ccc); border-radius:6px; padding:6px; resize:vertical;
}
.ep-cmd-share-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
.ep-control-select { width:100%; }

/* Capability Explorer tab */
.capexp-strip { display:flex; align-items:center; gap:8px; background: rgba(76,154,255,0.1);
  border:1px solid rgba(76,154,255,0.3); border-radius:10px; padding:8px 12px; margin-bottom:10px; font-size:0.85em; }
.capexp-mission { font-size:1em; font-weight:600; margin: 0 0 4px; }
.capexp-discoveries { background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee);
  border-radius:10px; padding:8px 12px; margin: 8px 0; }
.capexp-discoveries-label { font-size:0.78em; font-weight:600; color: var(--secondary-text-color); margin-bottom:4px; }
.capexp-discoveries-list { margin:0; padding-left:18px; display:flex; flex-direction:column; gap:3px; font-size:0.88em; }
.capexp-modes { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:2px; }
.capexp-mode-btn { display:flex; flex-direction:column; align-items:flex-start; gap:2px; text-align:left;
  border:1px solid var(--divider-color, #ccc); background: var(--card-background-color); color: var(--primary-text-color);
  border-radius:10px; padding:7px 12px; cursor:pointer; }
.capexp-mode-btn:hover { filter: brightness(0.97); }
.capexp-mode-btn.active { background: var(--primary-color); border-color: transparent; }
.capexp-mode-btn .capexp-mode-title { font-size:0.88em; font-weight:600; }
.capexp-mode-btn.active .capexp-mode-title { color: var(--text-primary-color, #fff); }
.capexp-mode-btn .capexp-mode-sub { font-size:0.76em; color: var(--secondary-text-color); }
.capexp-mode-btn.active .capexp-mode-sub { color: var(--text-primary-color, #fff); opacity:0.85; }
.capexp-status-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
.capexp-status-row .hint { margin:0; }
.capexp-error { color: var(--error-color, #db4437); }
.capexp-section-title { font-weight:600; margin: 14px 0 6px; }
.capexp-section-title:first-child { margin-top:6px; }
.capexp-device-list { display:flex; flex-direction:column; gap:8px; }
.capexp-device-card { border:1px solid var(--divider-color, #e0e0e0); border-radius:10px; padding:10px 12px;
  background: var(--secondary-background-color, #fafafa); }
.capexp-device-header { display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; flex-wrap:wrap; }
.capexp-device-name { font-weight:600; }
.capexp-chevron { margin-left:auto; opacity:0.6; }
.capexp-device-summary { font-size:0.85em; margin-top:4px; }
.capexp-cap-label { font-size:0.78em; color: var(--secondary-text-color); margin-top:8px; margin-bottom:2px; }
.capexp-cap-groups { display:flex; flex-direction:column; gap:6px; margin-top:2px; }
.capexp-cap-group-label { font-size:0.85em; font-weight:600; }
.capexp-cap-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:3px; }
.capexp-tag { display:inline-block; font-size:0.78em; padding:3px 9px; border-radius:10px;
  background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-tag-conflict { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.capexp-tag-fwdep { background: rgba(142,36,170,0.13); color: #6a1b78; }
.capexp-report-line { font-size:0.85em; margin-top:8px; }
.capexp-fwgap-alert { margin-top:8px; padding:7px 10px; border-radius:8px; font-size:0.82em;
  background: rgba(255,179,0,0.12); border:1px solid rgba(255,179,0,0.35); color: var(--primary-text-color); }
.capexp-confidence-badge { display:inline-block; font-size:0.72em; padding:3px 9px; border-radius:10px;
  white-space:nowrap; background: var(--divider-color, #e0e0e0); color: var(--secondary-text-color); }
.capexp-confidence-strong-evidence { background: rgba(76,206,172,0.18); color: #2e9e83; }
.capexp-confidence-repeated-observation { background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-confidence-single-observation { background: rgba(255,179,0,0.18); color: #b26a00; }
.capexp-confidence-conflicting-evidence { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.capexp-device-detail { margin-top:10px; padding-top:8px; border-top:1px solid var(--divider-color, #e0e0e0);
  display:flex; flex-direction:column; gap:10px; }
.capexp-entry-title { font-size:0.85em; font-weight:600; margin-bottom:4px; }
.capexp-nomatch-list { display:flex; flex-direction:column; gap:6px; }
.capexp-nomatch-row { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:6px 10px; border-radius:8px; background: var(--secondary-background-color, #fafafa);
  border:1px solid var(--divider-color, #eee); font-size:0.9em; }
.capexp-search-examples { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.capexp-search-form { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
.capexp-search-form input, .capexp-search-form select { flex: 1 1 150px; min-width:120px; padding:6px 8px; border-radius:6px;
  border:1px solid var(--divider-color, #ccc); background: var(--card-background-color); color: var(--primary-text-color); }
.capexp-compare-form { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:12px; }
.capexp-compare-form label { display:flex; flex-direction:column; gap:4px; font-size:0.85em;
  color: var(--secondary-text-color); flex: 1 1 160px; }
.capexp-compare-form select { padding:6px 8px; border-radius:6px; border:1px solid var(--divider-color, #ccc);
  background: var(--card-background-color); color: var(--primary-text-color); }
.capexp-compare-my-device { margin:10px 0; padding:10px 12px; border-radius:10px;
  background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee);
  display:flex; flex-direction:column; gap:6px; font-size:0.9em; }
.capexp-compare-my-device.muted { color: var(--secondary-text-color); }
.capexp-compare-my-device.capexp-compare-ok { border-color: var(--success-color, #2e7d32); }
.capexp-compare-fw-row { display:flex; justify-content:space-between; gap:10px; }
.capexp-compare-label { font-weight:600; font-size:0.85em; margin-top:2px; }
.capexp-compare-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.capexp-compare-list li { padding:2px 0; }
.capexp-diff-wrap { display:flex; flex-direction:column; gap:6px; }
.capexp-diff-row { padding:8px 10px; border-radius:8px; background: var(--secondary-background-color, #fafafa);
  border:1px solid var(--divider-color, #eee); font-size:0.9em; }

/* Narrow (phone) screens: stack the floor-plan sidebar above the map
   instead of beside it, and trim padding so nothing forces extra width. */
@media (max-width: 600px) {
  .card { padding: 10px 10px 12px; }
  .floorplan-layout { flex-direction: column; }
  .fp-sidebar { width:100%; flex: 0 0 auto; max-height: 160px; }
  .card.fullscreen #view-floorplan.active .fp-sidebar { max-height: 160px; }
  .dialog-panel { width: min(560px, 96vw); padding: 12px 14px; }
  .dialog-panel.wide { width: min(560px, 96vw); }
  .ep-grid { grid-template-columns: 1fr; }
  .capexp-search-form { flex-direction: column; }
  .capexp-compare-form { flex-direction: column; }
  .capexp-modes { flex-direction: column; }
  .capexp-mode-btn { width: 100%; }
}
`;

  // src/capexplorer.js
  function slugify(s) {
    return (s || "unknown").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
  }
  var INDEX_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/index.json`;
  var CACHE_KEY = "zha-capability-explorer:index-cache";
  var CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
  var _memoryCache = null;
  function loadFromLocalStorage() {
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!raw || !Array.isArray(raw.index) || typeof raw.fetchedAt !== "number") return null;
      if (Date.now() - raw.fetchedAt > CACHE_TTL_MS) return null;
      return raw.index;
    } catch (e) {
      return null;
    }
  }
  function saveToLocalStorage(index) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ index, fetchedAt: Date.now() }));
    } catch (e) {
    }
  }
  async function fetchCapabilityIndex({ force = false } = {}) {
    if (!force && _memoryCache) return _memoryCache;
    if (!force) {
      const cached = loadFromLocalStorage();
      if (cached) {
        _memoryCache = cached;
        return cached;
      }
    }
    const res = await fetch(INDEX_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch the community capability index (HTTP ${res.status})`);
    }
    const index = await res.json();
    if (!Array.isArray(index)) {
      throw new Error("The community capability index wasn't in the expected format");
    }
    _memoryCache = index;
    saveToLocalStorage(index);
    return index;
  }
  function groupByDevice(index) {
    const map = /* @__PURE__ */ new Map();
    for (const entry of index) {
      const key = `${entry.manufacturer_slug}|${entry.model_slug}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    return map;
  }
  function matchLocalDevices(localDevices, index) {
    const grouped = groupByDevice(index);
    return localDevices.map((d) => {
      const manufacturerSlug = slugify(d.manufacturer);
      const modelSlug = slugify(d.model);
      const entries = grouped.get(`${manufacturerSlug}|${modelSlug}`) || [];
      return { device: d, manufacturerSlug, modelSlug, entries };
    }).filter((m) => m.entries.length > 0);
  }
  function firmwareVersions(entries) {
    const set = new Set(entries.map((e) => e.firmware || null));
    return [...set].sort((a, b) => {
      if (a === b) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return String(a).localeCompare(String(b));
    });
  }
  function confirmedCommands(entry) {
    const out = [];
    Object.entries(entry.clusters || {}).forEach(([clusterId, cluster]) => {
      (cluster.commands_received || []).forEach((row) => {
        if (row.present === true) {
          out.push({ clusterId, clusterName: cluster.name, ...row });
        }
      });
    });
    return out;
  }
  function searchIndex(index, facets = {}) {
    const f = {
      manufacturer: (facets.manufacturer || "").trim().toLowerCase(),
      model: (facets.model || "").trim().toLowerCase(),
      firmware: (facets.firmware || "").trim().toLowerCase(),
      command: (facets.command || "").trim().toLowerCase(),
      attribute: (facets.attribute || "").trim().toLowerCase(),
      cluster: (facets.cluster || "").trim().toLowerCase()
    };
    return index.filter((entry) => {
      if (f.manufacturer && !String(entry.manufacturer || "").toLowerCase().includes(f.manufacturer)) return false;
      if (f.model && !String(entry.model || "").toLowerCase().includes(f.model)) return false;
      if (f.firmware && !String(entry.firmware || "").toLowerCase().includes(f.firmware)) return false;
      const clusters = Object.entries(entry.clusters || {});
      if (f.cluster) {
        const hit = clusters.some(
          ([id, c]) => id.toLowerCase().includes(f.cluster) || String(c.name || "").toLowerCase().includes(f.cluster)
        );
        if (!hit) return false;
      }
      if (f.command) {
        const hit = clusters.some(
          ([, c]) => (c.commands_received || []).some((row) => row.present === true && String(row.name || "").toLowerCase().includes(f.command))
        );
        if (!hit) return false;
      }
      if (f.attribute) {
        const hit = clusters.some(
          ([, c]) => (c.attributes_confirmed || []).some((a) => String(a.name || "").toLowerCase().includes(f.attribute))
        );
        if (!hit) return false;
      }
      return true;
    });
  }
  function notReportedCommands(entry) {
    const out = [];
    Object.entries(entry.clusters || {}).forEach(([clusterId, cluster]) => {
      (cluster.commands_received || []).forEach((row) => {
        if (row.present === false) {
          out.push({ clusterId, clusterName: cluster.name, ...row });
        }
      });
    });
    return out;
  }
  function reportsState(entry) {
    return Object.values(entry.clusters || {}).some(
      (cluster) => (cluster.attributes_confirmed || []).some((a) => String(a.access || "").includes("REPORT"))
    );
  }
  function confidenceLabel(entry) {
    const anyConflicting = Object.values(entry.clusters || {}).some(
      (cluster) => (cluster.commands_received || []).some((row) => row.conflicting)
    );
    if (anyConflicting) return "Conflicting evidence";
    const scans = entry.scan_count || 0;
    if (scans <= 1) return "Single observation";
    if (scans < 5) return "Repeated observation";
    return "Strong evidence";
  }
  function firmwareDependentCapabilities(entries) {
    if (entries.length < 2) return /* @__PURE__ */ new Set();
    const allNames = /* @__PURE__ */ new Set();
    entries.forEach((entry) => {
      Object.values(entry.clusters || {}).forEach((cl) => {
        (cl.commands_received || []).forEach((row) => allNames.add(row.name));
      });
    });
    const result = /* @__PURE__ */ new Set();
    allNames.forEach((name) => {
      const states = new Set(entries.map((entry) => confirmedCommands(entry).some((c) => c.name === name)));
      if (states.size > 1) result.add(name);
    });
    return result;
  }
  function groupCapabilitiesByOutcome(entries) {
    const fwDependent = firmwareDependentCapabilities(entries);
    const groups = /* @__PURE__ */ new Map();
    entries.forEach((entry) => {
      Object.entries(entry.clusters || {}).forEach(([clusterId, cluster]) => {
        if (!groups.has(clusterId)) {
          groups.set(clusterId, { clusterName: cluster.name || clusterId, items: /* @__PURE__ */ new Set() });
        }
        const g = groups.get(clusterId);
        if (cluster.name) g.clusterName = cluster.name;
        (cluster.commands_received || []).filter((r) => r.present === true).forEach((r) => g.items.add(r.name));
      });
    });
    return [...groups.entries()].map(([clusterId, g]) => {
      const items = [...g.items].sort().map((name) => ({ name, firmwareDependent: fwDependent.has(name) }));
      return {
        clusterId,
        label: capabilityOutcomePhrase(clusterId, g.clusterName),
        reportsOnly: items.length === 0,
        items
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }
  function interestingDiscoveries(index, opts = {}) {
    const {
      minScansForMostConfirmed = 5,
      minFirmwareVariety = 3,
      minScansForFwDependent = 2,
      maxResults = 4
    } = opts;
    const discoveries = [];
    const byDevice = groupByDevice(index);
    let mostConfirmed = null;
    byDevice.forEach((entries) => {
      const total = entries.reduce((sum, e) => sum + (e.scan_count || 0), 0);
      if (total >= minScansForMostConfirmed && (!mostConfirmed || total > mostConfirmed.total)) {
        mostConfirmed = { manufacturer: entries[0].manufacturer, model: entries[0].model, total };
      }
    });
    if (mostConfirmed) {
      discoveries.push({
        id: "most-confirmed",
        text: `Most-confirmed device so far: ${mostConfirmed.manufacturer} ${mostConfirmed.model}, backed by ${mostConfirmed.total} scans.`
      });
    }
    let mostFirmware = null;
    byDevice.forEach((entries) => {
      const versions = firmwareVersions(entries);
      if (versions.length >= minFirmwareVariety && (!mostFirmware || versions.length > mostFirmware.count)) {
        mostFirmware = { manufacturer: entries[0].manufacturer, model: entries[0].model, count: versions.length };
      }
    });
    if (mostFirmware) {
      discoveries.push({
        id: "most-firmware-variety",
        text: `${mostFirmware.manufacturer} ${mostFirmware.model} has the most firmware variety on file: ${mostFirmware.count} distinct versions observed.`
      });
    }
    let fwDependentExample = null;
    byDevice.forEach((entries) => {
      if (entries.some((e) => (e.scan_count || 0) < minScansForFwDependent)) return;
      const changed = firmwareDependentCapabilities(entries);
      if (changed.size && !fwDependentExample) {
        fwDependentExample = { manufacturer: entries[0].manufacturer, model: entries[0].model, names: [...changed] };
      }
    });
    if (fwDependentExample) {
      discoveries.push({
        id: "firmware-dependent-example",
        text: `${fwDependentExample.manufacturer} ${fwDependentExample.model}'s confirmed capabilities actually differ by firmware version (e.g. "${fwDependentExample.names[0]}") \u2014 worth checking Compare Firmware before assuming an update is safe.`
      });
    }
    let newest = null;
    index.forEach((entry) => {
      if (entry.last_seen && (!newest || entry.last_seen > newest.last_seen)) newest = entry;
    });
    if (newest) {
      discoveries.push({
        id: "newest-contribution",
        text: `Newest contribution: ${newest.manufacturer} ${newest.model} on firmware ${newest.firmware || "unknown"}, confirmed by the community on ${newest.last_seen.slice(0, 10)}.`
      });
    }
    return discoveries.slice(0, maxResults);
  }
  function compareFirmwareStrings(a, b) {
    if (!a || !b) return null;
    const segsA = String(a).split(/[^0-9a-zA-Z]+/).filter(Boolean);
    const segsB = String(b).split(/[^0-9a-zA-Z]+/).filter(Boolean);
    if (!segsA.length || !segsB.length) return null;
    const len = Math.max(segsA.length, segsB.length);
    for (let i = 0; i < len; i++) {
      const x = segsA[i];
      const y = segsB[i];
      if (x === void 0) return -1;
      if (y === void 0) return 1;
      const nx = /^[0-9]+$/.test(x) ? Number(x) : null;
      const ny = /^[0-9]+$/.test(y) ? Number(y) : null;
      if (nx !== null && ny !== null) {
        if (nx !== ny) return nx < ny ? -1 : 1;
      } else if (x !== y) {
        return null;
      }
    }
    return 0;
  }
  function newestFirmwareGap(localFirmware, entries) {
    if (!localFirmware) return null;
    let newest = null;
    entries.forEach((entry) => {
      if (compareFirmwareStrings(localFirmware, entry.firmware) !== -1) return;
      if (!newest || compareFirmwareStrings(entry.firmware, newest.firmware) === 1) newest = entry;
    });
    if (!newest) return null;
    const localEntry = entries.find((e) => e.firmware === localFirmware) || null;
    return {
      newestFirmware: newest.firmware,
      diff: localEntry ? diffFirmware(localEntry, newest) : null
    };
  }
  function diffFirmware(entryA, entryB) {
    const clustersA = entryA.clusters || {};
    const clustersB = entryB.clusters || {};
    const allClusterIds = /* @__PURE__ */ new Set([...Object.keys(clustersA), ...Object.keys(clustersB)]);
    const result = [];
    allClusterIds.forEach((clusterId) => {
      const a = clustersA[clusterId];
      const b = clustersB[clusterId];
      const name = (a || b || {}).name || clusterId;
      if (!a || !b) {
        result.push({ clusterId, name, onlyIn: !a ? "B" : "A", addedCommands: [], removedCommands: [], attributeChanges: [] });
        return;
      }
      const presentA = new Set((a.commands_received || []).filter((r) => r.present === true).map((r) => r.name));
      const presentB = new Set((b.commands_received || []).filter((r) => r.present === true).map((r) => r.name));
      const addedCommands = [...presentB].filter((n) => !presentA.has(n));
      const removedCommands = [...presentA].filter((n) => !presentB.has(n));
      const attrA = new Set((a.attributes_confirmed || []).map((x) => x.name));
      const attrB = new Set((b.attributes_confirmed || []).map((x) => x.name));
      const attributeChanges = [
        ...[...attrB].filter((n) => !attrA.has(n)).map((n) => ({ name: n, change: "added" })),
        ...[...attrA].filter((n) => !attrB.has(n)).map((n) => ({ name: n, change: "removed" }))
      ];
      if (addedCommands.length || removedCommands.length || attributeChanges.length) {
        result.push({ clusterId, name, onlyIn: null, addedCommands, removedCommands, attributeChanges });
      }
    });
    return result;
  }

  // src/card.js
  var ZhaBindingMapCard = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._api = null;
      this._config = {};
      this._devices = [];
      this._groups = [];
      this._clusterCache = /* @__PURE__ */ new Map();
      this._bindings = /* @__PURE__ */ new Map();
      this._positions = {};
      this._epAnnotations = {};
      this._filters = {
        coordinator: true,
        routers: true,
        endDevices: true,
        unbound: true,
        groups: true,
        hideCoordinatorBindings: true,
        // most devices auto-bind reporting clusters to the coordinator; that's rarely what you're trying to audit
        showReportingBindings: false,
        // real bindings a device uses to report its own state (e.g. to a group it belongs to) rather than to control anything — see _isControlBinding()
        search: "",
        types: /* @__PURE__ */ new Set(),
        // entity-domain filter, e.g. "light", "switch" — empty = show all
        manufacturers: /* @__PURE__ */ new Set(),
        // empty = show all
        areas: /* @__PURE__ */ new Set()
        // area_id ("__none__" for "no area") — empty = show all
      };
      this._view = "graph";
      this._capExpMode = "explore";
      this._capExpIndex = null;
      this._capExpLoading = false;
      this._capExpError = null;
      this._explodedDeviceIeee = null;
      this._capExpSearch = { manufacturer: "", model: "", cluster: "", command: "", attribute: "", firmware: "" };
      this._capExpCompare = { manufacturer: "", model: "", firmwareA: "", firmwareB: "" };
      this._capExpExpanded = /* @__PURE__ */ new Set();
      this._status = null;
      this._scanState = { running: false, done: 0, total: 0 };
      this._selectedEdgeId = null;
      this._loaded = false;
      this._dragCtx = null;
      this._fullscreen = false;
      this._lastScanAt = null;
      this._tableSourceFilter = null;
      this._tableSort = { key: null, dir: 1 };
      this._devicesSort = { key: null, dir: 1 };
      this._scanFailures = /* @__PURE__ */ new Set();
      this._scanPartial = /* @__PURE__ */ new Map();
      this._responseHistory = /* @__PURE__ */ new Map();
      this._retryCount = DEFAULT_RETRY_COUNT;
      this._scanBatchSize = DEFAULT_SCAN_BATCH_SIZE;
      this._fpMarkerScale = DEFAULT_FP_MARKER_SCALE;
      this._tableHealthFilter = "all";
      this._healthReqId = 0;
      this._commandScans = /* @__PURE__ */ new Map();
      this._expandedCmdClusters = /* @__PURE__ */ new Set();
      this._shareDraft = null;
      this._fpImageUrl = "";
      this._fpImageSize = null;
      this._fpPositions = {};
      this._fpViewbox = null;
      this._fpDragCtx = null;
      this._fpPanCtx = null;
      this._fpListDrag = null;
      this._fpNodeEls = /* @__PURE__ */ new Map();
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
        ["coordinator", "routers", "endDevices", "unbound", "groups", "hideCoordinatorBindings", "showReportingBindings"].forEach((k) => {
          if (typeof raw[k] === "boolean") this._filters[k] = raw[k];
        });
        if (Array.isArray(raw.types)) this._filters.types = new Set(raw.types);
        if (Array.isArray(raw.manufacturers)) this._filters.manufacturers = new Set(raw.manufacturers);
        if (Array.isArray(raw.areas)) this._filters.areas = new Set(raw.areas);
      } catch (e) {
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
            showReportingBindings: f.showReportingBindings,
            types: [...f.types],
            manufacturers: [...f.manufacturers],
            areas: [...f.areas]
          })
        );
      } catch (e) {
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
        min_rows: 4
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
      }
    }
    // Per-endpoint "what does this control" annotations, shown in the exploded
    // device view. Pure user-supplied knowledge (what a relay is physically
    // wired to) — no Zigbee data can ever supply this, so it's persisted
    // locally the same way floor-plan positions are, not derived from a scan.
    _epAnnotationsStorageKey() {
      return `zha-binding-map-card:${this._config.id || "default"}:endpoint-annotations`;
    }
    _loadEndpointAnnotations() {
      try {
        this._epAnnotations = JSON.parse(localStorage.getItem(this._epAnnotationsStorageKey()) || "{}");
      } catch (e) {
        this._epAnnotations = {};
      }
    }
    _saveEndpointAnnotations() {
      try {
        localStorage.setItem(this._epAnnotationsStorageKey(), JSON.stringify(this._epAnnotations));
      } catch (e) {
      }
    }
    _endpointControlType(ieee, ep) {
      return (this._epAnnotations[ieee] || {})[ep] || "Not set";
    }
    _setEndpointControlType(ieee, ep, value) {
      if (!this._epAnnotations[ieee]) this._epAnnotations[ieee] = {};
      if (value === "Not set") delete this._epAnnotations[ieee][ep];
      else this._epAnnotations[ieee][ep] = value;
      this._saveEndpointAnnotations();
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
      }
    }
    _saveCachedBindings() {
      try {
        const obj = Object.fromEntries(this._bindings);
        this._lastScanAt = (/* @__PURE__ */ new Date()).toISOString();
        localStorage.setItem(this._bindingsStorageKey(), JSON.stringify({ savedAt: this._lastScanAt, bindings: obj }));
      } catch (e) {
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
        this._responseHistory = raw && typeof raw === "object" ? new Map(Object.entries(raw)) : /* @__PURE__ */ new Map();
      } catch (e) {
        this._responseHistory = /* @__PURE__ */ new Map();
      }
    }
    _saveHistory() {
      try {
        localStorage.setItem(this._historyStorageKey(), JSON.stringify(Object.fromEntries(this._responseHistory)));
      } catch (e) {
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
        lastSuccessAt: null
      };
      if (success && durationMs != null) {
        entry.successMs.push(durationMs);
        if (entry.successMs.length > HISTORY_LIMIT) entry.successMs.shift();
        entry.lastSuccessAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      entry.outcomes.push(success);
      if (entry.outcomes.length > HISTORY_LIMIT) entry.outcomes.shift();
      entry.lastAttemptAt = (/* @__PURE__ */ new Date()).toISOString();
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
        lastSuccessAt: entry.lastSuccessAt
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
      const el = this._q("#rescan-retry-count");
      if (el) el.value = this._retryCount;
    }
    _saveRetryCount(value) {
      this._retryCount = clamp(Number(value) || DEFAULT_RETRY_COUNT, 1, 10);
      try {
        localStorage.setItem(this._retryCountStorageKey(), String(this._retryCount));
      } catch (e) {
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
      const el = this._q("#scan-batch-size");
      if (el) el.value = this._scanBatchSize;
    }
    _saveScanBatchSize(value) {
      this._scanBatchSize = clamp(Number(value) || DEFAULT_SCAN_BATCH_SIZE, 1, 30);
      try {
        localStorage.setItem(this._scanBatchSizeStorageKey(), String(this._scanBatchSize));
      } catch (e) {
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
      const el = this._q("#fp-marker-scale");
      if (el) el.value = this._fpMarkerScale;
    }
    _saveFpMarkerScale(value) {
      this._fpMarkerScale = clamp(Number(value) || DEFAULT_FP_MARKER_SCALE, 40, 200);
      try {
        localStorage.setItem(this._fpMarkerScaleStorageKey(), String(this._fpMarkerScale));
      } catch (e) {
      }
    }
    // Whether the exploded device view fetches a real product photo from
    // zigbee2mqtt.io (see _deviceImageUrl). Defaults on, but this is the one
    // thing in the whole card that calls out to the internet rather than your
    // own HA instance, so it's a plain, easy-to-find toggle right on the
    // dialog itself, not buried in a settings tab.
    _showDevicePhotosStorageKey() {
      return `zha-binding-map-card:${this._config.id || "default"}:show-device-photos`;
    }
    _loadShowDevicePhotos() {
      try {
        const raw = localStorage.getItem(this._showDevicePhotosStorageKey());
        this._showDevicePhotos = raw === null ? true : raw === "1";
      } catch (e) {
        this._showDevicePhotos = true;
      }
    }
    _saveShowDevicePhotos(value) {
      this._showDevicePhotos = !!value;
      try {
        localStorage.setItem(this._showDevicePhotosStorageKey(), this._showDevicePhotos ? "1" : "0");
      } catch (e) {
      }
    }
    _setStatus(level, text, timeout = 6e3) {
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
      this._loadEndpointAnnotations();
      this._loadShowDevicePhotos();
      if (this._fpImageUrl) this._loadFpImage(this._fpImageUrl);
      this._setStatus("info", "Loading ZHA devices\u2026", 0);
      try {
        const [devices, groups] = await Promise.all([this._api.fetchDevices(), this._api.fetchGroups()]);
        this._devices = devices.filter((d) => !!d.ieee).map((d) => ({ ...d, ieee: normIeee(d.ieee) }));
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
      return after ? { ok: true, message: "Binding confirmed on the device." } : { ok: false, message: "Bind failed \u2014 this binding is not on the device after rescanning." };
    }
    /** Call after the post-action rescan completes; `before` must have been
     *  captured (via _bindingPresent) prior to the unbind API call. */
    _verifyUnbindOutcome(before, sourceIeee, sourceEp, clusterId, target) {
      const after = this._bindingPresent(sourceIeee, sourceEp, clusterId, target);
      if (!after) {
        return before ? { ok: true, message: "Binding confirmed removed." } : { ok: true, message: "This binding didn't actually exist on the device \u2014 table refreshed." };
      }
      return { ok: false, message: "Unbind failed \u2014 this binding is still on the device after rescanning." };
    }
    /** Coordinator unbind can target one explicit cluster or (if none is
     *  selected) every coordinator binding currently cached for this source
     *  endpoint — so instead of one true/false outcome, report how many of
     *  the targeted bindings are actually gone after rescanning.
     *  `beforeList` is an array of {clusterId, target} captured before the
     *  API call, for whichever bindings were in scope. */
    _verifyCoordinatorUnbindOutcome(beforeList, sourceIeee, sourceEp) {
      if (!beforeList.length) {
        return { ok: true, message: "No matching coordinator bindings were cached for this endpoint \u2014 table refreshed." };
      }
      const stillPresent = beforeList.filter(
        (item) => this._bindingPresent(sourceIeee, sourceEp, item.clusterId, item.target)
      );
      const removedCount = beforeList.length - stillPresent.length;
      if (stillPresent.length === 0) {
        return { ok: true, message: `Confirmed removed: ${removedCount} of ${beforeList.length} coordinator binding(s).` };
      }
      return {
        ok: false,
        message: `Only ${removedCount} of ${beforeList.length} coordinator binding(s) were removed \u2014 ${stillPresent.length} still present after rescanning.`
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
          this._scanFailures.add(normIeee(ieee));
          this._scanPartial.delete(normIeee(ieee));
          console.warn(`ZHA Binding Map: could not read bindings for ${ieee}:`, err.message || err);
        }
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
      if (partialCount) summary.push(`${partialCount} partial (a later page timed out \u2014 rescan for the rest)`);
      if (failCount) summary.push(`${failCount} did not respond (sleepy/offline devices are normal)`);
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
    /** Classifies binding `b` as one of three real, distinct states, rather
     *  than the old two (see v0.17.0 changelog for why this is a behavior
     *  change, not just a rename):
     *  - "control" — `b.clusterId` is registered as an "out" (client) cluster
     *    on the source device's source endpoint, meaning the source can
     *    genuinely use it to command the target.
     *  - "reporting" — the cluster is registered as "in" (server) but not
     *    "out" on that endpoint — a device can hold a perfectly real
     *    binding-table entry on a cluster it only exposes as "in" (e.g. a
     *    light bound to a group it belongs to on its own OnOff cluster), and
     *    that's the device reporting its own state outward, not controlling
     *    anything, since "in" is what *receives* commands. Confirmed via a
     *    real device's binds_get output (light bound to two groups on
     *    cluster 6, which it only serves).
     *  - "unknown" — the source device's cluster list isn't cached yet (see
     *    _ensureHealthData()), or the cluster isn't declared as "in" or "out"
     *    on that endpoint at all. Previously this whole case was silently
     *    folded into "control" (before a scan) or effectively "reporting"
     *    (after one, since "not out" was treated as "not control" with no
     *    third option) — meaning a binding we genuinely don't have enough
     *    information about could end up hidden from the graph by default, or
     *    mislabeled as a confirmed reporting relationship it was never
     *    actually shown to be. "unknown" is never hidden by _graphBindings()
     *    either, same as "control" — the fix is honesty about what we know,
     *    not a new way to hide things. */
    _classifyBinding(b) {
      const clusters = this._clusterCache.get(b.sourceIeee);
      if (!clusters) return "unknown";
      const matches = (type) => clusters.some((c) => c.type === type && c.endpoint_id === b.sourceEndpoint && c.id === b.clusterId);
      if (matches("out")) return "control";
      if (matches("in")) return "reporting";
      return "unknown";
    }
    /** Kept as a thin wrapper over _classifyBinding() for any caller that
     *  only needs the yes/no answer. */
    _isControlBinding(b) {
      return this._classifyBinding(b) === "control";
    }
    /** Maps a binding's classification to the CSS class its graph edge (Map
     *  or Floor Plan) should get, shared by both renderers so the two views
     *  can never silently drift apart on what "unknown" looks like. */
    _edgeClassFor(b) {
      const cls = this._classifyBinding(b);
      if (cls === "reporting") return "edge edge-reporting";
      if (cls === "unknown") return "edge edge-unknown";
      return "edge";
    }
    /** Bindings drawn on the Map/Floor Plan graphs specifically. Starts from
     *  _allBindings() (still respects the coordinator-hide toggle) and, unless
     *  "Show reporting-only bindings" is on, additionally drops confirmed
     *  reporting-type bindings (see _classifyBinding) so the graph reads as a
     *  control map — "who's controlled by what" — rather than mixing in
     *  real-but-unrelated state-reporting traffic. "unknown" bindings stay
     *  visible either way — we don't hide something just because we haven't
     *  confirmed what it is yet. The Bindings tab and exports intentionally
     *  stay on _allBindings()/_rawBindings() so the full scanned data is
     *  always auditable there regardless of this toggle. */
    _graphBindings() {
      const all = this._allBindings();
      if (this._filters.showReportingBindings) return all;
      return all.filter((b) => this._classifyBinding(b) !== "reporting");
    }
    /** Synthetic group -> member edges, sourced entirely from real ZCL group
     *  membership data (zha/groups' own `members` list — already fetched by
     *  fetchGroups() and cached in this._groups, no extra API call needed).
     *  This is a genuinely separate real fact from a binding-table entry: a
     *  device that's a group member receives that group's commands without
     *  needing any binding at all, which is exactly the "who's controlled"
     *  relationship a switch -> group binding alone doesn't show. Drawn with
     *  the same visual weight as a real control binding (see _renderGraphEdges)
     *  so switch -> group -> member reads as one continuous path, even though
     *  the two halves come from different real mechanisms. Not a binding, so
     *  never affected by the control/reporting split above and never shown in
     *  the Bindings tab (which is real binding-table data only). */
    _membershipEdges() {
      const out = [];
      (this._groups || []).forEach((g) => {
        (g.members || []).forEach((m) => {
          const ieee = normIeee(m.device && m.device.ieee);
          if (!ieee) return;
          out.push({
            id: `member:${g.group_id}:${ieee}:${m.endpoint_id}`,
            isMembership: true,
            groupId: g.group_id,
            memberIeee: ieee,
            memberEndpoint: m.endpoint_id
          });
        });
      });
      return out;
    }
    // -------------------------------------------------------------------
    // Exploded device view — per-endpoint breakdown for one device, built
    // entirely from real, already-verified data sources (raw bindings, cluster
    // scan, group membership) plus the user-supplied "what does this control"
    // annotation. See _openDeviceExplodedView() for the entry point.
    // -------------------------------------------------------------------
    /** Cross-references Home Assistant's device registry (`hass.devices`,
     *  confirmed real and populated on the frontend this session) by IEEE via
     *  its "zha" identifiers entry — the reliable link, not name matching
     *  (confirmed to fail: the registry's own `name` is the manufacturer/model
     *  string, `name_by_user` is a third, separate field again). Returns null
     *  if hass.devices isn't populated on a given HA frontend, rather than
     *  guessing — this is a different data source from zha/devices, and not
     *  guaranteed present on every HA version/setup. */
    _haDeviceRegistryEntry(ieee) {
      if (!this._hass || !this._hass.devices) return null;
      const target = normIeee(ieee);
      return Object.values(this._hass.devices).find(
        (dev) => (dev.identifiers || []).some(([domain, id]) => domain === "zha" && normIeee(id) === target)
      ) || null;
    }
    /** Device header info for the exploded view. Manufacturer, model,
     *  quirk_applied/quirk_class, power_source, area, availability come from
     *  zha/devices (confirmed via real pulls this session). Firmware/hardware
     *  version come from the device registry instead (_haDeviceRegistryEntry)
     *  — confirmed via a real console check this session (sw_version:
     *  "0x00001004" on a real device) — and are simply omitted if that
     *  registry isn't populated on this HA frontend, rather than guessing. */
    _deviceSummaryLines(d) {
      const lines = [];
      lines.push(["IEEE", d.ieee]);
      if (d.nwk != null) lines.push(["Network address", typeof d.nwk === "number" ? hex4(d.nwk) : d.nwk]);
      lines.push(["Manufacturer", d.manufacturer || "Unknown"]);
      lines.push(["Model", d.model || "Unknown"]);
      if (d.quirk_applied != null) {
        lines.push(["Quirk", d.quirk_applied ? d.quirk_class || "Applied" : "None"]);
      }
      const reg = this._haDeviceRegistryEntry(d.ieee);
      if (reg && reg.sw_version) lines.push(["Firmware", reg.sw_version]);
      if (reg && reg.hw_version) lines.push(["Hardware", reg.hw_version]);
      lines.push(["Power source", d.power_source || "Unknown"]);
      lines.push(["Area", this._areaName(d.area_id)]);
      if (d.available != null) lines.push(["Available", d.available ? "Yes" : "No"]);
      return lines;
    }
    /** Real zigbee2mqtt.io product photo URL for a device's model, verified
     *  against that site's actual device pages this session (SONOFF
     *  ZBM5-3C-80/86 -> .../images/devices/ZBM5-3C-80-86.png, SONOFF
     *  MINI-ZB2GS-L -> .../images/devices/MINI-ZB2GS-L.png): the model string
     *  with any "/" replaced by "-". zigbee2mqtt's database doesn't cover
     *  every manufacturer/model though, so this is a best-effort guess for
     *  anything not confirmed — the exploded view always falls back to a
     *  generic gang-count shape if the image 404s, and this entire lookup is
     *  skippable via the "Show device photos" toggle for anyone who'd rather
     *  this card never talk to the internet. */
    _deviceImageUrl(d) {
      if (!d.model) return null;
      return `https://www.zigbee2mqtt.io/images/devices/${encodeURIComponent(d.model.replace(/\//g, "-"))}.png`;
    }
    /** Offline, always-available fallback: a simple wall-plate shape with one
     *  rectangle per real endpoint, so a 3-gang switch reads as a 3-gang
     *  switch at a glance even with no internet access or no photo match. */
    _deviceShapeSvg(gangCount) {
      const n = Math.max(1, gangCount);
      const width = 64, height = 92, pad = 6;
      const gangW = (width - pad * (n + 1)) / n;
      let rects = "";
      for (let i = 0; i < n; i++) {
        const x = pad + i * (gangW + pad);
        rects += `<rect x="${x.toFixed(1)}" y="${pad}" width="${gangW.toFixed(1)}" height="${height - pad * 2}" rx="3" class="ep-shape-gang"/>`;
      }
      return `<svg viewBox="0 0 ${width} ${height}" width="64" height="92" class="ep-shape-svg" aria-hidden="true">
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" class="ep-shape-plate"/>
      ${rects}
    </svg>`;
    }
    /** Real endpoint IDs for a device, Green Power stub excluded. Pulled from
     *  the cluster cache (needs _ensureClusters() to have run) and topped up
     *  from any already-scanned bindings, so an endpoint a bind references
     *  never silently disappears just because the cluster scan hasn't reached
     *  it yet. */
    _deviceEndpoints(d) {
      const clusters = this._clusterCache.get(d.ieee) || [];
      const ids = new Set(clusters.map((c) => c.endpoint_id).filter((id) => id !== GREEN_POWER_ENDPOINT));
      this._rawBindings().forEach((b) => {
        if (b.sourceIeee === d.ieee && b.sourceEndpoint !== GREEN_POWER_ENDPOINT) ids.add(b.sourceEndpoint);
      });
      return [...ids].sort((a, b) => a - b);
    }
    /** Whether an endpoint is in "detach relay mode" — read live from the
     *  matching switch.*_detach_relay_N-style entity's actual state, never
     *  inferred from binding shape (a manual self-bind and an automatic one
     *  are structurally identical, confirmed against real devices this
     *  session). This is a heuristic match on the "_N" numeric entity_id
     *  suffix, the only signal available since zha/devices has no field
     *  tying an entity to a specific endpoint. Confirmed correct for the
     *  Sonoff ZBM devices tested; not guaranteed for other manufacturers, so
     *  no match returns null ("mode unknown") rather than a guess. */
    _detachStateFor(d, ep) {
      const entities = d.entities || [];
      const match = entities.find((e) => {
        if (!e || !e.entity_id || !e.entity_id.startsWith("switch.")) return false;
        if (!/detach/i.test(e.entity_id) && !/detach/i.test(e.name || "")) return false;
        const suffix = e.entity_id.match(/_(\d+)$/);
        return !!suffix && Number(suffix[1]) === ep;
      });
      if (!match || !this._hass || !this._hass.states) return { state: null, entityId: null };
      const st = this._hass.states[match.entity_id];
      return { state: st ? st.state === "on" : null, entityId: match.entity_id };
    }
    /** Everything real (not user-supplied) known about one endpoint: bindings
     *  it's the source of, split into self/external-device/group/reporting,
     *  plus anything bound *to* it from elsewhere and any group memberships.
     *  Built on _rawBindings(), not _allBindings()/_graphBindings(), so
     *  nothing is hidden here regardless of the graph's own toggles — the
     *  exploded view is meant to show the full picture for one device. */
    _endpointRelationships(d, ep) {
      const raw = this._rawBindings();
      const coord = this._coordinatorIeee();
      const out = {
        self: [],
        controlsDevice: [],
        controlsGroup: [],
        reportsTo: [],
        incoming: [],
        memberOf: [],
        unknown: []
      };
      raw.forEach((b) => {
        if (b.sourceIeee === d.ieee && b.sourceEndpoint === ep) {
          if (!b.isGroup && b.targetIeee === d.ieee) {
            out.self.push(b);
          } else if (!b.isGroup && b.targetIeee === coord) {
            out.reportsTo.push(b);
          } else {
            const cls = this._classifyBinding(b);
            if (cls === "control") {
              (b.isGroup ? out.controlsGroup : out.controlsDevice).push(b);
            } else if (cls === "unknown") {
              out.unknown.push(b);
            } else {
              out.reportsTo.push(b);
            }
          }
        }
        if (!b.isGroup && b.targetIeee === d.ieee && b.targetEndpoint === ep && b.sourceIeee !== d.ieee) {
          out.incoming.push(b);
        }
      });
      (this._membershipEdges() || []).forEach((m) => {
        if (m.memberIeee === d.ieee && m.memberEndpoint === ep) out.memberOf.push(m);
      });
      return out;
    }
    /** Groups bindings that share the same real-world relationship (same
     *  source/target device+endpoint pair) so a device that sends more than
     *  one cluster to the same place — e.g. a rocker sending both OnOff
     *  (short press) and Level Control (long press/dim) to the same light
     *  from the same button, confirmed as a real case this session — reads
     *  as one relationship with two clusters listed, not two near-identical
     *  badges that look like a duplicate. */
    _groupBindingsByKey(bindings, keyFn) {
      const map = /* @__PURE__ */ new Map();
      bindings.forEach((b) => {
        const key = keyFn(b);
        if (!map.has(key)) map.set(key, { binding: b, clusters: [] });
        map.get(key).clusters.push(clusterName(b.clusterId));
      });
      return [...map.values()].map((v) => ({ binding: v.binding, clusters: [...new Set(v.clusters)] }));
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
     *  (missing endpoint / missing cluster) can be evaluated, and so
     *  _isControlBinding() can tell control bindings from reporting ones on
     *  the Map/Floor Plan graphs. Safe to call often — _ensureClusters() is a
     *  no-op for anything already cached. */
    async _ensureHealthData() {
      const reqId = this._healthReqId = this._healthReqId + 1;
      const ieees = /* @__PURE__ */ new Set();
      this._rawBindings().forEach((b) => {
        if (this._devices.some((d) => d.ieee === b.sourceIeee)) ieees.add(b.sourceIeee);
        if (!b.isGroup && b.targetIeee && this._devices.some((d) => d.ieee === b.targetIeee)) {
          ieees.add(b.targetIeee);
        }
      });
      const toFetch = [...ieees].filter((ieee) => !this._clusterCache.has(ieee));
      if (!toFetch.length) return;
      await Promise.all(toFetch.map((ieee) => this._ensureClusters(ieee).catch(() => {
      })));
      if (reqId !== this._healthReqId) return;
      if (this._view === "table") this._renderTable();
      if (this._view === "graph") this._renderGraph();
      if (this._view === "floorplan") this._renderFloorplan();
    }
    /** Health for every currently-scanned binding, keyed by binding id. Computed
     *  fresh each call (cheap — O(n) over already-loaded data) rather than
     *  cached, per the "no historical data" design principle. */
    _computeHealthMap() {
      const bindings = this._rawBindings();
      const dupCounts = /* @__PURE__ */ new Map();
      bindings.forEach((b) => {
        const key = this._healthDupKey(b);
        dupCounts.set(key, (dupCounts.get(key) || 0) + 1);
      });
      const coord = this._coordinatorIeee();
      const map = /* @__PURE__ */ new Map();
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
      if (this._scanFailures.has(sourceIeeeN)) {
        return {
          level: "info",
          code: "unable_to_verify",
          message: "This device did not respond during the scan.",
          why: "Without a fresh response from this device, we can't confirm this binding is still valid \u2014 but it may well be fine.",
          recommendation: "Wake the device and rescan."
        };
      }
      if (this._scanPartial.has(sourceIeeeN)) {
        const counts = this._scanPartial.get(sourceIeeeN);
        const countText = counts && counts.total != null && counts.retrieved != null ? ` (${counts.retrieved} of ${counts.total} binding table entries retrieved)` : "";
        return {
          level: "info",
          code: "partial_scan",
          message: `Only part of this device's binding table could be read.${countText}`,
          why: "A later page of this device's binding table timed out during the scan, so there may be additional bindings on it that aren't shown yet \u2014 the bindings that were read are still valid.",
          recommendation: "Rescan this device to try retrieving the rest of its binding table."
        };
      }
      if (!this._devices.some((d) => normIeee(d.ieee) === sourceIeeeN)) {
        return {
          level: "error",
          code: "source_missing",
          message: "The source device no longer exists.",
          why: "This binding was read from a device that's since been removed or re-paired, so it's leftover data rather than something currently controllable.",
          recommendation: "Remove the binding or recreate it."
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
            recommendation: "Recreate the group or remove the binding."
          };
        }
      } else {
        const targetIeeeN = normIeee(b.targetIeee);
        if (coord && targetIeeeN === normIeee(coord)) {
          return {
            level: "info",
            code: "coordinator_binding",
            message: "Standard coordinator reporting binding.",
            why: "Most Zigbee devices automatically bind a reporting cluster to the coordinator so Home Assistant gets status updates \u2014 this is normal and not something you created.",
            recommendation: null
          };
        }
        const targetDevice = this._devices.find((d) => normIeee(d.ieee) === targetIeeeN);
        if (!targetDevice) {
          return {
            level: "error",
            code: "target_missing",
            message: "Target device no longer exists.",
            why: "A binding sends commands from the source straight to this target over Zigbee. Since the target no longer exists, those commands go nowhere.",
            recommendation: "Remove the binding or recreate it."
          };
        }
        const targetClusters = this._clusterCache.get(targetDevice.ieee);
        if (!targetClusters) {
          return {
            level: "info",
            code: "checking",
            message: "Checking this binding's target\u2026",
            why: "Still confirming the target device's current capabilities.",
            recommendation: null
          };
        }
        const targetEndpoints = new Set(targetClusters.map((c) => c.endpoint_id));
        if (!targetEndpoints.has(Number(b.targetEndpoint))) {
          return {
            level: "warning",
            code: "missing_endpoint",
            message: "The target endpoint no longer exists.",
            why: "This binding refers to a part of the target device that no longer exists \u2014 likely because the device was re-paired or reconfigured.",
            recommendation: "Recreate the binding using a valid endpoint."
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
            recommendation: "Verify the device capabilities or recreate the binding."
          };
        }
      }
      if ((dupCounts.get(this._healthDupKey(b)) || 0) > 1) {
        return {
          level: "warning",
          code: "duplicate",
          message: "Duplicate binding detected.",
          why: "Having the same binding twice doesn't break anything, but it's redundant and can make the bindings list harder to read.",
          recommendation: "Consider removing duplicate entries."
        };
      }
      return {
        level: "ok",
        code: "ok",
        message: "This binding looks structurally valid.",
        why: "The source and target devices, the endpoint, and the required capability all check out.",
        recommendation: null
      };
    }
    _deviceBindingCount(ieee) {
      return this._rawBindings().filter((b) => b.sourceIeee === ieee || !b.isGroup && b.targetIeee === ieee).length;
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
      if (this._view === "capexplorer") this._renderCapabilityExplorer();
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
          retryInput.value = this._retryCount;
        });
      }
      const batchSizeInput = this._q("#scan-batch-size");
      if (batchSizeInput) {
        batchSizeInput.value = this._scanBatchSize;
        batchSizeInput.addEventListener("change", () => {
          this._saveScanBatchSize(batchSizeInput.value);
          batchSizeInput.value = this._scanBatchSize;
        });
      }
      this._q("#btn-zoom-fit").addEventListener("click", () => this._zoomFit());
      this._q("#btn-zoom-in").addEventListener("click", () => this._zoomBy(1.2));
      this._q("#btn-zoom-out").addEventListener("click", () => this._zoomBy(1 / 1.2));
      this._q("#btn-fullscreen").addEventListener("click", () => this._toggleFullscreen());
      this._q("#btn-filters").addEventListener("click", () => {
        const panel = this._q("#filter-panel");
        const open = panel.classList.toggle("open");
        this._q("#btn-filters").textContent = open ? "Filters \u25B4" : "Filters \u25BE";
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
      ["coordinator", "routers", "endDevices", "unbound", "groups", "hideCoordinatorBindings", "showReportingBindings"].forEach((key) => {
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
          fpMarkerInput.value = this._fpMarkerScale;
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
        btn.textContent = `Scanning ${this._scanState.done}/${this._scanState.total}\u2026`;
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
      el.textContent = this._lastScanAt ? `Bindings as of ${relTime(this._lastScanAt)} \u2014 click "Scan bindings" to refresh` : "Bindings never scanned yet";
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
      el.innerHTML = `<span class="status-text">${escapeHtml(this._status.text)}</span><button type="button" class="status-close" aria-label="Dismiss">\xD7</button>`;
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
          const hasBindings = (this._bindings.get(d.ieee) || []).length > 0 || this._allBindings().some((b) => b.targetIeee === d.ieee) || this._membershipEdges().some((m) => m.memberIeee === d.ieee);
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
      const set = /* @__PURE__ */ new Set();
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
        const category = reg ? reg.entity_category : void 0;
        return category !== "diagnostic" && category !== "config";
      });
      return functional.length ? functional : entities;
    }
    _entityDeviceClass(entityId) {
      const state = this._hass && this._hass.states ? this._hass.states[entityId] : null;
      return state && state.attributes ? state.attributes.device_class : void 0;
    }
    /** Refined, human-friendly type tags for a device (e.g. "Garage Door", "Motion Sensor"),
     *  with diagnostic/config entities excluded. Used for hover detail and exports. */
    _deviceTypeTags(d) {
      const tags = /* @__PURE__ */ new Set();
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
      if (!entities.length) return "\u2014";
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
      return best || "\u2014";
    }
    /** Whether a device's endpoints look like two different roles on one
     *  physical unit — most commonly a detachable/combo switch where one
     *  endpoint drives its own relay (shows up as a light/switch entity)
     *  while another endpoint has been detached and rebound to control
     *  something else entirely (see GitHub issue #1). True when the device
     *  (a) has a functional HA entity in a domain that reads as something
     *  being controlled — light/switch/cover/fan, same set _devicePrimaryType()
     *  draws from — and (b) has at least one real, confirmed control binding
     *  (not reporting, not unknown) on any endpoint targeting something other
     *  than itself.
     *  Endpoint-level precision isn't possible here — zha/devices has no field
     *  tying an HA entity to a specific endpoint, the same limitation noted on
     *  _detachStateFor() — so this only checks "does this device have both
     *  traits at once", not "on different endpoints specifically". Restricted
     *  to confirmed control bindings (never reporting/unknown ones) to keep
     *  false positives rare; a device this flags is worth a look via Explode,
     *  not a guaranteed detach-mode device. */
    _isMultiRoleDevice(d) {
      const controlledDomains = /* @__PURE__ */ new Set(["light", "switch", "cover", "fan"]);
      const looksControlled = this._deviceFunctionalEntities(d).some(
        (e) => controlledDomains.has(e.entity_id.split(".")[0])
      );
      if (!looksControlled) return false;
      return this._deviceEndpoints(d).some((ep) => {
        const rel = this._endpointRelationships(d, ep);
        return rel.controlsDevice.length > 0 || rel.controlsGroup.length > 0;
      });
    }
    _areaName(areaId) {
      if (!areaId) return "No area";
      const areas = this._hass && this._hass.areas;
      if (areas && areas[areaId] && areas[areaId].name) return areas[areaId].name;
      return areaId;
    }
    /** Builds the (type, manufacturer, area) option lists shown as filter chips, from the currently loaded devices. */
    _computeFilterOptions() {
      const types = /* @__PURE__ */ new Map();
      const manufacturers = /* @__PURE__ */ new Map();
      const areas = /* @__PURE__ */ new Map();
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
        areas: [...areas.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
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
      el.innerHTML = items.map(
        ({ id, label }) => `<button type="button" class="chip ${activeSet.has(id) ? "active" : ""}" data-chip="${escapeHtml(
          id
        )}">${escapeHtml(label)}</button>`
      ).join("");
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
      const cx = 600, cy = 420;
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
        const angle = 2 * Math.PI * idxInRing / Math.max(count, 1);
        const radius = 150 * ring;
        this._positions[n.key] = {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle)
        };
      });
    }
    _deviceIcon(d) {
      if (d.device_type === "Coordinator" || d.active_coordinator) return "\u2302";
      const battery = d.power_source && /battery/i.test(d.power_source);
      if (battery) return "\u{1F518}";
      return "\u{1F4A1}";
    }
    _deviceLabel(d) {
      return d.user_given_name || d.name || d.model || d.ieee;
    }
    /** Display label for a device referenced only by IEEE (a binding's
     *  source/target), falling back to the raw IEEE if it's since left the
     *  network — shared by the exploded view's badge renderers so they don't
     *  each repeat the same find-or-fallback lookup. */
    _targetDeviceLabel(ieee) {
      const d = this._devices.find((x) => x.ieee === ieee);
      return d ? this._deviceLabel(d) : ieee;
    }
    /** Same idea as _targetDeviceLabel() but for a Zigbee group referenced by
     *  id (a binding's or membership's group target). */
    _groupLabel(groupId) {
      const g = this._groups.find((x) => x.group_id === groupId);
      return g ? g.name || `Group ${groupId}` : `Group ${groupId}`;
    }
    _renderGraph() {
      const svg = this._q("#graph-svg");
      const empty = this._q("#graph-empty");
      if (!svg) return;
      this._ensureHealthData();
      if (!this._loaded) {
        empty.style.display = "flex";
        empty.textContent = "Loading devices\u2026";
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
        isCoordinator: d.ieee === this._coordinatorIeee()
      }));
      groupNodes.forEach(
        (g) => nodes.push({ key: this._groupNodeKey(g.group_id), kind: "group", group: g })
      );
      this._autoLayout(nodes);
      this._graphNodes = nodes;
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
      this._nodeEls = /* @__PURE__ */ new Map();
      nodes.forEach((n) => this._renderNode(n));
      this._renderGraphEdges();
      this._applyViewbox();
      this._toggleRoleLegend("#graph-role-legend", devices);
    }
    /** Shows the multi-role badge legend hint only when it's actually relevant
     *  to what's currently on screen — most people will never see one of
     *  these devices, and explaining an icon nobody's looking at is just
     *  clutter. See _isMultiRoleDevice(). */
    _toggleRoleLegend(selector, devices) {
      const el = this._q(selector);
      if (!el) return;
      el.style.display = devices.some((d) => this._isMultiRoleDevice(d)) ? "block" : "none";
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
          class: "node-shape node-group"
        });
        g.appendChild(rect);
        const label = this._svgEl("text", { class: "node-label", y: size + 16 });
        label.textContent = n.group.name || `Group ${n.group.group_id}`;
        g.appendChild(label);
      } else {
        const r = n.isCoordinator ? 26 : 20;
        const circle = this._svgEl("circle", {
          r,
          class: `node-shape ${n.isCoordinator ? "node-coordinator" : "node-device"}`
        });
        g.appendChild(circle);
        const icon = this._svgEl("text", { class: "node-icon", "text-anchor": "middle", dy: "0.35em" });
        icon.textContent = this._deviceIcon(n.device);
        g.appendChild(icon);
        const label = this._svgEl("text", { class: "node-label", y: r + 16 });
        label.textContent = this._deviceLabel(n.device);
        g.appendChild(label);
        if (this._isMultiRoleDevice(n.device)) g.appendChild(this._roleBadgeEl(r));
      }
      g.addEventListener("pointerdown", (e) => this._onNodePointerDown(e, n));
      this._nodesLayer.appendChild(g);
      this._nodeEls.set(n.key, g);
    }
    _renderGraphEdges() {
      if (!this._edgesLayer) return;
      while (this._edgesLayer.firstChild) this._edgesLayer.removeChild(this._edgesLayer.firstChild);
      const bindings = this._graphBindings();
      const visibleKeys = new Set((this._graphNodes || []).map((n) => n.key));
      const pairCount = /* @__PURE__ */ new Map();
      bindings.forEach((b) => {
        const fromKey = this._nodeKey(b.sourceIeee);
        const toKey = b.isGroup ? this._groupNodeKey(b.groupId) : this._nodeKey(b.targetIeee);
        if (!visibleKeys.has(fromKey) || !visibleKeys.has(toKey)) return;
        const pairKey = `${fromKey}->${toKey}`;
        const idx = pairCount.get(pairKey) || 0;
        pairCount.set(pairKey, idx + 1);
        const line = this._svgEl("path", {
          class: this._edgeClassFor(b),
          "data-id": b.id,
          "data-from": fromKey,
          "data-to": toKey,
          "data-offset": idx,
          stroke: clusterColor(b.clusterId),
          fill: "none",
          "marker-end": "url(#arrow)"
        });
        line.style.setProperty("--edge-color", clusterColor(b.clusterId));
        line.addEventListener("click", (e) => {
          e.stopPropagation();
          this._onEdgeClick(b);
        });
        this._edgesLayer.appendChild(line);
      });
      this._membershipEdges().forEach((m) => {
        const fromKey = this._groupNodeKey(m.groupId);
        const toKey = this._nodeKey(m.memberIeee);
        if (!visibleKeys.has(fromKey) || !visibleKeys.has(toKey)) return;
        const pairKey = `${fromKey}->${toKey}`;
        const idx = pairCount.get(pairKey) || 0;
        pairCount.set(pairKey, idx + 1);
        const line = this._svgEl("path", {
          class: "edge edge-membership",
          "data-id": m.id,
          "data-from": fromKey,
          "data-to": toKey,
          "data-offset": idx,
          stroke: MEMBERSHIP_EDGE_COLOR,
          fill: "none",
          "marker-end": "url(#arrow)"
        });
        line.style.setProperty("--edge-color", MEMBERSHIP_EDGE_COLOR);
        line.addEventListener("click", (e) => {
          e.stopPropagation();
          this._onMembershipEdgeClick(m);
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
        const dx = to.x - from.x, dy = to.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist, ny = dx / dist;
        const bend = offset * 18;
        const mx = (from.x + to.x) / 2 + nx * bend;
        const my = (from.y + to.y) / 2 + ny * bend;
        const tdx = to.x - mx, tdy = to.y - my;
        const tdist = Math.hypot(tdx, tdy) || 1;
        const targetGap = this._nodeRadius(el.dataset.to) + 3;
        const ex = to.x - tdx / tdist * targetGap;
        const ey = to.y - tdy / tdist * targetGap;
        el.setAttribute("d", `M ${from.x} ${from.y} Q ${mx} ${my} ${ex} ${ey}`);
      });
    }
    _svgEl(tag, attrs = {}) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    }
    /** Small corner badge marking a multi-role device (see
     *  _isMultiRoleDevice()) on a graph node, scaled off the node's own
     *  radius `r` so it looks right on both the Map's fixed-size nodes and
     *  the Floor Plan's variable, image-resolution-scaled ones. Shared by
     *  both renderers so the two views can't visually drift apart. */
    _roleBadgeEl(r) {
      const br = clamp(r * 0.42, 7, 11);
      const badge = this._svgEl("g", {
        class: "node-role-badge",
        transform: `translate(${r * 0.72},${-r * 0.72})`
      });
      badge.appendChild(this._svgEl("circle", { r: br, class: "node-role-badge-bg" }));
      const icon = this._svgEl("text", {
        class: "node-role-badge-icon",
        "text-anchor": "middle",
        dy: "0.35em",
        style: `font-size:${Math.round(br * 1.15)}px`
      });
      icon.textContent = "\u{1F579}";
      badge.appendChild(icon);
      const title = this._svgEl("title");
      title.textContent = "This device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here \u2014 click to see the per-endpoint breakdown.";
      badge.appendChild(title);
      return badge;
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
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      const w = clamp(vb.w / factor, 200, 6e3);
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
      this._q("#btn-fullscreen").textContent = this._fullscreen ? "\u2922" : "\u26F6";
      this._q("#btn-fullscreen").title = this._fullscreen ? "Exit fullscreen (Esc)" : "Toggle fullscreen";
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
      if (e.target.closest(".node")) return;
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
        startClient: { x: e.clientX, y: e.clientY }
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
      let closest = null, closestDist = Infinity;
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
      if (!ctx.moved) {
        if (ctx.node.kind === "device") this._openDeviceExplodedView(ctx.node.device);
        return;
      }
      this._savePositions();
      if (ctx.dropTarget) {
        if (ctx.node.kind !== "device") {
          this._setStatus("error", "You can only bind from a device (not a group).");
          return;
        }
        const target = ctx.dropTarget.kind === "group" ? { kind: "group", group: ctx.dropTarget.group } : { kind: "device", device: ctx.dropTarget.device };
        this._jumpToAdvancedBind(ctx.node.device, target);
      }
    }
    _onEdgeClick(binding) {
      this._openUnbindPopover(binding);
    }
    _onMembershipEdgeClick(m) {
      this._openMembershipPopover(m);
    }
    /** Read-only info for a group -> member edge (see _membershipEdges). No
     *  "remove" action here deliberately — that would mean sending a real
     *  remove_from_group zha_toolkit call, and its exact parameters haven't
     *  been verified against zha_toolkit's source the way every other action
     *  in this card has been (see bind_group/unbind_group). Rather than guess
     *  at an action that sends a real Zigbee command, this points you to
     *  ZHA's own group management UI, which already does this reliably. */
    _openMembershipPopover(m) {
      const group = (this._groups || []).find((g) => g.group_id === m.groupId);
      const device = this._devices.find((d) => normIeee(d.ieee) === m.memberIeee);
      const groupLabel = group ? group.name || `Group ${m.groupId}` : `Group ${m.groupId}`;
      const deviceLabel = device ? this._deviceLabel(device) : m.memberIeee;
      this._q("#dialog-title").textContent = "Group membership";
      this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Group</td><td>${escapeHtml(groupLabel)}</td></tr>
        <tr><td>Member</td><td>${escapeHtml(deviceLabel)} (ep ${m.memberEndpoint})</td></tr>
      </table>
      <p class="hint">This isn't a binding-table entry \u2014 it's real ZCL group
        membership, sourced from ZHA's own group data. The member receives
        this group's commands without needing any binding of its own. To
        change group membership, use Home Assistant's own group management
        (Settings &rarr; Devices &amp; Services &rarr; Zigbee Home
        Automation &rarr; Groups) \u2014 this card doesn't offer a "remove from
        group" action yet.</p>
      <div class="dialog-actions">
        <button class="btn" id="unbind-cancel">Close</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#unbind-cancel").addEventListener("click", () => this._closeDialog());
    }
    _closeDialog() {
      this._q("#dialog").classList.remove("open");
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.remove("wide");
      this._explodedDeviceIeee = null;
    }
    // -------------------------------------------------------------------
    // Exploded device view dialog — triggered from the Devices tab. Scans the
    // one device on demand (same binds_get + cluster-scan calls the rest of
    // the card already makes against your own HA instance), then renders a
    // per-endpoint breakdown. No external lookups, nothing asked of the user.
    // -------------------------------------------------------------------
    async _openDeviceExplodedView(d) {
      this._shareDraft = null;
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.add("wide");
      this._q("#dialog-title").textContent = this._deviceLabel(d);
      this._q("#dialog-body").innerHTML = `<p class="muted">Scanning ${escapeHtml(
        this._deviceLabel(d)
      )}\u2026</p>`;
      this._q("#dialog").classList.add("open");
      try {
        await Promise.all([this._ensureClusters(d.ieee), this._scanBindings([d.ieee], { tries: this._retryCount })]);
      } catch (err) {
        console.warn("[ZHA Bindings Manager] exploded view scan failed", err);
      }
      if (!this._q("#dialog").classList.contains("open")) return;
      const fresh = this._devices.find((x) => x.ieee === d.ieee) || d;
      this._renderExplodedView(fresh);
    }
    _renderExplodedView(d) {
      this._explodedDeviceIeee = d.ieee;
      const summary = this._deviceSummaryLines(d).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`).join("");
      const endpoints = this._deviceEndpoints(d);
      const cards = endpoints.length ? endpoints.map((ep) => this._endpointCardHtml(d, ep)).join("") : `<p class="muted">No endpoint data came back for this device \u2014 the scan may have failed (sleepy or unreachable device). Try again from the Devices tab.</p>`;
      const imgUrl = this._deviceImageUrl(d);
      const shape = this._deviceShapeSvg(endpoints.length);
      const visual = this._showDevicePhotos && imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" class="ep-device-photo"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="ep-device-shape" style="display:none">${shape}</div>` : `<div class="ep-device-shape">${shape}</div>`;
      const roleNote = this._isMultiRoleDevice(d) ? `<p class="hint ep-role-note">\u{1F579} This device also has its own Light/Switch/Cover/Fan role, on top of
           the control relationship(s) below \u2014 e.g. a wired/local load alongside a Zigbee-bound one. Look
           through the endpoint cards below to see which one is which.</p>` : "";
      this._q("#dialog-title").textContent = this._deviceLabel(d);
      this._q("#dialog-body").innerHTML = `
      <label class="row ep-photo-toggle">
        <input type="checkbox" id="ep-show-photos" ${this._showDevicePhotos ? "checked" : ""}>
        Show device photo (fetches from zigbee2mqtt.io, needs internet access)
      </label>
      <div class="ep-device-header">
        <div class="ep-device-visual">${visual}</div>
        <table class="detail-table">${summary}</table>
      </div>
      ${roleNote}
      <div class="ep-grid">${cards}</div>
      <div class="dialog-actions">
        <button class="btn" id="explode-close">Close</button>
      </div>`;
      this._q("#explode-close").addEventListener("click", () => this._closeDialog());
      this._q("#ep-show-photos").addEventListener("change", (e) => {
        this._saveShowDevicePhotos(e.target.checked);
        this._renderExplodedView(d);
      });
      this._qa(".ep-control-select").forEach((sel) => {
        sel.addEventListener("change", () => {
          this._setEndpointControlType(d.ieee, Number(sel.dataset.ep), sel.value);
        });
      });
      this._qa(".ep-cmd-check").forEach((btn) => {
        btn.addEventListener("click", () => this._checkEndpointCommands(d, Number(btn.dataset.ep)));
      });
      this._qa(".ep-cmd-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const rowKey = btn.dataset.rowKey;
          if (this._expandedCmdClusters.has(rowKey)) this._expandedCmdClusters.delete(rowKey);
          else this._expandedCmdClusters.add(rowKey);
          this._renderExplodedView(d);
        });
      });
      this._qa(".ep-cmd-share").forEach((btn) => {
        btn.addEventListener("click", () => this._shareCommandScan(d, Number(btn.dataset.ep)));
      });
      this._qa(".ep-cmd-share-cancel").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._shareDraft = null;
          this._renderExplodedView(d);
        });
      });
      this._qa(".ep-cmd-share-copy").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!this._shareDraft) return;
          const original = btn.textContent;
          const ok = await this._copyShareText(this._shareDraft.body);
          btn.textContent = ok ? "Copied!" : "Couldn't copy \u2014 select the text above";
          setTimeout(() => {
            btn.textContent = original;
          }, 2500);
        });
      });
      this._qa(".ep-cmd-share-open").forEach((a) => {
        a.addEventListener("click", async () => {
          if (!this._shareDraft || !this._shareDraft.tooLong) return;
          const original = a.textContent;
          const ok = await this._copyShareText(this._shareDraft.body);
          a.textContent = ok ? "Copied \u2014 opening issue\u2026" : "Couldn't copy \u2014 opening issue\u2026";
          setTimeout(() => {
            a.textContent = original;
          }, 2500);
        });
      });
    }
    _commandScanKey(ieee, ep) {
      return `${normIeee(ieee)}:${ep}`;
    }
    /** Pure classification helper (unit-tested in smoke-test.js) — given a
     *  cluster ID and the `commands_received` object zha_toolkit's
     *  scan_device returned for it (possibly empty/missing), works out what's
     *  safe to claim:
     *  - Clusters we have a known standard command list for (CLUSTER_COMMANDS)
     *    get a row per known command, marked present/absent — but only when
     *    the device actually returned at least one command for that cluster.
     *    An empty result is genuinely ambiguous (confirmed zero commands vs.
     *    the device never answering discovery at all — zha_toolkit doesn't
     *    preserve that distinction in what it returns, see
     *    ZhaApi.scanDeviceCommands), so it comes back `confirmed:false` with
     *    no rows rather than a list of false crosses.
     *  - Clusters with no known command list just report whatever discovery
     *    found, positively — there's nothing to compare against, so no
     *    "missing" claims are made. */
    _classifyClusterCommands(clusterId, commandsReceived) {
      const known = CLUSTER_COMMANDS[Number(clusterId)];
      const found = commandsReceived && typeof commandsReceived === "object" ? commandsReceived : {};
      const foundIds = new Set(Object.keys(found).map((k) => Number(k)));
      const hasAnyResult = foundIds.size > 0;
      if (known) {
        if (!hasAnyResult) return { known: true, confirmed: false, rows: [] };
        const rows2 = Object.entries(known).map(([id, name]) => ({
          id: Number(id),
          name,
          present: foundIds.has(Number(id))
        }));
        return { known: true, confirmed: true, rows: rows2 };
      }
      const rows = Object.entries(found).map(([id, info]) => ({
        id: Number(id),
        name: info && info.command_name || `0x${Number(id).toString(16).padStart(2, "0")}`,
        present: true
      }));
      return { known: false, confirmed: hasAnyResult, rows };
    }
    /** Triggers a live zha_toolkit.scan_device command-discovery scan for one
     *  endpoint (see ZhaApi.scanDeviceCommands) and re-renders the exploded
     *  view with the result. Deliberately not part of the normal scan flow —
     *  this is slower (real ZCL discovery round-trips per cluster) and only
     *  useful on demand for a specific device someone's already investigating. */
    async _checkEndpointCommands(d, ep) {
      const key = this._commandScanKey(d.ieee, ep);
      this._commandScans.set(key, { status: "loading" });
      if (this._q("#dialog").classList.contains("open")) this._renderExplodedView(d);
      if (!this._capExpIndex && !this._capExpLoading) this._capExpLoadIndex();
      try {
        const scan = await this._api.scanDeviceCommands(d.ieee, { endpoint: ep, tries: this._retryCount });
        this._commandScans.set(key, { status: "done", scan });
      } catch (err) {
        this._commandScans.set(key, { status: "error", error: err.message || String(err) });
      }
      if (!this._q("#dialog").classList.contains("open")) return;
      const fresh = this._devices.find((x) => x.ieee === d.ieee) || d;
      this._renderExplodedView(fresh);
    }
    /** Renders the "Supported commands" block for one endpoint card: a
     *  collapsed row per cluster this endpoint actually declares (via the
     *  cluster cache — real, already-fetched data, no live query needed just
     *  to show the list) that we also have a known command table for
     *  (CLUSTER_COMMANDS). Clusters the device doesn't declare at all simply
     *  never appear — a light endpoint never shows a Door Lock row — so this
     *  is naturally scoped without any device-type special-casing. Rows start
     *  collapsed; expanding one shows its full valid/invalid command list
     *  once a scan has run, not just what's missing — Hans was explicit that
     *  seeing what a device *can* do is as valuable as spotting a gap. One
     *  scan (via the button above the list) populates every row on this
     *  endpoint at once, since zha_toolkit's scan_device has no way to target
     *  a single cluster — see _checkEndpointCommands(). */
    _commandsSectionHtml(d, ep) {
      const clusters = this._clusterCache.get(d.ieee) || [];
      const declaredIds = new Set(
        clusters.filter((c) => c.type === "in" && c.endpoint_id === ep).map((c) => Number(c.id))
      );
      const relevantIds = [...declaredIds].filter((id) => CLUSTER_COMMANDS[id]).sort((a, b) => a - b);
      if (!relevantIds.length) {
        return `<p class="hint ep-cmd-status">This endpoint doesn't declare any clusters this card has command data for.</p>`;
      }
      const key = this._commandScanKey(d.ieee, ep);
      const entry = this._commandScans.get(key);
      let actionHtml;
      if (!entry) {
        actionHtml = `<button class="btn btn-small ep-cmd-check" data-ep="${ep}">Check supported commands</button>`;
      } else if (entry.status === "loading") {
        actionHtml = `<p class="hint ep-cmd-status">Checking supported commands&hellip; this queries the device directly and can take a while.</p>`;
      } else if (entry.status === "error") {
        actionHtml = `
        <p class="hint ep-cmd-status">Couldn't check supported commands: ${escapeHtml(entry.error)}</p>
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">Try again</button>`;
      } else {
        actionHtml = `
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">Re-check</button>
        <button class="btn btn-small ep-cmd-share" data-ep="${ep}">Share this scan</button>`;
      }
      const scanned = !!(entry && entry.status === "done");
      const epScan = scanned ? (entry.scan && entry.scan.endpoints || []).find((e) => Number(e.id) === Number(ep)) : null;
      const inClusters = epScan && epScan.in_clusters || {};
      const rows = relevantIds.map((clusterId) => {
        const hexKey = hex4(clusterId);
        const c = inClusters[hexKey];
        const rowKey = `${key}:${clusterId}`;
        const expanded = this._expandedCmdClusters.has(rowKey);
        const title = `${escapeHtml(clusterName(clusterId))} <span class="ep-cmd-cluster-id">${hex4(clusterId)}</span>`;
        let summary = "Not checked yet";
        let bodyHtml = `<p class="hint">Run "Check supported commands" above to see this cluster's valid/invalid commands.</p>`;
        if (scanned) {
          if (!c) {
            summary = "No data returned";
            bodyHtml = `<p class="hint">The scan didn't return data for this cluster \u2014 the device may not have responded for it specifically.</p>`;
          } else {
            const cls = this._classifyClusterCommands(clusterId, c.commands_received);
            if (!cls.confirmed) {
              summary = "No response to discovery";
              bodyHtml = `<p class="hint">No commands reported \u2014 this device may not support command discovery.</p>`;
            } else {
              const presentCount = cls.rows.filter((r) => r.present).length;
              summary = `${presentCount} of ${cls.rows.length} confirmed`;
              bodyHtml = cls.rows.map(
                (r) => `
                  <div class="ep-cmd-row ${r.present ? "ep-cmd-yes" : "ep-cmd-no"}">
                    <span class="ep-cmd-icon">${r.present ? "\u2713" : "\u2715"}</span>
                    <span class="ep-cmd-name">${escapeHtml(r.name)}</span>
                    <span class="ep-cmd-hex">0x${r.id.toString(16).padStart(2, "0")}</span>
                  </div>`
              ).join("");
            }
          }
        }
        return `
          <div class="ep-cmd-cluster">
            <button type="button" class="ep-cmd-cluster-head ep-cmd-toggle" data-row-key="${escapeHtml(rowKey)}">
              <span class="ep-cmd-chevron">${expanded ? "\u25BE" : "\u25B8"}</span>
              <span class="ep-cmd-cluster-title">${title}</span>
              <span class="ep-cmd-summary">${escapeHtml(summary)}</span>
            </button>
            ${expanded ? `<div class="ep-cmd-cluster-body">${bodyHtml}</div>` : ""}
          </div>`;
      }).join("");
      const shareHtml = this._shareDraft && this._shareDraft.key === key ? this._shareDraftHtml(this._shareDraft) : "";
      const compareHtml = scanned ? this._capExpCompareMyDeviceHtml(d, ep, entry.scan) : "";
      return `
      <div class="ep-cmd-actions">${actionHtml}</div>
      ${compareHtml}
      <div class="ep-cmd-results">${rows}</div>
      ${shareHtml}`;
    }
    /** "Compare My Device" (PRD v2, Phase 2) — once a live scan has confirmed
     *  this device's own firmware, checks it against every firmware the
     *  community database has on file for the same manufacturer/model and
     *  says plainly whether anything newer has been *observed* (never
     *  "latest" — see newestFirmwareGap's own doc comment; this card has no
     *  way to know the true manufacturer OTA latest, only what's been shared).
     *  Reuses the same live-scan sw_build_id _buildCapabilityRecord already
     *  extracts for the share-to-database flow, so there's no separate
     *  identity lookup to keep in sync. */
    _capExpCompareMyDeviceHtml(d, ep, scan) {
      const record = this._buildCapabilityRecord(d, ep, scan);
      const liveFirmware = record && record.identity && record.identity.sw_build_id;
      if (!liveFirmware) return "";
      if (!this._capExpIndex) {
        if (!this._capExpLoading) this._capExpLoadIndex();
        return `<div class="capexp-compare-my-device muted">Checking the community database for newer firmware&hellip;</div>`;
      }
      const mSlug = slugify(d.manufacturer);
      const moSlug = slugify(d.model);
      const entries = this._capExpIndex.filter((e) => e.manufacturer_slug === mSlug && e.model_slug === moSlug);
      if (!entries.length) {
        return `<div class="capexp-compare-my-device muted">No community data for this device yet \u2014 share this scan below and you'll be the first.</div>`;
      }
      const gap = newestFirmwareGap(liveFirmware, entries);
      if (!gap) {
        return `<div class="capexp-compare-my-device capexp-compare-ok">You're on <strong>${escapeHtml(
          liveFirmware
        )}</strong> \u2014 the community hasn't confirmed anything newer for this device yet.</div>`;
      }
      const newItems = gap.diff ? this._capExpNewCapabilitiesList(gap.diff) : [];
      let bodyHtml;
      if (gap.diff === null) {
        bodyHtml = `<p class="hint">Newer firmware confirmed by the community, but nobody's compared it against exactly your version yet.</p>`;
      } else if (newItems.length) {
        bodyHtml = `<div class="capexp-compare-label">New capabilities since your version</div>
        <ul class="capexp-compare-list">${newItems.map((item) => `<li>\u2713 ${escapeHtml(item)}</li>`).join("")}</ul>`;
      } else {
        bodyHtml = `<p class="hint">Compared against your version \u2014 no new capabilities were confirmed on the newer firmware (may still fix bugs or remove something).</p>`;
      }
      return `
      <div class="capexp-compare-my-device">
        <div class="capexp-compare-fw-row"><span class="muted">Your firmware</span> <strong>${escapeHtml(
        liveFirmware
      )}</strong></div>
        <div class="capexp-compare-fw-row"><span class="muted">Community has observed</span> <strong>${escapeHtml(
        gap.newestFirmware
      )}</strong></div>
        ${bodyHtml}
        <p class="hint">See the full comparison, including anything removed, in the Zigbee Capability Explorer tab's Compare firmware mode.</p>
      </div>`;
    }
    /** Turns a diffFirmware() row list into the plain-English checklist shown
     *  above — new commands by name, plus a rollup count of newly-confirmed
     *  attributes (attribute names are internal/technical enough that a raw
     *  list would undercut the "translate technology into outcomes"
     *  principle; a count still tells the truth without the jargon dump). */
    _capExpNewCapabilitiesList(diff) {
      const items = [];
      let addedAttrs = 0;
      diff.forEach((row) => {
        (row.addedCommands || []).forEach((name) => items.push(name));
        (row.attributeChanges || []).forEach((a) => {
          if (a.change === "added") addedAttrs++;
        });
      });
      if (addedAttrs) {
        items.push(`${addedAttrs} additional attribute${addedAttrs === 1 ? "" : "s"} confirmed`);
      }
      return items;
    }
    /** Inline "review before sharing" block for a completed command scan —
     *  see _shareCommandScan(). Shown directly under the cluster list rather
     *  than as a separate dialog (the exploded view is already a dialog, and
     *  this card has no nested-dialog support), so nothing is ever sent
     *  anywhere without the user seeing exactly what's in it first.
     *  When the payload's too large to pre-fill the whole issue, the title
     *  still gets pre-filled (titles are always short) and the one open/link
     *  action also copies the JSON in the same click — down to one manual
     *  step (paste) instead of inventing a title and copying separately. */
    _shareDraftHtml(draft) {
      const openLabel = draft.tooLong ? "Copy JSON &amp; open issue" : "Open GitHub issue";
      const openBtn = `<a class="btn btn-small ep-cmd-share-open" href="${escapeHtml(
        draft.url
      )}" target="_blank" rel="noopener">${openLabel}</a>`;
      const notice = draft.tooLong ? `<p class="hint">This scan is too large to pre-fill the whole issue. The title's already filled in \u2014 clicking below also copies the JSON, so just paste it (Ctrl/Cmd+V) into the body once the new issue opens.</p>` : `<p class="hint">Review what would be submitted, then open a pre-filled GitHub issue \u2014 nothing is sent until you click "Submit new issue" on GitHub's own page. No IEEE address, entity, area, or binding data is included.</p>`;
      return `
      <div class="ep-cmd-share-draft">
        ${notice}
        <textarea class="ep-cmd-share-json" readonly rows="8">${escapeHtml(draft.body)}</textarea>
        <div class="ep-cmd-share-actions">
          ${openBtn}
          <button class="btn btn-small ep-cmd-share-copy" type="button">Copy JSON</button>
          <button class="btn btn-small ep-cmd-share-cancel" type="button">Cancel</button>
        </div>
      </div>`;
    }
    /** Assembles the shareable capability record for one endpoint's completed
     *  scan_device result, matching the schema described in the
     *  zigbee-capabilities repo's README. Pure function of
     *  (device, endpoint, scan) — unit-tested in smoke-test.js — so it's
     *  never guessing at the scan's shape; every field read here is verified
     *  against zha_toolkit's actual scan_device.py (scan_endpoint/scan_cluster/
     *  discover_attributes_extended).
     *  Deliberately excludes anything that identifies this specific device or
     *  network — no IEEE, no entity IDs, no area, no binding data — only what
     *  the device model/firmware is capable of. Covers every cluster the scan
     *  touched (not just the known-command ones the UI itself displays),
     *  since attribute-only clusters (e.g. Basic, Power Configuration) are
     *  still genuinely useful capability data for the shared database even
     *  though this card has nothing to check them against. */
    _buildCapabilityRecord(d, ep, scan) {
      const epScan = (scan && scan.endpoints || []).find((e) => Number(e.id) === Number(ep));
      if (!epScan) return null;
      const inClusters = epScan.in_clusters || {};
      const outClusters = epScan.out_clusters || {};
      const basic = inClusters["0x0000"];
      const findIdentityAttr = (name) => {
        if (!basic || !basic.attributes) return null;
        const hit = Object.values(basic.attributes).find((a) => a.attribute_name === name);
        return hit && hit.attribute_value != null ? hit.attribute_value : null;
      };
      const clusters = {};
      Object.keys(inClusters).forEach((hexKey) => {
        const clusterData = inClusters[hexKey] || {};
        const clusterId = Number(hexKey);
        const commandsReceived = this._classifyClusterCommands(clusterId, clusterData.commands_received);
        const commandsGenerated = Object.values(clusterData.commands_generated || {}).map((info) => ({
          id: Number(info.command_id),
          name: info.command_name
        }));
        const attributesConfirmed = Object.values(clusterData.attributes || {}).map((info) => ({
          id: Number(info.attribute_id),
          name: info.attribute_name,
          access: info.access
        }));
        clusters[hexKey] = {
          name: clusterName(clusterId),
          commands_received: commandsReceived.rows,
          commands_received_confirmed: commandsReceived.confirmed,
          commands_generated: commandsGenerated,
          attributes_confirmed: attributesConfirmed
        };
      });
      return {
        manufacturer: d.manufacturer || null,
        model: d.model || null,
        identity: {
          sw_build_id: findIdentityAttr("sw_build_id"),
          hw_version: findIdentityAttr("hw_version"),
          date_code: findIdentityAttr("date_code")
        },
        endpoint: {
          id: ep,
          profile: epScan.profile || null,
          device_type: epScan.device_type || null,
          in_clusters: Object.keys(inClusters),
          out_clusters: Object.keys(outClusters)
        },
        clusters,
        provenance: {
          submitted_at: (/* @__PURE__ */ new Date()).toISOString(),
          card_version: CARD_VERSION
        }
      };
    }
    /** Builds the review draft for sharing a completed command scan to the
     *  community capability database (see CAPABILITY_DB_REPO) and shows it
     *  inline for confirmation — see _shareDraftHtml(). Always manual, never
     *  automatic: nothing leaves the browser until the user clicks through to
     *  GitHub's own "Submit new issue" button themselves, using their own
     *  GitHub session — this card never touches GitHub credentials. GitHub
     *  issue pre-fill URLs get unreliable well before any hard browser limit,
     *  so 6000 characters is a conservative cutoff, not the actual ceiling.
     *  The URL attempt uses compact (unindented) JSON specifically to
     *  maximize how often a scan fits under that cutoff — pretty-printing's
     *  whitespace alone is often 30-50% of the encoded size — while the
     *  on-screen review box and clipboard copy stay pretty-printed for
     *  readability, since that's what actually gets pasted/submitted. Past
     *  the cutoff, the title still gets pre-filled (titles are always short)
     *  with a paste placeholder body — see _shareDraftHtml(). */
    _shareCommandScan(d, ep) {
      const key = this._commandScanKey(d.ieee, ep);
      const entry = this._commandScans.get(key);
      if (!entry || entry.status !== "done") return;
      const record = this._buildCapabilityRecord(d, ep, entry.scan);
      if (!record) {
        this._setStatus("error", "Nothing to share \u2014 no scan data for this endpoint.");
        return;
      }
      const title = `[Device Submission] ${record.manufacturer || "Unknown"} ${record.model || "Unknown"}${record.identity.sw_build_id ? ` (fw ${record.identity.sw_build_id})` : ""}`;
      const displayBody = "```json\n" + JSON.stringify(record, null, 2) + "\n```";
      const compactBody = "```json\n" + JSON.stringify(record) + "\n```";
      const labelsParam = `labels=${encodeURIComponent("device-submission")}`;
      const fullUrl = `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(compactBody)}&${labelsParam}`;
      const tooLong = fullUrl.length > 6e3;
      const url = tooLong ? `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent("Paste the copied JSON below this line:\n\n")}&${labelsParam}` : fullUrl;
      this._shareDraft = { key, record, title, body: displayBody, url, tooLong };
      this._renderExplodedView(d);
    }
    /** Best-effort clipboard copy with an old-style fallback for HTTP-served
     *  Home Assistant instances — navigator.clipboard only exists in secure
     *  contexts (https or localhost), and plenty of real HA installs are
     *  reached over plain http on a LAN IP, where it's simply undefined and
     *  the modern API can't be used at all (not a rare edge case). Falls back
     *  to selecting the visible review textarea and asking the browser to
     *  copy the current selection via the older execCommand path, which works
     *  over plain http too; if even that's unavailable, the text is at least
     *  left selected for a manual Ctrl/Cmd+C. Returns whether the copy is
     *  believed to have worked — execCommand's return value is the only
     *  signal either path gives, so this is best-effort, not a guarantee. */
    async _copyShareText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (e) {
        }
      }
      const textarea = this._q(".ep-cmd-share-json");
      if (textarea) {
        try {
          textarea.focus();
          textarea.select();
          return document.execCommand("copy");
        } catch (e) {
        }
      }
      return false;
    }
    /** One endpoint's card: real relationships first (self-bound, controls
     *  another device, controls a group, receives control, group membership,
     *  reporting-only), each its own badge since an endpoint can genuinely be
     *  more than one of these at once (confirmed this session), then the
     *  user-editable "what does this control" picker. */
    _endpointCardHtml(d, ep) {
      const rel = this._endpointRelationships(d, ep);
      const coord = this._coordinatorIeee();
      const detach = this._detachStateFor(d, ep);
      const detachHtml = detach.state === null ? `<span class="ep-badge ep-badge-muted" title="No matching switch.*detach* entity found for this endpoint">Mode unknown</span>` : `<span class="ep-badge ep-badge-muted" title="${escapeHtml(detach.entityId || "")}">${detach.state ? "Detached" : "Not detached"}</span>`;
      const badge = (cls, main, clusters) => `<span class="ep-badge ${cls}">${main}${clusters.length > 1 ? `<span class="ep-badge-clusters">${escapeHtml(clusters.join(", "))}</span>` : ""}</span>`;
      const badges = [];
      this._groupBindingsByKey(rel.self, (b) => `${b.targetIeee}:${b.targetEndpoint}`).forEach(
        ({ binding: b, clusters }) => {
          const main = `Self-bound${b.targetEndpoint !== ep ? ` (ep ${b.targetEndpoint})` : ""}`;
          badges.push(badge("ep-badge-self", main, clusters));
        }
      );
      this._groupBindingsByKey(rel.controlsDevice, (b) => `${b.targetIeee}:${b.targetEndpoint}`).forEach(
        ({ binding: b, clusters }) => {
          const main = `Controls ${escapeHtml(this._targetDeviceLabel(b.targetIeee))} (ep ${b.targetEndpoint})`;
          badges.push(badge("ep-badge-out", main, clusters));
        }
      );
      this._groupBindingsByKey(rel.controlsGroup, (b) => `group:${b.groupId}`).forEach(
        ({ binding: b, clusters }) => {
          const main = `Controls group ${escapeHtml(this._groupLabel(b.groupId))}`;
          badges.push(badge("ep-badge-out", main, clusters));
        }
      );
      this._groupBindingsByKey(rel.incoming, (b) => `${b.sourceIeee}:${b.sourceEndpoint}`).forEach(
        ({ binding: b, clusters }) => {
          const main = `Receives control from ${escapeHtml(this._targetDeviceLabel(b.sourceIeee))} (ep ${b.sourceEndpoint})`;
          badges.push(badge("ep-badge-in", main, clusters));
        }
      );
      rel.memberOf.forEach((m) => {
        badges.push(
          `<span class="ep-badge ep-badge-member">Member of ${escapeHtml(this._groupLabel(m.groupId))}</span>`
        );
      });
      this._groupBindingsByKey(
        rel.unknown,
        (b) => b.isGroup ? `group:${b.groupId}` : `${b.targetIeee}:${b.targetEndpoint}`
      ).forEach(({ binding: b, clusters }) => {
        const main = b.isGroup ? `Unclassified binding to group ${escapeHtml(this._groupLabel(b.groupId))}` : `Unclassified binding to ${escapeHtml(this._targetDeviceLabel(b.targetIeee))} (ep ${b.targetEndpoint})`;
        badges.push(badge("ep-badge-unknown", main, clusters));
      });
      if (!badges.length) badges.push(`<span class="ep-badge ep-badge-reporting">Reporting only</span>`);
      const reportLine = this._groupBindingsByKey(
        rel.reportsTo,
        (b) => b.isGroup ? `group:${b.groupId}` : `target:${b.targetIeee}`
      ).map(({ binding: b, clusters }) => {
        const targetLabel = b.isGroup ? `group ${this._groupLabel(b.groupId)}` : b.targetIeee === coord ? "the coordinator" : this._targetDeviceLabel(b.targetIeee);
        return `<p class="ep-report">Also reports ${escapeHtml(clusters.join(", "))} to ${escapeHtml(
          targetLabel
        )}</p>`;
      }).join("");
      const current = this._endpointControlType(d.ieee, ep);
      const options = ENDPOINT_CONTROL_TYPES.map(
        (t) => `<option${t === current ? " selected" : ""}>${escapeHtml(t)}</option>`
      ).join("");
      return `
      <div class="ep-card">
        <div class="ep-card-head">
          <span class="ep-card-title">Endpoint ${ep}</span>
          ${detachHtml}
        </div>
        <div class="ep-badges">${badges.join("")}</div>
        ${reportLine}
        <div class="ep-cmd-section">
          <label class="ep-picker-label">Supported commands</label>
          ${this._commandsSectionHtml(d, ep)}
        </div>
        <label class="ep-picker-label">Physically wired to</label>
        <select class="ep-control-select" data-ep="${ep}">${options}</select>
      </div>`;
    }
    // -------------------------------------------------------------------
    // Unbind popover (triggered from clicking an edge, or a row in the table)
    // -------------------------------------------------------------------
    _openUnbindPopover(binding) {
      const dialog = this._q("#dialog");
      this._q("#dialog-title").textContent = "Binding details";
      const source = this._devices.find((d) => d.ieee === binding.sourceIeee);
      const target = binding.isGroup ? this._groups.find((g) => g.group_id === binding.groupId) : this._devices.find((d) => d.ieee === binding.targetIeee);
      const sourceLabel = source ? this._deviceLabel(source) : binding.sourceIeee;
      const targetLabel = binding.isGroup ? target ? target.name : `Group ${binding.groupId}` : target ? this._deviceLabel(target) : binding.targetIeee;
      const cls = this._classifyBinding(binding);
      const typeText = {
        control: "Control &mdash; the source uses this to command the target",
        reporting: "Reporting &mdash; the source uses this to report its own state; not a control relationship",
        unknown: "Unknown &mdash; the source device hasn't been cluster-scanned yet, so this can't be classified as control or reporting. Shown either way rather than guessing."
      }[cls];
      this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Source</td><td>${escapeHtml(sourceLabel)} (ep ${binding.sourceEndpoint})</td></tr>
        <tr><td>Target</td><td>${escapeHtml(targetLabel)}${binding.isGroup ? "" : ` (ep ${binding.targetEndpoint})`}</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
        <tr><td>Type</td><td>${typeText}</td></tr>
      </table>
      <div class="dialog-actions">
        <button class="btn btn-danger" id="unbind-confirm">Remove binding</button>
        <button class="btn" id="unbind-cancel">Close</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#unbind-cancel").addEventListener("click", () => this._closeDialog());
      this._q("#unbind-confirm").addEventListener("click", async () => {
        this._closeDialog();
        this._setStatus("info", "Removing binding\u2026", 0);
        const bindTarget = binding.isGroup ? { isGroup: true, groupId: binding.groupId } : { isGroup: false, ieee: binding.targetIeee, endpoint: binding.targetEndpoint };
        const before = this._bindingPresent(binding.sourceIeee, binding.sourceEndpoint, binding.clusterId, bindTarget);
        const rescanTargets = binding.isGroup ? [binding.sourceIeee] : this._impactedIeees(binding.sourceIeee, binding.targetIeee);
        try {
          if (binding.isGroup) {
            await this._api.unbindGroup(binding.sourceIeee, binding.groupId, [binding.clusterId], {
              endpoint: binding.sourceEndpoint
            });
          } else {
            await this._api.unbindIeee(binding.sourceIeee, binding.targetIeee, [binding.clusterId], {
              endpoint: binding.sourceEndpoint,
              dstEndpoint: binding.targetEndpoint
            });
          }
        } catch (err) {
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
          this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? void 0 : 0);
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
        const target = b.isGroup ? this._groups.find((g) => g.group_id === b.groupId) : this._devices.find((d) => d.ieee === b.targetIeee);
        const hay = `${source ? this._deviceLabel(source) : ""} ${target ? target.name || this._deviceLabel(target) : ""} ${clusterName(b.clusterId)} ${source ? this._areaName(source.area_id) : ""} ${source ? source.manufacturer || "" : ""} ${source ? source.model || "" : ""}`.toLowerCase();
        return hay.includes(s);
      });
    }
    _renderTable() {
      const wrap = this._q("#table-body");
      if (!wrap) return;
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
        const target = b.isGroup ? this._groups.find((g) => g.group_id === b.groupId) : this._devices.find((d) => d.ieee === b.targetIeee);
        const sourceLabel = source ? this._deviceLabel(source) : b.sourceIeee;
        const targetLabel = b.isGroup ? target && target.name || `Group ${b.groupId}` : target ? this._deviceLabel(target) : b.targetIeee;
        const typeLabel = source ? this._devicePrimaryType(source) : "\u2014";
        const typeFull = source ? this._deviceTypeTags(source).join(", ") : "";
        const areaLabel = source ? this._areaName(source.area_id) : "\u2014";
        const manModel = source ? [source.manufacturer, source.model].filter(Boolean).join(" / ") || "\u2014" : "\u2014";
        const health = healthMap.get(b.id) || {
          level: "ok",
          code: "ok",
          message: "",
          why: "",
          recommendation: null
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
          healthRank: HEALTH_RANK[health.level] ?? 9
        };
      });
      rows = this._sortRows(rows, this._tableSort);
      if (!rows.length) {
        wrap.innerHTML = `<tr><td colspan="8" class="muted">No bindings loaded yet. Click "Scan bindings" above.</td></tr>`;
        return;
      }
      wrap.innerHTML = rows.map((r) => {
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
          <td>${escapeHtml(r.targetLabel)} ${b.isGroup ? "(group)" : `<span class="muted">(ep ${b.targetEndpoint})</span>`}</td>
          <td><button class="health-badge health-${h.level}" data-health="${b.id}" title="${escapeHtml(
          h.message
        )}">${HEALTH_ICON[h.level]} ${escapeHtml(HEALTH_LABEL[h.level])}</button></td>
          <td><button class="btn btn-small btn-danger" data-unbind="${b.id}">Unbind</button></td>
        </tr>`;
      }).join("");
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
      ${counts.warning ? `<span class="health-chip health-warning">${HEALTH_ICON.warning} ${counts.warning} Warning${counts.warning === 1 ? "" : "s"}</span>` : ""}
      ${counts.error ? `<span class="health-chip health-error">${HEALTH_ICON.error} ${counts.error} Error${counts.error === 1 ? "" : "s"}</span>` : ""}
      ${counts.info ? `<span class="health-chip health-info">${HEALTH_ICON.info} ${counts.info} Info</span>` : ""}
    `;
    }
    /** Detail popover for a Health badge — answers what's wrong, why it
     *  matters, and what to do next, reusing the generic dialog. */
    _openHealthDetail(binding, health) {
      const source = this._devices.find((d) => d.ieee === binding.sourceIeee);
      const target = binding.isGroup ? this._groups.find((g) => g.group_id === binding.groupId) : this._devices.find((d) => d.ieee === binding.targetIeee);
      const sourceLabel = source ? this._deviceLabel(source) : binding.sourceIeee;
      const targetLabel = binding.isGroup ? target && target.name || `Group ${binding.groupId}` : target ? this._deviceLabel(target) : binding.targetIeee;
      this._q("#dialog-title").textContent = `${HEALTH_ICON[health.level]} ${HEALTH_LABEL[health.level]}`;
      const detailHtml = health.level === "ok" ? `<p>${escapeHtml(health.message)}</p>` : `
      <p><strong>What's wrong:</strong> ${escapeHtml(health.message)}</p>
      <p><strong>Why it matters:</strong> ${escapeHtml(health.why)}</p>
      ${health.recommendation ? `<p><strong>Next steps:</strong> ${escapeHtml(health.recommendation)}</p>` : ""}`;
      this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Binding</td><td>${escapeHtml(sourceLabel)} (ep ${binding.sourceEndpoint}) \u2192 ${escapeHtml(
        targetLabel
      )}${binding.isGroup ? " (group)" : ` (ep ${binding.targetEndpoint})`}</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
      </table>
      ${detailHtml}
      <div class="dialog-actions">
        ${(health.code === "unable_to_verify" || health.code === "partial_scan") && source ? `<button class="btn" id="health-detail-rescan" data-ieee="${escapeHtml(source.ieee)}">Rescan now</button>` : ""}
        <button class="btn" id="health-detail-close">Close</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#health-detail-close").addEventListener("click", () => this._closeDialog());
      const rescanBtn = this._q("#health-detail-rescan");
      if (rescanBtn) {
        rescanBtn.addEventListener("click", async () => {
          rescanBtn.disabled = true;
          rescanBtn.textContent = "Scanning\u2026";
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
        const target = b.isGroup ? this._groups.find((g) => g.group_id === b.groupId) : this._devices.find((d) => d.ieee === b.targetIeee);
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
          target_name: b.isGroup ? target && target.name || `Group ${b.groupId}` : target ? this._deviceLabel(target) : "",
          target_ieee_or_group: b.isGroup ? `group:${b.groupId}` : b.targetIeee,
          target_endpoint: b.isGroup ? "" : b.targetEndpoint,
          health_status: HEALTH_LABEL[health.level] || health.level,
          health_details: health.message || ""
        };
      });
    }
    _printBindings() {
      const rows = this._exportRowsData();
      const win = window.open("", "_blank");
      if (!win) {
        this._setStatus("error", "Pop-up blocked \u2014 allow pop-ups for this page to print/save as PDF.");
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
        "health_details"
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
        health_details: "Health details"
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
      <div class="meta">Exported ${escapeHtml((/* @__PURE__ */ new Date()).toLocaleString())} \u2014 ${rows.length} binding(s)</div>
      <table><thead><tr>${cols.map((c) => `<th>${titles[c]}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>
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
      const whenIso = history && (history.lastSuccessAt || history.lastAttemptAt) || (status === "ok" ? this._lastScanAt : null);
      const statusLabel = { failed: "Failed", partial: "Partial", ok: "OK", never: "Never scanned" }[status];
      const bits = [statusLabel];
      if (whenIso) bits.push(relTime(whenIso));
      if (history && history.medianMs != null) bits.push(`typical ${formatDurationMs(history.medianMs)}`);
      if (history && history.attemptCount > 1) {
        bits.push(`responded ${history.successCount}/${history.attemptCount}`);
      }
      const needsExplanation = status === "failed" || status === "partial";
      const wakeHint = !needsExplanation ? "" : isBattery ? `<div class="scan-wake-hint">May be asleep \u2014 press a button on it, then rescan.</div>` : `<div class="scan-wake-hint">Not responding \u2014 check it's powered on and in range, then rescan.</div>`;
      const btnLabel = isBattery && needsExplanation ? "Wake & rescan" : "Rescan";
      return {
        scanRank,
        html: `<div class="scan-cell scan-cell-${status}">
        <span class="scan-cell-status">${escapeHtml(bits.join(" \xB7 "))}</span>
        ${wakeHint}
        <button type="button" class="btn btn-small scan-cell-btn" data-ieee="${escapeHtml(device.ieee)}">${btnLabel}</button>
      </div>`
      };
    }
    _renderDevicesTab() {
      const wrap = this._q("#devices-table-body");
      if (!wrap) return;
      this._updateSortIndicators("#view-devices", this._devicesSort);
      if (!this._loaded) {
        wrap.innerHTML = `<tr><td colspan="9" class="muted">Loading devices\u2026</td></tr>`;
        return;
      }
      let rows = this._devices.map((d) => {
        const scanCell = this._lastScanCellInfo(d);
        return {
          device: d,
          name: this._deviceLabel(d),
          type: this._devicePrimaryType(d),
          typeFull: this._deviceTypeTags(d).join(", "),
          manufacturer: d.manufacturer || "\u2014",
          model: d.model || "\u2014",
          area: this._areaName(d.area_id),
          power: d.power_source || "\u2014",
          count: this._deviceBindingCount(d.ieee),
          scanRank: scanCell.scanRank,
          scanHtml: scanCell.html
        };
      });
      rows = this._devicesSort.key ? this._sortRows(rows, this._devicesSort) : rows.sort((a, b) => a.name.localeCompare(b.name));
      if (!rows.length) {
        wrap.innerHTML = `<tr><td colspan="9" class="muted">No devices found.</td></tr>`;
        return;
      }
      wrap.innerHTML = rows.map(
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
          <td><button class="btn btn-small explode-btn" data-ieee="${escapeHtml(
          r.device.ieee
        )}">Explode</button></td>
        </tr>`
      ).join("");
      this._qa("#devices-table-body .src-link").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          this._tableSourceFilter = el.dataset.ieee;
          this._switchView("table");
        });
      });
      this._qa("#devices-table-body .explode-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const device = this._devices.find((x) => x.ieee === btn.dataset.ieee);
          if (device) this._openDeviceExplodedView(device);
        });
      });
      this._qa("#devices-table-body .scan-cell-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.disabled = true;
          const original = btn.textContent;
          btn.textContent = "Scanning\u2026";
          this._scanBindings([btn.dataset.ieee], { tries: this._retryCount }).finally(() => {
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
      }
    }
    _saveFloorplan() {
      try {
        localStorage.setItem(
          this._fpStorageKey(),
          JSON.stringify({ imageUrl: this._fpImageUrl, positions: this._fpPositions })
        );
      } catch (e) {
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
      this._ensureHealthData();
      const urlInput = this._q("#fp-image-url");
      if (urlInput && document.activeElement !== urlInput) urlInput.value = this._fpImageUrl || "";
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      this._fpEdgesLayer = null;
      this._fpNodesLayer = null;
      if (!this._fpImageUrl || !this._fpImageSize) {
        empty.style.display = "flex";
        empty.textContent = this._fpImageUrl ? "Loading image\u2026" : "Set a floor plan image URL above to get started.";
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
        href: this._fpImageUrl
      });
      bg.setAttributeNS("http://www.w3.org/1999/xlink", "href", this._fpImageUrl);
      svg.appendChild(bg);
      this._fpEdgesLayer = this._svgEl("g");
      this._fpNodesLayer = this._svgEl("g");
      svg.appendChild(this._fpEdgesLayer);
      svg.appendChild(this._fpNodesLayer);
      const placedIeees = Object.keys(this._fpPositions).filter(
        (ieee) => this._devices.some((d) => d.ieee === ieee)
      );
      this._fpNodeEls = /* @__PURE__ */ new Map();
      placedIeees.forEach((ieee) => this._renderFpNode(ieee));
      this._renderFpEdges(placedIeees);
      this._renderFpUnplacedList();
      const placedDevices = placedIeees.map((ieee) => this._devices.find((d) => d.ieee === ieee)).filter(Boolean);
      this._toggleRoleLegend("#fp-role-legend", placedDevices);
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
      if (this._isMultiRoleDevice(d)) g.appendChild(this._roleBadgeEl(r));
      g.addEventListener("pointerdown", (e) => this._onFpNodePointerDown(e, ieee));
      this._fpNodesLayer.appendChild(g);
      this._fpNodeEls.set(ieee, g);
    }
    _renderFpEdges(placedIeees) {
      if (!this._fpEdgesLayer) return;
      while (this._fpEdgesLayer.firstChild) this._fpEdgesLayer.removeChild(this._fpEdgesLayer.firstChild);
      const placedSet = new Set(placedIeees);
      const bindings = this._graphBindings().filter(
        (b) => !b.isGroup && placedSet.has(b.sourceIeee) && placedSet.has(b.targetIeee)
      );
      const pairCount = /* @__PURE__ */ new Map();
      bindings.forEach((b) => {
        const pairKey = `${b.sourceIeee}->${b.targetIeee}`;
        const idx = pairCount.get(pairKey) || 0;
        pairCount.set(pairKey, idx + 1);
        const line = this._svgEl("path", {
          class: this._edgeClassFor(b),
          "data-id": b.id,
          "data-from": b.sourceIeee,
          "data-to": b.targetIeee,
          "data-offset": idx,
          stroke: clusterColor(b.clusterId),
          fill: "none",
          "marker-end": "url(#fp-arrow)"
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
      const nodeRadius = this._fpNodeRadius();
      this._fpEdgesLayer.querySelectorAll(".edge").forEach((el) => {
        const fromFrac = this._fpPositions[el.dataset.from];
        const toFrac = this._fpPositions[el.dataset.to];
        if (!fromFrac || !toFrac) return;
        const from = { x: fromFrac.x * this._fpImageSize.w, y: fromFrac.y * this._fpImageSize.h };
        const to = { x: toFrac.x * this._fpImageSize.w, y: toFrac.y * this._fpImageSize.h };
        const offset = Number(el.dataset.offset || 0);
        const dx = to.x - from.x, dy = to.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist, ny = dx / dist;
        const bend = offset * 18;
        const mx = (from.x + to.x) / 2 + nx * bend;
        const my = (from.y + to.y) / 2 + ny * bend;
        const tdx = to.x - mx, tdy = to.y - my;
        const tdist = Math.hypot(tdx, tdy) || 1;
        const targetGap = nodeRadius + 3;
        const ex = to.x - tdx / tdist * targetGap;
        const ey = to.y - tdy / tdist * targetGap;
        el.setAttribute("d", `M ${from.x} ${from.y} Q ${mx} ${my} ${ex} ${ey}`);
      });
    }
    _renderFpUnplacedList() {
      const list = this._q("#fp-unplaced-list");
      if (!list) return;
      if (!this._loaded) {
        list.innerHTML = `<span class="muted">Loading devices\u2026</span>`;
        return;
      }
      const placed = new Set(Object.keys(this._fpPositions));
      const unplaced = this._devices.filter((d) => !placed.has(d.ieee));
      if (!unplaced.length) {
        list.innerHTML = `<span class="muted">All devices placed.</span>`;
        return;
      }
      list.innerHTML = unplaced.map((d) => `<div class="fp-chip" data-ieee="${escapeHtml(d.ieee)}">${escapeHtml(this._deviceLabel(d))}</div>`).join("");
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
        return;
      }
      const svg = this._q("#fp-svg");
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
      this._fpPositions[ieee] = {
        x: clamp(svgPt.x / this._fpImageSize.w, 0, 1),
        y: clamp(svgPt.y / this._fpImageSize.h, 0, 1)
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
        startClient: { x: e.clientX, y: e.clientY }
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
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      const w = clamp(vb.w / factor, 100, 2e4);
      const h = clamp(vb.h / factor, 60, 2e4);
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
    // -------------------------------------------------------------------
    // Capability Explorer tab
    // -------------------------------------------------------------------
    _renderCapabilityExplorer() {
      const el = this._q("#view-capexplorer");
      if (!el) return;
      if (!el.dataset.wired) {
        el.dataset.wired = "1";
        el.innerHTML = `
        <div class="capexp-strip">Built from real scans shared by ZHA users \u2014 <span id="capexp-strip-count">\u2026</span>
          devices confirmed so far. Every scan you share adds to it.</div>
        <p class="capexp-mission">Find out what a device can actually do \u2014 before you buy it or wire it up.</p>
        <p class="hint" style="margin-top:0">Verified from real scans, not manufacturer claims \u2014 nothing about your
          devices (IEEE addresses, entities, areas, names) ever leaves this browser. Only covers devices someone's
          already scanned and shared, so a gap here means nobody's confirmed it yet, not that it doesn't exist. See
          the <a href="https://github.com/${CAPABILITY_DB_REPO}" target="_blank" rel="noopener">zigbee-capabilities</a>
          database.</p>
        <div id="capexp-discoveries"></div>
        <div class="capexp-modes">
          <button class="capexp-mode-btn active" data-capexp-mode="explore">
            <span class="capexp-mode-title">Explore my devices</span>
            <span class="capexp-mode-sub">What can this device do?</span>
          </button>
          <button class="capexp-mode-btn" data-capexp-mode="search">
            <span class="capexp-mode-title">Search database</span>
            <span class="capexp-mode-sub">Which device should I buy for X?</span>
          </button>
          <button class="capexp-mode-btn" data-capexp-mode="compare">
            <span class="capexp-mode-title">Compare firmware</span>
            <span class="capexp-mode-sub">What changed in this update?</span>
          </button>
        </div>
        <div class="capexp-status-row">
          <div id="capexp-status" class="hint"></div>
          <button class="btn btn-small" id="capexp-refresh">\u27F3 Refresh</button>
        </div>
        <div id="capexp-body"></div>`;
        this._qa(".capexp-modes .capexp-mode-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (btn.dataset.capexpMode === this._capExpMode) return;
            this._capExpMode = btn.dataset.capexpMode;
            this._qa(".capexp-modes .capexp-mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
            this._renderCapExpBody();
          });
        });
        this._q("#capexp-refresh").addEventListener("click", () => this._capExpLoadIndex(true));
        this._capExpLoadIndex();
      }
      this._renderCapExpBody();
    }
    _capExpLoadIndex(force = false) {
      if (this._capExpLoading) return;
      this._capExpLoading = true;
      this._capExpError = null;
      this._renderCapExpBody();
      fetchCapabilityIndex({ force }).then((index) => {
        this._capExpIndex = index;
      }).catch((err) => {
        this._capExpError = err && err.message || String(err);
      }).finally(() => {
        this._capExpLoading = false;
        this._renderCapExpBody();
        if (this._explodedDeviceIeee && this._q("#dialog").classList.contains("open")) {
          const d = this._devices.find((x) => x.ieee === this._explodedDeviceIeee);
          if (d) this._renderExplodedView(d);
        }
      });
    }
    _renderCapExpBody() {
      const statusEl = this._q("#capexp-status");
      const bodyEl = this._q("#capexp-body");
      if (!statusEl || !bodyEl) return;
      if (this._capExpLoading && !this._capExpIndex) {
        statusEl.textContent = "Loading community capability data\u2026";
        bodyEl.innerHTML = `<p class="muted">Loading\u2026</p>`;
        bodyEl.dataset.capexpBodyMode = "";
        return;
      }
      if (this._capExpError && !this._capExpIndex) {
        statusEl.innerHTML = `<span class="capexp-error">Couldn't load community data: ${escapeHtml(
          this._capExpError
        )}</span>`;
        bodyEl.innerHTML = `<p class="muted">Try Refresh above, or check your connection.</p>`;
        bodyEl.dataset.capexpBodyMode = "";
        return;
      }
      if (!this._capExpIndex) {
        statusEl.textContent = "";
        bodyEl.innerHTML = "";
        bodyEl.dataset.capexpBodyMode = "";
        return;
      }
      statusEl.textContent = `${this._capExpIndex.length} confirmed endpoint/firmware record${this._capExpIndex.length === 1 ? "" : "s"} from the community database${this._capExpLoading ? " (refreshing\u2026)" : ""}`;
      const stripCountEl = this._q("#capexp-strip-count");
      if (stripCountEl) {
        const uniqueDevices = new Set(this._capExpIndex.map((e) => `${e.manufacturer_slug}|${e.model_slug}`));
        stripCountEl.textContent = uniqueDevices.size;
      }
      const discoveriesEl = this._q("#capexp-discoveries");
      if (discoveriesEl) {
        const discoveries = interestingDiscoveries(this._capExpIndex);
        discoveriesEl.innerHTML = discoveries.length ? `<div class="capexp-discoveries">
             <div class="capexp-discoveries-label">Interesting so far</div>
             <ul class="capexp-discoveries-list">${discoveries.map((d) => `<li>${escapeHtml(d.text)}</li>`).join("")}</ul>
           </div>` : "";
      }
      if (this._capExpMode === "explore") {
        bodyEl.dataset.capexpBodyMode = "explore";
        this._renderCapExpExplore(bodyEl);
      } else if (this._capExpMode === "search") {
        if (bodyEl.dataset.capexpBodyMode !== "search") {
          bodyEl.dataset.capexpBodyMode = "search";
          this._buildCapExpSearchShell(bodyEl);
        }
        this._capExpRunSearch();
      } else if (this._capExpMode === "compare") {
        bodyEl.dataset.capexpBodyMode = "compare";
        this._renderCapExpCompare(bodyEl);
      }
    }
    // Live firmware for a local device, in the same format community
    // submissions use (Basic cluster sw_build_id, e.g. "1.0.8") — never
    // guessed from Home Assistant's device-registry sw_version, which is
    // frequently a different ZCL concept entirely (a raw OTA file version
    // like "0x00001004"). Prefers a scan_device result from this session
    // (guaranteed the right format); only falls back to the registry value
    // when nothing's been scanned this session, and even then the caller
    // (newestFirmwareGap) only trusts it when it happens to exact-match a
    // firmware string the community has already confirmed.
    _capExpLocalFirmwareFor(device) {
      const prefix = `${normIeee(device.ieee)}:`;
      for (const [key, entry] of this._commandScans.entries()) {
        if (key.startsWith(prefix) && entry.status === "done" && entry.scan) {
          const ep = Number(key.slice(prefix.length));
          const record = this._buildCapabilityRecord(device, ep, entry.scan);
          if (record && record.identity && record.identity.sw_build_id) return record.identity.sw_build_id;
        }
      }
      const reg = this._haDeviceRegistryEntry(device.ieee);
      return reg && reg.sw_version || null;
    }
    _capExpFormatDate(iso) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(void 0, { month: "short", year: "numeric" });
    }
    _capExpConfidenceClass(label) {
      return label.toLowerCase().replace(/[^a-z]+/g, "-");
    }
    _capExpFwGapSummary(diff) {
      const added = [];
      const removed = [];
      diff.forEach((row) => {
        added.push(...row.addedCommands);
        removed.push(...row.removedCommands);
      });
      const parts = [];
      if (added.length) parts.push(`gained ${added.slice(0, 3).join(", ")}`);
      if (removed.length) parts.push(`lost ${removed.slice(0, 3).join(", ")}`);
      return parts.length ? parts.join(" and ") : "changed some reporting data";
    }
    // ---- Mode 2: Explore My Devices ----
    _renderCapExpExplore(bodyEl) {
      const devices = this._devices || [];
      const matches = matchLocalDevices(devices, this._capExpIndex);
      const matchedIeees = new Set(matches.map((m) => m.device.ieee));
      const noMatch = devices.filter((d) => !matchedIeees.has(d.ieee));
      const matchedHtml = matches.length ? matches.map((m) => {
        const key = `${m.manufacturerSlug}|${m.modelSlug}`;
        const expanded = this._capExpExpanded.has(key);
        const fw = firmwareVersions(m.entries);
        const fwLabel = fw.length ? fw.map((f) => f === null ? "unknown" : f).join(", ") : "unknown";
        const totalScans = m.entries.reduce((sum, e) => sum + (e.scan_count || 0), 0);
        const capGroups = groupCapabilitiesByOutcome(m.entries);
        const reports = m.entries.some((entry) => reportsState(entry));
        const lastSeenTimes = m.entries.map((e) => e.last_seen).filter(Boolean).sort();
        const lastSeen = lastSeenTimes.length ? lastSeenTimes[lastSeenTimes.length - 1] : null;
        const labels = m.entries.map((e) => confidenceLabel(e));
        const overallConfidence = labels.includes("Conflicting evidence") ? "Conflicting evidence" : labels.includes("Single observation") ? "Single observation" : labels.includes("Repeated observation") ? "Repeated observation" : "Strong evidence";
        const localFirmware = this._capExpLocalFirmwareFor(m.device);
        const gap = localFirmware ? newestFirmwareGap(localFirmware, m.entries) : null;
        return `
              <div class="capexp-device-card">
                <div class="capexp-device-header" data-capexp-toggle="${escapeHtml(key)}">
                  <span class="capexp-device-name">${escapeHtml(this._deviceLabel(m.device))}</span>
                  <span class="muted">${escapeHtml(m.device.manufacturer || "\u2014")} \xB7 ${escapeHtml(
          m.device.model || "\u2014"
        )}</span>
                  <span class="capexp-confidence-badge capexp-confidence-${this._capExpConfidenceClass(
          overallConfidence
        )}">${escapeHtml(overallConfidence)}</span>
                  <span class="capexp-chevron">${expanded ? "\u25BE" : "\u25B8"}</span>
                </div>
                <div class="capexp-device-summary muted">
                  Confirmed by ${totalScans} scan${totalScans === 1 ? "" : "s"} across ${fw.length} firmware
                  version${fw.length === 1 ? "" : "s"} (${escapeHtml(fwLabel)})${lastSeen ? ` \xB7 last seen ${escapeHtml(this._capExpFormatDate(lastSeen))}` : ""}
                </div>
                ${capGroups.length ? `<div class="capexp-cap-label">Supports</div>
                       <div class="capexp-cap-groups">${capGroups.map(
          (g) => `
                           <div class="capexp-cap-group">
                             <span class="capexp-cap-group-label">${escapeHtml(g.label)}</span>
                             ${g.items.length ? `<div class="capexp-cap-tags">${g.items.map(
            (i) => `<span class="capexp-tag${i.firmwareDependent ? " capexp-tag-fwdep" : ""}">${escapeHtml(i.name)}${i.firmwareDependent ? " \xB7 firmware-dependent" : ""}</span>`
          ).join("")}</div>` : ""}
                           </div>`
        ).join("")}</div>` : `<p class="muted">No confirmed commands or reporting clusters recorded yet.</p>`}
                <div class="capexp-report-line muted">Reports state: ${reports ? "yes" : "no"}</div>
                ${gap ? `<div class="capexp-fwgap-alert">Your device is on ${escapeHtml(
          localFirmware
        )}. The community has also confirmed ${escapeHtml(
          gap.newestFirmware
        )} for this model${gap.diff && gap.diff.length ? `, which ${this._capExpFwGapSummary(gap.diff)}` : ""}. Nobody's scanned anything newer yet \u2014 share a scan if you are.</div>` : ""}
                ${expanded ? this._capExpDeviceDetailHtml(m.entries) : ""}
              </div>`;
      }).join("") : `<p class="muted">None of your devices match anything in the community database yet.</p>`;
      const noMatchHtml = noMatch.length ? `
        <div class="capexp-section-title">No community data yet (${noMatch.length})</div>
        <p class="hint">Scan one of these and share the result \u2014 you'd be the first confirmed data point for it.</p>
        <div class="capexp-nomatch-list">
          ${noMatch.map(
        (d) => `
            <div class="capexp-nomatch-row">
              <span>${escapeHtml(this._deviceLabel(d))} <span class="muted">(${escapeHtml(
          d.manufacturer || "\u2014"
        )} \xB7 ${escapeHtml(d.model || "\u2014")})</span></span>
              <button class="btn btn-small capexp-scan-btn" data-ieee="${escapeHtml(d.ieee)}">Scan and share</button>
            </div>`
      ).join("")}
        </div>` : "";
      bodyEl.innerHTML = `
      <div class="capexp-section-title">Devices with confirmed capabilities (${matches.length})</div>
      <div class="capexp-device-list">${matchedHtml}</div>
      ${noMatchHtml}`;
      this._qa(".capexp-device-header").forEach((h) => {
        h.addEventListener("click", () => {
          const key = h.dataset.capexpToggle;
          if (this._capExpExpanded.has(key)) this._capExpExpanded.delete(key);
          else this._capExpExpanded.add(key);
          this._renderCapExpBody();
        });
      });
      this._qa(".capexp-scan-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const device = this._devices.find((x) => x.ieee === btn.dataset.ieee);
          if (device) this._openDeviceExplodedView(device);
        });
      });
    }
    _capExpDeviceDetailHtml(entries) {
      return `
      <div class="capexp-device-detail">
        ${entries.map((entry) => {
        const cmds = confirmedCommands(entry);
        return `
              <div class="capexp-entry">
                <div class="capexp-entry-title">Endpoint ${entry.endpoint ?? "?"} \xB7 firmware ${escapeHtml(
          entry.firmware || "unknown"
        )} \xB7 ${entry.scan_count || 0} scan${(entry.scan_count || 0) === 1 ? "" : "s"}</div>
                ${cmds.length ? `<div class="capexp-cap-tags">${cmds.map(
          (c) => `<span class="capexp-tag${c.conflicting ? " capexp-tag-conflict" : ""}">${escapeHtml(
            c.name
          )}${c.conflicting ? " \u26A0" : ""}</span>`
        ).join("")}</div>` : `<p class="muted">No confirmed commands.</p>`}
              </div>`;
      }).join("")}
      </div>`;
    }
    // ---- Mode 1: Search Community Database ----
    // Every distinct value the database actually has for a given facet,
    // sorted for a predictable dropdown. Pulling options live from
    // _capExpIndex (rather than a fixed list) means the dropdown can never
    // offer a choice that returns zero results, and it grows automatically
    // as more devices are contributed.
    _capExpFacetValues(field) {
      const idx = this._capExpIndex || [];
      const set = /* @__PURE__ */ new Set();
      if (field === "manufacturer") idx.forEach((e) => e.manufacturer && set.add(e.manufacturer));
      else if (field === "model") idx.forEach((e) => e.model && set.add(e.model));
      else if (field === "firmware") idx.forEach((e) => set.add(e.firmware || "unknown"));
      else if (field === "cluster") {
        idx.forEach((e) => Object.values(e.clusters || {}).forEach((c) => c.name && set.add(c.name)));
      } else if (field === "command") {
        idx.forEach(
          (e) => Object.values(e.clusters || {}).forEach(
            (c) => (c.commands_received || []).forEach((row) => {
              if (row.present === true && row.name) set.add(row.name);
            })
          )
        );
      } else if (field === "attribute") {
        idx.forEach(
          (e) => Object.values(e.clusters || {}).forEach(
            (c) => (c.attributes_confirmed || []).forEach((a) => {
              if (a.name) set.add(a.name);
            })
          )
        );
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    }
    // Canned starting points grounded in the same facets the form itself
    // exposes. Resolved against the live index so the chip's value is
    // always one of the dropdown's real options, not a guessed substring.
    _capExpSearchExamples() {
      const resolve = (needle) => {
        const opts = this._capExpFacetValues("cluster");
        return opts.find((v) => v.toLowerCase().includes(needle)) || "";
      };
      return [
        { label: "Reports occupancy", field: "cluster", value: resolve("occupancy") },
        { label: "Reports illuminance", field: "cluster", value: resolve("illuminance") },
        { label: "Supports on/off control", field: "cluster", value: resolve("on/off") },
        { label: "Supports dimming", field: "cluster", value: resolve("level") },
        { label: "Supports color control", field: "cluster", value: resolve("color") }
      ].filter((ex) => ex.value);
    }
    _capExpSearchSelectHtml(field, placeholder) {
      const s = this._capExpSearch;
      const opts = this._capExpFacetValues(field);
      return `<select id="capexp-s-${field}" data-field="${field}">
        <option value="">${escapeHtml(placeholder)}</option>
        ${opts.map(
        (v) => `<option value="${escapeHtml(v)}" ${s[field] === v ? "selected" : ""}>${escapeHtml(v)}</option>`
      ).join("")}
      </select>`;
    }
    _buildCapExpSearchShell(bodyEl) {
      const examples = this._capExpSearchExamples();
      bodyEl.innerHTML = `
      <p class="hint" style="margin-top:0">Try one of these, or pick exact filters from what's in the database
        below \u2014 manufacturer, model, cluster, command, attribute, or firmware.</p>
      ${examples.length ? `<div class="capexp-search-examples">
              ${examples.map(
        (ex) => `<button type="button" class="chip capexp-search-example" data-field="${escapeHtml(
          ex.field
        )}" data-value="${escapeHtml(ex.value)}">${escapeHtml(ex.label)}</button>`
      ).join("")}
            </div>` : ""}
      <div class="capexp-search-form">
        ${this._capExpSearchSelectHtml("manufacturer", "All manufacturers")}
        ${this._capExpSearchSelectHtml("model", "All models")}
        ${this._capExpSearchSelectHtml("cluster", "All clusters")}
        ${this._capExpSearchSelectHtml("command", "All commands")}
        ${this._capExpSearchSelectHtml("attribute", "All attributes")}
        ${this._capExpSearchSelectHtml("firmware", "All firmware")}
      </div>
      <div id="capexp-search-count" class="hint"></div>
      <div class="table-scroll">
        <table class="bindings-table">
          <thead><tr>
            <th>Manufacturer</th><th>Model</th><th>Firmware</th><th>Endpoint</th><th>Confirmed commands</th>
            <th>Not reported</th><th>Scans</th><th>Confidence</th>
          </tr></thead>
          <tbody id="capexp-search-results"></tbody>
        </table>
      </div>`;
      ["manufacturer", "model", "cluster", "command", "attribute", "firmware"].forEach((f) => {
        this._q(`#capexp-s-${f}`).addEventListener("change", (e) => {
          this._capExpSearch[f] = e.target.value;
          this._capExpRunSearch();
        });
      });
      this._qa(".capexp-search-example").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._capExpSearch = {
            manufacturer: "",
            model: "",
            cluster: "",
            command: "",
            attribute: "",
            firmware: "",
            [btn.dataset.field]: btn.dataset.value
          };
          ["manufacturer", "model", "cluster", "command", "attribute", "firmware"].forEach((f) => {
            const select = this._q(`#capexp-s-${f}`);
            if (select) select.value = this._capExpSearch[f];
          });
          this._capExpRunSearch();
        });
      });
    }
    _capExpRunSearch() {
      const tbody = this._q("#capexp-search-results");
      const countEl = this._q("#capexp-search-count");
      if (!tbody || !this._capExpIndex) return;
      const all = searchIndex(this._capExpIndex, this._capExpSearch);
      const results = all.slice(0, 200);
      if (countEl) {
        countEl.textContent = all.length > 200 ? `Showing first 200 of ${all.length} matching records \u2014 narrow your search to see more.` : `${all.length} matching record${all.length === 1 ? "" : "s"}`;
      }
      if (!results.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="muted">No matching records \u2014 that's likely a coverage gap, not proof this device can't do it. Nobody's scanned and shared it yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = results.map((entry) => {
        const cmds = confirmedCommands(entry).map((c) => c.name);
        const notReported = notReportedCommands(entry).map((c) => c.name);
        const confidence = confidenceLabel(entry);
        return `<tr>
          <td>${escapeHtml(entry.manufacturer || "\u2014")}</td>
          <td>${escapeHtml(entry.model || "\u2014")}</td>
          <td>${escapeHtml(entry.firmware || "unknown")}</td>
          <td>${entry.endpoint ?? "\u2014"}</td>
          <td>${cmds.length ? escapeHtml(cmds.join(", ")) : `<span class="muted">none confirmed</span>`}</td>
          <td>${notReported.length ? escapeHtml(notReported.join(", ")) : `<span class="muted">\u2014</span>`}</td>
          <td>${entry.scan_count || 0}</td>
          <td><span class="capexp-confidence-badge capexp-confidence-${this._capExpConfidenceClass(
          confidence
        )}">${escapeHtml(confidence)}</span></td>
        </tr>`;
      }).join("");
    }
    // ---- Mode 3: Compare Firmware ----
    _renderCapExpCompare(bodyEl) {
      const c = this._capExpCompare;
      const manufacturers = [...new Set(this._capExpIndex.map((e) => e.manufacturer).filter(Boolean))].sort();
      const modelsForManufacturer = c.manufacturer ? [
        ...new Set(
          this._capExpIndex.filter((e) => e.manufacturer === c.manufacturer).map((e) => e.model).filter(Boolean)
        )
      ].sort() : [];
      const entriesForModel = c.manufacturer && c.model ? this._capExpIndex.filter((e) => e.manufacturer === c.manufacturer && e.model === c.model) : [];
      const fwOptions = firmwareVersions(entriesForModel).map((f) => f === null ? "unknown" : f);
      const pickEntry = (fw) => entriesForModel.filter((e) => (e.firmware || "unknown") === fw).sort((a, b) => Object.keys(b.clusters || {}).length - Object.keys(a.clusters || {}).length)[0];
      const entryA = c.firmwareA ? pickEntry(c.firmwareA) : null;
      const entryB = c.firmwareB ? pickEntry(c.firmwareB) : null;
      let diffHtml = `<p class="muted">Pick a manufacturer, model, and two firmware versions to compare.</p>`;
      if (entryA && entryB) {
        if (c.firmwareA === c.firmwareB) {
          diffHtml = `<p class="muted">Pick two different firmware versions to compare.</p>`;
        } else {
          const diff = diffFirmware(entryA, entryB);
          diffHtml = diff.length ? diff.map((row) => {
            if (row.onlyIn) {
              return `<div class="capexp-diff-row"><strong>${escapeHtml(
                row.name
              )}</strong> \u2014 cluster only confirmed on firmware ${row.onlyIn === "A" ? escapeHtml(c.firmwareA) : escapeHtml(c.firmwareB)}, not scanned on the other.</div>`;
            }
            const parts = [];
            if (row.addedCommands.length) parts.push(`+ ${row.addedCommands.map((n) => escapeHtml(n)).join(", ")}`);
            if (row.removedCommands.length)
              parts.push(`\u2212 ${row.removedCommands.map((n) => escapeHtml(n)).join(", ")}`);
            row.attributeChanges.forEach(
              (a) => parts.push(`${a.change === "added" ? "+attr " : "\u2212attr "}${escapeHtml(a.name)}`)
            );
            return `<div class="capexp-diff-row"><strong>${escapeHtml(row.name)}</strong> \u2014 ${parts.join(
              " \xB7 "
            )}</div>`;
          }).join("") : `<p class="muted">No confirmed differences between these two firmware versions.</p>`;
        }
      }
      bodyEl.innerHTML = `
      <p class="hint" style="margin-top:0">Pick a manufacturer, model, and two firmware versions the community has
        confirmed, to see exactly what changed between them.</p>
      <div class="capexp-compare-form">
        <label>Manufacturer
          <select id="capexp-c-manufacturer">
            <option value="">\u2014 choose \u2014</option>
            ${manufacturers.map((m) => `<option value="${escapeHtml(m)}" ${m === c.manufacturer ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}
          </select>
        </label>
        <label>Model
          <select id="capexp-c-model" ${modelsForManufacturer.length ? "" : "disabled"}>
            <option value="">\u2014 choose \u2014</option>
            ${modelsForManufacturer.map((m) => `<option value="${escapeHtml(m)}" ${m === c.model ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}
          </select>
        </label>
        <label>Firmware A
          <select id="capexp-c-fwa" ${fwOptions.length ? "" : "disabled"}>
            <option value="">\u2014 choose \u2014</option>
            ${fwOptions.map((f) => `<option value="${escapeHtml(f)}" ${f === c.firmwareA ? "selected" : ""}>${escapeHtml(f)}</option>`).join("")}
          </select>
        </label>
        <label>Firmware B
          <select id="capexp-c-fwb" ${fwOptions.length ? "" : "disabled"}>
            <option value="">\u2014 choose \u2014</option>
            ${fwOptions.map((f) => `<option value="${escapeHtml(f)}" ${f === c.firmwareB ? "selected" : ""}>${escapeHtml(f)}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="capexp-diff-wrap">${diffHtml}</div>`;
      this._q("#capexp-c-manufacturer").addEventListener("change", (e) => {
        this._capExpCompare = { manufacturer: e.target.value, model: "", firmwareA: "", firmwareB: "" };
        this._renderCapExpBody();
      });
      this._q("#capexp-c-model").addEventListener("change", (e) => {
        this._capExpCompare.model = e.target.value;
        this._capExpCompare.firmwareA = "";
        this._capExpCompare.firmwareB = "";
        this._renderCapExpBody();
      });
      this._q("#capexp-c-fwa").addEventListener("change", (e) => {
        this._capExpCompare.firmwareA = e.target.value;
        this._renderCapExpBody();
      });
      this._q("#capexp-c-fwb").addEventListener("change", (e) => {
        this._capExpCompare.firmwareB = e.target.value;
        this._renderCapExpBody();
      });
    }
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
            <select id="adv-src-ep"><option value="">Loading\u2026</option></select>
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
            <select id="adv-dst-ep"><option value="">Loading\u2026</option></select>
          </label>
          <label>Cluster
            <select id="adv-cluster"><option value="">\u2014 zha-toolkit default \u2014</option></select>
          </label>
          <label id="adv-cluster-custom-wrap" style="display:none">Custom cluster ID
            <input type="text" id="adv-cluster-custom" placeholder="e.g. 0x0000 or 0">
          </label>
          <p id="adv-cluster-custom-hint" class="hint" style="display:none">Expert option. Most devices don't
            expose this cluster for binding, that's why it's not in the list above \u2014 an accepted bind doesn't
            guarantee the device will actually behave as expected. This binding also won't appear on the Map/Floor
            Plan graphs by default, since it isn't a normal output cluster on this device, enable "Show
            reporting-only bindings" there to see it.</p>
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
      this._q("#adv-cluster").addEventListener("change", () => this._advUpdateCustomClusterState());
      this._q("#adv-cluster-custom").addEventListener("input", () => this._advUpdateCustomClusterState());
      const getClusterIds = () => {
        const v = this._q("#adv-cluster").value;
        if (v === "__custom__") {
          const n = parseClusterIdInput(this._q("#adv-cluster-custom").value);
          return n == null ? [] : [n];
        }
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
        this._setStatus("info", "Binding\u2026", 0);
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
          await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan));
          this._advRenderSourceBindings();
          this._advRenderTargetBindings();
          const bindTarget = type === "group" ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) } : { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint };
          const canVerify = clusters.length === 1 && opts.endpoint != null && (bindTarget.isGroup || bindTarget.endpoint != null);
          if (canVerify) {
            const outcome = this._verifyBindOutcome(sourceIeee, opts.endpoint, clusters[0], bindTarget);
            this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? void 0 : 0);
          } else {
            this._setStatus(
              callErr ? "error" : "success",
              callErr ? callErr.message || String(callErr) : "Bind command sent.",
              callErr ? 0 : void 0
            );
          }
        }
      });
      this._q("#adv-unbind").addEventListener("click", async () => {
        const sourceIeee = this._q("#adv-source").value;
        const type = this._q("#adv-target-type").value;
        const clusters = getClusterIds();
        const opts = getOpts();
        this._setStatus("info", "Unbinding\u2026", 0);
        let targetIeeeForRescan = null;
        if (type === "coordinator") targetIeeeForRescan = sourceIeee;
        else if (type === "device") targetIeeeForRescan = this._q("#adv-target-device").value;
        const coord = this._coordinatorIeee();
        const beforeCoordList = type === "coordinator" ? this._rawBindings().filter(
          (b) => normIeee(b.sourceIeee) === normIeee(sourceIeee) && !b.isGroup && normIeee(b.targetIeee) === normIeee(coord) && (opts.endpoint == null || Number(b.sourceEndpoint) === Number(opts.endpoint)) && (clusters.length === 0 || clusters.includes(b.clusterId))
        ).map((b) => ({
          clusterId: b.clusterId,
          target: { isGroup: false, ieee: b.targetIeee, endpoint: b.targetEndpoint }
        })) : null;
        const bindTarget = type === "group" ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) } : type === "device" ? { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint } : null;
        const before = bindTarget && clusters.length === 1 && opts.endpoint != null && (bindTarget.isGroup || bindTarget.endpoint != null) ? this._bindingPresent(sourceIeee, opts.endpoint, clusters[0], bindTarget) : null;
        let callErr = null;
        try {
          if (type === "group") {
            const groupId = Number(this._q("#adv-target-group").value);
            await this._api.unbindGroup(sourceIeee, groupId, clusters, opts);
          } else if (type === "coordinator") {
            await this._api.callToolkit("unbind_coordinator", {
              ieee: sourceIeee,
              ...clusters.length ? { cluster: clusters } : {}
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
            this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? void 0 : 0);
          } else if (before !== null) {
            const outcome = this._verifyUnbindOutcome(before, sourceIeee, opts.endpoint, clusters[0], bindTarget);
            this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? void 0 : 0);
          } else {
            this._setStatus(
              callErr ? "error" : "success",
              callErr ? callErr.message || String(callErr) : "Unbind command sent.",
              callErr ? 0 : void 0
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
      const sortedDevices = [...this._devices].sort(
        (a, b) => this._deviceLabel(a).localeCompare(this._deviceLabel(b), void 0, { sensitivity: "base" })
      );
      const options = sortedDevices.map((d) => `<option value="${d.ieee}">${escapeHtml(this._deviceLabel(d))}</option>`).join("");
      src.innerHTML = options;
      tgtDev.innerHTML = options;
      tgtGroup.innerHTML = [...this._groups].sort((a, b) => (a.name || "").localeCompare(b.name || "", void 0, { sensitivity: "base" })).map((g) => `<option value="${g.group_id}">${escapeHtml(g.name)} (${g.group_id})</option>`).join("");
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
      const reqId = this._advSourceReqId = (this._advSourceReqId || 0) + 1;
      sel.innerHTML = `<option value="">Loading\u2026</option>`;
      let endpoints = [];
      let failed = false;
      try {
        endpoints = await this._advDeviceEndpoints(ieee);
      } catch (err) {
        failed = true;
      }
      if (reqId !== this._advSourceReqId) return;
      sel.innerHTML = failed ? `<option value="">(failed to load)</option>` : endpoints.length ? endpoints.map((ep) => `<option value="${ep}">${ep}</option>`).join("") : `<option value="">(none found)</option>`;
      this._advPopulateClusterOptions();
      this._advRenderSourceBindings();
    }
    async _advPopulateTargetEndpoints() {
      const sel = this._q("#adv-dst-ep");
      const ieee = this._q("#adv-target-device").value;
      if (!sel || !ieee) return;
      const reqId = this._advTargetReqId = (this._advTargetReqId || 0) + 1;
      sel.innerHTML = `<option value="">Loading\u2026</option>`;
      let endpoints = [];
      let failed = false;
      try {
        endpoints = await this._advDeviceEndpoints(ieee);
      } catch (err) {
        failed = true;
      }
      if (reqId !== this._advTargetReqId) return;
      sel.innerHTML = failed ? `<option value="">(failed to load)</option>` : endpoints.length ? endpoints.map((ep) => `<option value="${ep}">${ep}</option>`).join("") : `<option value="">(none found)</option>`;
      this._advRenderTargetBindings();
    }
    /** Cluster dropdown = the selected source endpoint's OUTPUT clusters (the
     *  only clusters a bind can normally reference), plus a "Custom cluster
     *  ID…" escape hatch for edge cases like an IKEA controller's
     *  genBasic/0x0000 group-binding trick, which zha_toolkit's bind_group
     *  will happily attempt even though it's not a normal output cluster —
     *  see _advUpdateCustomClusterState(). */
    _advPopulateClusterOptions() {
      const clusterSel = this._q("#adv-cluster");
      const ieee = this._q("#adv-source").value;
      const ep = Number(this._q("#adv-src-ep").value);
      if (!clusterSel) return;
      const clusters = this._clusterCache.get(ieee) || [];
      const outClusters = uniqueClusters(clusters.filter((c) => c.type === "out" && c.endpoint_id === ep));
      const opts = [`<option value="">\u2014 zha-toolkit default \u2014</option>`].concat(outClusters.map((c) => `<option value="${c.id}">${escapeHtml(clusterName(c.id))} (${hex4(c.id)})</option>`)).concat([`<option value="__custom__">Custom cluster ID\u2026</option>`]);
      clusterSel.innerHTML = opts.join("");
      const customInput = this._q("#adv-cluster-custom");
      if (customInput) customInput.value = "";
      this._advUpdateCustomClusterState();
    }
    /** Shows/hides the custom-cluster input + warning based on the dropdown
     *  selection, and disables Bind/Unbind while a custom cluster is selected
     *  but not yet a valid id — see parseClusterIdInput(). */
    _advUpdateCustomClusterState() {
      const isCustom = this._q("#adv-cluster").value === "__custom__";
      const wrap = this._q("#adv-cluster-custom-wrap");
      const hint = this._q("#adv-cluster-custom-hint");
      if (wrap) wrap.style.display = isCustom ? "" : "none";
      if (hint) hint.style.display = isCustom ? "" : "none";
      const valid = !isCustom || parseClusterIdInput(this._q("#adv-cluster-custom").value) != null;
      const bindBtn = this._q("#adv-bind");
      const unbindBtn = this._q("#adv-unbind");
      if (bindBtn) bindBtn.disabled = !valid;
      if (unbindBtn) unbindBtn.disabled = !valid;
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
            btn.textContent = "Scanning\u2026";
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
      wrap.innerHTML = this._advBindingRows(rows, "source") + `<p class="hint" style="margin-top:6px;">Based on devices scanned so far \u2014 run a full scan for complete results.</p>`;
    }
    /** Renders a list of binding rows; `otherEnd` is "target" (for the source panel) or "source" (for the target panel). */
    _advBindingRows(rows, otherEnd) {
      if (!rows.length) return `<p class="advanced-empty">No matching bindings found.</p>`;
      return rows.map((b) => {
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
      }).join("");
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
        this._setStatus("info", `Source set to ${this._deviceLabel(sourceDevice)} \u2014 pick a target below.`);
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
  };

  // src/index.js
  console.info(
    `%c ZHA-BINDING-MAP-CARD %c v${CARD_VERSION} `,
    "color: white; background: #039be5; font-weight: 700; border-radius: 3px 0 0 3px;",
    "color: #039be5; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
  );
  customElements.define("zha-binding-map-card", ZhaBindingMapCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    // NOTE: "type" and the customElements.define() name above must never change —
    // existing dashboards reference `custom:zha-binding-map-card` in their YAML.
    // Only the display name/description below (shown in the card picker and HACS)
    // reflect the "ZHA Bindings Manager" project name.
    type: "zha-binding-map-card",
    name: "ZHA Bindings Manager",
    description: "Visual manager for ZHA Zigbee direct bindings \u2014 graph/table overview plus drag-and-drop bind/unbind, built on top of zha-toolkit."
  });
})();
