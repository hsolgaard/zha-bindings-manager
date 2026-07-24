# Changelog

All notable changes to ZHA Bindings Manager are documented here.

## [0.23.0] — 24 July 2026 (local testing build — not yet released)

### Added

- **Compare My Device.** After a live "Check supported commands" scan in the
  exploded device view, the card now checks that device's own confirmed
  firmware against every firmware the community database has on file for the
  same manufacturer/model, right there in the dialog — no need to switch to
  the Capability Explorer tab. Same conservative rule as the existing
  firmware-currency flag: it only ever says what the community has
  *observed*, never claims to know the manufacturer's true "latest," and says
  plainly when there's newer firmware but nobody's compared it against your
  exact version yet, rather than guessing. Loads the community index in the
  background as soon as a scan starts, so the panel resolves without the user
  needing to do anything extra.
- **Search Database fields are now dropdowns**, populated live from whatever
  manufacturers, models, clusters, commands, attributes, and firmware
  versions actually exist in the community index — instead of free-text
  boxes where a typo or wrong capitalization silently returned nothing. The
  example-search chips now resolve to one of those real options rather than
  a guessed substring.

- **Community database repo renamed** from `zha-device-capabilities` to
  [`zigbee-capabilities`](https://github.com/hsolgaard/zigbee-capabilities) —
  it's grown into its own first-class project rather than a sub-project of
  this card (see the Product Requirements Document v2). `CAPABILITY_DB_REPO`
  in `src/constants.js` is the single place this is configured, so nothing
  else in the card needed to change. GitHub's own redirects mean old
  bookmarks/links to the previous name keep working.

### Changed

- **Contributor Feedback.** The GitHub issue comment posted after a
  submission is processed now summarizes what that specific submission
  actually added — a new firmware observation, improved confidence from a
  repeat scan, newly confirmed commands, or newly seen attributes — computed
  as a plain diff against the file's previous state. Requires the updated
  `zigbee-capabilities-ingest-submission.yml` workflow in the
  `zigbee-capabilities` repo.

## [0.22.0] — 24 July 2026

### Changed

- **Zigbee Capability Explorer redesigned around "what can this device do", not
  "what did the scan return".** The first version read like a diagnostic dump —
  raw command names in an unlabeled pill wall, no explanation of why the tab
  existed. This pass reworks it around the product spec's actual intent:
  - A community strip up top credits contributors and shows how many devices
    are confirmed so far — this is a community-built resource, not a static
    database, and the framing says so.
  - Each mode now leads with the real question it answers ("What can this
    device do?", "Which device should I buy for X?", "What changed in this
    update?") instead of a generic label.
  - Explore My Devices groups capabilities under a "Supports" heading with an
    evidence line (scans, firmware versions, last seen) and a confidence badge
    (Single observation / Repeated observation / Strong evidence / Conflicting
    evidence), rather than a flat tag cloud with no context.
  - Capabilities that vary across firmware versions are flagged
    "firmware-dependent" right in the tag list, instead of reading identically
    to ones that have never changed.
  - **New: firmware-currency flag.** If a device's live firmware doesn't match
    the newest firmware the community has confirmed for that model, Explore
    mode now says so and summarizes what changed — using only data this card
    already has (never claims to know the true "latest" firmware from the
    manufacturer, only what's actually been scanned and shared). Deliberately
    conservative: it only compares firmware strings it can confidently parse,
    and says nothing rather than guessing when a local device's reported
    firmware doesn't look comparable (Home Assistant's device registry
    firmware field is frequently a different value entirely from the one
    community submissions use).
  - Search Database gained a row of example searches ("Reports occupancy",
    "Supports on/off control", etc.) so a blank form isn't the first thing
    anyone sees, plus the two columns the product spec always called for and
    the first version was missing: **Not reported commands** and
    **Confidence**.
  - A coverage caveat now appears up front: this only covers devices someone's
    scanned and shared, so no results means a gap, not proof a device can't do
    something.

### Data model

- `data/index.json` entries now carry a `last_seen` timestamp (most recent
  submission backing that capability record) — requires the updated
  `ingest-submission.yml` and `rebuild-capability-index.yml` workflows in the
  `zha-device-capabilities` repo; older records without one just omit that
  part of the evidence line rather than showing anything wrong.

## [0.21.0] — 24 July 2026

### Added

- **New "Zigbee Capability Explorer" tab.** Cross-references your devices against
  the community-submitted [zha-device-capabilities](https://github.com/hsolgaard/zha-device-capabilities)
  database — what other people's identical hardware has actually been
  confirmed to do, not what a datasheet claims. Nothing about your devices
  (IEEE addresses, entities, areas, names) ever leaves your browser; only the
  manufacturer/model strings needed to match against the public database are
  used, and only locally. Three modes:
  - **Explore My Devices** — every local device that has community data
    shows its confirmed capabilities, firmware versions seen, and total scan
    count, expandable to a per-firmware breakdown. Devices with no community
    data yet get a direct "Scan & share" nudge into the existing exploded
    device view, so closing that gap is one click away.
  - **Search Community Database** — facet search across manufacturer,
    model, cluster, command, attribute, and firmware, live-filtered against
    every record in the database.
  - **Compare Firmware** — pick a manufacturer, model, and two firmware
    versions to see exactly what commands, clusters, or attributes changed
    between them.
  - The data layer (`src/capexplorer.js`) is deliberately DOM-free and
    reusable outside this card, per the product spec's future plans for a
    standalone app and/or GitHub Pages site.

## [0.20.1] — 21 July 2026

### Fixed

- **"Copy JSON" wasn't actually copying anything on some Home Assistant
  installs.** `navigator.clipboard` only exists in secure contexts (https or
  localhost) — a great many real HA installs are reached over plain http on
  a LAN IP, where the API is simply undefined and the copy silently failed.
  Worse, the error feedback was written to the card's main status bar, which
  sits behind the open exploded-view dialog and was never actually visible.
  Copy now falls back to the older `execCommand`-based selection copy (which
  works over plain http too), and feedback is shown directly on the button
  itself, inside the dialog, so it's never hidden behind the modal.

### Changed

- **Simplified sharing a scan too large for a pre-filled GitHub issue.**
  Previously this dropped you on a completely blank issue form — no title,
  nothing — and you'd have to copy the JSON yourself first. The title is
  now always pre-filled regardless of size (titles are always short), and
  clicking through also copies the JSON in the same click, so there's one
  remaining manual step (paste) instead of three.
- The JSON embedded in the pre-filled URL itself is now compact rather than
  pretty-printed, so noticeably more real scans fit under the URL length
  cutoff in the first place and hit the fast, fully pre-filled path instead
  of the fallback. The on-screen review box and clipboard copy stay
  pretty-printed for readability, since that's what actually gets
  pasted/submitted.

## [0.20.0] — 21 July 2026

### Changed

- **"Supported commands" redesigned as collapsed, per-cluster rows.** Rather
  than one big list, each cluster this endpoint actually declares (and that
  this card has a command table for) now shows as its own collapsed row —
  click to expand and see the full valid/invalid command list for that
  cluster. Clusters the device doesn't declare at all never appear, so this
  stays naturally scoped without any device-type special-casing (a light
  endpoint simply never shows a Door Lock row). One "Check supported
  commands" scan still populates every row on the endpoint at once —
  zha_toolkit's `scan_device` has no way to target a single cluster, so
  there's no benefit to a true per-row fetch.
- Expanding a cluster now always shows the complete command list, both
  present and absent — not just what's missing. Seeing what a device *can*
  do is as useful as spotting a gap, especially for anyone exploring a new
  device rather than troubleshooting a specific mismatch.
- Moved the "Supported commands" section higher in the endpoint card (right
  after the relationship badges, before "Physically wired to") since it was
  easy to miss below the fold.

### Added

- **"Share this scan" — submit a completed command scan to the community
  device capability database.** A new, openly-licensed, public dataset
  ([zha-device-capabilities](https://github.com/hsolgaard/zha-device-capabilities))
  of confirmed cluster/command/attribute support per manufacturer+model,
  built from real scans rather than manufacturer docs — usable by anyone,
  not just this card. Clicking "Share this scan" builds the submission
  record, shows it inline for review, then opens a pre-filled GitHub issue
  (or falls back to copy-to-clipboard for scans too large for a pre-filled
  link). Nothing is sent anywhere until you click through and submit it
  yourself, using your own GitHub account — this card never touches GitHub
  credentials. The record contains manufacturer, model, firmware identity
  (where the Basic cluster reports it), the endpoint's cluster signature,
  and per-cluster command/attribute support — deliberately never IEEE
  address, entity IDs, area names, or binding data, since none of that
  describes the device itself.
- The scan already performed attribute discovery alongside command
  discovery (confirmed against zha_toolkit's actual `scan_device.py`) — this
  data was previously discarded and is now captured for the shared record,
  at no extra cost (same single scan).

## [0.19.2] — 21 July 2026

### Added

- **"Check supported commands" now covers every control-capable cluster,
  not just On/Off and Level Control.** Added verified command tables
  (checked against zigpy's own cluster definitions) for Scenes, Alarms,
  Door Lock, Window Covering, Thermostat, Color Control, IAS Zone, IAS
  ACE, and IAS WD. Clusters that are attribute-only with no real commands
  (Pump Configuration and Control, Fan Control, Dehumidification Control,
  Thermostat UI Configuration, Ballast Configuration, Shade Configuration)
  correctly have nothing to show and are skipped, same as before.

## [0.19.1] — 21 July 2026

### Changed

- **"Check supported commands" now only shows On/Off and Level Control.**
  The first version listed every cluster the device returned anything for,
  including administrative ones like Basic, Identify, and Groups — always
  present, never actually in question, just clutter. It now only shows the
  clusters this feature can make a real "supported" / "not supported" call
  on.

## [0.19.0] — 21 July 2026

### Added

- **"Check supported commands" in the exploded device view.** Each
  endpoint card now has a button that runs a live command-discovery scan
  against that device (via `zha_toolkit.scan_device`) and shows exactly
  which On/Off and Level Control commands it actually implements — not
  just which clusters it declares. This came out of a real case on the
  Home Assistant Community forum: a direct Zigbee binding from an IKEA
  Vallhorn motion sensor to a Sonoff ZBMINIR2 relay looked correctly set
  up but did nothing, because the Vallhorn sends `on_with_timed_off` and
  the ZBMINIR2's firmware (confirmed via a real scan, including on its
  latest 1.0.8 firmware) only implements the three basic On/Off commands
  plus `off_with_effect`. This won't fix that kind of mismatch — it's a
  device firmware limitation, not something a binding tool can work around
  — but it means you can find out before wiring up a binding instead of
  after.
- Command support isn't always confirmable. Not every device answers the
  underlying ZCL discovery request, and zha_toolkit doesn't currently
  distinguish "confirmed zero commands" from "device didn't respond to
  discovery" in what it returns. When a scan comes back empty for a known
  cluster, the card says so plainly ("device may not support command
  discovery") rather than presenting an absence as confirmed.
- This is a manual, on-demand action, not part of the regular network
  scan — it's a live per-device query (several ZCL round-trips), heavier
  than everything else the card does, so it only runs when you click the
  button for a specific endpoint.

## [0.18.3] — 20 July 2026

### Changed

- HACS packaging/metadata update. No functional changes to the card
  itself.

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
