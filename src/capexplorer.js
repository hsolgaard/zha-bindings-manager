// -----------------------------------------------------------------------
// Capability Explorer data layer
// -----------------------------------------------------------------------
// Everything in this file is pure/data-only — no DOM, no `this`, no
// zha-toolkit calls — deliberately, so it can be lifted into a future
// standalone app or a GitHub Pages site (see the zigbee-capabilities
// product spec) without dragging the rest of the card along with it. The
// card wires this into the UI in card.js; nothing here depends on card.js.
// Its only import is capexplorer-constants.js, which is equally standalone
// — the two files together are the complete data layer the docs/ site
// (see build.js) copies verbatim and imports directly.
import { CAPABILITY_DB_REPO, capabilityOutcomePhrase } from "./capexplorer-constants.js";

// Client-side mirror of the ingest workflow's slugify (zigbee-capabilities
// repo, .github/workflows/ingest-submission.yml) — must stay behaviorally
// identical so a local device's raw manufacturer/model strings resolve to
// the same slug the community database's files (and this index) are keyed
// by. Collapsing every run of non a-z0-9 characters to a single hyphen is
// what makes "IKEA of Sweden" and "ikea-of-sweden" compare equal here.
export function slugify(s) {
  return (
    (s || "unknown")
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

const INDEX_URL = `https://raw.githubusercontent.com/${CAPABILITY_DB_REPO}/main/data/index.json`;
const CACHE_KEY = "zha-capability-explorer:index-cache";
// A community dataset like this changes by the hour at busiest, not by the
// minute — no reason to refetch a few-hundred-KB file on every card reload.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let _memoryCache = null;

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
    /* ignore quota/availability errors — cache is a nice-to-have, not required */
  }
}

// Fetches data/index.json from the community repo — a flat array of every
// confirmed endpoint+firmware capability record across every device anyone
// has submitted (see zigbee-capabilities' ingest workflow for exactly
// how it's built). Cached in memory for the life of the card instance and
// in localStorage across reloads (6h TTL). `force: true` bypasses both
// caches (used by an explicit "Refresh" action).
export async function fetchCapabilityIndex({ force = false } = {}) {
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

// Groups the flat index by manufacturer_slug+model_slug — most of the UI
// needs "everything known about this device" rather than one endpoint+
// firmware row at a time.
export function groupByDevice(index) {
  const map = new Map();
  for (const entry of index) {
    const key = `${entry.manufacturer_slug}|${entry.model_slug}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  return map;
}

// Cross-references a set of local ZHA devices (each with raw .manufacturer /
// .model strings straight from the HA device registry) against the
// community index, matching on slugified manufacturer+model rather than
// exact string equality — the same normalization the ingest workflow
// applies on the way in, so casing/punctuation differences don't matter.
// Returns only devices that have at least one community match; callers
// that also want to show local devices with *no* community data yet
// (worth a "share this scan" nudge) should diff against the full device
// list themselves.
export function matchLocalDevices(localDevices, index) {
  const grouped = groupByDevice(index);
  return localDevices
    .map((d) => {
      const manufacturerSlug = slugify(d.manufacturer);
      const modelSlug = slugify(d.model);
      const entries = grouped.get(`${manufacturerSlug}|${modelSlug}`) || [];
      return { device: d, manufacturerSlug, modelSlug, entries };
    })
    .filter((m) => m.entries.length > 0);
}

// Unique firmware versions observed across a set of entries (already
// filtered to one manufacturer+model), sorted with unknown/null last —
// "no firmware reported" is a real, distinct state (see the PRD's
// "preserve uncertainty" principle), not something to silently drop.
export function firmwareVersions(entries) {
  const set = new Set(entries.map((e) => e.firmware || null));
  return [...set].sort((a, b) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return String(a).localeCompare(String(b));
  });
}

// Every {id,name,present,conflicting} command row across every cluster in
// an entry, flattened, for "what can this device do" summaries. Only rows
// with present === true are commands worth listing — present === false or
// conflicting rows are real evidence too, just not "capabilities".
export function confirmedCommands(entry) {
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

// Searches the flat index against a set of optional facets (all AND'd
// together, case-insensitive substring match on text facets). Mirrors the
// PRD's Mode 1 facet list: manufacturer, model, cluster, direction,
// command, attribute, firmware, device type.
export function searchIndex(index, facets = {}) {
  const f = {
    manufacturer: (facets.manufacturer || "").trim().toLowerCase(),
    model: (facets.model || "").trim().toLowerCase(),
    firmware: (facets.firmware || "").trim().toLowerCase(),
    command: (facets.command || "").trim().toLowerCase(),
    attribute: (facets.attribute || "").trim().toLowerCase(),
    cluster: (facets.cluster || "").trim().toLowerCase(),
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
      const hit = clusters.some(([, c]) =>
        (c.commands_received || []).some((row) => row.present === true && String(row.name || "").toLowerCase().includes(f.command))
      );
      if (!hit) return false;
    }
    if (f.attribute) {
      const hit = clusters.some(([, c]) =>
        (c.attributes_confirmed || []).some((a) => String(a.name || "").toLowerCase().includes(f.attribute))
      );
      if (!hit) return false;
    }
    return true;
  });
}

// Turns a flat set of matched search-result entries (from searchIndex)
// into one summary per DEVICE instead of one row per firmware entry — the
// Search tab's move from a protocol-level table to discovery-oriented
// result cards. Deliberately pulls every entry for each matched device
// from the *whole* index, not just the entries that happened to match the
// current search facets, so a card's Community confidence and Good for
// reflect the complete evidence for that model — the same "same model,
// any firmware" evidence bar useCaseTags() and confidenceStars() already
// use elsewhere (see their own doc comments); a device that matched on
// one firmware's cluster shouldn't show a thinner confidence/Good-for
// picture than Explore mode would show for the exact same device.
//
// Sorted per the stated ranking: highest community confidence first (by
// star count — conflicting evidence sorts last, since that's a
// data-quality flag rather than a lower-but-still-real trust level), then
// most recently confirmed, then most firmware versions observed, then
// alphabetical by manufacturer/model — so the best-supported evidence
// surfaces first instead of an arbitrary index order.
export function groupSearchResultsByDevice(matchingEntries, fullIndex) {
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
      references: first.references || null,
    });
  });

  const starRank = (r) => (r.conflicting ? -1 : r.stars || 0);
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

// Every {id,name,present,conflicting} command row where present === false —
// the counterpart to confirmedCommands(). Real evidence too (the scan
// looked and it genuinely wasn't there), just not a "capability" — this is
// what the PRD's Search results spec calls "Not reported commands".
export function notReportedCommands(entry) {
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

// Whether this entry has evidence the device can report its own state
// changes (as opposed to only being controllable) — a real ZCL concept
// (the attribute's access string literally contains "REPORT"), not a
// guess, so "Reporting: yes" only ever reflects something a scan actually
// observed.
export function reportsState(entry) {
  return Object.values(entry.clusters || {}).some((cluster) =>
    (cluster.attributes_confirmed || []).some((a) => String(a.access || "").includes("REPORT"))
  );
}

// Classifies the strength of evidence behind one capability entry, per the
// PRD's Confidence Model (Single observation / Repeated observation /
// Well confirmed / Strong evidence / Conflicting evidence). Deliberately
// coarse — the thresholds aren't scientific, just enough to stop a single
// lucky scan from reading the same as fifty confirming ones. The
// "Well confirmed" bucket (5-9 scans) was added on top of the original
// 3-bucket model specifically so it isn't the same bucket as "Strong
// evidence" (10+) — a device with exactly 5 scans and one with 50 used to
// both read as "Strong evidence", which flattened a real, meaningful
// difference in how well-established the evidence actually is.
export function confidenceLabel(entry) {
  const anyConflicting = Object.values(entry.clusters || {}).some((cluster) =>
    (cluster.commands_received || []).some((row) => row.conflicting)
  );
  if (anyConflicting) return "Conflicting evidence";
  const scans = entry.scan_count || 0;
  if (scans <= 1) return "Single observation";
  if (scans < 5) return "Repeated observation";
  if (scans < 10) return "Well confirmed";
  return "Strong evidence";
}

// Short "trust tier" word for a confidenceLabel() result — real feedback
// was that a reader's actual question is "can I trust this", not "how many
// observations were there", so the badge people actually look at should
// answer that question directly. confidenceLabel()'s own wording (the
// PRD's precise Confidence Model terms) isn't replaced anywhere — it's
// still the right thing to show as a tooltip/detail, alongside the plain
// scan/firmware counts already shown beneath the badge in both UIs. This
// is purely a friendlier label for the exact same five values.
const CONFIDENCE_TIERS = {
  "Single observation": "Preliminary",
  "Repeated observation": "Growing evidence",
  "Well confirmed": "Well confirmed",
  "Strong evidence": "High confidence",
  "Conflicting evidence": "Conflicting",
};
export function confidenceTier(label) {
  return CONFIDENCE_TIERS[label] || label;
}

// Star rating (1-5) summarizing how much community evidence backs a whole
// device (every firmware entry combined) — the same underlying scan-count
// evidence confidenceLabel()/confidenceTier() use, just expressed as a
// single compact number instead of a text badge, so a reader can compare
// several devices' evidence maturity at a glance rather than reading a
// label on each one. This is deliberately its own graduated scale (1/2/4/
// 10/20+ scans) rather than reusing confidenceLabel's 3 buckets verbatim —
// those buckets top out at "5+ scans is Strong evidence", which would flatten
// a device with exactly 5 scans and one with 50 into the same 5-star
// rating, understating just how much more confirmed the second one is.
// Conflicting evidence anywhere overrides the star count entirely (rather
// than just docking a star) — conflicting evidence is a data-quality
// problem (the community's own scans disagree with each other), not simply
// "somewhat less trustworthy", so it gets a distinct, explicit callout
// instead of being folded into a lower number that could be misread as
// merely "early days".
export function confidenceStars(entries) {
  const anyConflicting = (entries || []).some((entry) =>
    Object.values(entry.clusters || {}).some((cluster) =>
      (cluster.commands_received || []).some((row) => row.conflicting)
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

// Given every community entry for one device (all firmware versions), finds
// capability names (commands or reporting-only cluster names) that aren't
// consistently present across every firmware version that confirmed them —
// i.e. capabilities worth flagging as firmware-dependent in Explore mode,
// rather than listed flatly alongside ones that have never changed.
export function firmwareDependentCapabilities(entries) {
  if (entries.length < 2) return new Set();

  // Every command name any entry has an opinion on at all (present or
  // explicitly not-reported), so a command that vanishes entirely in a
  // later firmware still counts as "differs" rather than being silently
  // skipped just because it's absent from that entry's rows.
  const allNames = new Set();
  entries.forEach((entry) => {
    Object.values(entry.clusters || {}).forEach((cl) => {
      (cl.commands_received || []).forEach((row) => allNames.add(row.name));
    });
  });

  const result = new Set();
  allNames.forEach((name) => {
    const states = new Set(entries.map((entry) => confirmedCommands(entry).some((c) => c.name === name)));
    if (states.size > 1) result.add(name);
  });
  return result;
}

// Capability Outcomes (PRD v2, Phase 2): turns a device's confirmed
// commands into plain-English, cluster-grouped statements instead of one
// flat alphabetical wall of raw ZCL command names — e.g. "Brightness
// control: Move to level, Step, Stop" instead of "Move", "Move to level",
// "Step", "Stop" scattered alphabetically next to unrelated color/lock
// commands. Grouping is the "translate technology into outcomes" piece;
// nothing about the underlying evidence is hidden or summarized away — a
// firmware-dependent command like "On with timed off" (the real gap that
// broke a Sonoff ZBMINIR2 binding, see CLUSTER_COMMANDS) still shows up by
// its exact name, just organized under the cluster it belongs to instead
// of floating loose. A cluster with no confirmed commands at all (sensor/
// reporting clusters like Occupancy, whose presence *is* the capability)
// gets its own group with no items — the group label alone is the
// capability, matching how the flat-list version showed the bare cluster
// name as a single tag.
export function groupCapabilitiesByOutcome(entries) {
  const fwDependent = firmwareDependentCapabilities(entries);
  // All entries passed in here are for one device (one manufacturer/model
  // — see groupByDevice), so any entry's manufacturer works; needed to
  // resolve vendor-private manufacturer-specific cluster names correctly
  // (see MANUFACTURER_SPECIFIC_CLUSTER_NAMES — the same cluster ID can mean
  // unrelated things for different vendors, so this can't be looked up by
  // ID alone).
  const manufacturer = (entries[0] || {}).manufacturer;
  const groups = new Map(); // clusterId -> { clusterName, items: Set<name>, isInput, isOutput }

  entries.forEach((entry) => {
    const inSet = new Set(entry.in_clusters || []);
    const outSet = new Set(entry.out_clusters || []);
    Object.entries(entry.clusters || {}).forEach(([clusterId, cluster]) => {
      if (!groups.has(clusterId)) {
        groups.set(clusterId, { clusterName: cluster.name || clusterId, items: new Set(), isInput: false, isOutput: false });
      }
      const g = groups.get(clusterId);
      if (cluster.name) g.clusterName = cluster.name;
      if (inSet.has(clusterId)) g.isInput = true;
      if (outSet.has(clusterId)) g.isOutput = true;
      (cluster.commands_received || [])
        .filter((r) => r.present === true)
        .forEach((r) => g.items.add(r.name));
    });
    // Second pass: seed groups for output-only clusters that never appear
    // in entry.clusters at all (since that's built only from in_clusters)
    // — without this, a genuine remote's On/Off/Level Control output
    // clusters vanish entirely instead of showing as Output. clusterName
    // left unset (not clusterId) so capabilityOutcomePhrase's fallback
    // formatting applies.
    outSet.forEach((clusterId) => {
      if (groups.has(clusterId)) return;
      groups.set(clusterId, { clusterName: null, items: new Set(), isInput: false, isOutput: true, unscanned: true });
    });
  });

  return [...groups.entries()]
    .map(([clusterId, g]) => {
      const items = [...g.items]
        .sort()
        .map((name) => ({ name, firmwareDependent: fwDependent.has(name) }));
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
        items,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Plain-English explanations for the Input/Output role every capability
// group above now carries. This is the exact distinction a real support
// thread got stuck on for over an hour: a device's own existing bindings
// using a cluster don't prove it can control another device with that
// cluster, because Home Assistant reporting its state (an attribute
// report) and issuing that cluster's commands to a peer are two different
// mechanisms — only the second one requires this "output" declaration, and
// no amount of binding-table evidence substitutes for it.
export const CAPABILITY_ROLE_LABEL = {
  input: "Input",
  output: "Output",
  both: "Input & Output",
  unknown: "Role unknown",
};
export const CAPABILITY_ROLE_EXPLANATION = {
  input:
    "This device can be commanded with this cluster — by Home Assistant, or by another device bound to it. It cannot use this cluster to control anything else.",
  output:
    "This device can control another device using this cluster, via a direct Zigbee bind — this is what lets one device operate another without Home Assistant in between.",
  both: "This device can both be commanded with this cluster and use it to control another device — a controller role on top of being controllable.",
  unknown: "This submission predates input/output tracking, so this cluster's role isn't recorded.",
};

// "Good for" buying guidance (PRD v2, Phase 3 — the single most-requested
// item from real user feedback on the Capability Explorer page: "which
// switch will let me control my dimmer relay?" should be answerable without
// knowing what a cluster is). Turns confirmed cluster+command evidence into
// short, plain-English use-case tags instead of requiring the reader to
// translate "0x0006 commands_received: on/off/toggle" into "this can act as
// a switch" themselves.
//
// Evidence bar is deliberately "same model, any firmware in the community
// database", not "this exact device's exact firmware" — firmware-exact
// coverage is sparse this early in the database's life, and a capability
// common to a whole product line essentially never disappears on one
// firmware revision. When every entry confirming a tag used a firmware
// other than the one actually asked about (see localFirmware), the tag
// still shows — it's real evidence, not a guess — but comes back with
// exactFirmware: false so the caller can render a small caveat rather than
// silently overclaim. This mirrors the "preserve uncertainty" principle
// used everywhere else in the Capability Explorer (see confidenceLabel,
// firmwareDependentCapabilities): real evidence is always shown, just never
// dressed up as more certain than it is.
// Labels intentionally stay close to the underlying evidence rather than
// the more marketing-flavored outcome names sometimes suggested (e.g.
// "Motion lighting" for a plain occupancy sensor) — a bare occupancy
// sensor has no evidence it can control a light itself, only that it can
// detect motion; a device only earns a "controls X" tag when this file
// has actually confirmed a command for X. Renamed a few labels below to
// closer match requested wording where that's a safe 1:1 (Scene control,
// Energy monitoring, Temperature sensing, Color control) without changing
// what evidence backs each one.
const USE_CASE_RULES = [
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
  { id: "ias-zone", clusterId: "0x0500", kind: "presence", label: "Raise security / contact alerts", fragment: "raise security or contact alerts" },
];
const USE_CASE_RULE_BY_ID = Object.fromEntries(USE_CASE_RULES.map((r) => [r.id, r]));

// Control-type clusters worth calling out specifically when a device
// declares them as *output* — i.e. clusters common enough on real
// controllers/remotes that a plain-English phrase is worth curating, same
// spirit as USE_CASE_RULES' curation for the input side. Not every possible
// output cluster gets one; groupCapabilitiesByOutcome's unscanned-cluster
// fallback already covers the general "declared some other output cluster"
// case with an honest generic label.
//
// Historical note: this list used to gate a single blunt "Act as a remote /
// controller" tag that was suppressed entirely if *any* of these four
// clusters was *ever* confirmed as input on *any* entry — meant to avoid
// mislabeling an ordinary switch/light as a remote, but it actually hid
// genuine dual-role devices (e.g. a device that is both commandable via
// On/Off *and* separately declares Level Control as output) and, worse,
// tied unrelated clusters together (input evidence on On/Off could hide an
// output tag that was really about Scene control). controlUseCases() below
// replaces that with a per-cluster check instead, sourced directly from
// groupCapabilitiesByOutcome's role field (the same role/badge logic the
// per-device capability panel already shows) — a cluster only needs to be
// declared output somewhere in the record to be listed here, independent
// of whether it (or any other cluster) is also input somewhere else. A
// cluster genuinely used both ways (role "both") is exactly the case the
// old logic couldn't represent at all.
const CONTROLLER_CLUSTER_IDS = ["0x0006", "0x0008", "0x0300", "0x0005"];

// Plain-English phrases for the same curated cluster list, used to build
// natural sentences (deviceOverview) rather than badge/tag labels. Kept
// separate from USE_CASE_RULES' labels because the grammar differs: those
// describe what the device itself does ("Switch things on/off"), these
// describe what it can do *to another device* over a direct bind.
const CONTROL_PHRASES_BY_CLUSTER = {
  "0x0006": "switch another device on or off",
  "0x0008": "dim another device",
  "0x0300": "change another device's color",
  "0x0005": "trigger scenes on another device",
};

// Per-cluster version of the old CONTROLLER_CLUSTER_IDS check: which of the
// curated control-relevant clusters does this device declare as *output*
// (role "output" or "both") anywhere in its community record, with a
// human phrase available for it. Deliberately reuses
// groupCapabilitiesByOutcome's already-computed role — the exact same
// signal behind each device's Input/Output badges — so this can never
// disagree with what a reader sees after clicking "View capabilities".
export function controlUseCases(entries) {
  if (!entries || !entries.length) return [];
  return groupCapabilitiesByOutcome(entries)
    .filter((g) => (g.role === "output" || g.role === "both") && CONTROL_PHRASES_BY_CLUSTER[g.clusterId])
    .map((g) => ({ clusterId: g.clusterId, label: g.label, phrase: CONTROL_PHRASES_BY_CLUSTER[g.clusterId] }));
}

// The other half of the answer controlUseCases() gives: which of the
// curated control-relevant clusters this device is confirmed commandable
// on (input) but has NO output declaration for anywhere in its community
// record. This exists specifically for the buyer's question this whole
// feature was built to answer — "I like this device, but before I buy it I
// want to know whether it'll let me directly bind it to control a separate
// relay" — where silence isn't good enough; a shopper needs an explicit
// no, not just the absence of a yes.
//
// Deliberately scoped to only the clusters this device is *already*
// commandable on, same reasoning as directControlSummary's positive case:
// for a device with no on/off/dimming/color/scene evidence at all (a plain
// sensor), a user isn't likely to be asking "can this control a relay" in
// the first place, so nothing is asserted either way — silence stays
// correct there. It's specifically the devices that look like they might
// be a switch/controller (commandable on one of these clusters) where the
// missing output declaration is the exact fact worth surfacing.
export function notControllableUseCases(entries) {
  if (!entries || !entries.length) return [];
  const controllableIds = new Set(controlUseCases(entries).map((c) => c.clusterId));
  const commandableIds = new Set(
    useCaseTags(entries)
      .filter((t) => USE_CASE_RULE_BY_ID[t.id] && CONTROLLER_CLUSTER_IDS.includes(USE_CASE_RULE_BY_ID[t.id].clusterId))
      .map((t) => USE_CASE_RULE_BY_ID[t.id].clusterId)
  );
  return [...commandableIds]
    .filter((clusterId) => !controllableIds.has(clusterId))
    .map((clusterId) => ({ clusterId, phrase: CONTROL_PHRASES_BY_CLUSTER[clusterId] }));
}

// entries: every community entry for one manufacturer+model (any firmware —
// see groupByDevice). localFirmware, if supplied, is the asking device's own
// sw_build_id (same format community entries use — see
// _capExpLocalFirmwareFor) — used only to flag exactFirmware, never to
// filter which tags are returned.
export function useCaseTags(entries, localFirmware = null) {
  if (!entries || !entries.length) return [];
  const tags = [];

  USE_CASE_RULES.forEach((rule) => {
    const confirmingFirmwares = new Set();
    entries.forEach((entry) => {
      const cluster = (entry.clusters || {})[rule.clusterId];
      const hit =
        rule.kind === "command"
          ? !!cluster && (cluster.commands_received || []).some((r) => r.present === true)
          : !!cluster || (entry.in_clusters || []).includes(rule.clusterId);
      if (hit) confirmingFirmwares.add(entry.firmware || null);
    });
    if (confirmingFirmwares.size) {
      tags.push({
        id: rule.id,
        label: rule.label,
        exactFirmware: !localFirmware || confirmingFirmwares.has(localFirmware),
      });
    }
  });

  // One tag per curated control-relevant cluster this device declares as
  // output — independent per cluster (see controlUseCases' doc comment for
  // why the old all-or-nothing version was wrong), so a device that's both
  // commandable on one cluster and a genuine controller on another (or even
  // the same) cluster gets both tags rather than the output one vanishing.
  controlUseCases(entries).forEach((c) => {
    const confirmingFirmwares = new Set();
    entries.forEach((entry) => {
      if ((entry.out_clusters || []).includes(c.clusterId)) confirmingFirmwares.add(entry.firmware || null);
    });
    tags.push({
      id: `control-${c.clusterId}`,
      label: `Directly ${c.phrase} (bind)`,
      exactFirmware: !localFirmware || confirmingFirmwares.has(localFirmware),
    });
  });

  return tags;
}

function joinPhrases(list, conj = "and") {
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} ${conj} ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, ${conj} ${list[list.length - 1]}`;
}

// The "voice-over" this whole Input/Output effort was for: a single plain-
// English sentence answering "can I use this device to directly control
// another Zigbee device, without a hub in the loop" — the exact question a
// support case spent over an hour on (see CAPABILITY_ROLE_EXPLANATION)
// before landing on the Input/Output distinction that makes this answerable
// at all. Deliberately its own function rather than folded into
// useCaseTags' chip labels: those are imperative-mood UI labels ("Switch
// things on/off") that don't reuse cleanly as sentence fragments, and this
// is specifically the one fact worth a full sentence rather than a chip,
// since it's the one most likely to be exactly what a reader came here to
// find out. Returns "" when the device declares no control-relevant output
// cluster, so the caller can render nothing rather than a hedge-filled "no"
// on every ordinary light bulb and sensor.
//
// The trailing disclaimer is deliberate and specific: it is NOT about how
// much community evidence backs this observation (the trust-panel/star
// rating shown right above already covers that) — it's that a device
// *declaring* an output cluster in its Zigbee signature is real, confirmed
// evidence it CAN issue that cluster's commands, but doesn't by itself
// guarantee a specific bind to a specific target device will succeed
// (binding table capacity, coordinator/router behavior, and the target
// device's own support all still matter).
// Deliberately says nothing about "Input"/"Output" (the ZCL terms the
// capability panel below uses) — this sentence is the first thing a
// visitor reads, with no legend or hover tooltip nearby to teach the
// jargon first, so it's phrased in terms anyone can follow: what the
// device can send, versus what it can only receive. Same underlying fact,
// plainer words. See notDirectControlSummary for the negative case.
export function directControlSummary(entries) {
  const control = controlUseCases(entries);
  if (!control.length) return "";
  const phrases = joinPhrases(control.map((c) => c.phrase));
  return `Can likely ${phrases} directly over a Zigbee bind, without Home Assistant in the loop — based on what this device's Zigbee signature declares it capable of sending, though not a guarantee any specific bind will succeed on every network.`;
}

// The explicit "no" counterpart to directControlSummary — for exactly the
// buyer's question this whole feature exists to answer: "I like this
// device, but before I buy it I want to know whether it'll let me
// directly bind it to control a separate relay." A missing positive
// sentence isn't a clear enough answer to that; this states the negative
// outright, for the same reason a spec sheet says "no" rather than just
// omitting a row. See notControllableUseCases' doc comment for why this
// only fires for a device that's already commandable on one of these
// clusters (so the question is a live one) rather than every device with
// no output cluster at all.
export function notDirectControlSummary(entries) {
  const notControl = notControllableUseCases(entries);
  if (!notControl.length) return "";
  const phrases = joinPhrases(
    notControl.map((c) => c.phrase),
    "or"
  );
  return `Cannot ${phrases} directly over a Zigbee bind — its Zigbee signature only lets it receive ${
    notControl.length > 1 ? "those commands" : "that command"
  }, not send ${notControl.length > 1 ? "them" : "it"} to another device.`;
}

// deviceOverview: the "quick overview" a reader wants at a glance — 2-3
// plain sentences instead of scanning a row of tags. Built entirely from
// facts useCaseTags() and directControlSummary() already compute (nothing
// here infers anything new), and with no live AI/LLM call — every clause
// below traces back to one specific confirmed command, declared cluster, or
// reporting attribute already used elsewhere on the card.
// Order is deliberate: what it can be commanded to do, then what it
// senses/reports, then — the most decision-relevant clause — whether it can
// directly control something else.
export function deviceOverview(entries) {
  if (!entries || !entries.length) return [];
  const tags = useCaseTags(entries).filter((t) => USE_CASE_RULE_BY_ID[t.id]);
  const commandAttrs = tags
    .filter((t) => USE_CASE_RULE_BY_ID[t.id].kind === "command")
    .map((t) => USE_CASE_RULE_BY_ID[t.id].attribute);
  const presenceFrags = tags
    .filter((t) => USE_CASE_RULE_BY_ID[t.id].kind === "presence")
    .map((t) => USE_CASE_RULE_BY_ID[t.id].fragment);

  // Returned as one {kind, text} entry per sentence, not a single joined
  // string, so the renderer can attach the Output badge to exactly the
  // control sentence (always last, when present) instead of the whole
  // paragraph.
  //
  // The command sentence is always phrased as "<attribute> can be
  // controlled by X, or by Y" — never "this device can <verb> things" —
  // specifically because a real device's on/off Input cluster was once
  // misread from a sentence phrased the second way as "this device
  // controls other devices," which is only true for a declared Output
  // cluster (a separate fact this function reports as its own "control"
  // sentence below). "another Zigbee device bound directly to it" is the
  // input side's exact real-world equivalent of "using this device as a
  // relay."
  const sentences = [];
  if (commandAttrs.length) {
    sentences.push({
      kind: "command",
      text: `This device's ${joinPhrases(commandAttrs)} can be controlled by Home Assistant, or by another Zigbee device bound directly to it.`,
    });
  }
  if (presenceFrags.length) {
    sentences.push({
      kind: "presence",
      text: `${commandAttrs.length ? "It can also" : "This device can"} ${joinPhrases(presenceFrags)}.`,
    });
  }
  const control = directControlSummary(entries);
  if (control) sentences.push({ kind: "control", text: control });
  const notControl = notDirectControlSummary(entries);
  if (notControl) sentences.push({ kind: "not-control", text: notControl });

  return sentences;
}

// Interesting Discoveries (PRD v2, Phase 2): a small set of factual,
// conservatively-gated highlights computed from the whole community index
// — deliberately NOT percentage or cross-manufacturer comparisons (e.g.
// "manufacturer X's devices report bugs more often"). At the database's
// current scale — a few dozen devices — a ratio-based claim like that
// would be confidently wrong as often as right, exactly the kind of thing
// the PRD's "conservative over clever" principle rules out. Every
// discovery here is either a plain fact (newest contribution — no
// statistical claim at all) or gated behind a minimum sample size before
// it's shown; a discovery that doesn't clear its threshold is simply
// omitted, never shown with a hedge, so the panel never reads as more
// confident than the evidence backing it.
export function interestingDiscoveries(index, opts = {}) {
  const {
    minScansForMostConfirmed = 5,
    minFirmwareVariety = 3,
    minScansForFwDependent = 2,
    minRecentActivity = 3,
    recentActivityWindowDays = 14,
    maxResults = 4,
  } = opts;

  const discoveries = [];
  const byDevice = groupByDevice(index);

  // Most-confirmed device: highest total scan_count across every firmware
  // entry, only surfaced once it clears a minimum — otherwise "most
  // confirmed" would just mean "whichever device happens to have 2 scans
  // instead of 1", not a real signal. manufacturer/model/manufacturerSlug/
  // modelSlug are carried on every discovery below (not just in the text)
  // so a device card that happens to be the one referenced can show its
  // own short "you're looking at that device" note instead of leaving the
  // connection to the reader (see card.js's per-card highlight lookup).
  let mostConfirmed = null;
  byDevice.forEach((entries, deviceKey) => {
    if (!entries[0].manufacturer || !entries[0].model) return;
    const total = entries.reduce((sum, e) => sum + (e.scan_count || 0), 0);
    if (total >= minScansForMostConfirmed && (!mostConfirmed || total > mostConfirmed.total)) {
      mostConfirmed = { deviceKey, manufacturer: entries[0].manufacturer, model: entries[0].model, total };
    }
  });
  if (mostConfirmed) {
    discoveries.push({
      id: "most-confirmed",
      deviceKey: mostConfirmed.deviceKey,
      cardNote: "Most-confirmed device in the community database.",
      text: `Most-confirmed device so far: ${mostConfirmed.manufacturer} ${mostConfirmed.model}, backed by ${mostConfirmed.total} scans.`,
    });
  }

  // Most firmware variety observed for one device — only interesting at
  // several distinct versions, not just any device with two.
  let mostFirmware = null;
  byDevice.forEach((entries, deviceKey) => {
    if (!entries[0].manufacturer || !entries[0].model) return;
    const versions = firmwareVersions(entries);
    if (versions.length >= minFirmwareVariety && (!mostFirmware || versions.length > mostFirmware.count)) {
      mostFirmware = { deviceKey, manufacturer: entries[0].manufacturer, model: entries[0].model, count: versions.length };
    }
  });
  if (mostFirmware) {
    discoveries.push({
      id: "most-firmware-variety",
      deviceKey: mostFirmware.deviceKey,
      cardNote: "Most firmware variety of any device on file.",
      text: `${mostFirmware.manufacturer} ${mostFirmware.model} has the most firmware variety on file: ${mostFirmware.count} distinct versions observed.`,
    });
  }

  // A real, observed functional difference between firmware versions of
  // the same device — but only when every firmware entry involved has at
  // least minScansForFwDependent scans, so a single flaky scan can't
  // manufacture a false "capability changed" discovery.
  let fwDependentExample = null;
  byDevice.forEach((entries, deviceKey) => {
    if (!entries[0].manufacturer || !entries[0].model) return;
    if (entries.some((e) => (e.scan_count || 0) < minScansForFwDependent)) return;
    const changed = firmwareDependentCapabilities(entries);
    if (changed.size && !fwDependentExample) {
      fwDependentExample = { deviceKey, manufacturer: entries[0].manufacturer, model: entries[0].model, names: [...changed] };
    }
  });
  if (fwDependentExample) {
    discoveries.push({
      id: "firmware-dependent-example",
      deviceKey: fwDependentExample.deviceKey,
      cardNote: "Confirmed capabilities differ by firmware version — see Compare Firmware below.",
      text: `${fwDependentExample.manufacturer} ${fwDependentExample.model}'s confirmed capabilities actually differ by firmware version (e.g. "${fwDependentExample.names[0]}") — worth checking Compare Firmware before assuming an update is safe.`,
    });
  }

  // Freshest contribution — a plain fact, no statistical gating needed,
  // and a nudge that this is a living, actively-growing resource. Skips any
  // entry missing manufacturer/model (a real data gap — e.g. a device
  // whose HA registry never had those fields populated) rather than
  // naming it "null null"; the next-newest nameable entry is used instead.
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
      text: `Newest contribution: ${newest.manufacturer} ${newest.model} on firmware ${
        newest.firmware || "unknown"
      }, confirmed by the community on ${newest.last_seen.slice(0, 10)}.`,
    });
  }

  // Recent activity — a real "is this database actively growing" signal
  // instead of relying on a single arbitrary newest-contribution example to
  // carry that whole idea: how many firmware observations (across every
  // device, not just one) were added in the last couple of weeks. Gated
  // behind a minimum so a quiet stretch doesn't get puffed up into a false
  // "look how active this is" claim — an empty result is just omitted, same
  // as every other discovery here. Not tied to a single device, so it never
  // gets a per-card note.
  const cutoff = Date.now() - recentActivityWindowDays * 24 * 60 * 60 * 1000;
  const recentCount = index.filter((e) => e.last_seen && new Date(e.last_seen).getTime() >= cutoff).length;
  if (recentCount >= minRecentActivity) {
    discoveries.push({
      id: "recent-activity",
      deviceKey: null,
      text: `${recentCount} firmware observations added to the community database in the last ${recentActivityWindowDays} days — this is a living, actively-growing resource.`,
    });
  }

  return discoveries.slice(0, maxResults);
}

// Looks up whether a specific manufacturer+model happens to be the subject
// of one of the global Interesting Discoveries — lets a device card show a
// short, concrete "this is that device" note instead of leaving the two
// panels (global highlights vs. per-device cards) feeling disconnected,
// which was the real substance behind user feedback that the discoveries
// panel felt trivial: the facts were true but never connected to anything
// the reader actually owned.
export function discoveryForDevice(discoveries, manufacturerSlug, modelSlug) {
  const key = `${manufacturerSlug}|${modelSlug}`;
  return discoveries.find((d) => d.deviceKey === key) || null;
}

// Firmware strings in the wild are wildly inconsistent ("1.0.8", a bare
// date like "20251127", or something from an entirely different ZCL source
// that isn't a version string at all) so this only ever returns a
// confident answer when both sides look like comparable numeric-segment
// version strings — anything else returns null (unorderable) rather than
// guessing, per the PRD's "preserve uncertainty" principle. Splits on any
// non-alphanumeric run, compares segment-by-segment, numerically where
// both sides parse as digits and as an exact string match otherwise.
export function compareFirmwareStrings(a, b) {
  if (!a || !b) return null;
  const segsA = String(a).split(/[^0-9a-zA-Z]+/).filter(Boolean);
  const segsB = String(b).split(/[^0-9a-zA-Z]+/).filter(Boolean);
  if (!segsA.length || !segsB.length) return null;
  const len = Math.max(segsA.length, segsB.length);
  for (let i = 0; i < len; i++) {
    const x = segsA[i];
    const y = segsB[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
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

// Compares a device's live-reported firmware (must already be in the same
// format community submissions use — the Basic cluster's sw_build_id, e.g.
// "1.0.8" — never Home Assistant's device-registry sw_version, which is
// frequently a different ZCL concept entirely, like a raw OTA file version
// "0x00001004") against every community entry known for that
// manufacturer+model. Returns null when there's nothing confidently newer
// (including when localFirmware isn't in a comparable format at all — see
// compareFirmwareStrings), or otherwise the newest confidently-newer
// firmware found plus a diff against the matching local entry, if the
// community happens to have one for exactly this device's firmware too.
export function newestFirmwareGap(localFirmware, entries) {
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
    diff: localEntry ? diffFirmware(localEntry, newest) : null,
  };
}

// Diffs two capability entries for the same manufacturer+model but
// different firmware: commands newly present in B, commands present in A
// but no longer in B, and attributes that appeared/disappeared. Only
// compares clusters both entries actually confirmed — a cluster missing
// from one side entirely is reported separately rather than treated as
// "every command removed", since that's a different, weaker kind of
// evidence (never scanned vs. scanned-and-absent).
export function diffFirmware(entryA, entryB) {
  const clustersA = entryA.clusters || {};
  const clustersB = entryB.clusters || {};
  const allClusterIds = new Set([...Object.keys(clustersA), ...Object.keys(clustersB)]);

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
      ...[...attrA].filter((n) => !attrB.has(n)).map((n) => ({ name: n, change: "removed" })),
    ];

    if (addedCommands.length || removedCommands.length || attributeChanges.length) {
      result.push({ clusterId, name, onlyIn: null, addedCommands, removedCommands, attributeChanges });
    }
  });
  return result;
}
