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
 * Version: 1.10.3
 */
(() => {
  // src/capexplorer-constants.js
  var CAPABILITY_DB_REPO = "hsolgaard/zigbee-capabilities";
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
    2820: "Electrical measurement",
    // 0xFC00-0xFFFF is the manufacturer-specific cluster range, so IDs in it
    // are normally NOT safe to map by number alone — the same numeric ID gets
    // reused by unrelated vendors for unrelated purposes (see
    // MANUFACTURER_SPECIFIC_CLUSTER_NAMES below for those). 0xFC57 is the one
    // documented exception: it's the semi-standardized "Works with all Hubs"
    // (WWAH) cluster, used consistently across multiple vendors (confirmed on
    // IKEA devices and referenced generally for hub-compatibility signaling,
    // e.g. when a device connects to Amazon Alexa/Echo) rather than being
    // vendor-private — verified via zigpy/zigpy#823 and community device
    // handler sources, not guessed from the hex ID alone.
    64599: "Works with all hubs (WWAH)"
  };
  var MANUFACTURER_SPECIFIC_CLUSTER_NAMES = {
    sonoff: {
      64529: "Device settings (Sonoff)"
    }
  };
  function capabilityOutcomePhrase(id, fallbackName, manufacturer) {
    const n = Number(id);
    const vendorKey = (manufacturer || "").toString().trim().toLowerCase();
    const vendorMap = MANUFACTURER_SPECIFIC_CLUSTER_NAMES[vendorKey];
    return vendorMap && vendorMap[n] || CAPABILITY_OUTCOME_PHRASE[n] || fallbackName || `Cluster 0x${n.toString(16).padStart(4, "0")}`;
  }

  // src/constants.js
  var ZTK_DOMAIN = "zha_toolkit";
  var CARD_VERSION = "1.10.3";
  var CHANGELOG_URL = "https://github.com/hsolgaard/zha-bindings-manager/blob/main/CHANGELOG.md";
  var DEFAULT_BINDABLE_OUT_CLUSTERS = [5, 6, 8, 258, 768];
  var MEMBERSHIP_EDGE_COLOR = "#8e24aa";
  var HISTORY_LIMIT = 10;
  var DEFAULT_RETRY_COUNT = 2;
  var DEFAULT_BINDABLE_IN_CLUSTERS = [1026];
  var DEFAULT_SCAN_BATCH_SIZE = 10;
  var DEFAULT_FP_MARKER_SCALE = 100;
  var GREEN_POWER_ENDPOINT = 242;
  var AMBIGUOUS_TUYA_MODELS = [
    "TS0601",
    "TS011F",
    "TS0201",
    "TS0203",
    "TS0041",
    "TS0042",
    "TS0043",
    "TS0044",
    "TS0121"
  ];
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
  var CLUSTER_COMMANDS = {
    // Basic, Identify, and Groups are near-universal — almost every Zigbee
    // device declares them regardless of type — which is exactly why their
    // absence here mattered more than any other gap: unlike a specialized
    // cluster, a raw snake_case command name on one of these (e.g.
    // "reset_fact_default", "identify_query", "add_if_identifying") showed up
    // on nearly every device in the Capability Explorer, real user feedback
    // on a live SONOFF ZBMINIR2 screenshot. Command names/IDs verified
    // against the ZCL General clusters (zigpy's zcl/clusters/general.py).
    0: {
      0: "Reset to factory defaults"
    },
    3: {
      0: "Identify",
      1: "Identify query",
      64: "Trigger identify effect"
    },
    4: {
      0: "Add to group",
      1: "View group",
      2: "Get group membership",
      3: "Remove from group",
      4: "Remove from all groups",
      5: "Add to group if identifying"
    },
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
  var HEALTH_LABEL = { ok: "Valid", info: "Info", warning: "Warning", error: "Error" };
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
    if (err.code && !err.message) return `${String(err.code).replace(/_/g, " ")} (no details)`;
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
  function deviceHaUrl(d) {
    if (!d || !d.device_reg_id) return null;
    return `/config/devices/device/${encodeURIComponent(d.device_reg_id)}`;
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
  function bindingMatchesLoose(b, { sourceIeee, sourceEp = null, clusterIds = null, target }) {
    if (normIeee(b.sourceIeee) !== normIeee(sourceIeee)) return false;
    if (sourceEp != null && Number(b.sourceEndpoint) !== Number(sourceEp)) return false;
    if (clusterIds && clusterIds.length && !clusterIds.map(Number).includes(Number(b.clusterId))) return false;
    if (target.isGroup) return b.isGroup && Number(b.groupId) === Number(target.groupId);
    if (b.isGroup || normIeee(b.targetIeee) !== normIeee(target.ieee)) return false;
    return target.endpoint == null || Number(b.targetEndpoint) === Number(target.endpoint);
  }
  function bindingKey(b) {
    const dst = b.isGroup ? `g${Number(b.groupId)}` : `${normIeee(b.targetIeee)}:${Number(b.targetEndpoint)}`;
    return `${normIeee(b.sourceIeee)}|${Number(b.sourceEndpoint)}|${Number(b.clusterId)}|${dst}`;
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
  var IEEE_RE = /^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/;
  var SAFE_ID_RE = /^[0-9A-Za-z:|]{1,120}$/;
  function isIeee(value) {
    return typeof value === "string" && IEEE_RE.test(value.toLowerCase());
  }
  function intIn(value, max) {
    const n = typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) ? parseInt(value, 16) : Number(value);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
  }
  function sanitizeStoredBinding(b, sourceKey) {
    if (!b || typeof b !== "object") return null;
    const sourceIeee = normIeee(typeof b.sourceIeee === "string" ? b.sourceIeee : sourceKey);
    if (!isIeee(sourceIeee)) return null;
    const sourceEndpoint = intIn(b.sourceEndpoint, 255);
    const clusterId = intIn(b.clusterId, 65535);
    if (sourceEndpoint == null || clusterId == null) return null;
    const isGroup = b.isGroup === true;
    let targetIeee = null;
    let targetEndpoint = null;
    let groupId = null;
    if (isGroup) {
      groupId = intIn(b.groupId, 65535);
      if (groupId == null) return null;
    } else {
      targetIeee = normIeee(typeof b.targetIeee === "string" ? b.targetIeee : "");
      targetEndpoint = intIn(b.targetEndpoint, 255);
      if (!isIeee(targetIeee) || targetEndpoint == null) return null;
    }
    const rebuilt = `${sourceIeee}|${sourceEndpoint}|${clusterId}|${isGroup ? "g" + groupId : `${targetIeee}:${targetEndpoint}`}`;
    const id = typeof b.id === "string" && SAFE_ID_RE.test(b.id) ? b.id : rebuilt;
    return { id, sourceIeee, sourceEndpoint, clusterId, isGroup, targetIeee, targetEndpoint, groupId };
  }
  function sanitizeStoredBindings(raw) {
    const out = /* @__PURE__ */ new Map();
    let dropped = 0;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { bindings: out, dropped };
    for (const [key, list2] of Object.entries(raw)) {
      const ieee = normIeee(key);
      if (!isIeee(ieee) || !Array.isArray(list2)) {
        dropped += Array.isArray(list2) ? list2.length : 1;
        continue;
      }
      const clean = [];
      for (const b of list2) {
        const s = sanitizeStoredBinding(b, ieee);
        if (s) clean.push(s);
        else dropped++;
      }
      out.set(ieee, clean);
    }
    return { bindings: out, dropped };
  }

  // src/activity.js
  var CHATTY_MIN_RATE = 20;
  var CHATTY_FACTOR = 10;
  var FLOOD_RATE = 60;
  var TOP_ROWS = 8;
  var MIN_MINUTES_FOR_USUAL = 10;
  function clusterLabel(id) {
    const n = Number(id);
    if (n >= 64512) return `Manufacturer-specific (0x${n.toString(16).toUpperCase().padStart(4, "0")})`;
    return clusterName(n);
  }
  function countedMinutes(snapshot, nowMs = Date.now()) {
    const len = snapshot && snapshot.window_minutes || 60;
    const since = snapshot && snapshot.since ? Date.parse(snapshot.since) : NaN;
    if (!Number.isFinite(since)) return len;
    const minutes = Math.floor(nowMs / 6e4) - Math.floor(since / 6e4) + 1;
    return Math.max(1, Math.min(len, minutes));
  }
  function median(values) {
    const v = [...values || []].sort((a, b) => a - b);
    if (!v.length) return 0;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }
  var round1 = (n) => Math.round(n * 10) / 10;
  function activityRows(snapshot, { coordinatorIeee = null, nowMs = Date.now() } = {}) {
    const counted = countedMinutes(snapshot, nowMs);
    const coord = normIeee(coordinatorIeee || snapshot && snapshot.coordinator_ieee || "");
    const rows = [];
    let fromCoordinator = null;
    for (const [ieee, d] of Object.entries(snapshot && snapshot.by_device || {})) {
      const pm = Array.isArray(d.per_minute) ? d.per_minute.map(Number) : [];
      if (!pm.length) continue;
      const last5 = pm.slice(-Math.min(5, counted));
      const now = round1(last5.reduce((a, b) => a + b, 0) / last5.length);
      const hour = Math.round(pm.reduce((a, b) => a + b, 0));
      const typical = counted >= MIN_MINUTES_FOR_USUAL ? round1(median(pm.slice(-counted))) : null;
      const clusters = Object.entries(d.clusters || {}).map(([id, n]) => [id, Number(n)]).sort((a, b) => b[1] - a[1]);
      const chatty = now >= CHATTY_MIN_RATE && (typical != null && now >= CHATTY_FACTOR * Math.max(typical, 0.5) || now >= FLOOD_RATE);
      const row = { ieee: normIeee(ieee), nwk: d.nwk, now, hour, typical, clusters, chatty };
      if (coord && row.ieee === coord) fromCoordinator = row;
      else rows.push(row);
    }
    rows.sort((a, b) => b.now - a.now || b.hour - a.hour);
    return { rows, chatty: rows.filter((r) => r.chatty), fromCoordinator };
  }
  function timesTypical(row) {
    if (!row || row.typical == null || row.typical <= 0) return "";
    const x = row.now / row.typical;
    return x >= 2 ? `\xD7${Math.round(x)}` : "";
  }
  function interestingCounters(snapshot) {
    return (snapshot && snapshot.coordinator_counters || []).filter((c) => c && Number(c.value) > 0).sort((a, b) => b.value - a.value);
  }

  // src/api-client.js
  var ZhaApi = class {
    constructor(hass) {
      this.hass = hass;
      this.watchEnabled = false;
    }
    /** 1.10.0: short-address history and missed presses. */
    async evidenceGet() {
      return this.hass.callWS({ type: "zha_bindings_manager/evidence_get" });
    }
    // --- Replace a device (integration 1.9.0) -----------------------------------
    async replacePlan(oldIeee, newIeee, { oldClusters, newClusters, endpointMap } = {}) {
      const clean = (list2) => (list2 || []).map((c) => ({ endpoint_id: Number(c.endpoint_id), id: Number(c.id), type: c.type }));
      const msg = { type: "zha_bindings_manager/replace_plan", old_ieee: oldIeee, new_ieee: newIeee };
      if (oldClusters && oldClusters.length) msg.old_clusters = clean(oldClusters);
      if (newClusters && newClusters.length) msg.new_clusters = clean(newClusters);
      if (endpointMap && Object.keys(endpointMap).length) msg.endpoint_map = endpointMap;
      return this.hass.callWS(msg);
    }
    async replaceRun(planId, items) {
      return this.hass.callWS({ type: "zha_bindings_manager/replace_run", plan_id: planId, items });
    }
    async replaceCleanup(planId, unbindOld) {
      return this.hass.callWS({ type: "zha_bindings_manager/replace_cleanup", plan_id: planId, unbind_old: !!unbindOld });
    }
    /** Removes a device from ZHA (ZHA's own zha.remove action). */
    async removeZhaDevice(ieee) {
      return this.hass.callService("zha", "remove", { ieee });
    }
    // --- Lost bindings (integration 1.8.0) -------------------------------------
    async watchGet() {
      return this.hass.callWS({ type: "zha_bindings_manager/watch_get" });
    }
    /** Puts lost bindings back: one device, or every device when ieee is omitted. */
    async watchPutBack(ieee) {
      const msg = { type: "zha_bindings_manager/watch_put_back" };
      if (ieee) msg.ieee = ieee;
      return this.hass.callWS(msg);
    }
    /** Stops expecting bindings (all of a device's, or just these keys). */
    async watchForget(ieee, keys) {
      const msg = { type: "zha_bindings_manager/watch_forget", ieee };
      if (keys && keys.length) msg.keys = keys;
      return this.hass.callWS(msg);
    }
    async watchPolicy(ieee, policy) {
      return this.hass.callWS({ type: "zha_bindings_manager/watch_policy", ieee, policy });
    }
    /** Switch the lights from Home Assistant when a press doesn't reach them. */
    async watchFallback(ieee, enabled) {
      return this.hass.callWS({ type: "zha_bindings_manager/watch_fallback", ieee, enabled: !!enabled });
    }
    async watchCheckAll() {
      return this.hass.callWS({ type: "zha_bindings_manager/watch_check_all" });
    }
    /** Tells the watch which bindings were removed on purpose. Patterns:
     *  {sourceIeee, sourceEndpoint?, clusterIds?, isGroup?, groupId?,
     *  targetIeee?, targetEndpoint?}; anything left out matches all. Never
     *  throws: this is bookkeeping, the unbind itself already happened. */
    async _reportRemoved(pattern) {
      if (!this.watchEnabled) return;
      const clean = {};
      for (const [k, v] of Object.entries(pattern)) if (v != null) clean[k] = v;
      try {
        await this.hass.callWS({ type: "zha_bindings_manager/watch_removed", bindings: [clean] });
      } catch (e) {
      }
    }
    async fetchDevices() {
      return this.hass.callWS({ type: "zha/devices" });
    }
    async fetchGroups() {
      return this.hass.callWS({ type: "zha/groups" });
    }
    /** Experimental (integration only): read one router's routing and
     *  neighbour tables; returns the stored entry. */
    async meshRead(ieee) {
      return this.hass.callWS({ type: "zha_bindings_manager/mesh_read", ieee });
    }
    /** Binding tables the integration read itself (1.5.0):
     *  {scans: {ieee: {at, bindings, partial}}}. */
    async deviceScans() {
      return this.hass.callWS({ type: "zha_bindings_manager/device_scans" });
    }
    /** Experimental: every stored entry, {devices: {ieee: entry}}. */
    async meshGet() {
      return this.hass.callWS({ type: "zha_bindings_manager/mesh_get" });
    }
    /** Experimental (1.7.0): messages per device to Home Assistant. */
    async activityGet() {
      return this.hass.callWS({ type: "zha_bindings_manager/activity_get" });
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
      const res = await this.callToolkit("binds_remove_all", data);
      await this._reportRemoved({
        sourceIeee,
        sourceEndpoint: opts.endpoint,
        clusterIds: clusterIds && clusterIds.length ? clusterIds.map(Number) : null,
        targetIeee,
        targetEndpoint: opts.dstEndpoint
      });
      return res;
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
    /** Creates a ZHA group, optionally with members, using ZHA's own
     *  websocket API (what Home Assistant's Groups page uses). Members are
     *  [{ieee, endpoint}]. Returns ZHA's group record when it sends one. */
    async createGroup(name, members = []) {
      return this.hass.callWS({
        type: "zha/group/add",
        group_name: name,
        members: members.map((m) => ({ ieee: m.ieee, endpoint_id: Number(m.endpoint) }))
      });
    }
    /** Creates a ZHA group with a given group ID (one that devices already
     *  use, e.g. made by Find & Bind). */
    async createGroupWithId(name, groupId) {
      return this.hass.callWS({ type: "zha/group/add", group_name: name, group_id: Number(groupId) });
    }
    /** Adds [{ieee, endpoint}] to an existing ZHA group. */
    async addGroupMembers(groupId, members) {
      return this.hass.callWS({
        type: "zha/group/members/add",
        group_id: Number(groupId),
        members: members.map((m) => ({ ieee: m.ieee, endpoint_id: Number(m.endpoint) }))
      });
    }
    /** binds_remove_all limited to one source endpoint and cluster, with no
     *  target filter: removes every binding on that endpoint and cluster,
     *  group bindings included. Used for a light's reporting binding to a
     *  group, which unbind_group can't remove (see groups.js). */
    async removeBindingsOnCluster(sourceIeee, endpoint, clusterId) {
      const res = await this.callToolkit("binds_remove_all", { ieee: sourceIeee, endpoint: Number(endpoint), cluster: [Number(clusterId)] });
      await this._reportRemoved({ sourceIeee, sourceEndpoint: Number(endpoint), clusterIds: [Number(clusterId)] });
      return res;
    }
    /** Removes [{ieee, endpoint}] from a ZHA group (ZHA's own websocket). */
    async removeGroupMembers(groupId, members) {
      return this.hass.callWS({
        type: "zha/group/members/remove",
        group_id: Number(groupId),
        members: members.map((m) => ({ ieee: m.ieee, endpoint_id: Number(m.endpoint) }))
      });
    }
    /** Deletes ZHA groups (ZHA's own websocket, as the Groups page uses). */
    async removeGroups(groupIds) {
      return this.hass.callWS({ type: "zha/group/remove", group_ids: groupIds.map(Number) });
    }
    async unbindGroup(sourceIeee, groupId, clusterIds, opts = {}) {
      const data = { ieee: sourceIeee, command_data: groupId };
      if (clusterIds && clusterIds.length === 1) data.cluster = clusterIds[0];
      if (opts.endpoint != null) data.endpoint = opts.endpoint;
      const res = await this.callToolkit("unbind_group", data);
      await this._reportRemoved({
        sourceIeee,
        sourceEndpoint: opts.endpoint,
        clusterIds: clusterIds && clusterIds.length === 1 ? [Number(clusterIds[0])] : null,
        isGroup: true,
        groupId: Number(groupId)
      });
      return res;
    }
  };

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
  var BEHAVIOUR_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/behaviour.json`;
  var BEHAVIOUR_CACHE_KEY = "zha-capability-explorer:behaviour-cache";
  var _behaviourMemory = null;
  async function fetchBehaviourDoc({ force = false } = {}) {
    if (!force && _behaviourMemory) return _behaviourMemory;
    if (!force) {
      try {
        const raw = JSON.parse(localStorage.getItem(BEHAVIOUR_CACHE_KEY) || "null");
        if (raw && raw.doc && typeof raw.fetchedAt === "number" && Date.now() - raw.fetchedAt < CACHE_TTL_MS) {
          _behaviourMemory = raw.doc;
          return raw.doc;
        }
      } catch (e) {
      }
    }
    const res = await fetch(BEHAVIOUR_URL, { cache: "no-store" });
    if (res.status === 404) return _behaviourMemory = {};
    if (!res.ok) throw new Error(`Failed to fetch community behaviour reports (HTTP ${res.status})`);
    const doc = await res.json();
    _behaviourMemory = doc && typeof doc === "object" && !Array.isArray(doc) ? doc : {};
    try {
      localStorage.setItem(BEHAVIOUR_CACHE_KEY, JSON.stringify({ doc: _behaviourMemory, fetchedAt: Date.now() }));
    } catch (e) {
    }
    return _behaviourMemory;
  }
  var Z2M_MODELS_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/z2m-models.json`;
  var Z2M_MODELS_CACHE_KEY = "zha-capability-explorer:z2m-models-cache";
  var EMPTY_Z2M_MAP = Object.freeze({ models: {}, fingerprints: {} });
  var _z2mMemory = null;
  async function fetchZ2mModels({ force = false } = {}) {
    if (!force && _z2mMemory) return _z2mMemory;
    if (!force) {
      try {
        const raw = JSON.parse(localStorage.getItem(Z2M_MODELS_CACHE_KEY) || "null");
        if (raw && raw.map && typeof raw.fetchedAt === "number" && Date.now() - raw.fetchedAt < CACHE_TTL_MS) {
          _z2mMemory = raw.map;
          return raw.map;
        }
      } catch (e) {
      }
    }
    const res = await fetch(Z2M_MODELS_URL, { cache: "no-store" });
    if (res.status === 404) return _z2mMemory = EMPTY_Z2M_MAP;
    if (!res.ok) throw new Error(`Failed to fetch the Zigbee2MQTT model map (HTTP ${res.status})`);
    const doc = await res.json();
    _z2mMemory = {
      models: doc && doc.models || {},
      fingerprints: doc && doc.fingerprints || {}
    };
    try {
      localStorage.setItem(Z2M_MODELS_CACHE_KEY, JSON.stringify({ map: _z2mMemory, fetchedAt: Date.now() }));
    } catch (e) {
    }
    return _z2mMemory;
  }
  function z2mProductCode(map, manufacturer, model, { ambiguous = false } = {}) {
    if (!map || !model) return null;
    const fp = map.fingerprints && map.fingerprints[`${manufacturer || ""}|${model}`];
    if (fp) return fp;
    if (ambiguous) return null;
    return map.models && map.models[model] || null;
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
  function groupSearchResultsByDevice(matchingEntries, fullIndex) {
    const matchedKeys = new Set(matchingEntries.map((e) => `${e.manufacturer_slug}|${e.model_slug}`));
    const byDevice = groupByDevice(fullIndex);
    const results = [];
    matchedKeys.forEach((key) => {
      const entries = byDevice.get(key) || [];
      if (!entries.length) return;
      const first = entries[0];
      const rating = confidenceStars(entries);
      const fw = firmwareVersions(entries);
      const totalScans = entries.reduce((sum, e) => sum + (e.scan_count || 0), 0);
      const lastSeenTimes = entries.map((e) => e.last_seen).filter(Boolean).sort();
      results.push({
        manufacturerSlug: first.manufacturer_slug,
        modelSlug: first.model_slug,
        manufacturer: first.manufacturer,
        model: first.model,
        entries,
        rating,
        goodFor: useCaseTags(entries),
        firmwareCount: fw.length,
        totalScans,
        lastSeen: lastSeenTimes.length ? lastSeenTimes[lastSeenTimes.length - 1] : null,
        // External references (Blakadder / manufacturer product page — see
        // PRD: "External Device References"). Same value on every firmware
        // entry for this device (it's per manufacturer+model, stored once in
        // the source file), so `first`'s copy is as good as any. Purely a
        // passthrough for the UI to render as supplementary context — nothing
        // above this (rating, goodFor, groupCapabilitiesByOutcome, etc.) ever
        // reads it, and it must stay that way: external references describe
        // what other sites document, never what a scan actually confirmed.
        references: first.references || null
      });
    });
    const starRank = (r) => r.conflicting ? -1 : r.stars || 0;
    results.sort((a, b) => {
      if (starRank(b.rating) !== starRank(a.rating)) return starRank(b.rating) - starRank(a.rating);
      const aLast = a.lastSeen || "";
      const bLast = b.lastSeen || "";
      if (bLast !== aLast) return bLast.localeCompare(aLast);
      if (b.firmwareCount !== a.firmwareCount) return b.firmwareCount - a.firmwareCount;
      return `${a.manufacturer || ""} ${a.model || ""}`.localeCompare(`${b.manufacturer || ""} ${b.model || ""}`);
    });
    return results;
  }
  function reportsState(entry) {
    return Object.values(entry.clusters || {}).some(
      (cluster) => (cluster.attributes_confirmed || []).some((a) => String(a.access || "").includes("REPORT"))
    );
  }
  function confidenceStars(entries) {
    const anyConflicting = (entries || []).some(
      (entry) => Object.values(entry.clusters || {}).some(
        (cluster) => (cluster.commands_received || []).some((row) => row.conflicting)
      )
    );
    const totalScans = (entries || []).reduce((sum, e) => sum + (e.scan_count || 0), 0);
    if (anyConflicting) return { stars: null, conflicting: true, totalScans };
    let stars;
    if (totalScans >= 20) stars = 5;
    else if (totalScans >= 10) stars = 4;
    else if (totalScans >= 5) stars = 3;
    else if (totalScans >= 2) stars = 2;
    else stars = 1;
    return { stars, conflicting: false, totalScans };
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
    const manufacturer = (entries[0] || {}).manufacturer;
    const groups = /* @__PURE__ */ new Map();
    entries.forEach((entry) => {
      const inSet = new Set(entry.in_clusters || []);
      const outSet = new Set(entry.out_clusters || []);
      Object.entries(entry.clusters || {}).forEach(([clusterId, cluster]) => {
        if (!groups.has(clusterId)) {
          groups.set(clusterId, { clusterName: cluster.name || clusterId, items: /* @__PURE__ */ new Set(), isInput: false, isOutput: false });
        }
        const g = groups.get(clusterId);
        if (cluster.name) g.clusterName = cluster.name;
        if (inSet.has(clusterId)) g.isInput = true;
        if (outSet.has(clusterId)) g.isOutput = true;
        (cluster.commands_received || []).filter((r) => r.present === true).forEach((r) => g.items.add(r.name));
      });
      outSet.forEach((clusterId) => {
        if (groups.has(clusterId)) return;
        groups.set(clusterId, { clusterName: null, items: /* @__PURE__ */ new Set(), isInput: false, isOutput: true, unscanned: true });
      });
    });
    return [...groups.entries()].map(([clusterId, g]) => {
      const items = [...g.items].sort().map((name) => ({ name, firmwareDependent: fwDependent.has(name) }));
      const label = capabilityOutcomePhrase(clusterId, g.clusterName, manufacturer);
      return {
        clusterId,
        label,
        reportsOnly: items.length === 0,
        // Whether this device declares this cluster as Input (commandable/
        // reporting), Output (can control another device with it), both,
        // or — for older community entries that predate this tracking —
        // unknown. See CAPABILITY_ROLE_EXPLANATION for what each means.
        role: g.isInput && g.isOutput ? "both" : g.isOutput ? "output" : g.isInput ? "input" : "unknown",
        unscanned: !!g.unscanned,
        // Whether this label actually tells a user anything, or is just
        // the generic "Cluster 0xNNNN" fallback (no plain-English phrase
        // mapped, and no real cluster name was ever resolved either).
        // Matters for reportsOnly groups specifically: "the group label
        // alone is the capability" only holds up when the label is
        // meaningful (e.g. "Occupancy Sensing") — a bare, unidentified
        // "Cluster 0xfbfe" heading with nothing underneath just reads as
        // broken, not as "reports data." The card combines these into one
        // summary line instead of giving each its own confusing heading.
        identified: !/^Cluster 0x[0-9a-f]{4}$/i.test(label),
        items
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }
  var CAPABILITY_ROLE_LABEL = {
    input: "Input",
    output: "Output",
    both: "Input & Output",
    unknown: "Role unknown"
  };
  var CAPABILITY_ROLE_EXPLANATION = {
    input: "This device can be commanded with this cluster \u2014 by Home Assistant, or by another device bound to it. It cannot use this cluster to control anything else.",
    output: "This device declares, in its own Zigbee signature, that it can control another device using this cluster via a direct Zigbee bind \u2014 this is what lets one device operate another without Home Assistant in between. That's the device's own declaration, not an independently tested behavior: accurate for the large majority of devices, but occasionally a device declares a capability its hardware doesn't actually use.",
    both: "This device can be commanded with this cluster, and also declares \u2014 in its own Zigbee signature \u2014 that it can use it to control another device: a controller role on top of being controllable. As with any declared Output capability, that isn't independently tested behavior, though it holds for the large majority of devices.",
    unknown: "This submission predates input/output tracking, so this cluster's role isn't recorded."
  };
  var USE_CASE_RULES = [
    { id: "switch-onoff", clusterId: "0x0006", kind: "command", label: "Switch things on/off", attribute: "on/off state" },
    { id: "dimmer", clusterId: "0x0008", kind: "command", label: "Dim brightness / adjust level", attribute: "brightness" },
    { id: "color", clusterId: "0x0300", kind: "command", label: "Color control", attribute: "color" },
    { id: "lock", clusterId: "0x0101", kind: "command", label: "Lock / unlock", attribute: "lock state" },
    { id: "cover", clusterId: "0x0102", kind: "command", label: "Open / close covers", attribute: "open/close position" },
    { id: "thermostat", clusterId: "0x0201", kind: "command", label: "Control heating / cooling", attribute: "heating/cooling setpoint" },
    { id: "scenes", clusterId: "0x0005", kind: "command", label: "Scene control", attribute: "scene recall" },
    { id: "temperature", clusterId: "0x0402", kind: "presence", label: "Temperature sensing", fragment: "sense temperature" },
    { id: "humidity", clusterId: "0x0405", kind: "presence", label: "Monitor humidity", fragment: "sense humidity" },
    { id: "occupancy", clusterId: "0x0406", kind: "presence", label: "Detect motion / occupancy", fragment: "detect motion or occupancy" },
    { id: "illuminance", clusterId: "0x0400", kind: "presence", label: "Monitor light level", fragment: "sense ambient light level" },
    { id: "pressure", clusterId: "0x0403", kind: "presence", label: "Monitor air pressure", fragment: "sense air pressure" },
    { id: "flow", clusterId: "0x0404", kind: "presence", label: "Monitor water / air flow", fragment: "sense water or air flow" },
    { id: "metering", clusterId: "0x0702", kind: "presence", label: "Energy monitoring", fragment: "monitor energy use" },
    { id: "electrical", clusterId: "0x0b04", kind: "presence", label: "Track power draw", fragment: "track power draw" },
    { id: "ias-zone", clusterId: "0x0500", kind: "presence", label: "Raise security / contact alerts", fragment: "raise security or contact alerts" }
  ];
  var USE_CASE_RULE_BY_ID = Object.fromEntries(USE_CASE_RULES.map((r) => [r.id, r]));
  var CONTROLLER_CLUSTER_IDS = ["0x0006", "0x0008", "0x0300", "0x0005"];
  var CONTROL_PHRASES_BY_CLUSTER = {
    "0x0006": "switch another device on or off",
    "0x0008": "dim another device",
    "0x0300": "change another device's color",
    "0x0005": "trigger scenes on another device"
  };
  function controlUseCases(entries) {
    if (!entries || !entries.length) return [];
    return groupCapabilitiesByOutcome(entries).filter((g) => (g.role === "output" || g.role === "both") && CONTROL_PHRASES_BY_CLUSTER[g.clusterId]).map((g) => ({ clusterId: g.clusterId, label: g.label, phrase: CONTROL_PHRASES_BY_CLUSTER[g.clusterId] }));
  }
  function notControllableUseCases(entries) {
    if (!entries || !entries.length) return [];
    const controllableIds = new Set(controlUseCases(entries).map((c) => c.clusterId));
    const commandableIds = new Set(
      useCaseTags(entries).filter((t) => USE_CASE_RULE_BY_ID[t.id] && CONTROLLER_CLUSTER_IDS.includes(USE_CASE_RULE_BY_ID[t.id].clusterId)).map((t) => USE_CASE_RULE_BY_ID[t.id].clusterId)
    );
    return [...commandableIds].filter((clusterId) => !controllableIds.has(clusterId)).map((clusterId) => ({ clusterId, phrase: CONTROL_PHRASES_BY_CLUSTER[clusterId] }));
  }
  function useCaseTags(entries, localFirmware = null) {
    if (!entries || !entries.length) return [];
    const tags = [];
    USE_CASE_RULES.forEach((rule) => {
      const confirmingFirmwares = /* @__PURE__ */ new Set();
      entries.forEach((entry) => {
        const cluster = (entry.clusters || {})[rule.clusterId];
        const hit = rule.kind === "command" ? !!cluster && (cluster.commands_received || []).some((r) => r.present === true) : !!cluster || (entry.in_clusters || []).includes(rule.clusterId);
        if (hit) confirmingFirmwares.add(entry.firmware || null);
      });
      if (confirmingFirmwares.size) {
        tags.push({
          id: rule.id,
          label: rule.label,
          exactFirmware: !localFirmware || confirmingFirmwares.has(localFirmware)
        });
      }
    });
    controlUseCases(entries).forEach((c) => {
      const confirmingFirmwares = /* @__PURE__ */ new Set();
      entries.forEach((entry) => {
        if ((entry.out_clusters || []).includes(c.clusterId)) confirmingFirmwares.add(entry.firmware || null);
      });
      tags.push({
        id: `control-${c.clusterId}`,
        label: `Directly ${c.phrase} (bind)`,
        exactFirmware: !localFirmware || confirmingFirmwares.has(localFirmware)
      });
    });
    return tags;
  }
  function joinPhrases(list2, conj = "and") {
    if (!list2.length) return "";
    if (list2.length === 1) return list2[0];
    if (list2.length === 2) return `${list2[0]} ${conj} ${list2[1]}`;
    return `${list2.slice(0, -1).join(", ")}, ${conj} ${list2[list2.length - 1]}`;
  }
  function directControlSummary(entries) {
    const control = controlUseCases(entries);
    if (!control.length) return "";
    const phrases = joinPhrases(control.map((c) => c.phrase));
    return `Can likely ${phrases} directly over a Zigbee bind, without Home Assistant in the loop. This is based on what the device's own Zigbee signature declares \u2014 accurate for the large majority of devices, but declared rather than independently tested, so treat it as strong evidence rather than a guarantee; a successful bind on your own network still depends on binding-table capacity and the target device's own support.`;
  }
  function notDirectControlSummary(entries) {
    const notControl = notControllableUseCases(entries);
    if (!notControl.length) return "";
    const phrases = joinPhrases(
      notControl.map((c) => c.phrase),
      "or"
    );
    return `Cannot ${phrases} directly over a Zigbee bind \u2014 its Zigbee signature only lets it receive ${notControl.length > 1 ? "those commands" : "that command"}, not send ${notControl.length > 1 ? "them" : "it"} to another device.`;
  }
  function deviceOverview(entries) {
    if (!entries || !entries.length) return [];
    const tags = useCaseTags(entries).filter((t) => USE_CASE_RULE_BY_ID[t.id]);
    const commandAttrs = tags.filter((t) => USE_CASE_RULE_BY_ID[t.id].kind === "command").map((t) => USE_CASE_RULE_BY_ID[t.id].attribute);
    const presenceFrags = tags.filter((t) => USE_CASE_RULE_BY_ID[t.id].kind === "presence").map((t) => USE_CASE_RULE_BY_ID[t.id].fragment);
    const sentences = [];
    if (commandAttrs.length) {
      sentences.push({
        kind: "command",
        text: `This device's ${joinPhrases(commandAttrs)} can be controlled by Home Assistant, or by another Zigbee device bound directly to it.`
      });
    }
    if (presenceFrags.length) {
      sentences.push({
        kind: "presence",
        text: `${commandAttrs.length ? "It can also" : "This device can"} ${joinPhrases(presenceFrags)}.`
      });
    }
    const control = directControlSummary(entries);
    if (control) sentences.push({ kind: "control", text: control });
    const notControl = notDirectControlSummary(entries);
    if (notControl) sentences.push({ kind: "not-control", text: notControl });
    return sentences;
  }
  function interestingDiscoveries(index, opts = {}) {
    const {
      minScansForMostConfirmed = 5,
      minFirmwareVariety = 3,
      minScansForFwDependent = 2,
      minRecentActivity = 3,
      recentActivityWindowDays = 14,
      maxResults = 4
    } = opts;
    const discoveries = [];
    const byDevice = groupByDevice(index);
    let mostConfirmed = null;
    byDevice.forEach((entries, deviceKey2) => {
      if (!entries[0].manufacturer || !entries[0].model) return;
      const total = entries.reduce((sum, e) => sum + (e.scan_count || 0), 0);
      if (total >= minScansForMostConfirmed && (!mostConfirmed || total > mostConfirmed.total)) {
        mostConfirmed = { deviceKey: deviceKey2, manufacturer: entries[0].manufacturer, model: entries[0].model, total };
      }
    });
    if (mostConfirmed) {
      discoveries.push({
        id: "most-confirmed",
        deviceKey: mostConfirmed.deviceKey,
        cardNote: "Most-confirmed device in the community database.",
        text: `Most-confirmed device so far: ${mostConfirmed.manufacturer} ${mostConfirmed.model}, backed by ${mostConfirmed.total} scans.`
      });
    }
    let mostFirmware = null;
    byDevice.forEach((entries, deviceKey2) => {
      if (!entries[0].manufacturer || !entries[0].model) return;
      const versions = firmwareVersions(entries);
      if (versions.length >= minFirmwareVariety && (!mostFirmware || versions.length > mostFirmware.count)) {
        mostFirmware = { deviceKey: deviceKey2, manufacturer: entries[0].manufacturer, model: entries[0].model, count: versions.length };
      }
    });
    if (mostFirmware) {
      discoveries.push({
        id: "most-firmware-variety",
        deviceKey: mostFirmware.deviceKey,
        cardNote: "Most firmware variety of any device on file.",
        text: `${mostFirmware.manufacturer} ${mostFirmware.model} has the most firmware variety on file: ${mostFirmware.count} distinct versions observed.`
      });
    }
    let fwDependentExample = null;
    byDevice.forEach((entries, deviceKey2) => {
      if (!entries[0].manufacturer || !entries[0].model) return;
      if (entries.some((e) => (e.scan_count || 0) < minScansForFwDependent)) return;
      const changed = firmwareDependentCapabilities(entries);
      if (changed.size && !fwDependentExample) {
        fwDependentExample = { deviceKey: deviceKey2, manufacturer: entries[0].manufacturer, model: entries[0].model, names: [...changed] };
      }
    });
    if (fwDependentExample) {
      discoveries.push({
        id: "firmware-dependent-example",
        deviceKey: fwDependentExample.deviceKey,
        cardNote: "Confirmed capabilities differ by firmware version \u2014 see Compare Firmware below.",
        text: `${fwDependentExample.manufacturer} ${fwDependentExample.model}'s confirmed capabilities actually differ by firmware version (e.g. "${fwDependentExample.names[0]}") \u2014 worth checking Compare Firmware before assuming an update is safe.`
      });
    }
    let newest = null;
    index.forEach((entry) => {
      if (!entry.manufacturer || !entry.model) return;
      if (entry.last_seen && (!newest || entry.last_seen > newest.last_seen)) newest = entry;
    });
    if (newest) {
      discoveries.push({
        id: "newest-contribution",
        deviceKey: `${slugify(newest.manufacturer)}|${slugify(newest.model)}`,
        cardNote: "The newest contribution to the community database.",
        text: `Newest contribution: ${newest.manufacturer} ${newest.model} on firmware ${newest.firmware || "unknown"}, confirmed by the community on ${newest.last_seen.slice(0, 10)}.`
      });
    }
    const cutoff = Date.now() - recentActivityWindowDays * 24 * 60 * 60 * 1e3;
    const recentCount = index.filter((e) => e.last_seen && new Date(e.last_seen).getTime() >= cutoff).length;
    if (recentCount >= minRecentActivity) {
      discoveries.push({
        id: "recent-activity",
        deviceKey: null,
        text: `${recentCount} firmware observations added to the community database in the last ${recentActivityWindowDays} days \u2014 this is a living, actively-growing resource.`
      });
    }
    return discoveries.slice(0, maxResults);
  }
  function discoveryForDevice(discoveries, manufacturerSlug, modelSlug) {
    const key = `${manufacturerSlug}|${modelSlug}`;
    return discoveries.find((d) => d.deviceKey === key) || null;
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

  // src/device-answers.js
  var QUESTIONS_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/questions.json`;
  var ANSWERS_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/answers.json`;
  var ISSUE_FORM_URL = `https://github.com/${CAPABILITY_DB_REPO}/issues/new?template=device-answers.yml`;
  var ids = (clusters, type) => new Set((clusters || []).filter((c) => c && c.type === type).map((c) => Number(c.id)));
  function detectDeviceType(clusters, powerSource = "") {
    const inn = ids(clusters, "in");
    const out = ids(clusters, "out");
    const battery = /battery/i.test(String(powerSource || ""));
    if (inn.has(258)) return "cover";
    if (inn.has(768) || inn.has(8) && inn.has(6) && !out.has(6)) return "light";
    const sends = [6, 8, 5, 258, 768].some((id) => out.has(id));
    if (inn.has(6) && sends) return "wall_switch";
    if (sends && !inn.has(6)) return battery || !inn.size || inn.size < 6 ? "remote" : "wall_switch";
    if (inn.has(6)) return "plug";
    if ([1280, 1030, 1026, 1029, 1024, 1027, 1037, 1066].some((id) => inn.has(id))) return "sensor";
    return "other";
  }
  function useAnswers(q, deviceType) {
    return (q && q.use && q.use.answers_by_type || {})[deviceType] || [];
  }
  function questionsFor(q, deviceType, use, { firmwareChanged = false } = {}) {
    return (q && q.questions || []).filter(
      (x) => (x.types || []).includes(deviceType) && (!x.uses || !use || use === "other" || x.uses.includes(use)) && (!x.after_firmware_change || firmwareChanged)
    );
  }
  function formQuestions(q, deviceType, use, { firmwareChanged = false, battery = null, limit = 8 } = {}) {
    let list2 = questionsFor(q, deviceType, use, { firmwareChanged });
    if (battery === false) list2 = list2.filter((x) => x.topic !== "battery");
    const specific = list2.filter((x) => x.uses);
    const general = list2.filter((x) => !x.uses);
    const ordered = [...specific, ...general];
    return { main: ordered.slice(0, limit), more: ordered.slice(limit) };
  }
  function cleanText(value, max = 280) {
    if (typeof value !== "string") return "";
    let s = value.replace(/\b[0-9a-f]{2}(?::[0-9a-f]{2}){7}\b/gi, "[address]").replace(/\b0x[0-9a-f]{9,}\b/gi, "[address]").replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "[address]").replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]").replace(/\bhttps?:\/\/\S+/gi, "[link]").replace(/\bwww\.\S+/gi, "[link]").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
    if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "\u2026";
    return s;
  }
  function firmwareKey(fw) {
    if (!fw) return "unknown";
    return String(fw.sw_build_id || fw.registry_sw_version || "unknown");
  }
  function buildRecord(q, device, firmware, draft, cardVersion, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
    const max = q && q.free_text_max || 280;
    const applicable = new Set(questionsFor(q, draft.deviceType, draft.use, { firmwareChanged: !!draft.firmwareChanged }).map((x) => x.id));
    const answers = {};
    const other = {};
    for (const [qid, aid] of Object.entries(draft.answers || {})) {
      if (!applicable.has(qid) || !aid) continue;
      if (aid === "other") {
        const t = cleanText((draft.other || {})[qid], max);
        if (!t) continue;
        other[qid] = t;
      }
      answers[qid] = aid;
    }
    if (draft.use === "other") {
      const t = cleanText((draft.other || {}).use, max);
      if (t) other.use = t;
    }
    const fw = {};
    if (firmware && firmware.sw_build_id) fw.sw_build_id = String(firmware.sw_build_id);
    if (firmware && firmware.registry_sw_version) fw.registry_sw_version = String(firmware.registry_sw_version);
    const record = {
      kind: "device_answers",
      schema: 1,
      questions_version: q && q.version || 1,
      manufacturer: device.manufacturer || "",
      model: device.model || "",
      firmware: fw,
      device_type: draft.deviceType,
      use: draft.use,
      answers
    };
    if (Object.keys(other).length) record.other = other;
    if (Number.isInteger(draft.rating)) record.rating = draft.rating;
    const tip = cleanText(draft.tip, max);
    if (tip) record.tip = tip;
    const context = {};
    for (const [k, v] of Object.entries(draft.context || {})) if (v) context[k] = v;
    if (Object.keys(context).length) record.context = context;
    record.card_version = cardVersion;
    record.provenance = { submitted_at: nowIso };
    return record;
  }
  function draftProblem(q, firmware, draft) {
    if (!firmware || !firmware.sw_build_id && !firmware.registry_sw_version) return "The firmware version isn't known yet.";
    if (!draft.deviceType) return "Choose what kind of device it is.";
    if (!draft.use) return "Choose what you use it for.";
    if (draft.use === "other" && !cleanText((draft.other || {}).use)) return 'Say what you use it for (you chose "Other").';
    const answered = Object.values(draft.answers || {}).filter(Boolean).length;
    if (!answered && !Number.isInteger(draft.rating)) return "Answer at least one question, or rate it.";
    return "";
  }
  function issueUrl(record) {
    const title = `[Device Answers] ${record.manufacturer} ${record.model} (fw ${firmwareKey(record.firmware)})`;
    const body = "Shared from ZHA Bindings Manager's device panel. Answers are kept per firmware; free text is reviewed before it's shown.\n\n```json\n" + JSON.stringify(record, null, 2) + "\n```";
    return `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(
      body
    )}&labels=${encodeURIComponent("device-answers")}`;
  }
  function deviceKey(device) {
    return `${slugify(device && device.manufacturer)}/${slugify(device && device.model)}`;
  }
  function answersForFirmware(answersDoc, device, firmware) {
    const dev = answersDoc && answersDoc[deviceKey(device)];
    if (!dev) return { here: null, hereKey: null, others: [], total: 0 };
    const keys = Object.keys(dev.by_firmware || {});
    const want = [firmware && firmware.sw_build_id, firmware && firmware.registry_sw_version].filter(Boolean).map(String);
    const hereKey = keys.find((k) => want.includes(k)) || null;
    return {
      here: hereKey ? dev.by_firmware[hereKey] : null,
      hereKey,
      others: keys.filter((k) => k !== hereKey).map((k) => ({ firmware: k, total: dev.by_firmware[k].total || 0 })),
      total: dev.total || 0
    };
  }
  function summaryLines(q, fwEntry) {
    if (!fwEntry) return [];
    const labelOf = (list2, id) => ((list2 || []).find((a) => a.id === id) || {}).label || id;
    const allUses = Object.values(q && q.use && q.use.answers_by_type || {}).flat();
    return Object.entries(fwEntry.by_use || {}).sort((a, b) => b[1].count - a[1].count).map(([use, u]) => {
      const ratingCount = Object.values(u.ratings || {}).reduce((a, b) => a + b, 0);
      const questions = (q && q.questions || []).filter((x) => u.answers && u.answers[x.id]).map((x) => {
        const counts = Object.entries(u.answers[x.id]).sort((a, b) => b[1] - a[1]);
        const n = counts.reduce((a, [, c]) => a + c, 0);
        return {
          id: x.id,
          text: x.text,
          n,
          answers: counts.map(([aid, c]) => ({ label: aid === "other" ? (x.other_label || "Other").replace(/\s*\(tell us\)/i, "") : labelOf(x.answers, aid), count: c }))
        };
      });
      return {
        use,
        useLabel: use === "other" ? "Something else" : labelOf(allUses, use),
        count: u.count,
        rating: u.rating_average,
        ratingCount,
        ratings: u.ratings || {},
        questions,
        tips: (u.tips || []).slice(0, 5)
      };
    });
  }
  function answerCountsText(question) {
    return question.answers.map((a, i) => i === 0 ? `${a.count} of ${question.n}: ${a.label}` : `${a.count}: ${a.label}`).join(" \xB7 ");
  }
  var TTL = 6 * 60 * 60 * 1e3;
  var _memory = {};
  async function fetchCached(url, cacheKey, { force = false, fallback = null } = {}) {
    if (!force && _memory[cacheKey]) return _memory[cacheKey];
    if (!force) {
      try {
        const raw = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (raw && raw.doc && typeof raw.at === "number" && Date.now() - raw.at < TTL) return _memory[cacheKey] = raw.doc;
      } catch (e) {
      }
    }
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404 && fallback) return _memory[cacheKey] = fallback;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = await res.json();
    _memory[cacheKey] = doc;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), doc }));
    } catch (e) {
    }
    return doc;
  }
  async function fetchQuestions(opts = {}) {
    const q = await fetchCached(QUESTIONS_URL, "zha-capability-explorer:questions", { ...opts, fallback: { none: true } });
    return q && q.none ? null : q;
  }
  async function fetchAnswersDoc(opts = {}) {
    return fetchCached(ANSWERS_URL, "zha-capability-explorer:answers", { ...opts, fallback: {} });
  }

  // src/replace.js
  function replacementCandidates(devices, old, { coordinatorIeee = null, typeOf = () => null, nameOf = (d) => d.name || d.ieee } = {}) {
    const oldIeee = normIeee(old.ieee || "");
    const coord = coordinatorIeee ? normIeee(coordinatorIeee) : null;
    const oldType = typeOf(old);
    const score = (d) => d.manufacturer && d.model && d.manufacturer === old.manufacturer && d.model === old.model ? 0 : oldType && typeOf(d) === oldType ? 1 : 2;
    return (devices || []).filter((d) => d && d.ieee && normIeee(d.ieee) !== oldIeee && normIeee(d.ieee) !== coord && d.device_type !== "Coordinator").map((d) => ({ device: d, rank: score(d) })).sort((a, b) => a.rank - b.rank || String(nameOf(a.device)).localeCompare(String(nameOf(b.device)))).map(({ device, rank }) => ({ device, why: rank === 0 ? "same model" : rank === 1 ? "same kind of device" : "" }));
  }
  var confirmedByCluster = (index, dev) => {
    const out = /* @__PURE__ */ new Map();
    const m = slugify(dev && dev.manufacturer);
    const mo = slugify(dev && dev.model);
    for (const e of index || []) {
      if (e.manufacturer_slug !== m || e.model_slug !== mo) continue;
      for (const [hex2, c] of Object.entries(e.clusters || {})) {
        const key = hex2.toLowerCase();
        const cur = out.get(key) || { present: /* @__PURE__ */ new Set(), checked: false };
        if ((c.commands_received_scan_count || 0) > 0) cur.checked = true;
        for (const r of c.commands_received || []) if (r.present === true) cur.present.add(r.name);
        out.set(key, cur);
      }
    }
    return out;
  };
  function commandGaps(index, oldDev, newDev, clusterIds) {
    const oldC = confirmedByCluster(index, oldDev);
    const newC = confirmedByCluster(index, newDev);
    const gaps = [];
    let unknown = !oldC.size || !newC.size;
    for (const id of clusterIds || []) {
      const hex2 = `0x${Number(id).toString(16).padStart(4, "0")}`;
      const o = oldC.get(hex2);
      const n = newC.get(hex2);
      if (!o || !o.checked || !n || !n.checked) {
        unknown = true;
        continue;
      }
      const missing = [...o.present].filter((name) => !n.present.has(name)).sort();
      if (missing.length) gaps.push({ clusterId: Number(id), missing });
    }
    return { gaps, unknown };
  }
  var VERDICT = {
    all: { level: "success", icon: "\u2705", text: "Can do everything the old device did." },
    most: { level: "warning", icon: "\u26A0", text: "Can do most of it. What it can't do is unticked below." },
    none: { level: "error", icon: "\u274C", text: "Not suitable: it can't do what the old device did." },
    unknown: { level: "info", icon: "\u2139", text: "The new device's clusters aren't known yet, so nothing could be checked." },
    nothing: { level: "info", icon: "\u2139", text: "Nothing to copy: no bindings to or from the old device, and no groups, in the saved scans." }
  };
  var RESULT_LABEL = {
    confirmed: "\u2705 confirmed",
    rejected: "\u274C not accepted",
    waiting: "\u23F3 waiting for a button press",
    added: "\u2705 added",
    failed: "\u274C failed"
  };
  function defaultSelection(plan) {
    return new Set((plan && plan.items || []).filter((i) => i.ok !== false && i.new_ep != null).map((i) => i.id));
  }
  function runSummary(results) {
    const v = Object.values(results || {});
    const n = (s) => v.filter((x) => x === s).length;
    const parts = [];
    if (n("confirmed") + n("added")) parts.push(`${n("confirmed") + n("added")} copied and confirmed`);
    if (n("waiting")) parts.push(`${n("waiting")} waiting for a button press on a battery device (they go on automatically when it wakes up)`);
    if (n("rejected") + n("failed")) parts.push(`${n("rejected") + n("failed")} not accepted`);
    return { level: n("rejected") + n("failed") ? "warning" : n("waiting") ? "info" : "success", text: parts.join(", ") || "Nothing was copied." };
  }

  // src/questions.json
  var questions_default = {
    schema: 1,
    version: 2,
    about: "Questions about how a Zigbee device behaves in real use: things a capability scan can't show. Shared by every tool that asks them (ZHA Bindings Manager, the issue form, the website). Answers are stored per firmware and per use in each device file under device_answers and summarised in data/answers.json. Ids never change meaning: reword a question freely, but add a new id for a different question.",
    free_text_max: 280,
    device_types: [
      { id: "remote", label: "Remote, button or battery switch (sends commands, no load)" },
      { id: "wall_switch", label: "Wall switch or rocker with a relay (can switch a load)" },
      { id: "switch_module", label: "Switch module behind a normal wall switch (e.g. Sonoff ZBMINI)" },
      { id: "light", label: "Light, bulb or LED driver" },
      { id: "plug", label: "Plug, socket or in-line relay" },
      { id: "cover", label: "Blind, curtain or shutter motor" },
      { id: "sensor", label: "Sensor (motion, contact, temperature, leak\u2026)" },
      { id: "other", label: "Something else" }
    ],
    context: [
      {
        id: "system",
        text: "Which Zigbee system do you use it with?",
        answers: [
          { id: "zha", label: "ZHA (Home Assistant)" },
          { id: "z2m", label: "Zigbee2MQTT" },
          { id: "deconz", label: "deCONZ / Phoscon" },
          { id: "hub", label: "A vendor hub (Hue, IKEA, Aqara\u2026)" },
          { id: "other", label: "Something else" }
        ]
      },
      {
        id: "coordinator",
        text: "What chip is your coordinator?",
        help: "Some behaviour depends on the coordinator, not the device.",
        answers: [
          { id: "silabs", label: "Silicon Labs (EFR32 / EmberZNet, e.g. Sonoff Dongle-E/M, SkyConnect, ZBT-1)" },
          { id: "ti", label: "Texas Instruments (CC2652 / CC1352, e.g. Sonoff Dongle-P)" },
          { id: "conbee", label: "ConBee / RaspBee" },
          { id: "other", label: "Something else" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "owned_for",
        text: "How long have you had it?",
        answers: [
          { id: "lt_month", label: "Less than a month" },
          { id: "lt_year", label: "1 to 12 months" },
          { id: "gt_year", label: "Over a year" }
        ]
      }
    ],
    use: {
      id: "use",
      text: "What do you use this one for?",
      help: "Answer for this one device. Everything else is read in the light of it: a rocker can be great as a wired switch and poor as a remote.",
      allow_other: true,
      answers_by_type: {
        remote: [
          { id: "control_lights", label: "Controlling lights directly (bound to them or to a group)" },
          { id: "automations", label: "Buttons for automations only" },
          { id: "scenes", label: "Scene controller" }
        ],
        wall_switch: [
          { id: "wired_own_load", label: "Wired, switching its own light" },
          { id: "decoupled_smart_bulbs", label: "Wired, button separated from the relay, controlling smart bulbs" },
          { id: "remote_only", label: "Not switching a load: used as a remote" },
          { id: "automations", label: "Buttons for automations only" }
        ],
        switch_module: [
          { id: "wired_own_load", label: "Wired to a normal switch, switching its own light" },
          { id: "decoupled_smart_bulbs", label: "Switch input separated from the relay, controlling smart bulbs" },
          { id: "zigbee_only", label: "No switch wired to it: switched only over Zigbee" }
        ],
        light: [
          { id: "main_light", label: "Main room light" },
          { id: "lamp", label: "Lamp" },
          { id: "accent", label: "Accent, strip or spot" },
          { id: "outdoor", label: "Outdoor" }
        ],
        plug: [
          { id: "lamp", label: "A lamp" },
          { id: "appliance", label: "An appliance" },
          { id: "power_monitoring", label: "Mainly measuring power" },
          { id: "router", label: "Mainly as a router (repeater)" }
        ],
        cover: [
          { id: "blind", label: "Roller or venetian blind" },
          { id: "curtain", label: "Curtain" },
          { id: "shutter", label: "Shutter or garage door" }
        ],
        sensor: [
          { id: "lighting", label: "Switching lights" },
          { id: "security", label: "Security or alarm" },
          { id: "climate", label: "Heating or climate" },
          { id: "leak", label: "Leak or safety" }
        ],
        other: [
          { id: "general", label: "General use" }
        ]
      }
    },
    questions: [
      {
        id: "stays_connected",
        topic: "connection",
        text: "Does it stay connected?",
        types: ["remote", "wall_switch", "switch_module", "light", "plug", "cover", "sensor", "other"],
        answers: [
          { id: "always", label: "Always" },
          { id: "drops_occasionally", label: "Drops off occasionally" },
          { id: "drops_often", label: "Drops off often" }
        ]
      },
      {
        id: "routers",
        topic: "connection",
        text: "Which routers does it work through?",
        help: "Some devices only stay connected through certain brands of router, or only directly to the coordinator.",
        types: ["remote", "switch_module", "sensor", "other"],
        answers: [
          { id: "any", label: "Any router" },
          { id: "some_brands", label: "Only some brands" },
          { id: "coordinator_only", label: "Only directly to the coordinator" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "rejoins",
        topic: "connection",
        text: "If it drops off, does it come back?",
        types: ["remote", "wall_switch", "switch_module", "light", "plug", "cover", "sensor", "other"],
        answers: [
          { id: "by_itself", label: "Yes, by itself" },
          { id: "after_press", label: "After a button press" },
          { id: "needs_repair", label: "Only by pairing it again" },
          { id: "never_dropped", label: "It has never dropped" }
        ]
      },
      {
        id: "pairing",
        topic: "pairing",
        text: "Did pairing work as the manual says?",
        types: ["remote", "wall_switch", "switch_module", "light", "plug", "cover", "sensor", "other"],
        allow_other: true,
        other_label: "It needed a trick (tell us)",
        answers: [
          { id: "first_time", label: "First time" },
          { id: "several_tries", label: "Took several tries" }
        ]
      },
      {
        id: "direct_control",
        topic: "direct_control",
        text: "Does it control lights directly when your Zigbee system or Home Assistant is off?",
        help: "Bound straight to the lights, not through an automation.",
        types: ["remote", "wall_switch", "switch_module"],
        uses: ["control_lights", "scenes", "decoupled_smart_bulbs", "remote_only"],
        answers: [
          { id: "yes", label: "Yes, bound to the lights" },
          { id: "group_only", label: "Only through a group" },
          { id: "no", label: "No" },
          { id: "didnt_try", label: "Didn't try" }
        ]
      },
      {
        id: "press_sends",
        topic: "direct_control",
        text: "What does a press send?",
        help: "With Toggle, two remotes on the same light can get out of step; separate On and Off can't.",
        types: ["remote", "wall_switch", "switch_module"],
        uses: ["control_lights", "scenes", "decoupled_smart_bulbs", "remote_only"],
        answers: [
          { id: "toggle", label: "Toggle" },
          { id: "on_and_off", label: "Separate On and Off" },
          { id: "depends_on_mode", label: "Depends on a mode setting" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "needed_setting",
        topic: "direct_control",
        text: "Did it need a setting changed before it controlled lights directly?",
        types: ["remote", "wall_switch", "switch_module"],
        uses: ["control_lights", "scenes", "decoupled_smart_bulbs", "remote_only"],
        allow_other: true,
        other_label: "Yes, something else (tell us)",
        answers: [
          { id: "no", label: "No" },
          { id: "mode_setting", label: "Yes, a mode setting" },
          { id: "button_sequence", label: "Yes, a button sequence" },
          { id: "never_worked", label: "It never worked" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "presses_arrive",
        topic: "direct_control",
        text: "Does every press arrive?",
        types: ["remote", "wall_switch", "switch_module"],
        uses: ["control_lights", "scenes", "decoupled_smart_bulbs", "remote_only", "automations"],
        answers: [
          { id: "always", label: "Always" },
          { id: "sometimes_missed", label: "Sometimes missed" },
          { id: "often_missed", label: "Often missed" }
        ]
      },
      {
        id: "hold_to_dim",
        topic: "direct_control",
        text: "Does holding a button dim the lights?",
        types: ["remote", "wall_switch"],
        uses: ["control_lights", "scenes", "decoupled_smart_bulbs", "remote_only"],
        answers: [
          { id: "works", label: "Yes" },
          { id: "no", label: "No" },
          { id: "no_dim_buttons", label: "It has no dim buttons" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "keeps_bindings",
        topic: "direct_control",
        text: "Does it keep its bindings after a battery change, power cut or firmware update?",
        types: ["remote", "wall_switch", "switch_module"],
        uses: ["control_lights", "scenes", "decoupled_smart_bulbs", "remote_only"],
        answers: [
          { id: "yes", label: "Yes" },
          { id: "lost_them", label: "It lost them" },
          { id: "not_seen", label: "Haven't had one yet" }
        ]
      },
      {
        id: "responds_to_bindings",
        topic: "direct_control",
        text: "Does it respond to remotes bound to it?",
        help: "Remotes or switches bound straight to it, not through an automation.",
        types: ["wall_switch", "switch_module", "light", "plug"],
        answers: [
          { id: "always", label: "Every time" },
          { id: "misses_some", label: "Misses some presses" },
          { id: "stops_until_rebound", label: "Stops responding until bound again" },
          { id: "not_bound", label: "Nothing is bound to it" }
        ]
      },
      {
        id: "decoupled",
        topic: "relay",
        text: "Can the button be separated from the relay (decoupled mode)?",
        types: ["wall_switch"],
        allow_other: true,
        other_label: "Yes, another way (tell us)",
        answers: [
          { id: "system_setting", label: "Yes, a setting in my Zigbee system" },
          { id: "button_sequence", label: "Yes, a button sequence on the device" },
          { id: "no", label: "No" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "input_detached",
        topic: "relay",
        text: "Can the switch wired to it be separated from the relay (detached mode)?",
        help: "Then the wall switch sends commands over Zigbee instead of switching the load itself.",
        types: ["switch_module"],
        allow_other: true,
        other_label: "Yes, some other way (tell us)",
        answers: [
          { id: "setting", label: "Yes, a setting in my Zigbee system" },
          { id: "no", label: "No" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "wiring",
        topic: "relay",
        text: "How is it wired?",
        types: ["wall_switch", "switch_module"],
        answers: [
          { id: "with_neutral", label: "With neutral" },
          { id: "no_neutral_fine", label: "Without neutral, works fine" },
          { id: "no_neutral_problems", label: "Without neutral, flickers or has problems" },
          { id: "battery", label: "Battery, not wired" }
        ]
      },
      {
        id: "power_on",
        topic: "power_cut",
        text: "What does it do after a power cut?",
        help: "Many devices list a power-on setting that they don't actually honour.",
        types: ["light", "plug", "wall_switch", "switch_module"],
        uses: ["main_light", "lamp", "accent", "outdoor", "appliance", "power_monitoring", "router", "wired_own_load", "decoupled_smart_bulbs", "zigbee_only"],
        answers: [
          { id: "last_state", label: "Goes back to how it was" },
          { id: "always_on", label: "Always comes on" },
          { id: "always_off", label: "Always stays off" },
          { id: "ignores_setting", label: "Ignores its power-on setting" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "remembers_colour",
        topic: "power_cut",
        text: "After a power cut, does it remember brightness and colour too?",
        types: ["light"],
        answers: [
          { id: "yes", label: "Yes" },
          { id: "on_only", label: "Only on or off" },
          { id: "no", label: "No" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "router_quality",
        topic: "connection",
        text: "Is it a good router for other devices?",
        types: ["light", "plug", "wall_switch", "switch_module"],
        answers: [
          { id: "good", label: "Yes" },
          { id: "children_drop", label: "Devices connected through it drop off" },
          { id: "not_a_router", label: "It isn't a router (it connects through others)" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "position_accurate",
        topic: "cover",
        text: "Does the position it reports match where it really is?",
        types: ["cover"],
        answers: [
          { id: "yes", label: "Yes" },
          { id: "drifts", label: "Drifts over time" },
          { id: "no", label: "No" }
        ]
      },
      {
        id: "reports_promptly",
        topic: "sensor",
        text: "Do its reports arrive promptly?",
        types: ["sensor"],
        answers: [
          { id: "instant", label: "Straight away" },
          { id: "delayed", label: "Noticeably delayed" },
          { id: "misses_some", label: "Some go missing" }
        ]
      },
      {
        id: "battery_life",
        topic: "battery",
        text: "How long do its batteries last?",
        types: ["remote", "sensor", "cover", "wall_switch"],
        answers: [
          { id: "lt_1m", label: "Less than a month" },
          { id: "m1_6", label: "1 to 6 months" },
          { id: "m6_12", label: "6 to 12 months" },
          { id: "gt_1y", label: "Over a year" },
          { id: "too_early", label: "Too early to say" },
          { id: "not_battery", label: "It isn't battery powered" }
        ]
      },
      {
        id: "battery_report",
        topic: "battery",
        text: "Is the battery level it reports right?",
        types: ["remote", "sensor", "cover", "wall_switch"],
        answers: [
          { id: "accurate", label: "Yes" },
          { id: "drops_suddenly", label: "Drops suddenly near the end" },
          { id: "stuck", label: "Stuck or never changes" },
          { id: "not_reported", label: "It doesn't report one" },
          { id: "not_battery", label: "It isn't battery powered" }
        ]
      },
      {
        id: "ota",
        topic: "firmware",
        text: "Has your Zigbee system offered it a firmware update?",
        types: ["remote", "wall_switch", "switch_module", "light", "plug", "cover", "sensor", "other"],
        answers: [
          { id: "worked", label: "Yes, and it worked" },
          { id: "failed", label: "Yes, but it failed" },
          { id: "never_offered", label: "Never offered" },
          { id: "not_sure", label: "Not sure" }
        ]
      },
      {
        id: "update_changed",
        topic: "firmware",
        text: "Did a firmware update change any of the above?",
        help: "Asked when you answered before on a different firmware.",
        types: ["remote", "wall_switch", "switch_module", "light", "plug", "cover", "sensor", "other"],
        after_firmware_change: true,
        allow_other: true,
        other_label: "Yes, something specific (tell us)",
        answers: [
          { id: "better", label: "Better" },
          { id: "worse", label: "Worse" },
          { id: "no_change", label: "No change" }
        ]
      }
    ],
    rating: {
      id: "rating",
      text: "Ignoring price, how good is it at what you use it for?",
      min: 1,
      max: 5,
      labels: { "1": "Poor", "2": "Not great", "3": "OK", "4": "Good", "5": "Excellent" },
      min_ratings_for_average: 3
    },
    tip: {
      id: "tip",
      text: "Anything the next person should know?",
      help: "Optional, up to 280 characters. No names, places or addresses. Shown after review."
    }
  };

  // src/evidence.js
  var HOUR = 36e5;
  function changedDevices(res, nameOf = (i) => i) {
    return Object.entries(res && res.addresses || {}).filter(([, h]) => Array.isArray(h) && h.length > 1).map(([ieee, h]) => ({ ieee: normIeee(ieee), name: nameOf(ieee), history: h, changes: h.length - 1 })).sort((a, b) => b.changes - a.changes || String(a.name).localeCompare(String(b.name)));
  }
  function historyLines(history) {
    return (history || []).map((e, i) => {
      const d = new Date(e.from);
      const when = isNaN(d) ? "" : d.toLocaleString(void 0, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const how = i === 0 ? "first seen" : e.seen === "joined" ? "announced by the device" : "seen in ZHA's device list";
      return { nwk: e.nwk, when, how };
    });
  }
  function addressFact(res, ieee) {
    const h = res && res.addresses && res.addresses[normIeee(ieee)];
    if (!h || !h.length) return null;
    const last = h[h.length - 1];
    return { nwk: last.nwk, changes: h.length - 1, since: last.from };
  }
  function noticeSummary(res, nameOf) {
    const changed = changedDevices(res, nameOf);
    const misses = (res && res.misses || []).length;
    const afterChange = (res && res.misses || []).filter((m) => m.address_changed_since_last_ok).length;
    if (!changed.length && !misses) return null;
    return { changed: changed.length, misses, afterChange, key: `${changed.reduce((n, c) => n + c.changes, 0)}|${misses}` };
  }
  var roleOf = (d) => {
    const t = String(d && d.device_type || "").toLowerCase();
    if (t.includes("coordinator")) return "coordinator";
    if (t.includes("router")) return "router";
    if (t.includes("end")) return "end_device";
    return "unknown";
  };
  function buildNetworkReport(res, devices, { firmwareOf = () => "", cardVersion = "", nowMs = Date.now() } = {}) {
    const since = Date.parse(res && res.since || "") || nowMs;
    const list2 = [...devices || []].sort((a, b) => roleOf(a).localeCompare(roleOf(b)) || String(a.model || "").localeCompare(String(b.model || "")));
    const ids2 = /* @__PURE__ */ new Map();
    list2.forEach((d, i) => ids2.set(normIeee(d.ieee), `d${i + 1}`));
    const hist = res && res.addresses || {};
    const hours = (iso) => Math.round((Date.parse(iso) - since) / HOUR * 10) / 10;
    const coord = list2.find((d) => roleOf(d) === "coordinator") || {};
    const record = {
      kind: "network_report",
      schema: 1,
      card_version: cardVersion,
      period: { days: Math.round((nowMs - since) / (24 * HOUR) * 10) / 10 },
      system: "zha",
      coordinator: { manufacturer: coord.manufacturer || "", model: coord.model || "", firmware: firmwareOf(coord) || "" },
      network: {
        devices: list2.length,
        routers: list2.filter((d) => roleOf(d) === "router").length,
        end_devices: list2.filter((d) => roleOf(d) === "end_device").length
      },
      devices: list2.map((d) => {
        const h = hist[normIeee(d.ieee)] || [];
        return {
          id: ids2.get(normIeee(d.ieee)),
          manufacturer: d.manufacturer || "",
          model: d.model || "",
          firmware: firmwareOf(d) || "",
          power: /battery/i.test(d.power_source || "") ? "battery" : /mains/i.test(d.power_source || "") ? "mains" : "unknown",
          role: roleOf(d),
          address_changes: Math.max(0, h.length - 1),
          changes: h.slice(1).map((e) => ({ after_hours: Math.max(0, hours(e.from)), seen: e.seen === "joined" ? "joined" : "snapshot" }))
        };
      }),
      pairs: [],
      misses: []
    };
    for (const [key, p] of Object.entries(res && res.pairs || {})) {
      const [remote, light] = key.split("|");
      const r = ids2.get(normIeee(remote));
      const l = ids2.get(normIeee(light));
      if (r && l) record.pairs.push({ remote: r, light: l, presses: p.presses || 0, followed: p.followed || 0, missed: p.missed || 0 });
    }
    for (const m of res && res.misses || []) {
      const r = ids2.get(normIeee(m.remote));
      const l = ids2.get(normIeee(m.light));
      if (!r || !l) continue;
      record.misses.push({
        remote: r,
        light: l,
        hours_since_last_ok: m.last_ok_at ? Math.round((Date.parse(m.at) - Date.parse(m.last_ok_at)) / HOUR * 10) / 10 : null,
        address_changed_since_last_ok: !!m.address_changed_since_last_ok,
        binding_in_last_read: !!m.binding_in_last_read
      });
    }
    return record;
  }
  function reportIssue(record) {
    const changed = record.devices.filter((d) => d.address_changes).length;
    const title = `[Network Report] ${record.devices.length} devices, ${changed} with address changes`;
    const body = "```json\n" + JSON.stringify(record, null, 2) + "\n```";
    const compact = "Shared from ZHA Bindings Manager (anonymised).\n\n```json\n" + JSON.stringify(record) + "\n```";
    const base = `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&labels=${encodeURIComponent("network-report")}`;
    const full = `${base}&body=${encodeURIComponent(compact)}`;
    const tooLong = full.length > 6e3;
    return {
      title,
      body,
      tooLong,
      url: tooLong ? `${base}&body=${encodeURIComponent("Shared from ZHA Bindings Manager (anonymised). Paste the copied JSON below this line:\n\n")}` : full
    };
  }

  // src/lost.js
  var POLICIES = ["off", "notify", "auto"];
  var POLICY_LABELS = {
    off: "Off",
    notify: "Tell me",
    auto: "Put back automatically"
  };
  var POLICY_HINTS = {
    off: "Not watched: nothing is checked or put back for this device.",
    notify: "Checked every night and whenever its bindings are read. A lost binding shows here and in Settings \u2192 Repairs.",
    auto: "Lost bindings are put back straight away, at most 3 times a day; after that it stops and tells you instead."
  };
  function lostSummary(res) {
    const devices = [];
    for (const [ieee, d] of Object.entries(res && res.devices || {})) {
      if (!d || d.policy === "off" || !Array.isArray(d.lost) || !d.lost.length) continue;
      devices.push({
        ieee: normIeee(ieee),
        name: d.name || ieee,
        policy: d.policy || "notify",
        lost: d.lost,
        queued: !!d.queued,
        autoPaused: !!d.auto_paused,
        lastCheck: d.last_check || null
      });
    }
    devices.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return {
      total: devices.reduce((n, d) => n + d.lost.length, 0),
      queued: devices.filter((d) => d.queued).length,
      paused: devices.filter((d) => d.autoPaused).length,
      devices
    };
  }
  function lostFor(res, ieee) {
    const key = normIeee(ieee || "");
    for (const [k, d] of Object.entries(res && res.devices || {})) {
      if (normIeee(k) === key) {
        return {
          policy: d.policy || "notify",
          lost: d.policy === "off" ? [] : d.lost || [],
          queued: !!d.queued,
          autoPaused: !!d.auto_paused,
          lastCheck: d.last_check || null,
          expected: d.expected || 0,
          fallback: !!d.fallback
        };
      }
    }
    return { policy: "notify", lost: [], queued: false, autoPaused: false, lastCheck: null, expected: 0, fallback: false };
  }
  function putBackMessage(results, nameOf = (i) => i) {
    const by = { put_back: [], still_missing: [], waiting: [], nothing: [] };
    for (const [ieee, st] of Object.entries(results || {})) (by[st] || by.nothing).push(nameOf(ieee));
    const parts = [];
    if (by.put_back.length) parts.push(`Put back on ${by.put_back.join(", ")}.`);
    if (by.waiting.length)
      parts.push(
        `${by.waiting.join(", ")} didn't answer (probably asleep). It'll be done the next time ${by.waiting.length === 1 ? "it wakes up" : "they wake up"}: press one of its buttons.`
      );
    if (by.still_missing.length)
      parts.push(
        `${by.still_missing.join(", ")} answered but still ${by.still_missing.length === 1 ? "doesn't" : "don't"} have ${by.still_missing.length === 1 ? "it" : "them"}: its binding table may be full.`
      );
    if (!parts.length) parts.push("Nothing to put back.");
    const level = by.still_missing.length ? "warning" : by.waiting.length ? "info" : "success";
    return { level, text: parts.join(" ") };
  }
  function sinceText(iso, nowMs = Date.now()) {
    const t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return "";
    const day = (ms) => {
      const d = new Date(ms);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };
    const days = Math.round((day(nowMs) - day(t)) / 864e5);
    if (days <= 0) {
      const d = new Date(t);
      return `today ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }
  var NOTICED_BY = {
    scan: "noticed by a scan",
    nightly: "noticed by the nightly check",
    press: "noticed after a button press",
    check: "noticed by Check for lost bindings",
    put_back: "still missing after Put back",
    replace: "copied from a replaced device, waiting for it to wake up"
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
      <button class="tab" data-view="groups">Groups</button>
      <button class="tab" data-view="capexplorer">Zigbee Capability Explorer</button>
      <button class="tab" data-view="advanced">Advanced</button>
      <button class="tab" data-view="mesh" id="tab-mesh" style="display:none" title="Beta: link quality and routes in your Zigbee mesh. Still being tested; it may change.">Network<sup class="tab-beta">beta</sup></button>
    </div>
    <input id="search" class="search" placeholder="Search devices\u2026">
    <span id="storage-mode-badge" class="storage-mode-badge muted"></span>
    <button class="btn" id="btn-refresh-devices" title="Reload device list">\u27F3 Devices</button>
    <button class="btn btn-primary" id="btn-scan" title="Read current bindings from your Zigbee devices">Scan bindings</button>
    <button class="btn btn-small" id="btn-rescan-settings" title="Scan settings">\u2699</button>
    <a id="card-version" class="card-version muted" href="${CHANGELOG_URL}" target="_blank" rel="noopener"
      title="ZHA Bindings Manager v${CARD_VERSION}. Click to open the changelog.">v${CARD_VERSION}</a>
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
    <div class="filter-group">
      <div class="filter-group-title">Storage</div>
      <div id="storage-mode-detail" class="hint"></div>
      <button type="button" class="btn btn-small" id="btn-use-shared-storage" style="display:none">Use shared storage</button>
      <button type="button" class="btn btn-small" id="btn-use-local-storage" style="display:none">Use this browser only</button>
      <div id="storage-backend-hint" class="hint" style="display:none">
        Your data is only saved in this browser. The optional ZHA Bindings Manager integration can save it
        centrally in Home Assistant instead, so it's available from every browser and device.
        <a href="https://github.com/hsolgaard/zha-bindings-manager-integration" target="_blank" rel="noopener">Learn more \u2192</a>
        <button type="button" class="btn btn-small" id="btn-dismiss-storage-hint">Dismiss</button>
      </div>
    </div>
    <div class="filter-group">
      <div class="filter-group-title">About</div>
      <div class="hint">ZHA Bindings Manager v${CARD_VERSION} \xB7
        <a href="${CHANGELOG_URL}" target="_blank" rel="noopener">Changelog</a></div>
      <div id="backend-version-line" class="hint"></div>
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
    <div id="map-route-banner" class="map-route-banner" style="display:none"></div>
    <div class="graph-wrap">
      <svg id="graph-svg" viewBox="0 0 1200 840" preserveAspectRatio="xMidYMid meet"></svg>
      <div id="graph-empty" class="graph-empty"></div>
    </div>
    <p class="hint">Drag a device onto another device (or onto a group) to create a binding. Click a line to inspect / remove it<span id="map-route-hint" style="display:none">, or to show the route its commands take through your routers (Network, beta)</span>.</p>
    <p id="graph-role-legend" class="hint" style="display:none">\u{1F579} badge = this device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here (e.g. a wired/local load alongside a Zigbee-bound one) \u2014 click the device, then Show endpoints\u2026, to see the per-endpoint breakdown.</p>
  </div>

  <div id="view-table" class="view">
    <div id="health-summary" class="health-summary" style="display:none"></div>
    <div id="lost-banner" class="stale-banner lost-banner" style="display:none"></div>
    <div id="evidence-banner" class="stale-banner evidence-banner" style="display:none"></div>
    <div id="stale-banner" class="stale-banner" style="display:none"></div>
    <div id="pending-banner" class="stale-banner pending-banner" style="display:none"></div>
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
        <th id="th-direction" data-sort="directionRank" style="display:none">Direction</th>
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

  <div id="view-groups" class="view"></div>
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
      <label class="row" id="fp-floor-wrap" style="display:none">Floor <select id="fp-floor"></select></label>
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
    <div id="fp-floor-help" class="fp-floor-help hint"></div>
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
    <p id="fp-role-legend" class="hint" style="display:none">\u{1F579} badge = this device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here (e.g. a wired/local load alongside a Zigbee-bound one) \u2014 click the device, then Show endpoints\u2026, to see the per-endpoint breakdown.</p>
  </div>

  <div id="view-capexplorer" class="view"></div>

  <div id="view-advanced" class="view"></div>

  <div id="view-mesh" class="view"></div>

  <div id="drawer" class="drawer" aria-hidden="true">
    <div class="drawer-header">
      <span id="drawer-title"></span>
      <button id="drawer-close" class="btn btn-small" title="Close">\u2715</button>
    </div>
    <div id="drawer-body" class="drawer-body"></div>
  </div>

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

  // src/storage/storage-provider.js
  var StorageProvider = class {
    /**
     * Generic per-card-instance key/value storage for simple preferences —
     * filters, node positions, endpoint annotations, floor plan state,
     * settings (retry count, scan batch size, etc). `key` is an opaque
     * string the caller chooses; the provider doesn't need to know what it
     * means, only how to namespace it per card instance.
     *
     * @param {string} cardId - this._config.id (or "default")
     * @param {string} key
     * @returns {Promise<any>} the stored value, or null if absent/unreadable
     */
    async getItem(cardId, key) {
      throw new Error("StorageProvider.getItem not implemented");
    }
    /** @returns {Promise<boolean>} true on success, false on a soft failure
     *  (quota exceeded, storage disabled) — never throws, matching the
     *  fail-soft behavior the scattered localStorage try/catch blocks had
     *  before this boundary existed. */
    async setItem(cardId, key, value) {
      throw new Error("StorageProvider.setItem not implemented");
    }
    /**
     * The one piece of state with real persistence semantics beyond plain
     * key/value — scan results. See the delivery plan's "latest /
     * last_complete observation split":
     *
     *   last_complete — the best known-good data per device, built up over
     *     time. Never regresses: a device that fails one scan attempt keeps
     *     whatever binding data its last successful scan produced.
     *   latest — the outcome of the most recent scan attempt as a whole,
     *     including which devices failed to respond or only partially
     *     responded. Fixes the bug where that information lived in memory
     *     only and silently vanished on a page reload, making a device that
     *     just failed to respond look identical to one that's fine.
     *
     * @returns {Promise<{
     *   last_complete: {savedAt: string, bindings: object} | null,
     *   latest: {attemptedAt: string, failures: string[], partial: object} | null
     * }>}
     */
    async getScanState(cardId) {
      throw new Error("StorageProvider.getScanState not implemented");
    }
    async setScanState(cardId, state) {
      throw new Error("StorageProvider.setScanState not implemented");
    }
    /** Learned per-device response-time/outcome history (see
     *  _recordScanOutcome/_historyFor in card.js) — kept separate from scan
     *  state since it's additive/rolling rather than latest-vs-complete.
     *  @returns {Promise<object>} ieee(lower) -> {successMs, outcomes, ...} */
    async getHistory(cardId) {
      throw new Error("StorageProvider.getHistory not implemented");
    }
    async setHistory(cardId, history) {
      throw new Error("StorageProvider.setHistory not implemented");
    }
  };

  // src/storage/local-storage-provider.js
  var LocalStorageProvider = class extends StorageProvider {
    _keyFor(cardId, key) {
      return `zha-binding-map-card:${cardId || "default"}:${key}`;
    }
    async getItem(cardId, key) {
      try {
        const raw = localStorage.getItem(this._keyFor(cardId, key));
        return raw == null ? null : JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    async setItem(cardId, key, value) {
      try {
        localStorage.setItem(this._keyFor(cardId, key), JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    }
    async getScanState(cardId) {
      const raw = await this.getItem(cardId, "scan-state");
      if (raw && (raw.last_complete || raw.latest)) return raw;
      const legacy = await this.getItem(cardId, "bindings");
      if (legacy && legacy.bindings) {
        return { last_complete: legacy, latest: null };
      }
      return { last_complete: null, latest: null };
    }
    async setScanState(cardId, state) {
      return this.setItem(cardId, "scan-state", state);
    }
    async getHistory(cardId) {
      const raw = await this.getItem(cardId, "history");
      return raw && typeof raw === "object" ? raw : {};
    }
    async setHistory(cardId, history) {
      return this.setItem(cardId, "history", history);
    }
  };

  // src/storage/ha-storage-provider.js
  var WS_GET_STATE = "zha_bindings_manager/get_state";
  var WS_SAVE_STATE = "zha_bindings_manager/save_state";
  var WS_GET_CAPABILITIES = "zha_bindings_manager/get_capabilities";
  var SAVE_DEBOUNCE_MS = 1500;
  var HaStorageProvider = class _HaStorageProvider extends StorageProvider {
    constructor(hass, cardId) {
      super();
      this._hass = hass;
      this._cardId = cardId || "default";
      this._state = null;
      this._updatedAt = null;
      this._loadPromise = null;
      this._saveTimer = null;
      this._savePromise = null;
      this._resolveSave = null;
    }
    /** Feature detection — a static-ish helper rather than an instance
     *  method, since card.js needs an answer *before* deciding whether to
     *  construct a HaStorageProvider at all. Returns false (not a thrown
     *  error) for "not installed", same as for any other failure — the
     *  caller only needs yes/no, not why. */
    static async isAvailable(hass) {
      return (await _HaStorageProvider.probe(hass)).available;
    }
    /** What the ZHA Bindings Manager integration reports about itself.
     *  - installed: the integration answered at all.
     *  - available: shared storage can be used (installed, and not switched
     *    off in the integration's options; integrations older than 1.0.0
     *    don't report features, so storage counts as on).
     *  - version: the integration's version (reported since 0.1.0).
     *  - bundledCardVersion: the card version the integration ships (1.0.0+).
     *  Unknown values are null. */
    static async probe(hass) {
      const none = { installed: false, available: false, version: null, bundledCardVersion: null, experimental: false, watch: false, replace: false, evidence: false, lqi: null };
      try {
        const res = await hass.connection.sendMessagePromise({ type: WS_GET_CAPABILITIES });
        if (!res || !res.available) return none;
        const str = (v) => typeof v === "string" && v ? v : null;
        const storageOff = !!(res.features && res.features.shared_storage === false);
        return {
          installed: true,
          available: !storageOff,
          version: str(res.version),
          bundledCardVersion: str(res.bundled_card_version),
          // 1.5.0 (local build): experimental features + link-quality thresholds.
          experimental: !!(res.features && res.features.experimental_features === true),
          // 1.8.0: the integration watches for lost bindings.
          watch: !!(res.features && res.features.binding_watch === true),
          // 1.9.0: Replace a device.
          replace: !!(res.features && res.features.replace === true),
          // 1.10.0: address changes and missed presses.
          evidence: !!(res.features && res.features.evidence === true),
          lqi: res.lqi_thresholds && Number.isInteger(res.lqi_thresholds.good) && Number.isInteger(res.lqi_thresholds.weak) ? { good: res.lqi_thresholds.good, weak: res.lqi_thresholds.weak } : null
        };
      } catch (e) {
        return none;
      }
    }
    async _ensureLoaded() {
      if (this._state) return this._state;
      if (!this._loadPromise) {
        this._loadPromise = this._hass.connection.sendMessagePromise({ type: WS_GET_STATE, card_id: this._cardId }).then((res) => {
          this._updatedAt = res ? res.updated_at : null;
          this._state = res && res.state || { items: {}, scanState: null, history: {} };
          return this._state;
        }).catch((e) => {
          console.warn("ZHA Binding Map: could not load shared state, starting empty:", e.message || e);
          this._state = { items: {}, scanState: null, history: {} };
          return this._state;
        });
      }
      return this._loadPromise;
    }
    _scheduleSave() {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      if (!this._savePromise) {
        this._savePromise = new Promise((resolve) => {
          this._resolveSave = resolve;
        });
      }
      this._saveTimer = setTimeout(() => this._flushSave(), SAVE_DEBOUNCE_MS);
      return this._savePromise;
    }
    async _flushSave() {
      this._saveTimer = null;
      try {
        const res = await this._hass.connection.sendMessagePromise({
          type: WS_SAVE_STATE,
          card_id: this._cardId,
          state: this._state,
          base_updated_at: this._updatedAt
        });
        this._updatedAt = res.updated_at;
      } catch (e) {
        if (e && e.code === "stale_write") {
          try {
            const fresh = await this._hass.connection.sendMessagePromise({
              type: WS_GET_STATE,
              card_id: this._cardId
            });
            this._updatedAt = fresh ? fresh.updated_at : null;
            const res2 = await this._hass.connection.sendMessagePromise({
              type: WS_SAVE_STATE,
              card_id: this._cardId,
              state: this._state,
              base_updated_at: this._updatedAt
            });
            this._updatedAt = res2.updated_at;
          } catch (e2) {
            console.warn("ZHA Binding Map: shared save failed after a conflict retry:", e2.message || e2);
          }
        } else {
          console.warn("ZHA Binding Map: shared save failed:", e.message || e);
        }
      } finally {
        if (this._resolveSave) this._resolveSave();
        this._savePromise = null;
        this._resolveSave = null;
      }
    }
    /** Flushes a pending debounced save immediately instead of waiting it
     *  out — not called anywhere yet in this milestone, kept available for
     *  call sites that later want to confirm a save actually landed (e.g.
     *  right before showing a "saved" confirmation) rather than trusting
     *  the debounce timer alone. */
    async flush() {
      if (this._saveTimer) {
        clearTimeout(this._saveTimer);
        await this._flushSave();
      } else if (this._savePromise) {
        await this._savePromise;
      }
    }
    async getItem(cardId, key) {
      const state = await this._ensureLoaded();
      return state.items && key in state.items ? state.items[key] : null;
    }
    async setItem(cardId, key, value) {
      const state = await this._ensureLoaded();
      if (!state.items) state.items = {};
      state.items[key] = value;
      this._scheduleSave();
      return true;
    }
    async getScanState(cardId) {
      const state = await this._ensureLoaded();
      return state.scanState || { last_complete: null, latest: null };
    }
    async setScanState(cardId, scanState) {
      const state = await this._ensureLoaded();
      state.scanState = scanState;
      this._scheduleSave();
      return true;
    }
    async getHistory(cardId) {
      const state = await this._ensureLoaded();
      return state.history || {};
    }
    async setHistory(cardId, history) {
      const state = await this._ensureLoaded();
      state.history = history;
      this._scheduleSave();
      return true;
    }
  };

  // src/stale-bindings.js
  function knownIeees(devices) {
    return new Set((devices || []).map((d) => normIeee(d.ieee)));
  }
  function removedSources(bindingsMap, devices) {
    const known = knownIeees(devices);
    const out = [];
    for (const [ieee, list2] of bindingsMap || []) {
      if (!known.has(normIeee(ieee))) out.push({ ieee, count: (list2 || []).length });
    }
    return out;
  }
  function deadTargetBindings(bindingsMap, devices) {
    const known = knownIeees(devices);
    const out = [];
    for (const [ieee, list2] of bindingsMap || []) {
      if (!known.has(normIeee(ieee))) continue;
      for (const b of list2 || []) {
        if (!b.isGroup && b.targetIeee && !known.has(normIeee(b.targetIeee))) out.push(b);
      }
    }
    return out;
  }
  function pruneRemovedSources(bindingsMap, devices) {
    if (!devices || !devices.length || !bindingsMap) return [];
    const removed = removedSources(bindingsMap, devices).map((r) => r.ieee);
    removed.forEach((ieee) => bindingsMap.delete(ieee));
    return removed;
  }
  function forgetSource(bindingsMap, ieee) {
    let dropped = 0;
    for (const key of [...bindingsMap.keys()]) {
      if (normIeee(key) === normIeee(ieee)) {
        dropped += (bindingsMap.get(key) || []).length;
        bindingsMap.delete(key);
      }
    }
    return dropped;
  }
  function vanishedDevices(prev, next) {
    if (!next || !next.length) return [];
    const now = knownIeees(next);
    return (prev || []).map((d) => normIeee(d.ieee)).filter((ieee) => !now.has(ieee));
  }
  function rememberDevices(known, devices, label) {
    let changed = false;
    for (const d of devices || []) {
      const ieee = normIeee(d.ieee);
      if (!ieee) continue;
      const info = {
        name: label(d) || "",
        manufacturer: d.manufacturer || "",
        model: d.model || "",
        area_id: d.area_id || null
      };
      const old = known.get(ieee);
      if (!old || old.name !== info.name || old.manufacturer !== info.manufacturer || old.model !== info.model || old.area_id !== info.area_id) {
        known.set(ieee, info);
        changed = true;
      }
    }
    return changed;
  }
  function knownDevicesToSave(known, devices, bindingsMap) {
    const keep = knownIeees(devices);
    for (const [ieee, list2] of bindingsMap || []) {
      keep.add(normIeee(ieee));
      for (const b of list2 || []) if (b.targetIeee) keep.add(normIeee(b.targetIeee));
    }
    const out = {};
    [...(known || /* @__PURE__ */ new Map()).keys()].filter((ieee) => keep.has(ieee)).sort().forEach((ieee) => out[ieee] = known.get(ieee));
    return out;
  }

  // src/about.js
  function aboutIntegrationText({ checked, installed, storageOn, version, bundledCardVersion, cardVersion }) {
    if (!checked) return "";
    if (!installed) {
      return "Card-only install. The ZHA Bindings Manager integration adds shared storage, a sidebar page and notices when a bound device is removed.";
    }
    const parts = [`ZHA Bindings Manager integration ${version ? "v" + version : "(version not reported)"} is installed.`];
    if (bundledCardVersion && bundledCardVersion !== cardVersion) {
      parts.push(
        `This page is running card v${cardVersion}, but the integration includes card v${bundledCardVersion}: another copy of the card loaded first. See Settings \u2192 Repairs.`
      );
    }
    if (!storageOn) parts.push("Shared storage is switched off in the integration's options.");
    return parts.join(" ");
  }

  // src/scan-summary.js
  function isBatteryPowered(device) {
    return !!(device && device.power_source && /battery/i.test(device.power_source));
  }
  function toolkitAvailable(hass, service = "binds_get") {
    return !!(hass && hass.services && hass.services.zha_toolkit && hass.services.zha_toolkit[service]);
  }
  function shortError(err) {
    const text = String(err && (err.message || err) || "").replace(/\s+/g, " ").trim();
    return text.length > 180 ? `${text.slice(0, 177)}\u2026` : text;
  }
  function nameList(names, max = 3) {
    if (names.length <= max) return names.join(", ");
    return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
  }
  function summarizeScan({ okCount, partialCount, failures, skippedNames = [], prunedCount = 0 }) {
    const failed = failures || [];
    const battery = failed.filter((f) => isBatteryPowered(f.device));
    const mains = failed.filter((f) => !isBatteryPowered(f.device));
    const extras = [];
    if (skippedNames.length) extras.push(`skipped ${skippedNames.join(", ")} (no longer in ZHA)`);
    if (prunedCount) extras.push(`cleared saved data for ${prunedCount} device(s) no longer in ZHA`);
    const tail = extras.length ? ` Also ${extras.join("; ")}.` : "";
    if (okCount === 0 && partialCount === 0 && failed.length >= 2 && mains.length > 0) {
      const firstError = shortError((mains[0] || failed[0]).error);
      return {
        level: "error",
        message: `Scan failed: no device responded (${failed.length} of ${failed.length}), including mains-powered devices that never sleep, so this isn't sleepy devices. It usually means zha-toolkit isn't working. ` + (firstError ? `First error: "${firstError}". ` : "") + `Check Settings \u2192 System \u2192 Logs for zha_toolkit errors.` + tail
      };
    }
    const parts = [`${okCount} device(s) read`];
    if (partialCount) parts.push(`${partialCount} partial (a later page timed out \u2014 rescan for the rest)`);
    if (mains.length) {
      parts.push(
        `${mains.length} mains-powered device(s) did not respond (check they're online in ZHA): ${nameList(
          mains.map((f) => f.name)
        )}`
      );
    }
    if (battery.length) {
      parts.push(
        `${battery.length} battery device(s) did not respond (normal, they sleep: wake one and use its Rescan)`
      );
    }
    const level = mains.length ? "error" : battery.length || partialCount ? "info" : "success";
    return { level, message: `Scan complete: ${parts.join(", ")}.${tail}` };
  }

  // src/health-rules.js
  var BASIC_CLUSTER = 0;
  function isManufacturerSpecific(clusterId) {
    const id = Number(clusterId);
    return id >= 64512 && id <= 65535;
  }
  function manufacturerSpecificRule(clusterId) {
    const hex2 = `0x${Number(clusterId).toString(16).padStart(4, "0")}`;
    return {
      level: "info",
      code: "manufacturer_specific",
      message: `Manufacturer-specific cluster (${hex2}), not checked.`,
      why: "Clusters from 0xFC00 up aren't part of the Zigbee standard: each manufacturer uses them for its own features, and devices usually set these bindings up themselves. The card can't tell what they do, so it doesn't check them.",
      recommendation: "Leave it in place unless you know the device doesn't need it."
    };
  }
  function unusualDeviceBindingRule({ clusterId, classification }) {
    if (Number(clusterId) === BASIC_CLUSTER) {
      return {
        level: "warning",
        code: "unusual_basic",
        message: "Unusual binding: Basic cluster bound to another device.",
        why: "The Basic cluster only holds device information such as the manufacturer and model. Binding it to another device doesn't let either one control the other. Bindings like this are usually left by a manufacturer's pairing routine or created by mistake, often in the wrong direction (for example from a light to its remote).",
        recommendation: "Unless a device's manual says it needs this, it's safe to remove. To control a light from a switch, bind On/Off (and Level Control for dimming) from the switch to the light."
      };
    }
    if (classification === "reporting") {
      return {
        level: "info",
        code: "reporting_to_device",
        message: "Reporting binding to another device, not a control binding.",
        why: "The source sends its own status for this cluster to the target, rather than sending it commands. That is sometimes intended (for example a temperature sensor reporting to a thermostat), but it doesn't let the source control the target.",
        recommendation: "If you meant the source to control the target, check the direction: the binding should start on the device that sends the commands, such as a switch or remote."
      };
    }
    return null;
  }

  // src/deep-link.js
  function deepLinkIeee(search) {
    let raw;
    try {
      raw = new URLSearchParams(search || "").get("device");
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    const hex2 = raw.toLowerCase().replace(/[^0-9a-f]/g, "");
    if (hex2.length !== 16) return null;
    return hex2.match(/../g).join(":");
  }
  function withoutDeviceParam(search) {
    const params = new URLSearchParams(search || "");
    params.delete("device");
    const s = params.toString();
    return s ? `?${s}` : "";
  }
  var TAB_NAMES = {
    graph: "map",
    floorplan: "floor-plan",
    table: "bindings",
    devices: "devices",
    groups: "groups",
    capexplorer: "capabilities",
    advanced: "advanced",
    mesh: "network"
  };
  function viewFromHash(hash) {
    const name = String(hash || "").replace(/^#/, "").trim().toLowerCase();
    if (!name) return null;
    const hit = Object.entries(TAB_NAMES).find(([, n]) => n === name);
    return hit ? hit[0] : null;
  }
  function hashForView(view) {
    return `#${TAB_NAMES[view] || TAB_NAMES.graph}`;
  }

  // src/group-support.js
  function groupClusterSupport({ members, clusterId, clustersFor }) {
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
  var plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  var list = (names) => names.join(", ");
  function groupSupportSummary(res, clusterLabel2, groupName) {
    if (!res.total) {
      return {
        level: "empty",
        text: `${groupName} has no members yet, so nothing will act on ${clusterLabel2} commands sent to it.`
      };
    }
    const known = res.supported.length + res.unsupported.length;
    const unknownNote = res.unknown.length ? ` Not checked yet: ${list(res.unknown)}.` : "";
    if (!known) {
      return { level: "unknown", text: `Checking which devices in ${groupName} support ${clusterLabel2}\u2026` };
    }
    if (!res.unsupported.length) {
      return {
        level: "ok",
        text: `${res.supported.length === res.total ? res.total === 1 ? "The device" : `All ${res.total} devices` : plural(res.supported.length, "device", "devices")} in ${groupName} support${res.supported.length === 1 ? "s" : ""} ${clusterLabel2}.${unknownNote}`
      };
    }
    if (!res.supported.length) {
      return {
        level: "warning",
        text: `No device in ${groupName} supports ${clusterLabel2} (${list(res.unsupported)}). The binding can still be made, but nothing in the group will act on these commands.${unknownNote}`
      };
    }
    return {
      level: "info",
      text: `${res.supported.length} of ${res.total} devices in ${groupName} support ${clusterLabel2} (${list(
        res.supported
      )}). Not supported: ${list(res.unsupported)}, which will ignore these commands.${unknownNote}`
    };
  }
  function groupSupportHealth(res, clusterLabel2, groupName) {
    if (!res.total) {
      return {
        level: "warning",
        code: "group_empty",
        message: `${groupName} has no members.`,
        why: "Commands sent to an empty group reach nothing. This often happens when the lights in a group were removed or re-paired.",
        recommendation: "Add devices to the group in ZHA, or remove this binding."
      };
    }
    if (!res.unsupported.length) return null;
    if (!res.supported.length) {
      return {
        level: "warning",
        code: "group_cluster_unsupported",
        message: `No device in ${groupName} supports ${clusterLabel2}.`,
        why: `The source sends ${clusterLabel2} commands to the group, but none of its members (${list(
          res.unsupported
        )}) can act on them. The binding is valid but does nothing, and it uses one of the source's binding-table slots.`,
        recommendation: `Remove this binding, or add a device that supports ${clusterLabel2} to the group.`
      };
    }
    return {
      level: "info",
      code: "group_cluster_partial",
      message: `${res.supported.length} of ${res.total} devices in ${groupName} support ${clusterLabel2}.`,
      why: `Not supported: ${list(res.unsupported)}. Those devices ignore these commands, while the others act on them.`,
      recommendation: null
    };
  }

  // src/group-flow.js
  var FLOW_CLUSTERS = [6, 8, 768, 258];
  function testInstruction(clusterIds) {
    const ids2 = new Set([...clusterIds || []].map(Number));
    const parts = [];
    if (ids2.has(6)) parts.push("press on/off");
    if (ids2.has(8)) parts.push(ids2.has(6) ? "then hold to dim" : "hold to dim");
    if (ids2.has(258)) parts.push(parts.length ? "and press open/close" : "press open, then close");
    if (!parts.length) parts.push("press its buttons");
    const text = parts.join(", ").replace(/, and /, " and ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  var DIRECT_BINDING_MAX_LIGHTS = 4;
  var RESULTS = ["works", "partial", "stored_ignored", "rejected"];
  var GROUPS_CLUSTER = 4;
  function endpointHasGroups(clusters, endpoint) {
    return (clusters || []).some(
      (c) => c.type === "in" && Number(c.id) === GROUPS_CLUSTER && Number(c.endpoint_id) === Number(endpoint)
    );
  }
  function controllerEndpoints(clusters) {
    const byEp = /* @__PURE__ */ new Map();
    for (const c of clusters || []) {
      if (c.type !== "out" || !FLOW_CLUSTERS.includes(Number(c.id))) continue;
      const ep = Number(c.endpoint_id);
      if (!byEp.has(ep)) byEp.set(ep, /* @__PURE__ */ new Set());
      byEp.get(ep).add(Number(c.id));
    }
    return [...byEp.entries()].sort((a, b) => a[0] - b[0]).map(([endpoint, set]) => ({ endpoint, clusters: [...set].sort((a, b) => a - b) }));
  }
  function candidateTargets({ devices, clustersFor, sourceIeee, clusterIds }) {
    const out = [];
    for (const d of devices || []) {
      if (d.isCoordinator || String(d.ieee).toLowerCase() === String(sourceIeee).toLowerCase()) continue;
      const clusters = clustersFor(d.ieee);
      if (!clusters) continue;
      const byEp = /* @__PURE__ */ new Map();
      for (const c of clusters) {
        if (c.type !== "in" || !clusterIds.includes(Number(c.id))) continue;
        const ep = Number(c.endpoint_id);
        if (!byEp.has(ep)) byEp.set(ep, /* @__PURE__ */ new Set());
        byEp.get(ep).add(Number(c.id));
      }
      const multi = byEp.size > 1;
      for (const [endpoint, set] of byEp) {
        out.push({
          ieee: d.ieee,
          endpoint,
          name: multi ? `${d.name} (ep ${endpoint})` : d.name,
          clusters: [...set].sort((a, b) => a - b),
          groupable: endpointHasGroups(clusters, endpoint)
        });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, void 0, { sensitivity: "base" }));
  }
  function modeOptions(targets, { clusterCount = 1 } = {}) {
    const list2 = targets || [];
    const blocked = list2.filter((t) => t.groupable === false).map((t) => t.name);
    const n = list2.length;
    const slots = n * Math.max(1, clusterCount);
    return {
      direct: {
        ok: true,
        warning: n > DIRECT_BINDING_MAX_LIGHTS ? `Directly, ${n} devices need about ${slots} binding-table slots on the remote. Many remotes run out sooner; the card checks each binding, so any that don't fit will show as failed.` : ""
      },
      group: {
        ok: blocked.length === 0,
        blocked,
        reason: blocked.length ? `${blocked.join(", ")} can't join groups (no Groups cluster), so ${blocked.length === 1 ? "it needs" : "they need"} to be controlled directly.` : ""
      }
    };
  }
  function suggestMode(targets, { groupKnown = null, directKnown = null } = {}) {
    const list2 = targets || [];
    if (!modeOptions(list2).group.ok) return "direct";
    const groupBad = !!groupKnown && groupKnown.state === "problems";
    const directBad = !!directKnown && directKnown.state === "problems";
    if (groupBad && !directBad) return "direct";
    if (directBad && !groupBad) return "group";
    if (list2.length > DIRECT_BINDING_MAX_LIGHTS) return "group";
    return list2.length <= 1 ? "direct" : "group";
  }
  var targetKey = (t) => `${String(t.ieee).toLowerCase()}:${Number(t.endpoint)}`;
  function findMatchingGroup(groups, targets, coordinatorIeee) {
    const want = new Set(targets.map(targetKey));
    const coord = String(coordinatorIeee || "").toLowerCase();
    return (groups || []).find((g) => {
      const have = (g.members || []).filter((m) => m.device && String(m.device.ieee).toLowerCase() !== coord).map((m) => targetKey({ ieee: m.device.ieee, endpoint: m.endpoint_id }));
      return have.length === want.size && have.every((k) => want.has(k));
    }) || null;
  }
  function missingMembers(group, targets) {
    const have = new Set(
      (group && group.members || []).filter((m) => m.device).map((m) => targetKey({ ieee: m.device.ieee, endpoint: m.endpoint_id }))
    );
    return targets.filter((t) => !have.has(targetKey(t)));
  }
  function planClusters(sourceClusters, targets, clustersFor) {
    return (sourceClusters || []).map((clusterId) => {
      const support = groupClusterSupport({
        members: targets.map((t) => ({ ieee: t.ieee, endpoint: t.endpoint, name: t.name })),
        clusterId,
        clustersFor
      });
      return { clusterId, support, include: support.supported.length > 0 };
    });
  }
  function flowResult(bindOutcomes, testAnswer) {
    const outs = bindOutcomes || [];
    if (outs.length && outs.every((o) => o === "failed")) return "rejected";
    if (outs.some((o) => o === "unconfirmed")) return "unconfirmed";
    if (!testAnswer) return "pending_test";
    if (testAnswer === "all") return outs.some((o) => o === "failed") ? "partial" : "works";
    if (testAnswer === "some") return "partial";
    return "stored_ignored";
  }
  var hex = (id) => `0x${Number(id).toString(16).padStart(4, "0")}`;
  function buildBehaviourReport({ manufacturer, model, firmware, mode, endpoint, clusters, targetCount, result, cardVersion, now }) {
    return {
      kind: "behaviour_report",
      schema: 1,
      behaviour: mode === "direct" ? "direct_binding" : "group_binding",
      manufacturer: manufacturer || null,
      model: model || null,
      firmware: {
        sw_build_id: firmware && firmware.sw_build_id || null,
        registry_sw_version: firmware && firmware.registry_sw_version || null
      },
      endpoint,
      clusters: (clusters || []).map(hex),
      target_count: targetCount,
      result,
      card_version: cardVersion,
      provenance: { submitted_at: (now || /* @__PURE__ */ new Date()).toISOString() }
    };
  }
  function reportsForClusters(byClusters, clusterIds) {
    const want = new Set([...clusterIds].map(hex));
    let out = null;
    for (const [key, group] of Object.entries(byClusters || {})) {
      if (!key.split(",").some((c) => want.has(c.trim().toLowerCase()))) continue;
      out = out || { counts: {}, by_firmware: {} };
      for (const [r, n] of Object.entries(group.counts || {})) out.counts[r] = (out.counts[r] || 0) + n;
      for (const [fw, counts] of Object.entries(group.by_firmware || {})) {
        const t = out.by_firmware[fw] = out.by_firmware[fw] || {};
        for (const [r, n] of Object.entries(counts)) t[r] = (t[r] || 0) + n;
      }
    }
    return out;
  }
  var RESULT_TEXT = {
    works: "works",
    partial: "works for some lights",
    stored_ignored: "stored but ignored",
    rejected: "rejected"
  };
  function firmwareKey2(fw) {
    return fw && (fw.sw_build_id || fw.registry_sw_version) || "unknown";
  }
  function knownBehaviour(doc, slugKey, behaviour, firmware, clusterIds = null) {
    let entry = doc && doc[slugKey] && doc[slugKey][behaviour];
    if (entry && entry.by_clusters && clusterIds && [...clusterIds].length) {
      entry = reportsForClusters(entry.by_clusters, clusterIds);
    }
    if (!entry || !entry.counts) {
      return {
        state: "unknown",
        total: 0,
        text: "Nobody has reported how this remote handles this yet. The card will test it, and you can share the result."
      };
    }
    const fwKey = firmwareKey2(firmware);
    const fwCounts = entry.by_firmware && entry.by_firmware[fwKey];
    const counts = fwCounts || entry.counts;
    const total = RESULTS.reduce((n, r) => n + (counts[r] || 0), 0);
    const good = (counts.works || 0) + (counts.partial || 0);
    const bad = (counts.stored_ignored || 0) + (counts.rejected || 0);
    const state = !total ? "unknown" : bad === 0 ? "works" : good === 0 ? "problems" : "mixed";
    const parts = RESULTS.filter((r) => counts[r]).map((r) => `${counts[r]} ${RESULT_TEXT[r]}`);
    const scope = fwCounts ? fwKey === "unknown" ? "" : ` on firmware ${fwKey}` : ` (on other firmware than yours${fwKey === "unknown" ? "" : `, ${fwKey}`})`;
    const lead = state === "works" ? "Reported to work" : state === "problems" ? "Other users found this doesn't work" : "Reports are mixed";
    return {
      state,
      total,
      counts,
      firmwareMatched: !!fwCounts,
      text: `${lead}${scope}: ${parts.join(", ")} (${total} report${total === 1 ? "" : "s"}).`
    };
  }
  function suggestGroupName(areaName, remoteName) {
    const base = areaName && areaName !== "No area" ? areaName : remoteName || "Remote";
    return `${base} lights`;
  }
  function undoPlan(items, { createdGroup = false, groupId = null } = {}) {
    const unbind = (items || []).filter((i) => !i.existedBefore && i.outcome !== "failed");
    return { unbind, deleteGroup: !!createdGroup && groupId != null, empty: !unbind.length && !(createdGroup && groupId != null) };
  }
  function undoSummary(outcomes, { groupDeleted = null, groupName = "" } = {}) {
    const n = (k) => outcomes.filter((o) => o === k).length;
    const removed = n("confirmed") + n("absent");
    const parts = [];
    if (removed) parts.push(`Removed ${removed} binding${removed === 1 ? "" : "s"}.`);
    if (n("unconfirmed"))
      parts.push(`${n("unconfirmed")} not confirmed yet: the remote didn't answer the check. They're kept on the pending list and checked again when it next answers.`);
    if (n("failed")) parts.push(`${n("failed")} still on the remote: it didn't accept the removal.`);
    if (groupDeleted === true) parts.push(`Deleted the group ${groupName}.`);
    if (groupDeleted === false) parts.push(`Couldn't delete the group ${groupName}: remove it in the Groups tab.`);
    if (groupDeleted === "kept")
      parts.push(`Kept the group ${groupName}, as the remote may still have a binding to it: delete it in the Groups tab once that's gone.`);
    return parts.join(" ") || "Nothing to remove.";
  }

  // src/command-check.js
  var COMMAND_CHECK_LIMIT_MS = 12e4;
  function formatElapsed(ms) {
    const total = Math.max(0, Math.floor((ms || 0) / 1e3));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  function shouldApplyResult(entry, token, ok) {
    if (!entry) return false;
    if (ok) return entry.status !== "done" || entry.token === token;
    return entry.token === token && entry.status !== "done";
  }

  // src/action-verify.js
  function bindOutcome({ present, sourceRead }) {
    if (present) return "confirmed";
    return sourceRead ? "failed" : "unconfirmed";
  }
  function unbindOutcome({ before, present, sourceRead }) {
    if (sourceRead) {
      if (present) return "failed";
      return before === false ? "absent" : "confirmed";
    }
    return before === false && !present ? "absent" : "unconfirmed";
  }
  var OUTCOME_LEVEL = {
    confirmed: "success",
    absent: "success",
    unconfirmed: "warning",
    failed: "error"
  };
  function pendingKey(p) {
    const t = p.target && p.target.isGroup ? `g:${p.target.groupId}` : `d:${String(p.target && p.target.ieee || "").toLowerCase()}:${p.target ? p.target.endpoint : ""}`;
    return `${p.kind}|${String(p.sourceIeee).toLowerCase()}|${p.sourceEndpoint}|${p.clusterId}|${t}`;
  }
  function reconcilePending(entries, { isPresent, wasRead }) {
    const pending = [];
    const resolved = [];
    for (const entry of entries || []) {
      if (!wasRead(entry.sourceIeee)) {
        pending.push(entry);
        continue;
      }
      const present = !!isPresent(entry);
      const outcome = entry.kind === "unbind" ? unbindOutcome({ before: true, present, sourceRead: true }) : bindOutcome({ present, sourceRead: true });
      resolved.push({ entry, outcome });
    }
    return { pending, resolved };
  }

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
  flex: 1 1 120px; min-width: 120px; padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color);
}
.btn {
  border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.9em;
}
a.btn { display:inline-block; text-decoration:none; }
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
.storage-mode-badge { font-size: 0.8em; white-space: nowrap; }
.card-version { font-size: 0.8em; white-space: nowrap; text-decoration: none; }
.card-version:hover { text-decoration: underline; }
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
.stale-banner { margin-bottom:10px; padding:8px 12px; border-radius:8px; background: rgba(255,152,0,0.14); font-size:0.9em;
  display:flex; flex-direction:column; gap:6px; }
.pending-banner { background: rgba(255,193,7,0.16); }
.flow-steps { display:flex; flex-wrap:wrap; gap:6px 14px; list-style:none; padding:0; margin:0 0 12px; font-size:0.85em; color: var(--secondary-text-color); }
.flow-steps li.active { color: var(--primary-text-color); font-weight:600; }
.flow label { display:block; margin:8px 0; }
.flow-targets { max-height: 320px; overflow:auto; border:1px solid var(--divider-color, rgba(127,127,127,0.3)); border-radius:8px; padding:4px 8px; }
.flow .flow-target { display:flex; align-items:center; gap:8px; margin:4px 0; }
.flow .flow-target .muted { margin-left:auto; font-size:0.85em; }
.flow-known, .flow-result, .flow-share, .flow-callout { padding:8px 12px; border-radius:8px; margin:8px 0; }
.flow-tag { display:inline-block; font-size:0.8em; padding:0 6px; margin-left:6px; border-radius:8px; background: rgba(255,152,0,0.16); color: var(--warning-color, #c77700); }
.flow-suggested { display:inline-block; font-size:0.8em; padding:0 6px; margin-left:6px; border-radius:8px; background: rgba(33,150,243,0.14); color: var(--primary-color, #1976d2); }
.flow-known-unknown { background: rgba(127,127,127,0.12); }
.flow-known-works, .flow-result-success { background: rgba(76,175,80,0.14); }
.flow-known-mixed, .flow-result-info { background: rgba(3,169,244,0.12); }
.flow-known-problems, .flow-result-warning { background: rgba(255,152,0,0.18); }
.flow-share, .flow-callout { background: rgba(3,169,244,0.10); }
.flow-undo { padding:8px 12px; border-radius:8px; margin:8px 0; border:1px solid var(--divider-color, #e0e0e0); }
.flow-undo .flow-callout { margin:0 0 4px; }
.flow-undo-group { display:flex; gap:6px; align-items:center; margin-top:6px; }
.flow-pitfalls { margin:8px 0; }
.flow-pitfalls summary { cursor:pointer; font-weight:600; }
.flow-pitfalls ul, .flow-clusters, .flow-log { margin:6px 0; padding-left:20px; }
.flow-mode { border:none; padding:0; margin:8px 0; }
.flow-mode legend { font-weight:600; padding:0; }
.flow-support { display:block; font-size:0.85em; margin:0 0 6px 24px; }
.flow-support-warning { color: var(--warning-color, #c77700); }
.flow-log { list-style:none; padding-left:0; }
.flow-log li { margin:3px 0; }
.adv-group-support { margin:4px 0 8px; padding:6px 10px; border-radius:6px; font-style:normal; }
.adv-group-support-ok { background: rgba(76,175,80,0.12); }
.adv-group-support-info { background: rgba(3,169,244,0.12); }
.adv-group-support-warning, .adv-group-support-empty { background: rgba(255,152,0,0.18); }
.adv-group-support-unknown { opacity: 0.8; }
.pending-list { margin:0; padding-left:20px; }
.status-warning { background: rgba(255,152,0,0.16); color: var(--primary-text-color); }
.status .status-action { margin-left:8px; flex:0 0 auto; }
.stale-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.stale-row > span { flex: 1 1 260px; }
.lost-banner { background: rgba(219,68,55,0.10); }
.lost-list { margin-top:8px; display:flex; flex-direction:column; gap:8px; }
.lost-device { padding:6px 8px; border-radius:6px; background: var(--card-background-color, rgba(255,255,255,0.6)); }
.lost-device-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.lost-device-head .muted { flex: 1 1 160px; }
.lost-device ul { margin:4px 0 0 0; padding-left:18px; }
.lost-device li { margin:2px 0; }
a.health-chip-lost { text-decoration:none; cursor:pointer; }
.drawer-lost { margin:0 0 6px 0; padding-left:18px; }
.drawer-lost-policy { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:8px; font-size:0.9em; }
.drawer-lost-expect { margin-top:4px; font-size:0.88em; }
.drawer-lost-expect ul { margin:4px 0; padding-left:18px; }
.answers-locked { opacity: 0.85; }
.answers-preview { margin:6px 0; padding-left:18px; font-size:0.9em; }
.answers-preview li { margin:3px 0; }
.answers-form { display:flex; flex-direction:column; gap:8px; }
.answers-q { display:flex; flex-direction:column; gap:3px; font-size:0.92em; }
.answers-q select, .answers-q input, .answers-q textarea { max-width:100%; font:inherit; }
.answers-other { margin-top:2px; }
.answers-use { margin:4px 0; font-size:0.92em; }
.answers-use summary { cursor:pointer; }
.answers-list, .answers-tips { margin:4px 0; padding-left:18px; }
.answers-list li { margin:2px 0; }
.answers-tips li { font-style:italic; }
.answers-rating { color:#b26a00; }
.btn.disabled { opacity:0.5; pointer-events:auto; cursor:not-allowed; }
.table-filter-info { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:8px; padding:6px 10px;
  border-radius:8px; background: rgba(76,154,255,0.12); font-size:0.85em; }
.dir-cell { white-space:nowrap; font-weight:600; }
.dir-cell.dir-outbound { color: var(--primary-color); }
.dir-cell.dir-inbound { color: var(--secondary-text-color); }
.table-toolbar { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.85em; flex-wrap:wrap; }
.health-filters { display:flex; gap:6px; flex-wrap:wrap; }
.removed-note { color: var(--error-color, #db4437); font-weight:600; font-size:0.9em; }
.removed-note code { font-weight:400; }
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

/* Device drawer (1.4.0): side panel opened by clicking a device anywhere. */
.drawer { position: fixed; top:0; right:0; bottom:0; width: min(400px, 100vw); z-index: 15;
  background: var(--card-background-color, #fff); color: var(--primary-text-color);
  box-shadow: -6px 0 24px rgba(0,0,0,0.25); transform: translateX(105%); transition: transform 0.18s ease-out;
  display:flex; flex-direction:column; }
.drawer.open { transform: none; }
.drawer-header { display:flex; align-items:center; justify-content:space-between; gap:8px; font-weight:600;
  padding: 14px 16px 10px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12)); }
.drawer-body { overflow-y:auto; padding: 12px 16px 24px; font-size: 0.92em; }
.drawer-head { display:flex; gap:12px; align-items:flex-start; }
.drawer-photo { width: 84px; height: 84px; object-fit: contain; flex: 0 0 auto; border-radius: 8px;
  background: var(--secondary-background-color, #f5f5f5); }
.drawer-tags { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px; }
.drawer-tags .chip { cursor: default; }
.drawer-body { overflow-x:hidden; }
.drawer-head > div { flex: 1 1 auto; min-width: 0; }
.drawer-facts { width:100%; table-layout: fixed; }
.drawer-facts td { overflow-wrap: anywhere; vertical-align: top; }
.drawer-facts td:first-child { color: var(--secondary-text-color); width: 42%; }
.drawer-check { display:flex; align-items:flex-start; gap:8px; margin-top:8px; font-size:0.95em; }
.drawer-check input { flex: 0 0 auto; margin-top:3px; }
.drawer-facts .scan-cell { display:block; }
.map-route-banner { margin: 6px 0; padding: 8px 10px; border-left: 4px solid var(--primary-color); background: var(--secondary-background-color, #f5f5f5); border-radius: 6px; font-size: 13px; display:flex; gap:8px; align-items:flex-start; flex-wrap: wrap; }
.map-route-banner .map-route-text { flex: 1 1 260px; }
.map-route-hop { stroke-width: 5; stroke-dasharray: 10 6; opacity: .9; pointer-events: stroke; }
.map-route-lqi { font-size: 12px; font-weight: 700; paint-order: stroke; stroke: var(--card-background-color, #fff); stroke-width: 3px; }
.node.map-route-node .node-shape { stroke: var(--primary-color); stroke-width: 4; }
.groups-head { display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; margin: 8px 0 12px; }
.groups-head p { flex: 1 1 320px; margin: 0; }
.group-card { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
.group-card.group-focus { border-color: var(--primary-color); box-shadow: 0 0 0 2px var(--primary-color); }
.group-card-head { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.group-card-head .spacer { flex: 1; }
.group-cols { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 8px; }
.groups-list { list-style:none; padding:0; margin: 4px 0; }
.groups-list li { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding: 3px 0; }
.groups-list li .btn { margin-left:auto; }
.groups-reasons { margin: 4px 0 8px; padding-left: 18px; }
.groups-reasons li { margin: 2px 0; }
.groups-pick { display:flex; flex-direction:column; gap:4px; max-height: 260px; overflow:auto; margin: 6px 0; }
.drawer-db-missing { color: var(--warning-color, #b26a00); font-weight: 500; }
.drawer-section { margin-top: 16px; }
.drawer-section-title { font-weight: 600; margin-bottom: 6px; }
.drawer-rel { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px; }
.drawer-rel li { display:flex; flex-wrap:wrap; gap:4px 8px; align-items:baseline; }
.drawer-clusters { font-size: 0.85em; }
.drawer-empty { margin: 0; }
.drawer-problems ul { margin: 0 0 6px; padding-left: 18px; }
.drawer-problems .health-error { color: var(--error-color, #db4437); }
.drawer-problems .health-warning { color: var(--warning-color, #f4b400); }
.drawer-actions { display:flex; flex-direction:column; align-items:stretch; gap:8px; }
.drawer-actions .btn { text-align:center; text-decoration:none; }
.drawer-share { border: 1px solid var(--divider-color, rgba(0,0,0,0.12)); border-radius: 8px; padding: 8px 12px; }
.drawer-share ol { padding-left: 18px; margin: 6px 0; }
.drawer-share li { margin-bottom: 4px; }
.ep-check-all { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
.flow-group-choice label { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.flow-group-choice input[type="text"], .flow-group-choice select { flex: 1 1 180px; min-width: 0; }
.adv-guided-hint { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }

/* Experimental (1.5.0 local build): Network tab and route check. */
.exp-badge { display:inline-block; font-size:0.7em; font-weight:600; letter-spacing:0.02em; padding:1px 6px; border-radius:8px;
  margin-left:4px; vertical-align:middle; color: var(--warning-color, #ffa000); border:1px solid var(--warning-color, #ffa000); }
.tab-beta { font-size:0.62em; font-weight:500; margin-left:2px; opacity:0.75; letter-spacing:0.02em; color: inherit; }
.mesh-intro p { margin: 0 0 8px; }
.mesh-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.mesh-progress { display:flex; align-items:center; gap:8px; margin:6px 0; font-size:0.9em; }
.mesh-progress:empty { display:none; }
.mesh-layout { display:flex; gap:16px; align-items:flex-start; margin-top:8px; }
.mesh-picture { flex: 1 1 auto; min-width:0; }
.mesh-side { flex: 0 0 300px; font-size:0.9em; }
.mesh-svg { width:100%; height:auto; max-height:70vh; border:1px solid var(--divider-color, rgba(0,0,0,0.12)); border-radius:8px;
  background: var(--card-background-color, #fff); }
.mesh-node { cursor:pointer; }
.mesh-picture { position:relative; }
.mesh-zoom { position:absolute; top:8px; right:8px; display:flex; gap:4px; z-index:1; }
.mesh-svg { touch-action:none; cursor:grab; }
.mesh-link { cursor:pointer; }
.mesh-svg .mesh-zs { transform: scale(var(--mz, 1)); transform-origin: 0 0; transform-box: view-box; }
.mesh-svg [style*="--sw"] { stroke-width: calc(var(--sw) * var(--mz, 1) * 1px); }
.mesh-picture { position: relative; }
.mesh-picture > .mesh-selected { position: absolute; left: 8px; top: 8px; z-index: 2; max-width: min(340px, calc(100% - 16px)); background: var(--card-background-color, #fff); box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
.edge-pending { stroke-dasharray: 6 5; opacity: 0.85; cursor: pointer; }
.edge-lost { stroke-dasharray: 7 5; stroke-width: 2.5; opacity: 0.9; cursor: pointer; }
.mesh-show-hint { margin:4px 0 0; }
.mesh-battery circle { fill: var(--card-background-color, #fff); stroke-width:2; }
.mesh-battery.orphan circle { stroke: var(--disabled-text-color, #999) !important; stroke-dasharray: 2 2; }
.mesh-battery-label { fill: var(--secondary-text-color); }
.mesh-failed { list-style:none; padding:0; margin:0 0 12px; display:flex; flex-direction:column; gap:4px; }
.mesh-failed li { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.mesh-routes { padding-left:18px; margin:0 0 12px; }
.mesh-routes li { margin-bottom:4px; }
.mesh-link-hit { stroke: transparent; pointer-events: stroke; }
.mesh-link:hover line:first-child { stroke-opacity:1; }
.mesh-selected { border:1px solid var(--divider-color, rgba(0,0,0,0.12)); border-radius:8px; padding:8px 10px; margin-bottom:12px; }
.mesh-selected ul { margin:6px 0; padding-left:18px; }
.mesh-selected p { margin:4px 0 6px; font-size:0.9em; }
.mesh-unplaced { margin-top:6px; font-size:0.9em; }
.mesh-legend span { display:inline-flex; align-items:center; gap:4px; margin-right:10px; }
.mesh-legend-note { font-size:0.85em; margin-top:4px; }
.mesh-floor-badge { fill: var(--primary-color); font-weight:700; paint-order: stroke; stroke: var(--card-background-color, #fff); stroke-width:3px; }
.mesh-node circle.via-ceiling { fill:none; stroke: var(--warning-color, #ffa000); stroke-dasharray: 3 3; stroke-width:1.5; }
.mesh-floors-help, .fp-floor-help details { font-size:0.9em; margin:4px 0 8px; }
.mesh-floors-help summary, .fp-floor-help summary { cursor:pointer; color: var(--primary-color); }
.mesh-floors-help ol, .fp-floor-help ol { margin:6px 0; padding-left:20px; }
.fp-floor-help { margin: 0 0 6px; }
.mesh-unplaced summary { cursor:pointer; }
.mesh-node circle, .mesh-node rect { fill: var(--card-background-color, #fff); stroke: var(--primary-text-color); stroke-width:1.5; }
.mesh-node circle.unread { stroke-dasharray: 3 3; stroke: var(--secondary-text-color); }
.mesh-node rect { fill: var(--primary-color); }
.mesh-label { fill: var(--primary-text-color); paint-order: stroke; stroke: var(--card-background-color, #fff); stroke-width:3px; }
.mesh-kids { fill: var(--secondary-text-color); font-weight:600; }
.mesh-legend { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:6px; font-size:0.85em; }
.mesh-tips { padding-left:18px; margin:0 0 12px; }
.activity-section { margin: 4px 0 12px; }
.activity-summary-line { display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; cursor:pointer; padding:6px 0; }
.activity-details > summary { list-style:none; }
.activity-details > summary::-webkit-details-marker { display:none; }
.activity-details > summary::before { content:"\u25B8"; display:inline-block; width:1em; transition: transform .15s; }
.activity-details[open] > summary::before { transform: rotate(90deg); }
.activity-alert { color: var(--error-color, #c62828); font-weight:600; }
.activity-table { width:100%; max-width:900px; border-collapse:collapse; table-layout:fixed; }
.activity-table th, .activity-table td { padding:4px 8px; text-align:left; vertical-align:top; overflow:hidden; text-overflow:ellipsis; }
.activity-table th { font-weight:600; white-space:nowrap; }
.activity-table .num { text-align:right; font-variant-numeric: tabular-nums; }
.activity-table .activity-col-name { width:32%; }
.activity-table .activity-col-num { width:11%; }
.activity-table tr.activity-chatty td { color: var(--error-color, #c62828); }
.activity-counters { margin-top:8px; }
.activity-counters .num { text-align:right; font-variant-numeric: tabular-nums; }
@media (max-width: 600px) {
  .activity-table .activity-col-name { width:46%; }
  .activity-table .activity-col-num { width:18%; }
  .activity-table th { white-space:normal; font-size:0.9em; }
  .activity-table th, .activity-table td { padding:4px 4px; }
  .activity-table th:nth-child(5), .activity-table td:nth-child(5) { display:none; }
}
.mesh-tips li { margin-bottom:6px; }
.mesh-tip-error { color: var(--error-color, #db4437); font-weight: 500; }
.mesh-tip-warning { color: var(--primary-text-color); }
.mesh-tip-info { color: var(--secondary-text-color); }
.mesh-links tr { cursor:pointer; }
.mesh-links tr.active td { background: var(--secondary-background-color, rgba(0,0,0,0.05)); }
.lqi-chip { display:inline-block; font-size:0.8em; padding:0 6px; border-radius:8px; white-space:nowrap; border:1px solid currentColor; }
.lqi-good { color: var(--success-color, #43a047); }
.lqi-fair { color: var(--warning-color, #ffa000); }
.lqi-weak { color: var(--error-color, #db4437); }
.lqi-unknown { color: var(--secondary-text-color); }
.route-list { list-style:none; padding:0; margin:6px 0; display:flex; flex-direction:column; gap:10px; }
.route-chain { margin:4px 0; line-height:1.9; }
.route-arrow { color: var(--secondary-text-color); }
.route-members { margin:4px 0; padding-left:18px; }
.route-verdict { font-size:0.9em; margin-top:2px; }
.route-good { color: var(--success-color, #43a047); }
.route-weak { color: var(--error-color, #db4437); }
.route-none, .route-unknown { color: var(--secondary-text-color); }
@media (max-width: 800px) { .mesh-layout { flex-direction: column; } .mesh-side { flex-basis:auto; width:100%; } }

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
.ep-cmd-discovery-note { margin: 0 0 8px; padding:6px 8px; border-radius:8px;
  background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee); }
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
.capexp-discoveries-lead { margin:0 0 6px; font-size:0.88em; }
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
.capexp-device-top { display:flex; gap:12px; align-items:flex-start; }
.capexp-device-main { flex:1 1 auto; min-width:0; }
.capexp-device-photo, .capexp-device-photo-fallback { width:56px; height:56px; border-radius:8px; flex:0 0 auto;
  background: var(--card-background-color, #fff); border:1px solid var(--divider-color, #e0e0e0); object-fit:contain; }
.capexp-device-photo-fallback { position:relative; background: var(--secondary-background-color, #fafafa); }
.capexp-device-photo-fallback::after { content:""; position:absolute; inset:15px;
  background-color: var(--secondary-text-color, #727272); opacity:0.45;
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='3' y='3' width='18' height='18' rx='3' fill='none' stroke='black' stroke-width='2'/><circle cx='12' cy='12' r='3' fill='black'/></svg>");
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='3' y='3' width='18' height='18' rx='3' fill='none' stroke='black' stroke-width='2'/><circle cx='12' cy='12' r='3' fill='black'/></svg>");
  mask-size:contain; -webkit-mask-size:contain; mask-repeat:no-repeat; -webkit-mask-repeat:no-repeat;
  mask-position:center; -webkit-mask-position:center; }
.capexp-device-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.capexp-device-name { font-weight:600; }
.capexp-website-link { margin-left:auto; font-size:0.78em; font-weight:500; color: var(--primary-color);
  text-decoration:none; white-space:nowrap; }
.capexp-website-link:hover { text-decoration:underline; }
.capexp-external-refs { font-size:0.78em; margin-top:6px; }
.capexp-external-refs a { color: var(--primary-color); text-decoration:none; }
.capexp-external-refs a:hover { text-decoration:underline; }
.capexp-chevron { margin-left:auto; opacity:0.6; }
.capexp-techtoggle { display:flex; align-items:center; gap:4px; cursor:pointer; user-select:none;
  margin-top:10px; padding-top:8px; border-top:1px solid var(--divider-color, #e0e0e0);
  font-size:0.78em; font-weight:600; color: var(--secondary-text-color); }
.capexp-techtoggle:hover { color: var(--primary-text-color); }
.capexp-chevron-inline { opacity:0.7; }
.capexp-tech-panel { margin-top:6px; }
.capexp-trust-panel { display:flex; align-items:center; gap:8px; margin-top:6px; }
.capexp-trust-stars { font-size:1.05em; letter-spacing:1px; color:#e0a400; white-space:nowrap; }
.capexp-trust-conflict { font-size:0.82em; letter-spacing:normal; color: var(--error-color, #db4437); font-weight:600; }
.capexp-trust-text { display:flex; flex-direction:column; }
.capexp-trust-label { font-size:0.78em; font-weight:600; color: var(--secondary-text-color); }
.capexp-evidence-tag { display:inline-block; align-self:flex-start; font-size:0.68em; font-weight:500;
  padding:1px 7px; border-radius:8px; margin:2px 0; background: var(--divider-color, #e0e0e0);
  color: var(--secondary-text-color); }
.capexp-trust-detail { font-size:0.8em; }
.capexp-cap-label { font-size:0.78em; color: var(--secondary-text-color); margin-top:8px; margin-bottom:2px; }
.capexp-cap-groups { display:flex; flex-direction:column; gap:6px; margin-top:2px; }
.capexp-cap-group-label { font-size:0.85em; font-weight:600; }
.capexp-cap-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:3px; }
.capexp-cap-reportsonly { margin-top:2px; }
.capexp-cap-group-unidentified .capexp-cap-group-label { font-weight:500; font-style:italic; }
.capexp-device-overview { margin:6px 0 4px; font-size:0.88em; line-height:1.5; }
.capexp-badge { display:inline-block; font-size:0.72em; padding:2px 8px; border-radius:10px; cursor:help; }
.capexp-badge-input { background: rgba(158,158,158,0.18); color: var(--secondary-text-color); }
.capexp-badge-output { background: rgba(76,175,80,0.16); color: #2e7d32; }
.capexp-badge-both { background: rgba(142,36,170,0.13); color: #6a1b78; }
.capexp-badge-unknown { background: rgba(158,158,158,0.18); color: var(--secondary-text-color); font-style: italic; }
.capexp-tag { display:inline-block; font-size:0.78em; padding:3px 9px; border-radius:10px;
  background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-tag-conflict { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.capexp-tag-fwdep { background: rgba(142,36,170,0.13); color: #6a1b78; }
.capexp-report-line { font-size:0.85em; margin-top:8px; }
.capexp-discovery-note { font-size:0.8em; margin-top:6px; padding:4px 8px; border-radius:6px;
  background: rgba(76,154,255,0.10); color: #2f6fce; display:inline-block; }
.capexp-goodfor { margin-top:8px; }
.capexp-goodfor-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:3px; }
.capexp-goodfor-tag { background: rgba(76,206,172,0.15); color: #1f7a63; }
.capexp-fwgap-alert { margin-top:8px; padding:7px 10px; border-radius:8px; font-size:0.82em;
  background: rgba(255,179,0,0.12); border:1px solid rgba(255,179,0,0.35); color: var(--primary-text-color); }
.capexp-confidence-badge { display:inline-block; font-size:0.72em; padding:3px 9px; border-radius:10px;
  white-space:nowrap; background: var(--divider-color, #e0e0e0); color: var(--secondary-text-color); }
.capexp-confidence-strong-evidence { background: rgba(76,206,172,0.18); color: #2e9e83; }
.capexp-confidence-well-confirmed { background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-confidence-repeated-observation { background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-confidence-single-observation { background: rgba(255,179,0,0.18); color: #b26a00; }
.capexp-confidence-conflicting-evidence { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.capexp-device-detail { margin-top:10px; padding-top:8px; border-top:1px solid var(--divider-color, #e0e0e0);
  display:flex; flex-direction:column; gap:10px; opacity:0.85; }
.capexp-techlabel { font-size:0.7em; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;
  color: var(--secondary-text-color); margin-bottom:2px; }
.capexp-entry-title { font-size:0.8em; font-weight:400; color: var(--secondary-text-color); margin-bottom:4px; }
.capexp-nomatch-list { display:flex; flex-direction:column; gap:6px; }
.capexp-nomatch-row { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:6px 10px; border-radius:8px; background: var(--secondary-background-color, #fafafa);
  border:1px solid var(--divider-color, #eee); font-size:0.9em; }
.capexp-search-example-group { margin-bottom:8px; }
.capexp-search-example-category { font-size:0.72em; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;
  color: var(--secondary-text-color); margin-bottom:4px; }
.capexp-search-examples { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:2px; }
.capexp-advanced-filters { margin:10px 0; }
.capexp-advanced-filters summary { cursor:pointer; font-size:0.85em; font-weight:600; color: var(--secondary-text-color); }
.capexp-search-form { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; margin-bottom:8px; }
.capexp-search-form input, .capexp-search-form select { flex: 1 1 150px; min-width:120px; padding:6px 8px; border-radius:6px;
  border:1px solid var(--divider-color, #ccc); background: var(--card-background-color); color: var(--primary-text-color); }
.capexp-empty-search { padding:12px; border-radius:10px; background: var(--secondary-background-color, #fafafa);
  border:1px solid var(--divider-color, #eee); }
.capexp-empty-search p { margin: 0 0 6px; }
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

  // src/unbind-errors.js
  function toolkitErrorText(err) {
    const msg = err && (err.message || String(err)) || "";
    return msg.replace(/^binds_remove_all failed:\s*/i, "").trim();
  }
  function explainUnbindFailure({ errors = [], targetRemoved = false } = {}) {
    const real = [...new Set(errors.filter(Boolean))];
    if (targetRemoved && (!real.length || real.some((e) => /keyerror|unknown error/i.test(e)))) {
      return "zha-toolkit can't remove a binding to a device that's no longer in ZHA: it looks the removed device up, fails, and never sends the unbind (a known zha-toolkit bug, reported to its developer). Until it's fixed, these bindings stay. They only use a slot in the switch's binding table. If you need the slot now, pair the removed device again (it keeps its address), then unbind it normally.";
    }
    if (real.length) return `zha-toolkit said: ${real.slice(0, 2).join("; ")}${real.length > 2 ? " (and more)" : ""}.`;
    return "";
  }

  // src/groups.js
  function groupRows({ groups, bindings, classify, coordinatorIeee }) {
    const coord = coordinatorIeee ? normIeee(coordinatorIeee) : null;
    return (groups || []).map((g) => {
      const groupId = Number(g.group_id);
      const members = (g.members || []).filter((m) => m && m.device && m.device.ieee && normIeee(m.device.ieee) !== coord).map((m) => ({ ieee: normIeee(m.device.ieee), endpoint: Number(m.endpoint_id) }));
      const byController = /* @__PURE__ */ new Map();
      let others = 0;
      for (const b of bindings || []) {
        if (!b || !b.isGroup || Number(b.groupId) !== groupId) continue;
        const cls = classify(b);
        if (cls === "reporting" || cls === "manufacturer") {
          others++;
          continue;
        }
        const key = `${normIeee(b.sourceIeee)}:${Number(b.sourceEndpoint)}`;
        if (!byController.has(key)) byController.set(key, { sourceIeee: normIeee(b.sourceIeee), endpoint: Number(b.sourceEndpoint), clusters: /* @__PURE__ */ new Set() });
        byController.get(key).clusters.add(Number(b.clusterId));
      }
      const controllers = [...byController.values()].map((c) => ({ ...c, clusters: [...c.clusters].sort((a, b) => a - b) }));
      return { groupId, name: g.name || `Group ${groupId}`, members, controllers, others };
    }).sort((a, b) => a.name.localeCompare(b.name, void 0, { sensitivity: "base" }));
  }
  function deviceOnlyGroups({ groups, bindings, classify, coordinatorIeee }) {
    const known = new Set((groups || []).map((g) => Number(g.group_id)));
    const ids2 = /* @__PURE__ */ new Set();
    for (const b of bindings || []) {
      if (b && b.isGroup && Number.isFinite(Number(b.groupId)) && !known.has(Number(b.groupId))) ids2.add(Number(b.groupId));
    }
    const fake = [...ids2].map((id) => ({ group_id: id, name: `Group ${groupIdHex(id)}`, members: [] }));
    return groupRows({ groups: fake, bindings, classify, coordinatorIeee }).map(({ groupId, controllers, others }) => ({ groupId, controllers, others })).sort((a, b) => a.groupId - b.groupId);
  }
  function groupUnbindPlan(groupId, bindings, { clustersFor = () => void 0 } = {}) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    const all = bindings || [];
    for (const b of all) {
      if (!b || !b.isGroup || Number(b.groupId) !== Number(groupId)) continue;
      const op = { sourceIeee: normIeee(b.sourceIeee), endpoint: Number(b.sourceEndpoint), clusterId: Number(b.clusterId) };
      const key = `${op.sourceIeee}:${op.endpoint}:${op.clusterId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const clusters = clustersFor(op.sourceIeee);
      const sends = (clusters || []).some((c) => c.type === "out" && Number(c.id) === op.clusterId && Number(c.endpoint_id) === op.endpoint);
      if (sends || !clusters) {
        op.method = "group";
      } else {
        const others = all.some(
          (x) => x && normIeee(x.sourceIeee) === op.sourceIeee && Number(x.sourceEndpoint) === op.endpoint && Number(x.clusterId) === op.clusterId && !(x.isGroup && Number(x.groupId) === Number(groupId))
        );
        op.method = others ? "skip" : "remove";
      }
      out.push(op);
    }
    return out;
  }
  function noAnswerError(text) {
    return !text || /unknown[_ ]error|no details|timeout|timed out|delivery|not ?responding|didn't answer|no answer|deliveryerror|mac_no_ack|nwk_route/i.test(text);
  }
  function groupDeleteReasons(devices) {
    return devices.map((d) => {
      if (d.skipped) {
        return `${d.name}: it reports its own state to the group on a cluster it also uses for other bindings, and zha-toolkit can only remove them all together, so this one was left.`;
      }
      const errs = [...new Set((d.errors || []).filter(Boolean))];
      if (!d.answered || errs.length && errs.every(noAnswerError)) {
        return d.battery ? `${d.name} didn't answer: it's on battery, so wake it (press a button) and try again.` : `${d.name} didn't answer: it may be offline or switched off at the wall.`;
      }
      if (errs.length) return `${d.name}: zha-toolkit said ${errs.slice(0, 2).join("; ")}.`;
      return `${d.name}: zha-toolkit reported success, but the binding is still there.`;
    });
  }
  var groupIdHex = (id) => `0x${Number(id).toString(16).padStart(4, "0")}`;

  // src/mesh.js
  var LQI_RECOMMENDED = Object.freeze({ good: 150, weak: 80 });
  var MAX_HOPS = 10;
  function nwkNumber(value) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 65535) return value;
    if (typeof value === "string" && /^0x[0-9a-f]{1,4}$/i.test(value.trim())) return parseInt(value.trim(), 16);
    return null;
  }
  function rateLqi(lqi, thr = LQI_RECOMMENDED) {
    if (typeof lqi !== "number") return "unknown";
    if (lqi >= thr.good) return "good";
    if (lqi >= thr.weak) return "fair";
    return "weak";
  }
  var RANK = { weak: 0, unknown: 1, fair: 2, good: 3 };
  function linkKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
  function buildMesh(snapshot, devices = []) {
    const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
    const nwkToIeee = /* @__PURE__ */ new Map();
    const typeOf = /* @__PURE__ */ new Map();
    for (const d of devices) {
      const ieee = normIeee(d.ieee);
      const n = nwkNumber(d.nwk);
      if (n != null) nwkToIeee.set(n, ieee);
      if (d.device_type) typeOf.set(ieee, d.device_type === "EndDevice" ? "EndDevice" : d.device_type);
    }
    const links = /* @__PURE__ */ new Map();
    const parentOf = /* @__PURE__ */ new Map();
    const children = /* @__PURE__ */ new Map();
    let staleEntries = 0;
    for (const [rawReporter, entry] of Object.entries(snap)) {
      const reporter = normIeee(rawReporter);
      for (const n of entry && entry.neighbours || []) {
        const other = normIeee(n.ieee);
        if (!other || other === reporter) continue;
        if (n.nwk != null && !nwkToIeee.has(n.nwk)) nwkToIeee.set(n.nwk, other);
        if (n.type && !typeOf.has(other)) typeOf.set(other, n.type);
        const key = linkKey(reporter, other);
        if (!links.has(key)) {
          const [a, b] = reporter < other ? [reporter, other] : [other, reporter];
          links.set(key, { a, b, heard: {} });
        }
        const usable = typeof n.lqi === "number" && n.lqi > 0;
        links.get(key).heard[reporter] = usable ? n.lqi : null;
        if (!usable) staleEntries++;
        if (n.rel === "Child" && n.type === "EndDevice") {
          parentOf.set(other, { parent: reporter, lqi: typeof n.lqi === "number" && n.lqi > 0 ? n.lqi : null });
          children.set(reporter, (children.get(reporter) || 0) + 1);
        }
      }
    }
    for (const l of links.values()) {
      const vals = Object.values(l.heard).filter((v) => typeof v === "number");
      l.lqi = vals.length ? Math.min(...vals) : null;
    }
    const conflicts = addressConflicts(snap, devices);
    return { snapshot: snap, nwkToIeee, typeOf, links, parentOf, children, staleEntries, conflicts };
  }
  function addressConflicts(snapshot, devices = []) {
    const claims = /* @__PURE__ */ new Map();
    const claim = (nwk, ieee) => {
      if (nwk == null || !ieee) return;
      if (!claims.has(nwk)) claims.set(nwk, /* @__PURE__ */ new Set());
      claims.get(nwk).add(ieee);
    };
    let coord = null;
    for (const d of devices) {
      const ieee = normIeee(d.ieee);
      if (d.device_type === "Coordinator") coord = ieee;
      claim(nwkNumber(d.nwk), ieee);
    }
    for (const [rawReporter, entry] of Object.entries(snapshot || {})) {
      const reporter = normIeee(rawReporter);
      for (const n of entry && entry.neighbours || []) {
        const ieee = normIeee(n.ieee);
        if (!ieee || ieee === reporter || !(typeof n.lqi === "number" && n.lqi > 0)) continue;
        claim(nwkNumber(n.nwk), ieee);
      }
    }
    const out = [];
    for (const [nwk, set] of claims.entries()) {
      if (set.size < 2) continue;
      const ieees = [...set].sort((a, b) => a === coord ? -1 : b === coord ? 1 : a.localeCompare(b));
      out.push({ nwk, ieees, coordinator: nwk === 0 });
    }
    return out.sort((a, b) => a.nwk - b.nwk);
  }
  function linkBetween(mesh, a, b) {
    return mesh.links.get(linkKey(normIeee(a), normIeee(b))) || null;
  }
  function isRouterLike(mesh, ieee) {
    const t = mesh.typeOf.get(normIeee(ieee));
    return t === "Router" || t === "Coordinator";
  }
  function ieeeToNwk(mesh, ieee) {
    for (const [n, i] of mesh.nwkToIeee.entries()) if (i === ieee) return n;
    return null;
  }
  function routePath(mesh, sourceIeee, targetIeee) {
    const source = normIeee(sourceIeee);
    const target = normIeee(targetIeee);
    const hops = [];
    const hop = (from, to) => {
      const l = linkBetween(mesh, from, to);
      hops.push({ from, to, lqi: l ? l.lqi : null });
    };
    if (source === target) return { status: "ok", hops, note: null };
    let current = source;
    if (!mesh.snapshot[source]) {
      const p = mesh.parentOf.get(source);
      if (!p) {
        if (linkBetween(mesh, source, target)) {
          hop(source, target);
          return { status: "ok", hops, note: null };
        }
        return { status: "none", hops, note: "Its parent router isn't known: no router listed it as a child. Scan again, or wake it first." };
      }
      hop(source, p.parent);
      current = p.parent;
    }
    const targetParent = !mesh.snapshot[target] && mesh.parentOf.get(target) ? mesh.parentOf.get(target).parent : null;
    const visited = /* @__PURE__ */ new Set([current]);
    for (let i = 0; i < MAX_HOPS; i++) {
      if (current === target) return { status: "ok", hops, note: null };
      if (targetParent && current === targetParent) {
        hop(current, target);
        return { status: "ok", hops, note: null };
      }
      const entry = mesh.snapshot[current];
      if (!entry || !entry.ok) {
        return { status: "partial", hops, note: `${current} wasn't read, so the path stops there.` };
      }
      const goal = targetParent || target;
      const goalNwk = ieeeToNwk(mesh, goal);
      const route = goalNwk == null ? null : (entry.routes || []).find((r) => r.dst === goalNwk && r.status === "Active");
      let next = null;
      if (route) {
        next = mesh.nwkToIeee.get(route.next) || null;
        if (!next) return { status: "partial", hops, note: `The next hop (0x${route.next.toString(16).padStart(4, "0")}) isn't a known device.` };
      } else if ((entry.neighbours || []).some((n) => normIeee(n.ieee) === goal)) {
        next = goal;
      }
      if (!next) {
        return { status: hops.length ? "partial" : "none", hops, note: "No active route to the target in this router's routing table (routes appear after recent traffic)." };
      }
      if (visited.has(next)) return { status: "partial", hops, note: "The routing tables loop back on themselves; they're probably out of date." };
      visited.add(next);
      hop(current, next);
      current = next;
    }
    return { status: "partial", hops, note: `Stopped after ${MAX_HOPS} hops.` };
  }
  function pathVerdict(path, thr = LQI_RECOMMENDED) {
    if (!path || path.status === "none") return { level: "none", weakest: null };
    let weakest = null;
    for (const h of path.hops) {
      if (typeof h.lqi !== "number") continue;
      if (!weakest || h.lqi < weakest.lqi) weakest = h;
    }
    const anyUnknown = path.hops.some((h) => typeof h.lqi !== "number");
    if (weakest && rateLqi(weakest.lqi, thr) === "weak") return { level: "weak", weakest };
    if (path.status !== "ok" || anyUnknown) return { level: "unknown", weakest };
    return { level: "good", weakest };
  }
  function bestRouterLink(mesh, ieee) {
    const id = normIeee(ieee);
    let best = null;
    for (const l of mesh.links.values()) {
      if (l.a !== id && l.b !== id) continue;
      const other = l.a === id ? l.b : l.a;
      if (!isRouterLike(mesh, other) || typeof l.lqi !== "number") continue;
      if (!best || l.lqi > best.lqi) best = { other, lqi: l.lqi };
    }
    return best;
  }
  function groupCheck(mesh, sourceIeee, memberIeees) {
    const src = normIeee(sourceIeee);
    const p = mesh.parentOf.get(src);
    return {
      parent: p ? { parent: p.parent, lqi: p.lqi } : null,
      sourceIsRouter: !!mesh.snapshot[src],
      members: memberIeees.map((m) => ({ ieee: normIeee(m), best: bestRouterLink(mesh, m) }))
    };
  }
  function visibleRouterLinks(mesh, thr = LQI_RECOMMENDED, perRouter = 3) {
    const keep = /* @__PURE__ */ new Set();
    const byRouter = /* @__PURE__ */ new Map();
    for (const l of mesh.links.values()) {
      if (typeof l.lqi !== "number" || !isRouterLike(mesh, l.a) || !isRouterLike(mesh, l.b)) continue;
      for (const end of [l.a, l.b]) {
        if (!byRouter.has(end)) byRouter.set(end, []);
        byRouter.get(end).push(l);
      }
    }
    for (const list2 of byRouter.values()) {
      list2.sort((x, y) => y.lqi - x.lqi);
      list2.slice(0, perRouter).forEach((l) => keep.add(l));
    }
    return [...keep];
  }
  function weakestLinks(mesh, limit = 10) {
    return [...mesh.links.values()].filter((l) => typeof l.lqi === "number").sort((x, y) => x.lqi - y.lqi).slice(0, limit);
  }
  function meshSuggestions(mesh, { thr = LQI_RECOMMENDED, areaOf = () => "", nameOf = (i) => i, routers = [] } = {}) {
    const out = [];
    for (const c of mesh.conflicts || []) {
      const hex2 = `0x${c.nwk.toString(16).padStart(4, "0")}`;
      const others = c.coordinator ? c.ieees.filter((i) => mesh.typeOf.get(i) !== "Coordinator") : c.ieees;
      out.push({
        kind: c.coordinator ? "coordinator_address" : "address_conflict",
        level: "error",
        ieees: c.ieees,
        text: c.coordinator ? `${others.map(nameOf).join(", ")} ${others.length === 1 ? "is" : "are"} using the coordinator's network address (${hex2}). A device doing this can flood or confuse the whole network: lights responding late or not at all, timeouts. Unplug it (or remove its battery), check whether the network recovers, then reset and pair it again.` : `${c.ieees.map(nameOf).join(" and ")} are using the same network address (${hex2}). Messages for one may go to the other. Scan again to confirm; if it stays, reset and pair one of them again.`
      });
    }
    const routerSet = new Set(routers.map(normIeee));
    for (const [child, p] of mesh.parentOf.entries()) {
      if (rateLqi(p.lqi, thr) === "weak") {
        out.push({
          kind: "weak_parent",
          level: "warning",
          ieees: [child, p.parent],
          text: `${nameOf(child)} hears its parent ${nameOf(p.parent)} poorly (LQI ${p.lqi}). A router nearer to it would help.`
        });
      }
    }
    const dependsOn = /* @__PURE__ */ new Map();
    const consider = new Set(routerSet);
    for (const dev of consider) {
      const ok = [];
      for (const l of mesh.links.values()) {
        if (l.a !== dev && l.b !== dev) continue;
        const other = l.a === dev ? l.b : l.a;
        if (!isRouterLike(mesh, other)) continue;
        if (RANK[rateLqi(l.lqi, thr)] >= RANK.fair) ok.push(other);
      }
      if (ok.length === 1) {
        if (!dependsOn.has(ok[0])) dependsOn.set(ok[0], []);
        dependsOn.get(ok[0]).push(dev);
      }
    }
    for (const [router, devs] of dependsOn.entries()) {
      if (devs.length === 1 || mesh.typeOf.get(router) === "Coordinator") {
        for (const dev of devs) {
          const l = linkBetween(mesh, dev, router);
          out.push({
            kind: "single_link",
            level: "warning",
            ieees: [dev, router],
            text: `${nameOf(dev)} has only one usable link (to ${nameOf(router)}, ${rateLqi(l && l.lqi, thr)} ${l && l.lqi}). A router nearer to it would give it a second route.`
          });
        }
        continue;
      }
      out.push({
        kind: "single_point",
        level: "warning",
        ieees: [router, ...devs],
        text: `Single point of failure: ${devs.length} routers have no other good or fair link than ${nameOf(router)} (${devs.map(nameOf).join(", ")}). If it goes offline, they lose their way to the rest of the mesh.`
      });
    }
    for (const r of routerSet) {
      const best = bestRouterLink(mesh, r);
      if (best && rateLqi(best.lqi, thr) === "weak") {
        out.push({
          kind: "isolated_router",
          level: "warning",
          ieees: [r],
          text: `${nameOf(r)} has no good or fair link to another router (best LQI ${best.lqi}).`
        });
      }
    }
    for (const [router, n] of mesh.children.entries()) {
      if (n >= 3) {
        const kids = [...mesh.parentOf.entries()].filter(([, p]) => p.parent === router).map(([c]) => nameOf(c));
        out.push({
          kind: "many_children",
          level: "info",
          ieees: [router],
          text: `${nameOf(router)} is the parent of ${n} battery devices (${kids.join(", ")}). If it's switched off at the wall, they lose contact until they find a new parent.`
        });
      }
    }
    const areas = /* @__PURE__ */ new Map();
    for (const ieee of mesh.typeOf.keys()) {
      const a = areaOf(ieee);
      if (!a) continue;
      if (!areas.has(a)) areas.set(a, { routers: 0, devices: 0 });
      const e = areas.get(a);
      e.devices++;
      if (isRouterLike(mesh, ieee)) e.routers++;
    }
    for (const [area, e] of areas.entries()) {
      if (e.devices >= 1 && e.routers === 0) {
        out.push({ kind: "area_without_router", level: "info", ieees: [], text: `${area} has ${e.devices} Zigbee device${e.devices === 1 ? "" : "s"} but no router.` });
      }
    }
    const order = { error: 0, warning: 1, info: 2 };
    return out.sort((x, y) => order[x.level] - order[y.level]);
  }

  // src/table-filter.js
  var DIRECTION_ALL = "all";
  var DIRECTION_OUTBOUND = "outbound";
  var DIRECTION_INBOUND = "inbound";
  function bindingDirection(b, ieee) {
    if (!ieee) return null;
    if (b.sourceIeee === ieee) return DIRECTION_OUTBOUND;
    if (!b.isGroup && b.targetIeee === ieee && b.sourceIeee !== ieee) return DIRECTION_INBOUND;
    return null;
  }
  function matchesDeviceFilter(b, ieee, direction = DIRECTION_ALL) {
    if (!ieee) return true;
    const dir = bindingDirection(b, ieee);
    if (!dir) return false;
    return direction === DIRECTION_ALL || direction === dir;
  }
  function directionRank(dir) {
    return dir === DIRECTION_OUTBOUND ? 0 : dir === DIRECTION_INBOUND ? 1 : 2;
  }
  function directionLabel(dir) {
    return dir === DIRECTION_OUTBOUND ? "\u2192 Outbound" : dir === DIRECTION_INBOUND ? "\u2190 Inbound" : "";
  }
  function emptyTableState({
    total,
    rawTotal,
    deviceFilterActive,
    deviceMatches,
    direction,
    deviceName,
    coordinatorHidden,
    healthFilterLabel,
    search
  }) {
    const scanned = rawTotal != null ? rawTotal : total;
    if (!scanned) {
      return { kind: "not-scanned", message: 'No bindings loaded yet. Click "Scan bindings" above.' };
    }
    if (!total) {
      return {
        kind: "coordinator-hidden",
        message: `All ${scanned} scanned binding${scanned === 1 ? "" : "s"} target${scanned === 1 ? "s" : ""} the coordinator, and "Hide coordinator bindings" is on in the Map filters. Untick it to see ${scanned === 1 ? "it" : "them"}.`
      };
    }
    if (deviceFilterActive && !deviceMatches) {
      const what = direction === DIRECTION_OUTBOUND ? `No outbound bindings from ${deviceName}.` : direction === DIRECTION_INBOUND ? `No inbound bindings to ${deviceName}.` : `No bindings involve ${deviceName}.`;
      if (coordinatorHidden) {
        return {
          kind: "device-filter",
          message: `${what} Bindings that target the coordinator are hidden by "Hide coordinator bindings" in the Map filters. Untick it to see them.`
        };
      }
      const hidden = `The filter is hiding ${total} other binding${total === 1 ? "" : "s"}. Clear the filter to see ${total === 1 ? "it" : "them"}.`;
      return { kind: "device-filter", message: `${what} ${hidden}` };
    }
    const reasons = [];
    if (healthFilterLabel) reasons.push(`the "${healthFilterLabel}" health filter`);
    if (search) reasons.push(`the search "${search}"`);
    return {
      kind: "other-filters",
      message: reasons.length ? `No bindings match ${reasons.join(" and ")}. ${total} binding${total === 1 ? " is" : "s are"} hidden.` : "No bindings match the current filters."
    };
  }
  function deviceNameText(d) {
    if (!d) return "";
    return [d.user_given_name, d.name].filter(Boolean).join(" ").toLowerCase();
  }
  var MIN_AUTO_FILTER_SEARCH_LENGTH = 3;
  function findSingleDeviceBySearch(devices, search) {
    const s = (search || "").trim().toLowerCase();
    if (s.length < MIN_AUTO_FILTER_SEARCH_LENGTH) return null;
    const matches = (devices || []).filter((d) => deviceNameText(d).includes(s));
    return matches.length === 1 ? matches[0] : null;
  }

  // src/card.js
  var LOST_EDGE_COLOR = "#db4437";
  var SYNCED_ITEM_KEYS = [
    "filters",
    "positions",
    "endpoint-annotations",
    "retry-count",
    "scan-batch-size",
    "fp-marker-scale",
    "floorplan",
    "show-device-photos"
  ];
  var GENERIC_TUYA_LABEL = "Generic Tuya";
  var TUYA_MANUFACTURER_PATTERN = /^_T[A-Z0-9]+_/i;
  var CAPEXP_CLUSTERS_URL = "https://hsolgaard.github.io/zigbee-capabilities/clusters.html";
  function isGenericTuyaManufacturer(m) {
    return TUYA_MANUFACTURER_PATTERN.test(String(m || ""));
  }
  function manufacturerDisplayLabel(m) {
    if (!m) return "\u2014";
    return isGenericTuyaManufacturer(m) ? `${GENERIC_TUYA_LABEL} (${m})` : m;
  }
  var SEARCHABLE_VIEWS = /* @__PURE__ */ new Set(["graph", "table", "devices"]);
  var ZhaBindingMapCard = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._api = null;
      this._config = {};
      this._devices = [];
      this._groups = [];
      this._knownDevices = /* @__PURE__ */ new Map();
      this._savedKnownJson = null;
      this._registrySub = null;
      this._deviceReloadTimer = null;
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
      this._capExpSearchExpanded = /* @__PURE__ */ new Set();
      this._status = null;
      this._pendingChecks = /* @__PURE__ */ new Map();
      this._scanState = { running: false, done: 0, total: 0 };
      this._selectedEdgeId = null;
      this._loaded = false;
      this._dragCtx = null;
      this._fullscreen = false;
      this._lastScanAt = null;
      this._tableSourceFilter = null;
      this._tableDirection = DIRECTION_ALL;
      this._lastTableDevice = null;
      this._tableSort = { key: null, dir: 1 };
      this._devicesSort = { key: null, dir: 1 };
      this._localStorage = new LocalStorageProvider();
      this._storage = this._localStorage;
      this._backendAvailable = null;
      this._backendVersion = null;
      this._backendInstalled = false;
      this._bundledCardVersion = null;
      this._storageMode = null;
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
      this.tabInUrl = false;
      this._onHashChange = () => this._applyHashView();
    }
    setConfig(config) {
      this._config = config || {};
      this._loadFilters().then(() => this._render());
    }
    /** Loads saved filters through this._storage — see setConfig's comment
     *  for why this runs twice (once locally at bootstrap, once again
     *  post-resolution in _loadAll). */
    async _loadFilters() {
      try {
        const raw = await this._storage.getItem(this._config.id, "filters");
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
    async _saveFilters() {
      const f = this._filters;
      await this._storage.setItem(this._config.id, "filters", {
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
      });
    }
    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      this._api = new ZhaApi(hass);
      this._api.watchEnabled = !!this._watchEnabled;
      if (first) {
        this._render();
        this._loadAll();
        this._subscribeRegistry();
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
      if (this.tabInUrl) window.addEventListener("hashchange", this._onHashChange);
      if (this._hass) this._subscribeRegistry();
    }
    disconnectedCallback() {
      window.removeEventListener("resize", this._onResize);
      window.removeEventListener("hashchange", this._onHashChange);
      this._unsubscribeRegistry();
    }
    /** Listens for Home Assistant device-registry changes, so a device removed
     *  from ZHA (or renamed, or moved to another area) is picked up without
     *  reloading the page. Before this, the device list was read once when the
     *  page opened, and a removed device still looked live until a browser
     *  refresh: its saved bindings stayed Info and scans failed on it as if it
     *  were asleep. */
    _subscribeRegistry() {
      if (this._registrySub || !this._hass || !this._hass.connection || !this._hass.connection.subscribeEvents) return;
      this._registrySub = this._hass.connection.subscribeEvents((ev) => this._onRegistryEvent(ev), "device_registry_updated").catch((e) => {
        console.warn("ZHA Bindings Manager: could not watch for device changes:", e.message || e);
        this._registrySub = null;
        return null;
      });
    }
    _unsubscribeRegistry() {
      const sub = this._registrySub;
      this._registrySub = null;
      if (this._deviceReloadTimer) clearTimeout(this._deviceReloadTimer);
      this._deviceReloadTimer = null;
      if (sub) sub.then((unsub) => unsub && unsub()).catch(() => {
      });
    }
    /** The registry covers every integration, not just ZHA, and a removal can
     *  arrive as several events, so reloads are debounced. A scan reloads the
     *  list itself before starting; if one is running, try again after it. */
    _onRegistryEvent(ev) {
      const action = ev && ev.data && ev.data.action;
      if (!["create", "remove", "update"].includes(action)) return;
      if (this._deviceReloadTimer) clearTimeout(this._deviceReloadTimer);
      const attempt = () => {
        this._deviceReloadTimer = null;
        if (!this._loaded) return;
        if (this._scanState.running) {
          this._deviceReloadTimer = setTimeout(attempt, 3e3);
          return;
        }
        this._reloadDevices();
      };
      this._deviceReloadTimer = setTimeout(attempt, 1500);
    }
    async _loadPositions() {
      try {
        const raw = await this._storage.getItem(this._config.id, "positions");
        this._positions = raw && typeof raw === "object" ? raw : {};
      } catch (e) {
        this._positions = {};
      }
    }
    async _savePositions() {
      await this._storage.setItem(this._config.id, "positions", this._positions);
    }
    // Per-endpoint "what does this control" annotations, shown in the exploded
    // device view. Pure user-supplied knowledge (what a relay is physically
    // wired to) — no Zigbee data can ever supply this, so it's persisted
    // through this._storage the same way floor-plan positions are, not
    // derived from a scan.
    async _loadEndpointAnnotations() {
      try {
        const raw = await this._storage.getItem(this._config.id, "endpoint-annotations");
        this._epAnnotations = raw && typeof raw === "object" ? raw : {};
      } catch (e) {
        this._epAnnotations = {};
      }
    }
    async _saveEndpointAnnotations() {
      await this._storage.setItem(this._config.id, "endpoint-annotations", this._epAnnotations);
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
    // Which storage provider is active — "local" (this browser only) or
    // "shared" (the optional zha-bindings-manager-backend integration) —
    // is itself a per-browser choice, so it's read/written as a plain
    // localStorage key directly rather than through this._storage: the
    // whole point of this flag is deciding *which* provider this._storage
    // should even be, so it can't live inside either of them.
    _storageModeStorageKey() {
      return `zha-binding-map-card:${this._config.id || "default"}:storage-mode`;
    }
    _loadStorageModePreference() {
      try {
        const raw = localStorage.getItem(this._storageModeStorageKey());
        return raw === "shared" || raw === "local" ? raw : null;
      } catch (e) {
        return null;
      }
    }
    _saveStorageModePreference(mode) {
      try {
        localStorage.setItem(this._storageModeStorageKey(), mode);
      } catch (e) {
      }
    }
    /** Whether the given StorageProvider holds anything worth a decision
     *  about — scan state, history, or any of the generic settings in
     *  SYNCED_ITEM_KEYS (floor plan, positions, filters, annotations,
     *  etc.). Shared by _hasExistingLocalData and _hasExistingBackendData
     *  below so both sides of the "who has data" check stay in sync with
     *  what actually gets imported. */
    async _hasStorageData(storage) {
      try {
        const [scanState, history, ...items] = await Promise.all([
          storage.getScanState(this._config.id),
          storage.getHistory(this._config.id),
          ...SYNCED_ITEM_KEYS.map((key) => storage.getItem(this._config.id, key))
        ]);
        if (scanState && (scanState.last_complete || scanState.latest)) return true;
        if (history && Object.keys(history).length) return true;
        return items.some((v) => v !== null && v !== void 0);
      } catch (e) {
        return false;
      }
    }
    async _hasExistingLocalData() {
      return this._hasStorageData(this._localStorage);
    }
    /** Copies this browser's local data into shared storage, but only for
     *  whatever shared storage doesn't already have — scan state, history,
     *  and each SYNCED_ITEM_KEYS setting are checked and filled in
     *  individually. Nothing already present in shared storage is ever
     *  touched, so this is safe to call unconditionally whenever a browser
     *  chooses shared storage: a fresh backend install gets a full copy
     *  (every check below finds "missing"); a backend that already has,
     *  say, scan data from another browser but never got a floor plan
     *  still picks up the floor plan from this browser without touching
     *  the scan data. This replaced an earlier version that only imported
     *  when shared storage was entirely empty, which meant a browser could
     *  never contribute anything once *any* data existed there — including
     *  its own later-added settings after an update expanded what's
     *  synced.
     *
     *  Ends with an explicit haStorage.flush() — every setItem/setScanState/
     *  setHistory call below only updates HaStorageProvider's in-memory
     *  state and *schedules* a debounced save (see SAVE_DEBOUNCE_MS); it
     *  does not itself wait for that save to actually reach the backend.
     *  For routine autosaves (e.g. dragging a device) that debounce is the
     *  right tradeoff. This call site is different: it's a one-time,
     *  user-confirmed "sync my data now" action, so it needs to actually
     *  land before this method returns — without the flush, a page reload
     *  or the card re-rendering in the ~1.5s debounce window would silently
     *  drop everything just written, which is exactly what happened when
     *  this was first shipped without it (positions/floor plan appeared to
     *  carry over, then reverted to empty after the next real reload). */
    async _fillMissingBackendDataFromLocal(haStorage) {
      const [localScanState, localHistory, backendScanState, backendHistory, ...localItems] = await Promise.all([
        this._localStorage.getScanState(this._config.id),
        this._localStorage.getHistory(this._config.id),
        haStorage.getScanState(this._config.id),
        haStorage.getHistory(this._config.id),
        ...SYNCED_ITEM_KEYS.map((key) => this._localStorage.getItem(this._config.id, key))
      ]);
      const writes = [];
      const backendHasScanState = !!(backendScanState && (backendScanState.last_complete || backendScanState.latest));
      const localHasScanState = !!(localScanState && (localScanState.last_complete || localScanState.latest));
      if (!backendHasScanState && localHasScanState) {
        writes.push(haStorage.setScanState(this._config.id, localScanState));
      }
      const backendHasHistory = backendHistory && Object.keys(backendHistory).length > 0;
      const localHasHistory = localHistory && Object.keys(localHistory).length > 0;
      if (!backendHasHistory && localHasHistory) {
        writes.push(haStorage.setHistory(this._config.id, localHistory));
      }
      const backendItems = await Promise.all(SYNCED_ITEM_KEYS.map((key) => haStorage.getItem(this._config.id, key)));
      SYNCED_ITEM_KEYS.forEach((key, i) => {
        const backendHasIt = backendItems[i] !== null && backendItems[i] !== void 0;
        const localHasIt = localItems[i] !== null && localItems[i] !== void 0;
        if (!backendHasIt && localHasIt) writes.push(haStorage.setItem(this._config.id, key, localItems[i]));
      });
      await Promise.all(writes);
      await haStorage.flush();
    }
    /** Decides which StorageProvider this._storage should be, called once
     *  per card load from _loadAll (before anything reads/writes scan
     *  state). Cases:
     *   - no backend detected → stays on local storage, nothing to ask.
     *   - backend detected, this browser already has a recorded choice →
     *     honor it silently, no re-prompt.
     *   - backend detected for the first time on this browser, and this
     *     browser has no local data worth a decision about → adopt shared
     *     storage automatically, nothing to lose either way.
     *   - backend detected for the first time, this browser has local data
     *     → offer to use shared storage, filling in anything shared
     *     storage is missing from this browser's local copy
     *     (_fillMissingBackendDataFromLocal). One prompt covers every
     *     case — fresh backend, backend with someone else's data, backend
     *     with some but not all settings already synced — because the
     *     fill-in is always non-destructive to what's already shared.
     *  confirm() is a one-time, blocking yes/no — fits this better than
     *  inventing new dialog UI for something that happens at most once per
     *  browser. */
    async _resolveStorageProvider() {
      const probe = await HaStorageProvider.probe(this._hass);
      this._backendAvailable = probe.available;
      this._backendInstalled = probe.installed;
      this._backendVersion = probe.version;
      this._bundledCardVersion = probe.bundledCardVersion;
      this._experimental = probe.experimental;
      this._watchEnabled = !!probe.watch;
      this._replaceEnabled = !!probe.replace;
      this._evidenceEnabled = !!probe.evidence;
      if (this._api) this._api.watchEnabled = this._watchEnabled;
      this._lqiThr = probe.lqi || { ...LQI_RECOMMENDED };
      this._experimentalKnown = true;
      if (this._pendingHashView === "mesh") {
        this._pendingHashView = null;
        if (this._experimental && this.shadowRoot && this.shadowRoot.firstChild) this._switchView("mesh");
        else this._writeHashView(this._view);
      }
      this._toggleExperimentalUi();
      if (!this._backendAvailable) {
        this._storageMode = "local";
        this._storage = this._localStorage;
        return;
      }
      const savedMode = this._loadStorageModePreference();
      if (savedMode === "local") {
        this._storageMode = "local";
        this._storage = this._localStorage;
        return;
      }
      if (savedMode === "shared") {
        this._storageMode = "shared";
        this._storage = new HaStorageProvider(this._hass, this._config.id);
        return;
      }
      const haStorage = new HaStorageProvider(this._hass, this._config.id);
      const hasLocalData = await this._hasExistingLocalData();
      if (!hasLocalData) {
        this._storageMode = "shared";
        this._saveStorageModePreference("shared");
        this._storage = haStorage;
        return;
      }
      const useShared = confirm(
        "ZHA Bindings Manager found shared storage (the ZHA Bindings Manager integration) on this Home Assistant instance.\n\nUse shared storage? Anything shared storage is missing (bindings, floor plan, filters, and other settings) will be filled in from this browser's local copy. Anything already saved there \u2014 e.g. from another browser or device \u2014 will NOT be overwritten.\n\nOK \u2014 use shared storage\nCancel \u2014 keep using this browser only"
      );
      if (useShared) {
        await this._fillMissingBackendDataFromLocal(haStorage);
        this._storageMode = "shared";
        this._saveStorageModePreference("shared");
        this._storage = haStorage;
      } else {
        this._storageMode = "local";
        this._saveStorageModePreference("local");
        this._storage = this._localStorage;
      }
    }
    _clearStorageModePreference() {
      try {
        localStorage.removeItem(this._storageModeStorageKey());
      } catch (e) {
      }
    }
    /** "Use shared storage" button in the settings panel — for a browser
     *  that previously chose local-only (or never got asked) and now wants
     *  to switch. Deliberately doesn't duplicate _resolveStorageProvider's
     *  logic here: it clears this browser's remembered choice and re-runs
     *  the full load, which re-triggers that same first-time-detection
     *  flow (fill-in-the-gaps import via _fillMissingBackendDataFromLocal,
     *  never overwriting whatever's already shared) instead of a second,
     *  possibly-diverging copy of it. */
    async _switchToSharedStorage() {
      this._clearStorageModePreference();
      await this._loadAll();
    }
    /** "Use this browser only" button — the reverse direction needs no
     *  prompt and no branching: this browser's local copy was never
     *  touched while it was on shared storage, so switching back can't
     *  lose or overwrite anything, and switching to shared again later
     *  (via the button above) is always available. */
    async _switchToLocalStorage() {
      this._storageMode = "local";
      this._saveStorageModePreference("local");
      this._storage = this._localStorage;
      this._renderStorageMode();
      await this._loadScanState();
      await this._loadHistory();
      await this._loadFilters();
      await this._loadPositions();
      await this._loadRetryCount();
      await this._loadScanBatchSize();
      await this._loadFpMarkerScale();
      await this._loadFloorplan();
      await this._loadEndpointAnnotations();
      await this._loadShowDevicePhotos();
      if (this._fpImageUrl) this._loadFpImage(this._fpImageUrl);
      this._render();
      this._renderFilterChips();
    }
    // Whether the "install the optional backend" hint has been dismissed —
    // same reasoning as the storage-mode flag above, a plain per-browser
    // localStorage read, not routed through this._storage.
    _storageHintDismissedStorageKey() {
      return `zha-binding-map-card:${this._config.id || "default"}:storage-hint-dismissed`;
    }
    _loadStorageHintDismissed() {
      try {
        return localStorage.getItem(this._storageHintDismissedStorageKey()) === "1";
      } catch (e) {
        return false;
      }
    }
    _saveStorageHintDismissed(value) {
      try {
        localStorage.setItem(this._storageHintDismissedStorageKey(), value ? "1" : "0");
      } catch (e) {
      }
    }
    /** Updates the toolbar badge and the Storage section of the settings
     *  panel to reflect this._storageMode/this._backendAvailable — called
     *  once after _resolveStorageProvider() settles each load, and again
     *  whenever the dismiss-hint button is clicked. Storage mode itself
     *  doesn't change mid-session otherwise, so nothing else needs to
     *  trigger this. */
    _renderStorageMode() {
      const badge = this._q("#storage-mode-badge");
      if (badge) {
        if (this._storageMode === "shared") {
          badge.textContent = "\u2601 Shared in Home Assistant";
          badge.title = "This card's scan data is saved centrally via the ZHA Bindings Manager integration \u2014 available from any browser or device.";
        } else if (this._storageMode === "local") {
          badge.textContent = "\u{1F512} This browser only";
          badge.title = this._backendAvailable ? "This card's scan data is saved only in this browser. A shared backend is installed but you've chosen not to use it \u2014 see the \u2699 settings panel to change that." : "This card's scan data is saved only in this browser. See the \u2699 settings panel for an optional way to share it across devices.";
        } else {
          badge.textContent = "";
          badge.title = "";
        }
      }
      const detail = this._q("#storage-mode-detail");
      if (detail) {
        detail.textContent = this._storageMode === "shared" ? "Using shared storage: this browser's scan data is saved via the ZHA Bindings Manager integration, so it's the same data in every browser and device that opens this card." : "Using this browser's local storage: scan data is only available here, not shared with other browsers or devices.";
      }
      const backendLine = this._q("#backend-version-line");
      if (backendLine) {
        backendLine.textContent = aboutIntegrationText({
          checked: this._backendAvailable !== null,
          installed: this._backendInstalled,
          storageOn: this._backendAvailable,
          version: this._backendVersion,
          bundledCardVersion: this._bundledCardVersion,
          cardVersion: CARD_VERSION
        });
      }
      const hint = this._q("#storage-backend-hint");
      if (hint) {
        const show = !this._backendInstalled && !this._backendAvailable && !this._loadStorageHintDismissed();
        hint.style.display = show ? "" : "none";
      }
      const useSharedBtn = this._q("#btn-use-shared-storage");
      if (useSharedBtn) {
        useSharedBtn.style.display = this._backendAvailable && this._storageMode === "local" ? "" : "none";
      }
      const useLocalBtn = this._q("#btn-use-local-storage");
      if (useLocalBtn) {
        useLocalBtn.style.display = this._storageMode === "shared" ? "" : "none";
      }
    }
    // Bindings are read from your Zigbee network live (binds_get), which is
    // slow and can't run in the background, so we cache the last scan result
    // per-browser and load it back on every card render. "Scan bindings" is
    // then a manual refresh rather than something you have to redo every time
    // the dashboard loads.
    //
    // As of M5, this goes through StorageProvider.getScanState/setScanState
    // rather than a direct localStorage call, and covers both halves of the
    // latest/last_complete split: last_complete is this same per-device
    // binding cache as before (never regresses — a device that fails a scan
    // keeps its last successful data), latest is which devices failed or
    // partially responded on the most recent attempt, which previously lived
    // in _scanFailures/_scanPartial in-memory only and was lost on reload.
    async _loadScanState() {
      try {
        const state = await this._storage.getScanState(this._config.id);
        if (state.last_complete && state.last_complete.bindings) {
          const { bindings, dropped } = sanitizeStoredBindings(state.last_complete.bindings);
          if (dropped) console.warn(`[ZHA Bindings Manager] ignored ${dropped} malformed saved binding(s)`);
          this._bindings = bindings;
          const savedAt = state.last_complete.savedAt;
          this._lastScanAt = typeof savedAt === "string" && !Number.isNaN(Date.parse(savedAt)) ? savedAt : null;
        }
        const failures = state.latest && Array.isArray(state.latest.failures) ? state.latest.failures : [];
        this._scanFailures = new Set(failures.filter(isIeee).map(normIeee));
        const partial = state.latest && state.latest.partial || {};
        this._scanPartial = new Map(
          typeof partial === "object" && !Array.isArray(partial) ? Object.entries(partial).filter(([k]) => isIeee(k)).map(([k, v]) => [normIeee(k), v]) : []
        );
      } catch (e) {
      }
    }
    /** Saves last_complete (always) and, when `latestOutcome` is supplied —
     *  i.e. right after a scan run, not on every incidental call — latest
     *  too. Kept as one write so the two halves of the split can't drift out
     *  of sync with each other in storage. */
    async _saveScanState(latestOutcome) {
      try {
        const bindings = Object.fromEntries(this._bindings);
        this._lastScanAt = (/* @__PURE__ */ new Date()).toISOString();
        await this._storage.setScanState(this._config.id, {
          last_complete: { savedAt: this._lastScanAt, bindings },
          latest: latestOutcome || {
            attemptedAt: this._lastScanAt,
            failures: [...this._scanFailures],
            partial: Object.fromEntries(this._scanPartial)
          }
        });
      } catch (e) {
      }
    }
    // Learned per-device response-time/outcome history — see the constructor
    // comment and _recordScanOutcome/_historyFor below. Persisted the same way
    // the bindings cache is, so it builds up knowledge across sessions.
    async _loadHistory() {
      try {
        const raw = await this._storage.getHistory(this._config.id);
        this._responseHistory = new Map(Object.entries(raw || {}));
      } catch (e) {
        this._responseHistory = /* @__PURE__ */ new Map();
      }
    }
    async _saveHistory() {
      try {
        await this._storage.setHistory(this._config.id, Object.fromEntries(this._responseHistory));
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
    async _loadRetryCount() {
      try {
        const raw = await this._storage.getItem(this._config.id, "retry-count");
        const n = Number(raw);
        this._retryCount = Number.isFinite(n) && n >= 1 ? n : DEFAULT_RETRY_COUNT;
      } catch (e) {
        this._retryCount = DEFAULT_RETRY_COUNT;
      }
      const el = this._q("#rescan-retry-count");
      if (el) el.value = this._retryCount;
    }
    async _saveRetryCount(value) {
      this._retryCount = clamp(Number(value) || DEFAULT_RETRY_COUNT, 1, 10);
      await this._storage.setItem(this._config.id, "retry-count", this._retryCount);
    }
    // How many devices _scanBindings reads concurrently — see
    // DEFAULT_SCAN_BATCH_SIZE for the reasoning. User-configurable because a
    // fixed batch size interacts with device ordering: a larger batch makes it
    // less likely several sleepy/offline devices land in different batches and
    // each drag one out by ~45s, but there's no single number that's provably
    // optimal for every network, so it's a setting rather than a constant.
    async _loadScanBatchSize() {
      try {
        const raw = await this._storage.getItem(this._config.id, "scan-batch-size");
        const n = Number(raw);
        this._scanBatchSize = Number.isFinite(n) && n >= 1 ? n : DEFAULT_SCAN_BATCH_SIZE;
      } catch (e) {
        this._scanBatchSize = DEFAULT_SCAN_BATCH_SIZE;
      }
      const el = this._q("#scan-batch-size");
      if (el) el.value = this._scanBatchSize;
    }
    async _saveScanBatchSize(value) {
      this._scanBatchSize = clamp(Number(value) || DEFAULT_SCAN_BATCH_SIZE, 1, 30);
      await this._storage.setItem(this._config.id, "scan-batch-size", this._scanBatchSize);
    }
    // Floor Plan marker size — see DEFAULT_FP_MARKER_SCALE for the reasoning.
    async _loadFpMarkerScale() {
      try {
        const raw = await this._storage.getItem(this._config.id, "fp-marker-scale");
        const n = Number(raw);
        this._fpMarkerScale = Number.isFinite(n) && n >= 10 ? n : DEFAULT_FP_MARKER_SCALE;
      } catch (e) {
        this._fpMarkerScale = DEFAULT_FP_MARKER_SCALE;
      }
      const el = this._q("#fp-marker-scale");
      if (el) el.value = this._fpMarkerScale;
    }
    async _saveFpMarkerScale(value) {
      this._fpMarkerScale = clamp(Number(value) || DEFAULT_FP_MARKER_SCALE, 40, 200);
      await this._storage.setItem(this._config.id, "fp-marker-scale", this._fpMarkerScale);
    }
    // Whether the exploded device view fetches a real product photo from
    // zigbee2mqtt.io (see _deviceImageUrl). Defaults on, but this is the one
    // thing in the whole card that calls out to the internet rather than your
    // own HA instance, so it's a plain, easy-to-find toggle right on the
    // dialog itself, not buried in a settings tab.
    async _loadShowDevicePhotos() {
      try {
        const raw = await this._storage.getItem(this._config.id, "show-device-photos");
        this._showDevicePhotos = raw === null ? true : !!raw;
      } catch (e) {
        this._showDevicePhotos = true;
      }
    }
    async _saveShowDevicePhotos(value) {
      this._showDevicePhotos = !!value;
      await this._storage.setItem(this._config.id, "show-device-photos", this._showDevicePhotos);
    }
    // Last-known device names (see the constructor). Deliberately not in
    // SYNCED_ITEM_KEYS: it's rewritten whenever names change, so counting it
    // would make every browser look like it "has data" in the storage-mode
    // check. It rebuilds itself from the live device list anyway.
    async _loadKnownDevices() {
      try {
        const raw = await this._storage.getItem(this._config.id, "known-devices");
        this._knownDevices = new Map(Object.entries(raw && typeof raw === "object" ? raw : {}));
      } catch (e) {
        this._knownDevices = /* @__PURE__ */ new Map();
      }
      this._savedKnownJson = JSON.stringify(knownDevicesToSave(this._knownDevices, this._devices, this._bindings));
    }
    /** Saves only when the snapshot actually changed, so routine reloads
     *  don't write to (shared) storage. */
    async _saveKnownDevices() {
      const snap = knownDevicesToSave(this._knownDevices, this._devices, this._bindings);
      const json = JSON.stringify(snap);
      if (json === this._savedKnownJson) return;
      this._savedKnownJson = json;
      try {
        await this._storage.setItem(this._config.id, "known-devices", snap);
      } catch (e) {
      }
    }
    /** `action` (optional): {label, onClick} rendered as a button in the
     *  status bar, e.g. "Check again" after an unconfirmed bind. */
    _setStatus(level, text, timeout = 6e3, action = null) {
      this._status = { level, text, action };
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
      await this._resolveStorageProvider();
      this._renderStorageMode();
      await this._loadScanState();
      await this._loadHistory();
      await this._loadFilters();
      await this._loadPositions();
      await this._loadRetryCount();
      await this._loadScanBatchSize();
      await this._loadFpMarkerScale();
      await this._loadPendingChecks();
      await this._loadFloorplan();
      await this._loadEndpointAnnotations();
      await this._loadShowDevicePhotos();
      await this._loadKnownDevices();
      if (this._fpImageUrl) this._loadFpImage(this._fpImageUrl);
      this._setStatus("info", "Loading ZHA devices\u2026", 0);
      await this._reloadDevices({ initial: true });
      this._openDeepLinkedDevice();
      this._pickUpIntegrationScans();
      this._lostLoad();
      this._evidenceLoad();
    }
    // -------------------------------------------------------------------
    // Lost bindings (1.8.0, integration only)
    // -------------------------------------------------------------------
    /** Reads what the integration's watch knows: bindings that were there
     *  before and aren't any more. */
    async _lostLoad() {
      if (!this._watchEnabled || !this._api) {
        this._lost = null;
        this._renderLostBanner();
        return;
      }
      try {
        this._lost = await this._api.watchGet();
      } catch (e) {
        this._lost = null;
      }
      this._renderLostBanner();
      this._renderHealthSummary(this._computeHealthMap());
      if (this._edgesLayer) this._renderGraphEdges();
      if (this._drawerIeee) this._renderDrawer();
    }
    /** After a scan: the integration compares the newly saved scan with what
     *  it expected, which takes a moment. */
    _lostSoon() {
      if (!this._watchEnabled) return;
      clearTimeout(this._lostTimer);
      this._lostTimer = setTimeout(() => this._lostLoad(), 1500);
    }
    async _lostAction(label, fn) {
      if (this._lostBusy) return;
      this._lostBusy = label;
      this._renderLostBanner();
      if (this._drawerIeee) this._renderDrawer();
      try {
        return await fn();
      } catch (err) {
        this._setStatus("error", `${label} failed: ${extractErrorMessage(err)}`, 0);
        return null;
      } finally {
        this._lostBusy = null;
        await this._lostLoad();
      }
    }
    async _lostPutBack(ieee) {
      const res = await this._lostAction(ieee ? "Put back" : "Put all back", () => this._api.watchPutBack(ieee));
      if (!res) return;
      const nameOf = (i) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === normIeee(i));
        return d ? this._deviceLabel(d) : i;
      };
      const m = putBackMessage(res.results, nameOf);
      this._setStatus(m.level, m.text, 0);
      const done = Object.entries(res.results || {}).filter(([, st]) => st === "put_back").map(([i]) => i);
      if (done.length) this._scanBindings(done, { tries: 1 });
    }
    async _lostForget(ieee, key) {
      await this._lostAction("Removed on purpose", () => this._api.watchForget(ieee, key ? [key] : null));
    }
    async _lostCheckAll() {
      const res = await this._lostAction("Check for lost bindings", () => this._api.watchCheckAll());
      if (!res) return;
      const vals = Object.values(res && res.results || res || {});
      const asleep = vals.filter((v) => v === "no_answer").length;
      const lost = lostSummary(this._lost).total;
      this._setStatus(
        lost ? "warning" : "success",
        `Checked ${vals.length} device${vals.length === 1 ? "" : "s"}: ${lost ? `${lost} lost binding${lost === 1 ? "" : "s"}` : "nothing lost"}.${asleep ? ` ${asleep} didn't answer (asleep or off); they're checked again when they next wake up.` : ""}`,
        0
      );
    }
    _renderLostBanner() {
      const el = this._q("#lost-banner");
      if (!el) return;
      const sum = lostSummary(this._lost);
      if (!this._watchEnabled || !sum.total) {
        el.style.display = "none";
        el.innerHTML = "";
        return;
      }
      const busy = this._lostBusy;
      const nDev = sum.devices.length;
      const list2 = this._lostOpen ? `<div class="lost-list">${sum.devices.map(
        (d) => `<div class="lost-device">
              <div class="lost-device-head">
                <a href="#" class="src-link lost-dev-link" data-ieee="${escapeHtml(d.ieee)}"><strong>${escapeHtml(this._ieeeLabel(d.ieee, { plain: true }) || d.name)}</strong></a>
                <span class="muted">${escapeHtml(POLICY_LABELS[d.policy] || d.policy)}${d.autoPaused ? " \xB7 stopped putting back automatically (3 times today)" : ""}${d.queued ? " \xB7 waiting for it to wake up" : ""}</span>
                <button class="btn btn-small lost-put-back" data-ieee="${escapeHtml(d.ieee)}" ${busy ? "disabled" : ""}>Put back</button>
              </div>
              <ul>${d.lost.map(
          (b) => `<li><span>${escapeHtml(b.text || b.key)}</span> <span class="muted">${escapeHtml(
            [NOTICED_BY[b.noticed_by] || "", sinceText(b.since)].filter(Boolean).join(", ")
          )}</span> \xB7 <a href="#" class="src-link lost-forget" data-ieee="${escapeHtml(d.ieee)}" data-key="${escapeHtml(
            b.key
          )}" title="You removed it yourself (outside this card, e.g. by resetting the device). Stop expecting it.">Removed on purpose</a></li>`
        ).join("")}</ul>
            </div>`
      ).join("")}</div>` : "";
      el.innerHTML = `
      <div class="stale-row">
        <span><strong>${sum.total} lost binding${sum.total === 1 ? "" : "s"}</strong> on ${nDev} device${nDev === 1 ? "" : "s"}:
          ${nDev === 1 ? "it" : "they"} had ${sum.total === 1 ? "this binding" : "these bindings"} before and don't any more, so a button may no longer
          control what it used to.${sum.queued ? ` ${sum.queued} ${sum.queued === 1 ? "is" : "are"} asleep: ${sum.queued === 1 ? "it'll" : "they'll"} be put back the next time you press one of ${sum.queued === 1 ? "its" : "their"} buttons.` : ""}</span>
        <button class="btn btn-small" id="btn-lost-show">${this._lostOpen ? "Hide" : "Show"}</button>
        <button class="btn btn-small" id="btn-lost-check" ${busy ? "disabled" : ""} title="Read every watched device's binding table now">${busy === "Check for lost bindings" ? "Checking\u2026" : "Check again"}</button>
        <button class="btn btn-small btn-primary" id="btn-lost-put-back-all" ${busy ? "disabled" : ""}>${busy === "Put all back" ? "Putting back\u2026" : "Put all back"}</button>
      </div>${list2}`;
      el.style.display = "";
      const on = (sel, fn) => {
        const b = this._q(sel);
        if (b) b.addEventListener("click", fn);
      };
      on("#btn-lost-show", () => {
        this._lostOpen = !this._lostOpen;
        this._renderLostBanner();
      });
      on("#btn-lost-check", () => this._lostCheckAll());
      on("#btn-lost-put-back-all", () => this._lostPutBack(null));
      this._qa("#lost-banner .lost-put-back").forEach((b) => b.addEventListener("click", () => this._lostPutBack(b.dataset.ieee)));
      this._qa("#lost-banner .lost-forget").forEach(
        (a) => a.addEventListener("click", (e) => {
          e.preventDefault();
          this._lostForget(a.dataset.ieee, a.dataset.key);
        })
      );
      this._qa("#lost-banner .lost-dev-link").forEach(
        (a) => a.addEventListener("click", (e) => {
          e.preventDefault();
          const d = this._devices.find((x) => normIeee(x.ieee) === a.dataset.ieee);
          if (d) this._openDeviceDrawer(d);
        })
      );
    }
    // -------------------------------------------------------------------
    // Address changes and missed presses (1.10.0, integration)
    // -------------------------------------------------------------------
    async _evidenceLoad() {
      if (!this._evidenceEnabled || !this._api) return;
      try {
        this._evidence = await this._api.evidenceGet();
      } catch (e) {
        this._evidence = null;
      }
      this._renderEvidenceBanner();
      if (this._drawerIeee) this._renderDrawer();
    }
    _evidenceName(ieee) {
      const d = this._devices.find((x) => normIeee(x.ieee) === normIeee(ieee));
      return d ? this._deviceLabel(d) : this._evidence && this._evidence.names && this._evidence.names[ieee] || ieee;
    }
    _drawerAddressFact(d) {
      const f = this._evidence ? addressFact(this._evidence, d.ieee) : null;
      const nwk = f ? f.nwk : d.nwk != null && d.nwk !== "" ? typeof d.nwk === "string" ? d.nwk : `0x${Number(d.nwk).toString(16).padStart(4, "0")}` : null;
      if (!nwk) return null;
      if (!f || !f.changes) return escapeHtml(nwk);
      return `${escapeHtml(nwk)} <span class="health-warning">changed ${f.changes}\xD7 since recording started</span> <a href="#" class="src-link" id="drawer-evidence-link">Details</a>`;
    }
    _renderEvidenceBanner() {
      const el = this._q("#evidence-banner");
      if (!el) return;
      const sum = this._evidenceEnabled && this._evidence ? noticeSummary(this._evidence, (i) => this._evidenceName(i)) : null;
      let dismissed = null;
      try {
        dismissed = localStorage.getItem("zbm-evidence-dismissed");
      } catch (e) {
      }
      if (!sum || dismissed === sum.key) {
        el.style.display = "none";
        el.innerHTML = "";
        return;
      }
      const parts = [];
      if (sum.changed) parts.push(`<strong>${sum.changed} device${sum.changed === 1 ? "" : "s"} changed ${sum.changed === 1 ? "its" : "their"} network address</strong>`);
      if (sum.misses)
        parts.push(
          `<strong>${sum.misses} press${sum.misses === 1 ? "" : "es"} didn't reach a light</strong>${sum.afterChange ? ` (${sum.afterChange} after that light's address changed)` : ""}`
        );
      el.innerHTML = `<div class="stale-row">
        <span>${parts.join(", and ")}. A battery remote can keep sending to a light's old address, so it stops working even though
          its binding is still there. Sharing an anonymised report helps find out how often this happens, and why.</span>
        <button class="btn btn-small" id="btn-evidence-show">Show</button>
        <button class="btn btn-small btn-primary" id="btn-evidence-share">Share anonymously\u2026</button>
        <button class="btn btn-small" id="btn-evidence-dismiss" title="Hide until something else changes">Dismiss</button>
      </div>`;
      el.style.display = "";
      const on = (sel, fn) => {
        const b = this._q(sel);
        if (b) b.addEventListener("click", fn);
      };
      on("#btn-evidence-show", () => this._openEvidence(false));
      on("#btn-evidence-share", () => this._openEvidence(true));
      on("#btn-evidence-dismiss", () => {
        try {
          localStorage.setItem("zbm-evidence-dismissed", sum.key);
        } catch (e) {
        }
        el.style.display = "none";
      });
    }
    _firmwareOf(d) {
      const reg = d && d.ieee ? this._haDeviceRegistryEntry(d.ieee) : null;
      return reg && reg.sw_version || "";
    }
    _openEvidence(share) {
      this._evidenceShare = !!share;
      this._closeDrawer();
      this._q("#dialog-title").textContent = "Address changes and missed presses";
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.add("wide");
      this._q("#dialog").classList.add("open");
      this._renderEvidence();
    }
    _renderEvidence() {
      const body = this._q("#dialog-body");
      const res = this._evidence || { addresses: {}, misses: [], pairs: {} };
      const since = res.since ? new Date(res.since).toLocaleDateString() : "";
      if (this._evidenceShare) {
        const record = buildNetworkReport(res, this._devices.filter((d) => !this._isRemovedDevice(d.ieee)), {
          firmwareOf: (d) => this._firmwareOf(d),
          cardVersion: CARD_VERSION
        });
        const issue = reportIssue(record);
        body.innerHTML = `<div class="flow">
        <p>This is exactly what would be shared with the community
          <a href="https://github.com/${CAPABILITY_DB_REPO}" target="_blank" rel="noopener">zigbee-capabilities</a> database: every device's
          make, model, firmware, power source and role (the coordinator too), how often its network address changed, and the presses
          that didn't reach a light. Devices are numbered d1, d2\u2026: <strong>no addresses, names, areas or times of day.</strong></p>
        <p class="hint">Nothing is sent until you press <em>Submit new issue</em> on GitHub. It's public once the database merges it.</p>
        <textarea class="ep-cmd-share-json" readonly rows="12">${escapeHtml(issue.body)}</textarea>
        <div class="dialog-actions">
          <a class="btn btn-primary" id="evidence-open" href="${escapeHtml(issue.url)}" target="_blank" rel="noopener">${issue.tooLong ? "Copy and open GitHub issue" : "Open GitHub issue"}</a>
          <button class="btn" id="evidence-back">Back</button>
        </div>
        ${issue.tooLong ? `<p class="hint">It's too long to fill in the issue for you: the button copies it, so paste it into the new issue.</p>` : ""}
      </div>`;
        const open = this._q("#evidence-open");
        if (open)
          open.addEventListener("click", async () => {
            if (issue.tooLong) await this._copyShareText(issue.body);
          });
        const back = this._q("#evidence-back");
        if (back)
          back.addEventListener("click", () => {
            this._evidenceShare = false;
            this._renderEvidence();
          });
        return;
      }
      const changed = changedDevices(res, (i) => this._evidenceName(i));
      const changedHtml = changed.length ? `<table class="detail-table">${changed.map(
        (c) => `<tr><td><strong>${escapeHtml(c.name)}</strong><br><span class="muted">${c.changes} change${c.changes === 1 ? "" : "s"}</span></td><td>${historyLines(
          c.history
        ).map((l) => `${escapeHtml(l.nwk)} <span class="muted">${escapeHtml(l.when)} \xB7 ${escapeHtml(l.how)}</span>`).join("<br>")}</td></tr>`
      ).join("")}</table>` : `<p class="muted">No device has changed its address since ${escapeHtml(since)}.</p>`;
      const misses = [...res.misses || []].reverse();
      const missHtml = misses.length ? `<table class="detail-table">${misses.slice(0, 50).map(
        (m) => `<tr><td>${escapeHtml(new Date(m.at).toLocaleString())}</td><td>${escapeHtml(this._evidenceName(m.remote))} \u2192 ${escapeHtml(
          this._evidenceName(m.light)
        )}</td><td>${m.address_changed_since_last_ok ? `<span class="health-warning">its address changed since the last press that worked (${escapeHtml(m.nwk_at_last_ok || "?")} \u2192 ${escapeHtml(
          m.nwk_now || "?"
        )})</span>` : m.last_ok_at ? "address unchanged since the last press that worked" : "no press that worked recorded yet"}${m.binding_in_last_read ? " \xB7 binding still in the remote's table" : ""}</td></tr>`
      ).join("")}</table>` : `<p class="muted">No missed presses recorded.</p>`;
      body.innerHTML = `<div class="flow">
      <p class="hint">Recorded since ${escapeHtml(since)} (turn it off under the integration's Configure). Read-only: nothing is sent to your devices.
        A missed press is a remote's On, Off or Toggle that a light bound to it directly didn't follow within 2 seconds.</p>
      <div class="drawer-section-title">Network address changes</div>${changedHtml}
      <div class="drawer-section-title">Missed presses</div>${missHtml}
      <div class="dialog-actions"><button class="btn btn-primary" id="evidence-share">Share anonymously\u2026</button></div>
    </div>`;
      const share = this._q("#evidence-share");
      if (share)
        share.addEventListener("click", () => {
          this._evidenceShare = true;
          this._renderEvidence();
        });
    }
    // -------------------------------------------------------------------
    // Replace a device (1.9.0)
    // -------------------------------------------------------------------
    _openReplace({ ieee = null, deadTargets = null } = {}) {
      this._closeDrawer();
      this._replace = { step: ieee ? "pick" : "old", oldIeee: ieee ? normIeee(ieee) : null, deadTargets: deadTargets || [], selected: /* @__PURE__ */ new Set(), endpointMap: {} };
      this._q("#dialog-title").textContent = "Replace a device";
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.add("wide");
      this._q("#dialog").classList.add("open");
      this._renderReplace();
    }
    _replaceOldDevice() {
      const r = this._replace;
      const d = this._devices.find((x) => normIeee(x.ieee) === r.oldIeee);
      return d || { ieee: r.oldIeee, name: this._ieeeLabel(r.oldIeee, { plain: true }), gone: true };
    }
    _replaceTypeOf(d) {
      return detectDeviceType(this._clusterCache.get(d.ieee), d.power_source);
    }
    _renderReplace() {
      const r = this._replace;
      if (!r) return;
      const body = this._q("#dialog-body");
      const steps = [
        ["pick", "1. Choose the new device"],
        ["check", "2. Check"],
        ["run", "3. Copy"],
        ["done", "4. Clean up"]
      ];
      const stepsHtml = `<ol class="flow-steps">${steps.map(([k, v]) => `<li class="${k === r.step ? "active" : ""}">${v}</li>`).join("")}</ol>`;
      const needs = !this._replaceEnabled ? `<div class="flow-callout flow-result-warning">Replacing a device needs the ZHA Bindings Manager integration (1.9.0 or later) with
          "Watch for lost bindings" on: it reads the saved scans, copies the bindings and checks each one.</div>` : "";
      let html = "";
      if (r.step === "old") {
        html = `<p>Which device did you replace? These no longer exist in ZHA, but other devices still have bindings to them.</p>
        <div class="flow-targets">${r.deadTargets.map((i) => `<label class="flow-target"><input type="radio" name="replace-old" value="${escapeHtml(i)}"> ${escapeHtml(this._ieeeLabel(i, { plain: true }))} <span class="muted">${escapeHtml(i)}</span></label>`).join("")}</div>
        <div class="dialog-actions"><button class="btn btn-primary" id="replace-next" disabled>Next</button><button class="btn" id="replace-cancel">Cancel</button></div>`;
      } else if (r.step === "pick") {
        const old = this._replaceOldDevice();
        const cands = replacementCandidates(this._devices.filter((x) => !this._isRemovedDevice(x.ieee)), old, {
          coordinatorIeee: this._coordinatorIeee(),
          typeOf: (x) => this._replaceTypeOf(x),
          nameOf: (x) => this._deviceLabel(x)
        });
        html = `<p>Replacing <strong>${escapeHtml(old.gone ? old.name : this._deviceLabel(old))}</strong>${old.gone ? ` <span class="muted">(no longer in ZHA: its bindings come from saved scans)</span>` : ""}. Pair the new device first, then choose it here.</p>
        <input type="search" id="replace-filter" placeholder="Filter devices" value="${escapeHtml(r.filter || "")}">
        <div class="flow-targets">${cands.filter((c) => !r.filter || this._deviceLabel(c.device).toLowerCase().includes(r.filter.toLowerCase())).map(
          (c) => `<label class="flow-target"><input type="radio" name="replace-new" value="${escapeHtml(c.device.ieee)}" ${normIeee(c.device.ieee) === r.newIeee ? "checked" : ""}> ${escapeHtml(this._deviceLabel(c.device))}${c.why ? ` <span class="flow-suggested">${escapeHtml(c.why)}</span>` : ""}
              <span class="muted">${escapeHtml([c.device.manufacturer, c.device.model].filter(Boolean).join(" "))} \xB7 ${escapeHtml(c.device.power_source || "")}</span></label>`
        ).join("")}</div>
        <p class="hint">Same model, re-paired after a reset? That keeps its address, so it isn't a replacement: use Put all back for lost bindings instead.</p>
        <div class="dialog-actions"><button class="btn btn-primary" id="replace-next" ${r.newIeee && this._replaceEnabled ? "" : "disabled"}>Check it</button><button class="btn" id="replace-cancel">Cancel</button></div>`;
      } else if (r.step === "check") {
        html = this._replaceCheckHtml();
      } else if (r.step === "run") {
        html = `<p>${escapeHtml(r.progress || "Copying\u2026")}</p><p class="hint">Each binding is read back from the device that holds it. A battery device
        that's asleep gets its bindings at its next button press.</p>`;
      } else if (r.step === "done") {
        html = this._replaceDoneHtml();
      }
      body.innerHTML = `<div class="flow">${stepsHtml}${needs}${html}</div>`;
      this._wireReplace();
    }
    _replaceCheckHtml() {
      const r = this._replace;
      if (r.error) return `<div class="flow-callout flow-result-warning">${escapeHtml(r.error)}</div><div class="dialog-actions"><button class="btn" id="replace-back">Back</button></div>`;
      if (!r.plan) return `<p>Checking what the old device did and whether the new one can do it\u2026</p>`;
      const p = r.plan;
      const v = VERDICT[p.verdict] || VERDICT.unknown;
      const oldD = this._replaceOldDevice();
      const newD = this._devices.find((x) => normIeee(x.ieee) === r.newIeee) || { ieee: r.newIeee };
      const inClusters = [...new Set(p.items.filter((i) => i.role === "in").flatMap((i) => i.clusters))].filter((c) => c !== 4);
      const gaps = this._capExpIndex ? commandGaps(this._capExpIndex, oldD, newD, inClusters) : { gaps: [], unknown: true };
      const gapHtml = gaps.gaps.length ? `<div class="flow-callout flow-result-warning">From the community database: ${gaps.gaps.map((g) => `${escapeHtml(clusterName(g.clusterId))}: the old model accepts ${escapeHtml(g.missing.join(", "))}; the new one was checked and doesn't`).join(". ")}. Those commands from your remotes won't work on it.</div>` : gaps.unknown ? `<p class="hint">Only clusters were checked: one of the models has no command check in the community database yet. Sharing a scan of it helps.</p>` : `<p class="hint">The community database confirms the new model accepts the same commands.</p>`;
      const groupsOf = (kind, title, empty) => {
        const items = p.items.filter((i) => i.kind === kind);
        if (!items.length) return `<div class="drawer-section-title">${title}</div><p class="muted">${empty}</p>`;
        return `<div class="drawer-section-title">${title}</div>${items.map((i) => {
          const epSel = p.new_endpoints.length > 1 && i.old_ep != null ? ` <label class="muted">new ep <select data-epmap="${i.old_ep}">${p.new_endpoints.map((ep) => `<option value="${ep}" ${ep === i.new_ep ? "selected" : ""}>${ep}</option>`).join("")}</select></label>` : i.new_ep != null ? ` <span class="muted">\u2192 new ep ${i.new_ep}</span>` : "";
          return `<label class="flow-target"><input type="checkbox" data-item="${i.id}" ${r.selected.has(i.id) ? "checked" : ""} ${i.ok === false ? "disabled" : ""}> <span>${escapeHtml(i.text)}${epSel}${i.reason ? `<br><span class="health-warning">${escapeHtml(i.reason)}</span>` : ""}</span></label>`;
        }).join("")}`;
      };
      return `<div class="flow-callout flow-result-${v.level}"><strong>${v.icon} ${escapeHtml(v.text)}</strong></div>
      ${gapHtml}
      ${groupsOf("controlled_by", "Controlled by (bound on the other device)", "Nothing was bound to it.")}
      ${groupsOf("controls", "Controls (bound on the new device)", "It didn't control anything.")}
      ${groupsOf("group", "Groups (the new device joins)", "It wasn't in any ZHA group.")}
      <details class="drawer-lost-expect"><summary>What to expect</summary><ul>
        <li>This checks the clusters the new device declares and, where known, the commands the community confirmed. A device can
          still behave differently: press each remote afterwards, and share the result.</li>
        <li>Bindings to a dead device can only be found in saved scans. If a remote wasn't scanned since, it isn't listed: scan it first.</li>
        <li>Battery remotes only accept bindings when awake. Those are queued and go on at their next button press, while Home Assistant runs.</li>
        <li>Settings (power-on behaviour, a detached relay, LEDs) aren't copied: set them on the new device yourself.</li>
      </ul></details>
      <div class="dialog-actions"><button class="btn btn-primary" id="replace-run" ${r.selected.size ? "" : "disabled"}>Copy ${r.selected.size} item${r.selected.size === 1 ? "" : "s"}</button><button class="btn" id="replace-back">Back</button></div>`;
    }
    _replaceDoneHtml() {
      const r = this._replace;
      const p = r.plan;
      const sum = runSummary(r.results);
      const rows = p.items.filter((i) => r.results[i.id]).map((i) => `<li>${escapeHtml(i.text)}: <strong>${escapeHtml(RESULT_LABEL[r.results[i.id]] || r.results[i.id])}</strong></li>`).join("");
      const old = this._replaceOldDevice();
      const hasSources = p.items.some((i) => i.kind === "controlled_by");
      const groups = p.items.filter((i) => i.kind === "group");
      if (r.cleaned) {
        return `<div class="flow-callout flow-result-success">${escapeHtml(r.cleaned)}</div>
        <p>Now press each remote that controls the new device${p.items.some((i) => i.kind === "controls") ? ", and the new remote itself" : ""}, and check the lights respond.</p>
        <div class="dialog-actions"><button class="btn btn-primary" id="replace-close">Done</button></div>`;
      }
      return `<div class="flow-callout flow-result-${sum.level}">${escapeHtml(sum.text)}.</div><ul>${rows}</ul>
      <div class="drawer-section-title">Clean up</div>
      ${hasSources ? `<label class="flow-target"><input type="checkbox" id="replace-unbind-old" checked> Remove the bindings that still point at ${escapeHtml(old.name || this._deviceLabel(old))}</label>` : ""}
      ${!old.gone && groups.length ? `<label class="flow-target"><input type="checkbox" id="replace-leave-groups" checked> Take ${escapeHtml(this._deviceLabel(old))} out of its groups</label>` : ""}
      ${!old.gone ? `<label class="flow-target"><input type="checkbox" id="replace-remove-old"> Remove ${escapeHtml(this._deviceLabel(old))} from ZHA <span class="muted">(leave unticked if you'll reuse it)</span></label>` : ""}
      <p class="hint">Until then both devices stay bound, so nothing goes dark. The old device's bindings won't be reported as lost.</p>
      <div class="dialog-actions"><button class="btn btn-primary" id="replace-cleanup">Clean up</button><button class="btn" id="replace-close">Not now</button></div>`;
    }
    async _replacePlan() {
      const r = this._replace;
      r.plan = null;
      r.error = null;
      this._renderReplace();
      const old = this._replaceOldDevice();
      try {
        await Promise.all([old.gone ? null : this._ensureClusters(old.ieee).catch(() => {
        }), this._ensureClusters(r.newIeee).catch(() => {
        })]);
        if (!this._capExpIndex && !this._capExpLoading) this._capExpLoadIndex();
        const plan = await this._api.replacePlan(old.ieee, r.newIeee, {
          oldClusters: old.gone ? null : this._clusterCache.get(old.ieee),
          newClusters: this._clusterCache.get(r.newIeee),
          endpointMap: r.endpointMap
        });
        r.plan = plan;
        r.selected = defaultSelection(plan);
      } catch (err) {
        r.error = extractErrorMessage(err);
      }
      this._renderReplace();
    }
    async _replaceRun() {
      const r = this._replace;
      const ids2 = [...r.selected];
      r.step = "run";
      r.progress = "Copying bindings and reading them back\u2026";
      this._renderReplace();
      r.results = {};
      try {
        const res = await this._api.replaceRun(r.plan.plan_id, ids2.filter((id) => (r.plan.items.find((i) => i.id === id) || {}).kind !== "group"));
        Object.assign(r.results, res.results || {});
        for (const item of r.plan.items.filter((i) => i.kind === "group" && r.selected.has(i.id))) {
          r.progress = `Adding it to group ${item.group_id}\u2026`;
          this._renderReplace();
          try {
            await this._api.addGroupMembers(item.group_id, [{ ieee: r.newIeee, endpoint: item.new_ep }]);
            r.results[item.id] = "added";
          } catch (err) {
            r.results[item.id] = "failed";
          }
        }
      } catch (err) {
        this._setStatus("error", `Copying failed: ${extractErrorMessage(err)}`, 0);
      }
      r.step = "done";
      this._renderReplace();
      this._pickUpIntegrationScans();
      this._lostLoad();
    }
    async _replaceCleanup() {
      const r = this._replace;
      const box = (id) => {
        const el = this._q(`#${id}`);
        return !!(el && el.checked);
      };
      const unbindOld = box("replace-unbind-old");
      const leaveGroups = box("replace-leave-groups");
      const removeOld = box("replace-remove-old");
      const old = this._replaceOldDevice();
      const done = [];
      try {
        const res = await this._api.replaceCleanup(r.plan.plan_id, unbindOld);
        if (unbindOld) done.push(`removed the old bindings on ${res.unbound.length} device${res.unbound.length === 1 ? "" : "s"}${res.failed.length ? ` (${res.failed.length} didn't answer)` : ""}`);
        if (leaveGroups) {
          for (const item of r.plan.items.filter((i) => i.kind === "group")) {
            await this._api.removeGroupMembers(item.group_id, [{ ieee: old.ieee, endpoint: item.old_ep }]).catch(() => {
            });
          }
          done.push("took the old device out of its groups");
        }
        if (removeOld) {
          await this._api.removeZhaDevice(old.ieee);
          done.push("removed the old device from ZHA");
        }
        r.cleaned = done.length ? `Done: ${done.join(", ")}.` : "Nothing to clean up.";
      } catch (err) {
        r.cleaned = `Clean-up stopped: ${extractErrorMessage(err)}`;
      }
      this._renderReplace();
      this._reloadDevices({ quiet: true }).then(() => this._pickUpIntegrationScans());
      this._lostLoad();
    }
    _wireReplace() {
      const r = this._replace;
      const root = this._q("#dialog-body");
      const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
      on("#replace-cancel", "click", () => this._closeReplace());
      on("#replace-close", "click", () => this._closeReplace());
      on('input[name="replace-old"]', "change", (e) => {
        r.oldIeee = normIeee(e.target.value);
        const next = root.querySelector("#replace-next");
        if (next) next.disabled = false;
      });
      on('input[name="replace-new"]', "change", (e) => {
        r.newIeee = normIeee(e.target.value);
        const next = root.querySelector("#replace-next");
        if (next) next.disabled = !this._replaceEnabled;
      });
      on("#replace-filter", "input", (e) => {
        r.filter = e.target.value;
        this._renderReplace();
        const f = this._q("#replace-filter");
        if (f) {
          f.focus();
          f.setSelectionRange(f.value.length, f.value.length);
        }
      });
      on("#replace-next", "click", () => {
        if (r.step === "old" && r.oldIeee) r.step = "pick";
        else if (r.step === "pick" && r.newIeee) {
          r.step = "check";
          this._replacePlan();
          return;
        }
        this._renderReplace();
      });
      on("#replace-back", "click", () => {
        r.step = "pick";
        r.plan = null;
        this._renderReplace();
      });
      on("input[data-item]", "change", (e) => {
        if (e.target.checked) r.selected.add(e.target.dataset.item);
        else r.selected.delete(e.target.dataset.item);
        this._renderReplace();
      });
      on("select[data-epmap]", "change", (e) => {
        r.endpointMap[e.target.dataset.epmap] = Number(e.target.value);
        this._replacePlan();
      });
      on("#replace-run", "click", () => this._replaceRun());
      on("#replace-cleanup", "click", () => this._replaceCleanup());
    }
    _closeReplace() {
      this._replace = null;
      this._closeDialog();
    }
    // -------------------------------------------------------------------
    // Device answers (1.9.0): how a device behaves, asked in the side panel
    // and shared with the community database (data/questions.json).
    // -------------------------------------------------------------------
    _answersStoreRead(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "{}") || {};
      } catch (e) {
        return {};
      }
    }
    _answersStoreWrite(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
      }
    }
    /** Remembers (in this browser) that a scan of this device was shared, so
     *  its questions open before the scan has been merged into the database. */
    _scanShared(ieee) {
      const key = normIeee(ieee);
      return this._sharedThisSession && this._sharedThisSession.has(key) || !!this._answersStoreRead("zbm-shared-scans")[key];
    }
    _markScanShared(ieee, record) {
      (this._sharedThisSession = this._sharedThisSession || /* @__PURE__ */ new Set()).add(normIeee(ieee));
      const all = this._answersStoreRead("zbm-shared-scans");
      all[normIeee(ieee)] = {
        at: (/* @__PURE__ */ new Date()).toISOString(),
        sw_build_id: record && record.identity && record.identity.sw_build_id || null
      };
      this._answersStoreWrite("zbm-shared-scans", all);
      if (this._drawerIeee) this._renderDrawer();
    }
    /** The firmware to file answers under: sw_build_id from a command check
     *  this session (or a remembered share), plus Home Assistant's version. */
    _deviceFirmware(d) {
      let sw = null;
      const prefix = `${normIeee(d.ieee)}:`;
      for (const [key, entry] of this._commandScans.entries()) {
        if (key.startsWith(prefix) && entry.status === "done" && entry.scan) {
          const epScan = (entry.scan.endpoints || []).find((e) => Number(e.id) === Number(key.slice(prefix.length)));
          const id = epScan && this._extractIdentity(epScan);
          if (id && id.sw_build_id) sw = id.sw_build_id;
        }
      }
      if (!sw) {
        const shared = this._answersStoreRead("zbm-shared-scans")[normIeee(d.ieee)];
        if (shared && shared.sw_build_id) sw = shared.sw_build_id;
      }
      const reg = this._haDeviceRegistryEntry(d.ieee);
      return { sw_build_id: sw, registry_sw_version: reg && reg.sw_version || null };
    }
    async _answersLoad(force = false) {
      if (this._answersLoading) return;
      this._answersLoading = true;
      try {
        const [q, doc] = await Promise.all([fetchQuestions({ force }).catch(() => null), fetchAnswersDoc({ force }).catch(() => ({}))]);
        this._answersQ = q && (q.version || 0) >= (questions_default.version || 0) ? q : questions_default;
        this._answersDoc = doc || {};
        this._answersError = null;
      } catch (err) {
        this._answersQ = questions_default;
        this._answersDoc = {};
      }
      this._answersLoading = false;
      if (this._drawerIeee) this._renderDrawer();
    }
    /** Facts row pointing at the questions section further down. */
    _drawerAnswersFact(d) {
      const community = this._answersQ ? answersForFirmware(this._answersDoc, d, this._deviceFirmware(d)) : { total: 0 };
      const mine = this._answersStoreRead("zbm-device-answers")[normIeee(d.ieee)];
      const said = community.total ? `${community.total} owner${community.total === 1 ? "" : "s"} answered` : "Nobody has said yet";
      return `${escapeHtml(said)}. <a href="#" class="src-link" id="drawer-answers-link">${mine ? "Your answers" : "Answer questions"}</a>`;
    }
    _drawerAnswersHtml(d) {
      if (!d.manufacturer && !d.model) return "";
      if (this._answersQ === void 0) {
        if (!this._answersLoading) this._answersLoad();
        return "";
      }
      const q = this._answersQ;
      if (!q) return "";
      const fw = this._deviceFirmware(d);
      const community = answersForFirmware(this._answersDoc, d, fw);
      const inDb = this._capExpIndex ? matchLocalDevices([d], this._capExpIndex).length > 0 : false;
      const shared = this._scanShared(d.ieee);
      const mine = this._answersStoreRead("zbm-device-answers")[normIeee(d.ieee)] || null;
      const unlocked = inDb || shared;
      const draft = this._answerDraft && this._answerDraft.ieee === normIeee(d.ieee) ? this._answerDraft : null;
      const communityHtml = this._answersCommunityHtml(q, community);
      let body;
      if (draft) {
        body = this._answersFormHtml(q, d, fw, draft, mine, unlocked);
      } else if (!unlocked) {
        const type = detectDeviceType(this._clusterCache.get(d.ieee), d.power_source);
        const preview = questionsFor(q, type, null).slice(0, 3).map((x) => `<li><strong>${escapeHtml(x.text)}</strong> <span class="muted">${escapeHtml(x.answers.map((a) => a.label).join(" \xB7 "))}</span></li>`).join("");
        body = `<div class="answers-locked">
          <p>Things a scan can't show: whether it stays connected, what a press really sends, whether it keeps its settings after a power cut.
            Answering takes about a minute and helps the next person with this model.</p>
          <ul class="answers-preview">${preview}</ul>
          <p class="hint">This model isn't in the community database yet, so its capability scan goes in together with your answers:
            answer now, then share the scan before you submit.</p>
          <button class="btn btn-small btn-primary" id="drawer-answers-start">Answer a few questions (about 1 minute)</button>
        </div>`;
      } else {
        const again = mine ? `<p class="hint">You answered on ${escapeHtml(new Date(mine.at).toLocaleDateString())}${mine.firmware && mine.firmware !== (fw.sw_build_id || fw.registry_sw_version) ? `, on firmware ${escapeHtml(mine.firmware)}` : ""}.</p>` : "";
        body = `${again}<button class="btn btn-small ${mine ? "" : "btn-primary"}" id="drawer-answers-start">${mine ? "Change your answers" : "Answer a few questions (about 1 minute)"}</button>`;
      }
      return `<div class="drawer-section drawer-answers">
      <div class="drawer-section-title">How does it behave? <span class="muted">Help the next person</span></div>
      ${communityHtml}
      ${body}
    </div>`;
    }
    _answersCommunityHtml(q, community) {
      if (!community.total) return `<p class="hint">Nobody has answered for this model yet.</p>`;
      const otherFw = community.others.length ? `<p class="hint">Also answered for firmware ${community.others.map((o) => `${escapeHtml(o.firmware)} (${o.total})`).join(", ")}.</p>` : "";
      if (!community.here) {
        return `<p class="hint">${community.total} answer${community.total === 1 ? "" : "s"} for this model, none yet for this firmware.</p>${otherFw}`;
      }
      const lines = summaryLines(q, community.here);
      const html = lines.map((u) => {
        const rating = u.rating != null ? `<span class="answers-rating">\u2605 ${u.rating.toFixed(1)} <span class="muted">from ${u.ratingCount}</span></span>` : u.ratingCount ? `<span class="muted">${u.ratingCount} rating${u.ratingCount === 1 ? "" : "s"} (average shown from 3)</span>` : "";
        const qs = u.questions.slice(0, 8).map((x) => `<li><span>${escapeHtml(x.text)}</span> <span class="muted">${escapeHtml(answerCountsText(x))}</span></li>`).join("");
        const tips = u.tips.length ? `<ul class="answers-tips">${u.tips.map((t) => `<li>\u201C${escapeHtml(t.text)}\u201D</li>`).join("")}</ul>` : "";
        return `<details class="answers-use" ${lines.length === 1 ? "open" : ""}><summary><strong>${escapeHtml(u.useLabel)}</strong>
            <span class="muted">${u.count} ${u.count === 1 ? "person" : "people"}</span> ${rating}</summary>
            <ul class="answers-list">${qs}</ul>${tips}</details>`;
      }).join("");
      const linked = community.here.scan_linked ? "" : ` <span class="muted">(no scan of this firmware in the database yet)</span>`;
      return `<p class="hint">On firmware ${escapeHtml(community.hereKey)}${linked}:</p>${html}${otherFw}`;
    }
    _answersFormHtml(q, d, fw, draft, mine, unlocked = true) {
      const fwText = fw.sw_build_id || fw.registry_sw_version;
      const sel = (name, options, value, extra = "") => `<select data-answer="${escapeHtml(name)}" ${extra}><option value="">\u2013</option>${options.map((o) => `<option value="${escapeHtml(o.id)}" ${o.id === value ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}</select>`;
      const otherBox = (key, value, placeholder) => `<input type="text" class="answers-other" data-other="${escapeHtml(key)}" maxlength="${q.free_text_max || 280}" value="${escapeHtml(
        value || ""
      )}" placeholder="${escapeHtml(placeholder)}">`;
      const firmwareChanged = !!(mine && mine.firmware && fwText && mine.firmware !== fwText);
      const uses = useAnswers(q, draft.deviceType);
      const useOptions = [...uses, { id: "other", label: "Something else\u2026" }];
      const battery = /battery/i.test(String(d.power_source || "")) ? true : /mains/i.test(String(d.power_source || "")) ? false : null;
      const { main, more } = draft.use ? formQuestions(q, draft.deviceType, draft.use, { firmwareChanged, battery }) : { main: [], more: [] };
      const qRow = (x) => {
        const opts = [...x.answers, ...x.allow_other ? [{ id: "other", label: x.other_label || "Other\u2026" }] : []];
        const v = draft.answers[x.id] || "";
        return `<label class="answers-q"><span>${escapeHtml(x.text)}${x.help ? ` <span class="muted">${escapeHtml(x.help)}</span>` : ""}</span>
          ${sel(`q:${x.id}`, opts, v)}
          ${v === "other" ? otherBox(x.id, (draft.other || {})[x.id], "Tell us (no names or addresses)") : ""}</label>`;
      };
      const moreAnswered = more.some((x) => draft.answers[x.id]);
      const qHtml = main.map(qRow).join("") + (more.length ? `<details class="answers-more" ${moreAnswered || this._answersMoreOpen ? "open" : ""}><summary>More questions (${more.length})</summary>${more.map(qRow).join("")}</details>` : "");
      const ratingOpts = Object.entries(q.rating.labels).map(([n, l]) => ({ id: n, label: `${"\u2605".repeat(Number(n))} ${l}` }));
      const ctx = (q.context || []).map((c) => `<label class="answers-q"><span>${escapeHtml(c.text)}</span>${sel(`ctx:${c.id}`, c.answers, (draft.context || {})[c.id] || "")}</label>`).join("");
      const problem = draftProblem(q, fw, draft) || (unlocked ? "" : "Share this device's capability scan first: the model isn't in the community database yet.");
      const shareFirst = unlocked ? "" : `<div class="flow-callout flow-result-warning">This model isn't in the community database yet. Share its capability scan too, so your
          answers are tied to a scan anyone can check. Your answers are kept while you do.
          <button class="btn btn-small" id="drawer-answers-share">Check and share capabilities\u2026</button></div>`;
      return `<div class="answers-form">
      <p class="hint">Answer for this one device, firmware ${fwText ? escapeHtml(fwText) : "<strong>unknown</strong>"}. Skip anything you're not sure about.
        Free text is checked before it's shown, so leave out names, places and addresses.</p>
      ${fwText ? "" : `<p class="hint health-warning">The firmware isn't known yet: run <strong>Check and share capabilities\u2026</strong> once (it reads it from the device).</p>`}
      <label class="answers-q"><span>What kind of device is it?</span>${sel("type", q.device_types, draft.deviceType)}</label>
      <label class="answers-q"><span>${escapeHtml(q.use.text)}</span>${sel("use", useOptions, draft.use)}
        ${draft.use === "other" ? otherBox("use", (draft.other || {}).use, "What do you use it for?") : ""}</label>
      ${draft.use ? qHtml : `<p class="hint">${escapeHtml(q.use.help || "")}</p>`}
      ${draft.use ? `<label class="answers-q"><span>${escapeHtml(q.rating.text)}</span>${sel("rating", ratingOpts, draft.rating != null ? String(draft.rating) : "")}</label>
             <details class="answers-context" ${this._answersContextOpen ? "open" : ""}><summary>About your setup (optional)</summary>${ctx}</details>
             <label class="answers-q"><span>${escapeHtml(q.tip.text)} <span class="muted">${escapeHtml(q.tip.help || "")}</span></span>
               <textarea class="answers-tip" maxlength="${q.free_text_max || 280}" rows="2">${escapeHtml(draft.tip || "")}</textarea></label>` : ""}
      ${shareFirst}
      <div class="dialog-actions">
        <a class="btn btn-small btn-primary ${problem ? "disabled" : ""}" id="drawer-answers-submit" href="#" ${problem ? `aria-disabled="true" title="${escapeHtml(problem)}"` : ""}>Review on GitHub and submit</a>
        <button class="btn btn-small" id="drawer-answers-cancel">Cancel</button>
      </div>
      ${problem && (draft.use || !unlocked) ? `<p class="hint">${escapeHtml(problem)}</p>` : ""}
      <p class="hint">Opens a pre-filled GitHub issue; nothing is sent until you press Submit there. Not using GitHub? The same questions are on the
        <a href="${escapeHtml(ISSUE_FORM_URL)}" target="_blank" rel="noopener">community form</a>.</p>
    </div>`;
    }
    _wireDrawerAnswers(d) {
      const root = this._q("#drawer-body .drawer-answers");
      if (!root) return;
      const ieee = normIeee(d.ieee);
      const share = root.querySelector("#drawer-answers-share");
      const jump = this._q("#drawer-answers-link");
      if (jump)
        jump.addEventListener("click", (e) => {
          e.preventDefault();
          if (root.scrollIntoView) root.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      if (share)
        share.addEventListener("click", () => {
          this._drawerShareOpen = true;
          this._renderDrawer();
          const box = this._q("#drawer-body .drawer-share");
          if (box && box.scrollIntoView) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      const start = root.querySelector("#drawer-answers-start");
      if (start)
        start.addEventListener("click", () => {
          const mine = this._answersStoreRead("zbm-device-answers")[ieee];
          const prev = mine && mine.draft || {};
          this._answerDraft = {
            ieee,
            deviceType: prev.deviceType || detectDeviceType(this._clusterCache.get(d.ieee), d.power_source),
            use: prev.use || "",
            answers: { ...prev.answers || {} },
            other: { ...prev.other || {} },
            rating: prev.rating != null ? prev.rating : null,
            tip: prev.tip || "",
            context: { system: "zha", ...prev.context || {} }
          };
          this._renderDrawer();
        });
      const draft = this._answerDraft && this._answerDraft.ieee === ieee ? this._answerDraft : null;
      if (!draft) return;
      root.querySelectorAll("select[data-answer]").forEach(
        (el) => el.addEventListener("change", () => {
          const name = el.dataset.answer;
          const v = el.value;
          if (name === "type") {
            draft.deviceType = v;
            draft.use = "";
          } else if (name === "use") draft.use = v;
          else if (name === "rating") draft.rating = v ? Number(v) : null;
          else if (name.startsWith("q:")) draft.answers[name.slice(2)] = v;
          else if (name.startsWith("ctx:")) draft.context[name.slice(4)] = v;
          this._renderDrawer();
        })
      );
      root.querySelectorAll("input[data-other]").forEach(
        (el) => el.addEventListener("input", () => {
          draft.other[el.dataset.other] = el.value;
          this._answersRefreshSubmit(d);
        })
      );
      const ctxBox = root.querySelector(".answers-context");
      if (ctxBox) ctxBox.addEventListener("toggle", () => this._answersContextOpen = ctxBox.open);
      const moreBox = root.querySelector(".answers-more");
      if (moreBox) moreBox.addEventListener("toggle", () => this._answersMoreOpen = moreBox.open);
      const tip = root.querySelector(".answers-tip");
      if (tip) tip.addEventListener("input", () => draft.tip = tip.value);
      const cancel = root.querySelector("#drawer-answers-cancel");
      if (cancel)
        cancel.addEventListener("click", () => {
          this._answerDraft = null;
          this._renderDrawer();
        });
      const submit = root.querySelector("#drawer-answers-submit");
      if (submit)
        submit.addEventListener("click", (e) => {
          e.preventDefault();
          const q = this._answersQ;
          const fw = this._deviceFirmware(d);
          const inDb = this._capExpIndex ? matchLocalDevices([d], this._capExpIndex).length > 0 : false;
          const shared = this._scanShared(ieee);
          const problem = draftProblem(q, fw, draft) || (inDb || shared ? "" : "Share this device's capability scan first (Check and share capabilities\u2026).");
          if (problem) {
            this._setStatus("warning", problem);
            return;
          }
          const mine = this._answersStoreRead("zbm-device-answers")[ieee];
          const fwText = fw.sw_build_id || fw.registry_sw_version;
          const record = buildRecord(q, d, fw, { ...draft, firmwareChanged: !!(mine && mine.firmware && mine.firmware !== fwText) }, CARD_VERSION);
          window.open(issueUrl(record), "_blank", "noopener");
          const all = this._answersStoreRead("zbm-device-answers");
          const { ieee: _i, ...keep } = draft;
          all[ieee] = { at: (/* @__PURE__ */ new Date()).toISOString(), firmware: fwText, draft: keep };
          this._answersStoreWrite("zbm-device-answers", all);
          this._answerDraft = null;
          this._setStatus(
            "success",
            "Opened your answers as a GitHub issue: press Submit there. They show up for everyone once the database has merged them.",
            0
          );
          this._renderDrawer();
        });
    }
    /** Re-checks the submit button while typing, without re-rendering (which
     *  would take the cursor out of the box). */
    _answersRefreshSubmit(d) {
      const btn = this._q("#drawer-answers-submit");
      if (!btn || !this._answerDraft) return;
      const inDb = this._capExpIndex ? matchLocalDevices([d], this._capExpIndex).length > 0 : false;
      const shared = this._scanShared(d.ieee);
      const problem = draftProblem(this._answersQ, this._deviceFirmware(d), this._answerDraft) || (inDb || shared ? "" : "Share the capability scan first.");
      btn.classList.toggle("disabled", !!problem);
      if (problem) btn.setAttribute("title", problem);
      else btn.removeAttribute("title");
    }
    /** Sends On/Off itself (a remote or switch), so a press can be checked. */
    _isRemoteLike(d) {
      return (this._clusterCache.get(d.ieee) || []).some((c) => c.type === "out" && Number(c.id) === 6);
    }
    /** Side panel: lost bindings and the watch setting for one device. */
    _drawerLostHtml(d, rel) {
      const hasOwn = rel.controls.length > 0 || this._rawBindings().some((b) => normIeee(b.sourceIeee) === normIeee(d.ieee));
      if (!this._watchEnabled) {
        if (this._backendInstalled || !hasOwn) return "";
        return `<div class="drawer-section"><div class="drawer-section-title">Lost bindings</div>
        <p class="hint">Devices sometimes lose their bindings (a reset, a firmware update, a power cut on some models). Install the
        ZHA Bindings Manager integration and it checks every night and tells you, or puts them back for you.</p></div>`;
      }
      const w = lostFor(this._lost, d.ieee);
      if (!hasOwn && !w.expected && w.policy === "notify") return "";
      const busy = this._lostBusy;
      const lostList = w.lost.length ? `<ul class="drawer-lost">${w.lost.map(
        (b) => `<li class="health-error">Lost: ${escapeHtml(b.text || b.key)} <span class="muted">${escapeHtml(sinceText(b.since))}</span></li>`
      ).join("")}</ul>
        <button class="btn btn-small btn-primary" id="drawer-lost-put-back" ${busy ? "disabled" : ""}>${busy === "Put back" ? "Putting back\u2026" : "Put back"}</button>
        <a href="#" class="src-link" id="drawer-lost-forget" title="Stop expecting these: you removed them yourself">Removed on purpose</a>
        ${w.queued ? `<p class="hint">It didn't answer, probably asleep. It'll be done the next time you press one of its buttons.</p>` : ""}
        ${w.autoPaused ? `<p class="hint">It lost them 3 times today, so it stopped putting them back automatically. Something keeps removing them: a full binding table, or another app.</p>` : ""}` : `<p class="hint">Nothing lost.${w.lastCheck ? ` Last checked ${escapeHtml(sinceText(w.lastCheck))}.` : ""}</p>`;
      const opts = POLICIES.map(
        (p) => `<option value="${p}" ${p === w.policy ? "selected" : ""}>${escapeHtml(POLICY_LABELS[p])}</option>`
      ).join("");
      return `<div class="drawer-section drawer-lost-section">
      <div class="drawer-section-title">Lost bindings</div>
      ${lostList}
      <label class="drawer-lost-policy">If it loses a binding:
        <select id="drawer-lost-policy" ${busy ? "disabled" : ""}>${opts}</select></label>
      <p class="hint">${escapeHtml(POLICY_HINTS[w.policy] || "")}</p>
      ${w.policy !== "off" && this._isRemoteLike(d) ? `<label class="drawer-check"><input type="checkbox" id="drawer-lost-fallback" ${w.fallback ? "checked" : ""} ${busy ? "disabled" : ""}>
              <span>Switch the lights from Home Assistant if a press doesn't reach them</span></label>
             <p class="hint">After On, Off or Toggle, any light it's bound to directly that hasn't changed within 2 seconds is switched by Home Assistant,
               logged, and this device's bindings are checked straight away.</p>` : ""}
      <details class="drawer-lost-expect"><summary>What to expect</summary>
        <ul>
          <li>Battery devices only answer when awake: a lost binding on one is noticed and put back after you press a button.</li>
          <li>"Put back automatically" is for devices that keep losing bindings. If something removes them on purpose (another app, a
            Zigbee2MQTT migration), it stops after 3 times a day.</li>
          <li>Removing a binding in this card is never treated as lost. Removing one somewhere else is: use "Removed on purpose".</li>
          <li>A device with a full binding table can't take it back; Put back then says it's still missing.</li>
          <li>Switching from Home Assistant needs lights that report their state promptly, works for On, Off and Toggle only, and
            never for group bindings: a light missing one group message hasn't lost a binding. Toggle is skipped when the lights
            weren't all on or all off before the press.</li>
        </ul>
      </details>
    </div>`;
    }
    /** 1.5.0: the integration reads binding tables itself (the device-page
     *  Rescan button, the nightly binding check). Use any read that's newer
     *  than the card's own last read of that device. */
    async _pickUpIntegrationScans() {
      if (!this._backendInstalled || !this._api) return;
      let res;
      try {
        res = await this._api.deviceScans();
      } catch (e) {
        return;
      }
      const scans = res && res.scans || {};
      const taken = [];
      for (const [ieee, scan] of Object.entries(scans)) {
        const id = normIeee(ieee);
        if (!isIeee(id) || !scan || typeof scan.at !== "string" || Number.isNaN(Date.parse(scan.at))) continue;
        if (!this._devices.some((d) => normIeee(d.ieee) === id)) continue;
        const h = this._responseHistory.get(id);
        const mine = h && (h.lastSuccessAt || null);
        if (mine && Date.parse(mine) >= Date.parse(scan.at)) continue;
        const { bindings } = sanitizeStoredBindings({ [id]: scan.bindings || [] });
        this._bindings.set(id, bindings.get(id) || []);
        const entry = h || { successMs: [], outcomes: [], lastAttemptAt: null, lastSuccessAt: null };
        entry.lastSuccessAt = scan.at;
        if (!entry.lastAttemptAt || Date.parse(entry.lastAttemptAt) < Date.parse(scan.at)) entry.lastAttemptAt = scan.at;
        this._responseHistory.set(id, entry);
        taken.push(this._ieeeLabel(id, { plain: true }));
      }
      if (!taken.length) return;
      await this._saveScanState();
      await this._saveHistory();
      this._render();
      this._setStatus(
        "info",
        `Using ${taken.length} newer binding read${taken.length === 1 ? "" : "s"} from the integration (device-page Rescan or nightly check): ${taken.slice(0, 3).join(", ")}${taken.length > 3 ? "\u2026" : ""}.`
      );
    }
    /** /zha-bindings-manager?device=<ieee> (linked from the integration's
     *  device-page Bindings sensor and Repairs issues) opens that device's
     *  view once devices are loaded. The parameter is then removed, so a
     *  reload doesn't open it again. */
    _openDeepLinkedDevice() {
      let search = "";
      try {
        search = window.location.search;
      } catch (e) {
        return;
      }
      const ieee = deepLinkIeee(search);
      if (!ieee) return;
      try {
        const url = window.location.pathname + withoutDeviceParam(search) + window.location.hash;
        window.history.replaceState(window.history.state, "", url);
      } catch (e) {
      }
      const d = this._devices.find((x) => normIeee(x.ieee) === ieee);
      if (!d) {
        this._setStatus("error", `The linked device (${ieee}) isn't in ZHA any more.`);
        return;
      }
      this._openDeviceDrawer(d);
    }
    /** Fetches ZHA's current device and group lists. Used on first load, by
     *  the device-registry listener, and at the start of every scan, so health
     *  checks and scans always work from what ZHA has now.
     *  - initial: first load of the page (reports load errors, no "removed" notice).
     *  - quiet: a scan is about to run and will report and re-render itself.
     *  Returns the IEEEs of devices that have disappeared since the last load.
     *  On a failed fetch the previous lists are kept, so a ZHA hiccup never
     *  makes every device look removed. */
    async _reloadDevices({ initial = false, quiet = false } = {}) {
      let devices;
      let groups;
      try {
        [devices, groups] = await Promise.all([this._api.fetchDevices(), this._api.fetchGroups()]);
      } catch (err) {
        console.error(err);
        if (initial) this._setStatus("error", `Failed to load ZHA devices: ${err.message || err}`, 0);
        else console.warn("ZHA Bindings Manager: could not refresh the device list; keeping the previous one.");
        return [];
      }
      const next = devices.filter((d) => !!d.ieee).map((d) => ({ ...d, ieee: normIeee(d.ieee) }));
      const vanished = initial ? [] : vanishedDevices(this._devices, next);
      const fingerprint = (list2) => list2.map((d) => `${d.ieee}|${this._deviceLabel(d)}|${d.area_id || ""}`).join(";");
      const changed = initial || fingerprint(this._devices) !== fingerprint(next) || this._groups.length !== groups.length;
      rememberDevices(this._knownDevices, next, (d) => this._deviceLabel(d));
      this._devices = next;
      this._groups = groups;
      this._loaded = true;
      this._saveKnownDevices();
      if (initial) {
        this._setStatus("success", `Loaded ${this._devices.length} devices, ${this._groups.length} groups.`);
      } else if (vanished.length && !quiet) {
        const names = vanished.map((ieee) => this._ieeeLabel(ieee, { plain: true }));
        this._setStatus(
          "info",
          `${names.join(", ")} ${vanished.length === 1 ? "was" : "were"} removed from ZHA. ${vanished.length === 1 ? "Its" : "Their"} saved bindings now show as errors on the Bindings tab, where you can forget them or unbind what still points to ${vanished.length === 1 ? "it" : "them"}.`,
          0
        );
      }
      if (changed && !quiet) {
        this._render();
        this._renderFilterChips();
      }
      return vanished;
    }
    /** `force: true` bypasses the cache and refetches from ZHA even if this
     *  ieee was already fetched earlier in the card's lifetime — see
     *  _rescanDeviceFull() for why that matters: without it, a device whose
     *  cluster list was first read incompletely (e.g. before ZHA finished
     *  interviewing it) would keep serving that same stale snapshot for the
     *  rest of the session, no matter how many times bindings got rescanned. */
    async _ensureClusters(ieee, { force = false } = {}) {
      if (!force && this._clusterCache.has(ieee)) return this._clusterCache.get(ieee);
      const clusters = await this._api.fetchClusters(ieee);
      this._clusterCache.set(ieee, clusters);
      return clusters;
    }
    /** The one "scan/rescan this device" action used by every single-device
     *  entry point in the UI (Exploded view, Advanced tab's "Scan this
     *  device", the Devices table's per-row scan button, Binding Health's
     *  "Rescan now"): refreshes BOTH the binding table and the cluster list,
     *  forcing the cluster refetch since _ensureClusters() alone would keep
     *  serving a cached — possibly stale or incomplete — snapshot otherwise.
     *  Deliberately not used by the network-wide "Scan all" button, which
     *  only needs fresh bindings and would multiply API calls considerably
     *  if it force-refreshed clusters for every device on every run. */
    async _rescanDeviceFull(ieee, opts = {}) {
      await Promise.all([this._ensureClusters(ieee, { force: true }), this._scanBindings([ieee], opts)]);
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
    /** Plain-text "Source (ep 1) → Target (ep 2), On/Off" for messages. */
    _describeChange(p) {
      const src = `${this._ieeeLabel(p.sourceIeee, { plain: true })} (ep ${escapeHtml(String(p.sourceEndpoint))})`;
      let dst;
      if (p.target.isGroup) {
        const g = this._groups.find((x) => x.group_id === p.target.groupId);
        dst = g ? `group ${g.name}` : `group ${p.target.groupId}`;
      } else {
        dst = `${this._ieeeLabel(p.target.ieee, { plain: true })}${p.target.endpoint != null ? ` (ep ${p.target.endpoint})` : ""}`;
      }
      return `${src} \u2192 ${dst}, ${clusterName(p.clusterId)}`;
    }
    /**
     * Turns a bind/unbind into one of confirmed / failed / unconfirmed (plus
     * "absent" for an unbind of something that wasn't there), using a fresh
     * read of the source when there was one. `scan` is what _scanBindings
     * returned. Unconfirmed changes are remembered in _pendingChecks and
     * re-checked the next time that device answers a scan.
     * Returns {level, message, action} ready for _setStatus.
     */
    _settleChange(kind, p, scan, before = null) {
      const sourceRead = !!(scan && scan.read && scan.read.has(normIeee(p.sourceIeee)));
      const present = this._bindingPresent(p.sourceIeee, p.sourceEndpoint, p.clusterId, p.target);
      const outcome = kind === "bind" ? bindOutcome({ present, sourceRead }) : unbindOutcome({ before, present, sourceRead });
      const entry = { kind, ...p, sentAt: Date.now() };
      const key = pendingKey(entry);
      if (outcome === "unconfirmed") this._pendingChecks.set(key, entry);
      else this._pendingChecks.delete(key);
      this._renderPendingBanner();
      const srcName = this._ieeeLabel(p.sourceIeee, { plain: true });
      const notRead = scan && scan.ran === false ? "the check couldn't run because another scan was already in progress" : `${srcName} didn't answer the check`;
      const wake = this._isBatteryDevice(this._devices.find((d) => normIeee(d.ieee) === normIeee(p.sourceIeee)) || {}) ? " Battery devices usually go back to sleep straight away: press a button on it, then click Check again." : " Make sure it's powered and in range, then click Check again.";
      const message = {
        bind: {
          confirmed: "Binding confirmed on the device.",
          failed: `Bind failed: ${srcName} answered the check and this binding isn't on it.`,
          unconfirmed: `Bind sent, not confirmed yet: ${notRead}.${wake}`
        },
        unbind: {
          confirmed: "Binding confirmed removed.",
          absent: "This binding didn't actually exist on the device \u2014 table refreshed.",
          failed: `Unbind failed: ${srcName} answered the check and this binding is still on it.`,
          unconfirmed: `Unbind sent, not confirmed yet: ${notRead}, so the table still shows the binding.${wake}`
        }
      }[kind][outcome];
      const action = outcome === "unconfirmed" ? { label: "Check again", onClick: () => this._checkPendingAgain() } : null;
      const earlier = this._lastSettled;
      this._lastSettled = null;
      let level = OUTCOME_LEVEL[outcome];
      if (earlier && earlier.level === "error" && level === "success") level = "warning";
      return {
        level,
        message: earlier && earlier.text ? `${message} Also: ${earlier.text}` : message,
        action,
        outcome
      };
    }
    /** Re-checks every pending change whose source answered `read` (a Set of
     *  normalised IEEEs from _scanBindings). Returns {text, level} describing
     *  what was decided, empty when nothing was. */
    _reconcilePendingChecks(read) {
      if (!this._pendingChecks.size) return { text: "", level: null };
      const { pending, resolved } = reconcilePending([...this._pendingChecks.values()], {
        isPresent: (e) => this._bindingPresent(e.sourceIeee, e.sourceEndpoint, e.clusterId, e.target),
        wasRead: (ieee) => read.has(normIeee(ieee))
      });
      this._pendingChecks = new Map(pending.map((e) => [pendingKey(e), e]));
      this._renderPendingBanner();
      if (!resolved.length) return { text: "", level: null };
      const words = { confirmed: "confirmed", failed: "did NOT go through" };
      const text = resolved.map(({ entry, outcome }) => `${entry.kind === "bind" ? "Bind" : "Unbind"} ${this._describeChange(entry)}: ${words[outcome] || outcome}.`).join(" ");
      const level = resolved.some((r) => r.outcome === "failed") ? "error" : "success";
      return { text, level };
    }
    /** "Check again": re-reads only the devices with pending changes, using
     *  the single-device retry count since the user has just woken them. */
    async _checkPendingAgain() {
      const sources = [...new Map([...this._pendingChecks.values()].map((e) => [normIeee(e.sourceIeee), e.sourceIeee])).values()];
      if (!sources.length) return;
      if (this._scanState.running) {
        this._setStatus("error", "A scan is already running. Try again when it has finished.");
        return;
      }
      this._setStatus("info", `Checking ${sources.length === 1 ? this._ieeeLabel(sources[0], { plain: true }) : `${sources.length} devices`}\u2026`, 0);
      const scan = await this._scanBindings(sources, { tries: this._retryCount });
      const stillWaiting = sources.filter((s) => !scan.read.has(normIeee(s)));
      if (scan.ran && stillWaiting.length) {
        this._setStatus(
          "warning",
          `Still no answer from ${stillWaiting.map((s) => this._ieeeLabel(s, { plain: true })).join(", ")}. Press a button on it to wake it, then click Check again straight away.`,
          0,
          { label: "Check again", onClick: () => this._checkPendingAgain() }
        );
      }
    }
    /** 1.5.0: unconfirmed changes survive a page reload. */
    async _loadPendingChecks() {
      try {
        const raw = await this._storage.getItem(this._config.id, "pending-checks");
        const cutoff = Date.now() - 14 * 24 * 3600 * 1e3;
        const list2 = Array.isArray(raw) ? raw : [];
        const ok = (e) => e && (e.kind === "bind" || e.kind === "unbind") && isIeee(e.sourceIeee) && Number.isInteger(e.sourceEndpoint) && Number.isInteger(e.clusterId) && typeof e.sentAt === "number" && e.sentAt > cutoff && e.target && (e.target.isGroup ? Number.isInteger(e.target.groupId) : isIeee(e.target.ieee) && Number.isInteger(e.target.endpoint));
        this._pendingChecks = new Map(
          list2.filter(ok).map((e) => {
            const clean = {
              kind: e.kind,
              sourceIeee: normIeee(e.sourceIeee),
              sourceEndpoint: e.sourceEndpoint,
              clusterId: e.clusterId,
              target: e.target.isGroup ? { isGroup: true, groupId: e.target.groupId } : { isGroup: false, ieee: normIeee(e.target.ieee), endpoint: e.target.endpoint },
              sentAt: e.sentAt
            };
            return [pendingKey(clean), clean];
          })
        );
      } catch (e) {
        this._pendingChecks = /* @__PURE__ */ new Map();
      }
      this._pendingLoaded = true;
      this._renderPendingBanner();
    }
    _savePendingChecks() {
      if (!this._pendingLoaded || !this._storage) return;
      const list2 = [...this._pendingChecks.values()];
      const sig = JSON.stringify(list2);
      if (sig === this._pendingSaved) return;
      this._pendingSaved = sig;
      this._storage.setItem(this._config.id, "pending-checks", list2).catch(() => {
      });
    }
    _renderPendingBanner() {
      this._savePendingChecks();
      const el = this._q("#pending-banner");
      if (!el) return;
      const items = [...this._pendingChecks.values()];
      if (!items.length) {
        el.style.display = "none";
        el.innerHTML = "";
        return;
      }
      el.style.display = "";
      el.innerHTML = `
      <div class="stale-row">
        <span><strong>${items.length} change${items.length === 1 ? "" : "s"} not confirmed yet.</strong>
        The command was sent but the device didn't answer the check, usually because a battery device went back to sleep.
        Wake it (press a button) and click Check again.</span>
        <button class="btn btn-small" id="btn-pending-check">Check again</button>
        <button class="btn btn-small" id="btn-pending-dismiss" title="Stop tracking these. Nothing is sent to your devices.">Dismiss</button>
      </div>
      <ul class="pending-list">${items.map(
        (e) => `<li>${e.kind === "bind" ? "Bind" : "Unbind"}: ${escapeHtml(this._describeChange(e))} <span class="muted">\xB7 sent ${escapeHtml(
          relTime(new Date(e.sentAt).toISOString())
        )}</span></li>`
      ).join("")}</ul>`;
      this._q("#btn-pending-check").addEventListener("click", () => this._checkPendingAgain());
      this._q("#btn-pending-dismiss").addEventListener("click", () => {
        this._pendingChecks.clear();
        this._renderPendingBanner();
      });
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
      const read = /* @__PURE__ */ new Set();
      this._lastSettled = null;
      if (this._scanState.running) return { ran: false, read };
      if (!toolkitAvailable(this._hass)) {
        this._setStatus(
          "error",
          "Can't scan: zha-toolkit isn't installed or isn't loaded, and ZHA Bindings Manager uses it to read binding tables. Install zha-toolkit from HACS (Integrations), restart Home Assistant, then scan again.",
          0
        );
        return { ran: false, read };
      }
      const fullScan = !(ieeeList && ieeeList.length);
      this._scanState = { running: true, done: 0, total: 0 };
      this._renderStatus();
      await this._reloadDevices({ quiet: true });
      const live = new Set(this._devices.map((d) => d.ieee));
      const notInZha = !fullScan && this._devices.length ? ieeeList.filter((ieee) => !live.has(normIeee(ieee))) : [];
      const targets = fullScan ? this._devices.map((d) => d.ieee) : ieeeList.filter((ieee) => !notInZha.includes(ieee));
      this._scanState.total = targets.length;
      this._renderStatus();
      let okCount = 0;
      let partialCount = 0;
      const failures = [];
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
          read.add(normIeee(ieee));
          if (partial) {
            this._scanPartial.set(normIeee(ieee), { retrieved: retrievedCount, total: totalCount });
            partialCount++;
          } else {
            this._scanPartial.delete(normIeee(ieee));
          }
          okCount++;
        } catch (err) {
          failures.push({
            device: this._devices.find((d) => normIeee(d.ieee) === normIeee(ieee)),
            name: this._ieeeLabel(ieee, { plain: true }),
            error: err
          });
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
      const pruned = fullScan ? pruneRemovedSources(this._bindings, this._devices) : [];
      pruned.forEach((ieee) => {
        this._scanFailures.delete(normIeee(ieee));
        this._scanPartial.delete(normIeee(ieee));
      });
      await this._saveScanState();
      this._lostSoon();
      const goneNames = notInZha.map((ieee) => this._ieeeLabel(ieee, { plain: true })).join(", ");
      if (notInZha.length && !targets.length) {
        this._setStatus(
          "info",
          `Not scanned: ${goneNames} ${notInZha.length === 1 ? "is" : "are"} no longer in ZHA. ${notInZha.length === 1 ? "Its" : "Their"} saved bindings show as errors; use Forget to clear them.`,
          0
        );
        this._render();
        return { ran: true, read };
      }
      const outcome = summarizeScan({
        okCount,
        partialCount,
        failures,
        skippedNames: notInZha.map((ieee) => this._ieeeLabel(ieee, { plain: true })),
        prunedCount: pruned.length
      });
      const settled = this._reconcilePendingChecks(read);
      this._lastSettled = settled;
      const level = settled.level === "error" || outcome.level === "error" ? "error" : settled.level === "warning" || outcome.level === "warning" ? "warning" : outcome.level;
      this._setStatus(level, settled.text ? `${outcome.message} ${settled.text}` : outcome.message, 0);
      this._renderGraph();
      this._renderTable();
      this._renderDevicesTab();
      this._renderStatus();
      return { ran: true, read };
    }
    /** Every scanned binding, unfiltered — use for counts/audits where the
     *  "hide coordinator bindings" display preference shouldn't hide data. */
    _rawBindings() {
      const out = [];
      for (const list2 of this._bindings.values()) out.push(...list2);
      return out;
    }
    /** Bindings as they should be displayed (respects the coordinator-hide toggle). */
    _allBindings() {
      const raw = this._rawBindings();
      if (this._filters.hideCoordinatorBindings) {
        const coord = this._coordinatorIeee();
        return raw.filter(
          (b) => b.isGroup || !coord || b.targetIeee !== coord || this._isRemovedDevice(b.sourceIeee)
        );
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
      if (isManufacturerSpecific(b.clusterId)) return "manufacturer";
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
      if (cls === "reporting" || cls === "manufacturer") return "edge edge-reporting";
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
      return all.filter((b) => !["reporting", "manufacturer"].includes(this._classifyBinding(b)));
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
     *  this card never talk to the internet.
     *  Deliberately returns null (no lookup at all) for AMBIGUOUS_TUYA_MODELS
     *  — those model strings are reused across many unrelated physical
     *  products, so a same-model-string lookup doesn't just risk a 404, it
     *  can confidently return a real photo of the *wrong device*. Silently
     *  showing a wrong photo is worse than the generic shape fallback, so
     *  this skips the guess entirely rather than making it and hoping. */
    _deviceImageUrl(d) {
      if (!d.model) return null;
      const ambiguous = AMBIGUOUS_TUYA_MODELS.includes(d.model);
      const code = z2mProductCode(this._z2mModels, d.manufacturer, d.model, { ambiguous });
      if (!code && ambiguous) return null;
      const name = code || d.model;
      return `https://www.zigbee2mqtt.io/images/devices/${encodeURIComponent(name.replace(/\//g, "-"))}.png`;
    }
    /** Loads the Zigbee2MQTT model map once, only when device photos are on,
     *  then re-renders whatever is showing photos so they switch to the right
     *  image. A failed fetch leaves the old model-string guess in place. */
    _ensureZ2mModels() {
      if (!this._showDevicePhotos || this._z2mModels || this._z2mModelsLoading) return;
      this._z2mModelsLoading = true;
      fetchZ2mModels().then((map) => {
        this._z2mModels = map;
        if (this._explodedDeviceIeee && this._q("#dialog") && this._q("#dialog").classList.contains("open")) {
          const d = this._devices.find((x) => x.ieee === this._explodedDeviceIeee);
          if (d) this._renderExplodedView(d);
        }
        if (this._q("#capexp-body")) this._renderCapExpBody();
        this._refreshDrawer();
      }).catch((err) => {
        console.warn("[ZHA Bindings Manager] Zigbee2MQTT model map unavailable", err);
      });
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
      const ids2 = new Set(clusters.map((c) => c.endpoint_id).filter((id) => id !== GREEN_POWER_ENDPOINT));
      this._rawBindings().forEach((b) => {
        if (b.sourceIeee === d.ieee && b.sourceEndpoint !== GREEN_POWER_ENDPOINT) ids2.add(b.sourceEndpoint);
      });
      return [...ids2].sort((a, b) => a - b);
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
            if (cls === "manufacturer") {
            } else if (cls === "control") {
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
        if (b.isGroup) {
          this._groupMembers(b.groupId).forEach((m) => {
            if (!m.isCoordinator && this._devices.some((d) => d.ieee === m.ieee)) ieees.add(m.ieee);
          });
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
    /** A ZHA group's members as {ieee, endpoint, name, isCoordinator}, from
     *  zha/groups (already loaded into this._groups). */
    _groupMembers(groupId) {
      const g = (this._groups || []).find((x) => Number(x.group_id) === Number(groupId));
      if (!g) return [];
      const coord = normIeee(this._coordinatorIeee() || "");
      return (g.members || []).filter((m) => m.device && m.device.ieee).map((m) => {
        const ieee = normIeee(m.device.ieee);
        const d = this._devices.find((x) => normIeee(x.ieee) === ieee);
        return {
          ieee: d ? d.ieee : ieee,
          endpoint: m.endpoint_id,
          name: d ? this._deviceLabel(d) : m.device.user_given_name || m.device.name || ieee,
          isCoordinator: ieee === coord || !!(d && (d.device_type === "Coordinator" || d.active_coordinator))
        };
      });
    }
    /** Which members of a group support `clusterId`, from cached cluster lists. */
    _groupSupport(groupId, clusterId) {
      return groupClusterSupport({
        members: this._groupMembers(groupId),
        clusterId,
        clustersFor: (ieee) => this._clusterCache.get(ieee)
      });
    }
    _groupName(groupId) {
      const g = (this._groups || []).find((x) => Number(x.group_id) === Number(groupId));
      return g ? g.name : `group ${groupId}`;
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
      if (this._devices.length && !this._devices.some((d) => normIeee(d.ieee) === sourceIeeeN)) {
        return {
          level: "error",
          code: "source_missing",
          message: "The source device no longer exists.",
          why: "This binding was read from a device that's since been removed from ZHA, so it's leftover saved data rather than something currently controllable. Unbinding isn't possible because there's no device left to send the command to.",
          recommendation: "Click Forget to remove the leftover data (nothing is sent to your Zigbee network). The next full scan also clears it automatically."
        };
      }
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
      if (b.isGroup) {
        const groupExists = this._groups.some((g) => g.group_id === b.groupId);
        if (!groupExists) {
          return {
            level: "info",
            code: "missing_group",
            message: `Group ${groupIdHex(b.groupId)} isn't a Home Assistant group.`,
            why: "This binding sends commands to a Zigbee group that Home Assistant doesn't know about. It was probably made on the devices themselves (Find & Bind, a remote's pairing button, or another Zigbee system), or it's a ZHA group that was deleted. Any device that joined the group still receives the commands; Home Assistant just can't show which ones.",
            recommendation: "Groups tab \u2192 Groups only on devices: add it to Home Assistant to see and change its lights, or remove the binding if you don't use it."
          };
        }
        if (isManufacturerSpecific(b.clusterId)) return manufacturerSpecificRule(b.clusterId);
        const support = groupSupportHealth(
          this._groupSupport(b.groupId, b.clusterId),
          clusterName(b.clusterId),
          this._groupName(b.groupId)
        );
        if (support && support.level !== "info") return support;
        if (support && (dupCounts.get(this._healthDupKey(b)) || 0) <= 1) return support;
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
            why: "A binding sends commands from the source straight to this target over Zigbee. Since the target no longer exists, those commands go nowhere, and the binding still uses one of the source device's limited binding-table slots.",
            recommendation: 'Unbind it here, or use "Unbind all" above the table to clean up every binding to removed devices at once.'
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
        if (isManufacturerSpecific(b.clusterId)) return manufacturerSpecificRule(b.clusterId);
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
        const unusual = unusualDeviceBindingRule({ clusterId: b.clusterId, classification: this._classifyBinding(b) });
        if (unusual && (dupCounts.get(this._healthDupKey(b)) || 0) <= 1) return unusual;
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
        if (this.tabInUrl) this._applyHashView();
      }
      this._renderStatus();
      this._renderToolbarState();
      if (this._view === "graph") this._renderGraph();
      if (this._view === "table") this._renderTable();
      if (this._view === "advanced") this._renderAdvanced();
      if (this._view === "floorplan") this._renderFloorplan();
      if (this._view === "devices") this._renderDevicesTab();
      if (this._view === "groups") this._renderGroupsTab();
      if (this._view === "capexplorer") this._renderCapabilityExplorer();
      if (this._view === "mesh") this._renderMesh();
      this._toggleExperimentalUi();
      this._refreshDrawer();
    }
    _q(sel) {
      return this.shadowRoot.querySelector(sel);
    }
    _qa(sel) {
      return Array.from(this.shadowRoot.querySelectorAll(sel));
    }
    _switchView(view) {
      this._view = view;
      this._writeHashView(view);
      this._qa(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
      const search = this._q("#search");
      if (search) search.style.display = SEARCHABLE_VIEWS.has(view) ? "" : "none";
      this._qa(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
      this._render();
    }
    /** Opens the tab named in the address (#bindings…), sidebar page only.
     *  The Network tab exists only with experimental features on, which isn't
     *  known until the integration has answered: it's opened then, or the
     *  address falls back to the Map. Unknown names are left alone. */
    _applyHashView() {
      if (!this.tabInUrl) return;
      let hash = "";
      try {
        hash = window.location.hash;
      } catch (e) {
        return;
      }
      const view = viewFromHash(hash);
      if (!view || view === this._view) return;
      if (view === "mesh" && !this._experimental) {
        if (!this._experimentalKnown) this._pendingHashView = "mesh";
        else this._writeHashView(this._view);
        return;
      }
      this._switchView(view);
    }
    /** Puts the selected tab in the address without adding a history entry,
     *  so Back still leaves the page instead of stepping through tabs. */
    _writeHashView(view) {
      if (!this.tabInUrl) return;
      try {
        const hash = hashForView(view);
        if (window.location.hash === hash) return;
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search + hash);
      } catch (e) {
      }
    }
    _wireShell() {
      this._qa(".tab").forEach((btn) => {
        btn.addEventListener("click", () => this._switchView(btn.dataset.view));
      });
      this._q("#btn-scan").addEventListener("click", () => this._scanBindings());
      this._q("#drawer-close").addEventListener("click", () => this._closeDrawer());
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
      const dismissHintBtn = this._q("#btn-dismiss-storage-hint");
      if (dismissHintBtn) {
        dismissHintBtn.addEventListener("click", () => {
          this._saveStorageHintDismissed(true);
          this._renderStorageMode();
        });
      }
      const useSharedBtn = this._q("#btn-use-shared-storage");
      if (useSharedBtn) {
        useSharedBtn.addEventListener("click", () => this._switchToSharedStorage());
      }
      const useLocalBtn = this._q("#btn-use-local-storage");
      if (useLocalBtn) {
        useLocalBtn.addEventListener("click", () => this._switchToLocalStorage());
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
        if (this._view === "devices") this._renderDevicesTab();
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
      const fpFloor = this._q("#fp-floor");
      if (fpFloor) fpFloor.addEventListener("change", () => this._fpSwitchFloor(fpFloor.value));
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
      const action = this._status.action;
      el.innerHTML = `<span class="status-text">${escapeHtml(this._status.text)}</span>${action ? `<button type="button" class="btn btn-small status-action">${escapeHtml(action.label)}</button>` : ""}<button type="button" class="status-close" aria-label="Dismiss">\xD7</button>`;
      const actionBtn = el.querySelector(".status-action");
      if (actionBtn && action) actionBtn.addEventListener("click", () => action.onClick());
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
    /** Toolbar search for the Devices tab: matches either name (the one you
     *  gave the device or ZHA's own), manufacturer, model, area or IEEE, so a
     *  device can be found in a long list by whatever you remember about it. */
    _deviceMatchesSearch(d, s) {
      if (!s) return true;
      const hay = [d.user_given_name, d.name, d.manufacturer, d.model, this._areaName(d.area_id), d.ieee].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s.trim());
    }
    _deviceLabel(d) {
      return d.user_given_name || d.name || d.model || d.ieee;
    }
    /** Display label for a device referenced only by IEEE (a binding's
     *  source/target), falling back to the raw IEEE if it's since left the
     *  network — shared by the exploded view's badge renderers so they don't
     *  each repeat the same find-or-fallback lookup. */
    _targetDeviceLabel(ieee) {
      return this._ieeeLabel(ieee);
    }
    /** Last-known details of a device by IEEE (see _knownDevices), or null. */
    _knownDeviceInfo(ieee) {
      return this._knownDevices.get(normIeee(ieee)) || null;
    }
    /** Whether `ieee` is a device ZHA no longer has. False while the device
     *  list is empty (not loaded, or failed to load). */
    _isRemovedDevice(ieee) {
      if (!ieee || !this._devices.length) return false;
      return !this._devices.some((d) => d.ieee === normIeee(ieee));
    }
    /** Display name for any device IEEE: the live name, or for a device
     *  removed from ZHA its last-known name marked "(removed)", or the raw
     *  IEEE if the card never saw it. `plain` leaves off the marker, for
     *  sentences that already say it was removed. */
    _ieeeLabel(ieee, { plain = false } = {}) {
      const d = this._devices.find((x) => x.ieee === normIeee(ieee));
      if (d) return this._deviceLabel(d);
      const k = this._knownDeviceInfo(ieee);
      if (k && k.name) return plain ? k.name : `${k.name} (removed)`;
      return ieee;
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
      [...this._pendingChecks.values()].filter((e) => e.kind === "bind" && !this._bindingPresent(e.sourceIeee, e.sourceEndpoint, e.clusterId, e.target)).forEach((e) => {
        const fromKey = this._nodeKey(e.sourceIeee);
        const toKey = e.target.isGroup ? this._groupNodeKey(e.target.groupId) : this._nodeKey(e.target.ieee);
        if (!visibleKeys.has(fromKey) || !visibleKeys.has(toKey)) return;
        const pairKey = `${fromKey}->${toKey}`;
        const idx = pairCount.get(pairKey) || 0;
        pairCount.set(pairKey, idx + 1);
        const line = this._svgEl("path", {
          class: "edge edge-pending",
          "data-from": fromKey,
          "data-to": toKey,
          "data-offset": idx,
          stroke: clusterColor(e.clusterId),
          fill: "none",
          "marker-end": "url(#arrow)"
        });
        line.style.setProperty("--edge-color", clusterColor(e.clusterId));
        const title = this._svgEl("title");
        title.textContent = `Not confirmed yet: bind ${this._describeChange(e)}. Click to check again (wake a battery device first).`;
        line.appendChild(title);
        line.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this._checkPendingAgain();
        });
        this._edgesLayer.appendChild(line);
      });
      if (this._watchEnabled) {
        for (const dev of lostSummary(this._lost).devices) {
          for (const b of dev.lost) {
            const fromKey = this._nodeKey(b.sourceIeee || dev.ieee);
            const toKey = b.isGroup ? this._groupNodeKey(b.groupId) : this._nodeKey(b.targetIeee);
            if (!visibleKeys.has(fromKey) || !visibleKeys.has(toKey)) continue;
            const pairKey = `${fromKey}->${toKey}`;
            const idx = pairCount.get(pairKey) || 0;
            pairCount.set(pairKey, idx + 1);
            const line = this._svgEl("path", {
              class: "edge edge-lost",
              "data-from": fromKey,
              "data-to": toKey,
              "data-offset": idx,
              stroke: LOST_EDGE_COLOR,
              fill: "none",
              "marker-end": "url(#arrow)"
            });
            line.style.setProperty("--edge-color", LOST_EDGE_COLOR);
            const title = this._svgEl("title");
            title.textContent = `Lost: ${b.text || b.key}. The device had this binding and doesn't any more. Click to put it back.`;
            line.appendChild(title);
            line.addEventListener("click", (ev) => {
              ev.stopPropagation();
              const d = this._devices.find((x) => normIeee(x.ieee) === dev.ieee);
              if (d) this._openDeviceDrawer(d);
            });
            this._edgesLayer.appendChild(line);
          }
        }
      }
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
      this._renderMapRoute();
      this._updateEdgePositions();
    }
    /** 1.5.0 (experimental): a binding's likely route drawn over the Map, hop
     *  by hop through the routers, from the last network scan. Set by "Show
     *  route on the Map" in a binding's details. */
    _renderMapRoute() {
      const banner = this._q("#map-route-banner");
      this._qa("#graph-svg .map-route-node").forEach((el) => el.classList.remove("map-route-node"));
      if (this._routeLayer && this._routeLayer.parentNode) this._routeLayer.parentNode.removeChild(this._routeLayer);
      this._routeLayer = null;
      const r = this._mapRoute;
      if (!r || !this._experimental) {
        if (banner) banner.style.display = "none";
        return;
      }
      const nameOf = (i) => this._ieeeLabel(i, { plain: true });
      const show = (html) => {
        if (!banner) return;
        banner.style.display = "";
        banner.innerHTML = `<span class="map-route-text">${html}</span> <button class="btn btn-small" id="map-route-clear">Clear route</button>`;
        const b = this._q("#map-route-clear");
        if (b) b.addEventListener("click", () => {
          this._mapRoute = null;
          this._renderMapRoute();
        });
      };
      const title = `<strong>Route ${escapeHtml(nameOf(r.sourceIeee))} \u2192 ${escapeHtml(nameOf(r.targetIeee))}</strong>`;
      if (!this._meshSnapshot) {
        this._meshEnsureLoaded();
        show(`${title}: loading the last network scan\u2026`);
        return;
      }
      if (!Object.keys(this._meshSnapshot).length) {
        show(`${title}: no network scan yet. Open the <strong>Network</strong> tab and click <strong>Scan network</strong>.`);
        return;
      }
      const path = routePath(this._meshModel(), r.sourceIeee, r.targetIeee);
      const v = pathVerdict(path, this._lqiThr);
      const visible = new Set((this._graphNodes || []).map((n) => n.key));
      const hidden = /* @__PURE__ */ new Set();
      const layer = this._svgEl("g", { class: "map-route-layer" });
      path.hops.forEach((h, i) => {
        const a = this._nodeKey(h.from);
        const b = this._nodeKey(h.to);
        [a, b].forEach((k, j) => {
          if (!visible.has(k)) hidden.add(j ? h.to : h.from);
          else if (this._nodeEls && this._nodeEls.get(k)) this._nodeEls.get(k).classList.add("map-route-node");
        });
        if (!visible.has(a) || !visible.has(b)) return;
        const level = rateLqi(h.lqi, this._lqiThr);
        const line = this._svgEl("path", { class: `map-route-hop map-route-${level}`, "data-from": a, "data-to": b, fill: "none", "marker-end": "url(#route-arrow)" });
        line.style.stroke = this._lqiColor(level);
        const t = this._svgEl("title");
        t.textContent = `Hop ${i + 1}: ${nameOf(h.from)} \u2192 ${nameOf(h.to)}, ${typeof h.lqi === "number" ? `${level} (LQI ${h.lqi})` : "link quality not reported"}`;
        line.appendChild(t);
        layer.appendChild(line);
        const label = this._svgEl("text", { class: "map-route-lqi", "data-from": a, "data-to": b, "text-anchor": "middle" });
        label.textContent = typeof h.lqi === "number" ? String(h.lqi) : "?";
        label.style.fill = this._lqiColor(level);
        layer.appendChild(label);
      });
      const svg = this._q("#graph-svg");
      const defs = svg && svg.querySelector("defs");
      if (defs && !defs.querySelector("#route-arrow")) {
        defs.insertAdjacentHTML("beforeend", `<marker id="route-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker>`);
      }
      if (svg && this._nodesLayer) svg.insertBefore(layer, this._nodesLayer);
      this._routeLayer = layer;
      this._updateMapRoutePositions();
      const chain = path.hops.length ? `${escapeHtml(nameOf(path.hops[0].from))}${path.hops.map((h) => ` \u2192 ${this._lqiChip(h.lqi)} ${escapeHtml(nameOf(h.to))}`).join("")}` : "";
      const verdict = v.level === "good" ? "Likely path looks good." : v.level === "weak" ? `Weak link: ${escapeHtml(nameOf(v.weakest.from))} to ${escapeHtml(nameOf(v.weakest.to))} (LQI ${v.weakest.lqi}).` : v.level === "none" ? `No route found. ${escapeHtml(path.note || "")}` : `Partly known. ${escapeHtml(path.note || "Some link qualities weren't reported.")}`;
      const hiddenNote = hidden.size ? ` <span class="muted">Not on the Map with the current filters: ${[...hidden].map((i) => escapeHtml(nameOf(i))).join(", ")} (tick Routers or End devices to see every hop).</span>` : "";
      show(`${title}: ${chain ? `${chain}. ` : ""}${verdict}${hiddenNote} <span class="muted">A prediction from the scan ${escapeHtml(this._meshAgeText() || "")}.</span>`);
    }
    _updateMapRoutePositions() {
      if (!this._routeLayer) return;
      this._routeLayer.querySelectorAll("[data-from]").forEach((el) => {
        const from = this._positions[el.dataset.from];
        const to = this._positions[el.dataset.to];
        if (!from || !to) return;
        const dx = to.x - from.x, dy = to.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (el.tagName.toLowerCase() === "text") {
          el.setAttribute("x", (from.x + to.x) / 2 - dy / dist * 12);
          el.setAttribute("y", (from.y + to.y) / 2 + dx / dist * 12);
          return;
        }
        const g1 = this._nodeRadius(el.dataset.from) + 4, g2 = this._nodeRadius(el.dataset.to) + 6;
        el.setAttribute("d", `M ${from.x + dx / dist * g1} ${from.y + dy / dist * g1} L ${to.x - dx / dist * g2} ${to.y - dy / dist * g2}`);
      });
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
      this._updateMapRoutePositions();
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
      title.textContent = "This device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here \u2014 click it, then Show endpoints\u2026, for the per-endpoint breakdown.";
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
        if (ctx.node.kind === "device") this._openDeviceDrawer(ctx.node.device);
        return;
      }
      this._savePositions();
      if (ctx.dropTarget) {
        if (ctx.node.kind !== "device") {
          this._setStatus("error", "You can only bind from a device (not a group).");
          return;
        }
        if (ctx.dropTarget.kind === "group" && controllerEndpoints(this._clusterCache.get(ctx.node.device.ieee)).length) {
          this._openGroupFlow(ctx.node.device, { groupId: ctx.dropTarget.group.group_id });
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
      <p class="hint">This isn't a binding-table entry: it's group membership, from ZHA's own
        group data. The member receives this group's commands without needing any binding of its own.
        Add or remove members on the <strong>Groups</strong> tab.</p>
      <div class="dialog-actions">
        <button class="btn" id="membership-groups">Open the Groups tab</button>
        <button class="btn" id="unbind-cancel">Close</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#unbind-cancel").addEventListener("click", () => this._closeDialog());
      this._q("#membership-groups").addEventListener("click", () => {
        this._closeDialog();
        this._groupsFocus = m.groupId;
        this._switchView("groups");
      });
    }
    // -------------------------------------------------------------------
    // "Set up what this controls" flow (1.1.0; "Control lights with this" until
    // 1.6.0). Pure logic lives in
    // src/group-flow.js; see the project PRD "Group-Based Binding Setup".
    // Whether a remote accepts and uses group bindings can't be detected in
    // advance, so the flow shows what others reported, explains the
    // pitfalls, tests by asking the user to press a button, and asks them to
    // share the result.
    // -------------------------------------------------------------------
    /** Toolbar entry (1.4.0): the flow starts by picking the remote. */
    async _openGroupFlowPickRemote({ groupId = null } = {}) {
      this._closeDrawer();
      this._flow = { step: "remote", fromToolbar: true, remotes: null, sourceIeee: null, presetGroupId: groupId };
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.add("wide");
      this._q("#dialog").classList.add("open");
      this._explodedDeviceIeee = null;
      this._renderGroupFlow();
      await Promise.all(this._devices.map((d) => this._ensureClusters(d.ieee).catch(() => {
      })));
      if (!this._flow || this._flow.step !== "remote") return;
      const coord = normIeee(this._coordinatorIeee() || "");
      this._flow.remotes = this._devices.filter((d) => normIeee(d.ieee) !== coord && d.device_type !== "Coordinator" && !this._isRemovedDevice(d.ieee)).filter((d) => controllerEndpoints(this._clusterCache.get(d.ieee)).length).map((d) => ({ ieee: d.ieee, name: this._deviceLabel(d), area: d.area_id ? this._areaName(d.area_id) : "", model: [d.manufacturer, d.model].filter(Boolean).join(" "), battery: this._isBatteryDevice(d) })).sort((a, b) => a.name.localeCompare(b.name));
      this._renderGroupFlow();
    }
    async _openGroupFlow(source, { groupId = null, fromToolbar = false } = {}) {
      this._closeDrawer();
      const clusters = await this._ensureClusters(source.ieee).catch(() => []);
      const eps = controllerEndpoints(clusters);
      if (!eps.length) {
        this._setStatus("error", `${this._deviceLabel(source)} doesn't send On/Off, Level Control, Colour Control or Window Covering commands, so it can't control other devices.`);
        return;
      }
      this._flow = {
        step: "pick",
        fromToolbar,
        sourceIeee: source.ieee,
        endpoints: eps,
        endpoint: eps[0].endpoint,
        selected: /* @__PURE__ */ new Set(),
        groupChoice: groupId != null ? "existing" : "new",
        startGroupId: groupId != null ? Number(groupId) : null,
        candidates: null,
        // Direct or group: suggested from the selected lights (and what other
        // users reported) until the user picks one; starting from a group
        // (Groups tab "Add a remote…") means group.
        mode: groupId != null ? "group" : "direct",
        modeTouched: groupId != null,
        // data/behaviour.json once loaded (null if it couldn't be); what other
        // users found is worked out from it for the clusters being bound.
        behaviourDoc: void 0,
        groupName: suggestGroupName(this._areaName(source.area_id), this._deviceLabel(source)),
        clustersChosen: null,
        known: null,
        log: [],
        items: [],
        test: null,
        result: null,
        groupId: null,
        busy: false
      };
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.add("wide");
      this._q("#dialog").classList.add("open");
      this._explodedDeviceIeee = null;
      this._renderGroupFlow();
      this._flowLoadKnown();
      await Promise.all(this._devices.map((d) => this._ensureClusters(d.ieee).catch(() => {
      })));
      if (!this._flow) return;
      this._flowRefreshCandidates();
      if (this._flow.startGroupId != null) this._flowSelectGroup(this._flow.startGroupId);
      this._flowAutoMode();
      this._renderGroupFlow();
    }
    _flowSource() {
      return this._devices.find((d) => normIeee(d.ieee) === normIeee(this._flow.sourceIeee)) || { ieee: this._flow.sourceIeee };
    }
    _flowSourceClusters() {
      const ep = this._flow.endpoints.find((e) => e.endpoint === Number(this._flow.endpoint));
      return ep ? ep.clusters : [];
    }
    _flowRefreshCandidates() {
      const coord = normIeee(this._coordinatorIeee() || "");
      this._flow.candidates = candidateTargets({
        devices: this._devices.map((d) => ({
          ieee: d.ieee,
          name: this._deviceLabel(d),
          isCoordinator: normIeee(d.ieee) === coord || d.device_type === "Coordinator"
        })),
        clustersFor: (ieee) => this._clusterCache.get(ieee),
        sourceIeee: this._flow.sourceIeee,
        clusterIds: this._flowSourceClusters()
      });
      const valid = new Set(this._flow.candidates.map(targetKey));
      this._flow.selected = new Set([...this._flow.selected].filter((k) => valid.has(k)));
    }
    _flowSelectGroup(groupId) {
      const g = this._groups.find((x) => Number(x.group_id) === Number(groupId));
      this._flow.startGroupId = g ? Number(g.group_id) : null;
      if (!g) return;
      const valid = new Set((this._flow.candidates || []).map(targetKey));
      this._flow.selected = new Set(
        (g.members || []).filter((m) => m.device).map((m) => targetKey({ ieee: m.device.ieee, endpoint: m.endpoint_id })).filter((k) => valid.has(k))
      );
    }
    _flowCanReview() {
      const f = this._flow;
      if (!f || !f.selected.size) return false;
      if (!this._flowModeOptions()[f.mode].ok) return false;
      return !(f.mode === "group" && f.groupChoice === "existing" && f.startGroupId == null);
    }
    /** Follows the suggested way of binding until the user picks one. */
    _flowAutoMode() {
      const f = this._flow;
      if (!f || f.modeTouched) return;
      f.mode = suggestMode(this._flowTargets(), {
        groupKnown: this._flowKnownFor("group_binding"),
        directKnown: this._flowKnownFor("direct_binding")
      });
    }
    _flowModeOptions() {
      const f = this._flow;
      const clusterCount = f.clustersChosen ? f.clustersChosen.size : this._flowSourceClusters().length;
      return modeOptions(this._flowTargets(), { clusterCount });
    }
    /** What other users reported for the way of binding currently chosen. */
    _flowKnown() {
      const f = this._flow;
      return f ? this._flowKnownFor(f.mode === "direct" ? "direct_binding" : "group_binding") : null;
    }
    /** Community reports for this remote and `behaviour`, counting only
     *  reports for the clusters about to be bound (chosen on the review step,
     *  else everything the chosen endpoint sends). Null until loaded. */
    _flowKnownFor(behaviour) {
      const f = this._flow;
      if (!f || f.behaviourDoc === void 0) return null;
      const clusters = f.clustersChosen && f.clustersChosen.size ? [...f.clustersChosen] : this._flowSourceClusters();
      return knownBehaviour(f.behaviourDoc, this._flowSlugKey(), behaviour, this._flowFirmware(), clusters);
    }
    /** "How should it control them?" — shared by the Choose devices and Review steps. */
    _flowModeHtml() {
      const f = this._flow;
      const targets = this._flowTargets();
      const opts = this._flowModeOptions();
      const tag = (m) => !f.modeTouched && f.mode === m && targets.length ? ' <span class="flow-suggested">suggested</span>' : "";
      const n = targets.length;
      const notes = [];
      if (f.mode === "direct" && opts.direct.warning) notes.push(opts.direct.warning);
      if (!opts.group.ok) notes.push(opts.group.reason);
      for (const [label, k] of [["Directly", this._flowKnownFor("direct_binding")], ["Through a group", this._flowKnownFor("group_binding")]]) {
        if (k && k.state !== "unknown") notes.push(`${label}: ${k.text}`);
      }
      return `<fieldset class="flow-mode"><legend>How should it control them?</legend>
        <label><input type="radio" name="flow-mode" value="direct" ${f.mode === "direct" ? "checked" : ""}> Directly${tag("direct")}
          <span class="muted">(${n > 1 ? `one binding per device: uses ${n} binding-table slots per cluster on the remote` : "a binding straight to the device"}; works with devices that can't join groups, and with remotes that don't support groups)</span></label>
        <label class="${opts.group.ok ? "" : "muted"}"><input type="radio" name="flow-mode" value="group" ${f.mode === "group" ? "checked" : ""} ${opts.group.ok ? "" : "disabled"}> Through a group${tag("group")}
          <span class="muted">(one binding to a ZHA group: the devices respond together, and you can add more later without touching the remote)</span></label>
        ${notes.map((t) => `<p class="hint">${escapeHtml(t)}</p>`).join("")}
      </fieldset>`;
    }
    /** One line under the group choice saying what will happen to the group. */
    _flowGroupNote() {
      const f = this._flow;
      if (!f) return "";
      const targets = this._flowTargets();
      if (f.groupChoice === "existing") {
        const g = f.startGroupId != null ? this._groups.find((x) => Number(x.group_id) === f.startGroupId) : null;
        if (!g) return "Pick a group: its devices are ticked below, and you can tick more to add them to it.";
        const add = missingMembers(g, targets);
        return add.length ? `${add.length} ticked device${add.length === 1 ? " isn't" : "s aren't"} in ${g.name} yet and will be added.` : `Uses ${g.name} as it is.`;
      }
      if (!targets.length) return "Tick the devices below. The card creates this group in ZHA and adds them to it.";
      const match = findMatchingGroup(this._groups, targets, this._coordinatorIeee());
      if (match) return `These devices are already the group ${match.name}, so that group will be reused instead.`;
      return `The card creates this group in ZHA with the ${targets.length} ticked device${targets.length === 1 ? "" : "s"}.`;
    }
    _flowTargets() {
      return (this._flow.candidates || []).filter((t) => this._flow.selected.has(targetKey(t)));
    }
    _flowFirmware() {
      const src = this._flowSource();
      let sw = null;
      const prefix = `${normIeee(src.ieee)}:`;
      for (const [key, entry] of this._commandScans.entries()) {
        if (key.startsWith(prefix) && entry.status === "done" && entry.scan) {
          const epScan = (entry.scan.endpoints || []).find((e) => Number(e.id) === Number(key.slice(prefix.length)));
          const id = epScan && this._extractIdentity(epScan);
          if (id && id.sw_build_id) sw = id.sw_build_id;
        }
      }
      const reg = this._haDeviceRegistryEntry(src.ieee);
      return { sw_build_id: sw, registry_sw_version: reg && reg.sw_version || null };
    }
    _flowSlugKey() {
      const src = this._flowSource();
      return `${slugify(src.manufacturer)}/${slugify(src.model)}`;
    }
    _flowBehaviour() {
      return this._flow.mode === "direct" ? "direct_binding" : "group_binding";
    }
    async _flowLoadKnown() {
      const flow = this._flow;
      if (!flow) return;
      let doc = null;
      try {
        doc = await fetchBehaviourDoc();
      } catch (e) {
        flow.knownError = e.message || String(e);
      }
      if (this._flow !== flow) return;
      flow.behaviourDoc = doc;
      this._flowAutoMode();
      this._renderGroupFlow();
    }
    _flowPitfallsHtml(open) {
      return `<details class="flow-pitfalls" ${open ? "open" : ""}>
      <summary>Group bindings: what to expect</summary>
      <ul>
        <li><strong>Not every remote supports them.</strong> Some only bind to individual devices, some only to a single group. There's no way to ask a device in advance, so the card tries it and checks.</li>
        <li><strong>"Stored" isn't the same as "working".</strong> A few remotes accept a group binding but never send to it. That's why you'll be asked to press a button at the end.</li>
        <li><strong>Battery remotes need to be awake.</strong> Press a button on the remote just before binding, and again if the card says "not confirmed yet".</li>
        <li><strong>The devices hold the group membership.</strong> If one is replaced or re-paired, add it to the group again.</li>
        <li><strong>Firmware matters.</strong> The same model can behave differently on different firmware.</li>
      </ul>
    </details>`;
    }
    _renderGroupFlow() {
      const f = this._flow;
      if (!f) return;
      const body = this._q("#dialog-body");
      const names = f.fromToolbar ? ["remote", "Choose remote", "pick", "Choose devices", "plan", "Review", "run", "Set up", "test", "Test", "done", "Result"] : ["pick", "Choose devices", "plan", "Review", "run", "Set up", "test", "Test", "done", "Result"];
      const stepList = [];
      for (let i = 0; i < names.length; i += 2) stepList.push([names[i], `${i / 2 + 1}. ${names[i + 1]}`]);
      const steps = `<ol class="flow-steps">${stepList.map(([k, v]) => `<li class="${k === f.step || f.step === "stopped" && k === "run" ? "active" : ""}">${v}</li>`).join("")}</ol>`;
      let html = "";
      if (f.step === "remote") {
        this._q("#dialog-title").textContent = "Set up what a remote controls";
        const list2 = f.remotes == null ? `<p class="muted">Finding remotes and switches\u2026</p>` : !f.remotes.length ? `<p class="muted">No device sends On/Off, Level Control, Colour Control or Window Covering commands, so there's nothing that can control other devices. If you've just paired a remote, click \u27F3 Devices and try again.</p>` : `<div class="flow-targets">${f.remotes.map(
          (r) => `<label class="flow-target"><input type="radio" name="flow-remote" value="${escapeHtml(r.ieee)}" ${r.ieee === f.sourceIeee ? "checked" : ""}>
                  <span>${escapeHtml(r.name)}${r.battery ? ' <span class="muted" title="Battery">\u{1F50B}</span>' : ""}</span><span class="muted">${escapeHtml([r.area, r.model].filter(Boolean).join(" \xB7 "))}</span></label>`
        ).join("")}</div>`;
        body.innerHTML = `${steps}<div class="flow">
        <p>Pick the remote or wireless switch to set up. Then choose what it should control (lights, blinds or other
          devices) and whether it controls them directly or through a ZHA group. The card binds it and checks that it
          works. Either way, they keep responding to it when Home Assistant is down.</p>
        <p><strong>Remotes and switches</strong></p>${list2}
        <div class="dialog-actions">
          <button class="btn btn-primary" id="flow-remote-next" ${f.sourceIeee ? "" : "disabled"}>Next: choose devices</button>
          <button class="btn" id="flow-cancel">Cancel</button>
        </div></div>`;
        this._qa('input[name="flow-remote"]').forEach(
          (r) => r.addEventListener("change", () => {
            f.sourceIeee = r.value;
            const btn = this._q("#flow-remote-next");
            if (btn) btn.disabled = false;
          })
        );
        const next = this._q("#flow-remote-next");
        if (next)
          next.addEventListener("click", () => {
            const d = this._devices.find((x) => x.ieee === f.sourceIeee);
            if (d) this._openGroupFlow(d, { fromToolbar: true, groupId: f.presetGroupId != null ? f.presetGroupId : null });
          });
        this._qa("#flow-cancel").forEach((b) => b.addEventListener("click", () => {
          this._flow = null;
          this._closeDialog();
        }));
        return;
      }
      const src = this._flowSource();
      const srcName = this._deviceLabel(src);
      this._q("#dialog-title").textContent = `Set up what ${srcName} controls`;
      if (f.step === "pick") {
        const epSel = f.endpoints.length > 1 ? `<label>Button (endpoint)
              <select id="flow-ep">${f.endpoints.map((e) => `<option value="${e.endpoint}" ${e.endpoint === Number(f.endpoint) ? "selected" : ""}>Endpoint ${e.endpoint}: ${escapeHtml(e.clusters.map(clusterName).join(", "))}</option>`).join("")}</select></label>` : `<p class="muted">Sends ${escapeHtml(f.endpoints[0].clusters.map(clusterName).join(", "))} from endpoint ${f.endpoints[0].endpoint}.</p>`;
        const sortedGroups = [...this._groups].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        const existing = f.groupChoice === "existing";
        const groupSel = f.mode !== "group" ? "" : `<fieldset class="flow-mode flow-group-choice"><legend>Group</legend>
          <label><input type="radio" name="flow-group-choice" value="new" ${existing ? "" : "checked"}> New group
            <input type="text" id="flow-group-name" value="${escapeHtml(f.groupName)}" ${existing ? "disabled" : ""} aria-label="New group name"></label>
          <label class="${sortedGroups.length ? "" : "muted"}"><input type="radio" name="flow-group-choice" value="existing" ${existing ? "checked" : ""} ${sortedGroups.length ? "" : "disabled"}> Existing group
            <select id="flow-start-group" ${existing ? "" : "disabled"}><option value="">\u2014 pick a group \u2014</option>${sortedGroups.map((g) => `<option value="${g.group_id}" ${Number(g.group_id) === f.startGroupId ? "selected" : ""}>${escapeHtml(g.name)}</option>`).join("")}</select></label>
          <p class="hint" id="flow-group-note">${escapeHtml(this._flowGroupNote())}</p>
        </fieldset>`;
        const list2 = f.candidates == null ? `<p class="muted">Finding devices this remote can control\u2026</p>` : !f.candidates.length ? `<p class="muted">No devices accept ${escapeHtml(this._flowSourceClusters().map(clusterName).join(" or "))}.</p>` : `<div class="flow-targets">${f.candidates.map((t) => {
          const k = targetKey(t);
          const noGroup = t.groupable === false ? ` <span class="flow-tag" title="This device has no Groups cluster, so it can't be added to a ZHA group. Control it directly instead.">can't join groups</span>` : "";
          return `<label class="flow-target"><input type="checkbox" data-flow-target="${escapeHtml(k)}" ${f.selected.has(k) ? "checked" : ""}>
                  <span>${escapeHtml(t.name)}${noGroup}</span><span class="muted">${escapeHtml(t.clusters.map(clusterName).join(", "))}</span></label>`;
        }).join("")}</div>`;
        html = `${epSel}<p><strong>Devices to control</strong> (<span id="flow-count">${f.selected.size}</span> selected)</p>${list2}
        ${f.candidates && f.candidates.length ? this._flowModeHtml() : ""}${groupSel}
        <div class="dialog-actions">
          <button class="btn btn-primary" id="flow-next" ${this._flowCanReview() ? "" : "disabled"}>Next: review</button>
          ${f.fromToolbar ? `<button class="btn" id="flow-back-remote">Back</button>` : ""}
          <button class="btn" id="flow-advanced">Use the Advanced tab instead</button>
          <button class="btn" id="flow-cancel">Cancel</button>
        </div>`;
      }
      if (f.step === "plan") {
        const targets = this._flowTargets();
        const plan = planClusters(this._flowSourceClusters(), targets, (ieee) => this._clusterCache.get(ieee));
        if (!f.clustersChosen) f.clustersChosen = new Set(plan.filter((p) => p.include).map((p) => p.clusterId));
        const k = this._flowKnown();
        const known = k ? `<div class="flow-known flow-known-${k.state}"><strong>What other users found:</strong> ${escapeHtml(k.text)}</div>` : `<div class="flow-known flow-known-unknown">Checking what other users have reported\u2026</div>`;
        let seen = false;
        try {
          seen = localStorage.getItem("zbm:flow-pitfalls-seen") === "1";
        } catch (e) {
        }
        const mode = this._flowModeHtml();
        let groupLine = "";
        if (f.mode === "group") {
          const start = f.startGroupId != null ? this._groups.find((g) => Number(g.group_id) === f.startGroupId) : null;
          const match = start ? null : findMatchingGroup(this._groups, targets, this._coordinatorIeee());
          if (match) groupLine = `<p>Group: reuse <strong>${escapeHtml(match.name)}</strong>, which already has exactly these devices.</p>`;
          else if (start) {
            const add = missingMembers(start, targets);
            groupLine = `<p>Group: use <strong>${escapeHtml(start.name)}</strong>${add.length ? ` and add ${escapeHtml(add.map((t) => t.name).join(", "))}` : ""}. Devices already in it that you didn't select stay in it.</p>`;
          } else {
            const name = (f.groupName || "").trim() || suggestGroupName(null, srcName);
            groupLine = `<p>Group: create <strong>${escapeHtml(name)}</strong> with ${targets.length} device${targets.length === 1 ? "" : "s"}.</p>`;
          }
        }
        const clusterRows = plan.map((p) => {
          const sum = groupSupportSummary(p.support, clusterName(p.clusterId), "the selected devices");
          if (!p.include) return `<li class="muted">Not bound: ${escapeHtml(clusterName(p.clusterId))}. None of the selected devices support it.</li>`;
          return `<li><label><input type="checkbox" data-flow-cluster="${p.clusterId}" ${f.clustersChosen.has(p.clusterId) ? "checked" : ""}> ${escapeHtml(clusterName(p.clusterId))}</label>
            <span class="flow-support flow-support-${sum.level}">${escapeHtml(sum.text.replace(/ in the selected devices/, " selected"))}</span></li>`;
        }).join("");
        const battery = this._isBatteryDevice(src);
        html = `${known}${this._flowPitfallsHtml(!seen && f.mode === "group")}${mode}${groupLine}
        <p><strong>Clusters</strong></p><ul class="flow-clusters">${clusterRows}</ul>
        ${battery ? `<p class="hint">${escapeHtml(srcName)} runs on battery. You'll be asked to wake it just before binding.</p>` : ""}
        <div class="dialog-actions">
          <button class="btn btn-primary" id="flow-run" ${f.clustersChosen.size ? "" : "disabled"}>Set it up</button>
          <button class="btn" id="flow-back">Back</button>
          <button class="btn" id="flow-cancel">Cancel</button>
        </div>`;
      }
      if (f.step === "run" || f.step === "test" || f.step === "done" || f.step === "stopped") {
        const icon = { ok: "\u2705", fail: "\u274C", warn: "\u26A0", wait: "\u2026", info: "\u2139" };
        const log = `<ul class="flow-log">${f.log.map((l) => `<li class="flow-log-${l.state}">${icon[l.state] || ""} ${escapeHtml(l.text)}</li>`).join("")}</ul>`;
        let tail = "";
        if (f.step === "run" && f.awaitWake) {
          tail = `<p class="flow-callout">Press a button on <strong>${escapeHtml(srcName)}</strong> to wake it, then click Bind straight away.</p>
          <div class="dialog-actions"><button class="btn btn-primary" id="flow-bind-now">Bind now</button><button class="btn" id="flow-cancel">Cancel</button></div>`;
        } else if (f.step === "run" && f.verifying) {
          tail = `<p class="flow-callout">If ${escapeHtml(srcName)} runs on battery, <strong>press a button on it now</strong> so it answers the check.
          If the devices already respond to it, you can skip the check and go straight to the button test.</p>
          <div class="dialog-actions"><button class="btn" id="flow-skip-check">It already works: skip the check</button></div>`;
        } else if (f.step === "run" && f.unconfirmed) {
          tail = `<p class="flow-callout">${escapeHtml(srcName)} didn't answer the check, so the bindings aren't confirmed yet. Press a button on it, then click Check again.
          If the devices already respond to it, go straight to the button test instead.</p>
          <div class="dialog-actions"><button class="btn btn-primary" id="flow-check">Check again</button><button class="btn" id="flow-skip-check">It already works: test it</button><button class="btn" id="flow-cancel">Close</button></div>`;
        } else if (f.step === "test") {
          tail = `<p class="flow-callout"><strong>Now test it.</strong> ${escapeHtml(testInstruction(f.clustersChosen))} on ${escapeHtml(srcName)}. Did the devices respond?</p>
          <div class="dialog-actions">
            <button class="btn btn-primary" data-flow-test="all">All of them</button>
            <button class="btn" data-flow-test="some">Some of them</button>
            <button class="btn" data-flow-test="none">None</button>
          </div>`;
        } else if (f.step === "done") {
          tail = this._flowDoneHtml();
        } else if (f.step === "stopped") {
          tail = `<div class="dialog-actions"><button class="btn" id="flow-cancel">Close</button></div>`;
        }
        html = log + tail;
      }
      body.innerHTML = steps + `<div class="flow">${html}</div>`;
      this._flowWire();
    }
    _flowDoneHtml() {
      const f = this._flow;
      const groupName = f.groupId != null ? this._groupName(f.groupId) : "the devices";
      const advice = {
        works: `Done. ${f.mode === "group" ? `The remote controls ${groupName}.` : "The remote controls each device directly."}`,
        partial: `The binding works, but not every device responded. ${f.mode === "group" ? "The devices that didn't respond may not have joined the group: check them in ZHA's group page, or remove and re-add them." : "Check that the devices that didn't respond are powered and in range."}`,
        stored_ignored: "The remote stored the binding but nothing responded. Either it doesn't send to this kind of binding, or the devices didn't take the commands.",
        rejected: f.mode === "group" ? "The remote didn't accept the group binding." : "The remote didn't accept the bindings."
      }[f.result];
      const level = f.result === "works" ? "success" : f.result === "partial" ? "info" : "warning";
      const many = this._flowTargets().length > DIRECT_BINDING_MAX_LIGHTS;
      const failedRun = f.result === "rejected" || f.result === "stored_ignored";
      const fallback = f.mode === "group" && failedRun && !f.undo ? `<button class="btn" id="flow-direct">${undoPlan(f.items).unbind.length ? "Remove the group binding and bind to each device directly" : "Bind to each device directly instead"}</button>${many ? `<p class="hint">${escapeHtml(this._flowModeOptions().direct.warning)}</p>` : ""}` : "";
      let shared = false;
      try {
        shared = localStorage.getItem(this._flowShareKey()) === "1";
      } catch (e) {
      }
      const report = this._flowReport();
      const shareUrl = this._flowShareUrl(report);
      const share = shared ? `<p class="muted">You've shared a result for this remote and firmware before. Thanks! <a href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener" id="flow-share">Share this one too</a></p>` : `<div class="flow-share"><strong>Help other users: share this result.</strong>
          Nobody can tell in advance how a remote handles ${f.mode === "group" ? "group" : "direct"} bindings. Your result tells the next person with this remote what to expect.
          It opens a prefilled GitHub issue on the community database with the model, firmware, clusters and result only (no names or addresses).
          <div class="dialog-actions"><a class="btn btn-primary" id="flow-share" href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener">Share result</a></div>
          ${f.notInDb ? `<p class="hint">This remote isn't in the community database yet. Sharing a capability scan helps too: click the remote anywhere in the card, then <strong>Check and share capabilities\u2026</strong>.</p>` : ""}
        </div>`;
      return `<div class="flow-result flow-result-${level}"><strong>Result: ${escapeHtml(RESULT_TEXT[f.result] || f.result)}.</strong> ${escapeHtml(advice)}</div>
      ${share}
      ${failedRun ? this._flowUndoHtml() : ""}
      <div class="dialog-actions">${fallback}<button class="btn" id="flow-cancel">Close</button></div>`;
    }
    /** After "None" (or a rejected group binding): offer to remove what this
     *  run set up, so useless bindings don't sit in the remote's table
     *  (integration issue #41). */
    _flowUndoHtml() {
      const f = this._flow;
      const plan = undoPlan(f.items, { createdGroup: f.createdGroup, groupId: f.groupId });
      if (f.undo && f.undo.state === "done") return `<div class="flow-undo"><p>${escapeHtml(f.undo.summary)}</p></div>`;
      if (f.undo && f.undo.state === "running") return `<div class="flow-undo"><p class="muted">Removing\u2026</p></div>`;
      if (plan.empty) return "";
      const srcName = this._deviceLabel(this._flowSource());
      if (f.undo && f.undo.state === "wake") {
        return `<div class="flow-undo"><p class="flow-callout">Press a button on <strong>${escapeHtml(srcName)}</strong> to wake it, then click Remove now straight away.</p>
        <div class="dialog-actions"><button class="btn btn-primary" id="flow-undo-now">Remove now</button></div></div>`;
      }
      const what = plan.unbind.length ? `This removes the ${plan.unbind.length} binding${plan.unbind.length === 1 ? "" : "s"} this added to ${srcName}, then checks they're gone. Bindings ${srcName} already had are left alone.` : `${srcName} didn't keep any of the bindings, so only the group this created is left to remove.`;
      const keptGroup = f.mode === "group" && !f.createdGroup && f.groupId != null ? ` The group ${this._groupName(f.groupId)} was there before, so it stays as it is.` : "";
      const groupBox = plan.deleteGroup ? `<label class="flow-undo-group"><input type="checkbox" id="flow-undo-group" checked> Also delete the group ${escapeHtml(this._groupName(f.groupId))}</label>` : "";
      return `<div class="flow-undo"><strong>Remove what this set up?</strong>
      Bindings that nothing responds to only take up space in the remote's binding table. ${escapeHtml(what)}${escapeHtml(keptGroup)}
      ${groupBox}
      <div class="dialog-actions"><button class="btn" id="flow-undo">Remove what this set up</button></div></div>`;
    }
    /** Starts the undo; a battery remote is asked to wake first. `then` runs
     *  afterwards instead of re-rendering (used by "bind directly instead",
     *  which keeps the group). */
    _flowUndoStart(then = null) {
      const f = this._flow;
      const box = this._q("#flow-undo-group");
      const plan = undoPlan(f.items, { createdGroup: f.createdGroup, groupId: f.groupId });
      f.undo = { state: "wake", deleteGroup: !!(plan.deleteGroup && !then && (!box || box.checked)), then };
      if (plan.unbind.length && this._isBatteryDevice(this._flowSource())) {
        this._renderGroupFlow();
        return;
      }
      this._flowUndoRun();
    }
    /** Removes the bindings this run added, checks the remote's table once,
     *  and deletes the group it created only once nothing points at it any
     *  more. Removals go through the integration as on purpose, so the
     *  lost-bindings watch doesn't report them. */
    async _flowUndoRun() {
      const f = this._flow;
      if (!f || !f.undo) return;
      const src = this._flowSource();
      const ep = Number(f.endpoint);
      const plan = undoPlan(f.items, { createdGroup: f.createdGroup, groupId: f.groupId });
      f.undo.state = "running";
      this._renderGroupFlow();
      const before = plan.unbind.map((i) => this._bindingPresent(src.ieee, ep, i.clusterId, i.target));
      for (const item of plan.unbind) {
        try {
          if (item.target.isGroup) await this._api.unbindGroup(src.ieee, item.target.groupId, [item.clusterId], { endpoint: ep });
          else await this._api.unbindIeee(src.ieee, item.target.ieee, [item.clusterId], { endpoint: ep, dstEndpoint: item.target.endpoint });
        } catch (err) {
          console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
        }
      }
      let outcomes = [];
      if (plan.unbind.length) {
        const scan = await this._scanBindings([src.ieee], { tries: 1 });
        if (!this._flow || this._flow !== f) return;
        outcomes = plan.unbind.map(
          (item, i) => this._settleChange("unbind", { sourceIeee: src.ieee, sourceEndpoint: ep, clusterId: item.clusterId, target: item.target }, scan, before[i]).outcome
        );
        const word = {
          confirmed: ["ok", "removed"],
          absent: ["ok", "already gone"],
          unconfirmed: ["warn", "removal not confirmed yet"],
          failed: ["fail", "still on the remote"]
        };
        plan.unbind.forEach((item, i) => {
          const [state, text] = word[outcomes[i]] || ["info", outcomes[i]];
          f.log.push({ state, text: `${item.label}: ${text}` });
        });
      }
      let groupDeleted = null;
      const groupName = f.groupId != null ? this._groupName(f.groupId) : "";
      if (f.undo.deleteGroup) {
        if (outcomes.every((o) => o === "confirmed" || o === "absent")) {
          try {
            await this._api.removeGroups([f.groupId]);
            await this._reloadDevices({ quiet: true });
            groupDeleted = !this._groups.some((g) => Number(g.group_id) === Number(f.groupId));
          } catch (err) {
            groupDeleted = false;
          }
          f.log.push({ state: groupDeleted ? "ok" : "fail", text: groupDeleted ? `Group ${groupName} deleted.` : `Group ${groupName} not deleted.` });
        } else {
          groupDeleted = "kept";
        }
      }
      const then = f.undo.then;
      f.undo = { state: "done", summary: undoSummary(outcomes, { groupDeleted, groupName }) };
      if (then) then();
      else this._renderGroupFlow();
    }
    /** Group binding didn't work: bind each device directly instead. */
    _flowSwitchToDirect() {
      const f = this._flow;
      if (!f) return;
      f.mode = "direct";
      f.modeTouched = true;
      f.result = null;
      f.test = null;
      f.items = [];
      f.undo = null;
      f.log.push({ state: "info", text: "Switching to binding each device directly." });
      f.step = "run";
      this._flowStartBinds();
    }
    _flowReport() {
      const f = this._flow;
      const src = this._flowSource();
      return buildBehaviourReport({
        manufacturer: src.manufacturer,
        model: src.model,
        firmware: this._flowFirmware(),
        mode: f.mode,
        endpoint: Number(f.endpoint),
        clusters: [...f.clustersChosen],
        targetCount: this._flowTargets().length,
        result: f.result,
        cardVersion: CARD_VERSION
      });
    }
    _flowShareKey() {
      return `zbm:flow-shared:${this._flowSlugKey()}|${firmwareKey2(this._flowFirmware())}|${this._flowBehaviour()}`;
    }
    _flowShareUrl(report) {
      const title = `[Behaviour Report] ${report.manufacturer || "Unknown"} ${report.model || "Unknown"}: ${report.behaviour === "group_binding" ? "group binding" : "direct binding"} ${RESULT_TEXT[report.result] || report.result}`;
      const body = 'Shared from ZHA Bindings Manager\'s "Set up what this controls" flow.\n\n```json\n' + JSON.stringify(report, null, 2) + "\n```";
      return `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent("behaviour-report")}`;
    }
    _flowWire() {
      const f = this._flow;
      const on = (sel, ev, fn) => {
        const el = this._q(sel);
        if (el) el.addEventListener(ev, fn);
      };
      this._qa("#flow-cancel").forEach((b) => b.addEventListener("click", () => {
        this._flow = null;
        this._closeDialog();
      }));
      on("#flow-advanced", "click", () => {
        const src = this._flowSource();
        const g = f.startGroupId != null ? this._groups.find((x) => Number(x.group_id) === f.startGroupId) : null;
        this._flow = null;
        this._closeDialog();
        this._jumpToAdvancedBind(src, g ? { kind: "group", group: g } : null);
      });
      on("#flow-ep", "change", (e) => {
        f.endpoint = Number(e.target.value);
        this._flowRefreshCandidates();
        this._renderGroupFlow();
      });
      on("#flow-start-group", "change", (e) => {
        if (e.target.value === "") f.startGroupId = null;
        else this._flowSelectGroup(e.target.value);
        this._renderGroupFlow();
      });
      this._qa('input[name="flow-group-choice"]').forEach(
        (r) => r.addEventListener("change", () => {
          f.groupChoice = r.value;
          if (r.value === "new") f.startGroupId = null;
          this._renderGroupFlow();
        })
      );
      this._qa("[data-flow-target]").forEach(
        (cb) => cb.addEventListener("change", () => {
          if (cb.checked) f.selected.add(cb.dataset.flowTarget);
          else f.selected.delete(cb.dataset.flowTarget);
          this._flowAutoMode();
          const list2 = this._q(".flow-targets");
          const bodyEl = this._q("#dialog-body");
          const listTop = list2 ? list2.scrollTop : 0;
          const bodyTop = bodyEl ? bodyEl.scrollTop : 0;
          this._renderGroupFlow();
          const list22 = this._q(".flow-targets");
          if (list22) list22.scrollTop = listTop;
          const body2 = this._q("#dialog-body");
          if (body2) body2.scrollTop = bodyTop;
        })
      );
      on("#flow-next", "click", () => {
        f.step = "plan";
        f.clustersChosen = null;
        this._renderGroupFlow();
        if (f.behaviourDoc === void 0) this._flowLoadKnown();
      });
      on("#flow-back-remote", "click", () => {
        const ieee = f.sourceIeee;
        this._openGroupFlowPickRemote().then(() => {
          if (this._flow && this._flow.step === "remote") {
            this._flow.sourceIeee = ieee;
            this._renderGroupFlow();
          }
        });
      });
      on("#flow-back", "click", () => {
        f.step = "pick";
        this._renderGroupFlow();
      });
      this._qa('input[name="flow-mode"]').forEach(
        (r) => r.addEventListener("change", () => {
          f.mode = r.value;
          f.modeTouched = true;
          this._renderGroupFlow();
        })
      );
      on("#flow-group-name", "input", (e) => {
        f.groupName = e.target.value;
        const note = this._q("#flow-group-note");
        if (note) note.textContent = this._flowGroupNote();
      });
      this._qa("[data-flow-cluster]").forEach(
        (cb) => cb.addEventListener("change", () => {
          const id = Number(cb.dataset.flowCluster);
          if (cb.checked) f.clustersChosen.add(id);
          else f.clustersChosen.delete(id);
          this._renderGroupFlow();
        })
      );
      const pit = this._q(".flow-pitfalls");
      if (pit) pit.addEventListener("toggle", () => {
        try {
          localStorage.setItem("zbm:flow-pitfalls-seen", "1");
        } catch (e) {
        }
      });
      on("#flow-run", "click", () => this._flowRun());
      on("#flow-bind-now", "click", () => this._flowBind());
      on("#flow-check", "click", () => this._flowCheckAgain());
      on("#flow-skip-check", "click", () => {
        f.skippedCheck = true;
        f.verifying = false;
        f.unconfirmed = false;
        f.log = f.log.filter((l) => l.state !== "wait");
        f.log.push({ state: "info", text: "Check skipped: testing with the buttons instead." });
        f.step = "test";
        this._renderGroupFlow();
      });
      this._qa("[data-flow-test]").forEach((b) => b.addEventListener("click", () => this._flowAnswerTest(b.dataset.flowTest)));
      on("#flow-undo", "click", () => this._flowUndoStart());
      on("#flow-undo-now", "click", () => this._flowUndoRun());
      on("#flow-direct", "click", () => {
        if (undoPlan(f.items).unbind.length) this._flowUndoStart(() => this._flowSwitchToDirect());
        else this._flowSwitchToDirect();
      });
      on("#flow-share", "click", () => {
        try {
          localStorage.setItem(this._flowShareKey(), "1");
        } catch (e) {
        }
      });
    }
    _flowLog(state, text) {
      this._flow.log.push({ state, text });
      this._renderGroupFlow();
    }
    async _flowRun() {
      const f = this._flow;
      f.step = "run";
      f.log = [];
      f.items = [];
      const targets = this._flowTargets();
      if (f.mode === "group") {
        const ok = await this._flowEnsureGroup(targets);
        if (!ok) {
          f.log.push({ state: "fail", text: "Stopped. Nothing was bound." });
          f.step = "stopped";
          this._renderGroupFlow();
          return;
        }
      }
      this._flowStartBinds();
    }
    /** Creates or reuses the group and makes sure the lights are in it.
     *  Returns false (after logging why) if that didn't work. */
    async _flowEnsureGroup(targets) {
      const f = this._flow;
      const chosen = f.startGroupId != null ? this._groups.find((g) => Number(g.group_id) === f.startGroupId) : null;
      const match = chosen ? null : findMatchingGroup(this._groups, targets, this._coordinatorIeee());
      try {
        if (match) {
          f.groupId = Number(match.group_id);
          this._flowLog("ok", `Using group ${match.name}, which already has these devices.`);
          return true;
        }
        const start = f.startGroupId != null ? this._groups.find((g) => Number(g.group_id) === f.startGroupId) : null;
        if (start) {
          f.groupId = Number(start.group_id);
          const add = missingMembers(start, targets);
          if (add.length) {
            this._flowLog("wait", `Adding ${add.map((t) => t.name).join(", ")} to ${start.name}\u2026`);
            await this._api.addGroupMembers(f.groupId, add);
          }
        } else {
          const name = (f.groupName || "").trim() || suggestGroupName(null, this._deviceLabel(this._flowSource()));
          this._flowLog("wait", `Creating group ${name} with ${targets.length} device${targets.length === 1 ? "" : "s"}\u2026`);
          const res = await this._api.createGroup(name, targets);
          f.groupId = res && res.group_id != null ? Number(res.group_id) : null;
          f.createdName = name;
          f.createdGroup = true;
        }
      } catch (err) {
        f.log = f.log.filter((l) => l.state !== "wait");
        this._flowLog("fail", `ZHA refused the group change: ${err.message || err.code || String(err)}`);
        return false;
      }
      await this._reloadDevices({ quiet: true });
      if (f.groupId == null && f.createdName) {
        const g = [...this._groups].reverse().find((x) => x.name === f.createdName);
        f.groupId = g ? Number(g.group_id) : null;
      }
      const group = this._groups.find((g) => Number(g.group_id) === f.groupId);
      f.log = f.log.filter((l) => l.state !== "wait");
      if (!group) {
        this._flowLog("fail", "The group was requested, but ZHA doesn't list it.");
        return false;
      }
      const stillMissing = missingMembers(group, targets);
      if (stillMissing.length) {
        this._flowLog("warn", `${group.name} is ready, but ZHA doesn't list ${stillMissing.map((t) => t.name).join(", ")} as a member. Those devices won't respond.`);
      } else {
        this._flowLog("ok", `${group.name} has all ${targets.length} device${targets.length === 1 ? "" : "s"} (ID ${group.group_id}).`);
      }
      return true;
    }
    _flowStartBinds() {
      const f = this._flow;
      if (this._isBatteryDevice(this._flowSource())) {
        f.awaitWake = true;
        this._renderGroupFlow();
      } else {
        this._flowBind();
      }
    }
    /** Binds every chosen cluster (to the group, or to each light), then reads
     *  the remote's binding table once to check them all. */
    async _flowBind() {
      const f = this._flow;
      f.awaitWake = false;
      const src = this._flowSource();
      const ep = Number(f.endpoint);
      const targets = this._flowTargets();
      const clusters = [...f.clustersChosen];
      f.items = [];
      for (const c of clusters) {
        if (f.mode === "group") {
          f.items.push({ clusterId: c, target: { isGroup: true, groupId: f.groupId }, label: `${clusterName(c)} \u2192 ${this._groupName(f.groupId)}` });
        } else {
          targets.filter((t) => t.clusters.includes(c)).forEach(
            (t) => f.items.push({ clusterId: c, target: { isGroup: false, ieee: t.ieee, endpoint: t.endpoint }, label: `${clusterName(c)} \u2192 ${t.name}` })
          );
        }
      }
      f.items.forEach((item) => {
        item.existedBefore = this._bindingPresent(src.ieee, ep, item.clusterId, item.target);
      });
      this._flowLog("wait", `Binding ${f.items.length} item${f.items.length === 1 ? "" : "s"}\u2026`);
      for (const item of f.items) {
        try {
          if (item.target.isGroup) await this._api.bindGroup(src.ieee, item.target.groupId, [item.clusterId], { endpoint: ep });
          else await this._api.bindIeee(src.ieee, item.target.ieee, [item.clusterId], { endpoint: ep, dstEndpoint: item.target.endpoint });
        } catch (err) {
          console.warn("[ZHA Bindings Manager] bind call raised, verifying against rescan anyway", err);
        }
      }
      await this._flowVerify();
    }
    async _flowVerify() {
      const f = this._flow;
      const src = this._flowSource();
      f.verifying = true;
      f.log = f.log.filter((l) => l.state !== "wait");
      this._flowLog("wait", `Checking that ${this._deviceLabel(src)} stored the bindings\u2026`);
      this._renderGroupFlow();
      const scan = await this._scanBindings([src.ieee], { tries: 1 });
      if (!this._flow || this._flow !== f) return;
      f.verifying = false;
      if (f.skippedCheck) {
        f.items.forEach((item) => {
          item.outcome = this._settleChange(
            "bind",
            { sourceIeee: src.ieee, sourceEndpoint: Number(f.endpoint), clusterId: item.clusterId, target: item.target },
            scan
          ).outcome;
        });
        return;
      }
      f.items.forEach((item) => {
        const res = this._settleChange(
          "bind",
          { sourceIeee: src.ieee, sourceEndpoint: Number(f.endpoint), clusterId: item.clusterId, target: item.target },
          scan
        );
        item.outcome = res.outcome;
      });
      f.log = f.log.filter((l) => l.state !== "wait");
      const word = { confirmed: ["ok", "confirmed"], unconfirmed: ["warn", "not confirmed yet"], failed: ["fail", "not accepted"] };
      f.items.forEach((item) => {
        const [state, text] = word[item.outcome];
        f.log.push({ state, text: `${item.label}: ${text}` });
      });
      const outcome = flowResult(f.items.map((i) => i.outcome), null);
      f.unconfirmed = outcome === "unconfirmed";
      if (outcome === "rejected") {
        f.result = "rejected";
        f.step = "done";
        await this._flowCheckDb();
      } else if (outcome === "pending_test") {
        f.step = "test";
      }
      this._renderGroupFlow();
    }
    async _flowCheckAgain() {
      const f = this._flow;
      f.skippedCheck = false;
      this._flowLog("wait", "Checking again\u2026");
      f.log = f.log.filter((l) => !/: (confirmed|not confirmed yet|not accepted)$/.test(l.text));
      await this._flowVerify();
    }
    async _flowAnswerTest(answer) {
      const f = this._flow;
      const outcomes = f.items.map((i) => f.skippedCheck && answer !== "none" && i.outcome !== "failed" ? "confirmed" : i.outcome || "unconfirmed");
      if (f.skippedCheck && answer === "none" && flowResult(outcomes, answer) === "unconfirmed") {
        f.log.push({ state: "warn", text: "Button test: no devices responded, and the bindings aren't confirmed yet." });
        f.step = "run";
        f.unconfirmed = true;
        f.skippedCheck = false;
        this._renderGroupFlow();
        return;
      }
      f.test = answer;
      f.result = flowResult(outcomes, answer);
      f.log.push({ state: "info", text: `Button test: ${answer === "all" ? "all devices responded" : answer === "some" ? "some devices responded" : "no devices responded"}.` });
      f.step = "done";
      await this._flowCheckDb();
      this._renderGroupFlow();
    }
    /** Whether the remote's model is in the capability database at all, so
     *  the result page can also ask for a scan. */
    async _flowCheckDb() {
      try {
        const index = await fetchCapabilityIndex();
        this._flow.notInDb = !matchLocalDevices([this._flowSource()], index).length;
      } catch (e) {
        this._flow.notInDb = false;
      }
    }
    _closeDialog() {
      const hadFlow = !!this._flow;
      this._flow = null;
      this._q("#dialog").classList.remove("open");
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.remove("wide");
      this._explodedDeviceIeee = null;
      if (hadFlow || ["groups", "graph", "table", "devices"].includes(this._view)) this._render();
    }
    // -------------------------------------------------------------------
    // -------------------------------------------------------------------
    // Device drawer (1.4.0). Clicking a device anywhere (Devices tab, Map,
    // Bindings table, ?device= link) opens this side panel instead of the
    // old "Explode" dialog. It shows what the device controls and what
    // controls it, and gathers the per-device actions. "Show endpoints…"
    // opens the per-endpoint dialog (the old exploded view) on top.
    // -------------------------------------------------------------------
    _openDeviceDrawer(d) {
      if (!d) return;
      this._drawerIeee = d.ieee;
      this._drawerShareOpen = false;
      this._drawerRouteOpen = false;
      this._renderDrawer();
      if (this._experimental) this._activityLoad();
      const el = this._q("#drawer");
      this._wireDrawerSwipe();
      if (el) {
        el.classList.add("open");
        el.setAttribute("aria-hidden", "false");
      }
      const id = normIeee(d.ieee);
      const groupIds = new Set(
        this._groups.filter((g) => (g.members || []).some((m) => m.device && normIeee(m.device.ieee) === id)).map((g) => Number(g.group_id))
      );
      const sources = /* @__PURE__ */ new Set([d.ieee]);
      for (const b of this._rawBindings()) {
        if (!b.isGroup && normIeee(b.targetIeee) === id || b.isGroup && groupIds.has(Number(b.groupId))) sources.add(b.sourceIeee);
      }
      const missing = [...sources].filter((ieee) => !this._clusterCache.get(ieee));
      if (missing.length) {
        Promise.all(missing.map((ieee) => this._ensureClusters(ieee).catch(() => {
        }))).then(
          () => normIeee(this._drawerIeee || "") === id && this._renderDrawer()
        );
      }
    }
    /** Swipe right on the side panel to close it (1.5.0b6, for phones where
     *  the ✕ can sit under the app's header). Wired once. */
    _wireDrawerSwipe() {
      const el = this._q("#drawer");
      if (!el || el.dataset.swipe) return;
      el.dataset.swipe = "1";
      let start = null;
      el.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length !== 1) return;
          start = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, horizontal: null };
        },
        { passive: true }
      );
      el.addEventListener(
        "touchmove",
        (e) => {
          if (!start || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - start.x;
          const dy = e.touches[0].clientY - start.y;
          if (start.horizontal === null && Math.hypot(dx, dy) > 8) start.horizontal = Math.abs(dx) > Math.abs(dy) && dx > 0;
          if (!start.horizontal) return;
          start.dx = Math.max(0, dx);
          el.style.transition = "none";
          el.style.transform = `translateX(${start.dx}px)`;
        },
        { passive: true }
      );
      const end = () => {
        if (!start) return;
        const close = start.horizontal && start.dx > Math.min(100, el.offsetWidth * 0.25);
        el.style.transition = "";
        el.style.transform = "";
        start = null;
        if (close) this._closeDrawer();
      };
      el.addEventListener("touchend", end);
      el.addEventListener("touchcancel", end);
    }
    _closeDrawer() {
      this._drawerIeee = null;
      const el = this._q("#drawer");
      if (el) {
        el.classList.remove("open");
        el.setAttribute("aria-hidden", "true");
        const body = this._q("#drawer-body");
        if (body) setTimeout(() => !this._drawerIeee && (body.innerHTML = ""), 250);
      }
    }
    /** Re-renders the drawer if it's open (after scans, device reloads…). */
    _refreshDrawer() {
      if (this._drawerIeee) this._renderDrawer();
    }
    _drawerRelations(ieee) {
      const id = normIeee(ieee);
      const coord = normIeee(this._coordinatorIeee() || "");
      const health = this._computeHealthMap();
      const controls = /* @__PURE__ */ new Map();
      const controlledBy = /* @__PURE__ */ new Map();
      const reportsTo = /* @__PURE__ */ new Map();
      let coordinatorClusters = 0;
      const isReporting = (b) => {
        const cls = this._classifyBinding(b);
        return cls === "reporting" || cls === "unknown" && Number(b.clusterId) === 0;
      };
      const isManufacturer = (b) => this._classifyBinding(b) === "manufacturer";
      const problems = [];
      const add = (map, key, entry, cluster) => {
        if (!map.has(key)) map.set(key, { ...entry, clusters: /* @__PURE__ */ new Set() });
        map.get(key).clusters.add(cluster);
      };
      for (const b of this._rawBindings()) {
        const h = health.get(b.id);
        const mine = normIeee(b.sourceIeee) === id || !b.isGroup && normIeee(b.targetIeee) === id;
        if (mine && h && (h.level === "error" || h.level === "warning")) problems.push(h);
        if (isManufacturer(b)) continue;
        if (normIeee(b.sourceIeee) === id && isReporting(b)) {
          if (normIeee(b.targetIeee || "") === coord) continue;
          const key = b.isGroup ? `g:${b.groupId}` : `d:${normIeee(b.targetIeee)}`;
          const t = b.isGroup ? null : this._devices.find((x) => normIeee(x.ieee) === normIeee(b.targetIeee));
          add(reportsTo, key, { name: b.isGroup ? this._groupName(b.groupId) : t ? this._deviceLabel(t) : b.targetIeee }, b.clusterId);
        } else if (normIeee(b.sourceIeee) === id) {
          if (b.isGroup) add(controls, `g:${b.groupId}`, { kind: "group", groupId: b.groupId, name: this._groupName(b.groupId) }, b.clusterId);
          else if (normIeee(b.targetIeee) === coord) coordinatorClusters++;
          else {
            const t = this._devices.find((x) => normIeee(x.ieee) === normIeee(b.targetIeee));
            add(controls, `d:${normIeee(b.targetIeee)}`, { kind: "device", ieee: b.targetIeee, name: t ? this._deviceLabel(t) : b.targetIeee, missing: !t }, b.clusterId);
          }
        } else if (!b.isGroup && normIeee(b.targetIeee) === id && !isReporting(b)) {
          const src = this._devices.find((x) => normIeee(x.ieee) === normIeee(b.sourceIeee));
          add(controlledBy, `d:${normIeee(b.sourceIeee)}`, { kind: "device", ieee: b.sourceIeee, name: src ? this._deviceLabel(src) : b.sourceIeee, missing: !src }, b.clusterId);
        }
      }
      const memberOf = this._groups.filter((g) => (g.members || []).some((m) => m.device && normIeee(m.device.ieee) === id));
      for (const g of memberOf) {
        for (const b of this._rawBindings()) {
          if (b.isGroup && Number(b.groupId) === Number(g.group_id) && normIeee(b.sourceIeee) !== id && !isReporting(b) && !isManufacturer(b)) {
            const src = this._devices.find((x) => normIeee(x.ieee) === normIeee(b.sourceIeee));
            add(controlledBy, `d:${normIeee(b.sourceIeee)}`, { kind: "device", ieee: b.sourceIeee, name: src ? this._deviceLabel(src) : b.sourceIeee, missing: !src, via: g.name }, b.clusterId);
          }
        }
      }
      const seen = /* @__PURE__ */ new Set();
      const uniqueProblems = problems.filter((p) => {
        const k = `${p.code}|${p.message}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return {
        controls: [...controls.values()],
        controlledBy: [...controlledBy.values()],
        reportsTo: [...reportsTo.values()],
        coordinatorClusters,
        memberOf,
        problems: uniqueProblems
      };
    }
    _drawerRelListHtml(list2, emptyText) {
      if (!list2.length) return `<p class="muted drawer-empty">${escapeHtml(emptyText)}</p>`;
      return `<ul class="drawer-rel">${list2.sort((a, b) => a.name.localeCompare(b.name)).map((r) => {
        const clusters = [...r.clusters].map(clusterName).join(", ");
        const name = r.kind === "device" && !r.missing ? `<a href="#" class="src-link drawer-dev-link" data-ieee="${escapeHtml(r.ieee)}">${escapeHtml(r.name)}</a>` : `<span>${r.kind === "group" ? "\u{1F465} " : ""}${escapeHtml(r.name)}${r.missing ? " (not in ZHA)" : ""}</span>`;
        const via = r.via ? ` <span class="muted">via group ${escapeHtml(r.via)}</span>` : "";
        return `<li>${name}${via}<span class="muted drawer-clusters">${escapeHtml(clusters)}</span></li>`;
      }).join("")}</ul>`;
    }
    /** 1.5.0: whether this model is in the community capability database.
     *  Returns HTML (escaped here). Loads the index once if it isn't yet. */
    _drawerCommunityStatus(d) {
      if (!d.manufacturer && !d.model) return `<span class="muted">Unknown model</span>`;
      if (!this._capExpIndex) {
        if (this._capExpError) return `<span class="muted">Couldn't load it</span>`;
        if (!this._capExpLoading) this._capExpLoadIndex();
        return `<span class="muted">Checking\u2026</span>`;
      }
      const m = matchLocalDevices([d], this._capExpIndex)[0];
      if (!m) {
        return `<span class="drawer-db-missing">Not in it yet.</span> <a href="#" class="src-link" id="drawer-db-share">Check and share capabilities</a> <span class="muted">to help the next person with this model.</span>`;
      }
      const n = m.entries.length;
      return `In it <span class="muted">(${n} firmware observation${n === 1 ? "" : "s"})</span>`;
    }
    _renderDrawer() {
      const d = this._devices.find((x) => normIeee(x.ieee) === normIeee(this._drawerIeee || ""));
      const body = this._q("#drawer-body");
      if (!body) return;
      if (!d) {
        this._closeDrawer();
        return;
      }
      const keepScroll = body.scrollTop;
      requestAnimationFrame(() => {
        if (this._drawerIeee === d.ieee && body.scrollTop !== keepScroll) body.scrollTop = keepScroll;
      });
      this._q("#drawer-title").textContent = this._deviceLabel(d);
      const rel = this._drawerRelations(d.ieee);
      this._ensureZ2mModels();
      const imgUrl = this._showDevicePhotos ? this._deviceImageUrl(d) : null;
      const photo = imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" class="drawer-photo" onerror="this.style.display='none'">` : "";
      const tags = this._deviceTypeTags(d);
      const reg = this._haDeviceRegistryEntry(d.ieee);
      const facts = [
        ["Area", this._areaName(d.area_id)],
        ["Model", [d.manufacturer, d.model].filter(Boolean).join(" ") || "Unknown"],
        reg && reg.sw_version ? ["Firmware", reg.sw_version] : null,
        ["Power", d.power_source || "Unknown"],
        ["Bindings read", this._lastScanCellInfo(d).html.replace(/<button[\s\S]*?<\/button>/, "")],
        ["Community database", this._drawerCommunityStatus(d)],
        this._drawerActivityText(d) != null ? ["Messages to Home Assistant", this._drawerActivityText(d)] : null,
        d.manufacturer || d.model ? ["How it behaves", this._drawerAnswersFact(d)] : null,
        this._drawerAddressFact(d) ? ["Network address", this._drawerAddressFact(d)] : null
      ].filter(Boolean);
      const battery = this._isBatteryDevice(d);
      const haUrl = deviceHaUrl(d);
      const problems = rel.problems.length ? `<div class="drawer-section drawer-problems"><div class="drawer-section-title">Needs attention</div><ul>${rel.problems.slice(0, 5).map((p) => `<li class="health-${escapeHtml(p.level)}">${escapeHtml(p.message)}</li>`).join("")}</ul><a href="#" class="src-link" id="drawer-problems-link">See them in the Bindings tab</a></div>` : "";
      const isController = controllerEndpoints(this._clusterCache.get(d.ieee)).length > 0;
      const coordNote = rel.coordinatorClusters && isController ? `<p class="hint">Also bound to the coordinator (${rel.coordinatorClusters} cluster${rel.coordinatorClusters === 1 ? "" : "s"}), so Home Assistant sees its button presses.</p>` : "";
      const share = this._drawerShareOpen ? `<div class="drawer-share">
          <p>Sharing a capability scan tells the next person with this model which commands it really supports. Nothing is sent
            automatically: you review it and submit it as a GitHub issue.</p>
          <ol>
            ${battery ? `<li><strong>Wake it:</strong> ${escapeHtml(this._deviceLabel(d))} runs on battery, so press a button on it just before you start, and again if an endpoint times out.</li>` : ""}
            <li><strong>Check:</strong> click Start. The Endpoints and clusters view opens and asks each endpoint which commands it supports, one after another. This can take a minute or two.</li>
            <li><strong>Share:</strong> when the checks are done, click <em>Share scan to community database</em> at the bottom of that view. It opens a prefilled GitHub issue (model, firmware and clusters only: no names or addresses).</li>
          </ol>
          <div class="dialog-actions"><button class="btn btn-primary btn-small" id="drawer-share-start">Start</button><button class="btn btn-small" id="drawer-share-cancel">Cancel</button></div>
        </div>` : "";
      body.innerHTML = `
      <div class="drawer-head">
        ${photo}
        <div>
          ${tags.length ? `<div class="drawer-tags">${tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
          <table class="detail-table drawer-facts">${facts.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${k === "Bindings read" || k === "Community database" || k === "How it behaves" || k === "Network address" ? v : escapeHtml(String(v))}</td></tr>`).join("")}</table>
        </div>
      </div>
      ${problems}
      <div class="drawer-section">
        <div class="drawer-section-title">Controls</div>
        ${this._drawerRelListHtml(rel.controls, "Nothing: it isn't bound to another device or group.")}
        ${coordNote}
        ${rel.reportsTo.length ? `<p class="hint">Reports its own state to ${rel.reportsTo.map((r) => `${escapeHtml(r.name)} (${escapeHtml([...r.clusters].map(clusterName).join(", "))})`).join(", ")}. That's not control, so it isn't listed above.</p>` : ""}
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">Controlled by</div>
        ${this._drawerRelListHtml(rel.controlledBy, "Nothing is bound to it.")}
        ${rel.memberOf.length ? `<p class="hint">Member of ${rel.memberOf.map((g) => escapeHtml(g.name)).join(", ")}.</p>` : ""}
      </div>
      ${this._drawerLostHtml(d, rel)}
      ${this._drawerAnswersHtml(d)}
      ${this._drawerMeshHtml(d)}
      <div class="drawer-section drawer-actions">
        <div class="drawer-section-title">Actions</div>
        ${isController ? `<button class="btn btn-primary" id="drawer-control-lights" title="Choose the lights, blinds or other devices this remote or switch controls. The card binds them, directly or through a group, and checks it works.">Set up what this controls\u2026</button>` : ""}
        <button class="btn" id="drawer-show-bindings" title="Bindings tab, filtered to this device (what it controls and what controls it)">Show its bindings</button>
        <button class="btn" id="drawer-rescan" title="Read this device's binding table again">Rescan bindings</button>
        <button class="btn" id="drawer-share" title="Check which commands each endpoint supports and share it with the community database">Check and share capabilities\u2026</button>
        ${share}
        ${this._experimental && rel.controls.length ? `<button class="btn" id="drawer-route" title="Experimental: the likely path each of its bindings takes through the mesh, and the weakest link">Check route\u2026</button>${this._drawerRouteHtml(d, rel)}` : ""}
        <button class="btn" id="drawer-endpoints" title="Per-endpoint layout: clusters, bindings and supported commands">Show endpoints\u2026</button>
        <button class="btn" id="drawer-replace" title="Swapping this device for another one: copies its bindings and groups to the new device, after checking it can do the same job">Replace this device\u2026</button>
        ${haUrl ? `<a class="btn" href="${escapeHtml(haUrl)}" target="_blank" rel="noopener" title="Opens this device's page in Home Assistant, in a new tab">Open in Home Assistant</a>` : ""}
      </div>`;
      const on = (sel, fn) => {
        const el = this._q(sel);
        if (el) el.addEventListener("click", fn);
      };
      this._qa("#drawer-body .drawer-dev-link").forEach(
        (a) => a.addEventListener("click", (e) => {
          e.preventDefault();
          this._openDeviceDrawer(this._devices.find((x) => x.ieee === a.dataset.ieee));
        })
      );
      on("#drawer-control-lights", () => this._openGroupFlow(d));
      on("#drawer-replace", () => this._openReplace({ ieee: d.ieee }));
      const showBindings = (e) => {
        if (e) e.preventDefault();
        this._setTableDeviceFilter(d.ieee);
        this._switchView("table");
        this._closeDrawer();
      };
      on("#drawer-show-bindings", showBindings);
      on("#drawer-problems-link", showBindings);
      on("#drawer-lost-put-back", () => this._lostPutBack(d.ieee));
      const evLink = this._q("#drawer-evidence-link");
      if (evLink)
        evLink.addEventListener("click", (e) => {
          e.preventDefault();
          this._openEvidence(false);
        });
      this._wireDrawerAnswers(d);
      const lostForget = this._q("#drawer-lost-forget");
      if (lostForget)
        lostForget.addEventListener("click", (e) => {
          e.preventDefault();
          this._lostForget(d.ieee, null);
        });
      const lostFallback = this._q("#drawer-lost-fallback");
      if (lostFallback)
        lostFallback.addEventListener(
          "change",
          () => this._lostAction("Change setting", () => this._api.watchFallback(d.ieee, lostFallback.checked))
        );
      const lostPolicy = this._q("#drawer-lost-policy");
      if (lostPolicy)
        lostPolicy.addEventListener(
          "change",
          () => this._lostAction("Change setting", () => this._api.watchPolicy(d.ieee, lostPolicy.value))
        );
      on("#drawer-rescan", async () => {
        const btn = this._q("#drawer-rescan");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Rescanning\u2026";
        }
        try {
          await this._rescanDeviceFull(d.ieee, { tries: this._retryCount });
        } finally {
          this._refreshDrawer();
        }
      });
      on("#drawer-share", () => {
        this._drawerShareOpen = !this._drawerShareOpen;
        this._renderDrawer();
      });
      const dbShare = this._q("#drawer-db-share");
      if (dbShare)
        dbShare.addEventListener("click", (e) => {
          e.preventDefault();
          this._drawerShareOpen = true;
          this._renderDrawer();
          const box = this._q("#drawer-body .drawer-share");
          if (box && box.scrollIntoView) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      on("#drawer-share-cancel", () => {
        this._drawerShareOpen = false;
        this._renderDrawer();
      });
      on("#drawer-share-start", () => {
        this._drawerShareOpen = false;
        this._renderDrawer();
        this._openDeviceExplodedView(d, { checkAll: true });
      });
      on("#drawer-endpoints", () => this._openDeviceExplodedView(d));
      on("#drawer-mesh-read", () => this._meshReadOne(d.ieee));
      on("#drawer-mesh-read-parent", (e) => this._meshReadOne(e.currentTarget.dataset.parent));
      on("#drawer-mesh-scan", () => {
        this._switchView("mesh");
        this._meshScan();
      });
      on("#drawer-route", () => {
        this._drawerRouteOpen = !this._drawerRouteOpen;
        this._renderDrawer();
      });
      this._qa("#drawer-body [data-route-map]").forEach(
        (b) => b.addEventListener("click", () => {
          this._mapRoute = { sourceIeee: d.ieee, targetIeee: b.dataset.routeMap };
          this._closeDrawer();
          if (this._view !== "graph") this._switchView("graph");
          else this._renderGraph();
        })
      );
      on("#drawer-route-close", () => {
        this._drawerRouteOpen = false;
        this._renderDrawer();
      });
      const scanFromDrawer = () => {
        this._switchView("mesh");
        this._meshScan();
      };
      on("#drawer-route-scan", scanFromDrawer);
      on("#drawer-route-rescan", scanFromDrawer);
    }
    // -------------------------------------------------------------------
    // Experimental (1.5.0 local build): Network tab and route check.
    // Only shown when the integration reports experimental_features. The
    // integration reads each router's tables (mesh_read) and stores them;
    // everything below is worked out here from that snapshot (src/mesh.js).
    // -------------------------------------------------------------------
    _toggleExperimentalUi() {
      const tab = this._q && this.shadowRoot && this._q("#tab-mesh");
      if (tab) tab.style.display = this._experimental ? "" : "none";
      const hint = this._q && this.shadowRoot && this._q("#map-route-hint");
      if (hint) hint.style.display = this._experimental ? "" : "none";
      if (!this._experimental && this._view === "mesh") this._switchView("graph");
    }
    _meshRouters() {
      return this._devices.filter((d) => d.device_type === "Router" || d.device_type === "Coordinator").sort((a, b) => a.device_type === "Coordinator" ? -1 : b.device_type === "Coordinator" ? 1 : this._deviceLabel(a).localeCompare(this._deviceLabel(b)));
    }
    _meshModel() {
      if (!this._meshSnapshot) return null;
      if (!this._meshCache || this._meshCache.version !== this._meshVersion || this._meshCache.devices !== this._devices) {
        this._meshCache = { version: this._meshVersion, devices: this._devices, mesh: buildMesh(this._meshSnapshot, this._devices) };
      }
      return this._meshCache.mesh;
    }
    async _meshEnsureLoaded() {
      if (this._meshSnapshot || this._meshLoading || !this._experimental) return;
      this._meshLoading = true;
      try {
        const res = await this._api.meshGet();
        this._meshSnapshot = res && res.devices || {};
        this._meshVersion = (this._meshVersion || 0) + 1;
      } catch (err) {
        this._meshError = err && err.message || String(err);
        this._meshSnapshot = {};
      } finally {
        this._meshLoading = false;
      }
      if (this._view === "mesh") this._renderMesh();
      if (this._mapRoute && this._view === "graph") this._renderMapRoute();
      this._refreshDrawer();
    }
    async _meshScan() {
      if (this._meshScanning) return;
      const routers = this._meshRouters();
      if (!routers.length) {
        this._setStatus("error", "No routers in the device list, so there's nothing to read.");
        return;
      }
      if (!this._meshSnapshot) this._meshSnapshot = {};
      this._meshScanning = { done: 0, total: routers.length, stop: false, current: null, failed: 0 };
      this._renderMesh();
      for (const d of routers) {
        if (this._meshScanning.stop) break;
        this._meshScanning.current = this._deviceLabel(d);
        this._renderMeshProgress();
        try {
          const entry = await this._api.meshRead(d.ieee);
          this._meshSnapshot[normIeee(d.ieee)] = entry;
          if (!entry.ok) this._meshScanning.failed++;
        } catch (err) {
          this._meshScanning.failed++;
          this._meshSnapshot[normIeee(d.ieee)] = { at: (/* @__PURE__ */ new Date()).toISOString(), ok: false, error: err && err.message || String(err), routes: [], neighbours: [] };
        }
        this._meshVersion = (this._meshVersion || 0) + 1;
        this._meshScanning.done++;
        this._renderMeshProgress();
      }
      const s = this._meshScanning;
      this._meshScanning = null;
      this._setStatus(
        s.failed ? "warning" : "success",
        `Network scan ${s.stop ? "stopped" : "finished"}: ${s.done - s.failed} of ${s.total} routers answered${s.failed ? ` (${s.failed} didn't)` : ""}.`
      );
      if (this._view === "mesh") this._renderMesh();
      this._refreshDrawer();
    }
    _renderMeshProgress() {
      const el = this._q("#mesh-progress");
      const s = this._meshScanning;
      if (!el || !s) return;
      el.innerHTML = `<progress max="${s.total}" value="${s.done}"></progress>
      <span>Reading ${escapeHtml(s.current || "")} (${s.done} of ${s.total})\u2026</span>`;
    }
    _meshAgeText() {
      const times = Object.values(this._meshSnapshot || {}).map((e) => e && typeof e.at === "string" ? Date.parse(e.at) : NaN).filter((t) => !Number.isNaN(t));
      if (!times.length) return null;
      return relTime(new Date(Math.min(...times)).toISOString());
    }
    _lqiColor(level) {
      return { good: "var(--success-color, #43a047)", fair: "var(--warning-color, #ffa000)", weak: "var(--error-color, #db4437)" }[level] || "var(--disabled-text-color, #999)";
    }
    _lqiChip(lqi) {
      const level = rateLqi(lqi, this._lqiThr);
      const label = typeof lqi === "number" ? `${level} \xB7 ${lqi}` : "unknown";
      return `<span class="lqi-chip lqi-${level}">${escapeHtml(label)}</span>`;
    }
    /** Layouts the Network tab can draw on: each floor's plan (or the single
     *  plan without HA floors) with at least one placed router, and the Map. */
    _meshLayout() {
      const floors = this._haFloors();
      const routers = this._meshRouters().map((d) => normIeee(d.ieee));
      const options = [];
      if (floors.length) {
        for (const f of floors) {
          const plan = this._fpPlanFor(f.floor_id);
          const n = routers.filter((i) => plan.positions && plan.positions[i] && this._deviceFloor(i) === f.floor_id).length;
          if (plan.imageUrl && n) options.push({ value: `plan:${f.floor_id}`, label: f.name, floor: f.floor_id });
        }
      } else {
        const plan = this._fpPlanFor(null);
        const n = routers.filter((i) => plan.positions && plan.positions[i]).length;
        if (plan.imageUrl && n >= 2) options.push({ value: "plan:", label: "Floor plan", floor: null });
      }
      options.push({ value: "map", label: "Map layout", floor: null });
      const chosen = options.find((o) => o.value === this._meshLayoutChoice) || options[0];
      return { mode: chosen.value === "map" ? "map" : "plan", floor: chosen.floor, value: chosen.value, options, floors };
    }
    _meshPlanSize(layout) {
      const plan = this._fpPlanFor(layout.floor);
      if (plan.imageUrl === this._fpImageUrl && this._fpImageSize) return this._fpImageSize;
      return this._imgSize(plan.imageUrl, () => this._view === "mesh" && this._renderMesh());
    }
    _meshPos(ieee, layout) {
      if (layout.mode === "plan") {
        const size = this._meshPlanSize(layout);
        if (!size) return null;
        if (layout.floors.length && this._deviceFloor(ieee) !== layout.floor) return null;
        const plan = this._fpPlanFor(layout.floor);
        const f = plan.positions && plan.positions[ieee];
        return f ? { x: f.x * size.w, y: f.y * size.h } : null;
      }
      return this._positions[this._nodeKey(ieee)] || null;
    }
    _meshLinkTitle(l, nameOf) {
      const ha = l.heard[l.a];
      const hb = l.heard[l.b];
      const level = rateLqi(l.lqi, this._lqiThr);
      const parts = [];
      if (typeof ha === "number") parts.push(`${nameOf(l.a)} hears ${nameOf(l.b)} at ${ha}`);
      if (typeof hb === "number") parts.push(`${nameOf(l.b)} hears ${nameOf(l.a)} at ${hb}`);
      return `${nameOf(l.a)} \u2194 ${nameOf(l.b)}: ${level} ${l.lqi}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    }
    _meshLegendHtml() {
      const thr = this._lqiThr;
      const sample = (level, w, dash) => `<svg width="34" height="10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" stroke="${this._lqiColor(level)}" stroke-width="${w}" ${dash ? 'stroke-dasharray="5 3"' : ""}/></svg>`;
      return `<div class="mesh-legend">
      <span>${sample("good", 4)} good, LQI ${thr.good} or more</span>
      <span>${sample("fair", 2.5)} fair, ${thr.weak} to ${thr.good - 1}</span>
      <span>${sample("weak", 1.5, true)} weak, below ${thr.weak}: messages may be lost</span>
    </div>`;
    }
    // ---- Experimental: messages to Home Assistant (1.7.0) ----
    /** Loads activity_get, at most every 30 s unless forced. */
    async _activityLoad(force = false) {
      if (!this._experimental || this._activityLoading) return;
      if (!force && this._activityAt && Date.now() - this._activityAt < 3e4) return;
      this._activityLoading = true;
      this._renderActivity();
      try {
        this._activity = await this._api.activityGet();
        this._activityError = null;
      } catch (err) {
        this._activityError = err && (err.message || err.code) || String(err);
      }
      this._activityAt = Date.now();
      this._activityLoading = false;
      this._renderActivity();
      if (this._drawerIeee) this._renderDrawer();
    }
    _renderActivity() {
      const el = this._q("#activity-section");
      if (!el) return;
      if (!this._activity && !this._activityLoading && !this._activityError) {
        this._activityLoad();
        return;
      }
      const nameOf = (ieee) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === ieee);
        return d ? this._deviceLabel(d) : ieee;
      };
      const refresh = `<button class="btn btn-small" id="activity-refresh" ${this._activityLoading ? "disabled" : ""}>${this._activityLoading ? "Loading\u2026" : "Refresh"}</button>`;
      if (!this._activity) {
        const msg = this._activityError ? `couldn't load the counts (${escapeHtml(this._activityError)})` : "loading\u2026";
        el.innerHTML = `<div class="activity-summary-line"><strong>Messages to Home Assistant:</strong> <span class="muted">${msg}</span> ${refresh}</div>`;
        this._wireActivity();
        return;
      }
      const snap = this._activity;
      const { rows, chatty, fromCoordinator } = activityRows(snap, { coordinatorIeee: this._coordinatorIeee() });
      const since = snap.since ? new Date(snap.since) : null;
      const clusterText = (r, n = 2) => r.clusters.slice(0, n).map(([id, c]) => `${clusterLabel(Number(id))} ${c}`).join(", ");
      const alerts = [];
      if (fromCoordinator) {
        alerts.push(`<li class="mesh-tip-error"><strong>${fromCoordinator.hour} messages in the last hour claimed to come from the coordinator itself</strong> (0x0000).
        The coordinator doesn't send to itself, so a device is probably using its network address. That can confuse or flood the whole network.
        If the Network scan flags a device using 0x0000, unplug it, then reset and pair it again.</li>`);
      }
      for (const r of chatty) {
        const x = timesTypical(r);
        alerts.push(`<li class="mesh-tip-error"><strong>${escapeHtml(nameOf(r.ieee))}</strong> is sending ${r.now} messages a minute${x ? ` (${x} its usual ${r.typical})` : ""}, mostly ${escapeHtml(clusterText(r))}.
        A device this chatty can delay or drop other devices' messages. Check its reporting settings, or power it off for a minute to see if the network recovers.</li>`);
      }
      if (!snap.attached) {
        alerts.push(`<li class="mesh-tip-warning">Not counting: ZHA isn't running, or the counter couldn't attach to it yet. It retries every minute.</li>`);
      }
      const flagged = chatty.length + (fromCoordinator ? 1 : 0);
      const busiest = rows[0];
      const summary = flagged ? `<span class="activity-alert">${flagged} ${flagged === 1 ? "problem" : "problems"} found</span>` : !snap.attached ? `<span class="muted">not counting</span>` : busiest ? `nothing stands out <span class="muted">\xB7 busiest: ${escapeHtml(nameOf(busiest.ieee))}, ${busiest.now} a minute</span>` : `<span class="muted">no messages counted yet</span>`;
      const open = alerts.length > 0 || !!this._activityOpen;
      const counters = interestingCounters(snap);
      const usual = (r) => r.typical == null ? "\u2013" : r.typical;
      el.innerHTML = `<details class="activity-details" ${open ? "open" : ""}>
        <summary class="activity-summary-line"><strong>Messages to Home Assistant:</strong> ${summary} ${refresh}</summary>
        <p class="hint">Messages ZHA received from each device. Only traffic that reaches the coordinator is counted, and counts restart with Home Assistant${since ? ` (counting since ${escapeHtml(since.toLocaleString())})` : ""}. "Usual" is the typical rate since then, shown after 10 minutes.</p>
        ${alerts.length ? `<ul class="mesh-tips">${alerts.join("")}</ul>` : ""}
        ${rows.length ? `<table class="detail-table activity-table">
                <colgroup><col class="activity-col-name"><col class="activity-col-num"><col class="activity-col-num"><col class="activity-col-num"><col></colgroup>
                <thead><tr><th>Device</th><th class="num">Now /min</th><th class="num">Last hour</th><th class="num">Usual /min</th><th>Mostly</th></tr></thead>
                <tbody>${rows.slice(0, TOP_ROWS).map(
        (r) => `<tr class="${r.chatty ? "activity-chatty" : ""}"><td><a href="#" class="src-link" data-activity-ieee="${escapeHtml(r.ieee)}">${escapeHtml(nameOf(r.ieee))}</a></td>
                      <td class="num">${r.now}</td><td class="num">${r.hour}</td><td class="num">${usual(r)}</td><td class="muted">${escapeHtml(clusterText(r))}</td></tr>`
      ).join("")}</tbody>
              </table>` : ""}
        ${counters.length ? `<details class="activity-counters"><summary>Coordinator counters (${counters.length})</summary>
                <table class="detail-table">${counters.map((c) => `<tr><td>${escapeHtml(c.name)}</td><td class="num">${Number(c.value)}</td></tr>`).join("")}</table>
                <p class="hint">From the radio library; which counters exist depends on your adapter.</p></details>` : ""}
      </details>`;
      const det = el.querySelector(".activity-details");
      if (det)
        det.addEventListener("toggle", () => {
          if (!alerts.length) this._activityOpen = det.open;
        });
      this._wireActivity();
    }
    _wireActivity() {
      const btn = this._q("#activity-refresh");
      if (btn)
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._activityLoad(true);
        });
      this._qa("[data-activity-ieee]").forEach(
        (a) => a.addEventListener("click", (e) => {
          e.preventDefault();
          const d = this._devices.find((x) => normIeee(x.ieee) === a.dataset.activityIeee);
          if (d) this._openDeviceDrawer(d);
        })
      );
    }
    /** Side panel line: "X a minute now, Y over the hour". */
    _drawerActivityText(d) {
      if (!this._experimental || !this._activity) return null;
      const { rows } = activityRows(this._activity, { coordinatorIeee: this._coordinatorIeee() });
      const r = rows.find((x) => x.ieee === normIeee(d.ieee));
      if (!r) return "None in the last hour";
      return `${r.now} a minute now, ${r.hour} over the hour${r.chatty ? " (unusually high)" : ""}`;
    }
    _renderMesh() {
      const el = this._q("#view-mesh");
      if (!el) return;
      if (!this._experimental) {
        el.innerHTML = `<p class="muted">Turn on <strong>Experimental features</strong> under the ZHA Bindings Manager integration's Configure to use this tab.</p>`;
        return;
      }
      if (!this._meshSnapshot) {
        el.innerHTML = `<p class="muted">Loading the last network scan\u2026</p>`;
        this._meshEnsureLoaded();
        return;
      }
      const mesh = this._meshModel();
      const thr = this._lqiThr;
      const routers = this._meshRouters();
      const read = Object.keys(this._meshSnapshot).length;
      const age = this._meshAgeText();
      const scanning = !!this._meshScanning;
      const intro = `<div class="mesh-intro">
        <p>Link quality between your routers, read from their own neighbour and routing tables.
          Each link shows the weaker of its two directions. Good is LQI ${thr.good} or more, weak is below ${thr.weak}
          (change these under the integration's Configure). It's a snapshot: routes change, and battery devices are only seen through their parent.</p>
        <div class="mesh-toolbar">
          <button class="btn btn-primary" id="mesh-scan" ${scanning ? "disabled" : ""} title="Reads every router's tables one at a time with zha-toolkit. Takes a few seconds per router.">Scan network</button>
          ${scanning ? `<button class="btn" id="mesh-stop">Stop</button>` : ""}
          <span class="muted">${age ? `Snapshot of ${read} of ${routers.length} routers, oldest read ${escapeHtml(age)}` : "No scan yet."}</span>
          <span class="spacer"></span>
          <label class="row">Layout
            <select id="mesh-layout">${this._meshLayout().options.map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === this._meshLayout().value ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}</select></label>
          <label class="row">Show
            <select id="mesh-show">
              <option value="strongest" ${this._meshShowMode() === "strongest" ? "selected" : ""}>Strongest links</option>
              <option value="all" ${this._meshShowMode() === "all" ? "selected" : ""}>Every link heard</option>
              <option value="routes" ${this._meshShowMode() === "routes" ? "selected" : ""}>Routes my bindings use</option>
            </select></label>
          <label class="row"><input type="checkbox" id="mesh-battery" ${this._meshShowBattery !== false ? "checked" : ""}> Battery devices</label>
        </div>
        <p class="hint mesh-show-hint">${escapeHtml(this._meshShowHint())}</p>
        <div id="mesh-progress" class="mesh-progress"></div>
        ${this._meshFloorsHelpHtml()}
      </div>`;
      if (!read) {
        el.innerHTML = intro + `<div id="activity-section" class="activity-section"></div><p class="muted">Click <strong>Scan network</strong> to read the tables. Nothing on your network is changed.</p>`;
        this._wireMesh();
        this._renderActivity();
        this._renderMeshProgress();
        return;
      }
      const weakest = weakestLinks(mesh, 12).filter((l) => isRouterLike(mesh, l.a) || isRouterLike(mesh, l.b));
      const nameOf = (i) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === i);
        return d ? this._deviceLabel(d) : i;
      };
      const areaOf = (i) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === i);
        return d && d.area_id ? this._areaName(d.area_id) : "";
      };
      const tips = meshSuggestions(mesh, { thr, nameOf, areaOf, routers: routers.map((d) => normIeee(d.ieee)) });
      const failed = Object.entries(this._meshSnapshot).filter(([, e]) => e && !e.ok);
      el.innerHTML = `${intro}
      <div id="activity-section" class="activity-section"></div>
      <div class="mesh-layout">
        <div class="mesh-picture">${this._meshSvg(mesh)}
          ${this._meshSelectedLinkHtml(mesh, nameOf)}
          ${this._meshLegendHtml()}
          <div class="mesh-legend-note"><span class="muted">Thicker = stronger. Each link uses the weaker of its two directions. ${this._meshLayout().floors.length && this._meshLayout().mode === "plan" ? "\u2191 and \u2193 mark links to routers on the floor above or below; a dashed ring means the router only has usable links to other floors. " : ""}Shading: green = good, amber = fair (works fine), red = weak, based on each router's second-best link; no shading = no routers there. Tap a line for its details; zoom with the buttons, the mouse wheel or a pinch, and drag to move. Click a device to open it.${mesh.staleEntries ? ` ${mesh.staleEntries} stale neighbour entries (LQI 0, not heard recently) were ignored.` : ""}</span></div>
        </div>
        <div class="mesh-side">
          ${this._meshShowMode() === "routes" ? this._meshRoutesListHtml(mesh, nameOf) : ""}
          <div class="drawer-section-title">Suggestions</div>
          ${tips.length ? `<ul class="mesh-tips">${tips.map((t, i) => `<li class="mesh-tip-${t.level}" data-tip="${i}">${escapeHtml(t.text)}</li>`).join("")}</ul>` : `<p class="muted">Nothing stands out.</p>`}
          ${this._meshBetweenFloorsHtml(mesh, nameOf)}
          <div class="drawer-section-title">Weakest links</div>
          <table class="detail-table mesh-links">${weakest.map(
        (l) => `<tr data-link="${escapeHtml(l.a)}|${escapeHtml(l.b)}" class="${this._meshHighlight === `${l.a}|${l.b}` ? "active" : ""}"><td>${escapeHtml(nameOf(l.a))} \u2194 ${escapeHtml(nameOf(l.b))}</td><td>${this._lqiChip(l.lqi)}</td></tr>`
      ).join("")}</table>
          ${failed.length ? `<div class="drawer-section-title">Didn't answer</div><ul class="mesh-failed">${failed.map(
        ([i, e]) => `<li><span>${escapeHtml(nameOf(i))}${e.error ? ` <span class="muted">(${escapeHtml(e.error)})</span>` : ""}</span> <button class="btn btn-small" data-mesh-read="${escapeHtml(i)}" ${this._meshReading ? "disabled" : ""}>Read again</button></li>`
      ).join("")}</ul>` : ""}
        </div>
      </div>`;
      this._wireMesh();
      this._renderActivity();
      this._renderMeshProgress();
    }
    _meshSvg(mesh) {
      const layout = this._meshLayout();
      const { mode } = layout;
      const size = mode === "plan" ? this._meshPlanSize(layout) : { w: 1200, h: 840 };
      if (!size) return `<p class="muted">Loading the floor plan image\u2026</p>`;
      const W = size.w;
      const H = size.h;
      const thr = this._lqiThr;
      const routerIeees = this._meshRouters().map((d) => normIeee(d.ieee));
      const pos = (i) => this._meshPos(i, layout);
      const nameOf = (i) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === i);
        return d ? this._deviceLabel(d) : i;
      };
      const floorOf = (i) => layout.floors.length ? this._deviceFloor(i) : null;
      const levelOf = (fid) => {
        const f = layout.floors.find((x) => x.floor_id === fid);
        return f ? f.level ?? 0 : 0;
      };
      const heat = [];
      const lines = [];
      const nodes = [];
      for (const r of routerIeees) {
        const p = pos(r);
        if (!p) continue;
        const lq = [];
        for (const l of mesh.links.values()) {
          if ((l.a === r || l.b === r) && isRouterLike(mesh, l.a === r ? l.b : l.a) && typeof l.lqi === "number") lq.push(l.lqi);
        }
        lq.sort((a, b) => b - a);
        const cov = lq.length ? lq[Math.min(1, lq.length - 1)] : null;
        if (cov != null) heat.push(`<circle cx="${p.x}" cy="${p.y}" r="${W * 0.11}" fill="url(#mesh-heat-${rateLqi(cov, thr)})"/>`);
      }
      const showMode = this._meshShowMode();
      const drawn = showMode === "all" ? [...mesh.links.values()] : showMode === "strongest" ? visibleRouterLinks(mesh, thr, 3) : [];
      if (this._meshHighlight) {
        const hl = mesh.links.get(this._meshHighlight);
        if (hl && !drawn.includes(hl)) drawn.push(hl);
      }
      for (const l of drawn) {
        if (!isRouterLike(mesh, l.a) || !isRouterLike(mesh, l.b) || typeof l.lqi !== "number") continue;
        const pa = pos(l.a);
        const pb = pos(l.b);
        if (!pa || !pb) continue;
        const level = rateLqi(l.lqi, thr);
        const hi = this._meshHighlight === `${l.a}|${l.b}`;
        lines.push(
          `<g class="mesh-link" data-link="${escapeHtml(l.a)}|${escapeHtml(l.b)}"><line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${this._lqiColor(level)}" style="--sw:${(hi ? 3 : 1) * (1 + l.lqi / 255 * 3) * (W / 1200)}" stroke-opacity="${hi ? 1 : level === "weak" ? 0.9 : 0.55}" ${level === "weak" ? `stroke-dasharray="${6 * (W / 1200)} ${4 * (W / 1200)}"` : ""}/><line class="mesh-link-hit" x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" style="--sw:${16 * (W / 1200)}"><title>${escapeHtml(this._meshLinkTitle(l, nameOf))}</title></line></g>`
        );
      }
      const r0 = 11 * (W / 1200);
      const k = W / 1200;
      if (showMode === "routes") {
        const hops = /* @__PURE__ */ new Map();
        for (const r of this._meshBindingRoutes(mesh)) {
          for (const h of r.path.hops) {
            const key = `${h.from}>${h.to}`;
            if (!hops.has(key)) hops.set(key, { ...h, uses: [] });
            hops.get(key).uses.push(r.label);
          }
        }
        for (const h of hops.values()) {
          const pa = pos(h.from);
          const pb = pos(h.to);
          if (!pa || !pb) continue;
          const level = rateLqi(h.lqi, thr);
          const linkKey2 = h.from < h.to ? `${h.from}|${h.to}` : `${h.to}|${h.from}`;
          const title = `${nameOf(h.from)} \u2192 ${nameOf(h.to)}: ${level}${typeof h.lqi === "number" ? ` ${h.lqi}` : ""}
Used by: ${h.uses.join("; ")}`;
          lines.push(
            `<g class="mesh-link mesh-route" data-link="${escapeHtml(linkKey2)}"><line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${this._lqiColor(level)}" style="--sw:${(2 + Math.min(3, h.uses.length)) * k}" stroke-opacity="0.9" marker-end="url(#mesh-arrow-${level})" ${level === "weak" ? `stroke-dasharray="${6 * k} ${4 * k}"` : ""}/><line class="mesh-link-hit" x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" style="--sw:${16 * k}"><title>${escapeHtml(title)}</title></line></g>`
          );
        }
      }
      const batteryNodes = [];
      if (this._meshShowBattery !== false) {
        for (const d of this._devices) {
          if (d.device_type !== "EndDevice") continue;
          const i = normIeee(d.ieee);
          const p = pos(i);
          if (!p) continue;
          const parent = mesh.parentOf.get(i);
          const pp = parent ? pos(parent.parent) : null;
          const level = parent ? rateLqi(parent.lqi, thr) : "unknown";
          if (parent && pp && showMode !== "routes") {
            lines.push(
              `<g class="mesh-link mesh-parent-link" data-link="${escapeHtml(i < parent.parent ? `${i}|${parent.parent}` : `${parent.parent}|${i}`)}"><line x1="${p.x}" y1="${p.y}" x2="${pp.x}" y2="${pp.y}" stroke="${this._lqiColor(level)}" style="--sw:${1.2 * k}" stroke-opacity="0.8" stroke-dasharray="${2 * k} ${2 * k}"/><line class="mesh-link-hit" x1="${p.x}" y1="${p.y}" x2="${pp.x}" y2="${pp.y}" style="--sw:${12 * k}"><title>${escapeHtml(
                `${nameOf(i)} \u2192 parent ${nameOf(parent.parent)}: ${level}${typeof parent.lqi === "number" ? ` ${parent.lqi}` : ""}`
              )}</title></line></g>`
            );
          }
          const tip = parent ? `${nameOf(i)} (battery): parent ${nameOf(parent.parent)}, ${level}${typeof parent.lqi === "number" ? ` ${parent.lqi}` : ""}` : `${nameOf(i)} (battery): parent unknown. No router listed it as a child in the last scan; it may have been asleep or moved.`;
          batteryNodes.push(`<g class="mesh-node mesh-battery ${parent ? "" : "orphan"}" data-ieee="${escapeHtml(i)}" transform="translate(${p.x},${p.y})"><g class="mesh-zs">
          <circle r="${r0 * 0.5}" style="stroke:${this._lqiColor(level)}"/><title>${escapeHtml(tip)}</title>
          <text class="mesh-label mesh-battery-label" y="${r0 * 0.5 + 10 * k}" font-size="${9 * k}" text-anchor="middle">${escapeHtml(nameOf(i))}</text>
        </g></g>`);
        }
      }
      const placedLabels = [];
      const labelY = (p) => {
        const below = p.y + r0 + 13 * k;
        const clash = (y2) => placedLabels.some((q) => Math.abs(q.x - p.x) < 110 * k && Math.abs(q.y - y2) < 13 * k);
        const y = clash(below) ? p.y - r0 - 5 * k : below;
        placedLabels.push({ x: p.x, y });
        return y - p.y;
      };
      const ordered = routerIeees.filter((i) => pos(i)).sort((a, b) => pos(a).y - pos(b).y || pos(a).x - pos(b).x);
      for (const i of ordered) {
        const p = pos(i);
        if (!p) continue;
        const d = this._devices.find((x) => normIeee(x.ieee) === i);
        const isCoord = d && d.device_type === "Coordinator";
        const kids = mesh.children.get(i) || 0;
        const unread = !this._meshSnapshot[i] || !this._meshSnapshot[i].ok;
        let up = [];
        let down = [];
        let sameFloorOk = 0;
        if (mode === "plan" && layout.floor) {
          for (const l of mesh.links.values()) {
            if (l.a !== i && l.b !== i || typeof l.lqi !== "number") continue;
            const other = l.a === i ? l.b : l.a;
            if (!isRouterLike(mesh, other)) continue;
            const of = floorOf(other);
            if (of && of !== layout.floor) {
              (levelOf(of) > levelOf(layout.floor) ? up : down).push(`${levelOf(of) > levelOf(layout.floor) ? "\u2191" : "\u2193"} ${nameOf(other)} (${this._floorName(of)}): ${rateLqi(l.lqi, thr)} ${l.lqi}`);
            } else if (rateLqi(l.lqi, thr) !== "weak") sameFloorOk++;
          }
        }
        const viaCeiling = mode === "plan" && layout.floor && !sameFloorOk && up.length + down.length > 0;
        const floorBadge = up.length || down.length ? `<text class="mesh-floor-badge" x="${-r0 * 1.15}" y="${-r0 * 0.6}" text-anchor="end" font-size="${15 * (W / 1200)}">${up.length ? `\u2191${up.length}` : ""}${down.length ? `\u2193${down.length}` : ""}<title>${escapeHtml(
          [...up, ...down].join("\n")
        )}</title></text>` : "";
        nodes.push(`<g class="mesh-node" data-ieee="${escapeHtml(i)}" transform="translate(${p.x},${p.y})"><g class="mesh-zs">
        ${viaCeiling ? `<circle r="${r0 * 1.6}" class="via-ceiling"><title>${escapeHtml(`${nameOf(i)}: no usable link on this floor, only to other floors`)}</title></circle>` : ""}
        ${isCoord ? `<rect x="${-r0}" y="${-r0}" width="${2 * r0}" height="${2 * r0}" rx="${r0 / 3}"/>` : `<circle r="${r0}" class="${unread ? "unread" : ""}"/>`}
        ${floorBadge}
        ${kids && this._meshShowBattery === false ? `<text class="mesh-kids" x="${r0 * 1.1}" y="${-r0 * 0.9}" font-size="${10 * (W / 1200)}">+${kids}</text>` : ""}
        ${unread ? `<title>${escapeHtml(
          this._meshSnapshot[i] ? `${nameOf(i)}: didn't answer${this._meshSnapshot[i].error ? ` (${this._meshSnapshot[i].error})` : ""}. Open it to read it again.` : `${nameOf(i)}: not read yet. Open it to read it.`
        )}</title>` : ""}
        <text class="mesh-label" y="${labelY(p)}" font-size="${11 * (W / 1200)}" text-anchor="middle">${escapeHtml(d ? this._deviceLabel(d) : i)}${unread ? " (not read)" : ""}</text>
      </g></g>`);
      }
      const img = mode === "plan" ? `<image href="${escapeHtml(this._fpPlanFor(layout.floor).imageUrl)}" x="0" y="0" width="${W}" height="${H}" opacity="0.55"/>` : "";
      const grad = (lvl) => `<radialGradient id="mesh-heat-${lvl}"><stop offset="0" stop-color="${this._lqiColor(lvl)}" stop-opacity="0.32"/><stop offset="1" stop-color="${this._lqiColor(lvl)}" stop-opacity="0"/></radialGradient>`;
      const missingIeees = routerIeees.filter((i) => !pos(i) && (!layout.floor || floorOf(i) === layout.floor || !floorOf(i)));
      const missing = missingIeees.length;
      const missingNames = missingIeees.map((i) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === i);
        return d ? this._deviceLabel(d) : i;
      });
      this._meshViews = this._meshViews || {};
      const vk = `${layout.value}|${W}x${H}`;
      if (!this._meshViews[vk]) this._meshViews[vk] = { x: 0, y: 0, w: W, h: H, full: { w: W, h: H } };
      this._meshViewKey = vk;
      const vb = this._meshViews[vk];
      return `<div class="mesh-zoom"><button class="btn btn-small" id="mesh-zoom-out" title="Zoom out">\uFF0D</button><button class="btn btn-small" id="mesh-zoom-fit" title="Show the whole plan">Fit</button><button class="btn btn-small" id="mesh-zoom-in" title="Zoom in">\uFF0B</button></div>
      <svg class="mesh-svg" style="--mz:${vb.w / vb.full.w}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet"><defs>${grad("good")}${grad("fair")}${grad("weak")}${["good", "fair", "weak", "unknown"].map((lvl) => `<marker id="mesh-arrow-${lvl}" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="${this._lqiColor(lvl)}"/></marker>`).join("")}</defs>${img}<g>${heat.join("")}</g><g>${lines.join("")}</g><g>${batteryNodes.join("")}</g><g>${nodes.join("")}</g></svg>
      ${missing ? `<details class="mesh-unplaced muted"><summary>${missing} router${missing === 1 ? "" : "s"} not on this layout</summary>${escapeHtml(missingNames.join(", "))}. ${mode === "plan" ? `Place them on the Floor Plan tab${layout.floor ? ` (${escapeHtml(this._floorName(layout.floor))})` : ""} to include them.` : "Open the Map tab once to lay them out."} They're still part of the suggestions and route checks.</details>` : ""}`;
    }
    _meshShowMode() {
      return ["strongest", "all", "routes"].includes(this._meshShow) ? this._meshShow : "strongest";
    }
    _meshShowHint() {
      const base = "A link means two routers can hear each other. A route is the way a command actually travels; routes use only some of the links.";
      const mode = {
        strongest: " Showing each router's 3 strongest links.",
        all: " Showing every pair of routers that can hear each other, however weakly.",
        routes: " Showing the predicted route of each binding, with arrows in the direction a command travels. Group bindings are broadcast, so only the remote's hop to its parent is drawn."
      }[this._meshShowMode()];
      return base + mode;
    }
    /** Every control binding's predicted route (device targets) or parent hop
     *  (group bindings). Reporting and coordinator bindings are left out. */
    _meshBindingRoutes(mesh) {
      const coord = normIeee(this._coordinatorIeee() || "");
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const b of this._rawBindings()) {
        if (["reporting", "manufacturer"].includes(this._classifyBinding(b))) continue;
        const src = normIeee(b.sourceIeee);
        if (b.isGroup) {
          const key2 = `${src}|g${b.groupId}`;
          if (seen.has(key2)) continue;
          seen.add(key2);
          const p = mesh.parentOf.get(src);
          const hops = p ? [{ from: src, to: p.parent, lqi: p.lqi }] : [];
          out.push({ label: `${this._ieeeLabel(src, { plain: true })} \u2192 group ${this._groupName(b.groupId)}`, source: src, group: b.groupId, path: { status: p || mesh.snapshot[src] ? "ok" : "none", hops, note: null } });
          continue;
        }
        const tgt = normIeee(b.targetIeee);
        if (!tgt || tgt === coord || tgt === src) continue;
        const key = `${src}|${tgt}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ label: `${this._ieeeLabel(src, { plain: true })} \u2192 ${this._ieeeLabel(tgt, { plain: true })}`, source: src, target: tgt, path: routePath(mesh, src, tgt) });
      }
      return out;
    }
    _meshRoutesListHtml(mesh, nameOf) {
      const thr = this._lqiThr;
      const routes = this._meshBindingRoutes(mesh).map((r) => ({ ...r, verdict: pathVerdict(r.path, thr) }));
      if (!routes.length) return `<div class="drawer-section-title">Binding routes</div><p class="muted">No bindings between devices to route.</p>`;
      const rank = { weak: 0, none: 1, unknown: 2, good: 3 };
      routes.sort((a, b) => rank[a.verdict.level] - rank[b.verdict.level] || a.label.localeCompare(b.label));
      const text = (r) => r.verdict.level === "weak" ? `weak hop ${nameOf(r.verdict.weakest.from)} \u2192 ${nameOf(r.verdict.weakest.to)} (${r.verdict.weakest.lqi})` : r.verdict.level === "none" ? "no route found" : r.verdict.level === "unknown" ? "partly known" : "looks good";
      return `<div class="drawer-section-title">Binding routes</div>
      <ul class="mesh-routes">${routes.map((r) => `<li class="route-${r.verdict.level}"><strong>${escapeHtml(r.label)}</strong>: ${escapeHtml(text(r))}</li>`).join("")}</ul>`;
    }
    /** Reads one router's tables again (side panel, "Didn't answer" list). */
    async _meshReadOne(ieee) {
      if (this._meshReading || this._meshScanning) return;
      const id = normIeee(ieee);
      this._meshReading = id;
      if (this._view === "mesh") this._renderMesh();
      this._refreshDrawer();
      try {
        const entry = await this._api.meshRead(id);
        if (!this._meshSnapshot) this._meshSnapshot = {};
        this._meshSnapshot[id] = entry;
        this._meshVersion = (this._meshVersion || 0) + 1;
        this._setStatus(entry.ok ? "success" : "warning", entry.ok ? `Read ${this._ieeeLabel(id, { plain: true })}'s tables.` : `${this._ieeeLabel(id, { plain: true })} didn't answer${entry.error ? `: ${entry.error}` : ""}.`);
      } catch (err) {
        this._setStatus("error", `Couldn't read ${this._ieeeLabel(id, { plain: true })}: ${err && err.message || err}`);
      } finally {
        this._meshReading = null;
        if (this._view === "mesh") this._renderMesh();
        this._refreshDrawer();
      }
    }
    /** Network section of the side panel (experimental). */
    _drawerMeshHtml(d) {
      const html = this._drawerMeshInnerHtml(d);
      if (!html || !this._meshSnapshot) return html;
      const id = normIeee(d.ieee);
      const mesh = this._meshModel();
      const c = mesh && (mesh.conflicts || []).find((x) => x.ieees.includes(id));
      if (!c) return html;
      const hex2 = `0x${c.nwk.toString(16).padStart(4, "0")}`;
      const others = c.ieees.filter((i) => i !== id).map((i) => this._ieeeLabel(i, { plain: true }));
      const text = c.coordinator && d.device_type !== "Coordinator" ? `This device is using the coordinator's network address (${hex2}). That can flood or confuse the whole network. Unplug it, check whether the network recovers, then reset and pair it again.` : c.coordinator ? `Another device (${others.join(", ")}) is using this coordinator's network address (${hex2}).` : `Shares its network address (${hex2}) with ${others.join(", ")}.`;
      return html.replace('<div class="drawer-section-title">Network</div>', `<div class="drawer-section-title">Network</div><p class="mesh-tip-error">${escapeHtml(text)}</p>`);
    }
    _drawerMeshInnerHtml(d) {
      if (!this._experimental) return "";
      if (!this._meshSnapshot) {
        this._meshEnsureLoaded();
        return "";
      }
      const id = normIeee(d.ieee);
      const mesh = this._meshModel();
      const busy = this._meshReading === id;
      const isRouter = d.device_type === "Router" || d.device_type === "Coordinator";
      if (isRouter) {
        const e = this._meshSnapshot[id];
        const state2 = !e ? "Its routing and neighbour tables haven't been read yet." : e.ok ? `Tables read ${relTime(e.at)}: ${(e.neighbours || []).length} neighbours, ${(e.routes || []).length} routes.` : `It didn't answer when last read${e.error ? ` (${e.error})` : ""}.`;
        return `<div class="drawer-section"><div class="drawer-section-title">Network</div>
        <p class="hint">${escapeHtml(state2)}</p>
        <button class="btn btn-small" id="drawer-mesh-read" ${busy || this._meshScanning ? "disabled" : ""}>${busy ? "Reading\u2026" : "Read this router"}</button></div>`;
      }
      const p = mesh && mesh.parentOf.get(id);
      const state = p ? `Battery device: it talks through its parent ${this._ieeeLabel(p.parent, { plain: true })} (${rateLqi(p.lqi, this._lqiThr)}${typeof p.lqi === "number" ? ` ${p.lqi}` : ""}).` : "Battery device: its parent isn't known. No router listed it as a child in the last scan.";
      return `<div class="drawer-section"><div class="drawer-section-title">Network</div>
      <p class="hint">${escapeHtml(state)} A battery device keeps no tables of its own: what we know comes from its parent's table. Press a button on it to wake it, then read its parent again.</p>
      ${p ? `<button class="btn btn-small" id="drawer-mesh-read-parent" data-parent="${escapeHtml(p.parent)}" ${this._meshReading || this._meshScanning ? "disabled" : ""}>${this._meshReading === p.parent ? "Reading\u2026" : "Read its parent again"}</button>` : `<button class="btn btn-small" id="drawer-mesh-scan">Scan network</button>`}
    </div>`;
    }
    _meshSelectedLinkHtml(mesh, nameOf) {
      if (!this._meshHighlight) return "";
      const l = mesh.links.get(this._meshHighlight);
      if (!l) return "";
      const ha = l.heard[l.a];
      const hb = l.heard[l.b];
      const line = (x, y, v) => typeof v === "number" ? `<li>${escapeHtml(nameOf(x))} hears ${escapeHtml(nameOf(y))} at ${this._lqiChip(v)}</li>` : `<li class="muted">${escapeHtml(nameOf(x))} didn't report ${escapeHtml(nameOf(y))}</li>`;
      const endA = !isRouterLike(mesh, l.a);
      const endB = !isRouterLike(mesh, l.b);
      if (endA !== endB) {
        const dev = endA ? l.a : l.b;
        const router = endA ? l.b : l.a;
        const v = l.heard[router];
        return `<div class="mesh-selected">
      <div class="drawer-section-title">Selected link</div>
      <div>${escapeHtml(nameOf(dev))} \u2192 parent ${escapeHtml(nameOf(router))} ${this._lqiChip(typeof v === "number" ? v : l.lqi)}</div>
      <p class="muted">${escapeHtml(nameOf(dev))} runs on battery and talks only through its parent router. ${escapeHtml(nameOf(router))} hears it at ${typeof v === "number" ? v : "an unreported level"}. A battery device keeps no tables of its own, so only this direction is known.</p>
      <button class="btn btn-small" id="mesh-link-clear">Clear</button>
    </div>`;
      }
      return `<div class="mesh-selected">
      <div class="drawer-section-title">Selected link</div>
      <div>${escapeHtml(nameOf(l.a))} \u2194 ${escapeHtml(nameOf(l.b))} ${this._lqiChip(l.lqi)}</div>
      <ul>${line(l.a, l.b, ha)}${line(l.b, l.a, hb)}</ul>
      <p class="muted">The weaker direction counts, because a message has to get through both ways (it's acknowledged).</p>
      <button class="btn btn-small" id="mesh-link-clear">Clear</button>
    </div>`;
    }
    _meshApplyView() {
      const svg = this._q("#view-mesh .mesh-svg");
      const vb = this._meshViews && this._meshViews[this._meshViewKey];
      if (svg && vb) {
        svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
        svg.style.setProperty("--mz", String(vb.w / vb.full.w));
      }
    }
    /** Zoom by `factor` (>1 = in) around a point in plan units (default: centre). */
    _meshZoom(factor, cx, cy) {
      const vb = this._meshViews && this._meshViews[this._meshViewKey];
      if (!vb) return;
      const px = cx ?? vb.x + vb.w / 2;
      const py = cy ?? vb.y + vb.h / 2;
      const w = clamp(vb.w / factor, vb.full.w / 12, vb.full.w * 1.5);
      const h = w / vb.w * vb.h;
      vb.x = px - (px - vb.x) * w / vb.w;
      vb.y = py - (py - vb.y) * h / vb.h;
      vb.w = w;
      vb.h = h;
      this._meshApplyView();
    }
    _meshSvgPoint(svg, clientX, clientY) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }
    _wireMeshZoom() {
      const svg = this._q("#view-mesh .mesh-svg");
      if (!svg) return;
      const on = (sel, fn) => {
        const e = this._q(sel);
        if (e) e.addEventListener("click", fn);
      };
      on("#mesh-zoom-in", () => this._meshZoom(1.4));
      on("#mesh-zoom-out", () => this._meshZoom(1 / 1.4));
      on("#mesh-zoom-fit", () => {
        const vb = this._meshViews[this._meshViewKey];
        Object.assign(vb, { x: 0, y: 0, w: vb.full.w, h: vb.full.h });
        this._meshApplyView();
      });
      svg.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const p = this._meshSvgPoint(svg, e.clientX, e.clientY);
          this._meshZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
        },
        { passive: false }
      );
      const pointers = /* @__PURE__ */ new Map();
      let pan = null;
      let pinch = null;
      svg.addEventListener("pointerdown", (e) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) pan = { x: e.clientX, y: e.clientY, moved: false };
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
          pan = null;
        }
      });
      svg.addEventListener("pointermove", (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const vb = this._meshViews[this._meshViewKey];
        if (pinch && pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const mid = this._meshSvgPoint(svg, (a.x + b.x) / 2, (a.y + b.y) / 2);
          if (pinch.d > 0) this._meshZoom(d / pinch.d, mid.x, mid.y);
          pinch.d = d;
          this._meshDragged = true;
          return;
        }
        if (!pan) return;
        const dx = e.clientX - pan.x;
        const dy = e.clientY - pan.y;
        if (!pan.moved && Math.hypot(dx, dy) < 5) return;
        if (!pan.moved) {
          pan.moved = true;
          try {
            svg.setPointerCapture(e.pointerId);
          } catch (err) {
          }
        }
        const rect = svg.getBoundingClientRect();
        const scale = Math.max(vb.w / rect.width, vb.h / rect.height);
        vb.x -= dx * scale;
        vb.y -= dy * scale;
        pan.x = e.clientX;
        pan.y = e.clientY;
        this._meshDragged = true;
        this._meshApplyView();
      });
      const end = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!pointers.size) {
          pan = null;
          setTimeout(() => this._meshDragged = false, 0);
        }
      };
      svg.addEventListener("pointerup", end);
      svg.addEventListener("pointercancel", end);
    }
    /** Router links between floors, weakest first (1.5.0 local b4). */
    _meshBetweenFloorsHtml(mesh, nameOf) {
      const floors = this._haFloors();
      if (!floors.length) return "";
      const rows = [];
      for (const l of mesh.links.values()) {
        if (typeof l.lqi !== "number" || !isRouterLike(mesh, l.a) || !isRouterLike(mesh, l.b)) continue;
        const fa = this._deviceFloor(l.a);
        const fb = this._deviceFloor(l.b);
        if (fa && fb && fa !== fb) rows.push({ l, fa, fb });
      }
      if (!rows.length) {
        return `<div class="drawer-section-title">Between floors</div><p class="muted">No links between floors were found. Check that devices' areas are assigned to floors.</p>`;
      }
      rows.sort((x, y) => x.l.lqi - y.l.lqi);
      const good = rows.filter((r) => rateLqi(r.l.lqi, this._lqiThr) !== "weak").length;
      return `<div class="drawer-section-title">Between floors</div>
      <p class="muted">${good} usable link${good === 1 ? "" : "s"} between floors${good <= 1 ? ": the floors hang on very few links, a router near the stairs would help." : "."}</p>
      <table class="detail-table mesh-links">${rows.slice(0, 12).map(
        (r) => `<tr data-link="${escapeHtml(r.l.a)}|${escapeHtml(r.l.b)}" title="${escapeHtml(this._meshLinkTitle(r.l, nameOf))}"><td>${escapeHtml(nameOf(r.l.a))} <span class="muted">(${escapeHtml(this._floorName(r.fa))})</span> \u2194 ${escapeHtml(nameOf(r.l.b))} <span class="muted">(${escapeHtml(this._floorName(r.fb))})</span></td><td>${this._lqiChip(r.l.lqi)}</td></tr>`
      ).join("")}</table>`;
    }
    _meshFloorsHelpHtml() {
      if (this._haFloors().length) return "";
      return `<details class="mesh-floors-help"><summary>House on more than one floor?</summary>
      One plan can't show a link that goes through a ceiling, so it's drawn as a long line across the plan. Give each floor its own plan:
      <ol>
        <li>In Home Assistant, <strong>Settings \u2192 Areas, labels &amp; zones \u2192 Floors</strong>: add a floor for each level, with its level number (0 = ground, 1 = first, \u2026).</li>
        <li>In the same place, under <strong>Areas</strong>, open each area and choose its floor. Devices take their floor from their area.</li>
        <li>Reload this page. On the <strong>Floor Plan</strong> tab, pick each floor, set its image and place its devices. Your current plan becomes the lowest floor's.</li>
        <li>Back here, the <strong>Layout</strong> list has one entry per floor. Links to the floor above or below are marked \u2191 and \u2193, and a <strong>Between floors</strong> list shows how well the floors are connected.</li>
      </ol>
      The suggestions and route checks don't depend on this: they use only the radio data.</details>`;
    }
    _wireMesh() {
      const on = (sel, ev, fn) => {
        const e = this._q(sel);
        if (e) e.addEventListener(ev, fn);
      };
      on("#mesh-scan", "click", () => this._meshScan());
      on("#mesh-stop", "click", () => {
        if (this._meshScanning) this._meshScanning.stop = true;
      });
      on("#mesh-show", "change", (e) => {
        this._meshShow = e.target.value;
        this._renderMesh();
      });
      on("#mesh-battery", "change", (e) => {
        this._meshShowBattery = e.target.checked;
        this._renderMesh();
      });
      this._qa("#view-mesh [data-mesh-read]").forEach((b) => b.addEventListener("click", () => this._meshReadOne(b.dataset.meshRead)));
      on("#mesh-layout", "change", (e) => {
        this._meshLayoutChoice = e.target.value;
        this._renderMesh();
      });
      this._qa("#view-mesh .mesh-node").forEach(
        (g) => g.addEventListener("click", () => {
          if (this._meshDragged) return;
          this._openDeviceDrawer(this._devices.find((x) => normIeee(x.ieee) === g.dataset.ieee));
        })
      );
      this._qa("#view-mesh .mesh-link").forEach(
        (g) => g.addEventListener("click", () => {
          if (this._meshDragged) return;
          this._meshHighlight = this._meshHighlight === g.dataset.link ? null : g.dataset.link;
          this._renderMesh();
        })
      );
      const clear = this._q("#mesh-link-clear");
      if (clear)
        clear.addEventListener("click", () => {
          this._meshHighlight = null;
          this._renderMesh();
        });
      this._wireMeshZoom();
      this._qa("#view-mesh tr[data-link]").forEach(
        (tr) => tr.addEventListener("click", () => {
          this._meshHighlight = this._meshHighlight === tr.dataset.link ? null : tr.dataset.link;
          this._renderMesh();
        })
      );
    }
    /** Route check section for the side panel (experimental). */
    _drawerRouteHtml(d, rel) {
      if (!this._drawerRouteOpen) return "";
      if (!this._meshSnapshot || this._meshLoading) {
        this._meshEnsureLoaded();
        return `<div class="drawer-share"><p class="muted">Loading the last network scan\u2026</p></div>`;
      }
      if (!Object.keys(this._meshSnapshot).length) {
        return `<div class="drawer-share"><p>No network scan yet. A route check uses the routing and neighbour tables of your routers.</p>
        <div class="dialog-actions"><button class="btn btn-primary btn-small" id="drawer-route-scan">Scan network</button></div></div>`;
      }
      const mesh = this._meshModel();
      const thr = this._lqiThr;
      const nameOf = (i) => {
        const x = this._devices.find((dd) => normIeee(dd.ieee) === normIeee(i));
        return x ? this._deviceLabel(x) : i;
      };
      const chain = (path) => path.hops.length ? `${escapeHtml(nameOf(path.hops[0].from))}${path.hops.map((h) => ` <span class="route-arrow">\u2192</span> ${this._lqiChip(h.lqi)} ${escapeHtml(nameOf(h.to))}`).join("")}` : "";
      const items = rel.controls.map((c) => {
        if (c.kind === "group") {
          const g = this._groups.find((x) => Number(x.group_id) === Number(c.groupId));
          const members = (g && g.members || []).map((m) => m.device && m.device.ieee).filter(Boolean).filter((i) => normIeee(i) !== normIeee(this._coordinatorIeee() || ""));
          const gc = groupCheck(mesh, d.ieee, members);
          const parent = gc.sourceIsRouter ? `${escapeHtml(nameOf(d.ieee))} is a router and sends the group command itself.` : gc.parent ? `Sends through its parent ${escapeHtml(nameOf(gc.parent.parent))} ${this._lqiChip(gc.parent.lqi)}` : `Its parent router isn't known yet (scan again with it awake).`;
          const weakMembers = gc.members.filter((m) => !m.best || rateLqi(m.best.lqi, thr) === "weak");
          return `<li><strong>\u{1F465} ${escapeHtml(c.name)}</strong> <span class="muted">group: sent as a broadcast, so there's no single route</span>
          <div>${parent}</div>
          <ul class="route-members">${gc.members.map((m) => `<li>${escapeHtml(nameOf(m.ieee))}: best router link ${m.best ? `${this._lqiChip(m.best.lqi)} via ${escapeHtml(nameOf(m.best.other))}` : `<span class="muted">not seen in any table</span>`}</li>`).join("")}</ul>
          ${weakMembers.length ? `<div class="route-verdict route-weak">${weakMembers.length} light${weakMembers.length === 1 ? " hears" : "s hear"} the mesh poorly and may miss commands.</div>` : `<div class="route-verdict route-good">Every light hears the mesh well enough.</div>`}</li>`;
        }
        const path = routePath(mesh, d.ieee, c.ieee);
        const v = pathVerdict(path, thr);
        const verdict = v.level === "good" ? `<div class="route-verdict route-good">Likely path looks good.</div>` : v.level === "weak" ? `<div class="route-verdict route-weak">Weak link: ${escapeHtml(nameOf(v.weakest.from))} to ${escapeHtml(nameOf(v.weakest.to))} (LQI ${v.weakest.lqi}). A router between them, or moving one of them, would help.</div>` : v.level === "none" ? `<div class="route-verdict route-none">No route found. ${escapeHtml(path.note || "")}</div>` : `<div class="route-verdict route-unknown">Partly known. ${escapeHtml(path.note || "Some link qualities weren't reported.")}</div>`;
        return `<li><strong>${escapeHtml(c.name)}</strong><div class="route-chain">${chain(path)}</div>${verdict}${path.hops.length ? `<button class="btn btn-small" data-route-map="${escapeHtml(c.ieee)}" title="Opens the Map with this route drawn on it">Show on the Map</button>` : ""}</li>`;
      });
      return `<div class="drawer-share route-check">
      <p class="muted">Likely paths from the routing tables (snapshot ${escapeHtml(this._meshAgeText() || "")}). Zigbee can't trace a real press, so this is a prediction.</p>
      ${items.length ? `<ul class="route-list">${items.join("")}</ul>` : `<p class="muted">It doesn't control anything, so there's no route to check.</p>`}
      <div class="dialog-actions"><button class="btn btn-small" id="drawer-route-rescan">Scan network again</button><button class="btn btn-small" id="drawer-route-close">Close</button></div>
    </div>`;
    }
    /** Runs "Check supported commands" on every endpoint in turn. */
    async _checkAllEndpoints(d) {
      if (this._checkingAll) return;
      this._checkingAll = d.ieee;
      try {
        for (const ep of this._deviceEndpointsIncludingGP(d)) {
          if (!this._q("#dialog").classList.contains("open")) break;
          if (this._explodedDeviceIeee && normIeee(this._explodedDeviceIeee) !== normIeee(d.ieee)) break;
          const cur = this._commandScans.get(this._commandScanKey(d.ieee, ep));
          if (cur && cur.status === "done") continue;
          await this._checkEndpointCommands(d, ep);
        }
      } finally {
        this._checkingAll = null;
        this._rerenderExplodedFor(d);
      }
    }
    // Exploded device view dialog — triggered from the Devices tab. Scans the
    // one device on demand (same binds_get + cluster-scan calls the rest of
    // the card already makes against your own HA instance), then renders a
    // per-endpoint breakdown. No external lookups, nothing asked of the user.
    // -------------------------------------------------------------------
    async _openDeviceExplodedView(d, { checkAll = false } = {}) {
      this._shareDraft = null;
      const panel = this._q(".dialog-panel");
      if (panel) panel.classList.add("wide");
      this._q("#dialog-title").textContent = this._deviceLabel(d);
      this._q("#dialog-body").innerHTML = `<p class="muted">Scanning ${escapeHtml(
        this._deviceLabel(d)
      )}\u2026</p>`;
      this._q("#dialog").classList.add("open");
      try {
        await this._rescanDeviceFull(d.ieee, { tries: this._retryCount });
      } catch (err) {
        console.warn("[ZHA Bindings Manager] exploded view scan failed", err);
      }
      if (!this._q("#dialog").classList.contains("open")) return;
      const fresh = this._devices.find((x) => x.ieee === d.ieee) || d;
      this._renderExplodedView(fresh);
      if (checkAll) this._checkAllEndpoints(fresh);
    }
    _renderExplodedView(d) {
      this._explodedDeviceIeee = d.ieee;
      const summary = this._deviceSummaryLines(d).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`).join("");
      const endpoints = this._deviceEndpoints(d);
      const cards = endpoints.length ? endpoints.map((ep) => this._endpointCardHtml(d, ep)).join("") : `<p class="muted">No endpoint data came back for this device \u2014 the scan may have failed (sleepy or unreachable device). Try again from the Devices tab.</p>`;
      this._ensureZ2mModels();
      const imgUrl = this._deviceImageUrl(d);
      const shape = this._deviceShapeSvg(endpoints.length);
      const visual = this._showDevicePhotos && imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" class="ep-device-photo"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="ep-device-shape" style="display:none">${shape}</div>` : `<div class="ep-device-shape">${shape}</div>`;
      const roleNote = this._isMultiRoleDevice(d) ? `<p class="hint ep-role-note">\u{1F579} This device also has its own Light/Switch/Cover/Fan role, on top of
           the control relationship(s) below \u2014 e.g. a wired/local load alongside a Zigbee-bound one. Look
           through the endpoint cards below to see which one is which.</p>` : "";
      this._q("#dialog-title").textContent = `Endpoints and clusters: ${this._deviceLabel(d)}`;
      const epCount = this._deviceEndpointsIncludingGP(d).length;
      const checkAllBtn = epCount ? `<div class="ep-check-all">${this._checkingAll && normIeee(this._checkingAll) === normIeee(d.ieee) ? `<span class="muted">Checking each endpoint's supported commands in turn\u2026</span>` : `<button class="btn btn-small" id="ep-check-all" title="Runs Check supported commands on every endpoint, one after another">Check all endpoints</button>
               <span class="muted">then share the result with the community database below.</span>`}</div>` : "";
      this._q("#dialog-body").innerHTML = `
      ${checkAllBtn}
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
      ${this._deviceShareSectionHtml(d)}
      <div class="dialog-actions">
        ${deviceHaUrl(d) ? `<a class="btn" id="explode-open-ha" href="${escapeHtml(
        deviceHaUrl(d)
      )}" target="_blank" rel="noopener" title="Opens this device's page in Home Assistant, in a new tab">Open in Home Assistant</a>` : ""}
        ${controllerEndpoints(this._clusterCache.get(d.ieee)).length ? `<button class="btn btn-primary" id="explode-control-lights" title="Choose the lights, blinds or other devices this remote or switch controls. The card binds them, directly or through a group, and checks it works.">Set up what this controls\u2026</button>` : ""}
        <button class="btn" id="explode-close">Close</button>
      </div>`;
      this._q("#explode-close").addEventListener("click", () => this._closeDialog());
      const checkAll = this._q("#ep-check-all");
      if (checkAll) checkAll.addEventListener("click", () => this._checkAllEndpoints(d));
      const ctl = this._q("#explode-control-lights");
      if (ctl) ctl.addEventListener("click", () => this._openGroupFlow(d));
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
      this._qa(".ep-cmd-stop").forEach((btn) => {
        btn.addEventListener("click", () => this._stopCommandCheck(d, Number(btn.dataset.ep)));
      });
      this._qa(".ep-cmd-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const rowKey = btn.dataset.rowKey;
          if (this._expandedCmdClusters.has(rowKey)) this._expandedCmdClusters.delete(rowKey);
          else this._expandedCmdClusters.add(rowKey);
          this._renderExplodedView(d);
        });
      });
      this._qa(".device-cmd-share").forEach((btn) => {
        btn.addEventListener("click", () => this._shareDeviceCapabilities(d));
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
          if (this._shareDraft) this._markScanShared(this._shareDraft.key, this._shareDraft.record);
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
      const token = this._commandCheckSeq = (this._commandCheckSeq || 0) + 1;
      const startedAt = Date.now();
      this._commandScans.set(key, { status: "loading", token, startedAt });
      if (this._q("#dialog").classList.contains("open")) this._renderExplodedView(d);
      this._startCommandCheckTicker();
      setTimeout(() => {
        const cur = this._commandScans.get(key);
        if (cur && cur.token === token && cur.status === "loading") {
          this._commandScans.set(key, { ...cur, status: "timeout" });
          this._rerenderExplodedFor(d);
        }
      }, COMMAND_CHECK_LIMIT_MS);
      if (!this._capExpIndex && !this._capExpLoading) this._capExpLoadIndex();
      try {
        const scan = await this._api.scanDeviceCommands(d.ieee, { endpoint: ep, tries: this._retryCount });
        if (!shouldApplyResult(this._commandScans.get(key), token, true)) return;
        this._commandScans.set(key, { status: "done", scan, token });
      } catch (err) {
        if (!shouldApplyResult(this._commandScans.get(key), token, false)) return;
        this._commandScans.set(key, { status: "error", error: err.message || String(err), token });
      }
      this._rerenderExplodedFor(d);
    }
    /** Re-renders the exploded view if it's still open on device `d`. */
    _rerenderExplodedFor(d) {
      if (!this._q("#dialog").classList.contains("open")) return;
      if (this._explodedDeviceIeee && normIeee(this._explodedDeviceIeee) !== normIeee(d.ieee)) return;
      const fresh = this._devices.find((x) => x.ieee === d.ieee) || d;
      this._renderExplodedView(fresh);
    }
    /** "Stop waiting" on a running command check. Nothing is sent to the
     *  device; the card just stops showing it as in progress. */
    _stopCommandCheck(d, ep) {
      const key = this._commandScanKey(d.ieee, ep);
      const cur = this._commandScans.get(key);
      if (!cur || cur.status !== "loading") return;
      this._commandScans.set(key, { ...cur, status: "stopped" });
      this._rerenderExplodedFor(d);
    }
    /** Updates the elapsed-time counters of running command checks once a
     *  second, in place, so expanded rows and scroll position aren't reset by
     *  a full re-render. Stops itself when nothing is running. */
    _startCommandCheckTicker() {
      if (this._commandCheckTicker) return;
      this._commandCheckTicker = setInterval(() => {
        const running = [...this._commandScans.values()].some((e) => e.status === "loading");
        this._qa(".ep-cmd-elapsed").forEach((el) => {
          el.textContent = formatElapsed(Date.now() - Number(el.dataset.started));
        });
        if (!running) {
          clearInterval(this._commandCheckTicker);
          this._commandCheckTicker = null;
        }
      }, 1e3);
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
        const hasTuyaCluster = declaredIds.has(61184);
        if (hasTuyaCluster) {
          return `<p class="hint ep-cmd-status">This endpoint uses Tuya's private cluster (0xEF00) to tunnel its real functionality instead of standard Zigbee commands \u2014 generic command discovery can't see into it, so there's nothing for this card to check.</p>`;
        }
        const outClusterIds = [
          ...new Set(clusters.filter((c) => c.type === "out" && c.endpoint_id === ep).map((c) => Number(c.id)))
        ].filter((id) => CLUSTER_COMMANDS[id]);
        if (outClusterIds.length) {
          const outNames = outClusterIds.map((id) => clusterName(id)).join(", ");
          return `<p class="hint ep-cmd-status">This endpoint is a controller, not a receiver: it's built to send ${escapeHtml(
            outNames
          )} commands out to whatever it's bound to, rather than accept them itself \u2014 there's nothing for a command-support scan to discover here. To see what it actually controls, look at the relationship badges above; to check what a light or plug will respond to, run this same check on its own endpoint instead.</p>`;
        }
        return `<p class="hint ep-cmd-status">This endpoint doesn't declare any clusters this card has command data for.</p>`;
      }
      const key = this._commandScanKey(d.ieee, ep);
      const entry = this._commandScans.get(key);
      const isBattery = this._isBatteryDevice(d);
      const wakeHint = isBattery ? `<div class="scan-wake-hint">Battery devices fall asleep within seconds, and this check takes longer than that: press a button on it just before you start, then every few seconds until it finishes.</div>` : "";
      let actionHtml;
      if (!entry) {
        actionHtml = `
        ${wakeHint}
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">Check supported commands</button>`;
      } else if (entry.status === "loading") {
        actionHtml = `
        <p class="hint ep-cmd-status">Checking supported commands&hellip; <span class="ep-cmd-elapsed" data-started="${entry.startedAt || Date.now()}">${formatElapsed(Date.now() - (entry.startedAt || Date.now()))}</span> elapsed. This asks the device directly, one cluster at a time; most answer within a minute. The card stops waiting after ${formatElapsed(
          COMMAND_CHECK_LIMIT_MS
        )}.</p>
        ${wakeHint}
        <button class="btn btn-small ep-cmd-stop" data-ep="${ep}">Stop waiting</button>`;
      } else if (entry.status === "timeout" || entry.status === "stopped") {
        const why = entry.status === "timeout" ? `No answer after ${formatElapsed(COMMAND_CHECK_LIMIT_MS)}, so the card stopped waiting.` : "Stopped waiting.";
        const tryHint = isBattery ? `<div class="scan-wake-hint">May be asleep: press a button on it, then try again.</div>` : `<div class="scan-wake-hint">Check it's powered on and in range, then try again.</div>`;
        actionHtml = `
        <p class="hint ep-cmd-status">${why} The request may still be running in Home Assistant; if the device answers, the results will appear here.</p>
        ${tryHint}
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">${isBattery ? "Wake & try again" : "Try again"}</button>`;
      } else if (entry.status === "error") {
        const errorWakeHint = isBattery ? `<div class="scan-wake-hint">May be asleep \u2014 press a button on it, then try again.</div>` : `<div class="scan-wake-hint">Not responding \u2014 check it's powered on and in range, then try again.</div>`;
        actionHtml = `
        <p class="hint ep-cmd-status">Couldn't check supported commands: ${escapeHtml(entry.error)}</p>
        ${errorWakeHint}
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">${isBattery ? "Wake & try again" : "Try again"}</button>`;
      } else {
        actionHtml = `<button class="btn btn-small ep-cmd-check" data-ep="${ep}">Re-check</button>`;
      }
      const scanned = !!(entry && entry.status === "done");
      const epScan = scanned ? (entry.scan && entry.scan.endpoints || []).find((e) => Number(e.id) === Number(ep)) : null;
      const inClusters = epScan && epScan.in_clusters || {};
      let confirmedClusterCount = 0;
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
              summary = "No commands confirmed";
              bodyHtml = `<p class="hint">No commands reported for this cluster during discovery.</p>`;
            } else {
              confirmedClusterCount++;
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
      const discoveryNote = scanned && relevantIds.length > 0 && confirmedClusterCount === 0 ? `<p class="hint ep-cmd-discovery-note">This scan didn't confirm any commands across ${relevantIds.length} cluster${relevantIds.length === 1 ? "" : "s"} checked. That usually means this device's firmware doesn't implement Zigbee's command-discovery request at all
            (common on some vendors' devices, Philips Hue/Signify among them) rather than a temporary communication problem
            \u2014 re-checking is unlikely to change the result.</p>` : "";
      const compareHtml = scanned ? this._capExpCompareMyDeviceHtml(d, ep, entry.scan) : "";
      return `
      <div class="ep-cmd-actions">${actionHtml}</div>
      ${compareHtml}
      ${discoveryNote}
      <div class="ep-cmd-results">${rows}</div>`;
    }
    /** Device-level "share to community database" section, shown once under
     *  the endpoint grid rather than per-endpoint — see
     *  _buildDeviceCapabilityRecord() for why: one GitHub issue now covers
     *  every endpoint on the device instead of forcing a separate issue per
     *  endpoint (the friction MattWestb hit on a multi-endpoint device,
     *  zigbee-capabilities#57). Only appears once at least one endpoint has a
     *  completed scan — nothing to share otherwise. */
    _deviceShareSectionHtml(d) {
      const epIds = this._deviceEndpointsIncludingGP(d);
      if (!epIds.length) return "";
      const statusOf = (ep) => {
        const e = this._commandScans.get(this._commandScanKey(d.ieee, ep));
        return e && e.status;
      };
      const scannedCount = epIds.filter((ep) => statusOf(ep) === "done").length;
      const endedCount = epIds.filter((ep) => ["done", "timeout", "stopped", "error"].includes(statusOf(ep))).length;
      if (!endedCount) return "";
      if (this._shareDraft && this._shareDraft.key === d.ieee) {
        return `<div class="device-share-section">${this._shareDraftHtml(this._shareDraft)}</div>`;
      }
      return `
      <div class="device-share-section">
        <button class="btn btn-small device-cmd-share" type="button">
          ${scannedCount ? `Share scan to community database (${scannedCount}/${epIds.length} endpoint${epIds.length === 1 ? "" : "s"} checked)` : "Share what's known to community database (endpoints and clusters only)"}
        </button>
      </div>`;
    }
    /** "Compare My Device" (PRD v2, Phase 2) — once a live scan has confirmed
     *  this device's own firmware, checks it against every firmware the
     *  community database has on file for the same manufacturer/model and
     *  says plainly whether anything newer has been *observed* (never
     *  "latest" — see newestFirmwareGap's own doc comment; this card has no
     *  way to know the true manufacturer OTA latest, only what's been shared).
     *  Reuses the same live-scan sw_build_id _extractIdentity() also supplies
     *  to the share-to-database flow, so there's no separate identity lookup
     *  to keep in sync. */
    _capExpCompareMyDeviceHtml(d, ep, scan) {
      const epScan = (scan && scan.endpoints || []).find((e) => Number(e.id) === Number(ep));
      const identity = epScan && this._extractIdentity(epScan);
      const liveFirmware = identity && identity.sw_build_id;
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
    /** Inline "review before sharing" block for a device's completed scans —
     *  see _shareDeviceCapabilities(). Shown once under the endpoint grid
     *  rather than as a separate dialog (the exploded view is already a
     *  dialog, and this card has no nested-dialog support), so nothing is
     *  ever sent anywhere without the user seeing exactly what's in it first.
     *  When the payload's too large to pre-fill the whole issue, the title
     *  still gets pre-filled (titles are always short) and the one open/link
     *  action also copies the JSON in the same click — down to one manual
     *  step (paste) instead of inventing a title and copying separately. */
    _shareDraftHtml(draft) {
      const openLabel = draft.tooLong ? "Copy JSON &amp; open issue" : "Open GitHub issue";
      const openBtn = `<a class="btn btn-small ep-cmd-share-open" href="${escapeHtml(
        draft.url
      )}" target="_blank" rel="noopener">${openLabel}</a>`;
      const partial = draft.declaredOnly ? `<p class="hint">No command check finished, so this shares the device's endpoints and clusters only, marked as not checked. That still tells the next person what the device has; anyone whose check completes can add the commands later.</p>` : "";
      const notice = draft.tooLong ? `<p class="hint">This scan is too large to pre-fill the whole issue. The title's already filled in \u2014 clicking below also copies the JSON, so just paste it (Ctrl/Cmd+V) into the body once the new issue opens.</p>` : `<p class="hint">Review what would be submitted, then open a pre-filled GitHub issue \u2014 nothing is sent until you click "Submit new issue" on GitHub's own page. No IEEE address, entity, area, or binding data is included.</p>`;
      return `
      <div class="ep-cmd-share-draft">
        ${notice}
        ${partial}
        <textarea class="ep-cmd-share-json" readonly rows="8">${escapeHtml(draft.body)}</textarea>
        <div class="ep-cmd-share-actions">
          ${openBtn}
          <button class="btn btn-small ep-cmd-share-copy" type="button">Copy JSON</button>
          <button class="btn btn-small ep-cmd-share-cancel" type="button">Cancel</button>
        </div>
      </div>`;
    }
    /** Basic cluster (0x0000) identity attributes from one endpoint's
     *  completed scan, matched by their already-decoded name (scan_device
     *  resolves attribute names via zigpy's own cluster.attributes
     *  definitions) rather than a hardcoded attribute ID we'd have to verify
     *  ourselves. Shared by Compare My Device (one endpoint's live firmware)
     *  and the device-level capability record below (identity is a whole-
     *  device fact, so the first scanned endpoint that has it wins). */
    _extractIdentity(epScan) {
      const inClusters = epScan && epScan.in_clusters || {};
      const basic = inClusters["0x0000"];
      const findIdentityAttr = (name) => {
        if (!basic || !basic.attributes) return null;
        const hit = Object.values(basic.attributes).find((a) => a.attribute_name === name);
        return hit && hit.attribute_value != null ? hit.attribute_value : null;
      };
      return {
        sw_build_id: findIdentityAttr("sw_build_id"),
        hw_version: findIdentityAttr("hw_version"),
        date_code: findIdentityAttr("date_code")
      };
    }
    /** Builds the `clusters` block of a shareable capability record from one
     *  endpoint's completed scan_device result — unit-tested in
     *  smoke-test.js, every field read here verified against zha_toolkit's
     *  actual scan_device.py (scan_endpoint/scan_cluster/
     *  discover_attributes_extended). Covers every cluster the scan touched
     *  (not just the known-command ones the UI itself displays), since
     *  attribute-only clusters (e.g. Basic, Power Configuration) are still
     *  genuinely useful capability data even though this card has nothing to
     *  check them against.
     *  Prefers the scan's own already-resolved cluster title (zha_toolkit/
     *  zigpy names plenty of manufacturer-specific clusters this card's own
     *  CLUSTER_INFO table doesn't know about — e.g. IKEA's 0xfc7d as "Ikea
     *  Airpurifier") over the generic clusterName() fallback, which used to
     *  silently replace those real names with "Cluster 0xNNNN" in the shared
     *  record — a real information loss MattWestb flagged via a live
     *  STARKVIND scan (zigbee-capabilities#57). */
    _clustersBlockFromScan(epScan) {
      const inClusters = epScan && epScan.in_clusters || {};
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
          name: clusterData.title || clusterName(clusterId),
          commands_received: commandsReceived.rows,
          commands_received_confirmed: commandsReceived.confirmed,
          commands_generated: commandsGenerated,
          attributes_confirmed: attributesConfirmed
        };
      });
      return clusters;
    }
    /** Every endpoint ID a device declares, Green Power proxy included — the
     *  complement to _deviceEndpoints() (which deliberately excludes it for
     *  the binding-relationship UI, since GP endpoints have no ZHA entities
     *  or bindings to show). Capability submissions are a different concern:
     *  MattWestb pointed out that silently dropping the GP endpoint made
     *  device submissions incomplete (zigbee-capabilities#57), so the shared
     *  record below includes it as a declared-but-unscanned endpoint rather
     *  than omitting it. */
    _deviceEndpointsIncludingGP(d) {
      const clusters = this._clusterCache.get(d.ieee) || [];
      return [...new Set(clusters.map((c) => c.endpoint_id))].sort((a, b) => a - b);
    }
    /** Assembles the shareable capability record for a whole device — one
     *  GitHub issue covers every endpoint, not one issue per endpoint.
     *  MattWestb's STARKVIND example showed the old one-record-per-endpoint
     *  design forcing multi-endpoint devices into several separate issues
     *  (zigbee-capabilities#57); this walks every endpoint the device
     *  declares (via the cluster cache, GP proxy included) and includes a
     *  full clusters block for any endpoint that's been scanned, or a bare
     *  declared-clusters stub for one that hasn't (either not yet checked, or
     *  not scannable at all, like Green Power) — so a partial submission
     *  never claims more than it knows, but also never silently drops an
     *  endpoint the device actually has.
     *  Deliberately excludes anything that identifies this specific device or
     *  network — no IEEE, no entity IDs, no area, no binding data — only what
     *  the device model/firmware is capable of. */
    _buildDeviceCapabilityRecord(d) {
      const epIds = this._deviceEndpointsIncludingGP(d);
      if (!epIds.length) return null;
      const rawClusters = this._clusterCache.get(d.ieee) || [];
      let identity = { sw_build_id: null, hw_version: null, date_code: null };
      const endpoints = epIds.map((epId) => {
        const key = this._commandScanKey(d.ieee, epId);
        const entry = this._commandScans.get(key);
        const epScan = entry && entry.status === "done" ? (entry.scan && entry.scan.endpoints || []).find((e) => Number(e.id) === Number(epId)) : null;
        if (epScan) {
          const scannedIdentity = this._extractIdentity(epScan);
          if (scannedIdentity.sw_build_id) identity = scannedIdentity;
          return {
            endpoint: {
              id: epId,
              profile: epScan.profile || null,
              device_type: epScan.device_type || null,
              in_clusters: Object.keys(epScan.in_clusters || {}),
              out_clusters: Object.keys(epScan.out_clusters || {})
            },
            scanned: true,
            clusters: this._clustersBlockFromScan(epScan)
          };
        }
        const epClusters = rawClusters.filter((c) => c.endpoint_id === epId);
        return {
          endpoint: {
            id: epId,
            in_clusters: epClusters.filter((c) => c.type === "in").map((c) => hex4(c.id)),
            out_clusters: epClusters.filter((c) => c.type === "out").map((c) => hex4(c.id))
          },
          scanned: false
        };
      });
      return {
        manufacturer: d.manufacturer || null,
        model: d.model || null,
        identity,
        endpoints,
        provenance: {
          submitted_at: (/* @__PURE__ */ new Date()).toISOString(),
          card_version: CARD_VERSION
        }
      };
    }
    /** Builds the review draft for sharing a device's completed scans to the
     *  community capability database (see CAPABILITY_DB_REPO) and shows it
     *  inline for confirmation — see _shareDraftHtml(). One issue now covers
     *  every endpoint on the device (see _buildDeviceCapabilityRecord()),
     *  not just the one endpoint that happened to trigger the share. Always
     *  manual, never automatic: nothing leaves the browser until the user
     *  clicks through to GitHub's own "Submit new issue" button themselves,
     *  using their own GitHub session — this card never touches GitHub
     *  credentials. GitHub issue pre-fill URLs get unreliable well before any
     *  hard browser limit, so 6000 characters is a conservative cutoff, not
     *  the actual ceiling. The URL attempt uses compact (unindented) JSON
     *  specifically to maximize how often a scan fits under that cutoff —
     *  pretty-printing's whitespace alone is often 30-50% of the encoded
     *  size — while the on-screen review box and clipboard copy stay
     *  pretty-printed for readability, since that's what actually gets
     *  pasted/submitted. Past the cutoff, the title still gets pre-filled
     *  (titles are always short) with a paste placeholder body — see
     *  _shareDraftHtml(). */
    _shareDeviceCapabilities(d) {
      const record = this._buildDeviceCapabilityRecord(d);
      if (!record) {
        this._setStatus("error", "Nothing to share yet: this device's endpoints haven't been read.");
        return;
      }
      const declaredOnly = !record.endpoints.some((e) => e.scanned);
      const title = `[Device Submission] ${record.manufacturer || "Unknown"} ${record.model || "Unknown"}${record.identity.sw_build_id ? ` (fw ${record.identity.sw_build_id})` : ""}`;
      const displayBody = "```json\n" + JSON.stringify(record, null, 2) + "\n```";
      const compactBody = "```json\n" + JSON.stringify(record) + "\n```";
      const labelsParam = `labels=${encodeURIComponent("device-submission")}`;
      const fullUrl = `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(compactBody)}&${labelsParam}`;
      const tooLong = fullUrl.length > 6e3;
      const url = tooLong ? `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent("Paste the copied JSON below this line:\n\n")}&${labelsParam}` : fullUrl;
      this._shareDraft = { key: d.ieee, record, title, body: displayBody, url, tooLong, declaredOnly };
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
          const main = `Self-bound${b.targetEndpoint !== ep ? ` (ep ${escapeHtml(String(b.targetEndpoint))})` : ""}`;
          badges.push(badge("ep-badge-self", main, clusters));
        }
      );
      this._groupBindingsByKey(rel.controlsDevice, (b) => `${b.targetIeee}:${b.targetEndpoint}`).forEach(
        ({ binding: b, clusters }) => {
          const main = `Controls ${escapeHtml(this._targetDeviceLabel(b.targetIeee))} (ep ${escapeHtml(String(b.targetEndpoint))})`;
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
        const main = b.isGroup ? `Unclassified binding to group ${escapeHtml(this._groupLabel(b.groupId))}` : `Unclassified binding to ${escapeHtml(this._targetDeviceLabel(b.targetIeee))} (ep ${escapeHtml(String(b.targetEndpoint))})`;
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
        manufacturer: "Manufacturer-specific &mdash; a cluster outside the Zigbee standard, usually set up by the device itself. The card doesn't check it.",
        unknown: "Unknown &mdash; the source device hasn't been cluster-scanned yet, so this can't be classified as control or reporting. Shown either way rather than guessing."
      }[cls];
      this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Source</td><td>${escapeHtml(sourceLabel)} (ep ${escapeHtml(String(binding.sourceEndpoint))})</td></tr>
        <tr><td>Target</td><td>${escapeHtml(targetLabel)}${binding.isGroup ? "" : ` (ep ${escapeHtml(String(binding.targetEndpoint))})`}</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
        <tr><td>Type</td><td>${typeText}</td></tr>
      </table>
      ${this._experimental && !binding.isGroup && cls !== "reporting" && cls !== "manufacturer" ? `<p class="hint">Network (beta): show the way this binding's commands likely travel through your routers, from the last network scan.</p>` : this._experimental && binding.isGroup ? `<p class="hint">Group bindings are sent as a broadcast, so there's no single route to show. <strong>Check route\u2026</strong> in the remote's side panel shows how well each light hears the mesh.</p>` : ""}
      <div class="dialog-actions">
        ${this._experimental && !binding.isGroup && cls !== "reporting" && cls !== "manufacturer" ? `<button class="btn" id="unbind-route">Show route on the Map</button>` : ""}
        <button class="btn btn-danger" id="unbind-confirm">Remove binding</button>
        <button class="btn" id="unbind-cancel">Close</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#unbind-cancel").addEventListener("click", () => this._closeDialog());
      const routeBtn = this._q("#unbind-route");
      if (routeBtn)
        routeBtn.addEventListener("click", () => {
          this._closeDialog();
          this._mapRoute = { sourceIeee: binding.sourceIeee, targetIeee: binding.targetIeee };
          if (this._view !== "graph") this._switchView("graph");
          else this._renderGraph();
        });
      this._q("#unbind-confirm").addEventListener("click", async () => {
        this._closeDialog();
        this._setStatus("info", "Removing binding\u2026", 0);
        const bindTarget = binding.isGroup ? { isGroup: true, groupId: binding.groupId } : { isGroup: false, ieee: binding.targetIeee, endpoint: binding.targetEndpoint };
        const before = this._bindingPresent(binding.sourceIeee, binding.sourceEndpoint, binding.clusterId, bindTarget);
        let unbindError = null;
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
          unbindError = toolkitErrorText(err);
          console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
        } finally {
          const scan = await this._scanBindings(rescanTargets, { tries: this._retryCount });
          const res = this._settleChange(
            "unbind",
            {
              sourceIeee: binding.sourceIeee,
              sourceEndpoint: binding.sourceEndpoint,
              clusterId: binding.clusterId,
              target: bindTarget
            },
            scan,
            before
          );
          let message = res.message;
          if (res.level !== "success") {
            const why = explainUnbindFailure({
              errors: unbindError ? [unbindError] : [],
              targetRemoved: !binding.isGroup && this._isRemovedDevice(binding.targetIeee)
            });
            if (why) message = `${message} ${why}`;
          }
          this._setStatus(res.level, message, res.level === "success" ? void 0 : 0, res.action);
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
    /** The device the Bindings table is currently scoped to. A device clicked in
     *  the Devices tab, or a Source or Target name in the table, wins. Otherwise,
     *  a search term that names exactly one device scopes the table to it
     *  (`bySearch` is true then). */
    _effectiveTableDevice() {
      if (this._tableSourceFilter) return { ieee: this._tableSourceFilter, bySearch: false };
      const d = findSingleDeviceBySearch(this._devices, this._filters.search);
      return d ? { ieee: d.ieee, bySearch: true } : { ieee: null, bySearch: false };
    }
    /** `healthMap` is optional — pass the one _renderTable() already computed
     *  to avoid a redundant pass; callers like _exportRowsData() that don't
     *  have one handy get a freshly-computed one for free. */
    _filteredBindingRows(healthMap) {
      const map = healthMap || this._computeHealthMap();
      const { ieee: deviceIeee, bySearch } = this._effectiveTableDevice();
      const s = bySearch ? "" : this._filters.search;
      return this._allBindings().filter((b) => {
        if (!matchesDeviceFilter(b, deviceIeee, this._tableDirection)) return false;
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
        const hay = `${source ? `${this._deviceLabel(source)} ${deviceNameText(source)}` : ""} ${target ? b.isGroup ? target.name || "" : `${this._deviceLabel(target)} ${deviceNameText(target)}` : ""} ${clusterName(b.clusterId)} ${source ? this._areaName(source.area_id) : ""} ${source ? source.manufacturer || "" : ""} ${source ? source.model || "" : ""}`.toLowerCase();
        return hay.includes(s);
      });
    }
    _renderTable() {
      const wrap = this._q("#table-body");
      if (!wrap) return;
      this._ensureHealthData();
      const { ieee: deviceIeee, bySearch } = this._effectiveTableDevice();
      if (deviceIeee !== this._lastTableDevice) {
        this._lastTableDevice = deviceIeee;
        this._tableDirection = DIRECTION_ALL;
      }
      const filterInfo = this._q("#table-filter-info");
      if (filterInfo) {
        if (deviceIeee) {
          const dev = this._devices.find((d) => d.ieee === deviceIeee);
          const name = this._ieeeLabel(deviceIeee, { plain: true });
          const removed = !dev && this._isRemovedDevice(deviceIeee);
          let actionsHtml = `<button class="btn btn-small btn-primary" id="btn-add-binding-from-filter">Add binding from ${escapeHtml(name)}</button>`;
          if (removed) {
            const saved = removedSources(this._bindings, this._devices).filter((g) => normIeee(g.ieee) === deviceIeee).reduce((n, g) => n + g.count, 0);
            const pointing = deadTargetBindings(this._bindings, this._devices).filter(
              (b) => normIeee(b.targetIeee) === deviceIeee
            ).length;
            actionsHtml = `<span class="removed-note">Removed from ZHA${name !== deviceIeee ? ` \xB7 <code>${escapeHtml(deviceIeee)}</code>` : ""}</span>${saved ? `<button class="btn btn-small" id="btn-filter-forget">Forget ${saved} saved binding${saved === 1 ? "" : "s"}</button>` : ""}${pointing ? `<button class="btn btn-small btn-danger" id="btn-filter-unbind-dead">Unbind ${pointing} pointing to it</button>` : ""}`;
          }
          const dirChip = (value, label) => `<button class="chip${this._tableDirection === value ? " active" : ""}" data-direction="${value}">${label}</button>`;
          filterInfo.innerHTML = `Showing bindings involving <strong>${escapeHtml(name)}</strong>${bySearch ? ' <span class="muted">(matched by your search)</span>' : ""}
          <span class="health-filters">${dirChip(DIRECTION_ALL, "All")}${dirChip(DIRECTION_OUTBOUND, "Outbound")}${dirChip(
            DIRECTION_INBOUND,
            "Inbound"
          )}</span>
          <button class="btn btn-small" id="btn-clear-source-filter">${bySearch ? "Clear search" : "Clear filter"}</button>
          ${actionsHtml}`;
          filterInfo.style.display = "flex";
          this._q("#btn-clear-source-filter").addEventListener("click", () => {
            if (bySearch) {
              const box = this._q("#search");
              box.value = "";
              box.dispatchEvent(new Event("input"));
            } else {
              this._setTableDeviceFilter(null);
              this._renderTable();
            }
          });
          const addBtn = this._q("#btn-add-binding-from-filter");
          if (addBtn) addBtn.addEventListener("click", () => this._openAddBindingFromFilter());
          const forgetBtn = this._q("#btn-filter-forget");
          if (forgetBtn) forgetBtn.addEventListener("click", () => this._confirmForgetSources([deviceIeee]));
          const unbindDeadBtn = this._q("#btn-filter-unbind-dead");
          if (unbindDeadBtn) unbindDeadBtn.addEventListener("click", () => this._confirmUnbindDeadTargets(deviceIeee));
          this._qa("#table-filter-info [data-direction]").forEach((btn) => {
            btn.addEventListener("click", () => {
              this._tableDirection = btn.dataset.direction;
              this._renderTable();
            });
          });
        } else {
          filterInfo.style.display = "none";
        }
      }
      const filtered = !!deviceIeee;
      const dirTh = this._q("#th-direction");
      if (dirTh) dirTh.style.display = filtered ? "" : "none";
      const healthMap = this._computeHealthMap();
      this._renderHealthSummary(healthMap);
      this._renderStaleBanner();
      this._renderLostBanner();
      this._renderEvidenceBanner();
      this._renderPendingBanner();
      this._updateSortIndicators("#view-table", this._tableSort);
      let rows = this._filteredBindingRows(healthMap).map((b) => {
        const source = this._devices.find((d) => d.ieee === b.sourceIeee);
        const target = b.isGroup ? this._groups.find((g) => g.group_id === b.groupId) : this._devices.find((d) => d.ieee === b.targetIeee);
        const known = source ? null : this._knownDeviceInfo(b.sourceIeee);
        const sourceLabel = source ? this._deviceLabel(source) : this._ieeeLabel(b.sourceIeee);
        const targetLabel = b.isGroup ? target && target.name || `Group ${escapeHtml(String(b.groupId))}` : target ? this._deviceLabel(target) : this._ieeeLabel(b.targetIeee);
        const typeLabel = source ? this._devicePrimaryType(source) : "\u2014";
        const typeFull = source ? this._deviceTypeTags(source).join(", ") : "";
        const areaLabel = source ? this._areaName(source.area_id) : known && known.area_id ? this._areaName(known.area_id) : "\u2014";
        const manModelOf = (d) => [d.manufacturer, d.model].filter(Boolean).join(" / ") || "\u2014";
        const manModel = source ? manModelOf(source) : known ? manModelOf(known) : "\u2014";
        const health = healthMap.get(b.id) || {
          level: "ok",
          code: "ok",
          message: "",
          why: "",
          recommendation: null
        };
        const dir = filtered ? bindingDirection(b, deviceIeee) : null;
        return {
          binding: b,
          direction: dir,
          directionRank: directionRank(dir),
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
      if (filtered && !this._tableSort.key) rows = [...rows].sort((a, b) => a.directionRank - b.directionRank);
      else rows = this._sortRows(rows, this._tableSort);
      const colCount = filtered ? 9 : 8;
      if (!rows.length) {
        const all = this._allBindings();
        const dev = filtered ? this._devices.find((d) => d.ieee === deviceIeee) : null;
        const healthChip = this._q(`[data-health-filter="${this._tableHealthFilter}"]`);
        const state = emptyTableState({
          total: all.length,
          rawTotal: this._rawBindings().length,
          healthFilterLabel: this._tableHealthFilter !== "all" ? healthChip ? healthChip.textContent.trim() : this._tableHealthFilter : null,
          search: bySearch ? null : (this._filters.search || "").trim() || null,
          deviceFilterActive: filtered,
          deviceMatches: filtered ? all.filter((b) => matchesDeviceFilter(b, deviceIeee, this._tableDirection)).length : all.length,
          direction: this._tableDirection,
          deviceName: dev ? this._deviceLabel(dev) : deviceIeee,
          coordinatorHidden: !!(dev && (dev.device_type === "Coordinator" || dev.active_coordinator) && this._filters.hideCoordinatorBindings)
        });
        wrap.innerHTML = `<tr><td colspan="${colCount}" class="muted">${escapeHtml(state.message)}</td></tr>`;
        return;
      }
      wrap.innerHTML = rows.map((r) => {
        const b = r.binding;
        const h = r.health;
        return `
        <tr data-id="${escapeHtml(b.id)}">
          ${filtered ? `<td class="dir-cell dir-${r.direction}">${escapeHtml(directionLabel(r.direction))}</td>` : ""}
          <td><a href="#" class="src-link" data-ieee="${escapeHtml(b.sourceIeee)}">${escapeHtml(
          r.sourceLabel
        )}</a> <span class="muted">(ep ${escapeHtml(String(b.sourceEndpoint))})</span></td>
          <td title="${escapeHtml(r.typeFull)}">${escapeHtml(r.typeLabel)}</td>
          <td>${escapeHtml(r.areaLabel)}</td>
          <td>${escapeHtml(r.manModel)}</td>
          <td><span class="dot" style="background:${clusterColor(b.clusterId)}"></span> ${escapeHtml(
          r.clusterLabel
        )}</td>
          <td>${b.isGroup ? `${escapeHtml(r.targetLabel)} (group)` : `<a href="#" class="src-link tgt-link" data-ieee="${escapeHtml(b.targetIeee)}" title="Open this device">${escapeHtml(
          r.targetLabel
        )}</a> <span class="muted">(ep ${escapeHtml(String(b.targetEndpoint))})</span>`}</td>
          <td><button class="health-badge health-${h.level}" data-health="${escapeHtml(b.id)}" title="${escapeHtml(
          h.message
        )}">${HEALTH_ICON[h.level]} ${escapeHtml(HEALTH_LABEL[h.level])}</button></td>
          <td>${h.code === "source_missing" ? `<button class="btn btn-small" data-forget="${escapeHtml(b.sourceIeee)}" title="Remove the leftover saved data for this removed device. Nothing is sent to Zigbee.">Forget</button>` : `<button class="btn btn-small btn-danger" data-unbind="${escapeHtml(b.id)}">Unbind</button>`}</td>
        </tr>`;
      }).join("");
      this._qa("[data-unbind]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const binding = this._allBindings().find((b) => b.id === btn.dataset.unbind);
          if (binding) this._openUnbindPopover(binding);
        });
      });
      this._qa("#table-body [data-forget]").forEach((btn) => {
        btn.addEventListener("click", () => this._confirmForgetSources([btn.dataset.forget]));
      });
      this._qa("#table-body .src-link").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          const dev = this._devices.find((x) => normIeee(x.ieee) === normIeee(el.dataset.ieee));
          if (dev) this._openDeviceDrawer(dev);
          else {
            this._setTableDeviceFilter(el.dataset.ieee);
            this._renderTable();
          }
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
    /** Banner above the Bindings table for saved data that points at devices
     *  ZHA no longer has (see stale-bindings.js): leftover entries from
     *  removed devices, which are forgotten, and bindings on live devices to
     *  removed targets, which are unbound. Hidden when there are neither. */
    _renderStaleBanner() {
      const el = this._q("#stale-banner");
      if (!el) return;
      if (!this._loaded || !this._devices.length) {
        el.style.display = "none";
        return;
      }
      const gone = removedSources(this._bindings, this._devices);
      const dead = deadTargetBindings(this._bindings, this._devices);
      if (!gone.length && !dead.length) {
        el.style.display = "none";
        return;
      }
      const parts = [];
      if (dead.length) {
        const sources = new Set(dead.map((b) => normIeee(b.sourceIeee))).size;
        parts.push(`
        <div class="stale-row">
          <span><strong>${dead.length} binding${dead.length === 1 ? "" : "s"}</strong> on ${sources} device${sources === 1 ? "" : "s"} point to devices that are no longer in ZHA. They use binding-table slots and send commands to nobody.</span>
          <button class="btn btn-small" id="btn-stale-show">Show</button>
          <button class="btn btn-small" id="btn-stale-move" title="Replaced it with a new device? Point these bindings at the new one instead">Move to a new device\u2026</button>
          <button class="btn btn-small btn-danger" id="btn-stale-unbind-all">Unbind all</button>
        </div>`);
      }
      if (gone.length) {
        const count = gone.reduce((n, g) => n + g.count, 0);
        parts.push(`
        <div class="stale-row">
          <span><strong>${count} saved binding${count === 1 ? "" : "s"}</strong> from ${gone.length} device${gone.length === 1 ? "" : "s"} that ${gone.length === 1 ? "was" : "were"} removed from ZHA. This is leftover data in the card, not on your Zigbee network.</span>
          <button class="btn btn-small" id="btn-stale-forget-all">Forget all</button>
        </div>`);
      }
      el.innerHTML = parts.join("");
      el.style.display = "";
      const show = this._q("#btn-stale-show");
      if (show)
        show.addEventListener("click", () => {
          this._tableHealthFilter = "error";
          this._qa("#health-filters [data-health-filter]").forEach(
            (b) => b.classList.toggle("active", b.dataset.healthFilter === "error")
          );
          this._renderTable();
        });
      const move = this._q("#btn-stale-move");
      if (move) move.addEventListener("click", () => this._openReplace({ deadTargets: [...new Set(dead.map((b) => normIeee(b.targetIeee)))] }));
      const unbindAll = this._q("#btn-stale-unbind-all");
      if (unbindAll) unbindAll.addEventListener("click", () => this._confirmUnbindDeadTargets());
      const forgetAll = this._q("#btn-stale-forget-all");
      if (forgetAll) forgetAll.addEventListener("click", () => this._confirmForgetSources(gone.map((g) => g.ieee)));
    }
    _confirmForgetSources(ieees) {
      const total = ieees.reduce((n, ieee) => {
        for (const [k, list2] of this._bindings) if (normIeee(k) === normIeee(ieee)) n += (list2 || []).length;
        return n;
      }, 0);
      this._q("#dialog-title").textContent = "Forget leftover data";
      this._q("#dialog-body").innerHTML = `
      <p>This removes ${total} saved binding${total === 1 ? "" : "s"} for ${ieees.length === 1 ? `<strong>${escapeHtml(this._ieeeLabel(ieees[0], { plain: true }))}</strong> (<code>${escapeHtml(ieees[0])}</code>), a device` : `${ieees.length} devices`} no longer in ZHA.</p>
      <p class="hint">Nothing is sent to your Zigbee network. If the device is paired again later, the next scan reads its bindings afresh.</p>
      <div class="dialog-actions">
        <button class="btn btn-primary" id="forget-confirm">Forget</button>
        <button class="btn" id="forget-cancel">Cancel</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#forget-cancel").addEventListener("click", () => this._closeDialog());
      this._q("#forget-confirm").addEventListener("click", async () => {
        this._closeDialog();
        let dropped = 0;
        ieees.forEach((ieee) => {
          dropped += forgetSource(this._bindings, ieee);
          this._scanFailures.delete(normIeee(ieee));
          this._scanPartial.delete(normIeee(ieee));
        });
        await this._saveScanState();
        this._saveKnownDevices();
        this._setStatus("success", `Forgot ${dropped} saved binding${dropped === 1 ? "" : "s"} from removed devices.`);
        this._renderGraph();
        this._renderTable();
        this._renderDevicesTab();
      });
    }
    /** `onlyTarget` (an IEEE) limits this to bindings pointing at one removed
     *  device, as offered from the filter bar. */
    _confirmUnbindDeadTargets(onlyTarget) {
      const dead = deadTargetBindings(this._bindings, this._devices).filter(
        (b) => !onlyTarget || normIeee(b.targetIeee) === normIeee(onlyTarget)
      );
      if (!dead.length) return;
      const rowsHtml = dead.map((b) => {
        const src = this._devices.find((d) => normIeee(d.ieee) === normIeee(b.sourceIeee));
        return `<tr><td>${escapeHtml(src ? this._deviceLabel(src) : b.sourceIeee)} (ep ${escapeHtml(String(b.sourceEndpoint))})</td><td>${escapeHtml(
          clusterName(b.clusterId)
        )}</td><td>${escapeHtml(this._ieeeLabel(b.targetIeee, { plain: true }))} <code>${escapeHtml(b.targetIeee)}</code></td></tr>`;
      }).join("");
      this._q("#dialog-title").textContent = "Unbind bindings to removed devices";
      this._q("#dialog-body").innerHTML = `
      <p>These bindings point to devices that are no longer in ZHA:</p>
      <table class="detail-table"><tr><td><strong>Source</strong></td><td><strong>Cluster</strong></td><td><strong>Removed target</strong></td></tr>${rowsHtml}</table>
      <p class="hint">If you removed a device only to pair it again, cancel: once it's back with the same address, these bindings work again.
        Battery devices are usually asleep, so wake them (press a button) just before you start, or some unbinds may not go through.</p>
      <div class="dialog-actions">
        <button class="btn btn-danger" id="stale-unbind-confirm">Unbind ${dead.length}</button>
        <button class="btn" id="stale-unbind-cancel">Cancel</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#stale-unbind-cancel").addEventListener("click", () => this._closeDialog());
      this._q("#stale-unbind-confirm").addEventListener("click", () => {
        this._closeDialog();
        this._unbindDeadTargets(dead);
      });
    }
    /** Unbinds each binding in turn, then rescans just the sources involved
     *  (never the removed targets, which can't answer) and reports what is
     *  really gone, the same verify-against-a-rescan approach the single
     *  Unbind uses rather than trusting zha_toolkit's own result. */
    async _unbindDeadTargets(dead) {
      if (this._scanState.running) {
        this._setStatus("error", "A scan is already running. Try again when it has finished.");
        return;
      }
      const sources = [...new Map(dead.map((b) => [normIeee(b.sourceIeee), b.sourceIeee])).values()];
      const errors = [];
      for (let i = 0; i < dead.length; i++) {
        const b = dead[i];
        this._setStatus("info", `Unbinding ${i + 1} of ${dead.length}\u2026`, 0);
        try {
          await this._api.unbindIeee(b.sourceIeee, b.targetIeee, [b.clusterId], {
            endpoint: b.sourceEndpoint,
            dstEndpoint: b.targetEndpoint
          });
        } catch (err) {
          errors.push(toolkitErrorText(err));
          console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
        }
      }
      await this._scanBindings(sources);
      const stillThere = dead.filter(
        (b) => this._bindingPresent(b.sourceIeee, b.sourceEndpoint, b.clusterId, {
          isGroup: false,
          ieee: b.targetIeee,
          endpoint: b.targetEndpoint
        })
      );
      const removed = dead.length - stillThere.length;
      if (!stillThere.length) {
        this._setStatus("success", `Removed all ${removed} binding${removed === 1 ? "" : "s"} to removed devices.`);
      } else {
        const unreadable = sources.filter((s) => this._scanFailures.has(normIeee(s))).length;
        this._setStatus(
          "error",
          `Removed ${removed} of ${dead.length}. ${stillThere.length} still present${unreadable ? ` (${unreadable} device${unreadable === 1 ? "" : "s"} didn't respond to the check, probably asleep)` : ""}. ${explainUnbindFailure({ errors, targetRemoved: true }) || 'Wake those devices and click "Unbind all" again.'}`,
          0
        );
      }
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
      const lost = this._watchEnabled ? lostSummary(this._lost).total : 0;
      bindings.forEach((b) => {
        const h = healthMap.get(b.id);
        if (h) counts[h.level] = (counts[h.level] || 0) + 1;
      });
      el.style.display = "flex";
      el.innerHTML = `
      <span class="health-summary-title">Binding Health</span>
      <span class="muted">${bindings.length} binding${bindings.length === 1 ? "" : "s"} scanned</span>
      <span class="health-chip health-ok" title="Structurally valid: the devices, endpoint and cluster all exist. It doesn't prove the binding does what you meant.">${HEALTH_ICON.ok} ${counts.ok} Valid</span>
      ${counts.warning ? `<span class="health-chip health-warning">${HEALTH_ICON.warning} ${counts.warning} Warning${counts.warning === 1 ? "" : "s"}</span>` : ""}
      ${counts.error ? `<span class="health-chip health-error">${HEALTH_ICON.error} ${counts.error} Error${counts.error === 1 ? "" : "s"}</span>` : ""}
      ${counts.info ? `<span class="health-chip health-info">${HEALTH_ICON.info} ${counts.info} Info</span>` : ""}
      ${lost ? `<a href="#" class="health-chip health-error health-chip-lost" id="health-chip-lost" title="Bindings the devices had before and don't any more">${HEALTH_ICON.error} ${lost} Lost</a>` : ""}
    `;
      const chip = this._q("#health-chip-lost");
      if (chip)
        chip.addEventListener("click", (e) => {
          e.preventDefault();
          this._lostOpen = true;
          this._renderLostBanner();
          const b = this._q("#lost-banner");
          if (b && b.scrollIntoView) b.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
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
        <tr><td>Binding</td><td>${escapeHtml(sourceLabel)} (ep ${escapeHtml(String(binding.sourceEndpoint))}) \u2192 ${escapeHtml(
        targetLabel
      )}${binding.isGroup ? " (group)" : ` (ep ${escapeHtml(String(binding.targetEndpoint))})`}</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
      </table>
      ${detailHtml}
      <div class="dialog-actions">
        ${(health.code === "unable_to_verify" || health.code === "partial_scan") && source ? `<button class="btn" id="health-detail-rescan" data-ieee="${escapeHtml(source.ieee)}">Rescan now</button>` : ""}
        ${health.code === "source_missing" ? `<button class="btn" id="health-detail-forget" data-ieee="${escapeHtml(binding.sourceIeee)}">Forget</button>` : ""}
        <button class="btn" id="health-detail-close">Close</button>
      </div>`;
      this._q("#dialog").classList.add("open");
      this._q("#health-detail-close").addEventListener("click", () => this._closeDialog());
      const forgetBtn = this._q("#health-detail-forget");
      if (forgetBtn) forgetBtn.addEventListener("click", () => this._confirmForgetSources([forgetBtn.dataset.ieee]));
      const rescanBtn = this._q("#health-detail-rescan");
      if (rescanBtn) {
        rescanBtn.addEventListener("click", async () => {
          rescanBtn.disabled = true;
          rescanBtn.textContent = "Scanning\u2026";
          await this._rescanDeviceFull(rescanBtn.dataset.ieee, { tries: this._retryCount });
          this._closeDialog();
        });
      }
    }
    /** Sets (or clears, with null) the Bindings tab's device filter. Always
     *  resets the direction toggle to All so a new device never inherits the
     *  previous device's Outbound/Inbound choice. */
    _setTableDeviceFilter(ieee) {
      this._tableSourceFilter = ieee || null;
      this._tableDirection = DIRECTION_ALL;
    }
    /** "Add binding from X" from a filtered Bindings-tab source device now jumps straight to the
     *  Advanced tab with that device pre-selected as Source, instead of showing a separate
     *  target-picker popup first — see _jumpToAdvancedBind for why the popup was retired. */
    _openAddBindingFromFilter() {
      const sourceIeee = this._effectiveTableDevice().ieee;
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
          target_name: b.isGroup ? target && target.name || `Group ${escapeHtml(String(b.groupId))}` : target ? this._deviceLabel(target) : "",
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
    // -------------------------------------------------------------------
    // Groups tab (1.5.0): ZHA groups, their lights and the remotes bound to
    // them. Membership changes use ZHA's own websocket commands (what Home
    // Assistant's Groups page uses); bindings use zha-toolkit as elsewhere.
    // -------------------------------------------------------------------
    _renderGroupsTab() {
      const el = this._q("#view-groups");
      if (!el) return;
      if (!this._loaded) {
        el.innerHTML = `<p class="muted">Loading groups\u2026</p>`;
        return;
      }
      this._ensureHealthData();
      const coord = this._coordinatorIeee();
      const rows = groupRows({ groups: this._groups, bindings: this._rawBindings(), classify: (b) => this._classifyBinding(b), coordinatorIeee: coord });
      const busy = this._groupsBusy != null;
      const dis = busy ? "disabled" : "";
      const devLink = (ieee, extra = "") => {
        const d = this._devices.find((x) => normIeee(x.ieee) === normIeee(ieee));
        const name = escapeHtml(this._ieeeLabel(ieee, { plain: true }));
        return d ? `<a href="#" class="src-link groups-dev" data-ieee="${escapeHtml(d.ieee)}">${name}</a>${extra}` : `<span>${name} <span class="muted">(not in ZHA)</span></span>${extra}`;
      };
      const head = `<div class="groups-head">
        <p>A ZHA group is a set of lights that switch together. A remote bound to a group controls all of them with one command,
          and you can change which lights are in it without touching the remote.</p>
        <button class="btn btn-primary" id="groups-new" ${dis} title="Pick a remote and the lights it should control. The card makes or reuses a group, binds the remote to it and checks it works.">New group for a remote\u2026</button>
      </div>`;
      const orphans = deviceOnlyGroups({ groups: this._groups, bindings: this._rawBindings(), classify: (b) => this._classifyBinding(b), coordinatorIeee: coord });
      const orphanHtml = orphans.length ? `<section class="group-card group-orphans">
          <div class="group-card-head"><strong>Groups only on devices</strong>
            <span class="muted">${orphans.length} group${orphans.length === 1 ? "" : "s"} Home Assistant doesn't know</span></div>
          <p class="hint">Bindings point at ${orphans.length === 1 ? "this group" : "these groups"}, but ${orphans.length === 1 ? "it isn't" : "they aren't"} in ZHA. Usually
            made on the devices themselves (Find & Bind, or a remote's pairing button). Devices that joined still receive the commands;
            Home Assistant can't tell which devices those are. Adding it to Home Assistant lets you see and change its lights here
            (add them with Add lights\u2026 afterwards: devices already in it are fine to add again).</p>
          <ul class="groups-list">${orphans.map(
        (o) => `<li><strong>${groupIdHex(o.groupId)}</strong> <span class="muted">(${o.groupId})</span> used by
                ${o.controllers.length ? o.controllers.map((c) => devLink(c.sourceIeee, ` <span class="muted">ep ${c.endpoint}: ${escapeHtml(c.clusters.map(clusterName).join(", "))}</span>`)).join(", ") : `<span class="muted">${o.others} reporting binding${o.others === 1 ? "" : "s"}</span>`}
                <input type="text" class="groups-orphan-name" data-gid="${o.groupId}" value="${escapeHtml(`Group ${groupIdHex(o.groupId)}`)}" aria-label="Name for the new group" ${dis}>
                <button class="btn btn-small" data-group-adopt="${o.groupId}" ${dis} title="Creates a ZHA group with this same group ID, so the bindings point at a group Home Assistant knows">Add to Home Assistant</button></li>`
      ).join("")}</ul>
        </section>` : "";
      if (!rows.length) {
        el.innerHTML = `${head}<p class="muted">No ZHA groups yet. <strong>New group for a remote\u2026</strong> creates one.</p>${orphanHtml}`;
        this._wireGroupsTab(rows);
        return;
      }
      const cards = rows.map((r) => {
        const area = (ieee) => {
          const d = this._devices.find((x) => normIeee(x.ieee) === ieee);
          return d && d.area_id ? ` <span class="muted">${escapeHtml(this._areaName(d.area_id))}</span>` : "";
        };
        const members = r.members.length ? `<ul class="groups-list">${r.members.map(
          (m) => `<li>${devLink(m.ieee, ` <span class="muted">ep ${m.endpoint}</span>${area(m.ieee)}`)}
                <button class="btn btn-small" data-group-remove="${r.groupId}|${escapeHtml(m.ieee)}|${m.endpoint}" ${dis} title="Take this light out of the group (ZHA tells the light straight away)">Remove</button></li>`
        ).join("")}</ul>` : `<p class="muted">No lights in it.</p>`;
        const controllers = r.controllers.length ? `<ul class="groups-list">${r.controllers.map((c) => `<li>${devLink(c.sourceIeee, ` <span class="muted">ep ${c.endpoint}: ${escapeHtml(c.clusters.map(clusterName).join(", "))}</span>`)}</li>`).join("")}</ul>` : `<p class="muted">No remote is bound to it${this._rawBindings().length ? "" : " (or bindings haven't been scanned yet)"}.</p>`;
        const others = r.others ? `<p class="hint">${r.others} other binding${r.others === 1 ? " to this group isn't" : "s to this group aren't"} control: a device reporting its own state, or a manufacturer-specific cluster the device set up itself.</p>` : "";
        return `<section class="group-card ${this._groupsFocus === r.groupId ? "group-focus" : ""}" data-gid="${r.groupId}">
        <div class="group-card-head">
          <strong>\u{1F465} ${escapeHtml(r.name)}</strong>
          <span class="muted">${groupIdHex(r.groupId)} \xB7 ${r.members.length} light${r.members.length === 1 ? "" : "s"}</span>
          <span class="spacer"></span>
          <button class="btn btn-small" data-group-add="${r.groupId}" ${dis}>Add lights\u2026</button>
          <button class="btn btn-small" data-group-remote="${r.groupId}" ${dis} title="Bind a remote to this group, step by step">Add a remote\u2026</button>
          <button class="btn btn-small btn-danger" data-group-delete="${r.groupId}" ${dis}>Delete group\u2026</button>
        </div>
        <div class="group-cols">
          <div><div class="drawer-section-title">Lights</div>${members}</div>
          <div><div class="drawer-section-title">Controlled by</div>${controllers}${others}</div>
        </div>
        ${this._groupsAddOpen === r.groupId ? this._groupsAddHtml(r) : ""}
        ${this._groupsDeleteOpen === r.groupId ? this._groupsDeleteHtml(r) : ""}
      </section>`;
      });
      el.innerHTML = head + cards.join("") + orphanHtml;
      this._wireGroupsTab(rows);
      if (this._groupsFocus != null) {
        const sec = this._q(`#view-groups .group-card[data-gid="${this._groupsFocus}"]`);
        if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "nearest" });
        this._groupsFocus = null;
      }
    }
    _groupsAddHtml(r) {
      if (!this._groupsCandidatesReady) {
        return `<div class="drawer-share"><p class="muted">Finding lights\u2026</p></div>`;
      }
      const coord = normIeee(this._coordinatorIeee() || "");
      const inGroup = new Set(r.members.map((m) => `${m.ieee}:${m.endpoint}`));
      const list2 = candidateTargets({
        devices: this._devices.filter((d) => !this._isRemovedDevice(d.ieee)).map((d) => ({ ieee: d.ieee, name: this._deviceLabel(d), isCoordinator: normIeee(d.ieee) === coord || d.device_type === "Coordinator" })),
        clustersFor: (ieee) => this._clusterCache.get(ieee),
        sourceIeee: "",
        clusterIds: FLOW_CLUSTERS
      }).filter((t) => !inGroup.has(`${normIeee(t.ieee)}:${t.endpoint}`));
      const canJoin = list2.filter((t) => t.groupable !== false);
      if (!canJoin.length && !list2.length) {
        return `<div class="drawer-share"><p>Every device that accepts On/Off, Level, Colour or Window Covering commands is already in this group.</p>
        <div class="dialog-actions"><button class="btn btn-small" id="groups-add-cancel">Close</button></div></div>`;
      }
      return `<div class="drawer-share groups-add">
      <p>Choose the lights to add. ZHA adds each one to the group straight away; the remotes bound to the group control them from then on.</p>
      <div class="groups-pick">${list2.map(
        (t) => t.groupable === false ? `<label class="row muted" title="This light has no Groups cluster, so it can't be added to a group. Bind the remote to it directly instead (Set up what this controls\u2026, Directly)."><input type="checkbox" disabled> ${escapeHtml(t.name)} <span class="flow-tag">can't join groups</span></label>` : `<label class="row"><input type="checkbox" data-add-key="${escapeHtml(t.ieee)}|${t.endpoint}"> ${escapeHtml(t.name)} <span class="muted">${escapeHtml(t.clusters.map(clusterName).join(", "))}</span></label>`
      ).join("")}</div>
      ${canJoin.length < list2.length ? `<p class="hint">Greyed-out lights have no Groups cluster, so they can't be in a group. A remote can still control them directly.</p>` : ""}
      <div class="dialog-actions"><button class="btn btn-primary btn-small" id="groups-add-go" disabled>Add</button><button class="btn btn-small" id="groups-add-cancel">Cancel</button></div>
    </div>`;
    }
    _groupsDeletePlan(gid) {
      return groupUnbindPlan(gid, this._rawBindings(), { clustersFor: (ieee) => this._clusterCache.get(ieee) });
    }
    _groupsDeleteHtml(r) {
      const plan = this._groupsDeletePlan(r.groupId);
      const sources = [...new Set(plan.map((p) => p.sourceIeee))];
      const nameOf = (i) => escapeHtml(this._ieeeLabel(i, { plain: true }));
      const battery = sources.filter((i) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === i);
        return d && this._isBatteryDevice(d);
      });
      const common = `<p>The lights stay in Home Assistant; only the group goes, and with it the group's light entity in Home Assistant.
      Check that no automation or dashboard uses it.</p>`;
      const result = this._groupsDeleteResult && this._groupsDeleteResult.gid === r.groupId ? this._groupsDeleteResult : null;
      if (!plan.length) {
        return `<div class="drawer-share groups-delete">${common}
        <div class="dialog-actions"><button class="btn btn-danger btn-small" id="groups-delete-anyway">Delete group</button><button class="btn btn-small" id="groups-delete-cancel">Cancel</button></div></div>`;
      }
      const leftNames = result ? result.left.map(nameOf).join(", ") : sources.map(nameOf).join(", ");
      const reporting = plan.filter((p) => p.method !== "group");
      return `<div class="drawer-share groups-delete">
      ${result ? `<p><strong>Not deleted yet: ${result.left.length === 1 ? "1 device still has" : `${result.left.length} devices still have`} bindings to this group.</strong></p>
             <ul class="groups-reasons">${result.reasons.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : `<p><strong>${plan.length} binding${plan.length === 1 ? "" : "s"} still point${plan.length === 1 ? "s" : ""} to this group</strong>, from
              ${sources.map(nameOf).join(", ")}. Deleted on its own, the group leaves them on ${sources.length === 1 ? "that device" : "those devices"},
              sending commands to nobody and using up binding slots.</p>
             ${reporting.length ? `<p class="hint">${[...new Set(reporting.map((p) => p.sourceIeee))].map(nameOf).join(", ")} only report${reporting.length === 1 ? "s" : ""} ${reporting.length === 1 ? "its" : "their"} own state to the group; those bindings are removed too.</p>` : ""}
             ${battery.length ? `<p class="hint"><strong>Wake ${battery.map(nameOf).join(", ")} first</strong> (press a button): battery devices only listen just after they're used.</p>` : ""}`}
      ${common}
      <div class="dialog-actions">
        <button class="btn btn-primary btn-small" id="groups-delete-clean">${result ? "Try again" : "Unbind them, then delete"}</button>
        <button class="btn btn-danger btn-small" id="groups-delete-anyway" title="Deletes the group and leaves these bindings on the devices">${result ? `Delete and leave ${result.left.length === 1 ? "this binding" : "these bindings"}` : "Delete anyway"}</button>
        <button class="btn btn-small" id="groups-delete-cancel">Cancel</button>
      </div>
      ${result ? `<p class="hint">Leaving them: ${leftNames} keep${result.left.length === 1 ? "s" : ""} a binding to a group that no longer exists. You can remove it later from the Bindings tab once ${result.left.length === 1 ? "it's" : "they're"} back online.</p>` : ""}
    </div>`;
    }
    _wireGroupsTab(rows) {
      const root = this._q("#view-groups");
      if (!root) return;
      const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.addEventListener("click", fn));
      on("#groups-new", () => this._openGroupFlowPickRemote());
      on(".groups-dev", (e) => {
        e.preventDefault();
        const d = this._devices.find((x) => x.ieee === e.currentTarget.dataset.ieee);
        if (d) this._openDeviceDrawer(d);
      });
      on("[data-group-adopt]", (e) => {
        const gid = Number(e.currentTarget.dataset.groupAdopt);
        const input = root.querySelector(`.groups-orphan-name[data-gid="${gid}"]`);
        this._groupsAdopt(gid, (input && input.value || "").trim() || `Group ${groupIdHex(gid)}`);
      });
      on("[data-group-remote]", (e) => this._openGroupFlowPickRemote({ groupId: Number(e.currentTarget.dataset.groupRemote) }));
      on("[data-group-add]", async (e) => {
        const gid = Number(e.currentTarget.dataset.groupAdd);
        this._groupsDeleteOpen = null;
        this._groupsAddOpen = this._groupsAddOpen === gid ? null : gid;
        this._renderGroupsTab();
        if (this._groupsAddOpen != null && !this._groupsCandidatesReady) {
          await Promise.all(this._devices.map((d) => this._ensureClusters(d.ieee).catch(() => {
          })));
          this._groupsCandidatesReady = true;
          if (this._view === "groups") this._renderGroupsTab();
        }
      });
      on("[data-group-delete]", (e) => {
        const gid = Number(e.currentTarget.dataset.groupDelete);
        this._groupsAddOpen = null;
        this._groupsDeleteResult = null;
        this._groupsDeleteOpen = this._groupsDeleteOpen === gid ? null : gid;
        this._renderGroupsTab();
      });
      on("[data-group-remove]", (e) => {
        const [gid, ieee, ep] = e.currentTarget.dataset.groupRemove.split("|");
        this._groupsRemoveMember(Number(gid), ieee, Number(ep));
      });
      on("#groups-add-cancel", () => {
        this._groupsAddOpen = null;
        this._renderGroupsTab();
      });
      const boxes = [...root.querySelectorAll("[data-add-key]")];
      const go = root.querySelector("#groups-add-go");
      boxes.forEach(
        (b) => b.addEventListener("change", () => {
          const n = boxes.filter((x) => x.checked).length;
          if (go) {
            go.disabled = !n;
            go.textContent = n ? `Add ${n}` : "Add";
          }
        })
      );
      if (go)
        go.addEventListener("click", () => {
          const members = boxes.filter((x) => x.checked).map((x) => {
            const [ieee, ep] = x.dataset.addKey.split("|");
            return { ieee, endpoint: Number(ep) };
          });
          this._groupsAddMembers(this._groupsAddOpen, members);
        });
      on("#groups-delete-cancel", () => {
        this._groupsDeleteOpen = null;
        this._groupsDeleteResult = null;
        this._renderGroupsTab();
      });
      on("#groups-delete-anyway", () => this._groupsDelete(this._groupsDeleteOpen, { unbindFirst: false }));
      on("#groups-delete-clean", () => this._groupsDelete(this._groupsDeleteOpen, { unbindFirst: true }));
    }
    _groupsLabel(gid) {
      const g = (this._groups || []).find((x) => Number(x.group_id) === Number(gid));
      return g ? g.name || `Group ${gid}` : `Group ${gid}`;
    }
    async _groupsRefresh() {
      await this._reloadDevices({ quiet: true });
      this._render();
    }
    async _groupsAddMembers(gid, members) {
      if (gid == null || !members.length || this._groupsBusy != null) return;
      const name = this._groupsLabel(gid);
      this._groupsBusy = gid;
      this._setStatus("info", `Adding ${members.length} light${members.length === 1 ? "" : "s"} to ${name}\u2026`, 0);
      try {
        await this._api.addGroupMembers(gid, members);
        this._groupsAddOpen = null;
        await this._groupsRefresh();
        const g = this._groups.find((x) => Number(x.group_id) === gid);
        const have = new Set((g && g.members || []).map((m) => `${normIeee(m.device && m.device.ieee)}:${Number(m.endpoint_id)}`));
        const missing = members.filter((m) => !have.has(`${normIeee(m.ieee)}:${m.endpoint}`));
        if (missing.length) {
          const label = (m) => this._ieeeLabel(m.ieee, { plain: true });
          const noGroups = missing.filter((m) => {
            const cl = this._clusterCache.get(m.ieee);
            return cl && !endpointHasGroups(cl, m.endpoint);
          });
          const other = missing.filter((m) => !noGroups.includes(m));
          const parts = [];
          if (noGroups.length) parts.push(`${noGroups.map(label).join(", ")} can't join groups (no Groups cluster). Bind the remote to ${noGroups.length === 1 ? "it" : "them"} directly instead.`);
          if (other.length) parts.push(`ZHA didn't list ${other.map(label).join(", ")} in ${name} afterwards. Check the light is online and try again.`);
          this._setStatus("error", parts.join(" "), 0);
        } else {
          this._setStatus("success", `Added ${members.map((m) => this._ieeeLabel(m.ieee, { plain: true })).join(", ")} to ${name}.`);
        }
      } catch (err) {
        this._setStatus("error", `Couldn't add to ${name}: ${toolkitErrorText(err)}`, 0);
      } finally {
        this._groupsBusy = null;
        this._renderGroupsTab();
      }
    }
    /** Creates a ZHA group with the id a device-only group already uses. */
    async _groupsAdopt(gid, name) {
      if (this._groupsBusy != null) return;
      this._groupsBusy = gid;
      this._renderGroupsTab();
      this._setStatus("info", `Adding ${name} to Home Assistant\u2026`, 0);
      try {
        await this._api.createGroupWithId(name, gid);
        await this._groupsRefresh();
        this._groupsFocus = gid;
        this._setStatus("success", `${name} is now a Home Assistant group. Use Add lights\u2026 to list the lights that are in it.`, 0);
      } catch (err) {
        this._setStatus("error", `Couldn't add ${name}: ${toolkitErrorText(err)}`, 0);
      } finally {
        this._groupsBusy = null;
        this._renderGroupsTab();
      }
    }
    async _groupsRemoveMember(gid, ieee, endpoint) {
      if (this._groupsBusy != null) return;
      const name = this._groupsLabel(gid);
      const who = this._ieeeLabel(ieee, { plain: true });
      this._groupsBusy = gid;
      this._renderGroupsTab();
      this._setStatus("info", `Removing ${who} from ${name}\u2026`, 0);
      try {
        await this._api.removeGroupMembers(gid, [{ ieee, endpoint }]);
        await this._groupsRefresh();
        this._setStatus("success", `Removed ${who} from ${name}. Remotes bound to ${name} no longer control it.`);
      } catch (err) {
        this._setStatus("error", `Couldn't remove ${who} from ${name}: ${toolkitErrorText(err)}`, 0);
      } finally {
        this._groupsBusy = null;
        this._renderGroupsTab();
      }
    }
    async _groupsDelete(gid, { unbindFirst }) {
      if (gid == null || this._groupsBusy != null) return;
      const name = this._groupsLabel(gid);
      this._groupsBusy = gid;
      this._renderGroupsTab();
      try {
        if (unbindFirst) {
          await Promise.all(
            [...new Set(this._rawBindings().filter((b) => b.isGroup && Number(b.groupId) === gid).map((b) => normIeee(b.sourceIeee)))].map(
              (i) => this._ensureClusters(i).catch(() => {
              })
            )
          );
          const plan = this._groupsDeletePlan(gid);
          const sources = [...new Set(plan.map((p) => p.sourceIeee))];
          const errors = new Map(sources.map((i) => [i, []]));
          this._setStatus("info", `Unbinding ${plan.length} binding${plan.length === 1 ? "" : "s"} from ${name}\u2026`, 0);
          for (const op of plan) {
            if (op.method === "skip") continue;
            try {
              if (op.method === "remove") await this._api.removeBindingsOnCluster(op.sourceIeee, op.endpoint, op.clusterId);
              else await this._api.unbindGroup(op.sourceIeee, gid, [op.clusterId], { endpoint: op.endpoint });
            } catch (err) {
              errors.get(op.sourceIeee).push(toolkitErrorText(err).replace(/^unbind_group failed:\s*/i, ""));
            }
          }
          const scan = await this._scanBindings(sources, { tries: this._retryCount });
          const read = scan && scan.read || /* @__PURE__ */ new Set();
          const left = groupUnbindPlan(gid, this._rawBindings());
          if (left.length) {
            const leftSources = [...new Set(left.map((p) => p.sourceIeee))];
            const skipped = new Set(plan.filter((p) => p.method === "skip").map((p) => p.sourceIeee));
            const reasons = groupDeleteReasons(
              leftSources.map((i) => {
                const d = this._devices.find((x) => normIeee(x.ieee) === i);
                return {
                  ieee: i,
                  name: this._ieeeLabel(i, { plain: true }),
                  battery: !!(d && this._isBatteryDevice(d)),
                  skipped: skipped.has(i) && !(errors.get(i) || []).length,
                  errors: errors.get(i) || [],
                  answered: read.has(i)
                };
              })
            );
            this._groupsDeleteResult = { gid, left: leftSources, reasons };
            this._setStatus("error", `${name} wasn't deleted: ${leftSources.length === 1 ? "1 device still has" : `${leftSources.length} devices still have`} bindings to it. The reasons are under the group.`, 0);
            return;
          }
        }
        this._setStatus("info", `Deleting ${name}\u2026`, 0);
        await this._api.removeGroups([gid]);
        this._groupsDeleteOpen = null;
        this._groupsDeleteResult = null;
        await this._groupsRefresh();
        const gone = !this._groups.some((x) => Number(x.group_id) === gid);
        this._setStatus(gone ? "success" : "error", gone ? `Deleted ${name}.` : `ZHA still lists ${name} after deleting it. Try again.`, gone ? void 0 : 0);
      } catch (err) {
        this._setStatus("error", `Couldn't delete ${name}: ${toolkitErrorText(err)}`, 0);
      } finally {
        this._groupsBusy = null;
        this._renderGroupsTab();
      }
    }
    _renderDevicesTab() {
      const wrap = this._q("#devices-table-body");
      if (!wrap) return;
      this._updateSortIndicators("#view-devices", this._devicesSort);
      if (!this._loaded) {
        wrap.innerHTML = `<tr><td colspan="8" class="muted">Loading devices\u2026</td></tr>`;
        return;
      }
      const search = (this._filters.search || "").trim();
      let rows = this._devices.filter((d) => this._deviceMatchesSearch(d, search)).map((d) => {
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
        wrap.innerHTML = search ? `<tr><td colspan="8" class="muted">No devices match \u201C${escapeHtml(search)}\u201D. Clear the search box to see all ${this._devices.length} devices.</td></tr>` : `<tr><td colspan="8" class="muted">No devices found.</td></tr>`;
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
        </tr>`
      ).join("");
      this._qa("#devices-table-body .src-link").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          this._openDeviceDrawer(this._devices.find((x) => x.ieee === el.dataset.ieee));
        });
      });
      this._qa("#devices-table-body .scan-cell-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.disabled = true;
          const original = btn.textContent;
          btn.textContent = "Scanning\u2026";
          this._rescanDeviceFull(btn.dataset.ieee, { tries: this._retryCount }).finally(() => {
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
    // 1.5.0 (local b4): one plan per Home Assistant floor. The top-level
    // imageUrl/positions stay the original plan (older cards keep reading it)
    // and belong to `legacyFloor`; other floors live in `floors[floorId]`.
    // Without HA floors everything behaves exactly as before.
    async _loadFloorplan() {
      let raw = null;
      try {
        raw = await this._storage.getItem(this._config.id, "floorplan");
      } catch (e) {
      }
      const obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
      raw = obj(raw);
      const floors = {};
      for (const [fid, plan] of Object.entries(obj(raw.floors))) {
        const p = obj(plan);
        floors[fid] = { imageUrl: typeof p.imageUrl === "string" ? p.imageUrl : "", positions: obj(p.positions) };
      }
      this._fpData = {
        imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
        positions: obj(raw.positions),
        floors,
        legacyFloor: typeof raw.legacyFloor === "string" ? raw.legacyFloor : null
      };
      const floorsNow = this._haFloors();
      this._fpFloor = typeof raw.activeFloor === "string" && floorsNow.some((f) => f.floor_id === raw.activeFloor) ? raw.activeFloor : this._fpLegacyFloor();
      this._fpBind();
    }
    async _saveFloorplan() {
      if (!this._fpData) this._fpData = { imageUrl: "", positions: {}, floors: {}, legacyFloor: null };
      const plan = this._fpPlanFor(this._fpFloor);
      plan.imageUrl = this._fpImageUrl || "";
      plan.positions = this._fpPositions;
      const legacy = this._fpLegacyFloor();
      await this._storage.setItem(this._config.id, "floorplan", {
        imageUrl: this._fpData.imageUrl,
        positions: this._fpData.positions,
        floors: this._fpData.floors,
        legacyFloor: legacy,
        activeFloor: this._fpFloor || null
      });
    }
    /** Home Assistant floors (Settings → Areas, labels & zones → Floors),
     *  lowest level first. Empty when none are set up. */
    _haFloors() {
      const floors = this._hass && this._hass.floors || {};
      return Object.values(floors).filter((f) => f && f.floor_id).sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || String(a.name).localeCompare(String(b.name)));
    }
    _floorName(fid) {
      const f = this._haFloors().find((x) => x.floor_id === fid);
      return f ? f.name : "";
    }
    /** The floor the original single plan belongs to: as saved, else the
     *  lowest floor. null without HA floors. */
    _fpLegacyFloor() {
      const floors = this._haFloors();
      if (!floors.length) return null;
      const saved = this._fpData && this._fpData.legacyFloor;
      return saved && floors.some((f) => f.floor_id === saved) ? saved : floors[0].floor_id;
    }
    _fpPlanFor(fid) {
      if (!this._fpData) this._fpData = { imageUrl: "", positions: {}, floors: {}, legacyFloor: null };
      if (!fid || fid === this._fpLegacyFloor()) return this._fpData;
      if (!this._fpData.floors[fid]) this._fpData.floors[fid] = { imageUrl: "", positions: {} };
      return this._fpData.floors[fid];
    }
    _fpBind() {
      const plan = this._fpPlanFor(this._fpFloor);
      if (!plan.positions || typeof plan.positions !== "object") plan.positions = {};
      this._fpImageUrl = plan.imageUrl || "";
      this._fpPositions = plan.positions;
    }
    _fpSwitchFloor(fid) {
      if (fid === this._fpFloor) return;
      const plan = this._fpPlanFor(this._fpFloor);
      plan.imageUrl = this._fpImageUrl || "";
      this._fpFloor = fid;
      this._fpBind();
      this._fpImageSize = null;
      this._fpViewbox = null;
      this._saveFloorplan();
      this._loadFpImage(this._fpImageUrl);
    }
    /** Floor of a device, strongest signal first: placed on a floor's own
     *  plan; its area's floor in Home Assistant; placed on the original plan
     *  (made before floors existed, so it's only a fallback). null if none. */
    _deviceFloor(ieee) {
      const id = normIeee(ieee);
      const floors = this._haFloors();
      if (!floors.length) return null;
      if (this._fpData) {
        for (const [fid, plan] of Object.entries(this._fpData.floors || {})) {
          if (fid !== this._fpLegacyFloor() && plan.positions && plan.positions[id] && floors.some((f) => f.floor_id === fid)) return fid;
        }
      }
      const d = this._devices.find((x) => normIeee(x.ieee) === id);
      const area = d && d.area_id && this._hass && this._hass.areas && this._hass.areas[d.area_id];
      if (area && area.floor_id) return area.floor_id;
      if (this._fpData && this._fpData.positions && this._fpData.positions[id]) return this._fpLegacyFloor();
      return null;
    }
    /** A device sits on one plan only: placing it on this floor removes it elsewhere. */
    _fpForgetElsewhere(ieee) {
      if (!this._fpData) return;
      const plans = [this._fpData, ...Object.values(this._fpData.floors || {})];
      for (const plan of plans) {
        if (plan.positions !== this._fpPositions && plan.positions) delete plan.positions[ieee];
      }
    }
    /** Natural size of any floor's image (cached; loads it if needed). */
    _imgSize(url, onLoad) {
      if (!url) return null;
      this._imgSizes = this._imgSizes || {};
      if (this._imgSizes[url]) return this._imgSizes[url] === "loading" || this._imgSizes[url] === "error" ? null : this._imgSizes[url];
      this._imgSizes[url] = "loading";
      const img = new Image();
      img.onload = () => {
        this._imgSizes[url] = { w: img.naturalWidth, h: img.naturalHeight };
        if (onLoad) onLoad();
      };
      img.onerror = () => {
        this._imgSizes[url] = "error";
      };
      img.src = url;
      return null;
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
      this._renderFpFloorPicker();
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
    /** Floor picker + setup help on the Floor Plan tab (1.5.0 local b4). */
    _renderFpFloorPicker() {
      const wrap = this._q("#fp-floor-wrap");
      const help = this._q("#fp-floor-help");
      if (!wrap || !help) return;
      const floors = this._haFloors();
      if (!floors.length) {
        wrap.style.display = "none";
        help.innerHTML = `<details><summary>House on more than one floor?</summary>
        You can give each floor its own plan. Set up floors in Home Assistant first:
        <ol>
          <li><strong>Settings \u2192 Areas, labels &amp; zones \u2192 Floors</strong>: add a floor for each level (for example Ground floor and First floor), with its level number (0, 1, \u2026).</li>
          <li><strong>Settings \u2192 Areas, labels &amp; zones \u2192 Areas</strong>: open each area and choose its floor.</li>
          <li>Reload this page. A <strong>Floor</strong> picker appears here: choose a floor, set its image, and place its devices.</li>
        </ol>
        Your current plan becomes the lowest floor's plan, so nothing is lost. A device's floor comes from its area; placing it on a floor's plan overrides that.</details>`;
        return;
      }
      wrap.style.display = "";
      const sel = this._q("#fp-floor");
      if (sel && document.activeElement !== sel) {
        sel.innerHTML = floors.map((f) => `<option value="${escapeHtml(f.floor_id)}" ${f.floor_id === this._fpFloor ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("");
      }
      const noArea = this._devices.filter((d) => !this._deviceFloor(d.ieee)).length;
      help.innerHTML = `<span class="muted">Each floor has its own image and placements. A device's floor comes from its area's floor in Home Assistant
      (Settings \u2192 Areas, labels &amp; zones); placing it on a floor's plan overrides that.${noArea ? ` ${noArea} device${noArea === 1 ? " has" : "s have"} no floor yet: ${noArea === 1 ? "it's" : "they're"} listed on every floor until placed.` : ""}</span>`;
    }
    _renderFpUnplacedList() {
      const list2 = this._q("#fp-unplaced-list");
      if (!list2) return;
      if (!this._loaded) {
        list2.innerHTML = `<span class="muted">Loading devices\u2026</span>`;
        return;
      }
      const placed = new Set(Object.keys(this._fpPositions));
      const floors = this._haFloors();
      const unplaced = this._devices.filter((d) => {
        if (placed.has(d.ieee)) return false;
        if (!floors.length) return true;
        const f = this._deviceFloor(d.ieee);
        return !f || f === this._fpFloor;
      });
      const misplaced = floors.length ? this._devices.filter((d) => placed.has(d.ieee) && this._deviceFloor(d.ieee) && this._deviceFloor(d.ieee) !== this._fpFloor) : [];
      if (!unplaced.length && !misplaced.length) {
        list2.innerHTML = `<span class="muted">All devices ${floors.length ? "on this floor " : ""}placed.</span>`;
        return;
      }
      list2.innerHTML = unplaced.map((d) => `<div class="fp-chip" data-ieee="${escapeHtml(d.ieee)}">${escapeHtml(this._deviceLabel(d))}</div>`).join("") + (misplaced.length ? `<p class="hint">On this plan but on another floor in Home Assistant: ${misplaced.map((d) => `${escapeHtml(this._deviceLabel(d))} (${escapeHtml(this._floorName(this._deviceFloor(d.ieee)))})`).join(", ")}. Click one on the plan to remove it, then place it on its own floor's plan.</p>` : "");
      list2.querySelectorAll(".fp-chip").forEach((el) => {
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
      this._fpForgetElsewhere(ieee);
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
        <p class="capexp-mission">Understand what Zigbee devices report \u2014 from real community scans, not
          manufacturer claims.</p>
        <p class="hint" style="margin-top:0">Based on real scans, not manufacturer claims \u2014 nothing about your
          devices (IEEE addresses, entities, areas, names) ever leaves this browser. Only covers devices someone's
          already scanned and shared, so a gap here means nobody's confirmed it yet, not that it doesn't exist. See
          the <a href="https://github.com/${CAPABILITY_DB_REPO}" target="_blank" rel="noopener">zigbee-capabilities</a>
          database.</p>
        <p class="hint" style="margin-top:0">Capabilities are inferred from what the device itself reports \u2014 this
          doesn't necessarily mean they're currently exposed or usable in ZHA or Zigbee2MQTT.</p>
        <div id="capexp-discoveries"></div>
        <div class="capexp-modes">
          <button class="capexp-mode-btn active" data-capexp-mode="explore">
            <span class="capexp-mode-title">Explore my devices</span>
            <span class="capexp-mode-sub">What can this device do?</span>
          </button>
          <button class="capexp-mode-btn" data-capexp-mode="search">
            <span class="capexp-mode-title">Find a device</span>
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
        if (this._drawerIeee && this._q("#drawer-body")) this._renderDrawer();
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
      statusEl.textContent = `${this._capExpIndex.length} firmware observation${this._capExpIndex.length === 1 ? "" : "s"} from the community database${this._capExpLoading ? " (refreshing\u2026)" : ""}`;
      const stripCountEl = this._q("#capexp-strip-count");
      if (stripCountEl) {
        const uniqueDevices = new Set(this._capExpIndex.map((e) => `${e.manufacturer_slug}|${e.model_slug}`));
        stripCountEl.textContent = uniqueDevices.size;
      }
      const discoveriesEl = this._q("#capexp-discoveries");
      if (discoveriesEl) {
        const discoveries = interestingDiscoveries(this._capExpIndex);
        this._capExpDiscoveries = discoveries;
        discoveriesEl.innerHTML = `<div class="capexp-discoveries">
             <div class="capexp-discoveries-label">Community heartbeat</div>
             <p class="capexp-discoveries-lead">This dataset is entirely community-built. Every scan shared by the
               community adds real evidence for others deciding whether to buy or configure a device.</p>
             ${discoveries.length ? `<ul class="capexp-discoveries-list">${discoveries.map((d) => `<li>${escapeHtml(d.text)}</li>`).join("")}</ul>` : ""}
           </div>`;
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
          const epScan = (entry.scan.endpoints || []).find((e) => Number(e.id) === ep);
          const identity = epScan && this._extractIdentity(epScan);
          if (identity && identity.sw_build_id) return identity.sw_build_id;
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
    // Renders confidenceStars()' rating as a filled/empty star string (★★★★☆)
    // — or, when the community's own scans conflict with each other, a
    // distinct "Conflicting" callout instead of a star count, since that's a
    // data-quality flag rather than simply "less mature evidence" (see
    // confidenceStars' own doc comment). The full scan count is always in
    // the tooltip, never hidden — this is a friendlier headline, not a
    // replacement for the real evidence.
    _capExpStarsHtml(rating) {
      if (rating.conflicting) {
        return `<span class="capexp-trust-stars capexp-trust-conflict" title="Community confidence: the community's own scans disagree with each other for this device \u2014 see Technical evidence below">\u26A0 Conflicting</span>`;
      }
      const filled = "\u2605".repeat(rating.stars);
      const empty = "\u2606".repeat(5 - rating.stars);
      return `<span class="capexp-trust-stars" title="Community confidence: ${rating.stars}/5, based on ${rating.totalScans} scan${rating.totalScans === 1 ? "" : "s"}">${filled}${empty}</span>`;
    }
    // Shared by Explore My Devices and Find a Device — one compact
    // "Community confidence" panel (star rating + firmware/observation
    // counts + last confirmed) instead of duplicating this markup per mode.
    _capExpTrustPanelHtml(rating, fwCount, fwLabel, totalScans, lastSeen) {
      return `<div class="capexp-trust-panel">
      ${this._capExpStarsHtml(rating)}
      <div class="capexp-trust-text">
        <span class="capexp-trust-label">Community confidence</span>
        <span class="capexp-evidence-tag" title="Evidence level: this is based on what the device itself reported during a scan. Community-observed, function-verified and integration-confirmed evidence aren't tracked yet \u2014 this is the only evidence tier that exists so far.">Reported by device</span>
        <div class="capexp-trust-detail muted">
          ${fwCount} firmware version${fwCount === 1 ? "" : "s"}${fwLabel ? ` (${escapeHtml(fwLabel)})` : ""} \xB7
          ${totalScans} observation${totalScans === 1 ? "" : "s"}${lastSeen ? ` \xB7 last confirmed ${escapeHtml(this._capExpFormatDate(lastSeen))}` : ""}
        </div>
      </div>
    </div>`;
    }
    // Shared by Explore My Devices and Find a Device. `possessive` lets each
    // mode word the caveat correctly — Explore mode is about a device the
    // reader owns ("...than yours"), Search results are about devices they
    // may not ("...than this record's firmware").
    //
    // Labeled "Reported capabilities" rather than "Good for" (Capability
    // Evidence Clarity round): "Good for" read as purchasing advice this
    // card was never in a position to give — these are cluster/command
    // evidence the device itself reported during a scan, not a confirmed,
    // functioning, integration-tested recommendation. Internal method name
    // and CSS classes kept as-is to avoid unnecessary churn; only the
    // user-visible label changed.
    _capExpGoodForHtml(goodFor, possessive = "yours") {
      if (!goodFor.length) return "";
      return `<div class="capexp-goodfor">
      <span class="capexp-cap-label">Reported capabilities</span>
      <div class="capexp-goodfor-tags">${goodFor.map(
        (t) => `<span class="capexp-tag capexp-goodfor-tag"${t.exactFirmware ? "" : ` title="Reported on a different firmware than ${possessive} \u2014 likely still applies, but not confirmed on that exact version."`}>${escapeHtml(t.label)}${t.exactFirmware ? "" : " *"}</span>`
      ).join("")}</div>
    </div>`;
    }
    // "External references" (PRD: "External Device References", ported
    // from docs/app.js in the zigbee-capabilities repo) — a Blakadder page
    // and/or an official manufacturer/product page for this device, shown
    // as supplementary context only. Deliberately reads nothing but
    // `references.blakadder.url`/`references.manufacturer.url`: this must
    // never gain access to, or influence, capability or confidence data.
    // Renders nothing at all when neither link is present.
    _capExpExternalReferencesHtml(references, manufacturer) {
      if (!references) return "";
      const links = [];
      if (references.blakadder && references.blakadder.url && references.blakadder.confidence === "high") {
        links.push({ label: "Blakadder", url: references.blakadder.url });
      }
      if (references.manufacturer && references.manufacturer.url && references.manufacturer.confidence === "high") {
        const mfrLabel = manufacturer ? isGenericTuyaManufacturer(manufacturer) ? GENERIC_TUYA_LABEL : manufacturer : "Manufacturer";
        links.push({ label: mfrLabel, url: references.manufacturer.url });
      }
      if (!links.length) return "";
      const linksHtml = links.map(
        (l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)} \u2197</a>`
      ).join(" \xB7 ");
      return `<div class="capexp-external-refs muted">External references: ${linksHtml}</div>`;
    }
    // Deep-links to this device's entry on the public zigbee-capabilities
    // website (docs/app.js there reads ?manufacturer=&model= on load and
    // pre-runs the search) — lets someone jump from "what does my device
    // support" in this card straight to the full community record:
    // external references, every firmware version, per-endpoint detail.
    _capExpWebsiteUrl(manufacturer, model) {
      const params = new URLSearchParams();
      if (manufacturer) params.set("manufacturer", manufacturer);
      if (model) params.set("model", model);
      return `https://hsolgaard.github.io/zigbee-capabilities/?${params.toString()}`;
    }
    // Plain-language pill for the device-overview paragraph — mirrors
    // docs/app.js's overviewControlBadgeHtml in the zigbee-capabilities
    // website byte-for-byte (same wording, same badge-output/badge-input
    // color idiom, just the capexp- prefixed classes this card already uses
    // for everything else in this tab). Leads with everyday wording rather
    // than assuming a reader already knows the ZCL terms "Input"/"Output",
    // but doesn't hide those terms either — the plain phrase is paired with
    // the matching term in parentheses, and the hover tooltip spells out
    // what the term actually means, so a reader picks up the vocabulary
    // through repetition rather than needing it front-loaded.
    _capExpOverviewControlBadgeHtml(canControl) {
      return canControl ? `<span class="capexp-badge capexp-badge-output" title="This card calls this an Output capability: the device's own Zigbee signature declares that it can send this command directly to another device. That's a declaration, not an independently tested behavior \u2014 accurate for the large majority of devices, but occasionally a device declares more than its hardware actually uses.">Can control other devices (Output)</span>` : `<span class="capexp-badge capexp-badge-input" title="This card calls this Input only: this device can only receive this command \u2014 it has no declared way to send it to another device.">Can't control other devices (Input only)</span>`;
    }
    // Visible (non-hover) definition of Output/Input, shown directly under
    // the overview paragraph whenever it actually used one of those terms —
    // a hover tooltip alone is invisible until you happen to hover, and
    // doesn't exist on a touchscreen at all. Per Hans's instruction, the
    // deeper per-cluster explainer stays on the public website rather than
    // being duplicated in the card, so this links out to it instead of
    // building a local glossary page.
    _capExpOverviewRoleHintHtml(sentences) {
      if (!sentences.some((s) => s.kind === "control" || s.kind === "not-control")) return "";
      return `<div class="hint">
      <strong>Output</strong> means this device declares, in its own Zigbee signature, that it can send that command
      directly to another device over a Zigbee bind \u2014 without Home Assistant involved. That's the device's own
      declaration rather than an independently tested behavior: accurate for the large majority of devices, but
      occasionally a device declares a capability its hardware doesn't actually use. <strong>Input only</strong>
      means this device can only receive the command itself; it has no declared way to send it onward to control
      something else.
      <a href="${CAPEXP_CLUSTERS_URL}" target="_blank" rel="noopener noreferrer">What does this mean for each specific cluster? \u2197</a>
    </div>`;
    }
    // The "quick overview" a reader wants at a glance — 2-3 plain sentences
    // covering what the device can be commanded to do, what it senses/
    // reports, and (the most decision-relevant fact) whether it can directly
    // control another device over a bind. See deviceOverview's own doc
    // comment in capexplorer.js for why this is template-composed from
    // confirmed evidence rather than generated live by an LLM. Mirrors
    // docs/app.js's deviceOverviewHtml in the zigbee-capabilities website.
    _capExpDeviceOverviewHtml(entries) {
      const sentences = deviceOverview(entries);
      if (!sentences.length) return "";
      const text = sentences.map((s) => {
        if (s.kind === "control") return `${this._capExpOverviewControlBadgeHtml(true)} ${escapeHtml(s.text)}`;
        if (s.kind === "not-control") return `${this._capExpOverviewControlBadgeHtml(false)} ${escapeHtml(s.text)}`;
        return escapeHtml(s.text);
      }).join(" ");
      return `<div class="capexp-device-overview">${text}</div>${this._capExpOverviewRoleHintHtml(sentences)}`;
    }
    // Per-cluster Input/Output/Both badge for the capability groups panel —
    // mirrors docs/app.js's roleBadgeHtml in the zigbee-capabilities website.
    // This is the exact distinction a real support case spent over an hour
    // chasing before landing here: a device having existing bindings that
    // use a cluster does NOT mean it can control another device with that
    // cluster — an Input-only device can be commanded and can report its
    // own state over a binding, but has no way to issue that cluster's
    // commands outward.
    _capExpRoleBadgeHtml(role) {
      const label = CAPABILITY_ROLE_LABEL[role] || CAPABILITY_ROLE_LABEL.unknown;
      const explanation = CAPABILITY_ROLE_EXPLANATION[role] || CAPABILITY_ROLE_EXPLANATION.unknown;
      return `<span class="capexp-badge capexp-badge-${escapeHtml(role)}" title="${escapeHtml(explanation)}">${escapeHtml(
        label
      )}</span>`;
    }
    // Device photo for a Capability Explorer card — same zigbee2mqtt.io URL
    // derivation and AMBIGUOUS_TUYA_MODELS exclusion as the Exploded view's
    // own _deviceImageUrl (this just calls it), and the same "show device
    // photo" preference (this._showDevicePhotos) rather than a second,
    // separate toggle just for this tab: it's one card-level setting, not a
    // per-view one. Falls back to a generic placeholder box, not the
    // Exploded view's gang-count shape — there's no endpoint/gang context
    // for a bare search-result/index entry the way there is for a real
    // device you've scanned.
    _capExpDevicePhotoHtml(model, manufacturer) {
      if (!this._showDevicePhotos) return "";
      this._ensureZ2mModels();
      const imgUrl = this._deviceImageUrl({ model, manufacturer });
      if (!imgUrl) return `<div class="capexp-device-photo-fallback" aria-hidden="true"></div>`;
      return `<img src="${escapeHtml(imgUrl)}" alt="" loading="lazy" class="capexp-device-photo"
         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
       <div class="capexp-device-photo-fallback" style="display:none" aria-hidden="true"></div>`;
    }
    // Shared once above the first capability group, not repeated per group —
    // the badges themselves are self-explanatory once you know the rule
    // once. Mirrors docs/app.js's CAPABILITY_ROLE_LEGEND in the
    // zigbee-capabilities website. This is the exact distinction a real
    // support case spent over an hour chasing before landing here: a device
    // having existing bindings that use a cluster does NOT mean it can
    // control another device with that cluster — an Input-only device can
    // be commanded and can report its own state over a binding, but has no
    // way to issue that cluster's commands outward.
    _capExpRoleLegendHtml() {
      return `<div class="hint">
      <strong>Input</strong> = this device can be commanded with that cluster (by Home Assistant, or by another
      device bound to it). <strong>Output</strong> = this device declares, in its own Zigbee signature, that it can
      itself control another device using that cluster, via a direct Zigbee bind. That declaration isn't
      independently tested \u2014 it holds for the large majority of devices, but occasionally a device declares a
      capability its hardware doesn't actually use. Most switches and dimmers \u2014 even ones with a physical button \u2014
      are Input only: the button operates the device's own load, it doesn't send Zigbee commands to anything else.
    </div>`;
    }
    // Shared by Explore My Devices and Find a Device — the "Capabilities"
    // section (cluster/command groups) rendered inside each mode's
    // "Technical evidence" / "View capabilities" disclosure.
    _capExpCapabilitiesHtml(capGroups) {
      if (!capGroups.length) {
        return `<p class="muted">No confirmed commands or reporting clusters recorded yet.</p>`;
      }
      const shown = capGroups.filter((g) => g.identified || !g.reportsOnly || g.unscanned);
      const unidentifiedEmpty = capGroups.filter((g) => !g.identified && g.reportsOnly && !g.unscanned);
      const groupsHtml = shown.map(
        (g) => `
        <div class="capexp-cap-group">
          <span class="capexp-cap-group-label">${escapeHtml(g.label)}</span>
          ${this._capExpRoleBadgeHtml(g.role)}
          ${g.items.length ? `<div class="capexp-cap-tags">${g.items.map(
          (i) => `<span class="capexp-tag${i.firmwareDependent ? " capexp-tag-fwdep" : ""}">${escapeHtml(i.name)}${i.firmwareDependent ? " \xB7 firmware-dependent" : ""}</span>`
        ).join("")}</div>` : g.unscanned ? `<div class="capexp-cap-reportsonly hint">Declared as an output cluster \u2014 this device can potentially control another device with it, but this project's scans don't discover specific output-side commands.</div>` : `<div class="capexp-cap-reportsonly hint">Reports data on this cluster \u2014 no commands to send.</div>`}
        </div>`
      ).join("");
      const unidentifiedHtml = unidentifiedEmpty.length ? `<div class="capexp-cap-group capexp-cap-group-unidentified">
           <span class="capexp-cap-group-label">Other reported clusters</span>
           <div class="capexp-cap-reportsonly hint">Also reports on ${unidentifiedEmpty.length} manufacturer-specific cluster${unidentifiedEmpty.length === 1 ? "" : "s"} this card
             can't yet put a name to (${unidentifiedEmpty.map((g) => escapeHtml(g.clusterId)).join(", ")}) \u2014 no commands confirmed on any of them.</div>
         </div>` : "";
      return `<div class="capexp-cap-label">Capabilities</div>
      <div class="capexp-cap-groups">${this._capExpRoleLegendHtml()}${groupsHtml}${unidentifiedHtml}</div>`;
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
    //
    // Design principle for this whole tab, distilled from real UX feedback
    // across several rounds of iteration: the summary helps users make
    // decisions; the technical evidence explains why the summary is true.
    // Anything new added to a device card should pass a simple test before
    // it lands here — does it belong in the always-visible summary because
    // it helps someone decide (manufacturer/model, Community confidence,
    // Good for, a firmware-currency alert), or in the collapsed Technical
    // evidence section because it justifies a claim the summary already
    // made (capability groups, raw commands, per-firmware endpoint detail)?
    // If it's neither, it probably doesn't belong on the card at all.
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
        const rating = confidenceStars(m.entries);
        const localFirmware = this._capExpLocalFirmwareFor(m.device);
        const gap = localFirmware ? newestFirmwareGap(localFirmware, m.entries) : null;
        const discoveryNote = discoveryForDevice(
          this._capExpDiscoveries || [],
          m.manufacturerSlug,
          m.modelSlug
        );
        const goodFor = useCaseTags(m.entries, localFirmware);
        const capabilitiesHtml = this._capExpCapabilitiesHtml(capGroups);
        const references = m.entries[0] && m.entries[0].references || null;
        return `
              <div class="capexp-device-card">
                <div class="capexp-device-top">
                  ${this._capExpDevicePhotoHtml(m.device.model, m.device.manufacturer)}
                  <div class="capexp-device-main">
                    <div class="capexp-device-header">
                      <span class="capexp-device-name">${escapeHtml(manufacturerDisplayLabel(m.device.manufacturer))} ${escapeHtml(
          m.device.model || "\u2014"
        )}</span>
                      ${// Only show the entity's own name as a secondary line
        // when there actually is one — this database is about
        // products, not entity names, so a manufacturer/model
        // repeated twice (the _deviceLabel() fallback when no
        // custom name exists) would just be noise.
        m.device.user_given_name || m.device.name ? `<span class="muted">${escapeHtml(m.device.user_given_name || m.device.name)}</span>` : ""}
                      <a class="capexp-website-link" href="${escapeHtml(this._capExpWebsiteUrl(m.device.manufacturer, m.device.model))}" target="_blank" rel="noopener noreferrer">View on website \u2197</a>
                    </div>
                    ${this._capExpTrustPanelHtml(rating, fw.length, fwLabel, totalScans, lastSeen)}
                  </div>
                </div>
                ${this._capExpDeviceOverviewHtml(m.entries)}
                ${this._capExpExternalReferencesHtml(references, m.device.manufacturer)}
                ${discoveryNote ? `<div class="capexp-discovery-note">${escapeHtml(discoveryNote.cardNote)}</div>` : ""}
                ${this._capExpGoodForHtml(goodFor, "yours")}
                <div class="capexp-report-line muted">${reports ? "Reports its state back automatically \u2014 no need to poll it to see changes." : "Doesn't automatically report state changes \u2014 Home Assistant may need to poll it."}</div>
                ${gap ? `<div class="capexp-fwgap-alert">Your device is on ${escapeHtml(
          localFirmware
        )}. The community has also confirmed ${escapeHtml(
          gap.newestFirmware
        )} for this model${gap.diff && gap.diff.length ? `, which ${this._capExpFwGapSummary(gap.diff)}` : ""}. Nobody's scanned anything newer yet \u2014 share a scan if you are.</div>` : ""}
                <div class="capexp-techtoggle" data-capexp-toggle="${escapeHtml(key)}">
                  Technical evidence <span class="capexp-chevron-inline">${expanded ? "\u25BE" : "\u25B8"}</span>
                </div>
                ${expanded ? `<div class="capexp-tech-panel">${capabilitiesHtml}${this._capExpDeviceDetailHtml(
          m.entries
        )}</div>` : ""}
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
      this._qa(".capexp-techtoggle").forEach((h) => {
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
    // Deliberately visually quieter than the Good for / Capabilities summary
    // above it — this is the raw per-firmware evidence backing that summary,
    // not a second summary competing for the same attention. Real feedback
    // was that this section "almost competes with the summary" once a card
    // is expanded; the label + lighter entry styling (see .capexp-techlabel/
    // .capexp-entry-title in styles.js) push it back into a supporting role
    // without hiding it behind an extra click, since it's still genuinely
    // useful (e.g. spotting which exact firmware a command was confirmed on).
    _capExpDeviceDetailHtml(entries) {
      return `
      <div class="capexp-device-detail">
        <div class="capexp-techlabel">Per-firmware detail</div>
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
      if (field === "manufacturer") {
        let hasGenericTuya = false;
        idx.forEach((e) => {
          if (!e.manufacturer) return;
          if (isGenericTuyaManufacturer(e.manufacturer)) hasGenericTuya = true;
          else set.add(e.manufacturer);
        });
        if (hasGenericTuya) set.add(GENERIC_TUYA_LABEL);
      } else if (field === "model") idx.forEach((e) => e.model && set.add(e.model));
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
    // exposes, resolved against the live index so a chip's value is always
    // one of the dropdown's real options, not a guessed substring — a chip
    // never appears if it has nothing to point at. Grouped by category
    // (Lighting / Sensors / Networking) per real UX feedback asking for a
    // "quick search" library that grows in terms of what people actually
    // want to do with a device, not raw Zigbee vocabulary. A category with
    // zero resolvable examples is omitted entirely rather than shown empty.
    //
    // Two deliberate deviations from the requested example list, worth
    // flagging: "Motion detection" and "Occupancy sensing" were requested
    // as two separate chips, but both would resolve to the exact same
    // Occupancy Sensing cluster filter — showing two chips with identical
    // results would read as broken, not helpful, so they're combined into
    // one. "Attribute reporting" isn't included: there's no single cluster
    // or facet value that means "this device reports something" in
    // general — every reporting cluster reports its own specific
    // attribute — so wiring a chip to it honestly would need a new kind of
    // search facet, which is out of scope for a wording/UX pass.
    _capExpSearchExampleGroups() {
      const resolve = (needle) => {
        const opts = this._capExpFacetValues("cluster");
        return opts.find((v) => v.toLowerCase().includes(needle)) || "";
      };
      const groups = [
        {
          category: "Lighting",
          examples: [
            { label: "Switch things on/off", field: "cluster", value: resolve("on/off") },
            { label: "Direct dimming", field: "cluster", value: resolve("level") },
            { label: "Scene control", field: "cluster", value: resolve("scene") },
            { label: "Color control", field: "cluster", value: resolve("color") }
          ]
        },
        {
          category: "Sensors",
          examples: [
            { label: "Motion / occupancy sensing", field: "cluster", value: resolve("occupancy") },
            { label: "Reports illuminance", field: "cluster", value: resolve("illuminance") },
            { label: "Security / contact sensing (IAS Zone)", field: "cluster", value: resolve("ias zone") },
            { label: "Temperature monitoring", field: "cluster", value: resolve("temperature") },
            { label: "Humidity monitoring", field: "cluster", value: resolve("humidity") },
            { label: "Energy monitoring", field: "cluster", value: resolve("metering") }
          ]
        },
        {
          category: "Networking",
          examples: [
            { label: "Group control", field: "cluster", value: resolve("groups") },
            { label: "OTA support", field: "cluster", value: resolve("ota") }
          ]
        }
      ];
      return groups.map((g) => ({ ...g, examples: g.examples.filter((ex) => ex.value) })).filter((g) => g.examples.length);
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
    // Find a Device (formerly "Search database") — real UX feedback:
    // outcome-first for people who don't know what a cluster or command is,
    // while keeping full precision filtering for people who do. Quick
    // Search chips and the result cards below are the new discovery layer;
    // the Advanced filters dropdowns underneath are the unchanged precise
    // query tool this tab always was — same searchIndex() facets, same
    // dropdown behavior, no functional change there.
    _buildCapExpSearchShell(bodyEl) {
      const groups = this._capExpSearchExampleGroups();
      bodyEl.innerHTML = `
      <p class="hint" style="margin-top:0">Try one of these, or use Advanced filters below for exact manufacturer,
        model, cluster, command, attribute, or firmware matches.</p>
      ${groups.map(
        (g) => `
        <div class="capexp-search-example-group">
          <div class="capexp-search-example-category">${escapeHtml(g.category)}</div>
          <div class="capexp-search-examples">
            ${g.examples.map(
          (ex) => `<button type="button" class="chip capexp-search-example" data-field="${escapeHtml(
            ex.field
          )}" data-value="${escapeHtml(ex.value)}">${escapeHtml(ex.label)}</button>`
        ).join("")}
          </div>
        </div>`
      ).join("")}
      <details class="capexp-advanced-filters">
        <summary>Advanced filters</summary>
        <div class="capexp-search-form">
          ${this._capExpSearchSelectHtml("manufacturer", "All manufacturers")}
          ${this._capExpSearchSelectHtml("model", "All models")}
          ${this._capExpSearchSelectHtml("cluster", "All clusters")}
          ${this._capExpSearchSelectHtml("command", "All commands")}
          ${this._capExpSearchSelectHtml("attribute", "All attributes")}
          ${this._capExpSearchSelectHtml("firmware", "All firmware")}
        </div>
      </details>
      <div id="capexp-search-count" class="hint"></div>
      <div id="capexp-search-results" class="capexp-device-list"></div>`;
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
          this._q(".capexp-advanced-filters").open = true;
          this._capExpRunSearch();
        });
      });
    }
    // Renders matched search results as one device card per matched
    // manufacturer+model (see groupSearchResultsByDevice's own doc comment
    // for why Community confidence/Good for reflect the whole device, not
    // just the entries that happened to match this particular search) —
    // the same summary-first / collapsed-technical-evidence shape as
    // Explore My Devices, via the shared _capExpTrustPanelHtml/
    // _capExpGoodForHtml/_capExpCapabilitiesHtml methods, just labeled
    // "View capabilities" instead of "Technical evidence" to match how a
    // reader arrives here (already searching for a specific capability,
    // not exploring a device they already own).
    _capExpRunSearch() {
      const resultsEl = this._q("#capexp-search-results");
      const countEl = this._q("#capexp-search-count");
      if (!resultsEl || !this._capExpIndex) return;
      const isGenericTuyaFilter = this._capExpSearch.manufacturer === GENERIC_TUYA_LABEL;
      const matched = searchIndex(
        this._capExpIndex,
        isGenericTuyaFilter ? { ...this._capExpSearch, manufacturer: "" } : this._capExpSearch
      ).filter((e) => !isGenericTuyaFilter || isGenericTuyaManufacturer(e.manufacturer));
      const devices = groupSearchResultsByDevice(matched, this._capExpIndex);
      const shown = devices.slice(0, 100);
      if (!devices.length) {
        if (countEl) countEl.textContent = "";
        resultsEl.innerHTML = `<div class="capexp-empty-search">
        <p>No community observations currently match this search.</p>
        <p class="muted">This does not necessarily mean the capability is unsupported \u2014 it simply means nobody
          has submitted evidence for it yet.</p>
        <button type="button" class="btn btn-small" id="capexp-empty-contribute">Contribute a scan</button>
      </div>`;
        const contributeBtn = this._q("#capexp-empty-contribute");
        if (contributeBtn) {
          contributeBtn.addEventListener("click", () => {
            this._capExpMode = "explore";
            this._renderCapExpBody();
          });
        }
        return;
      }
      if (countEl) {
        countEl.textContent = devices.length > 100 ? `Showing the top 100 of ${devices.length} matching devices, ranked by community confidence \u2014 narrow your search to see more.` : `${devices.length} matching device${devices.length === 1 ? "" : "s"}, ranked by community confidence`;
      }
      resultsEl.innerHTML = shown.map((r) => {
        const key = `${r.manufacturerSlug}|${r.modelSlug}`;
        const expanded = this._capExpSearchExpanded.has(key);
        const capGroups = groupCapabilitiesByOutcome(r.entries);
        return `
          <div class="capexp-device-card">
            <div class="capexp-device-top">
              ${this._capExpDevicePhotoHtml(r.model, r.manufacturer)}
              <div class="capexp-device-main">
                <div class="capexp-device-header">
                  <span class="capexp-device-name">${escapeHtml(manufacturerDisplayLabel(r.manufacturer))} ${escapeHtml(
          r.model || "\u2014"
        )}</span>
                  <a class="capexp-website-link" href="${escapeHtml(this._capExpWebsiteUrl(r.manufacturer, r.model))}" target="_blank" rel="noopener noreferrer">View on website \u2197</a>
                </div>
                ${this._capExpTrustPanelHtml(r.rating, r.firmwareCount, null, r.totalScans, r.lastSeen)}
              </div>
            </div>
            ${this._capExpDeviceOverviewHtml(r.entries)}
            ${this._capExpExternalReferencesHtml(r.references, r.manufacturer)}
            ${this._capExpGoodForHtml(r.goodFor, "this record's")}
            <div class="capexp-techtoggle" data-capexp-toggle="${escapeHtml(key)}">
              ${expanded ? "Hide capabilities" : "View capabilities"}
              <span class="capexp-chevron-inline">${expanded ? "\u25BE" : "\u2192"}</span>
            </div>
            ${expanded ? `<div class="capexp-tech-panel">${this._capExpCapabilitiesHtml(
          capGroups
        )}${this._capExpDeviceDetailHtml(r.entries)}</div>` : ""}
          </div>`;
      }).join("");
      this._qa("#capexp-search-results .capexp-techtoggle").forEach((h) => {
        h.addEventListener("click", () => {
          const key = h.dataset.capexpToggle;
          if (this._capExpSearchExpanded.has(key)) this._capExpSearchExpanded.delete(key);
          else this._capExpSearchExpanded.add(key);
          this._capExpRunSearch();
        });
      });
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
          <p class="adv-guided-hint">Want a remote to control some lights? The <a href="#" class="src-link" id="adv-open-guided">Groups tab</a>
            does it step by step with <strong>New group for a remote\u2026</strong>, including creating the group.</p>
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
          <p id="adv-group-support" class="hint adv-group-support" style="display:none"></p>
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
      this._q("#adv-open-guided").addEventListener("click", (e) => {
        e.preventDefault();
        this._switchView("groups");
      });
      this._q("#adv-source").addEventListener("change", () => this._advPopulateSourceEndpoints());
      this._q("#adv-src-ep").addEventListener("change", () => {
        this._advPopulateClusterOptions();
        this._advRenderSourceBindings();
      });
      this._q("#adv-target-device").addEventListener("change", () => this._advPopulateTargetEndpoints());
      this._q("#adv-dst-ep").addEventListener("change", () => this._advRenderTargetBindings());
      this._q("#adv-cluster").addEventListener("change", () => this._advUpdateCustomClusterState());
      this._q("#adv-target-group").addEventListener("change", () => this._advRenderGroupSupport());
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
        const looseTarget = type === "group" ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) } : { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint != null ? opts.dstEndpoint : null };
        const matchesRequest = (b) => bindingMatchesLoose(b, { sourceIeee, sourceEp: opts.endpoint != null ? opts.endpoint : null, clusterIds: clusters, target: looseTarget });
        const beforeKeys = new Set(this._rawBindings().filter(matchesRequest).map(bindingKey));
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
          const scan = await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan), {
            tries: this._retryCount
          });
          this._advRenderSourceBindings();
          this._advRenderTargetBindings();
          const sourceRead = scan.read.has(normIeee(sourceIeee));
          const bindTarget = type === "group" ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) } : { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint };
          const canVerify = clusters.length === 1 && opts.endpoint != null && (bindTarget.isGroup || bindTarget.endpoint != null);
          if (canVerify) {
            const res = this._settleChange(
              "bind",
              { sourceIeee, sourceEndpoint: opts.endpoint, clusterId: clusters[0], target: bindTarget },
              scan
            );
            if (bindTarget.isGroup && res.outcome !== "failed") {
              const sup = groupSupportSummary(
                this._groupSupport(bindTarget.groupId, clusters[0]),
                clusterName(clusters[0]),
                this._groupName(bindTarget.groupId)
              );
              if (sup.level === "warning" || sup.level === "empty") {
                res.message = `${res.message} But: ${sup.text}`;
                if (res.level === "success") res.level = "warning";
              }
            }
            this._setStatus(res.level, res.message, res.level === "success" ? void 0 : 0, res.action);
          } else if (!sourceRead) {
            this._setStatus(
              "warning",
              `Bind command sent, but ${this._ieeeLabel(sourceIeee, { plain: true })} didn't answer the check, so the table may not show it yet. Wake the device and rescan it.`,
              0
            );
          } else {
            const after = this._rawBindings().filter(matchesRequest);
            const added = after.filter((b) => !beforeKeys.has(bindingKey(b)));
            if (added.length) {
              const names = [...new Set(added.map((b) => clusterName(b.clusterId)))].join(", ");
              this._setStatus(
                "success",
                `Binding confirmed on the device (${names}).${callErr ? " zha_toolkit reported a failure, but the binding is there." : ""}`
              );
            } else if (after.length) {
              this._setStatus("info", "Already bound: the device had this binding before.");
            } else {
              this._setStatus(
                "error",
                `Bind failed: ${this._ieeeLabel(sourceIeee, { plain: true })} answered the check and no matching binding is on it.${callErr ? ` (${callErr.message || String(callErr)})` : ""}`,
                0
              );
            }
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
          const scan = await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan), {
            tries: this._retryCount
          });
          this._advRenderSourceBindings();
          this._advRenderTargetBindings();
          if (type === "coordinator") {
            const outcome = this._verifyCoordinatorUnbindOutcome(beforeCoordList, sourceIeee, opts.endpoint);
            if (!outcome.ok && !scan.read.has(normIeee(sourceIeee))) {
              this._setStatus(
                "warning",
                `Unbind sent, not confirmed yet: ${this._ieeeLabel(sourceIeee, { plain: true })} didn't answer the check. Wake it and rescan it to see the result.`,
                0
              );
            } else {
              this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? void 0 : 0);
            }
          } else if (before !== null) {
            const res = this._settleChange(
              "unbind",
              { sourceIeee, sourceEndpoint: opts.endpoint, clusterId: clusters[0], target: bindTarget },
              scan,
              before
            );
            this._setStatus(res.level, res.message, res.level === "success" ? void 0 : 0, res.action);
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
      this._advRenderGroupSupport();
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
    /** Cluster dropdown = the selected source endpoint's declared OUTPUT
     *  (client) clusters — the ones this endpoint can actually generate a
     *  cluster command on, per the Zigbee Cluster Library's client/server
     *  split — plus a "Custom cluster ID…" escape hatch for genuine edge
     *  cases (e.g. an IKEA controller's genBasic/0x0000 group-binding trick,
     *  which zha_toolkit's bind_group will happily attempt anyway).
     *
     *  v0.34.1 through v0.34.3 chased this in the wrong direction. The
     *  trigger was a Repenic RD-250ZG whose On/Off and Level Control never
     *  showed up here, and whose own binding table *did* show entries using
     *  both clusters — which looked like proof the "out"-only filter was
     *  wrong. It wasn't: every one of those existing bindings points at the
     *  coordinator, not at any other device. That's this device reporting
     *  its own state outward (an attribute report), a mechanism completely
     *  separate from issuing a cluster command, and one that a binding-table
     *  entry supports without requiring a client-role declaration at all.
     *  Having *a* binding on a cluster is therefore not evidence a device
     *  can control another device with it, and the 0.34.2/0.34.3 attempts to
     *  surface such clusters anyway just relabeled the same wrong conclusion
     *  as a feature. If a cluster genuinely isn't declared "out" here, the
     *  honest reading is that this device's firmware has no client-side
     *  implementation for it and cannot issue that cluster's commands to
     *  anything, no matter what binding table entry exists — Custom cluster
     *  ID remains for attempting one anyway on a hunch, not as a hidden
     *  "real" list this dropdown was previously failing to show.
     *  See _advUpdateCustomClusterState(). */
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
      this._advRenderGroupSupport();
    }
    /** The cluster the Advanced tab currently has selected, or null for
     *  "zha-toolkit default" / an invalid custom id. */
    _advSelectedClusterId() {
      const sel = this._q("#adv-cluster");
      if (!sel) return null;
      if (sel.value === "__custom__") return parseClusterIdInput(this._q("#adv-cluster-custom").value);
      return sel.value === "" ? null : Number(sel.value);
    }
    /** Under the Cluster field, when the target is a group: how many of its
     *  members can act on the selected cluster. Reads members' cluster lists
     *  (cheap local zha/devices/clusters calls) if they aren't cached yet. */
    async _advRenderGroupSupport() {
      const el = this._q("#adv-group-support");
      if (!el) return;
      const type = this._q("#adv-target-type") && this._q("#adv-target-type").value;
      const clusterId = this._advSelectedClusterId();
      const groupId = this._q("#adv-target-group") && this._q("#adv-target-group").value;
      if (type !== "group" || clusterId == null || groupId === "" || groupId == null) {
        el.style.display = "none";
        return;
      }
      const reqId = this._advGroupSupportReq = (this._advGroupSupportReq || 0) + 1;
      const draw = () => {
        const summary = groupSupportSummary(
          this._groupSupport(Number(groupId), clusterId),
          clusterName(clusterId),
          this._groupName(Number(groupId))
        );
        el.className = `hint adv-group-support adv-group-support-${summary.level}`;
        el.textContent = summary.text;
        el.style.display = "";
        return summary;
      };
      const first = draw();
      if (first.level !== "unknown" && !this._groupSupport(Number(groupId), clusterId).unknown.length) return;
      const toRead = this._groupMembers(Number(groupId)).filter((m) => !m.isCoordinator && !this._clusterCache.has(m.ieee));
      await Promise.all(toRead.map((m) => this._ensureClusters(m.ieee).catch(() => {
      })));
      if (reqId === this._advGroupSupportReq) draw();
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
            await this._rescanDeviceFull(ieee, { tries: this._retryCount });
            this._advPopulateClusterOptions();
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
            label = `${escapeHtml(d ? this._deviceLabel(d) : b.targetIeee)} <span class="muted">(ep ${escapeHtml(String(b.targetEndpoint))})</span>`;
          }
        } else {
          const d = this._devices.find((dv) => dv.ieee === b.sourceIeee);
          label = `${escapeHtml(d ? this._deviceLabel(d) : b.sourceIeee)} <span class="muted">(ep ${escapeHtml(String(b.sourceEndpoint))})</span>`;
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
        this._advRenderGroupSupport();
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

  // src/panel.js
  var STYLE2 = `
:host { display: block; min-height: 100vh; background: var(--primary-background-color); }
.header {
  display: flex; align-items: center; gap: 4px; height: var(--header-height, 56px); padding: 0 12px;
  background: var(--app-header-background-color, var(--primary-color));
  color: var(--app-header-text-color, var(--text-primary-color, #fff));
  border-bottom: var(--app-header-border-bottom, none);
  box-sizing: border-box; position: sticky; top: 0; z-index: 2;
}
.title { font-size: 20px; font-weight: 400; margin-left: 8px; }
.content { padding: 8px; box-sizing: border-box; }
`;
  var ZhaBindingsPanel = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._narrow = false;
      this._card = null;
      this._menu = null;
    }
    connectedCallback() {
      if (this._card) return;
      this.shadowRoot.innerHTML = `<style>${STYLE2}</style>
      <div class="header"><span class="menu"></span><div class="title">ZHA Bindings</div></div>
      <div class="content"></div>`;
      this._menu = document.createElement("ha-menu-button");
      this.shadowRoot.querySelector(".menu").appendChild(this._menu);
      this._card = document.createElement("zha-binding-map-card");
      this._card.tabInUrl = true;
      if (typeof this._card.setConfig === "function") {
        this._card.setConfig({ type: "custom:zha-binding-map-card" });
      }
      this.shadowRoot.querySelector(".content").appendChild(this._card);
      this._apply();
    }
    set hass(hass) {
      this._hass = hass;
      this._apply();
    }
    get hass() {
      return this._hass;
    }
    set narrow(narrow) {
      this._narrow = !!narrow;
      this._apply();
    }
    get narrow() {
      return this._narrow;
    }
    // route and panel are set by Home Assistant; nothing here needs them yet.
    set route(route) {
      this._route = route;
    }
    set panel(panel) {
      this._panel = panel;
    }
    _apply() {
      if (this._menu) {
        this._menu.hass = this._hass;
        this._menu.narrow = this._narrow;
      }
      if (this._card && this._hass) this._card.hass = this._hass;
    }
  };

  // src/index.js
  console.info(
    `%c ZHA-BINDING-MAP-CARD %c v${CARD_VERSION} `,
    "color: white; background: #039be5; font-weight: 700; border-radius: 3px 0 0 3px;",
    "color: #039be5; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
  );
  var CARD_TAG = "zha-binding-map-card";
  var existingCard = customElements.get(CARD_TAG);
  if (existingCard) {
    console.warn(
      `ZHA Bindings Manager: card v${CARD_VERSION} was not loaded because v${existingCard.cardVersion || "unknown"} is already loaded on this page. This happens when the card is installed twice (from HACS and through the ZHA Bindings Manager integration). See Settings \u2192 Repairs.`
    );
  } else {
    ZhaBindingMapCard.cardVersion = CARD_VERSION;
    customElements.define(CARD_TAG, ZhaBindingMapCard);
    registerCardPicker();
  }
  if (!customElements.get("zha-bindings-manager-panel")) {
    customElements.define("zha-bindings-manager-panel", ZhaBindingsPanel);
  }
  function registerCardPicker() {
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
  }
})();
