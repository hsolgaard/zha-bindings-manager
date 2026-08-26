// CAPABILITY_DB_REPO lives in capexplorer-constants.js now (along with
// CAPABILITY_OUTCOME_PHRASE/capabilityOutcomePhrase) so that file has zero
// dependency on this one — it's meant to be lifted wholesale into the
// standalone zigbee-capabilities website (see docs/), which has no use for
// anything else in this file. Re-exported here so nothing else in card.js
// needs to change its import path.
export { CAPABILITY_DB_REPO } from "./capexplorer-constants.js";

export const ZTK_DOMAIN = "zha_toolkit";

// Single source of truth for the card's own version — read by index.js for
// the console banner/custom-card registration, and stamped into shared
// "Check supported commands" submissions (see CAPABILITY_DB_REPO) as
// provenance, so a community-database record can be judged against what the
// scanning card actually knew how to verify at the time. Keep in sync with
// package.json's "version" when cutting a release.
export const CARD_VERSION = "0.34.2";

// Clusters zha-toolkit binds by default when no explicit cluster is given.
export const DEFAULT_BINDABLE_OUT_CLUSTERS = [0x0005, 0x0006, 0x0008, 0x0102, 0x0300];

// Stroke color for synthetic group -> member edges (see _membershipEdges).
// Matches .node-group's own color so a membership edge visually reads as
// "coming from a group" — deliberately not a cluster color, since these
// edges aren't sourced from any single cluster's binding.
export const MEMBERSHIP_EDGE_COLOR = "#8e24aa";

// How many recent binds_get attempts we remember per device for the learned
// response-time/outcome history (see _recordScanOutcome).
export const HISTORY_LIMIT = 10;
// Default extra attempts for a deliberate single-device rescan (not the bulk
// network scan, which stays at zha_toolkit's own default of 1 try). Each
// extra try costs ~45s when a device genuinely doesn't respond — confirmed
// via live testing on 2026-07-15 (45s for 1 try, 222s for 5 tries) — so this
// is a real time cost, not a free safety net, and is user-configurable.
export const DEFAULT_RETRY_COUNT = 2;
export const DEFAULT_BINDABLE_IN_CLUSTERS = [0x0402];
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
export const DEFAULT_SCAN_BATCH_SIZE = 10;

// Floor Plan node radius is normally derived from the uploaded image's raw
// pixel width (see _renderFpNode) so it scales with resolution, but that
// formula has no idea how large your actual rooms are relative to the
// image — a lower-resolution blueprint can leave markers looking oversized
// no matter how well the auto-scaling works. This percentage is a manual
// multiplier on top of that formula, defaulting to no change (100%), so a
// blueprint that doesn't fit the assumption can still be dialed down (or up).
export const DEFAULT_FP_MARKER_SCALE = 100;

// Green Power stub endpoint — present on virtually every modern Zigbee
// device, not a real functional endpoint, excluded from the exploded
// per-endpoint device view.
export const GREEN_POWER_ENDPOINT = 242;

// Tuya "generic" model IDs reused across dozens of unrelated whitelabeled
// physical products (a TS0601 curtain motor, TRV, and air-quality monitor
// all report the exact same model string) — MattWestb flagged that this
// makes zigbee2mqtt.io's own per-model image lookup actively misleading for
// these, not just missing (zigbee-capabilities#57: "all tuya devices is
// having wrong picture from Z2M"). Kept short and specific rather than
// pattern-matching every "TS0xxx" string, since plenty of Tuya model IDs
// *do* map to one real product and still deserve a real photo.
export const AMBIGUOUS_TUYA_MODELS = [
  "TS0601",
  "TS011F",
  "TS0201",
  "TS0203",
  "TS0041",
  "TS0042",
  "TS0043",
  "TS0044",
  "TS0121",
];

// Structured options for "what does this endpoint control" in the exploded
// device view — a closed picker rather than free text, since it's meant to
// stay filterable/iconography-ready later, not become a pile of one-off
// strings. Real-world knowledge only the user has (what a relay is actually
// wired to); no binding data can ever supply this.
export const ENDPOINT_CONTROL_TYPES = [
  "Not set",
  "Light",
  "Fan",
  "Outlet / socket",
  "Heating / valve",
  "Cover / curtain",
  "Other appliance",
];

// Friendly names + rough category for clusters we know how to talk about.
// Anything not in this table is still usable (shown as "Cluster 0xXXXX").
// Source: Zigbee Cluster Library Specification (Zigbee Alliance doc 07-5123),
// cross-checked against two independent public cluster-ID references on
// 2026-07-19. Extended on 2026-07-19 after real-world feedback (GitHub issue
// #1, MattWestb) flagged 0x0001 and 0x0020 showing as raw hex on real
// battery/sleepy-end-device bindings — added those two plus the rest of the
// general-purpose and domain clusters likely to actually show up on a real
// Zigbee network (locks, fans, ballasts, metering, etc.), skipping the more
// obscure BACnet-tunnel/telecom clusters that are very unlikely to appear.
export const CLUSTER_INFO = {
  0x0000: { name: "Basic", cat: "misc" },
  0x0001: { name: "Power Configuration", cat: "misc" },
  0x0002: { name: "Device Temperature Configuration", cat: "misc" },
  0x0003: { name: "Identify", cat: "misc" },
  0x0004: { name: "Groups", cat: "misc" },
  0x0005: { name: "Scenes", cat: "control" },
  0x0006: { name: "On/Off", cat: "control" },
  0x0007: { name: "On/Off Switch Configuration", cat: "control" },
  0x0008: { name: "Level Control", cat: "control" },
  0x0009: { name: "Alarms", cat: "misc" },
  0x000a: { name: "Time", cat: "misc" },
  0x0015: { name: "Commissioning", cat: "misc" },
  0x0019: { name: "OTA Upgrade", cat: "misc" },
  0x0020: { name: "Poll Control", cat: "misc" },
  0x0021: { name: "Green Power", cat: "misc" },
  0x0101: { name: "Door Lock", cat: "security" },
  0x0102: { name: "Window Covering", cat: "control" },
  0x0200: { name: "Pump Configuration and Control", cat: "climate" },
  0x0201: { name: "Thermostat", cat: "climate" },
  0x0202: { name: "Fan Control", cat: "climate" },
  0x0203: { name: "Dehumidification Control", cat: "climate" },
  0x0204: { name: "Thermostat UI Configuration", cat: "climate" },
  0x0300: { name: "Color Control", cat: "control" },
  0x0301: { name: "Ballast Configuration", cat: "control" },
  0x0400: { name: "Illuminance", cat: "sensor" },
  0x0401: { name: "Illuminance Level Sensing", cat: "sensor" },
  0x0402: { name: "Temperature", cat: "sensor" },
  0x0403: { name: "Pressure", cat: "sensor" },
  0x0404: { name: "Flow Measurement", cat: "sensor" },
  0x0405: { name: "Humidity", cat: "sensor" },
  0x0406: { name: "Occupancy", cat: "sensor" },
  0x0500: { name: "IAS Zone", cat: "security" },
  0x0501: { name: "IAS ACE", cat: "security" },
  0x0502: { name: "IAS WD (Siren)", cat: "security" },
  0x0702: { name: "Metering", cat: "sensor" },
  0x0b01: { name: "Meter Identification", cat: "sensor" },
  0x0b04: { name: "Electrical Measurement", cat: "sensor" },
  0x0b05: { name: "Diagnostics", cat: "misc" },
  0x1000: { name: "Touchlink Commissioning", cat: "misc" },
};

export const CAT_COLOR = {
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
export const CLUSTER_FRIENDLY_PHRASE = {
  0x0005: "scene control",
  0x0006: "on/off control",
  0x0007: "on/off switch configuration",
  0x0008: "brightness control",
  0x0101: "lock control",
  0x0102: "open/close control",
  0x0201: "temperature control",
  0x0202: "fan speed control",
  0x0300: "color control",
  0x0301: "ballast control",
};
export function clusterFriendlyPhrase(id) {
  const n = Number(id);
  return CLUSTER_FRIENDLY_PHRASE[n] || `${clusterName(n)} control`;
}

// Known standard ZCL "commands received" (server-side — i.e. what the
// cluster accepts as input) for every cluster in CLUSTER_INFO that actually
// has commands (several are attribute-only and correctly have no entry
// here — Pump Configuration and Control, Fan Control, Dehumidification
// Control, Thermostat UI Configuration, Ballast Configuration, Shade
// Configuration). Every entry below has been checked against zigpy's own
// cluster definitions (zigpy/zcl/clusters/{general,closures,lighting,hvac,
// security}.py) — an inaccurate "confirmed missing" claim here would be
// worse than not showing one at all. Real case that motivated this: a
// Sonoff ZBMINIR2 (firmware 1.0.8) confirmed via zha_toolkit.scan_device to
// support off/on/toggle/off_with_effect but not on_with_timed_off — exactly
// the gap that breaks a direct Zigbee binding from a motion sensor that
// only sends the latter.
export const CLUSTER_COMMANDS = {
  // Basic, Identify, and Groups are near-universal — almost every Zigbee
  // device declares them regardless of type — which is exactly why their
  // absence here mattered more than any other gap: unlike a specialized
  // cluster, a raw snake_case command name on one of these (e.g.
  // "reset_fact_default", "identify_query", "add_if_identifying") showed up
  // on nearly every device in the Capability Explorer, real user feedback
  // on a live SONOFF ZBMINIR2 screenshot. Command names/IDs verified
  // against the ZCL General clusters (zigpy's zcl/clusters/general.py).
  0x0000: {
    0x00: "Reset to factory defaults",
  },
  0x0003: {
    0x00: "Identify",
    0x01: "Identify query",
    0x40: "Trigger identify effect",
  },
  0x0004: {
    0x00: "Add to group",
    0x01: "View group",
    0x02: "Get group membership",
    0x03: "Remove from group",
    0x04: "Remove from all groups",
    0x05: "Add to group if identifying",
  },
  0x0005: {
    0x00: "Add",
    0x01: "View",
    0x02: "Remove",
    0x03: "Remove all",
    0x04: "Store",
    0x05: "Recall",
    0x06: "Get scene membership",
    0x40: "Enhanced add",
    0x41: "Enhanced view",
    0x42: "Copy",
  },
  0x0006: {
    0x00: "Off",
    0x01: "On",
    0x02: "Toggle",
    0x40: "Off with effect",
    0x41: "On with recall global scene",
    0x42: "On with timed off",
  },
  0x0008: {
    0x00: "Move to level",
    0x01: "Move",
    0x02: "Step",
    0x03: "Stop",
    0x04: "Move to level (with on/off)",
    0x05: "Move (with on/off)",
    0x06: "Step (with on/off)",
    0x07: "Stop (with on/off)",
  },
  0x0009: {
    0x00: "Reset alarm",
    0x01: "Reset all alarms",
    0x02: "Get alarm",
    0x03: "Reset alarm log",
  },
  0x0101: {
    0x00: "Lock door",
    0x01: "Unlock door",
    0x02: "Toggle door",
    0x03: "Unlock with timeout",
    0x04: "Get log record",
    0x05: "Set PIN code",
    0x06: "Get PIN code",
    0x07: "Clear PIN code",
    0x08: "Clear all PIN codes",
    0x09: "Set user status",
    0x0a: "Get user status",
    0x0b: "Set week day schedule",
    0x0c: "Get week day schedule",
    0x0d: "Clear week day schedule",
    0x0e: "Set year day schedule",
    0x0f: "Get year day schedule",
    0x10: "Clear year day schedule",
    0x11: "Set holiday schedule",
    0x12: "Get holiday schedule",
    0x13: "Clear holiday schedule",
    0x14: "Set user type",
    0x15: "Get user type",
    0x16: "Set RFID code",
    0x17: "Get RFID code",
    0x18: "Clear RFID code",
    0x19: "Clear all RFID codes",
  },
  0x0102: {
    0x00: "Up/open",
    0x01: "Down/close",
    0x02: "Stop",
    0x04: "Go to lift value",
    0x05: "Go to lift percentage",
    0x07: "Go to tilt value",
    0x08: "Go to tilt percentage",
  },
  0x0201: {
    0x00: "Setpoint raise/lower",
    0x01: "Set weekly schedule",
    0x02: "Get weekly schedule",
    0x03: "Clear weekly schedule",
    0x04: "Get relay status log",
  },
  0x0300: {
    0x00: "Move to hue",
    0x01: "Move hue",
    0x02: "Step hue",
    0x03: "Move to saturation",
    0x04: "Move saturation",
    0x05: "Step saturation",
    0x06: "Move to hue and saturation",
    0x07: "Move to color",
    0x08: "Move color",
    0x09: "Step color",
    0x0a: "Move to color temperature",
    0x40: "Enhanced move to hue",
    0x41: "Enhanced move hue",
    0x42: "Enhanced step hue",
    0x43: "Enhanced move to hue and saturation",
    0x44: "Color loop set",
    0x47: "Stop move/step",
    0x4b: "Move color temperature",
    0x4c: "Step color temperature",
  },
  0x0500: {
    0x00: "Enroll response",
    0x01: "Initiate normal operation mode",
    0x02: "Initiate test mode",
  },
  0x0501: {
    0x00: "Arm",
    0x01: "Bypass",
    0x02: "Emergency",
    0x03: "Fire",
    0x04: "Panic",
    0x05: "Get zone ID map",
    0x06: "Get zone info",
    0x07: "Get panel status",
    0x08: "Get bypassed zone list",
    0x09: "Get zone status",
  },
  0x0502: {
    0x00: "Start warning",
    0x01: "Squawk",
  },
};

// Binding Health: icon/label per status level, used by the Bindings-table
// Health column, its detail popover, and the summary card.
export const HEALTH_ICON = { ok: "✅", info: "ℹ", warning: "⚠", error: "❌" };
export const HEALTH_LABEL = { ok: "OK", info: "Info", warning: "Warning", error: "Error" };
export const HEALTH_RANK = { error: 0, warning: 1, info: 2, ok: 3 };

// Friendly labels for the HA entity-domain "types" we classify devices by
// (derived from the domain prefix of each entity a device exposes, e.g.
// "light.kitchen" -> "light"). Anything not listed still works, just shown
// with its raw domain name.
export const DOMAIN_LABELS = {
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
export function domainLabel(domain) {
  return DOMAIN_LABELS[domain] || domain;
}

// Refines the generic domain label using the entity's device_class (the same
// signal Home Assistant itself uses to tell a garage-door cover from a blind,
// or a motion binary_sensor from a door sensor), so the "Type" column/filter
// can say "Garage Door" or "Motion Sensor" instead of just "Cover"/"Binary Sensor".
export const DEVICE_CLASS_LABELS = {
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
export function refinedDomainLabel(domain, deviceClass) {
  const table = DEVICE_CLASS_LABELS[domain];
  if (table && deviceClass && table[deviceClass]) return table[deviceClass];
  return domainLabel(domain);
}

// When a device exposes several non-diagnostic entities, this ranks which
// domain best answers "what kind of device is this" for the single Type
// label — e.g. a bulb that also reports power draw is a Light, not a
// Sensor. Anything not listed sorts after everything that is.
export const TYPE_PRIORITY = [
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

export function clusterName(id) {
  const n = Number(id);
  return CLUSTER_INFO[n] ? CLUSTER_INFO[n].name : `Cluster 0x${n.toString(16).padStart(4, "0")}`;
}
export function clusterColor(id) {
  const n = Number(id);
  return CAT_COLOR[(CLUSTER_INFO[n] && CLUSTER_INFO[n].cat) || "misc"];
}
export function hex4(n) {
  return `0x${Number(n).toString(16).padStart(4, "0")}`;
}
