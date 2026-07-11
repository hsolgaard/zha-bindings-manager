# Changelog

All notable changes to ZHA Bindings Manager are documented here.

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
