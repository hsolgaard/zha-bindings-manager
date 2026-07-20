# Changelog

All notable changes to ZHA Bindings Manager are documented here.

## [0.18.2] — 20 July 2026

### Fixed

- **False "Controls group" badges (and false multi-role badges) on
  ordinary lights.** Reported in [#1](../../issues/1) (MattWestb) - nearly
  every real Zigbee 3 light/plug on his network was showing a "Controls
  group" badge in the exploded view and, as a result, a multi-role
  controller badge on the Map/Floor Plan, despite being an entirely normal
  light with no control capability at all (confirmed against a real
  device's raw cluster data: `output_clusters` contained only OTA Upgrade,
  nothing that could actually control anything). Root cause: the exploded
  view's per-endpoint relationship logic treated every binding-table entry
  pointing at a group as "controls group" outright, unlike device-to-device
  bindings, which were already checked against the source cluster's real
  in/out direction. ZHA's own "add device to group" flow can leave a real
  binding-table entry on a cluster the device only ever declares as an
  input (e.g. a light's OnOff, which it receives, never sends) — that's the
  device being reachable through the group, not controlling it. Group
  bindings now go through the same in/out cluster check device-to-device
  bindings already used, matching how the Map/Floor Plan graphs have always
  classified them. A genuine control binding to a group (e.g. a real
  remote's output cluster bound to a group) is unaffected.
- As part of the same fix, the exploded view's "Also reports … to the
  coordinator" line and its "Unclassified binding to …" badge could
  previously mislabel or break on a group target or a report to a device
  other than the coordinator — both now name the real target (a device, a
  group, or the coordinator) correctly.

## [0.18.1] — 19 July 2026

### Changed

- **The multi-role badge (added in 0.18.0) now explains itself.** The only
  explanation previously was a hover tooltip, which nobody discovers by
  accident and doesn't work on touch. A short caption now appears under
  the Map and Floor Plan graphs — but only when a badge is actually
  visible in the current view, so it doesn't clutter the screen for
  anyone who never has one of these devices. The exploded device view
  also gets a short callout at the top when it applies, so clicking
  through confirms what the badge meant. Wording on all three (badge
  tooltip, graph caption, exploded-view callout) was also made
  mechanism-agnostic — it no longer implies the second role is
  necessarily a Zigbee self-binding, since a real case is a wired/local
  load that Zigbee never sees a binding for at all, alongside a genuinely
  separate Zigbee-bound role on another endpoint.

## [0.18.0] — 19 July 2026

### Added

- **Multi-role device badge on the Map and Floor Plan graphs.** Detachable
  combo switches (raised in [#1](../../issues/1)) can have one endpoint
  driving its own relay while another endpoint is detached and rebound to
  control something else — the graph previously showed the whole device
  as a single light/switch icon either way. A device now gets a small
  controller badge on its node when it has a light/switch/cover/fan
  entity *and* at least one confirmed control binding, on any endpoint,
  targeting something other than itself. Clicking the node still opens
  the exploded per-endpoint view for the full breakdown. Endpoint-to-entity
  mapping isn't available from `zha/devices`, so this checks "does the
  device have both traits", not "on different endpoints specifically" —
  deliberately restricted to confirmed control bindings (not
  reporting/unknown) to keep it conservative.

## [0.17.2] — 19 July 2026

### Fixed

- The version header was missing from the built file. The build step now
  injects a header comment (project description and version, read from
  `package.json`) at the very top of the bundle via esbuild's `banner`
  option, independent of module order.

### Added

- Added 21 more Zigbee clusters to the friendly-name table, including
  Power Configuration (`0x0001`) and Poll Control (`0x0020`), reported as
  unrecognized in [#1](../../issues/1). Also added Door Lock, Fan Control,
  Ballast Configuration, Metering, Touchlink Commissioning, and others
  likely to appear on real networks. A few of the newly added control
  clusters (On/Off Switch Configuration, Door Lock, Fan Control, Ballast
  Configuration) now get specific Binding Health phrases (e.g. "lock
  control", "fan speed control") instead of the generic fallback.

## [0.17.1] — 19 July 2026

### Internal

- Split the codebase into ES modules under `src/` (`constants.js`,
  `utils.js`, `parser.js`, `api-client.js`, `template.js`, `styles.js`,
  `card.js`, `index.js`), bundled into the single `zha-binding-map-card.js`
  file via `npm run build` (esbuild, unminified). No change to
  installation or updates — the distributed file is still one plain JS
  file in the same location. Source edits now happen in `src/`, followed
  by a rebuild, rather than in the generated file directly.
  - Note: esbuild renders numeric object keys in decimal rather than hex
    in the generated bundle (e.g. `6:` instead of `0x0006:`). This is
    purely cosmetic and has no functional effect; `src/constants.js`
    itself is unaffected.

## [0.17.0] — 19 July 2026

### Changed

- The control/reporting classifier now has a third state, "unknown", for
  bindings on a cluster that hasn't been scanned yet or isn't declared as
  either an input or output cluster. Previously these were
  indistinguishable from confirmed reporting-only bindings.
  - The Map and Floor Plan graphs draw unknown bindings with their own
    dashed edge style, still visible by default.
  - The binding detail dialog and exploded device view now label these
    "Unknown" instead of folding them into "Reporting".
  - "Show reporting-only bindings" continues to affect only confirmed
    reporting bindings.

### Internal

- Renamed `_isControlBinding()` (yes/no) to `_classifyBinding()`
  (control/reporting/unknown); `_isControlBinding()` remains as a thin
  wrapper. The Map and Floor Plan views now share one `_edgeClassFor()`
  helper for edge styling.

## [0.16.4] — 19 July 2026

### Internal

- Added `verify-parser.js`, a standalone check of the `binds_get` response
  parser against real captured binding-table data, covering both response
  shapes (`result` and `replies`) that ZHA/zha_toolkit can return.

## [0.16.3] — 19 July 2026

### Changed

- Exploded device view: bindings between the same source/target
  endpoint pair on different clusters (e.g. a rocker sending both On/Off
  and Level Control to the same light) are now grouped into a single
  badge listing all clusters involved, instead of appearing as
  near-duplicate badges.

## [0.16.2] — 19 July 2026

### Added

- Firmware and hardware version are now shown in the exploded device
  view's header, pulled from Home Assistant's device registry and
  cross-referenced by IEEE address. Omitted if not available on a given
  HA install.

## [0.16.1] — 19 July 2026

### Added

- Product photos in the exploded device view, fetched from
  zigbee2mqtt.io by model id. A "Show device photo" checkbox (on by
  default) turns this off — it's the only feature in the card that
  contacts the internet rather than your own HA instance.
- Offline fallback: a simple wall-plate diagram with one rectangle per
  endpoint when no photo is available or photos are disabled.
- The exploded view is now also reachable by clicking a device node on
  the Map (without dragging it).

### Changed

- Renamed the endpoint's "what does this control" field to "Physically
  wired to", to distinguish it from the Zigbee-binding badge above it.

## [0.16.0] — 19 July 2026

### Added

- Exploded device view: an "Explode" button on each Devices tab row opens
  a per-endpoint breakdown built from a live scan of that device (no
  external lookups).
  - Each endpoint shows every relationship it has — self-bound, controls
    another device, controls a group, receives control, group
    membership, reporting-only — as separate badges.
  - Detach-relay-mode state is read from the matching
    `switch.*_detach_relay_N` entity rather than inferred from the
    binding table.
  - The device header shows manufacturer, model, quirk, power source,
    area, IEEE, and network address.
  - A "What does this control?" picker (Light / Fan / Outlet / Heating /
    Cover / Other / Not set) per endpoint, saved locally, for
    information no binding data can supply on its own.

## [0.15.0] — 17 July 2026

### Added

- A "Custom cluster ID…" option in the Advanced tab's cluster dropdown,
  for binding a cluster the source device doesn't declare as bindable
  (e.g. some IKEA controllers reportedly send all commands to a group
  once bound on the Basic cluster, `0x0000`). Accepts hex or plain
  numeric input. Bind/Unbind stay disabled until a valid id is entered.

## [0.14.1] — 17 July 2026

### Fixed

- Removing a device-to-group binding could report "Unbind failed" even
  when the binding itself was fine. The remove-binding button used Home
  Assistant's native `zha/groups/unbind` command instead of zha_toolkit's
  `unbind_group`, unlike the rest of the card. It now uses `unbind_group`
  consistently. Removed the now-unused native-websocket bind/unbind group
  methods.

## [0.14.0] — 17 July 2026

### Added

- The Map view now draws a group → member arrow for every device in a
  Zigbee group, sourced from `zha/groups` membership data. This is
  separate from a binding — a group member receives that group's
  commands without needing a binding-table entry of its own — so a
  switch bound to a group with lights in it now reads as one continuous
  switch → group → light path. There's no "remove from group" action
  from this edge yet; use ZHA's own group management UI for that. Not
  shown on the Floor Plan tab.

## [0.13.0] — 17 July 2026

### Added

- Bindings are now classified as control or reporting, based on whether
  their cluster is registered as an output (client) cluster on the
  source endpoint. Reporting-only bindings are hidden from the Map/Floor
  Plan graphs by default; a "Show reporting-only bindings" checkbox
  reveals them, drawn thin and dashed. The Bindings tab and all exports
  are unaffected.
- The binding-details popover now shows a Type line (Control or
  Reporting).

## [0.12.0] — 17 July 2026

### Added

- A "Marker size" setting on the Floor Plan tab, a percentage that scales
  device markers independently of the uploaded image's resolution.
  Defaults to 100% (no change).

### Fixed

- Floor Plan device labels could become illegible depending on your Home
  Assistant theme and the floor plan image's colors. Labels now have a
  background-color halo so they stay legible regardless of theme or
  image.

## [0.11.3] — 16 July 2026

### Fixed

- The arrowhead on a binding line was hidden behind the target device's
  icon. Lines now stop just outside the target icon's edge.

## [0.11.2] — 16 July 2026

### Changed

- Documented a real downside to setting the scan batch size too high:
  testing showed a batch of 28 on a ~64-device network could cause
  otherwise-healthy mains devices to intermittently fail to respond,
  likely from Zigbee airtime contention. 10–12 tested clean. The setting
  itself is unchanged (1–30, default 10).

## [0.11.1] — 16 July 2026

### Changed

- Concurrent scan batch size is now a setting (⚙ next to "Scan
  bindings"), defaulting to 10 (up from a fixed 8). A larger batch
  reduces the chance that sleepy/offline devices land in different
  batches and each add their own retry delay to the total scan time.

## [0.11.0] — 16 July 2026

### Changed

- Scans now run in concurrent batches of 8 devices instead of one at a
  time, reducing wall-clock time on larger networks. Only the bulk
  network scan is affected; single-device rescans are unchanged.

## [0.10.1] — 15 July 2026

### Fixed

- The wake-device hint could tell you to "press a button" on a
  mains-powered device. Wake advice now depends only on `power_source`
  and is no longer overridden by scan history.

## [0.10.0] — 15 July 2026

### Added

- Learned per-device scan history: response time and success rate over
  the last 10 `binds_get` attempts, persisted alongside the bindings
  cache.
- Devices tab: a combined "Last scan" column showing status, timing, and
  success rate, which also doubles as a one-click rescan button.
- Configurable retry count for single-device rescans (⚙ next to "Scan
  bindings"). Each retry costs roughly 45 seconds against an
  unresponsive device, so this is a deliberate trade-off, not a free
  improvement, and only applies to single-device rescans.
- A "Rescan now" button on Binding Health detail popovers for "unable to
  verify" and "partial scan" findings.

### Changed

- The "Hide coordinator bindings" filter is now labeled to make clear it
  affects both the Map and the Bindings tab.

## [0.9.4] — 15 July 2026

### Changed

- The scan-complete status message now stays on screen until dismissed
  with a × button, instead of auto-hiding after a few seconds.

## [0.9.3] — 14 July 2026

### Fixed

- False "duplicate binding" Health warnings when zha_toolkit returned the
  same binding in both `response.result` and `response.replies` — the
  two parsers formatted their internal identity key differently, so the
  merge step didn't recognize them as the same binding. Deduplication now
  uses a normalized identity key built from each binding's already
  normalized fields.
- Home Assistant's generic error toast for `zha_toolkit/binds_get` no
  longer fires for expected sleepy/offline devices during a scan; the
  card already reports these itself.

## [0.9.2] — 14 July 2026

### Fixed

- Every binding read via the `response.replies` format (added in 0.9.1)
  incorrectly showed "target device no longer exists". The target IEEE
  address in this response shape is a little-endian byte array, not a
  hex string, and the 0.9.1 parser assumed the latter. Entries whose
  IEEE still can't be resolved are now skipped and logged to the console
  instead of shown as an error.

### Added

- Partial-scan Binding Health messages now show how much of a device's
  binding table was retrieved (e.g. "3 of 12 entries").

## [0.9.1] — 12 July 2026

### Fixed

- Fresh browser sessions could show zero bindings even though real
  bindings existed, when a device's binding table needed multiple pages
  and a later page timed out. The card now keeps whatever bindings were
  returned and marks the device as a partial read instead of discarding
  everything. Also added support for the newer `response.replies` format
  alongside the existing `response.result` format.

## [0.9.0] — 11 July 2026

### Added

- Binding Health — every binding is checked for structural problems
  (missing source/target device, missing endpoint, missing cluster,
  missing group, duplicates) and shown with a plain-English status: OK,
  Info, Warning, or Error. Includes a summary card, status filters, a
  sortable Health column, and a detail popover.
- Verified bind/unbind outcomes — after creating or removing a binding,
  the card rescans the affected device(s) and reports what actually
  changed, rather than relying solely on zha_toolkit's own
  success/failure report.
- A version banner is logged to the browser console on load.
- Failed zha_toolkit calls log the full request and response to the
  console for troubleshooting.
- CSV/JSON/print exports include each binding's Health status and
  details.

### Changed

- Bind/unbind actions now rescan both the source and target device
  afterwards (previously only the source was rescanned).
- The Bindings table's Target column now shows the target's endpoint,
  matching the Source column.

### Fixed

- Unbind could silently fail because the card didn't send the target
  device's endpoint to zha_toolkit's `binds_remove_all` service.

## [0.7.1] — 10 July 2026 (initial public release)

- First HACS/GitHub release: Map, Floor Plan, Bindings, Devices, and
  Advanced tabs; drag-and-drop bind/unbind; stale-binding flagging
  (later replaced by Binding Health in 0.9.0); CSV/JSON/print export;
  mobile layout fixes.
