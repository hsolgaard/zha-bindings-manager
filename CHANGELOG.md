# Changelog

All notable changes to ZHA Bindings Manager are documented here.

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


## [0.9.0] - 11 July 2026

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
