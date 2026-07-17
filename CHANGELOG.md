# Changelog

All notable changes to ZHA Bindings Manager are documented here.


## [0.14.1] — 17 July 2026

### Fixed

- **Removing a device-to-group binding from the graph or table ("Remove
  binding") could report "Unbind failed — this binding is still on the
  device after rescanning" even though nothing was actually wrong with the
  binding itself.** Root cause: that button called native Home Assistant's
  `zha/groups/unbind` websocket command, a different, separate mechanism
  from zha_toolkit that the rest of this card doesn't otherwise use — while
  the Advanced tab's group-unbind (which has always worked) goes through
  zha_toolkit's own `unbind_group` service instead. Confirmed by testing
  `zha_toolkit.unbind_group` directly in Developer Tools against a real
  binding that the in-app button couldn't remove: it worked immediately.
  The button now calls `unbind_group` too, the same path already proven
  reliable elsewhere in the card. Also removed `bindDeviceToGroup` and
  `unbindDeviceFromGroup`, the two native-websocket API methods behind this
  — the first had no callers left anywhere, and the second's only caller
  was this bug.

## [0.14.0] — 17 July 2026

### Added

- **The Map view now draws a group &rarr; member arrow for every device in a
  Zigbee group**, sourced entirely from real ZCL group membership data
  (`zha/groups`' own member list — already fetched, no new API call). This
  is a genuinely separate real fact from a binding: a group member receives
  that group's commands without needing any binding-table entry at all,
  which is exactly the relationship a switch &rarr; group binding alone
  doesn't show. It's drawn with the same solid, bold weight as a real
  control binding, so a switch bound to a group with lights in it now reads
  as one continuous switch &rarr; group &rarr; light path, even though the
  two halves come from different real mechanisms (a binding, then group
  membership). Click one for group/member details. There's no "remove from
  group" action from this edge yet &mdash; that would need a verified
  zha_toolkit `remove_from_group` call, which hasn't been confirmed against
  source the way every other action in this card has been, so it points to
  ZHA's own group management UI instead for now. Group-membership edges
  aren't shown on the Floor Plan tab, which doesn't place group nodes at
  all today.

## [0.13.0] — 17 July 2026

### Added

- **Reporting-type bindings are now told apart from control bindings, and
  hidden from the Map/Floor Plan graphs by default.** Prompted by a real
  case: a light added to a Zigbee group through native ZHA's own group UI
  turned out to have a genuine binding-table entry pointing back at the
  group (confirmed via a live `binds_get` read), which the graph correctly
  drew as an arrow — but that arrow made it look like the light was
  "controlling" the group, which isn't what it's for and isn't what this
  tool is meant to show. A binding is now classified as control-type only
  if its cluster is registered as an "out" (client) cluster on the source
  device's endpoint — the same in/out distinction the Advanced tab's
  cluster dropdown already relies on. Bindings that only exist on an "in"
  (server) cluster represent the device reporting its own state outward,
  not controlling anything, and are hidden from the graph by default. A new
  "Show reporting-only bindings (Map only)" checkbox reveals them again,
  drawn thin, dashed, and muted so they read as background information
  rather than competing with real control arrows. The Bindings tab and all
  exports are unaffected — they always show the complete raw scanned data
  regardless of this setting, since that view's job is auditing, not
  storytelling.
- The binding-details popover (opened by clicking an edge or a table row)
  now shows a "Type" line — Control or Reporting — using the same
  classification.

## [0.12.0] — 17 July 2026

### Added


- A "Marker size" setting on the Floor Plan tab (next to the zoom
controls), a percentage that scales device markers independently of the
uploaded image's resolution. Markers were previously sized purely from the
image's raw pixel width, which has no idea how large your actual rooms
are relative to the image — a lower-resolution blueprint could leave
markers looking oversized no matter what the auto-scaling guessed.
Defaults to 100% (no change from before).


### Fixed


- Floor Plan device labels could become invisible depending on your
Home Assistant theme and the floor plan image's colors — e.g. a dark
theme renders label text in a light color, which disappears against a
white or light-colored blueprint. Labels on the Floor Plan tab now have a
halo outline in the card's background color, so they stay legible against
the uploaded image regardless of theme or image color. (The Map view's
labels are unaffected — they already sit on the card's own background,
not an arbitrary image, so the original theme-based color there is fine.)


## [0.11.3] — 16 July 2026

### Fixed


- The arrowhead on a binding line was hidden behind the target device's
icon, since the line was drawn all the way to the exact center of the
target node, putting the arrowhead directly underneath the circle. Lines
(on both the Map and Floor Plan views) now stop just outside the target
icon's edge instead, so the arrowhead is actually visible next to it.

## [0.11.2] — 16 July 2026

### Changed

- **The scan batch size setting now documents a real, tested downside to
  setting it too high**, found through live testing on a real ~64-device
  network: a batch of 28 caused otherwise-healthy mains devices to
  intermittently fail to respond (a different device on each repeat scan,
  every one of them fine when rescanned individually) — almost certainly
  Zigbee airtime/collision contention from that much concurrent traffic at
  once, not an actual device problem. 10-12 tested clean with no induced
  failures across repeated runs. The setting itself is unchanged (still
  1-30, still defaults to 10) — this just makes sure the trade-off is
  explained before you turn it up rather than after something fails
  unexpectedly.

## [0.11.1] — 16 July 2026

### Changed

- **The concurrent scan batch size is now a setting (⚙ next to "Scan
  bindings"), defaulting to 10** (up from the fixed 8 shipped in 0.11.0).
  Found via real testing: with a fixed batch size, a handful of
  sleepy/offline devices can happen to land in different batches purely by
  chance, and each one drags its own batch out by its full retry delay
  (~45s) — a larger batch reduces how often that happens. There's no single
  batch size that's provably best for every network, so it's adjustable
  rather than hardcoded.

## [0.11.0] — 16 July 2026

### Changed

- **Scans now run in concurrent batches of 8 devices instead of one at a
  time**, cutting wall-clock time on larger networks. Previously, a full
  network scan read one device's bindings, waited for the response, then
  moved to the next — so every sleepy/offline device's retry delay (~45s
  each) added up serially across the whole scan. Confirmed via live testing
  (browser console, calling the same `zha_toolkit.binds_get` service the
  card uses) that requests genuinely run in parallel end-to-end — 10
  concurrent calls to real devices, including 2 that failed simultaneously,
  all completed in under 45 seconds total instead of stacking to 90+. Only
  the bulk network scan is affected; single-device rescans (Devices tab,
  Advanced tab, Binding Health "Rescan now") were already effectively a
  batch of one and behave exactly as before.


## [0.10.1] — 15 July 2026

### Fixed

- **The wake-device hint could tell you to "press a button" on a
  mains-powered device**, found immediately during testing (devices
  deliberately unplugged for testing showed "Usually needs waking — press
  a button on it"). Root cause: the sleepy-device check let a single
  failed scan attempt (a sample size of one) override the device's actual
  `power_source`, since a 0/1 success rate technically counts as "below
  50%". Whether wake-advice is physically sensible is now decided purely
  by `power_source` (a hardware fact) and never overridden by history — a
  mains device that isn't responding now shows "check it's powered on and
  in range" instead. Response-time/success-rate history is still shown as
  context, it just no longer drives which message you see.

## [0.10.0] — 15 July 2026

Bumped the minor version rather than another patch — this is a real feature
addition, not a bug fix, off the back of a full design/testing discussion
(including live retry-timing tests against a real device).

### Added

- **Learned per-device scan history.** The card now remembers, per device,
  how long recent `binds_get` attempts took to succeed and how often they
  succeeded at all (last 10 attempts, persisted like the bindings cache).
  This replaces guesswork with real observed behavior — confirmed necessary
  during testing, where a genuine battery device at the edge of the network
  responded in under a second, disproving the assumption that "battery
  device" reliably predicts "slow to respond."
- **Devices tab: a combined "Last scan" column.** Shows status (never
  scanned / OK / partial / failed), when, typical response time, and
  success rate for each device, and doubles as a one-click rescan button —
  no more needing to re-run the full network scan to retry one device. A
  wake-device hint appears for battery-powered devices that just failed or
  partially responded.
- **Configurable retry count for single-device rescans**, with an
  explanation of the real cost involved (a small settings panel, ⚙ next to
  "Scan bindings"). Confirmed via live testing that zha_toolkit's `tries`
  parameter is a real sequential retry loop costing ~45 seconds per attempt
  against a genuinely unresponsive device (45s for 1 try, 222s for 5) — so
  this is a deliberate trade-off setting, not a free improvement, and is
  scoped to single-device rescans only. The full network scan is
  unaffected and stays at zha_toolkit's own default.
- A "Rescan now" button on the Binding Health detail popover for
  "unable to verify" and "partial scan" findings, instead of just telling
  you to go rescan manually.

### Changed

- The "Hide coordinator bindings" filter is now labeled to make clear it
  affects both the Map and the Bindings tab, not just the graph.

## [0.9.4] — 15 July 2026

### Changed

- The scan-complete status message (e.g. "Scan complete: 59 device(s) read,
  5 did not respond...") now stays on screen until you dismiss it with the
  new × button, instead of auto-hiding after a few seconds — easy to miss
  if you looked away while a larger scan was still running. Other status
  messages are unchanged, but can now also be dismissed early the same way.

## [0.9.3] — 14 July 2026

### Fixed

- **False "duplicate binding" Health warnings**, found immediately after
  testing the 0.9.2 fix above. zha_toolkit can return the same real binding
  in both `response.result` and `response.replies` on a fully successful
  scan; the card is supposed to merge these into one entry, but the two
  parsers formatted their internal `.id` string differently (one used the
  cluster id as a hex string, the other as a plain number), so the merge
  step never recognized them as the same binding. Both copies survived,
  and Binding Health correctly — but misleadingly — flagged them as
  duplicates of each other. Deduplication now uses a normalized identity
  key built from each binding's already-normalized fields instead of the
  inconsistently-formatted `.id` string.
- **Home Assistant's own generic "Failed to perform the action
  zha_toolkit/binds_get. unknown error" toast** was popping up for every
  sleepy/offline device during a scan, on top of the card's own accurate
  status reporting ("N did not respond — sleepy/offline devices are
  normal"). This came from `notifyOnError: true` on the underlying service
  call, which asks Home Assistant to show its own error toast regardless
  of how the calling code handles the failure. Now set to `false` — the
  card has handled and reported these failures itself since Binding
  Health shipped in 0.9.0, so the extra toast was redundant noise at best.

## [0.9.2] — 14 July 2026

### Fixed

- **Every binding read via the newer `response.replies` format (added in
  0.9.1) incorrectly showed "target device no longer exists"**, even for
  perfectly healthy bindings. Root cause: a target device's IEEE address in
  this response shape is serialized as an array of 8 raw bytes in
  little-endian order (e.g. `[255, 255, 21, 126, ...]`), not as a hex
  string like `a4:c1:38:...` — the 0.9.1 parser assumed the latter. This is
  now converted correctly. Confirmed against a real `binds_get` response
  captured directly from a live device (via Developer Tools → Actions)
  rather than inferred from source code alone.
- As a side effect of the fix above, entries whose target IEEE still can't
  be resolved for any reason are now skipped and logged to the console
  instead of being shown as a false "missing device" error.

### Added

- Partial-scan Binding Health messages now show how much of a device's
  binding table was actually retrieved (e.g. "3 of 12 binding table
  entries retrieved") instead of just flagging that the read was
  incomplete — using the page-count metadata `binds_get` already returns.

## [0.9.1] — 12 July 2026

### Fixed

- **Fresh browser sessions could show zero bindings even though real
  bindings existed and worked**, caused by a change in how newer
  `zha_toolkit`/`zigpy` versions report a `binds_get` scan. When a device's
  binding table is large enough to need multiple "pages," a later page can
  time out (`success: false`, `errors: ["TimeoutError()"]`) even though an
  earlier page already returned valid entries in `response.replies`. The
  card previously discarded the entire response on any reported failure,
  losing that valid data. It now keeps whatever bindings were actually
  returned and marks the device as a "partial" read (shown as an Info
  status in Binding Health) instead of showing nothing. Also added support
  for parsing the newer `response.replies` format directly, alongside the
  older `response.result` format the card already understood. Root-caused
  and reported by a user testing against a real Hue network with large
  binding tables — thank you!

## [0.9.0] — 11 July 2026

### Added

- **Binding Health** — every binding in the Bindings table is now checked
  for structural problems (missing source/target device, missing endpoint,
  missing cluster, missing Zigbee group, duplicate bindings) and shown with
  a plain-English status: OK, Info, Warning, or Error. Includes a summary
  card, status filter chips (All / Problems Only / Errors / Warnings /
  Info), a sortable Health column, and a click-through detail popover
  explaining what's wrong, why it matters, and what to do about it.
- **Verified bind/unbind outcomes** — after creating or removing a binding,
  the card now rescans the affected device(s) and compares before vs.
  after to report what actually happened (e.g. "Binding confirmed
  removed"), instead of just relaying zha_toolkit's own success/failure
  report — which turned out to be misleading in both directions during
  testing (see Fixed, below).
- A version banner is now logged to the browser console on load
  (`ZHA-BINDING-MAP-CARD v0.9.0`), so you can always confirm which build is
  actually active — useful since HACS caches a pre-gzipped copy of this
  file that can go stale if you ever replace it manually.
- Failed zha_toolkit calls now log the full request and raw response to
  the browser console (tagged `[ZHA Bindings Manager]`), for easier
  troubleshooting when the on-screen error message alone isn't enough.
- CSV/JSON/print exports now include each binding's Health status and
  details instead of the old binary "stale" flag.

### Changed

- Bind/unbind actions now automatically rescan **both** the source and
  target device afterwards (previously only the source was rescanned),
  regardless of whether the action succeeded or failed — this keeps the
  table from showing bindings that no longer exist on the actual device.
- The Bindings table's Target column now shows the target's endpoint
  (e.g. "ep 1"), matching how the Source column already did — needed for
  clarity when a device is both the source and target of different
  bindings on itself.
- Binding Health detail popups for a healthy ("OK") binding now show a
  single plain confirmation line instead of an odd "What's wrong: This
  binding looks structurally valid" framing.

### Fixed

- **Unbind was silently failing in some cases** because the card never
  sent the target device's endpoint (`dst_endpoint`) to zha_toolkit's
  `binds_remove_all` service — only the bind path did. Without it,
  zha_toolkit couldn't reliably identify which binding-table entry to
  remove on a target with more than one endpoint, and reported failure
  even when everything else about the request was correct.
- Diagnosed and documented a related issue where the local scan cache
  could show a binding that no longer existed on the actual device (left
  over from earlier testing/reconfiguration) — the new automatic rescan
  and verified-outcome behavior above both help this self-correct instead
  of leaving stale, confusing entries in the table.

## [0.7.1] — 10 July 2026 (initial public release)

- First HACS/GitHub release: Map, Floor Plan, Bindings, Devices, and
  Advanced tabs; drag-and-drop bind/unbind; stale-binding flagging (later
  replaced by Binding Health in 0.9.0); CSV/JSON/print export; mobile
  layout fixes.
