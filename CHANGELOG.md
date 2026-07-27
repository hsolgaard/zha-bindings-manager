# Changelog

All notable changes to ZHA Bindings Manager are documented here.

## [0.30.1]

Fixes a misleading message from a real forum bug report: a user's Hue
LWE002 showed "No response to discovery" on every single cluster during
"Check supported commands," which read like a broken/failing feature.
Getting them to pull the raw Home Assistant log showed zha_toolkit
reporting `Status.UNSUP_GENERAL_COMMAND` for every cluster — the device
was actively replying to say it doesn't implement Zigbee's optional
command-discovery request at all (common on some vendors' firmware,
Philips Hue/Signify among them), not staying silent or timing out.

### Changed

- **"Check supported commands" now shows one clear explanation** when a
  completed scan confirms literally nothing across every relevant
  cluster on an endpoint, instead of repeating the same vague "no
  response" line once per cluster: "This scan didn't confirm any
  commands across N clusters checked. That usually means this device's
  firmware doesn't implement Zigbee's command-discovery request at all
  (common on some vendors' devices, Philips Hue/Signify among them)
  rather than a temporary communication problem — re-checking is
  unlikely to change the result." The card still can't see the specific
  status code zha_toolkit logs (that detail only reaches Home
  Assistant's own log, not the data returned to the card), so this stops
  short of stating it as certain fact — but it's a specific, honest steer
  instead of six identical-looking failures with no explanation.
- This note is deliberately scoped to the all-or-nothing case only: a
  scan that confirms at least one cluster's commands still shows the
  ordinary per-cluster detail for whatever didn't come back, unchanged.

## [0.30.0]

A wording-only pass from a user-authored "Capability Evidence Clarity" PRD:
make it clear what the database knows (what a device reported during a
scan), what it infers (plain-English use-case tags derived from that), and
what it doesn't verify (that a capability is currently exposed, usable, or
functional in your specific integration) — without getting technical.
No changes to data, matching, or ranking logic. Applied identically to the
card and the standalone site.

### Changed

- **Renamed "Good for" to "Reported capabilities."** "Good for" read as
  purchasing advice the Explorer was never in a position to give — these
  tags are cluster/command evidence a device reported during a community
  scan, not a confirmed, tested recommendation. Per-tag firmware-mismatch
  tooltips reworded from "Confirmed on a different firmware... not
  verified on that exact version" to "Reported on a different firmware...
  not confirmed on that exact version," dropping "verified" specifically.
- **Added a standing inference disclaimer** near the top of the Explorer,
  above the mode picker: "Capabilities are inferred from what the device
  itself reports — this doesn't necessarily mean they're currently
  exposed or usable in ZHA or Zigbee2MQTT." Shown once per view rather
  than repeated on every device card, to avoid drowning results in
  caveats.
- **Softened the mission copy.** "Discover what Zigbee devices really
  support — verified from real community scans" became "Understand what
  Zigbee devices report — from real community scans," dropping both
  "support" and "verified" as definitive-sounding claims the underlying
  scan evidence doesn't back up.
- **Added a "Reported by device" evidence-level tag** next to the
  Community confidence label on every device card. Only this one tier
  exists in the data today; "Community observed," "Function verified,"
  and "Integration support confirmed" are reserved as future evidence
  types this project doesn't collect yet, and aren't shown as a
  placeholder ladder — a single honest tag beat a partially-greyed-out
  four-tier list that would only confuse a reader this round was
  explicitly trying not to get too technical for.


## [0.29.0]

A UX refresh of the Search tab, from a user-authored PRD: "transform the
Search Database from a technical query tool into a device discovery
tool." No changes to the underlying data or search matching logic —
matching is still exact-facet, same as before. Applied identically to
both the card and the standalone site.

### Changed

- **Renamed the mode/tab** from "Search database" to "Find a device", on
  both the card's mode picker and the standalone site's section heading —
  matches the subtitle already written for it ("Which device should I buy
  for X?") and better signals what the tab is actually for.
- **Search results are now device cards, not per-firmware table rows.**
  All firmware entries for a matched device are grouped and shown as one
  card (Community confidence trust panel, Good for tags, a "View
  capabilities →" disclosure revealing the same Capabilities-groups and
  per-firmware detail Explore mode shows), instead of one dense row per
  firmware version. A new pure function, `groupSearchResultsByDevice`,
  re-fetches every firmware entry for each matched device from the full
  index (not just the entries that happened to match the search) before
  computing its rating and tags — same "same model, any firmware" evidence
  bar the rest of the Explorer already uses, so a device doesn't look
  thinner in Search than it does in Explore just because only one of its
  firmware versions matched the query.
- **Results are ranked**, not left in index order: highest community
  confidence first, then most recently confirmed, then most firmware
  versions observed, then alphabetically by manufacturer/model.
- **Quick Search chips expanded from 3 to 12** and organized under
  category headings — Lighting (switch on/off, dimming, scene control,
  color control), Sensors (motion/occupancy, illuminance, security/
  contact, temperature, humidity, energy monitoring), Networking (group
  control, OTA support). Picking a chip now also opens the Advanced
  filters panel, so the underlying filter state it set is visible rather
  than hidden.
- **Advanced filters (Manufacturer/Model/Cluster/Command/Attribute/
  Firmware) are unchanged** in behavior, now collapsed by default behind
  an "Advanced filters" disclosure so a new visitor sees the
  discovery-first Quick Search chips before the technical query tool.
- **Empty search results** now explain that a gap in the data isn't proof
  a device lacks a capability ("nobody has submitted evidence for it
  yet"), with a "Contribute a scan" call to action — the card's version
  switches to Explore My Devices where sharing a scan actually happens;
  the site's version links to its existing Contribute section.
- Two deliberate deviations from the PRD's literal chip list, flagged for
  visibility: "Motion detection" and "Occupancy sensing" were combined
  into one "Motion / occupancy sensing" chip (both would otherwise filter
  to the identical Occupancy Sensing cluster); "Attribute reporting" was
  left out entirely, since no single existing facet value honestly
  represents "reports something" in general without a scan-schema change.

## [0.28.0]

A UX refinement pass from a user-authored PRD, explicitly scoped small:
no changes to the capability database or scan logic, purely readability
and disclosure changes to the Capability Explorer.

### Changed

- **Summary-first cards.** Each device card's always-visible summary is
  now strictly: manufacturer + model, local device name, the Community
  confidence trust panel, and Good for tags — everything protocol-level
  (Capabilities/cluster groups, commands, per-firmware endpoint detail)
  moved behind a new "Technical evidence ▾" disclosure row. The device
  header itself is no longer the click target for this (it used to
  double as both "what device is this" and "click to see raw protocol
  data", which stopped making sense once the header no longer previewed
  any of that detail).
- **Confidence ladder gained a 4th tier.** "Well confirmed" (5-9 scans)
  now sits between "Repeated observation" (Growing evidence) and "Strong
  evidence" (now labeled High confidence) — previously a device with 5
  scans and one with 50 both read as "Strong evidence", flattening a real
  difference in how well-established the evidence actually is. "Building"
  is now "Growing evidence" to match the requested wording.
- **"Good for" tag wording** tightened to match requested vocabulary where
  it's a safe 1:1 relabel with no change in evidence: Scenes → "Scene
  control", Metering → "Energy monitoring", Temperature → "Temperature
  sensing", Color Control → "Color control". Deliberately did not add a
  "Motion lighting" tag for occupancy sensors — a bare occupancy sensor
  has no evidence it can control a light itself, only that it detects
  motion, and this project's tags only ever claim what's actually
  confirmed.
- Community heartbeat's lead sentence reworded per the PRD's suggested
  copy, on both the card and the standalone site.
- Added a standing design-principle comment above the device-card
  renderer: the summary helps users decide; the technical evidence
  explains why the summary is true. Anything added later should pass
  that test before it lands on the card.

## [0.27.0]

The one feature from the last round of feedback the user asked to build
after confirming it was still wanted (item was framed more tentatively
than the others): a single compact trust panel per device card.

### Changed

- Each device card in Explore My Devices now shows one consolidated
  "Community confidence" panel (a ★★★★☆-style star rating, plus firmware
  version count, observation count, and last-confirmed date) instead of a
  confidence badge in the header, a separate scan-count summary line, and
  a separate discovery-note line spread across the card. The star rating
  is on its own graduated scale (1/2/3/4/5 stars at 1/2/5/10/20+ scans) —
  deliberately not a re-skin of confidenceLabel's 3 buckets, which would
  otherwise show a device with exactly 5 scans and one with 50 scans as
  the exact same rating. Evidence that conflicts across the community's
  own scans gets a distinct "⚠ Conflicting" callout instead of a lower
  star count, since that's a data-quality flag, not just "less mature".
  The full scan count and firmware breakdown are always available in the
  panel and the star rating's tooltip — nothing is hidden, just led with
  a friendlier headline.
- "Supports" renamed to "Capabilities", the expanded per-firmware detail
  is now visually de-emphasized and labeled "Technical evidence", the
  "Interesting so far" panel is now "Community heartbeat" with a framing
  lead sentence, and confidence badges elsewhere (the search results
  table, on both the card and the standalone site) show a friendlier
  trust-tier word with the full label kept as a tooltip — all from the
  same round of user feedback, shipped in 0.26.1 just before this.

## [0.26.1]

A second round of Capability Explorer polish from follow-up feedback on
0.26.0 — the reviewer's overall read was that the page now tells a
coherent story (what is this? → what's it good for? → what evidence backs
that?); these are refinements to that story, not a re-litigation of it.

### Changed

- "Supports" renamed to "Capabilities" — with "Good for" now leading the
  card, "Supports" no longer earned its own distinct heading for the same
  underlying information.
- The expanded per-firmware technical detail is now visually quieter (a
  small "Technical evidence" label, lighter text) so it reads as the
  evidence backing the Good for/Capabilities summary above it, not a
  second summary competing for the same attention.
- Confidence badges now show a friendlier trust-tier word (Preliminary /
  Building / High / Conflicting) instead of the literal evidence-count
  label (Single observation / Repeated observation / Strong evidence /
  Conflicting evidence) — the full original wording is kept as the
  badge's tooltip, and the plain scan/firmware counts underneath are
  unchanged, so no information is lost, it's just not what greets you
  first. Applied consistently on the card (device cards + search table)
  and the standalone site's search table.
- The "Interesting so far" panel is now "Community heartbeat", leading
  with a sentence framing the dataset as community-built and something
  every scan meaningfully contributes to, rather than opening straight
  into a specific fact like "newest contribution: X on firmware Y" that
  doesn't obviously matter to someone researching one particular device.
  The existing gated highlights (most-confirmed, firmware variety,
  firmware-dependent capabilities, recent activity) still follow
  underneath. Applied to both the card and the standalone site.
- Shortened the Capability Explorer's headline copy on both the card and
  the standalone site (tagline + meta description) to lead harder with
  what the feature does before explaining why to trust it.

## [0.26.0]

The two larger items from the same round of Capability Explorer feedback —
scoped and confirmed with the user before building, given how much
judgment they involve.

### Added

- **"Good for" tags** — the single most-requested item: short, plain-
  English use-case tags on each device card (e.g. "Switch things on/off",
  "Detect motion / occupancy", "Act as a remote / controller") answering
  "what can I actually do with this" without needing to know what a
  cluster or command is. Evidence bar is "same model, any firmware in the
  community database" rather than this exact device's exact firmware —
  firmware-exact coverage is sparse this early on, and a tag whose only
  confirming evidence came from a different firmware still shows (it's
  real evidence, not a guess) but is marked with a small caveat rather than
  presented as fully verified for your exact unit. Also added to the
  standalone site's expanded search results, which is arguably the more
  natural home for it — deciding whether to buy a device you don't own yet
  is exactly this question.
- Device cards that happen to be the subject of one of the "Interesting so
  far" panel's highlights (most-confirmed, most firmware variety,
  firmware-dependent capabilities, newest contribution) now show a short
  note saying so directly on the card — connecting the global panel to
  the actual device in front of you, instead of two panels that never
  visibly related to each other (the root of the "feels trivial" feedback).
- A new "recent activity" highlight (firmware observations added across
  the whole database in the last two weeks) gives the panel a real
  momentum signal instead of leaning on a single arbitrary "newest
  contribution" example to carry the "this is actively growing" idea.

## [0.25.3]

Readability pass on the Capability Explorer, based directly on user
feedback about the device-card page reading like it was built for Zigbee
experts rather than everyday users.

### Changed

- Device cards now lead with manufacturer/model (what the device actually
  is), with any custom Home Assistant name shown as a secondary line only
  when one is set — previously the custom name led and manufacturer/model
  was demoted to a muted subtitle, which duplicated information for
  unnamed devices and buried the more useful identity for named ones.
- Basic, Identify, and Groups cluster commands (`reset_fact_default`,
  `identify_query`, `add_if_identifying`, etc.) now show friendly
  Title-Case names instead of raw ZCL snake_case — these three clusters
  were the only ones missing from the command name table; every other
  cluster already had friendly names.
- "Reports state: yes/no" replaced with a plain-language sentence
  explaining what it means in practice: whether the device pushes state
  changes on its own or Home Assistant has to poll it.
- Record-count language standardized on "firmware observation(s)" across
  the card and the standalone site, replacing a mix of "confirmed
  endpoint/firmware record(s)" and "endpoint/firmware record(s)" that read
  as inconsistent and jargon-heavy for the same underlying number.

## [0.25.2]

Real names for two manufacturer-specific clusters that were showing as
"Cluster 0xfc11"/"Cluster 0xfc57" in the "Other reported clusters" summary,
found on a real SONOFF ZBMINIR2 — researched against the actual zigpy quirk
source and independent references rather than guessed from the hex ID.

### Added

- `0xFC57` ("Works with all Hubs" / WWAH) is now a recognized cluster name
  globally — verified as a semi-standardized cluster used consistently
  across multiple manufacturers for hub-compatibility signaling, not a
  vendor-private one.
- `0xFC11` is now recognized as "Device settings (Sonoff)" specifically for
  SONOFF devices, verified against zigpy/zha-device-handlers'
  `zhaquirks/sonoff/zbminir2.py` (attribute-only: external trigger mode,
  detach relay, turbo mode, network LED). This is scoped to SONOFF only,
  not a global mapping — the 0xFC00-0xFFFF range is manufacturer-private by
  convention, so the same numeric cluster ID can mean something completely
  different for another vendor. A global id-only mapping would risk
  confidently mislabeling another manufacturer's cluster, which is worse
  than the honest "unidentified" fallback it would replace.

## [0.25.1]

Two more Capability Explorer readability fixes, found while testing 0.25.0
against real devices.

### Added

- A specific note for pure controller endpoints (buttons, remotes, switches
  that only declare a cluster like On/Off as *output*, not input) explaining
  that they send commands rather than receive them, so there's nothing for
  a command-support scan to discover — the previous generic message left
  this looking broken rather than expected. This was the exact "no real
  controllers is not possible scanning" gap MattWestb raised
  (zigbee-capabilities#57), confirmed live on a SONOFF SNZB-01M.
- Explore My Devices' "Supports" section no longer gives an unidentified,
  reports-only cluster (a raw "Cluster 0xNNNN" fallback with nothing under
  it — confusing, not informative) its own heading; these are combined into
  one summary line instead. A reports-only cluster this card *can* name
  (e.g. Occupancy Sensing) now also says plainly "Reports data on this
  cluster — no commands to send" rather than showing a bare heading with
  nothing following it. Applied to both the card and the standalone site.

## [0.25.0]

Prompted by real community feedback on the capability database
(zigbee-capabilities#57, MattWestb) — a device submission format change plus
several smaller Capability Explorer fixes, alongside internal prep for the
standalone site.

### Changed

- **One GitHub issue per device, not per endpoint.** Sharing a scan to the
  community database used to create a separate submission for every
  endpoint you checked — a multi-endpoint device (e.g. an air purifier with
  fan control and illuminance on different endpoints) meant filing several
  issues by hand. "Share this scan" (per-endpoint) is now "Share scan to
  community database" (per-device), shown once under the endpoint grid,
  covering every endpoint you've checked in one submission. Endpoints
  declared but not scanned — not checked yet, or not scannable at all via
  generic command discovery, such as a Green Power proxy endpoint — are
  still listed with their declared clusters rather than silently left out.
  The community-database ingest workflow accepts both the new device-level
  format and the older single-endpoint format, so nothing filed before this
  needs resubmitting.
- Fixed a real data-loss bug this change surfaced: the shared record used to
  fall back to a generic "Cluster 0x042a"-style placeholder for
  manufacturer-specific clusters this card's own cluster table doesn't
  recognize, even when zha_toolkit's own scan had already resolved a real
  name for it (e.g. IKEA's 0xfc7d as "Ikea Airpurifier"). The scan's own
  resolved title is now preferred.
- Fixed the Interesting Discoveries panel showing "Newest contribution: null
  null" for a submitted record with no manufacturer/model on file (a real
  data gap, not a code bug — caught live in a v0.25.0 screenshot). All four
  discovery types now skip an entry they can't actually name, rather than
  ever rendering "null" to the user.

### Added

- "Check supported commands" now shows a "may be asleep" hint for
  battery-powered devices while checking or on failure, matching the
  guidance already shown for the bindings scan — previously this flow gave
  no wake guidance at all.
- A specific note for endpoints that use Tuya's private cluster (0xEF00) to
  tunnel their real functionality, instead of the same generic "no command
  data for this endpoint" message shown for an ordinary cluster gap.
- Device photos are no longer fetched for a short list of Tuya model IDs
  (TS0601, TS011F, and similar) that are reused across many unrelated
  physical products — showing a confidently wrong photo was worse than the
  existing generic-shape fallback.

### Infrastructure

No card behavior changed here — a refactor plus a new build step to
support PRD v2 Phase 3 (the standalone zigbee-capabilities website):

- `CAPABILITY_DB_REPO`, `CAPABILITY_OUTCOME_PHRASE`, and
  `capabilityOutcomePhrase` moved out of `src/constants.js` into a new
  `src/capexplorer-constants.js` with zero dependency on the rest of the
  card. `capexplorer.js` now imports only from that file — the two
  together are the complete, genuinely standalone Capability Explorer data
  layer `capexplorer.js`'s own header comment always said it was meant to
  be. `constants.js` re-exports `CAPABILITY_DB_REPO` so nothing in card.js
  needed to change.
- `build.js` now copies `src/capexplorer.js` and
  `src/capexplorer-constants.js` into a local `docs/` folder on every
  `npm run build` (not `--watch`), so the standalone site's data layer
  never drifts out of sync with the card's. `docs/` itself (the actual
  site — `index.html`, `app.js`, `style.css`) is meant to be copied into
  the **zigbee-capabilities** repo, not published from this one — see the
  delivery notes for exact steps.

## [0.24.0] — 24 July 2026

### Added

- **Capability Outcomes.** Explore My Devices' "Supports" section now groups
  confirmed commands under a plain-English cluster heading — "Brightness
  control: Move to level, Step, Stop" instead of every command from every
  cluster flattened into one alphabetical tag wall mixing color, lock, and
  on/off commands together. Nothing about the underlying evidence is
  summarized away or hidden: a firmware-dependent command still shows up by
  its exact name, just organized under the cluster it actually belongs to.
  Sensor/reporting clusters (Occupancy, Illuminance, etc.) get their own
  group heading with no items, since their presence *is* the capability.
- **Interesting Discoveries.** A new panel above the mode picker surfaces a
  handful of factual highlights from the whole community database: the
  most-confirmed device, a device with real firmware-dependent capability
  differences worth checking before updating, and the newest contribution.
  Deliberately does **not** include any cross-manufacturer percentage or
  ratio claim (e.g. "manufacturer X's devices report bugs more often") —
  at the database's current scale (a few dozen devices) that kind of claim
  would be confidently wrong as often as right. Every discovery is either a
  plain fact (newest contribution) or gated behind a minimum sample size;
  anything that doesn't clear its threshold is simply omitted, never shown
  with a hedge.

## [0.23.0] — 24 July 2026 

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
