// One-off verification for M1 (the physical module split + build step):
// loads the actual bundled zha-binding-map-card.js under minimal browser
// stubs, confirms it registers the custom element without throwing (catches
// any missed import — this is exactly how the DEFAULT_SCAN_BATCH_SIZE gap
// in template.js was caught during this split), then constructs a real card
// instance and exercises a broad set of its pure/data-transform methods
// against synthetic-but-real-shaped device/binding data (mirroring the
// 3-gang/2-gang fixtures used live this session) to catch anything a plain
// module-load wouldn't reach. Not a substitute for loading the real bundle
// in an actual Home Assistant instance — this can't touch rendering/DOM
// methods at all (no jsdom here) — just a fast pre-check before asking for
// that real, slower verification. Not shipped with the card.

const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};
let CapturedClass = null;
global.window = { customCards: [] };
global.customElements = { define: (name, cls) => { CapturedClass = cls; } };
global.HTMLElement = class {
  attachShadow() {
    return { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  }
  addEventListener() {}
  removeEventListener() {}
};

require("./zha-binding-map-card.js");
if (!CapturedClass) throw new Error("customElements.define was never called — bundle didn't load cleanly");

const card = new CapturedClass();
console.log("Constructed OK");

const SELF = "44:9f:da:ff:fe:a2:f7:98";
const COORD = "44:9f:da:ff:fe:77:0b:94";
const OTHER = "44:9f:da:ff:fe:d8:0e:a2";
// Real case reported in GitHub issue #1 (MattWestb): an ordinary Zigbee 3
// light added to a group via ZHA's own group UI, which can leave a real
// binding-table entry pointing at the group on a cluster the light only
// ever declares as an input (it receives OnOff, never sends it) — not a
// "controls the group" relationship, just how it ended up in the group.
const LIGHT = "44:9f:da:ff:fe:11:22:33";
// Contrast case: a real remote/switch legitimately bound to a group on an
// output cluster — must still classify as controlsGroup after the fix.
const REMOTE = "44:9f:da:ff:fe:44:55:66";
const GROUP2 = 2;
card._devices = [
  {
    ieee: SELF,
    name: "3-gang",
    manufacturer: "SONOFF",
    model: "ZBM5-3C-80/86",
    // A light entity on this device, plus the real ep2->OTHER control
    // binding below, is exactly the detach-relay-switch shape
    // _isMultiRoleDevice() looks for (see GitHub issue #1).
    entities: [{ entity_id: "light.hallway_light" }],
    area_id: null,
    power_source: "Mains",
    device_type: "Router",
  },
  { ieee: COORD, name: "Coordinator", device_type: "Coordinator", entities: [], power_source: "Mains" },
  { ieee: OTHER, name: "2-gang", manufacturer: "SONOFF", model: "ZBM5-2C-80/86", entities: [], area_id: null, power_source: "Mains", device_type: "Router" },
  { ieee: LIGHT, name: "WC Fan", manufacturer: "IKEA of Sweden", model: "TRADFRI bulb", entities: [{ entity_id: "light.wc_fan" }], area_id: null, power_source: "Mains", device_type: "Router" },
  { ieee: REMOTE, name: "Hall remote", manufacturer: "IKEA of Sweden", model: "Styrbar", entities: [], area_id: null, power_source: "Battery", device_type: "EndDevice" },
];
card._groups = [
  { group_id: 1, name: "Test group", members: [{ device: { ieee: OTHER }, endpoint_id: 2 }] },
  { group_id: GROUP2, name: "WC Light and Fan", members: [{ device: { ieee: LIGHT }, endpoint_id: 1 }] },
];
card._bindings = new Map([
  [
    SELF,
    [
      { id: "a", sourceIeee: SELF, sourceEndpoint: 1, clusterId: 6, isGroup: false, targetIeee: SELF, targetEndpoint: 1, groupId: null },
      { id: "b", sourceIeee: SELF, sourceEndpoint: 2, clusterId: 6, isGroup: false, targetIeee: OTHER, targetEndpoint: 2, groupId: null },
      { id: "c", sourceIeee: SELF, sourceEndpoint: 1, clusterId: 6, isGroup: false, targetIeee: COORD, targetEndpoint: 1, groupId: null },
    ],
  ],
  [
    LIGHT,
    [
      { id: "d", sourceIeee: LIGHT, sourceEndpoint: 1, clusterId: 6, isGroup: true, targetIeee: null, targetEndpoint: null, groupId: GROUP2 },
    ],
  ],
  [
    REMOTE,
    [
      { id: "e", sourceIeee: REMOTE, sourceEndpoint: 1, clusterId: 6, isGroup: true, targetIeee: null, targetEndpoint: null, groupId: GROUP2 },
    ],
  ],
]);
card._clusterCache = new Map([
  [
    SELF,
    [
      { id: 6, type: "out", endpoint_id: 1 },
      { id: 6, type: "out", endpoint_id: 2 },
    ],
  ],
  // LIGHT declares cluster 6 as "in" only (a real light receives OnOff, it
  // doesn't send it) — the group binding above must classify as reporting,
  // not controlsGroup, despite isGroup being true.
  [LIGHT, [{ id: 6, type: "in", endpoint_id: 1 }]],
  // REMOTE declares cluster 6 as "out" — a genuine control binding to a
  // group, which must still classify as controlsGroup after the fix.
  [REMOTE, [{ id: 6, type: "out", endpoint_id: 1 }]],
]);
card._hass = { states: {}, entities: {} };

const checks = [
  ["_rawBindings", () => card._rawBindings().length === 5],
  ["_allBindings", () => card._allBindings().length >= 1],
  ["_graphBindings", () => Array.isArray(card._graphBindings())],
  ["_coordinatorIeee", () => card._coordinatorIeee() === COORD],
  ["_classifyBinding control", () => card._classifyBinding(card._rawBindings()[0]) === "control"],
  ["_isControlBinding", () => card._isControlBinding(card._rawBindings()[0]) === true],
  ["_edgeClassFor", () => card._edgeClassFor(card._rawBindings()[0]) === "edge"],
  ["_membershipEdges", () => card._membershipEdges().length === 2],
  ["_deviceEndpoints", () => JSON.stringify(card._deviceEndpoints(card._devices[0])) === JSON.stringify([1, 2])],
  ["_endpointRelationships", () => card._endpointRelationships(card._devices[0], 2).controlsDevice.length === 1],
  ["_isMultiRoleDevice true", () => card._isMultiRoleDevice(card._devices[0]) === true],
  ["_isMultiRoleDevice false (no controlled entity)", () => card._isMultiRoleDevice(card._devices[2]) === false],
  [
    "group binding on in-only cluster classifies as reporting, not control",
    () => card._classifyBinding(card._bindings.get(LIGHT)[0]) === "reporting",
  ],
  [
    "false Controls-group badge fixed (issue #1)",
    () => {
      const rel = card._endpointRelationships(card._devices.find((d) => d.ieee === LIGHT), 1);
      return rel.controlsGroup.length === 0 && rel.reportsTo.length === 1;
    },
  ],
  [
    "_isMultiRoleDevice false for ordinary group-member light",
    () => card._isMultiRoleDevice(card._devices.find((d) => d.ieee === LIGHT)) === false,
  ],
  [
    "genuine controlsGroup (out cluster) still works",
    () => {
      const rel = card._endpointRelationships(card._devices.find((d) => d.ieee === REMOTE), 1);
      return rel.controlsGroup.length === 1 && rel.reportsTo.length === 0;
    },
  ],
  ["_deviceLabel", () => typeof card._deviceLabel(card._devices[0]) === "string"],
  ["_deviceSummaryLines", () => card._deviceSummaryLines(card._devices[0]).length > 0],
  ["_deviceImageUrl", () => card._deviceImageUrl(card._devices[0]).includes("ZBM5-3C-80-86.png")],
  [
    "_deviceImageUrl: ambiguous Tuya model IDs get no lookup, not a confidently-wrong photo",
    () => card._deviceImageUrl({ model: "TS0601" }) === null,
  ],
  ["_deviceShapeSvg", () => card._deviceShapeSvg(3).includes("<svg")],
  ["_detachStateFor", () => card._detachStateFor(card._devices[0], 1).state === null],
  [
    "_endpointControlType roundtrip",
    () => {
      card._setEndpointControlType(SELF, 1, "Light");
      return card._endpointControlType(SELF, 1) === "Light";
    },
  ],
  ["_groupBindingsByKey", () => card._groupBindingsByKey(card._rawBindings(), (b) => b.id).length === 5],
  // Command-discovery classification (_classifyClusterCommands) — checks
  // built directly against the real Sonoff ZBMINIR2 scan_device response
  // (firmware 1.0.8) that surfaced the on_with_timed_off gap.
  [
    "_classifyClusterCommands: known cluster, real device data, confirmed missing command",
    () => {
      const commandsReceived = {
        "0x00": { command_id: "0x00", command_name: "off" },
        "0x01": { command_id: "0x01", command_name: "on" },
        "0x02": { command_id: "0x02", command_name: "toggle" },
        "0x40": { command_id: "0x40", command_name: "off_with_effect" },
      };
      const cls = card._classifyClusterCommands(0x0006, commandsReceived);
      const onWithTimedOff = cls.rows.find((r) => r.id === 0x42);
      const off = cls.rows.find((r) => r.id === 0x00);
      return cls.known === true && cls.confirmed === true && onWithTimedOff.present === false && off.present === true;
    },
  ],
  [
    "_classifyClusterCommands: known cluster, empty result is ambiguous not false crosses",
    () => {
      const cls = card._classifyClusterCommands(0x0006, {});
      return cls.known === true && cls.confirmed === false && cls.rows.length === 0;
    },
  ],
  [
    // 0x0004 (Groups) used to be the "unknown cluster" example here, but it
    // was added to CLUSTER_COMMANDS (see the Basic/Identify/Groups
    // addition) — a genuinely still-unmapped manufacturer-specific ID is
    // used instead so this test keeps exercising the "known: false" branch.
    "_classifyClusterCommands: unknown cluster reports positively, no missing claims",
    () => {
      const cls = card._classifyClusterCommands(0xfc99, {
        "0x00": { command_id: "0x00", command_name: "some_custom_command" },
      });
      return cls.known === false && cls.confirmed === true && cls.rows.length === 1 && cls.rows[0].present === true;
    },
  ],
  [
    "_classifyClusterCommands: Door Lock (verified against zigpy closures.py)",
    () => {
      const cls = card._classifyClusterCommands(0x0101, {
        "0x00": { command_id: "0x00", command_name: "lock_door" },
        "0x01": { command_id: "0x01", command_name: "unlock_door" },
      });
      return cls.known === true && cls.rows.length === 26 && cls.rows.find((r) => r.id === 0x00).present === true;
    },
  ],
  [
    "_classifyClusterCommands: Color Control (verified against zigpy lighting.py)",
    () => {
      const cls = card._classifyClusterCommands(0x0300, {
        "0x0a": { command_id: "0x0a", command_name: "move_to_color_temp" },
      });
      const moveToColorTemp = cls.rows.find((r) => r.id === 0x0a);
      const moveToHue = cls.rows.find((r) => r.id === 0x00);
      return cls.known === true && cls.rows.length === 19 && moveToColorTemp.present === true && moveToHue.present === false;
    },
  ],
  [
    // Regression test: Basic/Identify/Groups are near-universal (almost
    // every Zigbee device declares them), so before these were added to
    // CLUSTER_COMMANDS, raw snake_case names like "reset_fact_default" and
    // "add_if_identifying" leaked into the Capability Explorer's "Supports"
    // tags on nearly every device — real feedback from a live screenshot.
    "_classifyClusterCommands: Basic/Identify/Groups now get friendly names, not raw snake_case",
    () => {
      const basic = card._classifyClusterCommands(0x0000, {
        "0x00": { command_id: "0x00", command_name: "reset_fact_default" },
      });
      const groups = card._classifyClusterCommands(0x0004, {
        "0x05": { command_id: "0x05", command_name: "add_if_identifying" },
      });
      return (
        basic.known === true &&
        basic.rows.find((r) => r.id === 0x00).name === "Reset to factory defaults" &&
        groups.known === true &&
        groups.rows.find((r) => r.id === 0x05).name === "Add to group if identifying"
      );
    },
  ],
];

// _buildDeviceCapabilityRecord (community capability-database submission
// payload — one GitHub issue per device, all endpoints, not one per
// endpoint; redesigned after MattWestb's real multi-endpoint STARKVIND
// example, zigbee-capabilities#57) — checked against a synthetic
// scan_device response shaped exactly like the real one (verified against
// zha_toolkit's actual scan_device.py: scan_endpoint/scan_cluster/
// discover_attributes_extended), plus an explicit no-PII check since the
// whole point of this payload is that it must never carry the device's
// IEEE, entities, area, or bindings.
const SAMPLE_SCAN = {
  ieee: "04:e3:e5:ff:fe:f3:c0:87",
  nwk: "0x1234",
  model: "ZBMINIR2",
  manufacturer: "SONOFF",
  endpoints: [
    {
      id: 1,
      device_type: "0x0100",
      profile: "0x0104",
      in_clusters: {
        "0x0000": {
          cluster_id: "0x0000",
          title: "Basic",
          name: "basic",
          attributes: {
            "0x4000": {
              attribute_id: "0x4000",
              attribute_name: "sw_build_id",
              value_type: ["0x42", "str", "STRING"],
              access: "READ",
              access_acl: 1,
              attribute_value: "1.0.8",
            },
          },
          commands_received: {},
          commands_generated: {},
        },
        "0x0006": {
          cluster_id: "0x0006",
          title: "On/Off",
          name: "on_off",
          attributes: {
            "0x0000": {
              attribute_id: "0x0000",
              attribute_name: "on_off",
              value_type: ["0x10", "bool", "DISCRETE"],
              access: "READ|REPORT",
              access_acl: 5,
              attribute_value: false,
            },
          },
          // Real ZBMINIR2 firmware 1.0.8 shape (see v0.19.0 changelog): has
          // off/on/toggle/off_with_effect, missing on_with_timed_off.
          commands_received: {
            "0x00": { command_id: "0x00", command_name: "off", command_arguments: [] },
            "0x01": { command_id: "0x01", command_name: "on", command_arguments: [] },
            "0x02": { command_id: "0x02", command_name: "toggle", command_arguments: [] },
            "0x40": { command_id: "0x40", command_name: "off_with_effect", command_arguments: ["uint8_t", "uint8_t"] },
          },
          commands_generated: {},
        },
        // Manufacturer-specific cluster this card's own CLUSTER_INFO table
        // has no entry for — matches the real bug MattWestb's STARKVIND
        // scan exposed: zha_toolkit/zigpy already resolves a real title
        // ("Ikea Airpurifier") for clusters like this, but the old
        // _buildCapabilityRecord discarded it in favor of a generic
        // "Cluster 0xNNNN" placeholder.
        "0xfc7d": {
          cluster_id: "0xfc7d",
          title: "Ikea Airpurifier",
          name: "ikea_airpurifier",
          attributes: {},
          commands_received: {},
          commands_generated: {},
        },
      },
      out_clusters: {},
    },
  ],
};
const SAMPLE_DEVICE = { ieee: "04:e3:e5:ff:fe:f3:c0:87", manufacturer: "SONOFF", model: "ZBMINIR2" };

// Populate the card's own caches the way real usage would: a passive
// cluster fetch that saw endpoint 1's declared clusters plus a Green Power
// proxy endpoint (242) with no command data, and a completed live scan for
// endpoint 1 only — endpoint 242 is never scannable via scan_device, so it
// should show up as a declared-but-unscanned stub, not be silently dropped
// (MattWestb's other complaint on the same issue).
card._clusterCache.set(SAMPLE_DEVICE.ieee, [
  { id: 0x0000, type: "in", endpoint_id: 1 },
  { id: 0x0006, type: "in", endpoint_id: 1 },
  { id: 0xfc7d, type: "in", endpoint_id: 1 },
  { id: 0x0021, type: "in", endpoint_id: 242 },
]);
card._commandScans.set(card._commandScanKey(SAMPLE_DEVICE.ieee, 1), { status: "done", scan: SAMPLE_SCAN });

const capabilityChecks = [
  [
    "_buildDeviceCapabilityRecord: identity pulled from Basic cluster by attribute name",
    () => {
      const record = card._buildDeviceCapabilityRecord(SAMPLE_DEVICE);
      return record.manufacturer === "SONOFF" && record.model === "ZBMINIR2" && record.identity.sw_build_id === "1.0.8";
    },
  ],
  [
    "_buildDeviceCapabilityRecord: commands_received rows match _classifyClusterCommands",
    () => {
      const record = card._buildDeviceCapabilityRecord(SAMPLE_DEVICE);
      const ep1 = record.endpoints.find((e) => e.endpoint.id === 1);
      const onOff = ep1.clusters["0x0006"];
      const onWithTimedOff = onOff.commands_received.find((r) => r.id === 0x42);
      const off = onOff.commands_received.find((r) => r.id === 0x00);
      return onOff.commands_received_confirmed === true && onWithTimedOff.present === false && off.present === true;
    },
  ],
  [
    "_buildDeviceCapabilityRecord: attributes_confirmed captured per cluster",
    () => {
      const record = card._buildDeviceCapabilityRecord(SAMPLE_DEVICE);
      const ep1 = record.endpoints.find((e) => e.endpoint.id === 1);
      const basicAttrs = ep1.clusters["0x0000"].attributes_confirmed;
      return basicAttrs.length === 1 && basicAttrs[0].name === "sw_build_id" && basicAttrs[0].id === 0x4000;
    },
  ],
  [
    "_buildDeviceCapabilityRecord: scanned endpoint signature lists every in/out cluster",
    () => {
      const record = card._buildDeviceCapabilityRecord(SAMPLE_DEVICE);
      const ep1 = record.endpoints.find((e) => e.endpoint.id === 1);
      return ep1.scanned === true && ep1.endpoint.in_clusters.includes("0x0006") && ep1.endpoint.in_clusters.includes("0x0000");
    },
  ],
  [
    "_buildDeviceCapabilityRecord: preserves the scan's own cluster title instead of a generic placeholder",
    () => {
      const record = card._buildDeviceCapabilityRecord(SAMPLE_DEVICE);
      const ep1 = record.endpoints.find((e) => e.endpoint.id === 1);
      return ep1.clusters["0xfc7d"].name === "Ikea Airpurifier";
    },
  ],
  [
    "_buildDeviceCapabilityRecord: unscannable/unscanned endpoint (Green Power proxy) included as a stub, not dropped",
    () => {
      const record = card._buildDeviceCapabilityRecord(SAMPLE_DEVICE);
      const gp = record.endpoints.find((e) => e.endpoint.id === 242);
      return !!gp && gp.scanned === false && gp.endpoint.in_clusters.includes("0x0021") && !gp.clusters;
    },
  ],
  [
    "_buildDeviceCapabilityRecord: one submission covers every declared endpoint, not one per endpoint",
    () => card._buildDeviceCapabilityRecord(SAMPLE_DEVICE).endpoints.length === 2,
  ],
  [
    "_buildDeviceCapabilityRecord: never carries IEEE, entity, or area data",
    () => {
      const record = card._buildDeviceCapabilityRecord(SAMPLE_DEVICE);
      const json = JSON.stringify(record);
      // Checking for "entity_id"/"area_id" specifically, not bare "entity"/
      // "area" — "identity" legitimately contains "entity" as a substring.
      return !json.includes("04:e3:e5") && !json.includes("entity_id") && !json.includes("area_id") && !json.includes("ieee");
    },
  ],
  [
    "_buildDeviceCapabilityRecord: device with no known endpoints returns null rather than guessing",
    () => card._buildDeviceCapabilityRecord({ ieee: "00:00:00:00:00:00:00:00" }) === null,
  ],
];
checks.push(...capabilityChecks);

// M5 addition: exercises _loadScanState/_saveScanState through the actual
// bundled class (not just the source-level LocalStorageProvider unit
// tests in test/) — catches anything specific to how esbuild bundled the
// new src/storage/ import, not just whether the logic itself is right.
// Async, unlike every check above, so it runs separately below rather than
// through the synchronous checks array.
const storageChecks = [
  [
    "_saveScanState/_loadScanState round-trip a failed device through the real bundle",
    async () => {
      card._config = { id: "smoketest" };
      card._bindings = new Map([["dev1", [{ id: "b1" }]]]);
      card._scanFailures = new Set(["dev1"]);
      card._scanPartial = new Map();
      await card._saveScanState();

      // Simulate a reload: fresh in-memory state, same underlying storage.
      card._bindings = new Map();
      card._scanFailures = new Set();
      card._scanPartial = new Map();
      await card._loadScanState();

      return (
        card._bindings.get("dev1") &&
        card._bindings.get("dev1")[0].id === "b1" &&
        card._scanFailures.has("dev1")
      );
    },
  ],
  // v0.32.3: floor plan, device positions, filters, and other per-card
  // settings now go through this._storage the same way scan state does
  // (previously they were stuck on raw localStorage regardless of
  // storage mode — a real gap a user hit in practice: shared storage
  // "worked" but their floor plan didn't follow). Round-trips one of
  // them (positions) through the real bundled class the same way the
  // scan-state check above does.
  [
    "_savePositions/_loadPositions round-trip through the real bundle (not just scan state)",
    async () => {
      card._config = { id: "smoketest-positions" };
      card._positions = { dev1: { x: 123, y: 456 } };
      await card._savePositions();

      card._positions = {};
      await card._loadPositions();

      return card._positions.dev1 && card._positions.dev1.x === 123 && card._positions.dev1.y === 456;
    },
  ],
  // The "does this browser have anything worth asking about" check used
  // to only look at scan state, so a user with a customized floor plan
  // but no completed "Scan bindings" run would be silently switched to
  // shared storage with no prompt, leaving that floor plan behind. It
  // now checks every synced setting.
  [
    "_hasExistingLocalData is true from floor-plan-only data, not just scan state",
    async () => {
      card._config = { id: "smoketest-hasdata" };
      // Deliberately no scan state saved for this card id.
      card._fpImageUrl = "/local/floorplan.png";
      card._fpPositions = { dev1: { x: 0.5, y: 0.5 } };
      await card._saveFloorplan();
      return await card._hasExistingLocalData();
    },
  ],
  // v0.32.3's _fillMissingBackendDataFromLocal replaced the old
  // all-or-nothing import (which refused to write anything once shared
  // storage had *any* data at all — including its own later-synced
  // settings after an update). This exercises the actual scenario that
  // motivated the change: shared storage already has real scan data
  // (from another browser), but not a floor plan; this browser has both.
  // The merge must keep the backend's own scan data untouched while
  // still filling in the floor plan.
  [
    "_fillMissingBackendDataFromLocal fills in missing settings without touching data the backend already has",
    async () => {
      card._config = { id: "smoketest-merge" };

      // This browser's local data: both a scan and a floor plan.
      card._bindings = new Map([["devL", [{ id: "local-binding" }]]]);
      card._scanFailures = new Set();
      card._scanPartial = new Map();
      await card._saveScanState();
      card._fpImageUrl = "/local/mine.png";
      card._fpPositions = { devL: { x: 0.1, y: 0.1 } };
      await card._saveFloorplan();

      // A fake backend that already has its OWN (different) scan data,
      // and nothing else — mirrors "another browser already adopted
      // shared storage and scanned, but never set up a floor plan."
      const backendStore = {
        "scan-state": { last_complete: { savedAt: "t", bindings: { devR: [{ id: "remote-binding" }] } }, latest: null },
      };
      const fakeBackend = {
        async getScanState() {
          return backendStore["scan-state"] || { last_complete: null, latest: null };
        },
        async setScanState(cardId, v) {
          backendStore["scan-state"] = v;
        },
        async getHistory() {
          return backendStore["history"] || {};
        },
        async setHistory(cardId, v) {
          backendStore["history"] = v;
        },
        async getItem(cardId, key) {
          return key in backendStore ? backendStore[key] : null;
        },
        async setItem(cardId, key, v) {
          backendStore[key] = v;
        },
        // The fake writes synchronously above, so there's no debounce to
        // force through — this stub just needs to exist, matching the
        // real HaStorageProvider's interface that _fillMissingBackendDataFromLocal
        // now relies on (see the flush() fix in card.js).
        async flush() {},
      };

      await card._fillMissingBackendDataFromLocal(fakeBackend);

      const scanStateUntouched = backendStore["scan-state"].last_complete.bindings.devR !== undefined;
      const floorplanFilledIn = backendStore["floorplan"] && backendStore["floorplan"].imageUrl === "/local/mine.png";
      return scanStateUntouched && floorplanFilledIn;
    },
  ],
];

let fails = 0;
for (const [name, fn] of checks) {
  try {
    const ok = fn();
    console.log((ok ? "ok  " : "FAIL") + "  " + name);
    if (!ok) fails++;
  } catch (e) {
    console.log("FAIL  " + name + "  -> " + e.message);
    fails++;
  }
}

(async () => {
  for (const [name, fn] of storageChecks) {
    try {
      const ok = await fn();
      console.log((ok ? "ok  " : "FAIL") + "  " + name);
      if (!ok) fails++;
    } catch (e) {
      console.log("FAIL  " + name + "  -> " + e.message);
      fails++;
    }
  }
  console.log(fails === 0 ? "\nAll smoke checks passed." : `\n${fails} smoke check(s) failed.`);
  process.exit(fails === 0 ? 0 : 1);
})();
