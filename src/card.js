import {
  DEFAULT_BINDABLE_OUT_CLUSTERS,
  MEMBERSHIP_EDGE_COLOR,
  HISTORY_LIMIT,
  DEFAULT_RETRY_COUNT,
  DEFAULT_BINDABLE_IN_CLUSTERS,
  DEFAULT_SCAN_BATCH_SIZE,
  DEFAULT_FP_MARKER_SCALE,
  GREEN_POWER_ENDPOINT,
  AMBIGUOUS_TUYA_MODELS,
  ENDPOINT_CONTROL_TYPES,
  CLUSTER_COMMANDS,
  CARD_VERSION,
  CAPABILITY_DB_REPO,
  clusterFriendlyPhrase,
  HEALTH_ICON,
  HEALTH_LABEL,
  HEALTH_RANK,
  refinedDomainLabel,
  TYPE_PRIORITY,
  clusterName,
  clusterColor,
  hex4,
} from "./constants.js";
import {
  parseClusterIdInput,
  normIeee,
  debounce,
  clamp,
  relTime,
  medianMs,
  formatDurationMs,
  uniqueClusters,
  escapeHtml,
  deviceHaUrl,
  toCsv,
  downloadFile,
} from "./utils.js";
import { bindingMatches, isIeee, sanitizeStoredBindings } from "./parser.js";
import { ZhaApi } from "./api-client.js";
import { SHELL_HTML } from "./template.js";
import { LocalStorageProvider } from "./storage/local-storage-provider.js";
import { HaStorageProvider } from "./storage/ha-storage-provider.js";
import {
  removedSources,
  deadTargetBindings,
  pruneRemovedSources,
  forgetSource,
  vanishedDevices,
  rememberDevices,
  knownDevicesToSave,
} from "./stale-bindings.js";
import { aboutIntegrationText } from "./about.js";
import { summarizeScan, toolkitAvailable } from "./scan-summary.js";
import { isManufacturerSpecific, manufacturerSpecificRule, unusualDeviceBindingRule } from "./health-rules.js";
import { deepLinkIeee, withoutDeviceParam } from "./deep-link.js";
import { groupClusterSupport, groupSupportSummary, groupSupportHealth } from "./group-support.js";
import {
  FLOW_CLUSTERS,
  DIRECT_BINDING_MAX_LIGHTS,
  controllerEndpoints,
  candidateTargets,
  findMatchingGroup,
  missingMembers,
  planClusters,
  flowResult,
  buildBehaviourReport,
  knownBehaviour,
  firmwareKey,
  suggestGroupName,
  targetKey,
  RESULT_TEXT,
} from "./group-flow.js";
import { COMMAND_CHECK_LIMIT_MS, formatElapsed, shouldApplyResult } from "./command-check.js";
import { bindOutcome, unbindOutcome, OUTCOME_LEVEL, pendingKey, reconcilePending } from "./action-verify.js";
import { STYLE } from "./styles.js";
import { explainUnbindFailure, toolkitErrorText } from "./unbind-errors.js";
import { groupRows, groupUnbindPlan, groupIdHex, groupDeleteReasons } from "./groups.js";
import { LQI_RECOMMENDED, buildMesh, routePath, pathVerdict, rateLqi, groupCheck, weakestLinks, meshSuggestions, isRouterLike, visibleRouterLinks } from "./mesh.js";
import {
  DIRECTION_ALL,
  DIRECTION_OUTBOUND,
  DIRECTION_INBOUND,
  bindingDirection,
  matchesDeviceFilter,
  directionRank,
  directionLabel,
  emptyTableState,
  deviceNameText,
  findSingleDeviceBySearch,
} from "./table-filter.js";
import {
  slugify,
  fetchCapabilityIndex,
  fetchBehaviourDoc,
  fetchZ2mModels,
  z2mProductCode,
  matchLocalDevices,
  firmwareVersions,
  groupByDevice,
  confirmedCommands,
  reportsState,
  groupCapabilitiesByOutcome,
  newestFirmwareGap,
  searchIndex,
  groupSearchResultsByDevice,
  diffFirmware,
  interestingDiscoveries,
  discoveryForDevice,
  useCaseTags,
  confidenceStars,
  deviceOverview,
  CAPABILITY_ROLE_LABEL,
  CAPABILITY_ROLE_EXPLANATION,
} from "./capexplorer.js";

// The generic-item keys stored through StorageProvider.getItem/setItem —
// i.e. everything persisted per-card except scan state and history, which
// have their own dedicated getScanState/setScanState and
// getHistory/setHistory methods. Kept as one list so the "does this
// browser/backend have anything worth a decision about" check and the
// one-time import both cover the exact same set of settings, rather than
// two hand-maintained lists quietly drifting apart as fields are added.
const SYNCED_ITEM_KEYS = [
  "filters",
  "positions",
  "endpoint-annotations",
  "retry-count",
  "scan-batch-size",
  "fp-marker-scale",
  "floorplan",
  "show-device-photos",
];

// Card-only Capability Explorer additions — mirror docs/app.js in the
// hsolgaard/zigbee-capabilities repo (the public website built on the
// same community index), which independently added the same "Generic
// Tuya" grouping and external-reference rendering. Deliberately kept
// out of capexplorer.js / capexplorer-constants.js: those two files are
// meant to stay a verbatim data-only layer usable outside this card, and
// neither manufacturer-label presentation nor HTML rendering belongs
// there. See docs/app.js for the byte-for-byte equivalent logic.
const GENERIC_TUYA_LABEL = "Generic Tuya";
const TUYA_MANUFACTURER_PATTERN = /^_T[A-Z0-9]+_/i;
// Per Hans's instruction, the per-cluster glossary explaining what each
// Zigbee cluster does (and what Input/Output specifically means for it)
// lives only on the public website, not duplicated inside this card — this
// links out to it rather than rebuilding the same reference here.
const CAPEXP_CLUSTERS_URL = "https://hsolgaard.github.io/zigbee-capabilities/clusters.html";
function isGenericTuyaManufacturer(m) {
  return TUYA_MANUFACTURER_PATTERN.test(String(m || ""));
}
// Prefer a device's own recognizable manufacturer name over an internal
// Tuya production code nobody would recognize (e.g. "_TZ3000_46t1rvdu")
// — "Generic Tuya" is the recognizable stand-in for that whole family.
function manufacturerDisplayLabel(m) {
  if (!m) return "—";
  return isGenericTuyaManufacturer(m) ? `${GENERIC_TUYA_LABEL} (${m})` : m;
}

// ---------------------------------------------------------------------------
// The card itself
// ---------------------------------------------------------------------------
// Tabs the toolbar search box filters. It is hidden on every other tab.
const SEARCHABLE_VIEWS = new Set(["graph", "table", "devices"]);

export class ZhaBindingMapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._api = null;
    this._config = {};

    this._devices = [];
    this._groups = [];
    // Last-known name, model and area of every device seen, keyed by
    // lower-case IEEE, so a device removed from ZHA can still be shown by
    // name in its leftover bindings. Persisted as the "known-devices" item.
    this._knownDevices = new Map();
    this._savedKnownJson = null;
    // Device-registry subscription (a Promise of the unsubscribe function)
    // and the debounce timer for the device-list reload it triggers.
    this._registrySub = null;
    this._deviceReloadTimer = null;
    this._clusterCache = new Map(); // ieee -> Cluster[]
    this._bindings = new Map(); // ieee(lower) -> [normalized binding, ...]
    this._positions = {}; // nodeKey -> {x,y}
    this._epAnnotations = {}; // ieee -> endpoint -> ENDPOINT_CONTROL_TYPES value
    this._filters = {
      coordinator: true,
      routers: true,
      endDevices: true,
      unbound: true,
      groups: true,
      hideCoordinatorBindings: true, // most devices auto-bind reporting clusters to the coordinator; that's rarely what you're trying to audit
      showReportingBindings: false, // real bindings a device uses to report its own state (e.g. to a group it belongs to) rather than to control anything — see _isControlBinding()
      search: "",
      types: new Set(), // entity-domain filter, e.g. "light", "switch" — empty = show all
      manufacturers: new Set(), // empty = show all
      areas: new Set(), // area_id ("__none__" for "no area") — empty = show all
    };
    this._view = "graph";
    // Capability Explorer tab state — index is the flat community dataset
    // (see capexplorer.js), loaded lazily the first time the tab is opened
    // and cached (memory + localStorage) by fetchCapabilityIndex itself, so
    // this is just where the card keeps its own reference/loading state.
    this._capExpMode = "explore"; // "explore" | "search" | "compare"
    this._capExpIndex = null;
    this._capExpLoading = false;
    this._capExpError = null;
    // IEEE of whatever device the exploded-view dialog is currently showing
    // (null when closed) — lets a background community-index load that
    // finishes while the dialog is open safely re-render it in place, so
    // Compare My Device can go from "checking…" to a real answer without
    // the user needing to touch anything.
    this._explodedDeviceIeee = null;
    this._capExpSearch = { manufacturer: "", model: "", cluster: "", command: "", attribute: "", firmware: "" };
    this._capExpCompare = { manufacturer: "", model: "", firmwareA: "", firmwareB: "" };
    this._capExpExpanded = new Set(); // manufacturerSlug|modelSlug keys expanded in Explore mode
    // Deliberately a separate Set from _capExpExpanded, even though both
    // are keyed by the same manufacturerSlug|modelSlug — Explore mode and
    // Find a Device are different contexts a reader can be in for the
    // same device (checking your own vs. researching a purchase), so
    // whether its technical detail is expanded in one shouldn't silently
    // carry over into the other.
    this._capExpSearchExpanded = new Set();
    this._status = null; // {level: 'info'|'warning'|'error'|'success', text, action?}
    // Binds/unbinds that were sent but couldn't be checked because the source
    // device didn't answer the re-read (usually a battery remote that went
    // back to sleep). In memory only: they're re-checked whenever that device
    // is scanned, and listed above the Bindings table until then.
    this._pendingChecks = new Map(); // pendingKey -> {kind, sourceIeee, sourceEndpoint, clusterId, target, sentAt}
    this._scanState = { running: false, done: 0, total: 0 };
    this._selectedEdgeId = null;
    this._loaded = false;
    this._dragCtx = null;
    this._fullscreen = false;
    this._lastScanAt = null; // ISO timestamp of the last time bindings were (re)scanned
    this._tableSourceFilter = null; // ieee — set by clicking a device name in the Devices tab or a Source in the Bindings table; matches bindings it sources OR is the direct target of
    this._tableDirection = DIRECTION_ALL; // "all" | "outbound" | "inbound" — only applies while a device is selected (clicked, or named by the search box)
    this._lastTableDevice = null; // ieee the table was last scoped to, so a change of device resets the direction toggle
    this._tableSort = { key: null, dir: 1 };
    this._devicesSort = { key: null, dir: 1 };

    // Persistence boundary — see src/storage/storage-provider.js.
    // _localStorage always exists (constructed here, unconditionally) —
    // it's the fallback whenever the optional backend isn't installed,
    // and the source _resolveStorageProvider() imports from on first
    // activation. this._storage is what every load/save call site
    // actually uses, and is only replaced with a HaStorageProvider after
    // _resolveStorageProvider() (called from _loadAll) detects the
    // backend and the user opts in — see that method for the full flow.
    this._localStorage = new LocalStorageProvider();
    this._storage = this._localStorage;
    this._backendAvailable = null; // null = not checked yet this load
    this._backendVersion = null; // integration's version, when it reports one
    this._backendInstalled = false; // integration answered, even if shared storage is switched off
    this._bundledCardVersion = null; // card version the integration ships (1.0.0+)
    this._storageMode = null; // "local" | "shared", set by _resolveStorageProvider

    // Binding Health: which devices failed to respond on the *most recent*
    // scan attempt. Restored from persisted storage on load (see
    // _loadScanState) as of M5 — previously in-memory only, per session,
    // which meant a device that failed its last scan attempt silently
    // looked "fine" again after a page reload, using whichever older
    // binding data happened to still be cached. See _evalBindingHealth's
    // Rule 7, and the "latest" half of the latest/last_complete split.
    this._scanFailures = new Set();
    // Devices whose most recent binds_get succeeded but only partially — a
    // later page of the binding table timed out while an earlier page
    // already had valid entries (see v0.9.1). The bindings shown for these
    // devices are real, just possibly incomplete. Also restored on load,
    // same reasoning as _scanFailures above.
    this._scanPartial = new Map(); // ieee(lower) -> {retrieved, total}
    // Learned per-device response-time/outcome history, persisted across
    // sessions — see _historyFor()/_recordScanOutcome(). Used to set
    // realistic scan-time expectations and to override the power_source-
    // based sleepy-device guess once we have real observed behavior.
    this._responseHistory = new Map(); // ieee(lower) -> {successMs:[], outcomes:[bool]}
    this._retryCount = DEFAULT_RETRY_COUNT; // single-device rescan only; bulk scan is unaffected
    this._scanBatchSize = DEFAULT_SCAN_BATCH_SIZE; // how many devices _scanBindings reads concurrently
    this._fpMarkerScale = DEFAULT_FP_MARKER_SCALE; // Floor Plan marker size, % of the auto-computed radius
    this._tableHealthFilter = "all"; // "all" | "problems" | "error" | "warning" | "info"
    this._healthReqId = 0; // guards _ensureHealthData against out-of-order fetches

    // Per-endpoint command-discovery scans (zha_toolkit.scan_device), keyed
    // "ieee(lower):ep" — in-memory only, never persisted (it's a live radio
    // query, not something to trust as still-accurate across sessions).
    // Value shape: {status: "loading"|"done"|"error", scan, error}.
    this._commandScans = new Map();
    // Which "Supported commands" cluster rows are expanded, keyed
    // "ieee:ep:clusterId" — pure display state, in-memory only, reset makes
    // no sense to persist (nobody wants a dialog to reopen pre-expanded).
    this._expandedCmdClusters = new Set();
    // In-progress "share this device's scans" review, at most one at a
    // time: {key, record, title, body, url, tooLong} | null, keyed by
    // device IEEE (one review covers every scanned endpoint on the device)
    // — see _shareDeviceCapabilities()/_buildDeviceCapabilityRecord().
    // Cleared whenever the exploded view is (re)opened for any device.
    this._shareDraft = null;

    // Floor plan tab state
    this._fpImageUrl = "";
    this._fpImageSize = null; // {w,h} natural pixel size of the loaded image
    this._fpPositions = {}; // ieee -> {x,y} as fractions (0..1) of the image size
    this._fpViewbox = null;
    this._fpDragCtx = null; // repositioning a placed device
    this._fpPanCtx = null;
    this._fpListDrag = null; // dragging a device from the unplaced list onto the map
    this._fpNodeEls = new Map();

    this._onResize = debounce(() => this._layoutSvgSize(), 150);
  }

  setConfig(config) {
    this._config = config || {};
    // Async now that filters go through this._storage (see below) —
    // this._storage is still the local-only default at this point
    // (_resolveStorageProvider hasn't run yet, that happens later in
    // _loadAll once hass/backend detection is available), so this is a
    // fast local-only bootstrap paint. _loadAll calls _loadFilters again
    // once storage mode is resolved, reconciling to shared storage's
    // filters if that's active and holds something different.
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
      /* ignore corrupt cache */
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
      areas: [...f.areas],
    });
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._api = new ZhaApi(hass);
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
      min_rows: 4,
    };
  }

  connectedCallback() {
    window.addEventListener("resize", this._onResize);
    // Re-attached (e.g. back from another dashboard view): listen again.
    if (this._hass) this._subscribeRegistry();
  }
  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
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
    this._registrySub = this._hass.connection
      .subscribeEvents((ev) => this._onRegistryEvent(ev), "device_registry_updated")
      .catch((e) => {
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
    if (sub) sub.then((unsub) => unsub && unsub()).catch(() => {});
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
        this._deviceReloadTimer = setTimeout(attempt, 3000);
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
    return ((this._epAnnotations[ieee] || {})[ep]) || "Not set";
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
      /* ignore quota errors */
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
        ...SYNCED_ITEM_KEYS.map((key) => storage.getItem(this._config.id, key)),
      ]);
      if (scanState && (scanState.last_complete || scanState.latest)) return true;
      if (history && Object.keys(history).length) return true;
      return items.some((v) => v !== null && v !== undefined);
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
      ...SYNCED_ITEM_KEYS.map((key) => this._localStorage.getItem(this._config.id, key)),
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
      const backendHasIt = backendItems[i] !== null && backendItems[i] !== undefined;
      const localHasIt = localItems[i] !== null && localItems[i] !== undefined;
      if (!backendHasIt && localHasIt) writes.push(haStorage.setItem(this._config.id, key, localItems[i]));
    });

    await Promise.all(writes);
    // Force the debounced save through now — see the doc comment above.
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
    this._lqiThr = probe.lqi || { ...LQI_RECOMMENDED };
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

    // First time this browser has seen the backend.
    const haStorage = new HaStorageProvider(this._hass, this._config.id);
    const hasLocalData = await this._hasExistingLocalData();
    if (!hasLocalData) {
      this._storageMode = "shared";
      this._saveStorageModePreference("shared");
      this._storage = haStorage;
      return;
    }

    const useShared = confirm(
      "ZHA Bindings Manager found shared storage (the ZHA Bindings Manager integration) on this Home Assistant instance.\n\n" +
        "Use shared storage? Anything shared storage is missing (bindings, floor plan, filters, and other settings) " +
        "will be filled in from this browser's local copy. Anything already saved there — e.g. from another browser " +
        "or device — will NOT be overwritten.\n\n" +
        "OK — use shared storage\nCancel — keep using this browser only"
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
      /* ignore */
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
    // Reload everything this._storage covers (see _loadAll) so the card
    // actually reflects this browser's own data right away, not just the
    // badge — same set of loads as _loadAll, minus re-resolving storage
    // mode (already known) and re-fetching devices/groups (unchanged).
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
      /* ignore quota errors */
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
        badge.textContent = "☁ Shared in Home Assistant";
        badge.title = "This card's scan data is saved centrally via the ZHA Bindings Manager integration — available from any browser or device.";
      } else if (this._storageMode === "local") {
        badge.textContent = "🔒 This browser only";
        badge.title = this._backendAvailable
          ? "This card's scan data is saved only in this browser. A shared backend is installed but you've chosen not to use it — see the ⚙ settings panel to change that."
          : "This card's scan data is saved only in this browser. See the ⚙ settings panel for an optional way to share it across devices.";
      } else {
        badge.textContent = "";
        badge.title = "";
      }
    }

    const detail = this._q("#storage-mode-detail");
    if (detail) {
      detail.textContent =
        this._storageMode === "shared"
          ? "Using shared storage: this browser's scan data is saved via the ZHA Bindings Manager integration, so it's the same data in every browser and device that opens this card."
          : "Using this browser's local storage: scan data is only available here, not shared with other browsers or devices.";
    }

    const backendLine = this._q("#backend-version-line");
    if (backendLine) {
      backendLine.textContent = aboutIntegrationText({
        checked: this._backendAvailable !== null,
        installed: this._backendInstalled,
        storageOn: this._backendAvailable,
        version: this._backendVersion,
        bundledCardVersion: this._bundledCardVersion,
        cardVersion: CARD_VERSION,
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
        // Stored data is untrusted (1.4.1): rebuild every binding from
        // strictly typed fields and drop anything malformed.
        const { bindings, dropped } = sanitizeStoredBindings(state.last_complete.bindings);
        if (dropped) console.warn(`[ZHA Bindings Manager] ignored ${dropped} malformed saved binding(s)`);
        this._bindings = bindings;
        const savedAt = state.last_complete.savedAt;
        this._lastScanAt = typeof savedAt === "string" && !Number.isNaN(Date.parse(savedAt)) ? savedAt : null;
      }
      const failures = state.latest && Array.isArray(state.latest.failures) ? state.latest.failures : [];
      this._scanFailures = new Set(failures.filter(isIeee).map(normIeee));
      const partial = (state.latest && state.latest.partial) || {};
      this._scanPartial = new Map(
        typeof partial === "object" && !Array.isArray(partial)
          ? Object.entries(partial).filter(([k]) => isIeee(k)).map(([k, v]) => [normIeee(k), v])
          : []
      );
    } catch (e) {
      /* ignore corrupt cache */
    }
  }
  /** Saves last_complete (always) and, when `latestOutcome` is supplied —
   *  i.e. right after a scan run, not on every incidental call — latest
   *  too. Kept as one write so the two halves of the split can't drift out
   *  of sync with each other in storage. */
  async _saveScanState(latestOutcome) {
    try {
      const bindings = Object.fromEntries(this._bindings);
      this._lastScanAt = new Date().toISOString();
      await this._storage.setScanState(this._config.id, {
        last_complete: { savedAt: this._lastScanAt, bindings },
        latest: latestOutcome || {
          attemptedAt: this._lastScanAt,
          failures: [...this._scanFailures],
          partial: Object.fromEntries(this._scanPartial),
        },
      });
    } catch (e) {
      /* ignore quota errors (large networks with many bindings) */
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
      this._responseHistory = new Map();
    }
  }
  async _saveHistory() {
    try {
      await this._storage.setHistory(this._config.id, Object.fromEntries(this._responseHistory));
    } catch (e) {
      /* ignore quota errors */
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
      lastSuccessAt: null,
    };
    if (success && durationMs != null) {
      entry.successMs.push(durationMs);
      if (entry.successMs.length > HISTORY_LIMIT) entry.successMs.shift();
      entry.lastSuccessAt = new Date().toISOString();
    }
    entry.outcomes.push(success);
    if (entry.outcomes.length > HISTORY_LIMIT) entry.outcomes.shift();
    entry.lastAttemptAt = new Date().toISOString();
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
      lastSuccessAt: entry.lastSuccessAt,
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
    // _render() (which wires the input and sets its initial value) runs
    // before _loadAll() calls this, so the input needs updating here too —
    // otherwise it's stuck showing the constructor default until something
    // else happens to re-render it.
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
    // Same reasoning as _loadRetryCount(): _render() wires the input before
    // _loadAll() calls this, so the input needs updating here too.
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
    // Same reasoning as _loadRetryCount(): _render() wires the input before
    // _loadAll() calls this, so the input needs updating here too.
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
      this._knownDevices = new Map();
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
      /* ignore quota errors */
    }
  }

  /** `action` (optional): {label, onClick} rendered as a button in the
   *  status bar, e.g. "Check again" after an unconfirmed bind. */
  _setStatus(level, text, timeout = 6000, action = null) {
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
    // Must run before anything below reads/writes through this._storage —
    // decides whether that's local or shared storage this load. Nothing
    // that persists through this._storage (which, as of v0.32.2, is
    // everything below except _loadFpImage) can safely run before this.
    await this._resolveStorageProvider();
    this._renderStorageMode();
    // All of these go through StorageProvider and must finish before the
    // first render below — for scan state specifically, this is what
    // stops a device that failed its last scan attempt from flashing
    // "fine" (default empty _scanFailures/_scanPartial) before correcting
    // itself, the original bug this boundary exists to fix; for the rest,
    // it's what makes shared storage actually show the shared values
    // instead of empty/default ones on first paint.
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
    this._setStatus("info", "Loading ZHA devices…", 0);
    await this._reloadDevices({ initial: true });
    this._openDeepLinkedDevice();
    this._pickUpIntegrationScans();
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
      return; // older integration without device_scans
    }
    const scans = (res && res.scans) || {};
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
      `Using ${taken.length} newer binding read${taken.length === 1 ? "" : "s"} from the integration (device-page Rescan or nightly check): ${taken.slice(0, 3).join(", ")}${taken.length > 3 ? "…" : ""}.`
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
      /* not essential */
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
    const fingerprint = (list) => list.map((d) => `${d.ieee}|${this._deviceLabel(d)}|${d.area_id || ""}`).join(";");
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
        `${names.join(", ")} ${vanished.length === 1 ? "was" : "were"} removed from ZHA. ${
          vanished.length === 1 ? "Its" : "Their"
        } saved bindings now show as errors on the Bindings tab, where you can forget them or unbind what still points to ${
          vanished.length === 1 ? "it" : "them"
        }.`,
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
    return `${src} → ${dst}, ${clusterName(p.clusterId)}`;
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
    const outcome =
      kind === "bind" ? bindOutcome({ present, sourceRead }) : unbindOutcome({ before, present, sourceRead });
    const entry = { kind, ...p, sentAt: Date.now() };
    const key = pendingKey(entry);
    if (outcome === "unconfirmed") this._pendingChecks.set(key, entry);
    else this._pendingChecks.delete(key);
    this._renderPendingBanner();

    const srcName = this._ieeeLabel(p.sourceIeee, { plain: true });
    const notRead =
      scan && scan.ran === false
        ? "the check couldn't run because another scan was already in progress"
        : `${srcName} didn't answer the check`;
    const wake = this._isBatteryDevice(this._devices.find((d) => normIeee(d.ieee) === normIeee(p.sourceIeee)) || {})
      ? " Battery devices usually go back to sleep straight away: press a button on it, then click Check again."
      : " Make sure it's powered and in range, then click Check again.";
    const message = {
      bind: {
        confirmed: "Binding confirmed on the device.",
        failed: `Bind failed: ${srcName} answered the check and this binding isn't on it.`,
        unconfirmed: `Bind sent, not confirmed yet: ${notRead}.${wake}`,
      },
      unbind: {
        confirmed: "Binding confirmed removed.",
        absent: "This binding didn't actually exist on the device — table refreshed.",
        failed: `Unbind failed: ${srcName} answered the check and this binding is still on it.`,
        unconfirmed: `Unbind sent, not confirmed yet: ${notRead}, so the table still shows the binding.${wake}`,
      },
    }[kind][outcome];
    const action =
      outcome === "unconfirmed" ? { label: "Check again", onClick: () => this._checkPendingAgain() } : null;
    // Earlier pending changes decided by the same rescan would otherwise be
    // hidden by this message replacing the scan summary.
    const earlier = this._lastSettled;
    this._lastSettled = null;
    let level = OUTCOME_LEVEL[outcome];
    if (earlier && earlier.level === "error" && level === "success") level = "warning";
    return {
      level,
      message: earlier && earlier.text ? `${message} Also: ${earlier.text}` : message,
      action,
      outcome,
    };
  }

  /** Re-checks every pending change whose source answered `read` (a Set of
   *  normalised IEEEs from _scanBindings). Returns {text, level} describing
   *  what was decided, empty when nothing was. */
  _reconcilePendingChecks(read) {
    if (!this._pendingChecks.size) return { text: "", level: null };
    const { pending, resolved } = reconcilePending([...this._pendingChecks.values()], {
      isPresent: (e) => this._bindingPresent(e.sourceIeee, e.sourceEndpoint, e.clusterId, e.target),
      wasRead: (ieee) => read.has(normIeee(ieee)),
    });
    this._pendingChecks = new Map(pending.map((e) => [pendingKey(e), e]));
    this._renderPendingBanner();
    if (!resolved.length) return { text: "", level: null };
    const words = { confirmed: "confirmed", failed: "did NOT go through" };
    const text = resolved
      .map(({ entry, outcome }) => `${entry.kind === "bind" ? "Bind" : "Unbind"} ${this._describeChange(entry)}: ${words[outcome] || outcome}.`)
      .join(" ");
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
    this._setStatus("info", `Checking ${sources.length === 1 ? this._ieeeLabel(sources[0], { plain: true }) : `${sources.length} devices`}…`, 0);
    const scan = await this._scanBindings(sources, { tries: this._retryCount });
    // _scanBindings has already reported what was decided; only say more
    // when the device still didn't answer.
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
      const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
      const list = Array.isArray(raw) ? raw : [];
      const ok = (e) =>
        e &&
        (e.kind === "bind" || e.kind === "unbind") &&
        isIeee(e.sourceIeee) &&
        Number.isInteger(e.sourceEndpoint) &&
        Number.isInteger(e.clusterId) &&
        typeof e.sentAt === "number" &&
        e.sentAt > cutoff &&
        e.target &&
        (e.target.isGroup ? Number.isInteger(e.target.groupId) : isIeee(e.target.ieee) && Number.isInteger(e.target.endpoint));
      this._pendingChecks = new Map(
        list.filter(ok).map((e) => {
          const clean = {
            kind: e.kind,
            sourceIeee: normIeee(e.sourceIeee),
            sourceEndpoint: e.sourceEndpoint,
            clusterId: e.clusterId,
            target: e.target.isGroup ? { isGroup: true, groupId: e.target.groupId } : { isGroup: false, ieee: normIeee(e.target.ieee), endpoint: e.target.endpoint },
            sentAt: e.sentAt,
          };
          return [pendingKey(clean), clean];
        })
      );
    } catch (e) {
      this._pendingChecks = new Map();
    }
    this._pendingLoaded = true;
    this._renderPendingBanner();
  }

  _savePendingChecks() {
    if (!this._pendingLoaded || !this._storage) return;
    const list = [...this._pendingChecks.values()];
    const sig = JSON.stringify(list);
    if (sig === this._pendingSaved) return;
    this._pendingSaved = sig;
    this._storage.setItem(this._config.id, "pending-checks", list).catch(() => {});
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
      <ul class="pending-list">${items
        .map(
          (e) =>
            `<li>${e.kind === "bind" ? "Bind" : "Unbind"}: ${escapeHtml(this._describeChange(e))} <span class="muted">· sent ${escapeHtml(
              relTime(new Date(e.sentAt).toISOString())
            )}</span></li>`
        )
        .join("")}</ul>`;
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
      return { ok: true, message: "No matching coordinator bindings were cached for this endpoint — table refreshed." };
    }
    const stillPresent = beforeList.filter((item) =>
      this._bindingPresent(sourceIeee, sourceEp, item.clusterId, item.target)
    );
    const removedCount = beforeList.length - stillPresent.length;
    if (stillPresent.length === 0) {
      return { ok: true, message: `Confirmed removed: ${removedCount} of ${beforeList.length} coordinator binding(s).` };
    }
    return {
      ok: false,
      message: `Only ${removedCount} of ${beforeList.length} coordinator binding(s) were removed — ${stillPresent.length} still present after rescanning.`,
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
    // Returns {ran, read}: whether a scan actually ran, and the (normalised)
    // IEEEs that answered it. Bind/unbind verification needs the second to
    // tell "binding missing" apart from "device didn't answer the check".
    const read = new Set();
    this._lastSettled = null;
    if (this._scanState.running) return { ran: false, read };
    // Without zha-toolkit every device "fails", which used to be reported
    // as sleepy devices (integration issue #2). Say what's actually wrong.
    if (!toolkitAvailable(this._hass)) {
      this._setStatus(
        "error",
        "Can't scan: zha-toolkit isn't installed or isn't loaded, and ZHA Bindings Manager uses it to read binding " +
          "tables. Install zha-toolkit from HACS (Integrations), restart Home Assistant, then scan again.",
        0
      );
      return { ran: false, read };
    }
    const fullScan = !(ieeeList && ieeeList.length);
    // Claim the run before awaiting anything, so a second click can't start
    // a parallel scan while the device list reloads.
    this._scanState = { running: true, done: 0, total: 0 };
    this._renderStatus();
    // Check against ZHA's device list as it is now, not as it was when the
    // page opened: otherwise a full scan can't clear a removed device's
    // saved data, and a single-device scan of a removed device fails as if
    // the device were asleep. If the reload fails the old list is kept.
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
          error: err,
        });
        this._recordScanOutcome(ieee, { success: false });
        // Tracked for Binding Health's Rule 7 ("unable to verify") — in-memory
        // only, reflects just this most recent attempt for this device.
        this._scanFailures.add(normIeee(ieee));
        this._scanPartial.delete(normIeee(ieee));
        console.warn(`ZHA Binding Map: could not read bindings for ${ieee}:`, err.message || err);
      }
      // done++ and the two renders below are safe to run out of completion
      // order — done is a simple counter, and both renders read current
      // state fresh rather than assuming this device was the most recent.
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
    // A full scan covers every device ZHA has, so anything else in the
    // saved data belongs to a device that's since been removed. Drop it
    // here; pruneRemovedSources() refuses to act on an empty device list.
    const pruned = fullScan ? pruneRemovedSources(this._bindings, this._devices) : [];
    pruned.forEach((ieee) => {
      this._scanFailures.delete(normIeee(ieee));
      this._scanPartial.delete(normIeee(ieee));
    });
    // No args: _scanFailures/_scanPartial already reflect this just-
    // completed run (updated live per device inside scanOne above), so
    // _saveScanState reads current state rather than needing it passed in.
    await this._saveScanState();
    const goneNames = notInZha.map((ieee) => this._ieeeLabel(ieee, { plain: true })).join(", ");
    if (notInZha.length && !targets.length) {
      this._setStatus(
        "info",
        `Not scanned: ${goneNames} ${notInZha.length === 1 ? "is" : "are"} no longer in ZHA. ${
          notInZha.length === 1 ? "Its" : "Their"
        } saved bindings show as errors; use Forget to clear them.`,
        0
      );
      this._render();
      return { ran: true, read };
    }
    // See scan-summary.js: separates sleepy battery devices from mains
    // devices, and recognises "nothing responded at all" as a zha-toolkit
    // problem rather than sleepy devices.
    const outcome = summarizeScan({
      okCount,
      partialCount,
      failures,
      skippedNames: notInZha.map((ieee) => this._ieeeLabel(ieee, { plain: true })),
      prunedCount: pruned.length,
    });
    // timeout: 0 — the final scan summary stays on screen until dismissed
    // (via the × button) rather than auto-hiding after a few seconds, since
    // it's easy to miss if you glance away while a larger scan is running.
    // Anything sent earlier that is waiting for this device to answer gets
    // decided now (see _reconcilePendingChecks).
    const settled = this._reconcilePendingChecks(read);
    this._lastSettled = settled; // picked up by _settleChange, which replaces this status
    const level =
      settled.level === "error" || outcome.level === "error"
        ? "error"
        : settled.level === "warning" || outcome.level === "warning"
        ? "warning"
        : outcome.level;
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
    for (const list of this._bindings.values()) out.push(...list);
    return out;
  }

  /** Bindings as they should be displayed (respects the coordinator-hide toggle). */
  _allBindings() {
    const raw = this._rawBindings();
    if (this._filters.hideCoordinatorBindings) {
      const coord = this._coordinatorIeee();
      // Coordinator bindings from a device removed from ZHA stay visible:
      // they're leftover data counted in Binding Health and the removed-
      // device banner, so hiding them made those counts disagree with the
      // rows shown (e.g. "8 saved bindings" with only 5 rows).
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
    // 1.5.1: manufacturer-specific clusters are out of scope (see
    // isManufacturerSpecific): never shown as control, never checked.
    if (isManufacturerSpecific(b.clusterId)) return "manufacturer";
    const clusters = this._clusterCache.get(b.sourceIeee);
    if (!clusters) return "unknown";
    const matches = (type) =>
      clusters.some((c) => c.type === type && c.endpoint_id === b.sourceEndpoint && c.id === b.clusterId);
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
          memberEndpoint: m.endpoint_id,
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
    return (
      Object.values(this._hass.devices).find((dev) =>
        (dev.identifiers || []).some(([domain, id]) => domain === "zha" && normIeee(id) === target)
      ) || null
    );
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
    // Since 1.3.2: zigbee2mqtt.io names photos by product code, which often
    // differs from the Zigbee model string (Clipsal "CH2AX/SWITCH/1" is
    // 41E2PBSWMZ/356PB2MBTZ). The community repo's z2m-models.json maps one
    // to the other, and its manufacturer|model fingerprints also resolve the
    // ambiguous Tuya models safely. Without a map hit, fall back to the
    // model string as before (and still no guess for ambiguous Tuya).
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
    fetchZ2mModels()
      .then((map) => {
        this._z2mModels = map;
        if (this._explodedDeviceIeee && this._q("#dialog") && this._q("#dialog").classList.contains("open")) {
          const d = this._devices.find((x) => x.ieee === this._explodedDeviceIeee);
          if (d) this._renderExplodedView(d);
        }
        if (this._q("#capexp-body")) this._renderCapExpBody();
        this._refreshDrawer();
      })
      .catch((err) => {
        console.warn("[ZHA Bindings Manager] Zigbee2MQTT model map unavailable", err);
      });
  }

  /** Offline, always-available fallback: a simple wall-plate shape with one
   *  rectangle per real endpoint, so a 3-gang switch reads as a 3-gang
   *  switch at a glance even with no internet access or no photo match. */
  _deviceShapeSvg(gangCount) {
    const n = Math.max(1, gangCount);
    const width = 64,
      height = 92,
      pad = 6;
    const gangW = (width - pad * (n + 1)) / n;
    let rects = "";
    for (let i = 0; i < n; i++) {
      const x = pad + i * (gangW + pad);
      rects += `<rect x="${x.toFixed(1)}" y="${pad}" width="${gangW.toFixed(1)}" height="${
        height - pad * 2
      }" rx="3" class="ep-shape-gang"/>`;
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
    const ids = new Set(clusters.map((c) => c.endpoint_id).filter((id) => id !== GREEN_POWER_ENDPOINT));
    this._rawBindings().forEach((b) => {
      if (b.sourceIeee === d.ieee && b.sourceEndpoint !== GREEN_POWER_ENDPOINT) ids.add(b.sourceEndpoint);
    });
    return [...ids].sort((a, b) => a - b);
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
      unknown: [],
    };
    raw.forEach((b) => {
      if (b.sourceIeee === d.ieee && b.sourceEndpoint === ep) {
        if (!b.isGroup && b.targetIeee === d.ieee) {
          out.self.push(b);
        } else if (!b.isGroup && b.targetIeee === coord) {
          out.reportsTo.push(b);
        } else {
          // Real-world case (reported in GitHub issue #1, MattWestb): ZHA's
          // own "add device to group" flow can leave a real binding-table
          // entry pointing at the group too, on a cluster the device only
          // ever declares as an input (e.g. a light's OnOff, which it
          // receives, never sends) — that's the device reporting/receiving
          // via the group, not controlling it. isGroup alone can't tell
          // those apart, so every binding here — group or device-to-device
          // — gets the same in/out cluster check _classifyBinding() already
          // uses for the Map/Floor Plan graphs, instead of assuming any
          // group-targeted binding must be "control". Real, not-yet-scanned
          // bindings land in their own "unknown" bucket rather than being
          // folded into "reports to" — we genuinely don't know what this one
          // does yet, and saying so is more honest than guessing either way.
          const cls = this._classifyBinding(b);
          if (cls === "manufacturer") {
            // out of scope (1.5.1)
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
    const map = new Map();
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
    const reqId = (this._healthReqId = this._healthReqId + 1);
    const ieees = new Set();
    this._rawBindings().forEach((b) => {
      if (this._devices.some((d) => d.ieee === b.sourceIeee)) ieees.add(b.sourceIeee);
      if (!b.isGroup && b.targetIeee && this._devices.some((d) => d.ieee === b.targetIeee)) {
        ieees.add(b.targetIeee);
      }
      // Group bindings: the members' clusters decide whether anything in
      // the group can act on the bound cluster (see group-support.js).
      if (b.isGroup) {
        this._groupMembers(b.groupId).forEach((m) => {
          if (!m.isCoordinator && this._devices.some((d) => d.ieee === m.ieee)) ieees.add(m.ieee);
        });
      }
    });
    const toFetch = [...ieees].filter((ieee) => !this._clusterCache.has(ieee));
    if (!toFetch.length) return;
    await Promise.all(toFetch.map((ieee) => this._ensureClusters(ieee).catch(() => {})));
    if (reqId !== this._healthReqId) return; // a newer bindings set has since superseded this fetch
    // Newly-cached cluster data can change which bindings _graphBindings()
    // hides, so the graph/floor plan need a redraw too, not just the table.
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
    return (g.members || [])
      .filter((m) => m.device && m.device.ieee)
      .map((m) => {
        const ieee = normIeee(m.device.ieee);
        const d = this._devices.find((x) => normIeee(x.ieee) === ieee);
        return {
          ieee: d ? d.ieee : ieee,
          endpoint: m.endpoint_id,
          name: d ? this._deviceLabel(d) : m.device.user_given_name || m.device.name || ieee,
          isCoordinator: ieee === coord || !!(d && (d.device_type === "Coordinator" || d.active_coordinator)),
        };
      });
  }

  /** Which members of a group support `clusterId`, from cached cluster lists. */
  _groupSupport(groupId, clusterId) {
    return groupClusterSupport({
      members: this._groupMembers(groupId),
      clusterId,
      clustersFor: (ieee) => this._clusterCache.get(ieee),
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
    const dupCounts = new Map();
    bindings.forEach((b) => {
      const key = this._healthDupKey(b);
      dupCounts.set(key, (dupCounts.get(key) || 0) + 1);
    });
    const coord = this._coordinatorIeee();
    const map = new Map();
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

    // Mirrors Rule 1, for the source side (implied by "source device exists"
    // being an OK condition) — reachable when a device is removed/re-paired
    // after being scanned, since scan results are cached across reloads.
    // Checked before Rule 7 and partial_scan: a removed device that also
    // failed its last scan (it was often offline before removal) is still
    // gone, and needs the Forget button rather than "wake it and rescan".
    // Skipped while the device list is empty so nothing reads as missing
    // before ZHA has loaded.
    if (this._devices.length && !this._devices.some((d) => normIeee(d.ieee) === sourceIeeeN)) {
      return {
        level: "error",
        code: "source_missing",
        message: "The source device no longer exists.",
        why: "This binding was read from a device that's since been removed from ZHA, so it's leftover saved data rather than something currently controllable. Unbinding isn't possible because there's no device left to send the command to.",
        recommendation: "Click Forget to remove the leftover data (nothing is sent to your Zigbee network). The next full scan also clears it automatically.",
      };
    }

    // Rule 7 — source didn't respond to the most recent scan attempt. Short-
    // circuits everything else: we're looking at possibly-stale cached data,
    // so no other rule is allowed to escalate this to Warning/Error.
    if (this._scanFailures.has(sourceIeeeN)) {
      return {
        level: "info",
        code: "unable_to_verify",
        message: "This device did not respond during the scan.",
        why: "Without a fresh response from this device, we can't confirm this binding is still valid — but it may well be fine.",
        recommendation: "Wake the device and rescan.",
      };
    }

    // Same short-circuit tier as Rule 7, but for a device that partially
    // responded — an earlier page of its binding table came back fine (so
    // the bindings shown here are real), but a later page timed out, so
    // there may be more bindings on this device that aren't shown yet.
    if (this._scanPartial.has(sourceIeeeN)) {
      const counts = this._scanPartial.get(sourceIeeeN);
      const countText =
        counts && counts.total != null && counts.retrieved != null
          ? ` (${counts.retrieved} of ${counts.total} binding table entries retrieved)`
          : "";
      return {
        level: "info",
        code: "partial_scan",
        message: `Only part of this device's binding table could be read.${countText}`,
        why: "A later page of this device's binding table timed out during the scan, so there may be additional bindings on it that aren't shown yet — the bindings that were read are still valid.",
        recommendation: "Rescan this device to try retrieving the rest of its binding table.",
      };
    }

    if (b.isGroup) {
      const groupExists = this._groups.some((g) => g.group_id === b.groupId);
      if (!groupExists) {
        return {
          level: "warning",
          code: "missing_group",
          message: "Referenced Zigbee group no longer exists.",
          why: "This binding sends commands to a Zigbee group that Home Assistant no longer knows about, so nothing receives them.",
          recommendation: "Recreate the group or remove the binding.",
        };
      }
      if (isManufacturerSpecific(b.clusterId)) return manufacturerSpecificRule(b.clusterId);
      // Can anything in the group act on this cluster?
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
          why: "Most Zigbee devices automatically bind a reporting cluster to the coordinator so Home Assistant gets status updates — this is normal and not something you created.",
          recommendation: null,
        };
      }
      const targetDevice = this._devices.find((d) => normIeee(d.ieee) === targetIeeeN);
      if (!targetDevice) {
        return {
          level: "error",
          code: "target_missing",
          message: "Target device no longer exists.",
          why: "A binding sends commands from the source straight to this target over Zigbee. Since the target no longer exists, those commands go nowhere, and the binding still uses one of the source device's limited binding-table slots.",
          recommendation: "Unbind it here, or use \"Unbind all\" above the table to clean up every binding to removed devices at once.",
        };
      }
      const targetClusters = this._clusterCache.get(targetDevice.ieee);
      if (!targetClusters) {
        // _ensureHealthData() hasn't finished fetching this target's clusters
        // yet — say so rather than guessing OK or Warning.
        return {
          level: "info",
          code: "checking",
          message: "Checking this binding's target…",
          why: "Still confirming the target device's current capabilities.",
          recommendation: null,
        };
      }
      const targetEndpoints = new Set(targetClusters.map((c) => c.endpoint_id));
      if (!targetEndpoints.has(Number(b.targetEndpoint))) {
        return {
          level: "warning",
          code: "missing_endpoint",
          message: "The target endpoint no longer exists.",
          why: "This binding refers to a part of the target device that no longer exists — likely because the device was re-paired or reconfigured.",
          recommendation: "Recreate the binding using a valid endpoint.",
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
          recommendation: "Verify the device capabilities or recreate the binding.",
        };
      }
      // Structurally fine, but unusual for a device-to-device binding (a
      // Basic binding, or one the source can only report on).
      const unusual = unusualDeviceBindingRule({ clusterId: b.clusterId, classification: this._classifyBinding(b) });
      if (unusual && (dupCounts.get(this._healthDupKey(b)) || 0) <= 1) return unusual;
    }

    if ((dupCounts.get(this._healthDupKey(b)) || 0) > 1) {
      return {
        level: "warning",
        code: "duplicate",
        message: "Duplicate binding detected.",
        why: "Having the same binding twice doesn't break anything, but it's redundant and can make the bindings list harder to read.",
        recommendation: "Consider removing duplicate entries.",
      };
    }

    return {
      level: "ok",
      code: "ok",
      message: "This binding looks structurally valid.",
      why: "The source and target devices, the endpoint, and the required capability all check out.",
      recommendation: null,
    };
  }

  _deviceBindingCount(ieee) {
    return this._rawBindings().filter((b) => b.sourceIeee === ieee || (!b.isGroup && b.targetIeee === ieee))
      .length;
  }

  // -------------------------------------------------------------------
  // Render: shell
  // -------------------------------------------------------------------
  _render() {
    const root = this.shadowRoot;
    if (!root.firstChild) {
      root.innerHTML = SHELL_HTML + `<style>${STYLE}</style>`;
      this._wireShell();
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
    this._qa(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    // The toolbar search only filters the Map, Bindings and Devices tabs.
    // Hide it elsewhere so it never looks like it should do something it
    // doesn't (Floor Plan, the Capability Explorer, which has its own
    // search, and Advanced). The typed term is kept for when you come back.
    const search = this._q("#search");
    if (search) search.style.display = SEARCHABLE_VIEWS.has(view) ? "" : "none";
    this._qa(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    this._render();
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
        retryInput.value = this._retryCount; // reflect the clamped value back
      });
    }
    const batchSizeInput = this._q("#scan-batch-size");
    if (batchSizeInput) {
      batchSizeInput.value = this._scanBatchSize;
      batchSizeInput.addEventListener("change", () => {
        this._saveScanBatchSize(batchSizeInput.value);
        batchSizeInput.value = this._scanBatchSize; // reflect the clamped value back
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
      this._q("#btn-filters").textContent = open ? "Filters ▴" : "Filters ▾";
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

    // Floor plan tab
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
        fpMarkerInput.value = this._fpMarkerScale; // reflect the clamped value back
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
      btn.textContent = `Scanning ${this._scanState.done}/${this._scanState.total}…`;
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
    el.textContent = this._lastScanAt
      ? `Bindings as of ${relTime(this._lastScanAt)} — click "Scan bindings" to refresh`
      : "Bindings never scanned yet";
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
    el.innerHTML = `<span class="status-text">${escapeHtml(this._status.text)}</span>${
      action ? `<button type="button" class="btn btn-small status-action">${escapeHtml(action.label)}</button>` : ""
    }<button type="button" class="status-close" aria-label="Dismiss">×</button>`;
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
        // A device with no real binding-table entry at all can still be a
        // genuine group member (see _membershipEdges) — that's a real
        // relationship worth showing, so it counts as "bound" here too.
        const hasBindings =
          (this._bindings.get(d.ieee) || []).length > 0 ||
          this._allBindings().some((b) => b.targetIeee === d.ieee) ||
          this._membershipEdges().some((m) => m.memberIeee === d.ieee);
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
    const set = new Set();
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
      const category = reg ? reg.entity_category : undefined;
      return category !== "diagnostic" && category !== "config";
    });
    return functional.length ? functional : entities;
  }

  _entityDeviceClass(entityId) {
    const state = this._hass && this._hass.states ? this._hass.states[entityId] : null;
    return state && state.attributes ? state.attributes.device_class : undefined;
  }

  /** Refined, human-friendly type tags for a device (e.g. "Garage Door", "Motion Sensor"),
   *  with diagnostic/config entities excluded. Used for hover detail and exports. */
  _deviceTypeTags(d) {
    const tags = new Set();
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
    if (!entities.length) return "—";
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
    return best || "—";
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
    const controlledDomains = new Set(["light", "switch", "cover", "fan"]);
    const looksControlled = this._deviceFunctionalEntities(d).some((e) =>
      controlledDomains.has(e.entity_id.split(".")[0])
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
    const types = new Map();
    const manufacturers = new Map();
    const areas = new Map();
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
      areas: [...areas.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)),
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
    el.innerHTML = items
      .map(
        ({ id, label }) =>
          `<button type="button" class="chip ${activeSet.has(id) ? "active" : ""}" data-chip="${escapeHtml(
            id
          )}">${escapeHtml(label)}</button>`
      )
      .join("");
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
    // Simple layout: coordinator in the middle, everything else on a ring
    // (or several concentric rings once there are many devices), unless a
    // saved drag position exists.
    const cx = 600,
      cy = 420;
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
      const angle = (2 * Math.PI * idxInRing) / Math.max(count, 1);
      const radius = 150 * ring;
      this._positions[n.key] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }

  _deviceIcon(d) {
    if (d.device_type === "Coordinator" || d.active_coordinator) return "⌂";
    const battery = d.power_source && /battery/i.test(d.power_source);
    // crude "role" guess just for the icon, not used for logic
    if (battery) return "🔘";
    return "💡";
  }

  /** Toolbar search for the Devices tab: matches either name (the one you
   *  gave the device or ZHA's own), manufacturer, model, area or IEEE, so a
   *  device can be found in a long list by whatever you remember about it. */
  _deviceMatchesSearch(d, s) {
    if (!s) return true;
    const hay = [d.user_given_name, d.name, d.manufacturer, d.model, this._areaName(d.area_id), d.ieee]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
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
    // Fire-and-forget: fetches source-device cluster metadata needed for
    // _isControlBinding() and re-renders once done. No-ops instantly if
    // everything's already cached (see _ensureHealthData()).
    this._ensureHealthData();
    if (!this._loaded) {
      empty.style.display = "flex";
      empty.textContent = "Loading devices…";
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
      isCoordinator: d.ieee === this._coordinatorIeee(),
    }));
    groupNodes.forEach((g) =>
      nodes.push({ key: this._groupNodeKey(g.group_id), kind: "group", group: g })
    );
    this._autoLayout(nodes);
    this._graphNodes = nodes;

    // clear
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

    this._nodeEls = new Map();
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
        class: "node-shape node-group",
      });
      g.appendChild(rect);
      const label = this._svgEl("text", { class: "node-label", y: size + 16 });
      label.textContent = n.group.name || `Group ${n.group.group_id}`;
      g.appendChild(label);
    } else {
      const r = n.isCoordinator ? 26 : 20;
      const circle = this._svgEl("circle", {
        r,
        class: `node-shape ${n.isCoordinator ? "node-coordinator" : "node-device"}`,
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

    // group parallel edges between the same pair so they fan out a little
    const pairCount = new Map();

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
        "marker-end": "url(#arrow)",
      });
      line.style.setProperty("--edge-color", clusterColor(b.clusterId));
      line.addEventListener("click", (e) => {
        e.stopPropagation();
        this._onEdgeClick(b);
      });
      this._edgesLayer.appendChild(line);
    });

    // 1.5.0: binds sent but not confirmed yet, dashed, so the Map shows
    // what's waiting for a battery device to wake up. Click: check again.
    [...this._pendingChecks.values()]
      .filter((e) => e.kind === "bind" && !this._bindingPresent(e.sourceIeee, e.sourceEndpoint, e.clusterId, e.target))
      .forEach((e) => {
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
          "marker-end": "url(#arrow)",
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

    // Group -> member edges, from real group membership data (see
    // _membershipEdges) — drawn with the same weight as a control binding
    // so switch -> group -> member reads as one continuous path.
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
        "marker-end": "url(#arrow)",
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
    const title = `<strong>Route ${escapeHtml(nameOf(r.sourceIeee))} → ${escapeHtml(nameOf(r.targetIeee))}</strong>`;
    if (!this._meshSnapshot) {
      this._meshEnsureLoaded();
      show(`${title}: loading the last network scan…`);
      return;
    }
    if (!Object.keys(this._meshSnapshot).length) {
      show(`${title}: no network scan yet. Open the <strong>Network</strong> tab and click <strong>Scan network</strong>.`);
      return;
    }
    const path = routePath(this._meshModel(), r.sourceIeee, r.targetIeee);
    const v = pathVerdict(path, this._lqiThr);
    const visible = new Set((this._graphNodes || []).map((n) => n.key));
    const hidden = new Set();
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
      t.textContent = `Hop ${i + 1}: ${nameOf(h.from)} → ${nameOf(h.to)}, ${typeof h.lqi === "number" ? `${level} (LQI ${h.lqi})` : "link quality not reported"}`;
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
    const chain = path.hops.length
      ? `${escapeHtml(nameOf(path.hops[0].from))}${path.hops.map((h) => ` → ${this._lqiChip(h.lqi)} ${escapeHtml(nameOf(h.to))}`).join("")}`
      : "";
    const verdict =
      v.level === "good"
        ? "Likely path looks good."
        : v.level === "weak"
        ? `Weak link: ${escapeHtml(nameOf(v.weakest.from))} to ${escapeHtml(nameOf(v.weakest.to))} (LQI ${v.weakest.lqi}).`
        : v.level === "none"
        ? `No route found. ${escapeHtml(path.note || "")}`
        : `Partly known. ${escapeHtml(path.note || "Some link qualities weren't reported.")}`;
    const hiddenNote = hidden.size
      ? ` <span class="muted">Not on the Map with the current filters: ${[...hidden].map((i) => escapeHtml(nameOf(i))).join(", ")} (tick Routers or End devices to see every hop).</span>`
      : "";
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
        el.setAttribute("x", (from.x + to.x) / 2 - (dy / dist) * 12);
        el.setAttribute("y", (from.y + to.y) / 2 + (dx / dist) * 12);
        return;
      }
      const g1 = this._nodeRadius(el.dataset.from) + 4, g2 = this._nodeRadius(el.dataset.to) + 6;
      el.setAttribute("d", `M ${from.x + (dx / dist) * g1} ${from.y + (dy / dist) * g1} L ${to.x - (dx / dist) * g2} ${to.y - (dy / dist) * g2}`);
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
      const dx = to.x - from.x,
        dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist,
        ny = dx / dist;
      const bend = offset * 18;
      const mx = (from.x + to.x) / 2 + nx * bend;
      const my = (from.y + to.y) / 2 + ny * bend;
      // Pull the endpoint back from the target's center to just outside its
      // icon (radius + a small gap), using the curve's actual incoming
      // direction (control point -> target) rather than the straight
      // source-to-target line, so the arrowhead lands next to the icon
      // instead of hidden underneath it — previously the line ran all the
      // way to dead center, putting marker-end directly behind the circle.
      const tdx = to.x - mx,
        tdy = to.y - my;
      const tdist = Math.hypot(tdx, tdy) || 1;
      const targetGap = this._nodeRadius(el.dataset.to) + 3;
      const ex = to.x - (tdx / tdist) * targetGap;
      const ey = to.y - (tdy / tdist) * targetGap;
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
      transform: `translate(${r * 0.72},${-r * 0.72})`,
    });
    badge.appendChild(this._svgEl("circle", { r: br, class: "node-role-badge-bg" }));
    const icon = this._svgEl("text", {
      class: "node-role-badge-icon",
      "text-anchor": "middle",
      dy: "0.35em",
      style: `font-size:${Math.round(br * 1.15)}px`,
    });
    icon.textContent = "🕹";
    badge.appendChild(icon);
    const title = this._svgEl("title");
    title.textContent =
      "This device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here — click it, then Show endpoints…, for the per-endpoint breakdown.";
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
    const cx = vb.x + vb.w / 2,
      cy = vb.y + vb.h / 2;
    const w = clamp(vb.w / factor, 200, 6000);
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
    this._q("#btn-fullscreen").textContent = this._fullscreen ? "⤢" : "⛶";
    this._q("#btn-fullscreen").title = this._fullscreen ? "Exit fullscreen (Esc)" : "Toggle fullscreen";
    // Give the browser a frame to apply the new layout before re-measuring.
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
    if (e.target.closest(".node")) return; // handled by node handler
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
      startClient: { x: e.clientX, y: e.clientY },
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
    let closest = null,
      closestDist = Infinity;
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
      // A plain click (no drag) on a device node opens its exploded view —
      // same entry point as the Devices tab's "Explode" button. Group nodes
      // have no exploded view, so a plain click on one still does nothing.
      if (ctx.node.kind === "device") this._openDeviceDrawer(ctx.node.device);
      return;
    }
    this._savePositions();
    if (ctx.dropTarget) {
      if (ctx.node.kind !== "device") {
        this._setStatus("error", "You can only bind from a device (not a group).");
        return;
      }
      // A remote dropped on a group opens the guided "Control lights" flow
      // with that group's lights preselected (1.1.0). Anything else, and
      // non-controllers, still go to the Advanced tab.
      if (
        ctx.dropTarget.kind === "group" &&
        controllerEndpoints(this._clusterCache.get(ctx.node.device.ieee)).length
      ) {
        this._openGroupFlow(ctx.node.device, { groupId: ctx.dropTarget.group.group_id });
        return;
      }
      const target =
        ctx.dropTarget.kind === "group"
          ? { kind: "group", group: ctx.dropTarget.group }
          : { kind: "device", device: ctx.dropTarget.device };
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
  // "Control lights with this remote" flow (1.1.0). Pure logic lives in
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
    await Promise.all(this._devices.map((d) => this._ensureClusters(d.ieee).catch(() => {})));
    if (!this._flow || this._flow.step !== "remote") return;
    const coord = normIeee(this._coordinatorIeee() || "");
    this._flow.remotes = this._devices
      .filter((d) => normIeee(d.ieee) !== coord && d.device_type !== "Coordinator" && !this._isRemovedDevice(d.ieee))
      .filter((d) => controllerEndpoints(this._clusterCache.get(d.ieee)).length)
      .map((d) => ({ ieee: d.ieee, name: this._deviceLabel(d), area: d.area_id ? this._areaName(d.area_id) : "", model: [d.manufacturer, d.model].filter(Boolean).join(" "), battery: this._isBatteryDevice(d) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this._renderGroupFlow();
  }

  async _openGroupFlow(source, { groupId = null, fromToolbar = false } = {}) {
    this._closeDrawer();
    const clusters = await this._ensureClusters(source.ieee).catch(() => []);
    const eps = controllerEndpoints(clusters);
    if (!eps.length) {
      this._setStatus("error", `${this._deviceLabel(source)} doesn't send On/Off, Level Control or Colour Control, so it can't control lights.`);
      return;
    }
    this._flow = {
      step: "pick",
      fromToolbar,
      sourceIeee: source.ieee,
      endpoints: eps,
      endpoint: eps[0].endpoint,
      selected: new Set(),
      groupChoice: groupId != null ? "existing" : "new",
      startGroupId: groupId != null ? Number(groupId) : null,
      candidates: null,
      mode: "group",
      groupName: suggestGroupName(this._areaName(source.area_id), this._deviceLabel(source)),
      clustersChosen: null,
      known: null,
      log: [],
      items: [],
      test: null,
      result: null,
      groupId: null,
      busy: false,
    };
    const panel = this._q(".dialog-panel");
    if (panel) panel.classList.add("wide");
    this._q("#dialog").classList.add("open");
    this._explodedDeviceIeee = null;
    this._renderGroupFlow();
    // Every device's cluster list (cheap local reads) to find what can be controlled.
    await Promise.all(this._devices.map((d) => this._ensureClusters(d.ieee).catch(() => {})));
    if (!this._flow) return;
    this._flowRefreshCandidates();
    if (this._flow.startGroupId != null) this._flowSelectGroup(this._flow.startGroupId);
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
        isCoordinator: normIeee(d.ieee) === coord || d.device_type === "Coordinator",
      })),
      clustersFor: (ieee) => this._clusterCache.get(ieee),
      sourceIeee: this._flow.sourceIeee,
      clusterIds: this._flowSourceClusters(),
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
      (g.members || [])
        .filter((m) => m.device)
        .map((m) => targetKey({ ieee: m.device.ieee, endpoint: m.endpoint_id }))
        .filter((k) => valid.has(k))
    );
  }

  _flowCanReview() {
    const f = this._flow;
    return !!(f && f.selected.size && !(f.groupChoice === "existing" && f.startGroupId == null));
  }

  /** One line under the group choice saying what will happen to the group. */
  _flowGroupNote() {
    const f = this._flow;
    if (!f) return "";
    const targets = this._flowTargets();
    if (f.groupChoice === "existing") {
      const g = f.startGroupId != null ? this._groups.find((x) => Number(x.group_id) === f.startGroupId) : null;
      if (!g) return "Pick a group: its lights are ticked below, and you can tick more to add them to it.";
      const add = missingMembers(g, targets);
      return add.length
        ? `${add.length} ticked light${add.length === 1 ? " isn't" : "s aren't"} in ${g.name} yet and will be added.`
        : `Uses ${g.name} as it is.`;
    }
    if (!targets.length) return "Tick the lights below. The card creates this group in ZHA and adds them to it.";
    const match = findMatchingGroup(this._groups, targets, this._coordinatorIeee());
    if (match) return `These lights are already the group ${match.name}, so that group will be reused instead.`;
    return `The card creates this group in ZHA with the ${targets.length} ticked light${targets.length === 1 ? "" : "s"}.`;
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
    return { sw_build_id: sw, registry_sw_version: (reg && reg.sw_version) || null };
  }

  _flowSlugKey() {
    const src = this._flowSource();
    return `${slugify(src.manufacturer)}/${slugify(src.model)}`;
  }

  _flowBehaviour() {
    return this._flow.mode === "direct" ? "direct_binding" : "group_binding";
  }

  async _flowLoadKnown() {
    let doc = null;
    try {
      doc = await fetchBehaviourDoc();
    } catch (e) {
      this._flow.knownError = e.message || String(e);
    }
    if (!this._flow) return;
    this._flow.known = knownBehaviour(doc, this._flowSlugKey(), "group_binding", this._flowFirmware());
    // Remotes others found don't use group bindings default to direct
    // binding, when that's on offer.
    if (this._flow.known.state === "problems" && this._flowTargets().length <= DIRECT_BINDING_MAX_LIGHTS) {
      this._flow.mode = "direct";
    }
    this._renderGroupFlow();
  }

  _flowPitfallsHtml(open) {
    return `<details class="flow-pitfalls" ${open ? "open" : ""}>
      <summary>Group bindings: what to expect</summary>
      <ul>
        <li><strong>Not every remote supports them.</strong> Some only bind to individual lights, some only to a single group. There's no way to ask a device in advance, so the card tries it and checks.</li>
        <li><strong>"Stored" isn't the same as "working".</strong> A few remotes accept a group binding but never send to it. That's why you'll be asked to press a button at the end.</li>
        <li><strong>Battery remotes need to be awake.</strong> Press a button on the remote just before binding, and again if the card says "not confirmed yet".</li>
        <li><strong>Lights hold the group membership.</strong> If a light is replaced or re-paired, add it to the group again.</li>
        <li><strong>Firmware matters.</strong> The same model can behave differently on different firmware.</li>
      </ul>
    </details>`;
  }

  _renderGroupFlow() {
    const f = this._flow;
    if (!f) return;
    const body = this._q("#dialog-body");
    const names = f.fromToolbar
      ? ["remote", "Choose remote", "pick", "Choose lights", "plan", "Review", "run", "Set up", "test", "Test", "done", "Result"]
      : ["pick", "Choose lights", "plan", "Review", "run", "Set up", "test", "Test", "done", "Result"];
    const stepList = [];
    for (let i = 0; i < names.length; i += 2) stepList.push([names[i], `${i / 2 + 1}. ${names[i + 1]}`]);
    const steps = `<ol class="flow-steps">${stepList
      .map(([k, v]) => `<li class="${k === f.step || (f.step === "stopped" && k === "run") ? "active" : ""}">${v}</li>`)
      .join("")}</ol>`;
    let html = "";

    if (f.step === "remote") {
      this._q("#dialog-title").textContent = "Control lights with a remote";
      const list =
        f.remotes == null
          ? `<p class="muted">Finding remotes and switches…</p>`
          : !f.remotes.length
          ? `<p class="muted">No device sends On/Off, Level Control or Colour Control commands, so there's nothing that can control lights. If you've just paired a remote, click ⟳ Devices and try again.</p>`
          : `<div class="flow-targets">${f.remotes
              .map(
                (r) => `<label class="flow-target"><input type="radio" name="flow-remote" value="${escapeHtml(r.ieee)}" ${r.ieee === f.sourceIeee ? "checked" : ""}>
                  <span>${escapeHtml(r.name)}${r.battery ? ' <span class="muted" title="Battery">🔋</span>' : ""}</span><span class="muted">${escapeHtml([r.area, r.model].filter(Boolean).join(" · "))}</span></label>`
              )
              .join("")}</div>`;
      body.innerHTML = `${steps}<div class="flow">
        <p>Pick the remote or wireless switch that should control your lights. The card then helps you choose the lights,
          puts them in a ZHA group (creating one if needed), binds the remote to it and checks that it works.
          The lights switch even when Home Assistant is down.</p>
        <p><strong>Remotes and switches</strong></p>${list}
        <div class="dialog-actions">
          <button class="btn btn-primary" id="flow-remote-next" ${f.sourceIeee ? "" : "disabled"}>Next: choose lights</button>
          <button class="btn" id="flow-cancel">Cancel</button>
        </div></div>`;
      this._qa('input[name="flow-remote"]').forEach((r) =>
        r.addEventListener("change", () => {
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
    this._q("#dialog-title").textContent = `Control lights with ${srcName}`;

    if (f.step === "pick") {
      const epSel =
        f.endpoints.length > 1
          ? `<label>Button (endpoint)
              <select id="flow-ep">${f.endpoints
                .map((e) => `<option value="${e.endpoint}" ${e.endpoint === Number(f.endpoint) ? "selected" : ""}>Endpoint ${e.endpoint}: ${escapeHtml(e.clusters.map(clusterName).join(", "))}</option>`)
                .join("")}</select></label>`
          : `<p class="muted">Sends ${escapeHtml(f.endpoints[0].clusters.map(clusterName).join(", "))} from endpoint ${f.endpoints[0].endpoint}.</p>`;
      const sortedGroups = [...this._groups].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      const existing = f.groupChoice === "existing";
      const groupSel = `<fieldset class="flow-mode flow-group-choice"><legend>Group</legend>
          <label><input type="radio" name="flow-group-choice" value="new" ${existing ? "" : "checked"}> New group
            <input type="text" id="flow-group-name" value="${escapeHtml(f.groupName)}" ${existing ? "disabled" : ""} aria-label="New group name"></label>
          <label class="${sortedGroups.length ? "" : "muted"}"><input type="radio" name="flow-group-choice" value="existing" ${existing ? "checked" : ""} ${sortedGroups.length ? "" : "disabled"}> Existing group
            <select id="flow-start-group" ${existing ? "" : "disabled"}><option value="">— pick a group —</option>${sortedGroups
              .map((g) => `<option value="${g.group_id}" ${Number(g.group_id) === f.startGroupId ? "selected" : ""}>${escapeHtml(g.name)}</option>`)
              .join("")}</select></label>
          <p class="hint" id="flow-group-note">${escapeHtml(this._flowGroupNote())}</p>
        </fieldset>`;
      const list =
        f.candidates == null
          ? `<p class="muted">Finding lights this remote can control…</p>`
          : !f.candidates.length
          ? `<p class="muted">No devices accept ${escapeHtml(this._flowSourceClusters().map(clusterName).join(" or "))}.</p>`
          : `<div class="flow-targets">${f.candidates
              .map((t) => {
                const k = targetKey(t);
                return `<label class="flow-target"><input type="checkbox" data-flow-target="${escapeHtml(k)}" ${f.selected.has(k) ? "checked" : ""}>
                  <span>${escapeHtml(t.name)}</span><span class="muted">${escapeHtml(t.clusters.map(clusterName).join(", "))}</span></label>`;
              })
              .join("")}</div>`;
      html = `${epSel}${groupSel}<p><strong>Lights to control</strong> (<span id="flow-count">${f.selected.size}</span> selected)</p>${list}
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
      const known = f.known
        ? `<div class="flow-known flow-known-${f.known.state}"><strong>What other users found:</strong> ${escapeHtml(f.known.text)}</div>`
        : `<div class="flow-known flow-known-unknown">Checking what other users have reported…</div>`;
      let seen = false;
      try {
        seen = localStorage.getItem("zbm:flow-pitfalls-seen") === "1";
      } catch (e) {
        /* optional */
      }
      const directOk = targets.length <= DIRECT_BINDING_MAX_LIGHTS;
      const mode = `<fieldset class="flow-mode"><legend>How to bind</legend>
          <label><input type="radio" name="flow-mode" value="group" ${f.mode === "group" ? "checked" : ""}> One group binding <span class="muted">(recommended: one binding-table slot per cluster, lights switch together)</span></label>
          <label class="${directOk ? "" : "muted"}"><input type="radio" name="flow-mode" value="direct" ${f.mode === "direct" ? "checked" : ""} ${directOk ? "" : "disabled"}> Bind to each light directly <span class="muted">(${directOk ? `uses ${targets.length} slot${targets.length === 1 ? "" : "s"} per cluster on the remote; lights may not switch exactly together` : `only offered for up to ${DIRECT_BINDING_MAX_LIGHTS} lights`})</span></label>
        </fieldset>`;
      let groupLine = "";
      if (f.mode === "group") {
        const start = f.startGroupId != null ? this._groups.find((g) => Number(g.group_id) === f.startGroupId) : null;
        const match = start ? null : findMatchingGroup(this._groups, targets, this._coordinatorIeee());
        if (match) groupLine = `<p>Group: reuse <strong>${escapeHtml(match.name)}</strong>, which already has exactly these lights.</p>`;
        else if (start) {
          const add = missingMembers(start, targets);
          groupLine = `<p>Group: use <strong>${escapeHtml(start.name)}</strong>${add.length ? ` and add ${escapeHtml(add.map((t) => t.name).join(", "))}` : ""}. Lights already in it that you didn't select stay in it.</p>`;
        } else {
          const name = (f.groupName || "").trim() || suggestGroupName(null, srcName);
          groupLine = `<p>Group: create <strong>${escapeHtml(name)}</strong> with ${targets.length} light${targets.length === 1 ? "" : "s"}.</p>`;
        }
      }
      const clusterRows = plan
        .map((p) => {
          const sum = groupSupportSummary(p.support, clusterName(p.clusterId), f.mode === "group" ? "the selected lights" : "the selected lights");
          if (!p.include) return `<li class="muted">Not bound: ${escapeHtml(clusterName(p.clusterId))}. None of the selected lights support it.</li>`;
          return `<li><label><input type="checkbox" data-flow-cluster="${p.clusterId}" ${f.clustersChosen.has(p.clusterId) ? "checked" : ""}> ${escapeHtml(clusterName(p.clusterId))}</label>
            <span class="flow-support flow-support-${sum.level}">${escapeHtml(sum.text.replace(/ in the selected lights/, " selected"))}</span></li>`;
        })
        .join("");
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
      const icon = { ok: "✅", fail: "❌", warn: "⚠", wait: "…", info: "ℹ" };
      const log = `<ul class="flow-log">${f.log
        .map((l) => `<li class="flow-log-${l.state}">${icon[l.state] || ""} ${escapeHtml(l.text)}</li>`)
        .join("")}</ul>`;
      let tail = "";
      if (f.step === "run" && f.awaitWake) {
        tail = `<p class="flow-callout">Press a button on <strong>${escapeHtml(srcName)}</strong> to wake it, then click Bind straight away.</p>
          <div class="dialog-actions"><button class="btn btn-primary" id="flow-bind-now">Bind now</button><button class="btn" id="flow-cancel">Cancel</button></div>`;
      } else if (f.step === "run" && f.verifying) {
        tail = `<p class="flow-callout">If ${escapeHtml(srcName)} runs on battery, <strong>press a button on it now</strong> so it answers the check.
          If the lights already respond to it, you can skip the check and go straight to the button test.</p>
          <div class="dialog-actions"><button class="btn" id="flow-skip-check">It already works: skip the check</button></div>`;
      } else if (f.step === "run" && f.unconfirmed) {
        tail = `<p class="flow-callout">${escapeHtml(srcName)} didn't answer the check, so the bindings aren't confirmed yet. Press a button on it, then click Check again.
          If the lights already respond to it, go straight to the button test instead.</p>
          <div class="dialog-actions"><button class="btn btn-primary" id="flow-check">Check again</button><button class="btn" id="flow-skip-check">It already works: test it</button><button class="btn" id="flow-cancel">Close</button></div>`;
      } else if (f.step === "test") {
        const dims = [...f.clustersChosen].includes(0x0008);
        tail = `<p class="flow-callout"><strong>Now test it.</strong> Press on/off on ${escapeHtml(srcName)}${dims ? ", then hold to dim" : ""}. Did the lights respond?</p>
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
    const groupName = f.groupId != null ? this._groupName(f.groupId) : "the lights";
    const advice = {
      works: `Done. ${f.mode === "group" ? `The remote controls ${groupName}.` : "The remote controls each light directly."}`,
      partial: `The binding works, but not every light responded. ${f.mode === "group" ? "The lights that didn't respond may not have joined the group: check them in ZHA's group page, or remove and re-add them." : "Check that the lights that didn't respond are powered and in range."}`,
      stored_ignored:
        "The remote stored the binding but nothing responded. Either it doesn't send to this kind of binding, or the lights didn't take the commands.",
      rejected:
        f.mode === "group"
          ? "The remote didn't accept the group binding."
          : "The remote didn't accept the bindings.",
    }[f.result];
    const level = f.result === "works" ? "success" : f.result === "partial" ? "info" : "warning";
    const fallback =
      f.mode === "group" && (f.result === "rejected" || f.result === "stored_ignored") && this._flowTargets().length <= DIRECT_BINDING_MAX_LIGHTS
        ? `<button class="btn" id="flow-direct">Bind to each light directly instead</button>`
        : f.mode === "group" && (f.result === "rejected" || f.result === "stored_ignored")
        ? `<p class="hint">Binding to each light directly is only offered for up to ${DIRECT_BINDING_MAX_LIGHTS} lights, because each light uses binding-table slots on the remote.</p>`
        : "";
    let shared = false;
    try {
      shared = localStorage.getItem(this._flowShareKey()) === "1";
    } catch (e) {
      /* optional */
    }
    const report = this._flowReport();
    const shareUrl = this._flowShareUrl(report);
    const share = shared
      ? `<p class="muted">You've shared a result for this remote and firmware before. Thanks! <a href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener" id="flow-share">Share this one too</a></p>`
      : `<div class="flow-share"><strong>Help other users: share this result.</strong>
          Nobody can tell in advance how a remote handles ${f.mode === "group" ? "group" : "direct"} bindings. Your result tells the next person with this remote what to expect.
          It opens a prefilled GitHub issue on the community database with the model, firmware, clusters and result only (no names or addresses).
          <div class="dialog-actions"><a class="btn btn-primary" id="flow-share" href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener">Share result</a></div>
          ${f.notInDb ? `<p class="hint">This remote isn't in the community database yet. Sharing a capability scan helps too: click the remote anywhere in the card, then <strong>Check and share capabilities…</strong>.</p>` : ""}
        </div>`;
    return `<div class="flow-result flow-result-${level}"><strong>Result: ${escapeHtml(RESULT_TEXT[f.result] || f.result)}.</strong> ${escapeHtml(advice)}</div>
      ${share}
      <div class="dialog-actions">${fallback}<button class="btn" id="flow-cancel">Close</button></div>`;
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
      cardVersion: CARD_VERSION,
    });
  }

  _flowShareKey() {
    return `zbm:flow-shared:${this._flowSlugKey()}|${firmwareKey(this._flowFirmware())}|${this._flowBehaviour()}`;
  }

  _flowShareUrl(report) {
    const title = `[Behaviour Report] ${report.manufacturer || "Unknown"} ${report.model || "Unknown"}: ${
      report.behaviour === "group_binding" ? "group binding" : "direct binding"
    } ${RESULT_TEXT[report.result] || report.result}`;
    const body =
      "Shared from ZHA Bindings Manager's \"Control lights with this remote\" flow.\n\n```json\n" +
      JSON.stringify(report, null, 2) +
      "\n```";
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
    this._qa('input[name="flow-group-choice"]').forEach((r) =>
      r.addEventListener("change", () => {
        f.groupChoice = r.value;
        if (r.value === "new") f.startGroupId = null;
        this._renderGroupFlow();
      })
    );
    this._qa("[data-flow-target]").forEach((cb) =>
      cb.addEventListener("change", () => {
        if (cb.checked) f.selected.add(cb.dataset.flowTarget);
        else f.selected.delete(cb.dataset.flowTarget);
        const btn = this._q("#flow-next");
        if (btn) btn.disabled = !this._flowCanReview();
        const count = this._q("#flow-count");
        if (count) count.textContent = String(f.selected.size);
        const note = this._q("#flow-group-note");
        if (note) note.textContent = this._flowGroupNote();
      })
    );
    on("#flow-next", "click", () => {
      f.step = "plan";
      f.clustersChosen = null;
      f.known = null;
      this._renderGroupFlow();
      this._flowLoadKnown();
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
    this._qa('input[name="flow-mode"]').forEach((r) =>
      r.addEventListener("change", () => {
        f.mode = r.value;
        this._renderGroupFlow();
      })
    );
    on("#flow-group-name", "input", (e) => {
      f.groupName = e.target.value;
      const note = this._q("#flow-group-note");
      if (note) note.textContent = this._flowGroupNote();
    });
    this._qa("[data-flow-cluster]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const id = Number(cb.dataset.flowCluster);
        if (cb.checked) f.clustersChosen.add(id);
        else f.clustersChosen.delete(id);
        const btn = this._q("#flow-run");
        if (btn) btn.disabled = !f.clustersChosen.size;
      })
    );
    const pit = this._q(".flow-pitfalls");
    if (pit) pit.addEventListener("toggle", () => {
      try {
        localStorage.setItem("zbm:flow-pitfalls-seen", "1");
      } catch (e) {
        /* optional */
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
    on("#flow-direct", "click", () => {
      f.mode = "direct";
      f.result = null;
      f.test = null;
      f.items = [];
      f.log.push({ state: "info", text: "Switching to binding each light directly." });
      f.step = "run";
      this._flowStartBinds();
    });
    on("#flow-share", "click", () => {
      try {
        localStorage.setItem(this._flowShareKey(), "1");
      } catch (e) {
        /* optional */
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
        this._flowLog("ok", `Using group ${match.name}, which already has these lights.`);
        return true;
      }
      const start = f.startGroupId != null ? this._groups.find((g) => Number(g.group_id) === f.startGroupId) : null;
      if (start) {
        f.groupId = Number(start.group_id);
        const add = missingMembers(start, targets);
        if (add.length) {
          this._flowLog("wait", `Adding ${add.map((t) => t.name).join(", ")} to ${start.name}…`);
          await this._api.addGroupMembers(f.groupId, add);
        }
      } else {
        const name = (f.groupName || "").trim() || suggestGroupName(null, this._deviceLabel(this._flowSource()));
        this._flowLog("wait", `Creating group ${name} with ${targets.length} light${targets.length === 1 ? "" : "s"}…`);
        const res = await this._api.createGroup(name, targets);
        f.groupId = res && res.group_id != null ? Number(res.group_id) : null;
        f.createdName = name;
      }
    } catch (err) {
      f.log = f.log.filter((l) => l.state !== "wait");
      this._flowLog("fail", `ZHA refused the group change: ${err.message || err.code || String(err)}`);
      return false;
    }
    // Re-read groups from ZHA and check the membership really is there.
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
      this._flowLog("warn", `${group.name} is ready, but ZHA doesn't list ${stillMissing.map((t) => t.name).join(", ")} as a member. Those lights won't respond.`);
    } else {
      this._flowLog("ok", `${group.name} has all ${targets.length} light${targets.length === 1 ? "" : "s"} (ID ${group.group_id}).`);
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
        f.items.push({ clusterId: c, target: { isGroup: true, groupId: f.groupId }, label: `${clusterName(c)} → ${this._groupName(f.groupId)}` });
      } else {
        targets
          .filter((t) => t.clusters.includes(c))
          .forEach((t) =>
            f.items.push({ clusterId: c, target: { isGroup: false, ieee: t.ieee, endpoint: t.endpoint }, label: `${clusterName(c)} → ${t.name}` })
          );
      }
    }
    this._flowLog("wait", `Binding ${f.items.length} item${f.items.length === 1 ? "" : "s"}…`);
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
    // 1.5.1: one attempt, not the rescan retry count. A battery remote that
    // has gone back to sleep made each retry wait ~45 s, so the check took
    // minutes while the binding already worked (forum, John_smith #22). The
    // user can wake it, or skip straight to the button test.
    f.verifying = true;
    f.log = f.log.filter((l) => l.state !== "wait");
    this._flowLog("wait", `Checking that ${this._deviceLabel(src)} stored the bindings…`);
    this._renderGroupFlow();
    const scan = await this._scanBindings([src.ieee], { tries: 1 });
    if (!this._flow || this._flow !== f) return;
    f.verifying = false;
    if (f.skippedCheck) {
      // The user went on to the button test while this ran: just record what
      // the check found, without moving the flow back.
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
    this._flowLog("wait", "Checking again…");
    f.log = f.log.filter((l) => !/: (confirmed|not confirmed yet|not accepted)$/.test(l.text));
    await this._flowVerify();
  }

  async _flowAnswerTest(answer) {
    const f = this._flow;
    // After a skipped check, lights responding prove the bindings are there.
    const outcomes = f.items.map((i) => (f.skippedCheck && answer !== "none" && i.outcome !== "failed" ? "confirmed" : i.outcome || "unconfirmed"));
    if (f.skippedCheck && answer === "none" && flowResult(outcomes, answer) === "unconfirmed") {
      f.log.push({ state: "warn", text: "Button test: no lights responded, and the bindings aren't confirmed yet." });
      f.step = "run";
      f.unconfirmed = true;
      f.skippedCheck = false;
      this._renderGroupFlow();
      return;
    }
    f.test = answer;
    f.result = flowResult(outcomes, answer);
    f.log.push({ state: "info", text: `Button test: ${answer === "all" ? "all lights responded" : answer === "some" ? "some lights responded" : "no lights responded"}.` });
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
    // 1.5.0: a dialog may have changed groups or bindings behind the tab
    // you're on (a new group from the guided setup only showed after a tab
    // change). Redraw the current tab when it's one that lists them.
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
    const el = this._q("#drawer");
    this._wireDrawerSwipe();
    if (el) {
      el.classList.add("open");
      el.setAttribute("aria-hidden", "false");
    }
    // Clusters decide whether "Control lights with this…" applies and
    // which bindings are control rather than reporting (the device's own and
    // those of every device bound to it or its groups). Fetch any that are
    // missing in the background and re-render when they're in.
    const id = normIeee(d.ieee);
    const groupIds = new Set(
      this._groups.filter((g) => (g.members || []).some((m) => m.device && normIeee(m.device.ieee) === id)).map((g) => Number(g.group_id))
    );
    const sources = new Set([d.ieee]);
    for (const b of this._rawBindings()) {
      if ((!b.isGroup && normIeee(b.targetIeee) === id) || (b.isGroup && groupIds.has(Number(b.groupId)))) sources.add(b.sourceIeee);
    }
    const missing = [...sources].filter((ieee) => !this._clusterCache.get(ieee));
    if (missing.length) {
      Promise.all(missing.map((ieee) => this._ensureClusters(ieee).catch(() => {}))).then(
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
      // Nothing stale left behind for the next device (1.5.0b6).
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
    const controls = new Map();
    const controlledBy = new Map();
    const reportsTo = new Map();
    let coordinatorClusters = 0;
    // 1.4.2: only bindings that send commands count as control. A binding
    // on a cluster the source only serves ("in") is the source reporting
    // its own state, e.g. a light bound to a group on Basic or On/Off.
    const isReporting = (b) => {
      const cls = this._classifyBinding(b);
      return cls === "reporting" || (cls === "unknown" && Number(b.clusterId) === 0);
    };
    const isManufacturer = (b) => this._classifyBinding(b) === "manufacturer";
    const problems = [];
    const add = (map, key, entry, cluster) => {
      if (!map.has(key)) map.set(key, { ...entry, clusters: new Set() });
      map.get(key).clusters.add(cluster);
    };
    for (const b of this._rawBindings()) {
      const h = health.get(b.id);
      const mine = normIeee(b.sourceIeee) === id || (!b.isGroup && normIeee(b.targetIeee) === id);
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
    // Groups this device is a member of, and who's bound to those groups.
    const memberOf = this._groups.filter((g) => (g.members || []).some((m) => m.device && normIeee(m.device.ieee) === id));
    for (const g of memberOf) {
      for (const b of this._rawBindings()) {
        if (b.isGroup && Number(b.groupId) === Number(g.group_id) && normIeee(b.sourceIeee) !== id && !isReporting(b) && !isManufacturer(b)) {
          const src = this._devices.find((x) => normIeee(x.ieee) === normIeee(b.sourceIeee));
          add(controlledBy, `d:${normIeee(b.sourceIeee)}`, { kind: "device", ieee: b.sourceIeee, name: src ? this._deviceLabel(src) : b.sourceIeee, missing: !src, via: g.name }, b.clusterId);
        }
      }
    }
    const seen = new Set();
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
      problems: uniqueProblems,
    };
  }

  _drawerRelListHtml(list, emptyText) {
    if (!list.length) return `<p class="muted drawer-empty">${escapeHtml(emptyText)}</p>`;
    return `<ul class="drawer-rel">${list
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => {
        const clusters = [...r.clusters].map(clusterName).join(", ");
        const name =
          r.kind === "device" && !r.missing
            ? `<a href="#" class="src-link drawer-dev-link" data-ieee="${escapeHtml(r.ieee)}">${escapeHtml(r.name)}</a>`
            : `<span>${r.kind === "group" ? "👥 " : ""}${escapeHtml(r.name)}${r.missing ? " (not in ZHA)" : ""}</span>`;
        const via = r.via ? ` <span class="muted">via group ${escapeHtml(r.via)}</span>` : "";
        return `<li>${name}${via}<span class="muted drawer-clusters">${escapeHtml(clusters)}</span></li>`;
      })
      .join("")}</ul>`;
  }

  /** 1.5.0: whether this model is in the community capability database.
   *  Returns HTML (escaped here). Loads the index once if it isn't yet. */
  _drawerCommunityStatus(d) {
    if (!d.manufacturer && !d.model) return `<span class="muted">Unknown model</span>`;
    if (!this._capExpIndex) {
      if (this._capExpError) return `<span class="muted">Couldn't load it</span>`;
      if (!this._capExpLoading) this._capExpLoadIndex();
      return `<span class="muted">Checking…</span>`;
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
    this._q("#drawer-title").textContent = this._deviceLabel(d);
    const rel = this._drawerRelations(d.ieee);
    this._ensureZ2mModels();
    const imgUrl = this._showDevicePhotos ? this._deviceImageUrl(d) : null;
    const photo = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="" class="drawer-photo" onerror="this.style.display='none'">`
      : "";
    const tags = this._deviceTypeTags(d);
    const reg = this._haDeviceRegistryEntry(d.ieee);
    const facts = [
      ["Area", this._areaName(d.area_id)],
      ["Model", [d.manufacturer, d.model].filter(Boolean).join(" ") || "Unknown"],
      reg && reg.sw_version ? ["Firmware", reg.sw_version] : null,
      ["Power", d.power_source || "Unknown"],
      ["Bindings read", this._lastScanCellInfo(d).html.replace(/<button[\s\S]*?<\/button>/, "")],
      ["Community database", this._drawerCommunityStatus(d)],
    ].filter(Boolean);
    const battery = this._isBatteryDevice(d);
    const haUrl = deviceHaUrl(d);
    const problems = rel.problems.length
      ? `<div class="drawer-section drawer-problems"><div class="drawer-section-title">Needs attention</div><ul>${rel.problems
          .slice(0, 5)
          .map((p) => `<li class="health-${escapeHtml(p.level)}">${escapeHtml(p.message)}</li>`)
          .join("")}</ul><a href="#" class="src-link" id="drawer-problems-link">See them in the Bindings tab</a></div>`
      : "";
    const isController = controllerEndpoints(this._clusterCache.get(d.ieee)).length > 0;
    const coordNote = rel.coordinatorClusters && isController
      ? `<p class="hint">Also bound to the coordinator (${rel.coordinatorClusters} cluster${rel.coordinatorClusters === 1 ? "" : "s"}), so Home Assistant sees its button presses.</p>`
      : "";
    const share = this._drawerShareOpen
      ? `<div class="drawer-share">
          <p>Sharing a capability scan tells the next person with this model which commands it really supports. Nothing is sent
            automatically: you review it and submit it as a GitHub issue.</p>
          <ol>
            ${battery ? `<li><strong>Wake it:</strong> ${escapeHtml(this._deviceLabel(d))} runs on battery, so press a button on it just before you start, and again if an endpoint times out.</li>` : ""}
            <li><strong>Check:</strong> click Start. The Endpoints and clusters view opens and asks each endpoint which commands it supports, one after another. This can take a minute or two.</li>
            <li><strong>Share:</strong> when the checks are done, click <em>Share scan to community database</em> at the bottom of that view. It opens a prefilled GitHub issue (model, firmware and clusters only: no names or addresses).</li>
          </ol>
          <div class="dialog-actions"><button class="btn btn-primary btn-small" id="drawer-share-start">Start</button><button class="btn btn-small" id="drawer-share-cancel">Cancel</button></div>
        </div>`
      : "";
    body.innerHTML = `
      <div class="drawer-head">
        ${photo}
        <div>
          ${tags.length ? `<div class="drawer-tags">${tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
          <table class="detail-table drawer-facts">${facts
            .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${k === "Bindings read" || k === "Community database" ? v : escapeHtml(String(v))}</td></tr>`)
            .join("")}</table>
        </div>
      </div>
      ${problems}
      <div class="drawer-section">
        <div class="drawer-section-title">Controls</div>
        ${this._drawerRelListHtml(rel.controls, "Nothing: it isn't bound to another device or group.")}
        ${coordNote}
        ${
          rel.reportsTo.length
            ? `<p class="hint">Reports its own state to ${rel.reportsTo
                .map((r) => `${escapeHtml(r.name)} (${escapeHtml([...r.clusters].map(clusterName).join(", "))})`)
                .join(", ")}. That's not control, so it isn't listed above.</p>`
            : ""
        }
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">Controlled by</div>
        ${this._drawerRelListHtml(rel.controlledBy, "Nothing is bound to it.")}
        ${rel.memberOf.length ? `<p class="hint">Member of ${rel.memberOf.map((g) => escapeHtml(g.name)).join(", ")}.</p>` : ""}
      </div>
      ${this._drawerMeshHtml(d)}
      <div class="drawer-section drawer-actions">
        <div class="drawer-section-title">Actions</div>
        ${isController ? `<button class="btn btn-primary" id="drawer-control-lights" title="Pick lights for this remote to control; the card creates a group if needed, binds it and checks it works">Control lights with this…</button>` : ""}
        <button class="btn" id="drawer-show-bindings" title="Bindings tab, filtered to this device (what it controls and what controls it)">Show its bindings</button>
        <button class="btn" id="drawer-rescan" title="Read this device's binding table again">Rescan bindings</button>
        <button class="btn" id="drawer-share" title="Check which commands each endpoint supports and share it with the community database">Check and share capabilities…</button>
        ${share}
        ${
          this._experimental && rel.controls.length
            ? `<button class="btn" id="drawer-route" title="Experimental: the likely path each of its bindings takes through the mesh, and the weakest link">Check route…</button>${this._drawerRouteHtml(d, rel)}`
            : ""
        }
        <button class="btn" id="drawer-endpoints" title="Per-endpoint layout: clusters, bindings and supported commands">Show endpoints…</button>
        ${haUrl ? `<a class="btn" href="${escapeHtml(haUrl)}" target="_blank" rel="noopener" title="Opens this device's page in Home Assistant, in a new tab">Open in Home Assistant</a>` : ""}
      </div>`;
    const on = (sel, fn) => {
      const el = this._q(sel);
      if (el) el.addEventListener("click", fn);
    };
    this._qa("#drawer-body .drawer-dev-link").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        this._openDeviceDrawer(this._devices.find((x) => x.ieee === a.dataset.ieee));
      })
    );
    on("#drawer-control-lights", () => this._openGroupFlow(d));
    const showBindings = (e) => {
      if (e) e.preventDefault();
      this._setTableDeviceFilter(d.ieee);
      this._switchView("table");
      this._closeDrawer();
    };
    on("#drawer-show-bindings", showBindings);
    on("#drawer-problems-link", showBindings);
    on("#drawer-rescan", async () => {
      const btn = this._q("#drawer-rescan");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Rescanning…";
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
    this._qa("#drawer-body [data-route-map]").forEach((b) =>
      b.addEventListener("click", () => {
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
    return this._devices
      .filter((d) => d.device_type === "Router" || d.device_type === "Coordinator")
      .sort((a, b) => (a.device_type === "Coordinator" ? -1 : b.device_type === "Coordinator" ? 1 : this._deviceLabel(a).localeCompare(this._deviceLabel(b))));
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
      this._meshSnapshot = (res && res.devices) || {};
      this._meshVersion = (this._meshVersion || 0) + 1;
    } catch (err) {
      this._meshError = (err && err.message) || String(err);
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
        this._meshSnapshot[normIeee(d.ieee)] = { at: new Date().toISOString(), ok: false, error: (err && err.message) || String(err), routes: [], neighbours: [] };
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
      <span>Reading ${escapeHtml(s.current || "")} (${s.done} of ${s.total})…</span>`;
  }

  _meshAgeText() {
    const times = Object.values(this._meshSnapshot || {})
      .map((e) => (e && typeof e.at === "string" ? Date.parse(e.at) : NaN))
      .filter((t) => !Number.isNaN(t));
    if (!times.length) return null;
    return relTime(new Date(Math.min(...times)).toISOString());
  }

  _lqiColor(level) {
    return { good: "var(--success-color, #43a047)", fair: "var(--warning-color, #ffa000)", weak: "var(--error-color, #db4437)" }[level] || "var(--disabled-text-color, #999)";
  }

  _lqiChip(lqi) {
    const level = rateLqi(lqi, this._lqiThr);
    const label = typeof lqi === "number" ? `${level} · ${lqi}` : "unknown";
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
    return `${nameOf(l.a)} ↔ ${nameOf(l.b)}: ${level} ${l.lqi}${parts.length ? ` (${parts.join(", ")})` : ""}`;
  }

  _meshLegendHtml() {
    const thr = this._lqiThr;
    const sample = (level, w, dash) =>
      `<svg width="34" height="10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" stroke="${this._lqiColor(level)}" stroke-width="${w}" ${dash ? 'stroke-dasharray="5 3"' : ""}/></svg>`;
    return `<div class="mesh-legend">
      <span>${sample("good", 4)} good, LQI ${thr.good} or more</span>
      <span>${sample("fair", 2.5)} fair, ${thr.weak} to ${thr.good - 1}</span>
      <span>${sample("weak", 1.5, true)} weak, below ${thr.weak}: messages may be lost</span>
    </div>`;
  }

  _renderMesh() {
    const el = this._q("#view-mesh");
    if (!el) return;
    if (!this._experimental) {
      el.innerHTML = `<p class="muted">Turn on <strong>Experimental features</strong> under the ZHA Bindings Manager integration's Configure to use this tab.</p>`;
      return;
    }
    if (!this._meshSnapshot) {
      el.innerHTML = `<p class="muted">Loading the last network scan…</p>`;
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
            <select id="mesh-layout">${this._meshLayout()
              .options.map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === this._meshLayout().value ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
              .join("")}</select></label>
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
      el.innerHTML = intro + `<p class="muted">Click <strong>Scan network</strong> to read the tables. Nothing on your network is changed.</p>`;
      this._wireMesh();
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
      <div class="mesh-layout">
        <div class="mesh-picture">${this._meshSvg(mesh)}
          ${this._meshSelectedLinkHtml(mesh, nameOf)}
          ${this._meshLegendHtml()}
          <div class="mesh-legend-note"><span class="muted">Thicker = stronger. Each link uses the weaker of its two directions. ${
            this._meshLayout().floors.length && this._meshLayout().mode === "plan" ? "↑ and ↓ mark links to routers on the floor above or below; a dashed ring means the router only has usable links to other floors. " : ""
          }Shading: green = good, amber = fair (works fine), red = weak, based on each router's second-best link; no shading = no routers there. Tap a line for its details; zoom with the buttons, the mouse wheel or a pinch, and drag to move. Click a device to open it.${
              mesh.staleEntries ? ` ${mesh.staleEntries} stale neighbour entries (LQI 0, not heard recently) were ignored.` : ""
            }</span></div>
        </div>
        <div class="mesh-side">
          ${this._meshShowMode() === "routes" ? this._meshRoutesListHtml(mesh, nameOf) : ""}
          <div class="drawer-section-title">Suggestions</div>
          ${
            tips.length
              ? `<ul class="mesh-tips">${tips.map((t, i) => `<li class="mesh-tip-${t.level}" data-tip="${i}">${escapeHtml(t.text)}</li>`).join("")}</ul>`
              : `<p class="muted">Nothing stands out.</p>`
          }
          ${this._meshBetweenFloorsHtml(mesh, nameOf)}
          <div class="drawer-section-title">Weakest links</div>
          <table class="detail-table mesh-links">${weakest
            .map(
              (l) => `<tr data-link="${escapeHtml(l.a)}|${escapeHtml(l.b)}" class="${this._meshHighlight === `${l.a}|${l.b}` ? "active" : ""}"><td>${escapeHtml(nameOf(l.a))} ↔ ${escapeHtml(nameOf(l.b))}</td><td>${this._lqiChip(l.lqi)}</td></tr>`
            )
            .join("")}</table>
          ${
            failed.length
              ? `<div class="drawer-section-title">Didn't answer</div><ul class="mesh-failed">${failed
                  .map(
                    ([i, e]) =>
                      `<li><span>${escapeHtml(nameOf(i))}${e.error ? ` <span class="muted">(${escapeHtml(e.error)})</span>` : ""}</span> <button class="btn btn-small" data-mesh-read="${escapeHtml(i)}" ${this._meshReading ? "disabled" : ""}>Read again</button></li>`
                  )
                  .join("")}</ul>`
              : ""
          }
        </div>
      </div>`;
    this._wireMesh();
    this._renderMeshProgress();
  }

  _meshSvg(mesh) {
    const layout = this._meshLayout();
    const { mode } = layout;
    const size = mode === "plan" ? this._meshPlanSize(layout) : { w: 1200, h: 840 };
    if (!size) return `<p class="muted">Loading the floor plan image…</p>`;
    const W = size.w;
    const H = size.h;
    const thr = this._lqiThr;
    const routerIeees = this._meshRouters().map((d) => normIeee(d.ieee));
    const pos = (i) => this._meshPos(i, layout);
    const nameOf = (i) => {
      const d = this._devices.find((x) => normIeee(x.ieee) === i);
      return d ? this._deviceLabel(d) : i;
    };
    const floorOf = (i) => (layout.floors.length ? this._deviceFloor(i) : null);
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
      // Coverage = the router's second-best link (best alone can hide an isolated corner).
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
      // 1.5.0b5: a wide invisible line on top makes thin links easy to tap.
      lines.push(
        `<g class="mesh-link" data-link="${escapeHtml(l.a)}|${escapeHtml(l.b)}"><line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${this._lqiColor(level)}" style="--sw:${(hi ? 3 : 1) * (1 + (l.lqi / 255) * 3) * (W / 1200)}" stroke-opacity="${hi ? 1 : level === "weak" ? 0.9 : 0.55}" ${level === "weak" ? `stroke-dasharray="${6 * (W / 1200)} ${4 * (W / 1200)}"` : ""}/><line class="mesh-link-hit" x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" style="--sw:${16 * (W / 1200)}"><title>${escapeHtml(this._meshLinkTitle(l, nameOf))}</title></line></g>`
      );
    }
    const r0 = 11 * (W / 1200);
    const k = W / 1200;
    // 1.5.0b6: "Routes my bindings use" draws each binding's predicted hops
    // (deduplicated), with an arrow in the direction of travel.
    if (showMode === "routes") {
      const hops = new Map();
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
        const linkKey = h.from < h.to ? `${h.from}|${h.to}` : `${h.to}|${h.from}`;
        const title = `${nameOf(h.from)} → ${nameOf(h.to)}: ${level}${typeof h.lqi === "number" ? ` ${h.lqi}` : ""}\nUsed by: ${h.uses.join("; ")}`;
        lines.push(
          `<g class="mesh-link mesh-route" data-link="${escapeHtml(linkKey)}"><line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${this._lqiColor(level)}" style="--sw:${(2 + Math.min(3, h.uses.length)) * k}" stroke-opacity="0.9" marker-end="url(#mesh-arrow-${level})" ${level === "weak" ? `stroke-dasharray="${6 * k} ${4 * k}"` : ""}/><line class="mesh-link-hit" x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" style="--sw:${16 * k}"><title>${escapeHtml(title)}</title></line></g>`
        );
      }
    }
    // 1.5.0b6: battery devices as small dots, joined to their parent by a
    // line coloured by that link's quality; grey and unjoined if the parent
    // isn't known.
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
              `${nameOf(i)} → parent ${nameOf(parent.parent)}: ${level}${typeof parent.lqi === "number" ? ` ${parent.lqi}` : ""}`
            )}</title></line></g>`
          );
        }
        const tip = parent
          ? `${nameOf(i)} (battery): parent ${nameOf(parent.parent)}, ${level}${typeof parent.lqi === "number" ? ` ${parent.lqi}` : ""}`
          : `${nameOf(i)} (battery): parent unknown. No router listed it as a child in the last scan; it may have been asleep or moved.`;
        batteryNodes.push(`<g class="mesh-node mesh-battery ${parent ? "" : "orphan"}" data-ieee="${escapeHtml(i)}" transform="translate(${p.x},${p.y})"><g class="mesh-zs">
          <circle r="${r0 * 0.5}" style="stroke:${this._lqiColor(level)}"/><title>${escapeHtml(tip)}</title>
          <text class="mesh-label mesh-battery-label" y="${r0 * 0.5 + 10 * k}" font-size="${9 * k}" text-anchor="middle">${escapeHtml(nameOf(i))}</text>
        </g></g>`);
      }
    }
    // 1.5.0b3: a label that would collide with an earlier one goes above its node.
    const placedLabels = [];
    const labelY = (p) => {
      const below = p.y + r0 + 13 * k;
      const clash = (y) => placedLabels.some((q) => Math.abs(q.x - p.x) < 110 * k && Math.abs(q.y - y) < 13 * k);
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
      // Links to routers on other floors (1.5.0 local b4).
      let up = [];
      let down = [];
      let sameFloorOk = 0;
      if (mode === "plan" && layout.floor) {
        for (const l of mesh.links.values()) {
          if ((l.a !== i && l.b !== i) || typeof l.lqi !== "number") continue;
          const other = l.a === i ? l.b : l.a;
          if (!isRouterLike(mesh, other)) continue;
          const of = floorOf(other);
          if (of && of !== layout.floor) {
            (levelOf(of) > levelOf(layout.floor) ? up : down).push(`${levelOf(of) > levelOf(layout.floor) ? "↑" : "↓"} ${nameOf(other)} (${this._floorName(of)}): ${rateLqi(l.lqi, thr)} ${l.lqi}`);
          } else if (rateLqi(l.lqi, thr) !== "weak") sameFloorOk++;
        }
      }
      const viaCeiling = mode === "plan" && layout.floor && !sameFloorOk && up.length + down.length > 0;
      const floorBadge =
        up.length || down.length
          ? `<text class="mesh-floor-badge" x="${-r0 * 1.15}" y="${-r0 * 0.6}" text-anchor="end" font-size="${15 * (W / 1200)}">${up.length ? `↑${up.length}` : ""}${down.length ? `↓${down.length}` : ""}<title>${escapeHtml(
              [...up, ...down].join("\n")
            )}</title></text>`
          : "";
      nodes.push(`<g class="mesh-node" data-ieee="${escapeHtml(i)}" transform="translate(${p.x},${p.y})"><g class="mesh-zs">
        ${viaCeiling ? `<circle r="${r0 * 1.6}" class="via-ceiling"><title>${escapeHtml(`${nameOf(i)}: no usable link on this floor, only to other floors`)}</title></circle>` : ""}
        ${isCoord ? `<rect x="${-r0}" y="${-r0}" width="${2 * r0}" height="${2 * r0}" rx="${r0 / 3}"/>` : `<circle r="${r0}" class="${unread ? "unread" : ""}"/>`}
        ${floorBadge}
        ${kids && this._meshShowBattery === false ? `<text class="mesh-kids" x="${r0 * 1.1}" y="${-r0 * 0.9}" font-size="${10 * (W / 1200)}">+${kids}</text>` : ""}
        ${
          unread
            ? `<title>${escapeHtml(
                this._meshSnapshot[i] ? `${nameOf(i)}: didn't answer${this._meshSnapshot[i].error ? ` (${this._meshSnapshot[i].error})` : ""}. Open it to read it again.` : `${nameOf(i)}: not read yet. Open it to read it.`
              )}</title>`
            : ""
        }
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
    // 1.5.0b5: zoom/pan state per layout, kept across re-renders.
    this._meshViews = this._meshViews || {};
    const vk = `${layout.value}|${W}x${H}`;
    if (!this._meshViews[vk]) this._meshViews[vk] = { x: 0, y: 0, w: W, h: H, full: { w: W, h: H } };
    this._meshViewKey = vk;
    const vb = this._meshViews[vk];
    return `<div class="mesh-zoom"><button class="btn btn-small" id="mesh-zoom-out" title="Zoom out">－</button><button class="btn btn-small" id="mesh-zoom-fit" title="Show the whole plan">Fit</button><button class="btn btn-small" id="mesh-zoom-in" title="Zoom in">＋</button></div>
      <svg class="mesh-svg" style="--mz:${vb.w / vb.full.w}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet"><defs>${grad("good")}${grad("fair")}${grad("weak")}${["good", "fair", "weak", "unknown"]
        .map((lvl) => `<marker id="mesh-arrow-${lvl}" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="${this._lqiColor(lvl)}"/></marker>`)
        .join("")}</defs>${img}<g>${heat.join("")}</g><g>${lines.join("")}</g><g>${batteryNodes.join("")}</g><g>${nodes.join("")}</g></svg>
      ${
        missing
          ? `<details class="mesh-unplaced muted"><summary>${missing} router${missing === 1 ? "" : "s"} not on this layout</summary>${escapeHtml(missingNames.join(", "))}. ${
              mode === "plan" ? `Place them on the Floor Plan tab${layout.floor ? ` (${escapeHtml(this._floorName(layout.floor))})` : ""} to include them.` : "Open the Map tab once to lay them out."
            } They're still part of the suggestions and route checks.</details>`
          : ""
      }`;
  }

  _meshShowMode() {
    return ["strongest", "all", "routes"].includes(this._meshShow) ? this._meshShow : "strongest";
  }

  _meshShowHint() {
    const base = "A link means two routers can hear each other. A route is the way a command actually travels; routes use only some of the links.";
    const mode = {
      strongest: " Showing each router's 3 strongest links.",
      all: " Showing every pair of routers that can hear each other, however weakly.",
      routes: " Showing the predicted route of each binding, with arrows in the direction a command travels. Group bindings are broadcast, so only the remote's hop to its parent is drawn.",
    }[this._meshShowMode()];
    return base + mode;
  }

  /** Every control binding's predicted route (device targets) or parent hop
   *  (group bindings). Reporting and coordinator bindings are left out. */
  _meshBindingRoutes(mesh) {
    const coord = normIeee(this._coordinatorIeee() || "");
    const seen = new Set();
    const out = [];
    for (const b of this._rawBindings()) {
      if (["reporting", "manufacturer"].includes(this._classifyBinding(b))) continue;
      const src = normIeee(b.sourceIeee);
      if (b.isGroup) {
        const key = `${src}|g${b.groupId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const p = mesh.parentOf.get(src);
        const hops = p ? [{ from: src, to: p.parent, lqi: p.lqi }] : [];
        out.push({ label: `${this._ieeeLabel(src, { plain: true })} → group ${this._groupName(b.groupId)}`, source: src, group: b.groupId, path: { status: p || mesh.snapshot[src] ? "ok" : "none", hops, note: null } });
        continue;
      }
      const tgt = normIeee(b.targetIeee);
      if (!tgt || tgt === coord || tgt === src) continue;
      const key = `${src}|${tgt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: `${this._ieeeLabel(src, { plain: true })} → ${this._ieeeLabel(tgt, { plain: true })}`, source: src, target: tgt, path: routePath(mesh, src, tgt) });
    }
    return out;
  }

  _meshRoutesListHtml(mesh, nameOf) {
    const thr = this._lqiThr;
    const routes = this._meshBindingRoutes(mesh).map((r) => ({ ...r, verdict: pathVerdict(r.path, thr) }));
    if (!routes.length) return `<div class="drawer-section-title">Binding routes</div><p class="muted">No bindings between devices to route.</p>`;
    const rank = { weak: 0, none: 1, unknown: 2, good: 3 };
    routes.sort((a, b) => rank[a.verdict.level] - rank[b.verdict.level] || a.label.localeCompare(b.label));
    const text = (r) =>
      r.verdict.level === "weak"
        ? `weak hop ${nameOf(r.verdict.weakest.from)} → ${nameOf(r.verdict.weakest.to)} (${r.verdict.weakest.lqi})`
        : r.verdict.level === "none"
        ? "no route found"
        : r.verdict.level === "unknown"
        ? "partly known"
        : "looks good";
    return `<div class="drawer-section-title">Binding routes</div>
      <ul class="mesh-routes">${routes
        .map((r) => `<li class="route-${r.verdict.level}"><strong>${escapeHtml(r.label)}</strong>: ${escapeHtml(text(r))}</li>`)
        .join("")}</ul>`;
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
      this._setStatus("error", `Couldn't read ${this._ieeeLabel(id, { plain: true })}: ${(err && err.message) || err}`);
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
    // 1.5.2: say so when this device shares its network address.
    const id = normIeee(d.ieee);
    const mesh = this._meshModel();
    const c = mesh && (mesh.conflicts || []).find((x) => x.ieees.includes(id));
    if (!c) return html;
    const hex = `0x${c.nwk.toString(16).padStart(4, "0")}`;
    const others = c.ieees.filter((i) => i !== id).map((i) => this._ieeeLabel(i, { plain: true }));
    const text =
      c.coordinator && d.device_type !== "Coordinator"
        ? `This device is using the coordinator's network address (${hex}). That can flood or confuse the whole network. Unplug it, check whether the network recovers, then reset and pair it again.`
        : c.coordinator
        ? `Another device (${others.join(", ")}) is using this coordinator's network address (${hex}).`
        : `Shares its network address (${hex}) with ${others.join(", ")}.`;
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
      const state = !e
        ? "Its routing and neighbour tables haven't been read yet."
        : e.ok
        ? `Tables read ${relTime(e.at)}: ${(e.neighbours || []).length} neighbours, ${(e.routes || []).length} routes.`
        : `It didn't answer when last read${e.error ? ` (${e.error})` : ""}.`;
      return `<div class="drawer-section"><div class="drawer-section-title">Network</div>
        <p class="hint">${escapeHtml(state)}</p>
        <button class="btn btn-small" id="drawer-mesh-read" ${busy || this._meshScanning ? "disabled" : ""}>${busy ? "Reading…" : "Read this router"}</button></div>`;
    }
    const p = mesh && mesh.parentOf.get(id);
    const state = p
      ? `Battery device: it talks through its parent ${this._ieeeLabel(p.parent, { plain: true })} (${rateLqi(p.lqi, this._lqiThr)}${typeof p.lqi === "number" ? ` ${p.lqi}` : ""}).`
      : "Battery device: its parent isn't known. No router listed it as a child in the last scan.";
    return `<div class="drawer-section"><div class="drawer-section-title">Network</div>
      <p class="hint">${escapeHtml(state)} A battery device keeps no tables of its own: what we know comes from its parent's table. Press a button on it to wake it, then read its parent again.</p>
      ${p ? `<button class="btn btn-small" id="drawer-mesh-read-parent" data-parent="${escapeHtml(p.parent)}" ${this._meshReading || this._meshScanning ? "disabled" : ""}>${this._meshReading === p.parent ? "Reading…" : "Read its parent again"}</button>` : `<button class="btn btn-small" id="drawer-mesh-scan">Scan network</button>`}
    </div>`;
  }

  _meshSelectedLinkHtml(mesh, nameOf) {
    if (!this._meshHighlight) return "";
    const l = mesh.links.get(this._meshHighlight);
    if (!l) return "";
    const ha = l.heard[l.a];
    const hb = l.heard[l.b];
    const line = (x, y, v) => (typeof v === "number" ? `<li>${escapeHtml(nameOf(x))} hears ${escapeHtml(nameOf(y))} at ${this._lqiChip(v)}</li>` : `<li class="muted">${escapeHtml(nameOf(x))} didn't report ${escapeHtml(nameOf(y))}</li>`);
    const endA = !isRouterLike(mesh, l.a);
    const endB = !isRouterLike(mesh, l.b);
    if (endA !== endB) {
      const dev = endA ? l.a : l.b;
      const router = endA ? l.b : l.a;
      const v = l.heard[router];
      return `<div class="mesh-selected">
      <div class="drawer-section-title">Selected link</div>
      <div>${escapeHtml(nameOf(dev))} → parent ${escapeHtml(nameOf(router))} ${this._lqiChip(typeof v === "number" ? v : l.lqi)}</div>
      <p class="muted">${escapeHtml(nameOf(dev))} runs on battery and talks only through its parent router. ${escapeHtml(nameOf(router))} hears it at ${
        typeof v === "number" ? v : "an unreported level"
      }. A battery device keeps no tables of its own, so only this direction is known.</p>
      <button class="btn btn-small" id="mesh-link-clear">Clear</button>
    </div>`;
    }
    return `<div class="mesh-selected">
      <div class="drawer-section-title">Selected link</div>
      <div>${escapeHtml(nameOf(l.a))} ↔ ${escapeHtml(nameOf(l.b))} ${this._lqiChip(l.lqi)}</div>
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
      // 1.5.0b8: devices, labels and line widths keep their on-screen size
      // when zooming; only the distances between them grow.
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
    const h = (w / vb.w) * vb.h;
    vb.x = px - ((px - vb.x) * w) / vb.w;
    vb.y = py - ((py - vb.y) * h) / vb.h;
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
    // Drag to pan, pinch to zoom; a short tap still reaches nodes and links.
    const pointers = new Map();
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
          /* optional */
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
        setTimeout(() => (this._meshDragged = false), 0);
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
      <table class="detail-table mesh-links">${rows
        .slice(0, 12)
        .map(
          (r) => `<tr data-link="${escapeHtml(r.l.a)}|${escapeHtml(r.l.b)}" title="${escapeHtml(this._meshLinkTitle(r.l, nameOf))}"><td>${escapeHtml(nameOf(r.l.a))} <span class="muted">(${escapeHtml(this._floorName(r.fa))})</span> ↔ ${escapeHtml(nameOf(r.l.b))} <span class="muted">(${escapeHtml(this._floorName(r.fb))})</span></td><td>${this._lqiChip(r.l.lqi)}</td></tr>`
        )
        .join("")}</table>`;
  }

  _meshFloorsHelpHtml() {
    if (this._haFloors().length) return "";
    return `<details class="mesh-floors-help"><summary>House on more than one floor?</summary>
      One plan can't show a link that goes through a ceiling, so it's drawn as a long line across the plan. Give each floor its own plan:
      <ol>
        <li>In Home Assistant, <strong>Settings → Areas, labels &amp; zones → Floors</strong>: add a floor for each level, with its level number (0 = ground, 1 = first, …).</li>
        <li>In the same place, under <strong>Areas</strong>, open each area and choose its floor. Devices take their floor from their area.</li>
        <li>Reload this page. On the <strong>Floor Plan</strong> tab, pick each floor, set its image and place its devices. Your current plan becomes the lowest floor's.</li>
        <li>Back here, the <strong>Layout</strong> list has one entry per floor. Links to the floor above or below are marked ↑ and ↓, and a <strong>Between floors</strong> list shows how well the floors are connected.</li>
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
    this._qa("#view-mesh .mesh-node").forEach((g) =>
      g.addEventListener("click", () => {
        if (this._meshDragged) return;
        this._openDeviceDrawer(this._devices.find((x) => normIeee(x.ieee) === g.dataset.ieee));
      })
    );
    this._qa("#view-mesh .mesh-link").forEach((g) =>
      g.addEventListener("click", () => {
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
    this._qa("#view-mesh tr[data-link]").forEach((tr) =>
      tr.addEventListener("click", () => {
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
      return `<div class="drawer-share"><p class="muted">Loading the last network scan…</p></div>`;
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
    const chain = (path) =>
      path.hops.length
        ? `${escapeHtml(nameOf(path.hops[0].from))}${path.hops.map((h) => ` <span class="route-arrow">→</span> ${this._lqiChip(h.lqi)} ${escapeHtml(nameOf(h.to))}`).join("")}`
        : "";
    const items = rel.controls.map((c) => {
      if (c.kind === "group") {
        const g = this._groups.find((x) => Number(x.group_id) === Number(c.groupId));
        const members = ((g && g.members) || []).map((m) => m.device && m.device.ieee).filter(Boolean).filter((i) => normIeee(i) !== normIeee(this._coordinatorIeee() || ""));
        const gc = groupCheck(mesh, d.ieee, members);
        const parent = gc.sourceIsRouter
          ? `${escapeHtml(nameOf(d.ieee))} is a router and sends the group command itself.`
          : gc.parent
          ? `Sends through its parent ${escapeHtml(nameOf(gc.parent.parent))} ${this._lqiChip(gc.parent.lqi)}`
          : `Its parent router isn't known yet (scan again with it awake).`;
        const weakMembers = gc.members.filter((m) => !m.best || rateLqi(m.best.lqi, thr) === "weak");
        return `<li><strong>👥 ${escapeHtml(c.name)}</strong> <span class="muted">group: sent as a broadcast, so there's no single route</span>
          <div>${parent}</div>
          <ul class="route-members">${gc.members
            .map((m) => `<li>${escapeHtml(nameOf(m.ieee))}: best router link ${m.best ? `${this._lqiChip(m.best.lqi)} via ${escapeHtml(nameOf(m.best.other))}` : `<span class="muted">not seen in any table</span>`}</li>`)
            .join("")}</ul>
          ${weakMembers.length ? `<div class="route-verdict route-weak">${weakMembers.length} light${weakMembers.length === 1 ? " hears" : "s hear"} the mesh poorly and may miss commands.</div>` : `<div class="route-verdict route-good">Every light hears the mesh well enough.</div>`}</li>`;
      }
      const path = routePath(mesh, d.ieee, c.ieee);
      const v = pathVerdict(path, thr);
      const verdict =
        v.level === "good"
          ? `<div class="route-verdict route-good">Likely path looks good.</div>`
          : v.level === "weak"
          ? `<div class="route-verdict route-weak">Weak link: ${escapeHtml(nameOf(v.weakest.from))} to ${escapeHtml(nameOf(v.weakest.to))} (LQI ${v.weakest.lqi}). A router between them, or moving one of them, would help.</div>`
          : v.level === "none"
          ? `<div class="route-verdict route-none">No route found. ${escapeHtml(path.note || "")}</div>`
          : `<div class="route-verdict route-unknown">Partly known. ${escapeHtml(path.note || "Some link qualities weren't reported.")}</div>`;
      return `<li><strong>${escapeHtml(c.name)}</strong><div class="route-chain">${chain(path)}</div>${verdict}${
        path.hops.length ? `<button class="btn btn-small" data-route-map="${escapeHtml(c.ieee)}" title="Opens the Map with this route drawn on it">Show on the Map</button>` : ""
      }</li>`;
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
    )}…</p>`;
    this._q("#dialog").classList.add("open");
    try {
      await this._rescanDeviceFull(d.ieee, { tries: this._retryCount });
    } catch (err) {
      console.warn("[ZHA Bindings Manager] exploded view scan failed", err);
    }
    if (!this._q("#dialog").classList.contains("open")) return; // closed while scanning
    const fresh = this._devices.find((x) => x.ieee === d.ieee) || d;
    this._renderExplodedView(fresh);
    if (checkAll) this._checkAllEndpoints(fresh);
  }

  _renderExplodedView(d) {
    this._explodedDeviceIeee = d.ieee;
    const summary = this._deviceSummaryLines(d)
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`)
      .join("");
    const endpoints = this._deviceEndpoints(d);
    const cards = endpoints.length
      ? endpoints.map((ep) => this._endpointCardHtml(d, ep)).join("")
      : `<p class="muted">No endpoint data came back for this device — the scan may have failed (sleepy or unreachable device). Try again from the Devices tab.</p>`;

    this._ensureZ2mModels();
    const imgUrl = this._deviceImageUrl(d);
    const shape = this._deviceShapeSvg(endpoints.length);
    const visual =
      this._showDevicePhotos && imgUrl
        ? `<img src="${escapeHtml(imgUrl)}" alt="" class="ep-device-photo"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="ep-device-shape" style="display:none">${shape}</div>`
        : `<div class="ep-device-shape">${shape}</div>`;

    const roleNote = this._isMultiRoleDevice(d)
      ? `<p class="hint ep-role-note">🕹 This device also has its own Light/Switch/Cover/Fan role, on top of
           the control relationship(s) below — e.g. a wired/local load alongside a Zigbee-bound one. Look
           through the endpoint cards below to see which one is which.</p>`
      : "";

    this._q("#dialog-title").textContent = `Endpoints and clusters: ${this._deviceLabel(d)}`;
    const epCount = this._deviceEndpointsIncludingGP(d).length;
    const checkAllBtn = epCount
      ? `<div class="ep-check-all">${
          this._checkingAll && normIeee(this._checkingAll) === normIeee(d.ieee)
            ? `<span class="muted">Checking each endpoint's supported commands in turn…</span>`
            : `<button class="btn btn-small" id="ep-check-all" title="Runs Check supported commands on every endpoint, one after another">Check all endpoints</button>
               <span class="muted">then share the result with the community database below.</span>`
        }</div>`
      : "";
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
        ${
          deviceHaUrl(d)
            ? `<a class="btn" id="explode-open-ha" href="${escapeHtml(
                deviceHaUrl(d)
              )}" target="_blank" rel="noopener" title="Opens this device's page in Home Assistant, in a new tab">Open in Home Assistant</a>`
            : ""
        }
        ${
          controllerEndpoints(this._clusterCache.get(d.ieee)).length
            ? `<button class="btn btn-primary" id="explode-control-lights" title="Pick lights for this remote or switch to control; the card creates a group if needed, binds it and checks it works">Control lights with this…</button>`
            : ""
        }
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
        btn.textContent = ok ? "Copied!" : "Couldn't copy — select the text above";
        setTimeout(() => {
          btn.textContent = original;
        }, 2500);
      });
    });
    // The "too large for a pre-filled issue" path folds copy + open into
    // one click (see _shareDraftHtml) — the anchor's real href/target still
    // does the actual navigation natively (so it's never blocked as a
    // popup), this just also fires the copy alongside it, fire-and-forget,
    // since the anchor click keeps this page's script running regardless.
    this._qa(".ep-cmd-share-open").forEach((a) => {
      a.addEventListener("click", async () => {
        if (!this._shareDraft || !this._shareDraft.tooLong) return;
        const original = a.textContent;
        const ok = await this._copyShareText(this._shareDraft.body);
        a.textContent = ok ? "Copied — opening issue…" : "Couldn't copy — opening issue…";
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
      const rows = Object.entries(known).map(([id, name]) => ({
        id: Number(id),
        name,
        present: foundIds.has(Number(id)),
      }));
      return { known: true, confirmed: true, rows };
    }

    const rows = Object.entries(found).map(([id, info]) => ({
      id: Number(id),
      name: (info && info.command_name) || `0x${Number(id).toString(16).padStart(2, "0")}`,
      present: true,
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
    const token = (this._commandCheckSeq = (this._commandCheckSeq || 0) + 1);
    const startedAt = Date.now();
    this._commandScans.set(key, { status: "loading", token, startedAt });
    if (this._q("#dialog").classList.contains("open")) this._renderExplodedView(d);
    this._startCommandCheckTicker();
    // Stop waiting after COMMAND_CHECK_LIMIT_MS. The service call keeps
    // running in HA; a late answer is still applied (shouldApplyResult).
    setTimeout(() => {
      const cur = this._commandScans.get(key);
      if (cur && cur.token === token && cur.status === "loading") {
        this._commandScans.set(key, { ...cur, status: "timeout" });
        this._rerenderExplodedFor(d);
      }
    }, COMMAND_CHECK_LIMIT_MS);
    // Kick off the community index load in the background too (if it
    // hasn't already been fetched via the Capability Explorer tab), so
    // Compare My Device below has something to compare against as soon as
    // this scan completes rather than showing "Checking…" and needing a
    // second wait.
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
    if (!this._q("#dialog").classList.contains("open")) return; // closed while scanning
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
    }, 1000);
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
      // Tuya's TS0601 and other "MCU" devices tunnel almost everything
      // through their own private cluster (0xEF00) instead of standard ZCL
      // clusters/commands — MattWestb flagged that these devices "can't be
      // scanned" (zigbee-capabilities#57), and the generic message below
      // used to look identical for that case and for an ordinary endpoint
      // this card just has no command table for, with no way to tell them
      // apart. A specific note here doesn't make the device scannable —
      // nothing can, short of Tuya-specific handling this card doesn't
      // have — but it does explain *why*, instead of looking like a bug.
      const hasTuyaCluster = declaredIds.has(0xef00);
      if (hasTuyaCluster) {
        return `<p class="hint ep-cmd-status">This endpoint uses Tuya's private cluster (0xEF00) to tunnel its real functionality instead of standard Zigbee commands — generic command discovery can't see into it, so there's nothing for this card to check.</p>`;
      }
      // A controller (button, remote, switch) sends commands like On/Off
      // or Level Control out to whatever it's bound to, rather than
      // receiving them — "Check supported commands" asks "what do you
      // accept," which is the right question for a light or plug, but not
      // for the sending side of that relationship. Checked structurally
      // (declared output clusters this card has a command table for),
      // independent of whether a binding currently exists, so this still
      // explains an unbound remote correctly. Real gap MattWestb raised —
      // "no real controllers is not possible scanning" — zigbee-capabilities#57.
      const outClusterIds = [
        ...new Set(clusters.filter((c) => c.type === "out" && c.endpoint_id === ep).map((c) => Number(c.id))),
      ].filter((id) => CLUSTER_COMMANDS[id]);
      if (outClusterIds.length) {
        const outNames = outClusterIds.map((id) => clusterName(id)).join(", ");
        return `<p class="hint ep-cmd-status">This endpoint is a controller, not a receiver: it's built to send ${escapeHtml(
          outNames
        )} commands out to whatever it's bound to, rather than accept them itself — there's nothing for a command-support scan to discover here. To see what it actually controls, look at the relationship badges above; to check what a light or plug will respond to, run this same check on its own endpoint instead.</p>`;
      }
      return `<p class="hint ep-cmd-status">This endpoint doesn't declare any clusters this card has command data for.</p>`;
    }

    const key = this._commandScanKey(d.ieee, ep);
    const entry = this._commandScans.get(key);
    const isBattery = this._isBatteryDevice(d);
    const wakeHint = isBattery
      ? `<div class="scan-wake-hint">May be asleep — press a button on it first if this doesn't complete.</div>`
      : "";

    let actionHtml;
    if (!entry) {
      actionHtml = `
        ${wakeHint}
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">Check supported commands</button>`;
    } else if (entry.status === "loading") {
      actionHtml = `
        <p class="hint ep-cmd-status">Checking supported commands&hellip; <span class="ep-cmd-elapsed" data-started="${
          entry.startedAt || Date.now()
        }">${formatElapsed(Date.now() - (entry.startedAt || Date.now()))}</span> elapsed. This asks the device directly, one cluster at a time; most answer within a minute. The card stops waiting after ${formatElapsed(
          COMMAND_CHECK_LIMIT_MS
        )}.</p>
        ${wakeHint}
        <button class="btn btn-small ep-cmd-stop" data-ep="${ep}">Stop waiting</button>`;
    } else if (entry.status === "timeout" || entry.status === "stopped") {
      const why =
        entry.status === "timeout"
          ? `No answer after ${formatElapsed(COMMAND_CHECK_LIMIT_MS)}, so the card stopped waiting.`
          : "Stopped waiting.";
      const tryHint = isBattery
        ? `<div class="scan-wake-hint">May be asleep: press a button on it, then try again.</div>`
        : `<div class="scan-wake-hint">Check it's powered on and in range, then try again.</div>`;
      actionHtml = `
        <p class="hint ep-cmd-status">${why} The request may still be running in Home Assistant; if the device answers, the results will appear here.</p>
        ${tryHint}
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">${isBattery ? "Wake & try again" : "Try again"}</button>`;
    } else if (entry.status === "error") {
      const errorWakeHint = isBattery
        ? `<div class="scan-wake-hint">May be asleep — press a button on it, then try again.</div>`
        : `<div class="scan-wake-hint">Not responding — check it's powered on and in range, then try again.</div>`;
      actionHtml = `
        <p class="hint ep-cmd-status">Couldn't check supported commands: ${escapeHtml(entry.error)}</p>
        ${errorWakeHint}
        <button class="btn btn-small ep-cmd-check" data-ep="${ep}">${isBattery ? "Wake & try again" : "Try again"}</button>`;
    } else {
      actionHtml = `<button class="btn btn-small ep-cmd-check" data-ep="${ep}">Re-check</button>`;
    }

    const scanned = !!(entry && entry.status === "done");
    const epScan = scanned ? ((entry.scan && entry.scan.endpoints) || []).find((e) => Number(e.id) === Number(ep)) : null;
    const inClusters = (epScan && epScan.in_clusters) || {};

    // Tracks how many of this endpoint's relevant clusters actually
    // confirmed at least one command, so a completed scan that confirmed
    // nothing anywhere can get one clear explanation instead of the same
    // vague "no response" line repeated once per cluster — see the
    // discoveryNote block below (real report: zigbee-capabilities forum,
    // RedKing's Hue LWE002 — zha_toolkit's own HA log showed
    // Status.UNSUP_GENERAL_COMMAND for every cluster, meaning the device
    // actively declined the discovery request rather than staying silent).
    let confirmedClusterCount = 0;

    const rows = relevantIds
      .map((clusterId) => {
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
            bodyHtml = `<p class="hint">The scan didn't return data for this cluster — the device may not have responded for it specifically.</p>`;
          } else {
            const cls = this._classifyClusterCommands(clusterId, c.commands_received);
            if (!cls.confirmed) {
              summary = "No commands confirmed";
              bodyHtml = `<p class="hint">No commands reported for this cluster during discovery.</p>`;
            } else {
              confirmedClusterCount++;
              const presentCount = cls.rows.filter((r) => r.present).length;
              summary = `${presentCount} of ${cls.rows.length} confirmed`;
              bodyHtml = cls.rows
                .map(
                  (r) => `
                  <div class="ep-cmd-row ${r.present ? "ep-cmd-yes" : "ep-cmd-no"}">
                    <span class="ep-cmd-icon">${r.present ? "✓" : "✕"}</span>
                    <span class="ep-cmd-name">${escapeHtml(r.name)}</span>
                    <span class="ep-cmd-hex">0x${r.id.toString(16).padStart(2, "0")}</span>
                  </div>`
                )
                .join("");
            }
          }
        }

        return `
          <div class="ep-cmd-cluster">
            <button type="button" class="ep-cmd-cluster-head ep-cmd-toggle" data-row-key="${escapeHtml(rowKey)}">
              <span class="ep-cmd-chevron">${expanded ? "▾" : "▸"}</span>
              <span class="ep-cmd-cluster-title">${title}</span>
              <span class="ep-cmd-summary">${escapeHtml(summary)}</span>
            </button>
            ${expanded ? `<div class="ep-cmd-cluster-body">${bodyHtml}</div>` : ""}
          </div>`;
      })
      .join("");

    // A completed scan that confirmed literally nothing across every
    // relevant cluster is almost always the device's firmware declining
    // to implement Zigbee's optional command-discovery request at all
    // (confirmed via a real zha_toolkit log: Status.UNSUP_GENERAL_COMMAND
    // — the device actively replies "not supported," it isn't staying
    // silent) — not a sleepy device or a network problem "Re-check" would
    // fix. The card still can't see that exact status code (zha_toolkit
    // only logs it on the HA side, not in the data it hands back), so
    // this stops short of stating it as fact, but it's an honest,
    // specific steer instead of six identical "no response" rows that
    // read like six separate failures.
    const discoveryNote =
      scanned && relevantIds.length > 0 && confirmedClusterCount === 0
        ? `<p class="hint ep-cmd-discovery-note">This scan didn't confirm any commands across ${relevantIds.length} cluster${
            relevantIds.length === 1 ? "" : "s"
          } checked. That usually means this device's firmware doesn't implement Zigbee's command-discovery request at all
            (common on some vendors' devices, Philips Hue/Signify among them) rather than a temporary communication problem
            — re-checking is unlikely to change the result.</p>`
        : "";

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
    const scannedCount = epIds.filter((ep) => {
      const e = this._commandScans.get(this._commandScanKey(d.ieee, ep));
      return e && e.status === "done";
    }).length;
    if (!scannedCount) return "";

    if (this._shareDraft && this._shareDraft.key === d.ieee) {
      return `<div class="device-share-section">${this._shareDraftHtml(this._shareDraft)}</div>`;
    }
    return `
      <div class="device-share-section">
        <button class="btn btn-small device-cmd-share" type="button">
          Share scan to community database (${scannedCount}/${epIds.length} endpoint${epIds.length === 1 ? "" : "s"} checked)
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
    const epScan = ((scan && scan.endpoints) || []).find((e) => Number(e.id) === Number(ep));
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
      return `<div class="capexp-compare-my-device muted">No community data for this device yet — share this scan below and you'll be the first.</div>`;
    }

    const gap = newestFirmwareGap(liveFirmware, entries);
    if (!gap) {
      return `<div class="capexp-compare-my-device capexp-compare-ok">You're on <strong>${escapeHtml(
        liveFirmware
      )}</strong> — the community hasn't confirmed anything newer for this device yet.</div>`;
    }

    const newItems = gap.diff ? this._capExpNewCapabilitiesList(gap.diff) : [];
    let bodyHtml;
    if (gap.diff === null) {
      // No community entry for exactly this device's current firmware, so
      // there's nothing to diff against — real evidence gap, not "nothing
      // changed".
      bodyHtml = `<p class="hint">Newer firmware confirmed by the community, but nobody's compared it against exactly your version yet.</p>`;
    } else if (newItems.length) {
      bodyHtml = `<div class="capexp-compare-label">New capabilities since your version</div>
        <ul class="capexp-compare-list">${newItems.map((item) => `<li>✓ ${escapeHtml(item)}</li>`).join("")}</ul>`;
    } else {
      // Diff did run, it just didn't find anything newly confirmed —
      // distinct from the "never compared" case above, so it shouldn't
      // share that wording.
      bodyHtml = `<p class="hint">Compared against your version — no new capabilities were confirmed on the newer firmware (may still fix bugs or remove something).</p>`;
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
    const notice = draft.tooLong
      ? `<p class="hint">This scan is too large to pre-fill the whole issue. The title's already filled in — clicking below also copies the JSON, so just paste it (Ctrl/Cmd+V) into the body once the new issue opens.</p>`
      : `<p class="hint">Review what would be submitted, then open a pre-filled GitHub issue — nothing is sent until you click "Submit new issue" on GitHub's own page. No IEEE address, entity, area, or binding data is included.</p>`;
    return `
      <div class="ep-cmd-share-draft">
        ${notice}
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
    const inClusters = (epScan && epScan.in_clusters) || {};
    const basic = inClusters["0x0000"];
    const findIdentityAttr = (name) => {
      if (!basic || !basic.attributes) return null;
      const hit = Object.values(basic.attributes).find((a) => a.attribute_name === name);
      return hit && hit.attribute_value != null ? hit.attribute_value : null;
    };
    return {
      sw_build_id: findIdentityAttr("sw_build_id"),
      hw_version: findIdentityAttr("hw_version"),
      date_code: findIdentityAttr("date_code"),
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
    const inClusters = (epScan && epScan.in_clusters) || {};
    const clusters = {};
    Object.keys(inClusters).forEach((hexKey) => {
      const clusterData = inClusters[hexKey] || {};
      const clusterId = Number(hexKey);
      const commandsReceived = this._classifyClusterCommands(clusterId, clusterData.commands_received);
      const commandsGenerated = Object.values(clusterData.commands_generated || {}).map((info) => ({
        id: Number(info.command_id),
        name: info.command_name,
      }));
      const attributesConfirmed = Object.values(clusterData.attributes || {}).map((info) => ({
        id: Number(info.attribute_id),
        name: info.attribute_name,
        access: info.access,
      }));
      clusters[hexKey] = {
        name: clusterData.title || clusterName(clusterId),
        commands_received: commandsReceived.rows,
        commands_received_confirmed: commandsReceived.confirmed,
        commands_generated: commandsGenerated,
        attributes_confirmed: attributesConfirmed,
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
      const epScan =
        entry && entry.status === "done"
          ? ((entry.scan && entry.scan.endpoints) || []).find((e) => Number(e.id) === Number(epId))
          : null;
      if (epScan) {
        const scannedIdentity = this._extractIdentity(epScan);
        if (scannedIdentity.sw_build_id) identity = scannedIdentity;
        return {
          endpoint: {
            id: epId,
            profile: epScan.profile || null,
            device_type: epScan.device_type || null,
            in_clusters: Object.keys(epScan.in_clusters || {}),
            out_clusters: Object.keys(epScan.out_clusters || {}),
          },
          scanned: true,
          clusters: this._clustersBlockFromScan(epScan),
        };
      }
      // Declared-but-unscanned endpoint (not checked yet, or not scannable
      // at all — e.g. Green Power proxy) — still list what it declares
      // rather than dropping it from the submission entirely.
      const epClusters = rawClusters.filter((c) => c.endpoint_id === epId);
      return {
        endpoint: {
          id: epId,
          in_clusters: epClusters.filter((c) => c.type === "in").map((c) => hex4(c.id)),
          out_clusters: epClusters.filter((c) => c.type === "out").map((c) => hex4(c.id)),
        },
        scanned: false,
      };
    });

    return {
      manufacturer: d.manufacturer || null,
      model: d.model || null,
      identity,
      endpoints,
      provenance: {
        submitted_at: new Date().toISOString(),
        card_version: CARD_VERSION,
      },
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
    if (!record || !record.endpoints.some((e) => e.scanned)) {
      this._setStatus("error", "Nothing to share yet — check supported commands on at least one endpoint first.");
      return;
    }
    const title = `[Device Submission] ${record.manufacturer || "Unknown"} ${record.model || "Unknown"}${
      record.identity.sw_build_id ? ` (fw ${record.identity.sw_build_id})` : ""
    }`;
    const displayBody = "```json\n" + JSON.stringify(record, null, 2) + "\n```";
    const compactBody = "```json\n" + JSON.stringify(record) + "\n```";
    const labelsParam = `labels=${encodeURIComponent("device-submission")}`;
    const fullUrl =
      `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}` +
      `&body=${encodeURIComponent(compactBody)}&${labelsParam}`;
    const tooLong = fullUrl.length > 6000;
    const url = tooLong
      ? `https://github.com/${CAPABILITY_DB_REPO}/issues/new?title=${encodeURIComponent(title)}` +
        `&body=${encodeURIComponent("Paste the copied JSON below this line:\n\n")}&${labelsParam}`
      : fullUrl;
    this._shareDraft = { key: d.ieee, record, title, body: displayBody, url, tooLong };
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
        /* fall through to the legacy path below */
      }
    }
    const textarea = this._q(".ep-cmd-share-json");
    if (textarea) {
      try {
        textarea.focus();
        textarea.select();
        return document.execCommand("copy");
      } catch (e) {
        /* text stays selected either way, for a manual copy */
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
    const detachHtml =
      detach.state === null
        ? `<span class="ep-badge ep-badge-muted" title="No matching switch.*detach* entity found for this endpoint">Mode unknown</span>`
        : `<span class="ep-badge ep-badge-muted" title="${escapeHtml(detach.entityId || "")}">${
            detach.state ? "Detached" : "Not detached"
          }</span>`;

    /** Renders one badge, with a clusters sub-line when there's more than
     *  one cluster in the relationship (a single, expected cluster like a
     *  plain OnOff self-bind stays uncluttered and doesn't show one). */
    const badge = (cls, main, clusters) =>
      `<span class="ep-badge ${cls}">${main}${
        clusters.length > 1 ? `<span class="ep-badge-clusters">${escapeHtml(clusters.join(", "))}</span>` : ""
      }</span>`;

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
        const main = `Receives control from ${escapeHtml(this._targetDeviceLabel(b.sourceIeee))} (ep ${
          b.sourceEndpoint
        })`;
        badges.push(badge("ep-badge-in", main, clusters));
      }
    );
    rel.memberOf.forEach((m) => {
      badges.push(
        `<span class="ep-badge ep-badge-member">Member of ${escapeHtml(this._groupLabel(m.groupId))}</span>`
      );
    });
    this._groupBindingsByKey(rel.unknown, (b) =>
      b.isGroup ? `group:${b.groupId}` : `${b.targetIeee}:${b.targetEndpoint}`
    ).forEach(({ binding: b, clusters }) => {
      const main = b.isGroup
        ? `Unclassified binding to group ${escapeHtml(this._groupLabel(b.groupId))}`
        : `Unclassified binding to ${escapeHtml(this._targetDeviceLabel(b.targetIeee))} (ep ${escapeHtml(String(b.targetEndpoint))})`;
      badges.push(badge("ep-badge-unknown", main, clusters));
    });
    if (!badges.length) badges.push(`<span class="ep-badge ep-badge-reporting">Reporting only</span>`);

    // Groups by actual target (coordinator / another device / a group) so a
    // "reporting" binding to a group — the same real ZHA behaviour that
    // caused the false "Controls group" badges above — reads as "reports to
    // <group>", not the coordinator it may have nothing to do with.
    const reportLine = this._groupBindingsByKey(rel.reportsTo, (b) =>
      b.isGroup ? `group:${b.groupId}` : `target:${b.targetIeee}`
    )
      .map(({ binding: b, clusters }) => {
        const targetLabel = b.isGroup
          ? `group ${this._groupLabel(b.groupId)}`
          : b.targetIeee === coord
          ? "the coordinator"
          : this._targetDeviceLabel(b.targetIeee);
        return `<p class="ep-report">Also reports ${escapeHtml(clusters.join(", "))} to ${escapeHtml(
          targetLabel
        )}</p>`;
      })
      .join("");

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
    const target = binding.isGroup
      ? this._groups.find((g) => g.group_id === binding.groupId)
      : this._devices.find((d) => d.ieee === binding.targetIeee);
    const sourceLabel = source ? this._deviceLabel(source) : binding.sourceIeee;
    const targetLabel = binding.isGroup
      ? target
        ? target.name
        : `Group ${binding.groupId}`
      : target
      ? this._deviceLabel(target)
      : binding.targetIeee;

    const cls = this._classifyBinding(binding);
    const typeText = {
      control: "Control &mdash; the source uses this to command the target",
      reporting: "Reporting &mdash; the source uses this to report its own state; not a control relationship",
      manufacturer: "Manufacturer-specific &mdash; a cluster outside the Zigbee standard, usually set up by the device itself. The card doesn't check it.",
      unknown:
        "Unknown &mdash; the source device hasn't been cluster-scanned yet, so this can't be classified as control or reporting. Shown either way rather than guessing.",
    }[cls];
    this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Source</td><td>${escapeHtml(sourceLabel)} (ep ${escapeHtml(String(binding.sourceEndpoint))})</td></tr>
        <tr><td>Target</td><td>${escapeHtml(targetLabel)}${
      binding.isGroup ? "" : ` (ep ${escapeHtml(String(binding.targetEndpoint))})`
    }</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
        <tr><td>Type</td><td>${typeText}</td></tr>
      </table>
      ${
        this._experimental && !binding.isGroup && cls !== "reporting" && cls !== "manufacturer"
          ? `<p class="hint">Network (beta): show the way this binding's commands likely travel through your routers, from the last network scan.</p>`
          : this._experimental && binding.isGroup
          ? `<p class="hint">Group bindings are sent as a broadcast, so there's no single route to show. <strong>Check route…</strong> in the remote's side panel shows how well each light hears the mesh.</p>`
          : ""
      }
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
      this._setStatus("info", "Removing binding…", 0);
      const bindTarget = binding.isGroup
        ? { isGroup: true, groupId: binding.groupId }
        : { isGroup: false, ieee: binding.targetIeee, endpoint: binding.targetEndpoint };
      const before = this._bindingPresent(binding.sourceIeee, binding.sourceEndpoint, binding.clusterId, bindTarget);
      let unbindError = null;
      const rescanTargets = binding.isGroup
        ? [binding.sourceIeee]
        : this._impactedIeees(binding.sourceIeee, binding.targetIeee);
      try {
        if (binding.isGroup) {
          // Real zha_toolkit unbind_group service — confirmed working both
          // here and via the Advanced tab. Previously called native HA's
          // zha/groups/unbind websocket command instead (unbindDeviceFromGroup),
          // which is what was actually causing "still on the device after
          // rescanning" — confirmed by Hans testing unbind_group directly in
          // Developer Tools while the button here kept failing.
          await this._api.unbindGroup(binding.sourceIeee, binding.groupId, [binding.clusterId], {
            endpoint: binding.sourceEndpoint,
          });
        } else {
          await this._api.unbindIeee(binding.sourceIeee, binding.targetIeee, [binding.clusterId], {
            endpoint: binding.sourceEndpoint,
            dstEndpoint: binding.targetEndpoint,
          });
        }
      } catch (err) {
        // Not trusted alone — the outcome below is verified against a fresh
        // rescan instead (see v0.8.2 diagnosis).
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
            target: bindTarget,
          },
          scan,
          before
        );
        let message = res.message;
        if (res.level !== "success") {
          const why = explainUnbindFailure({
            errors: unbindError ? [unbindError] : [],
            targetRemoved: !binding.isGroup && this._isRemovedDevice(binding.targetIeee),
          });
          if (why) message = `${message} ${why}`;
        }
        this._setStatus(res.level, message, res.level === "success" ? undefined : 0, res.action);
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
    // When the search term has just selected a device, the term has done its
    // job: the device filter decides the rows, and the term is not applied a
    // second time as text.
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
      const target = b.isGroup
        ? this._groups.find((g) => g.group_id === b.groupId)
        : this._devices.find((d) => d.ieee === b.targetIeee);
      const hay = `${source ? `${this._deviceLabel(source)} ${deviceNameText(source)}` : ""} ${
        target ? (b.isGroup ? target.name || "" : `${this._deviceLabel(target)} ${deviceNameText(target)}`) : ""
      } ${clusterName(b.clusterId)} ${source ? this._areaName(source.area_id) : ""} ${
        source ? source.manufacturer || "" : ""
      } ${source ? source.model || "" : ""}`.toLowerCase();
      return hay.includes(s);
    });
  }

  _renderTable() {
    const wrap = this._q("#table-body");
    if (!wrap) return;

    // Fire-and-forget: fetches target endpoint/cluster metadata needed for
    // Rules 2/3 (cheap local reads, not Zigbee radio calls) and re-renders
    // itself once done. No-ops instantly if everything's already cached.
    this._ensureHealthData();

    const { ieee: deviceIeee, bySearch } = this._effectiveTableDevice();
    // A different device (or none) always starts at All, however it was chosen.
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
          // A removed device can't be bound from. Offer the clean-up for this
          // one device instead: forget its saved data, unbind what still
          // points to it.
          const saved = removedSources(this._bindings, this._devices)
            .filter((g) => normIeee(g.ieee) === deviceIeee)
            .reduce((n, g) => n + g.count, 0);
          const pointing = deadTargetBindings(this._bindings, this._devices).filter(
            (b) => normIeee(b.targetIeee) === deviceIeee
          ).length;
          actionsHtml = `<span class="removed-note">Removed from ZHA${
            name !== deviceIeee ? ` · <code>${escapeHtml(deviceIeee)}</code>` : ""
          }</span>${
            saved
              ? `<button class="btn btn-small" id="btn-filter-forget">Forget ${saved} saved binding${saved === 1 ? "" : "s"}</button>`
              : ""
          }${
            pointing
              ? `<button class="btn btn-small btn-danger" id="btn-filter-unbind-dead">Unbind ${pointing} pointing to it</button>`
              : ""
          }`;
        }
        const dirChip = (value, label) =>
          `<button class="chip${this._tableDirection === value ? " active" : ""}" data-direction="${value}">${label}</button>`;
        filterInfo.innerHTML = `Showing bindings involving <strong>${escapeHtml(name)}</strong>${
          bySearch ? ' <span class="muted">(matched by your search)</span>' : ""
        }
          <span class="health-filters">${dirChip(DIRECTION_ALL, "All")}${dirChip(DIRECTION_OUTBOUND, "Outbound")}${dirChip(
          DIRECTION_INBOUND,
          "Inbound"
        )}</span>
          <button class="btn btn-small" id="btn-clear-source-filter">${bySearch ? "Clear search" : "Clear filter"}</button>
          ${actionsHtml}`;
        filterInfo.style.display = "flex";
        this._q("#btn-clear-source-filter").addEventListener("click", () => {
          if (bySearch) {
            // Clearing the box goes through its own input handler so the Map
            // and the table both update.
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

    // Direction column exists only while a device filter is active; the
    // unfiltered table is unchanged.
    const filtered = !!deviceIeee;
    const dirTh = this._q("#th-direction");
    if (dirTh) dirTh.style.display = filtered ? "" : "none";

    const healthMap = this._computeHealthMap();
    this._renderHealthSummary(healthMap);
    this._renderStaleBanner();
    this._renderPendingBanner();

    this._updateSortIndicators("#view-table", this._tableSort);

    let rows = this._filteredBindingRows(healthMap).map((b) => {
      const source = this._devices.find((d) => d.ieee === b.sourceIeee);
      const target = b.isGroup
        ? this._groups.find((g) => g.group_id === b.groupId)
        : this._devices.find((d) => d.ieee === b.targetIeee);
      // A removed source falls back to what the card last knew about it.
      const known = source ? null : this._knownDeviceInfo(b.sourceIeee);
      const sourceLabel = source ? this._deviceLabel(source) : this._ieeeLabel(b.sourceIeee);
      const targetLabel = b.isGroup
        ? (target && target.name) || `Group ${escapeHtml(String(b.groupId))}`
        : target
        ? this._deviceLabel(target)
        : this._ieeeLabel(b.targetIeee);
      const typeLabel = source ? this._devicePrimaryType(source) : "—";
      const typeFull = source ? this._deviceTypeTags(source).join(", ") : "";
      const areaLabel = source
        ? this._areaName(source.area_id)
        : known && known.area_id
        ? this._areaName(known.area_id)
        : "—";
      const manModelOf = (d) => [d.manufacturer, d.model].filter(Boolean).join(" / ") || "—";
      const manModel = source ? manModelOf(source) : known ? manModelOf(known) : "—";
      const health = healthMap.get(b.id) || {
        level: "ok",
        code: "ok",
        message: "",
        why: "",
        recommendation: null,
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
        healthRank: HEALTH_RANK[health.level] ?? 9,
      };
    });
    // With a device filter and no column sort chosen, list outbound first.
    // Array.prototype.sort is stable, so scan order is kept within each group.
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
        healthFilterLabel:
          this._tableHealthFilter !== "all" ? (healthChip ? healthChip.textContent.trim() : this._tableHealthFilter) : null,
        search: bySearch ? null : (this._filters.search || "").trim() || null,
        deviceFilterActive: filtered,
        deviceMatches: filtered
          ? all.filter((b) => matchesDeviceFilter(b, deviceIeee, this._tableDirection)).length
          : all.length,
        direction: this._tableDirection,
        deviceName: dev ? this._deviceLabel(dev) : deviceIeee,
        coordinatorHidden: !!(dev && (dev.device_type === "Coordinator" || dev.active_coordinator) && this._filters.hideCoordinatorBindings),
      });
      wrap.innerHTML = `<tr><td colspan="${colCount}" class="muted">${escapeHtml(state.message)}</td></tr>`;
      return;
    }

    wrap.innerHTML = rows
      .map((r) => {
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
          <td>${
            b.isGroup
              ? `${escapeHtml(r.targetLabel)} (group)`
              : `<a href="#" class="src-link tgt-link" data-ieee="${escapeHtml(b.targetIeee)}" title="Open this device">${escapeHtml(
                  r.targetLabel
                )}</a> <span class="muted">(ep ${escapeHtml(String(b.targetEndpoint))})</span>`
          }</td>
          <td><button class="health-badge health-${h.level}" data-health="${escapeHtml(b.id)}" title="${escapeHtml(
          h.message
        )}">${HEALTH_ICON[h.level]} ${escapeHtml(HEALTH_LABEL[h.level])}</button></td>
          <td>${
            h.code === "source_missing"
              ? `<button class="btn btn-small" data-forget="${escapeHtml(b.sourceIeee)}" title="Remove the leftover saved data for this removed device. Nothing is sent to Zigbee.">Forget</button>`
              : `<button class="btn btn-small btn-danger" data-unbind="${escapeHtml(b.id)}">Unbind</button>`
          }</td>
        </tr>`;
      })
      .join("");

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
          // A device no longer in ZHA has no drawer; filter to its bindings instead.
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
          <span><strong>${dead.length} binding${dead.length === 1 ? "" : "s"}</strong> on ${sources} device${
        sources === 1 ? "" : "s"
      } point to devices that are no longer in ZHA. They use binding-table slots and send commands to nobody.</span>
          <button class="btn btn-small" id="btn-stale-show">Show</button>
          <button class="btn btn-small btn-danger" id="btn-stale-unbind-all">Unbind all</button>
        </div>`);
    }
    if (gone.length) {
      const count = gone.reduce((n, g) => n + g.count, 0);
      parts.push(`
        <div class="stale-row">
          <span><strong>${count} saved binding${count === 1 ? "" : "s"}</strong> from ${gone.length} device${
        gone.length === 1 ? "" : "s"
      } that ${gone.length === 1 ? "was" : "were"} removed from ZHA. This is leftover data in the card, not on your Zigbee network.</span>
          <button class="btn btn-small" id="btn-stale-forget-all">Forget all</button>
        </div>`);
    }
    el.innerHTML = parts.join("");
    el.style.display = "";
    const show = this._q("#btn-stale-show");
    if (show)
      show.addEventListener("click", () => {
        this._tableHealthFilter = "error";
        this._qa("#health-filters [data-health-filter]").forEach((b) =>
          b.classList.toggle("active", b.dataset.healthFilter === "error")
        );
        this._renderTable();
      });
    const unbindAll = this._q("#btn-stale-unbind-all");
    if (unbindAll) unbindAll.addEventListener("click", () => this._confirmUnbindDeadTargets());
    const forgetAll = this._q("#btn-stale-forget-all");
    if (forgetAll) forgetAll.addEventListener("click", () => this._confirmForgetSources(gone.map((g) => g.ieee)));
  }

  _confirmForgetSources(ieees) {
    const total = ieees.reduce((n, ieee) => {
      for (const [k, list] of this._bindings) if (normIeee(k) === normIeee(ieee)) n += (list || []).length;
      return n;
    }, 0);
    this._q("#dialog-title").textContent = "Forget leftover data";
    this._q("#dialog-body").innerHTML = `
      <p>This removes ${total} saved binding${total === 1 ? "" : "s"} for ${
      ieees.length === 1
        ? `<strong>${escapeHtml(this._ieeeLabel(ieees[0], { plain: true }))}</strong> (<code>${escapeHtml(ieees[0])}</code>), a device`
        : `${ieees.length} devices`
    } no longer in ZHA.</p>
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
    const rowsHtml = dead
      .map((b) => {
        const src = this._devices.find((d) => normIeee(d.ieee) === normIeee(b.sourceIeee));
        return `<tr><td>${escapeHtml(src ? this._deviceLabel(src) : b.sourceIeee)} (ep ${escapeHtml(String(b.sourceEndpoint))})</td><td>${escapeHtml(
          clusterName(b.clusterId)
        )}</td><td>${escapeHtml(this._ieeeLabel(b.targetIeee, { plain: true }))} <code>${escapeHtml(b.targetIeee)}</code></td></tr>`;
      })
      .join("");
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
      this._setStatus("info", `Unbinding ${i + 1} of ${dead.length}…`, 0);
      try {
        await this._api.unbindIeee(b.sourceIeee, b.targetIeee, [b.clusterId], {
          endpoint: b.sourceEndpoint,
          dstEndpoint: b.targetEndpoint,
        });
      } catch (err) {
        errors.push(toolkitErrorText(err));
        console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
      }
    }
    await this._scanBindings(sources);
    const stillThere = dead.filter((b) =>
      this._bindingPresent(b.sourceIeee, b.sourceEndpoint, b.clusterId, {
        isGroup: false,
        ieee: b.targetIeee,
        endpoint: b.targetEndpoint,
      })
    );
    const removed = dead.length - stillThere.length;
    if (!stillThere.length) {
      this._setStatus("success", `Removed all ${removed} binding${removed === 1 ? "" : "s"} to removed devices.`);
    } else {
      const unreadable = sources.filter((s) => this._scanFailures.has(normIeee(s))).length;
      this._setStatus(
        "error",
        `Removed ${removed} of ${dead.length}. ${stillThere.length} still present${
          unreadable ? ` (${unreadable} device${unreadable === 1 ? "" : "s"} didn't respond to the check, probably asleep)` : ""
        }. ${
          explainUnbindFailure({ errors, targetRemoved: true }) ||
          'Wake those devices and click "Unbind all" again.'
        }`,
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
    bindings.forEach((b) => {
      const h = healthMap.get(b.id);
      if (h) counts[h.level] = (counts[h.level] || 0) + 1;
    });
    el.style.display = "flex";
    el.innerHTML = `
      <span class="health-summary-title">Binding Health</span>
      <span class="muted">${bindings.length} binding${bindings.length === 1 ? "" : "s"} scanned</span>
      <span class="health-chip health-ok" title="Structurally valid: the devices, endpoint and cluster all exist. It doesn't prove the binding does what you meant.">${HEALTH_ICON.ok} ${counts.ok} Valid</span>
      ${
        counts.warning
          ? `<span class="health-chip health-warning">${HEALTH_ICON.warning} ${counts.warning} Warning${
              counts.warning === 1 ? "" : "s"
            }</span>`
          : ""
      }
      ${
        counts.error
          ? `<span class="health-chip health-error">${HEALTH_ICON.error} ${counts.error} Error${
              counts.error === 1 ? "" : "s"
            }</span>`
          : ""
      }
      ${counts.info ? `<span class="health-chip health-info">${HEALTH_ICON.info} ${counts.info} Info</span>` : ""}
    `;
  }

  /** Detail popover for a Health badge — answers what's wrong, why it
   *  matters, and what to do next, reusing the generic dialog. */
  _openHealthDetail(binding, health) {
    const source = this._devices.find((d) => d.ieee === binding.sourceIeee);
    const target = binding.isGroup
      ? this._groups.find((g) => g.group_id === binding.groupId)
      : this._devices.find((d) => d.ieee === binding.targetIeee);
    const sourceLabel = source ? this._deviceLabel(source) : binding.sourceIeee;
    const targetLabel = binding.isGroup
      ? (target && target.name) || `Group ${binding.groupId}`
      : target
      ? this._deviceLabel(target)
      : binding.targetIeee;
    this._q("#dialog-title").textContent = `${HEALTH_ICON[health.level]} ${HEALTH_LABEL[health.level]}`;
    // OK bindings have nothing "wrong" to report, so they skip the
    // What's wrong / Why it matters / Next steps framing used for the
    // other three statuses and just get a single plain confirmation line.
    const detailHtml =
      health.level === "ok"
        ? `<p>${escapeHtml(health.message)}</p>`
        : `
      <p><strong>What's wrong:</strong> ${escapeHtml(health.message)}</p>
      <p><strong>Why it matters:</strong> ${escapeHtml(health.why)}</p>
      ${health.recommendation ? `<p><strong>Next steps:</strong> ${escapeHtml(health.recommendation)}</p>` : ""}`;
    this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Binding</td><td>${escapeHtml(sourceLabel)} (ep ${escapeHtml(String(binding.sourceEndpoint))}) → ${escapeHtml(
      targetLabel
    )}${binding.isGroup ? " (group)" : ` (ep ${escapeHtml(String(binding.targetEndpoint))})`}</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
      </table>
      ${detailHtml}
      <div class="dialog-actions">
        ${
          (health.code === "unable_to_verify" || health.code === "partial_scan") && source
            ? `<button class="btn" id="health-detail-rescan" data-ieee="${escapeHtml(source.ieee)}">Rescan now</button>`
            : ""
        }
        ${
          health.code === "source_missing"
            ? `<button class="btn" id="health-detail-forget" data-ieee="${escapeHtml(binding.sourceIeee)}">Forget</button>`
            : ""
        }
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
        rescanBtn.textContent = "Scanning…";
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
      const target = b.isGroup
        ? this._groups.find((g) => g.group_id === b.groupId)
        : this._devices.find((d) => d.ieee === b.targetIeee);
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
        target_name: b.isGroup ? (target && target.name) || `Group ${escapeHtml(String(b.groupId))}` : target ? this._deviceLabel(target) : "",
        target_ieee_or_group: b.isGroup ? `group:${b.groupId}` : b.targetIeee,
        target_endpoint: b.isGroup ? "" : b.targetEndpoint,
        health_status: HEALTH_LABEL[health.level] || health.level,
        health_details: health.message || "",
      };
    });
  }

  _printBindings() {
    const rows = this._exportRowsData();
    const win = window.open("", "_blank");
    if (!win) {
      this._setStatus("error", "Pop-up blocked — allow pop-ups for this page to print/save as PDF.");
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
      "health_details",
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
      health_details: "Health details",
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
      <div class="meta">Exported ${escapeHtml(new Date().toLocaleString())} — ${rows.length} binding(s)</div>
      <table><thead><tr>${cols.map((c) => `<th>${titles[c]}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(r[c])}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>
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
    const whenIso = (history && (history.lastSuccessAt || history.lastAttemptAt)) || (status === "ok" ? this._lastScanAt : null);
    const statusLabel = { failed: "Failed", partial: "Partial", ok: "OK", never: "Never scanned" }[status];
    const bits = [statusLabel];
    if (whenIso) bits.push(relTime(whenIso));
    if (history && history.medianMs != null) bits.push(`typical ${formatDurationMs(history.medianMs)}`);
    if (history && history.attemptCount > 1) {
      bits.push(`responded ${history.successCount}/${history.attemptCount}`);
    }
    // Wake-advice is only physically meaningful for a battery device, and
    // only when there's an actual current failure/partial to explain — a
    // mains device that's not responding needs a completely different
    // message (check power/wiring, not "press a button").
    const needsExplanation = status === "failed" || status === "partial";
    const wakeHint = !needsExplanation
      ? ""
      : isBattery
      ? `<div class="scan-wake-hint">May be asleep — press a button on it, then rescan.</div>`
      : `<div class="scan-wake-hint">Not responding — check it's powered on and in range, then rescan.</div>`;
    const btnLabel = isBattery && needsExplanation ? "Wake & rescan" : "Rescan";
    return {
      scanRank,
      html: `<div class="scan-cell scan-cell-${status}">
        <span class="scan-cell-status">${escapeHtml(bits.join(" · "))}</span>
        ${wakeHint}
        <button type="button" class="btn btn-small scan-cell-btn" data-ieee="${escapeHtml(device.ieee)}">${btnLabel}</button>
      </div>`,
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
      el.innerHTML = `<p class="muted">Loading groups…</p>`;
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
        <button class="btn btn-primary" id="groups-new" ${dis} title="Pick a remote and the lights it should control. The card makes or reuses a group, binds the remote to it and checks it works.">New group for a remote…</button>
      </div>`;
    if (!rows.length) {
      el.innerHTML = `${head}<p class="muted">No ZHA groups yet. <strong>New group for a remote…</strong> creates one.</p>`;
      this._wireGroupsTab(rows);
      return;
    }
    const cards = rows.map((r) => {
      const area = (ieee) => {
        const d = this._devices.find((x) => normIeee(x.ieee) === ieee);
        return d && d.area_id ? ` <span class="muted">${escapeHtml(this._areaName(d.area_id))}</span>` : "";
      };
      const members = r.members.length
        ? `<ul class="groups-list">${r.members
            .map(
              (m) => `<li>${devLink(m.ieee, ` <span class="muted">ep ${m.endpoint}</span>${area(m.ieee)}`)}
                <button class="btn btn-small" data-group-remove="${r.groupId}|${escapeHtml(m.ieee)}|${m.endpoint}" ${dis} title="Take this light out of the group (ZHA tells the light straight away)">Remove</button></li>`
            )
            .join("")}</ul>`
        : `<p class="muted">No lights in it.</p>`;
      const controllers = r.controllers.length
        ? `<ul class="groups-list">${r.controllers
            .map((c) => `<li>${devLink(c.sourceIeee, ` <span class="muted">ep ${c.endpoint}: ${escapeHtml(c.clusters.map(clusterName).join(", "))}</span>`)}</li>`)
            .join("")}</ul>`
        : `<p class="muted">No remote is bound to it${this._rawBindings().length ? "" : " (or bindings haven't been scanned yet)"}.</p>`;
      const others = r.others
        ? `<p class="hint">${r.others} other binding${r.others === 1 ? " to this group isn't" : "s to this group aren't"} control: a device reporting its own state, or a manufacturer-specific cluster the device set up itself.</p>`
        : "";
      return `<section class="group-card ${this._groupsFocus === r.groupId ? "group-focus" : ""}" data-gid="${r.groupId}">
        <div class="group-card-head">
          <strong>👥 ${escapeHtml(r.name)}</strong>
          <span class="muted">${groupIdHex(r.groupId)} · ${r.members.length} light${r.members.length === 1 ? "" : "s"}</span>
          <span class="spacer"></span>
          <button class="btn btn-small" data-group-add="${r.groupId}" ${dis}>Add lights…</button>
          <button class="btn btn-small" data-group-remote="${r.groupId}" ${dis} title="Bind a remote to this group, step by step">Add a remote…</button>
          <button class="btn btn-small btn-danger" data-group-delete="${r.groupId}" ${dis}>Delete group…</button>
        </div>
        <div class="group-cols">
          <div><div class="drawer-section-title">Lights</div>${members}</div>
          <div><div class="drawer-section-title">Controlled by</div>${controllers}${others}</div>
        </div>
        ${this._groupsAddOpen === r.groupId ? this._groupsAddHtml(r) : ""}
        ${this._groupsDeleteOpen === r.groupId ? this._groupsDeleteHtml(r) : ""}
      </section>`;
    });
    el.innerHTML = head + cards.join("");
    this._wireGroupsTab(rows);
    if (this._groupsFocus != null) {
      const sec = this._q(`#view-groups .group-card[data-gid="${this._groupsFocus}"]`);
      if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "nearest" });
      this._groupsFocus = null;
    }
  }

  _groupsAddHtml(r) {
    if (!this._groupsCandidatesReady) {
      return `<div class="drawer-share"><p class="muted">Finding lights…</p></div>`;
    }
    const coord = normIeee(this._coordinatorIeee() || "");
    const inGroup = new Set(r.members.map((m) => `${m.ieee}:${m.endpoint}`));
    const list = candidateTargets({
      devices: this._devices
        .filter((d) => !this._isRemovedDevice(d.ieee))
        .map((d) => ({ ieee: d.ieee, name: this._deviceLabel(d), isCoordinator: normIeee(d.ieee) === coord || d.device_type === "Coordinator" })),
      clustersFor: (ieee) => this._clusterCache.get(ieee),
      sourceIeee: "",
      clusterIds: FLOW_CLUSTERS,
    }).filter((t) => !inGroup.has(`${normIeee(t.ieee)}:${t.endpoint}`));
    if (!list.length) {
      return `<div class="drawer-share"><p>Every light that accepts On/Off, Level or Colour commands is already in this group.</p>
        <div class="dialog-actions"><button class="btn btn-small" id="groups-add-cancel">Close</button></div></div>`;
    }
    return `<div class="drawer-share groups-add">
      <p>Choose the lights to add. ZHA adds each one to the group straight away; the remotes bound to the group control them from then on.</p>
      <div class="groups-pick">${list
        .map((t) => `<label class="row"><input type="checkbox" data-add-key="${escapeHtml(t.ieee)}|${t.endpoint}"> ${escapeHtml(t.name)} <span class="muted">${escapeHtml(t.clusters.map(clusterName).join(", "))}</span></label>`)
        .join("")}</div>
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
      ${
        result
          ? `<p><strong>Not deleted yet: ${result.left.length === 1 ? "1 device still has" : `${result.left.length} devices still have`} bindings to this group.</strong></p>
             <ul class="groups-reasons">${result.reasons.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
          : `<p><strong>${plan.length} binding${plan.length === 1 ? "" : "s"} still point${plan.length === 1 ? "s" : ""} to this group</strong>, from
              ${sources.map(nameOf).join(", ")}. Deleted on its own, the group leaves them on ${sources.length === 1 ? "that device" : "those devices"},
              sending commands to nobody and using up binding slots.</p>
             ${reporting.length ? `<p class="hint">${[...new Set(reporting.map((p) => p.sourceIeee))].map(nameOf).join(", ")} only report${reporting.length === 1 ? "s" : ""} ${reporting.length === 1 ? "its" : "their"} own state to the group; those bindings are removed too.</p>` : ""}
             ${battery.length ? `<p class="hint"><strong>Wake ${battery.map(nameOf).join(", ")} first</strong> (press a button): battery devices only listen just after they're used.</p>` : ""}`
      }
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
    on("[data-group-remote]", (e) => this._openGroupFlowPickRemote({ groupId: Number(e.currentTarget.dataset.groupRemote) }));
    on("[data-group-add]", async (e) => {
      const gid = Number(e.currentTarget.dataset.groupAdd);
      this._groupsDeleteOpen = null;
      this._groupsAddOpen = this._groupsAddOpen === gid ? null : gid;
      this._renderGroupsTab();
      if (this._groupsAddOpen != null && !this._groupsCandidatesReady) {
        await Promise.all(this._devices.map((d) => this._ensureClusters(d.ieee).catch(() => {})));
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
    boxes.forEach((b) =>
      b.addEventListener("change", () => {
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
    this._setStatus("info", `Adding ${members.length} light${members.length === 1 ? "" : "s"} to ${name}…`, 0);
    try {
      await this._api.addGroupMembers(gid, members);
      this._groupsAddOpen = null;
      await this._groupsRefresh();
      const g = this._groups.find((x) => Number(x.group_id) === gid);
      const have = new Set(((g && g.members) || []).map((m) => `${normIeee(m.device && m.device.ieee)}:${Number(m.endpoint_id)}`));
      const missing = members.filter((m) => !have.has(`${normIeee(m.ieee)}:${m.endpoint}`));
      if (missing.length) {
        this._setStatus("error", `ZHA didn't list ${missing.map((m) => this._ieeeLabel(m.ieee, { plain: true })).join(", ")} in ${name} afterwards. Check the light is online and try again.`, 0);
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

  async _groupsRemoveMember(gid, ieee, endpoint) {
    if (this._groupsBusy != null) return;
    const name = this._groupsLabel(gid);
    const who = this._ieeeLabel(ieee, { plain: true });
    this._groupsBusy = gid;
    this._renderGroupsTab();
    this._setStatus("info", `Removing ${who} from ${name}…`, 0);
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
          [...new Set(this._rawBindings().filter((b) => b.isGroup && Number(b.groupId) === gid).map((b) => normIeee(b.sourceIeee)))].map((i) =>
            this._ensureClusters(i).catch(() => {})
          )
        );
        const plan = this._groupsDeletePlan(gid);
        const sources = [...new Set(plan.map((p) => p.sourceIeee))];
        const errors = new Map(sources.map((i) => [i, []]));
        this._setStatus("info", `Unbinding ${plan.length} binding${plan.length === 1 ? "" : "s"} from ${name}…`, 0);
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
        const read = (scan && scan.read) || new Set();
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
                answered: read.has(i),
              };
            })
          );
          this._groupsDeleteResult = { gid, left: leftSources, reasons };
          this._setStatus("error", `${name} wasn't deleted: ${leftSources.length === 1 ? "1 device still has" : `${leftSources.length} devices still have`} bindings to it. The reasons are under the group.`, 0);
          return;
        }
      }
      this._setStatus("info", `Deleting ${name}…`, 0);
      await this._api.removeGroups([gid]);
      this._groupsDeleteOpen = null;
      this._groupsDeleteResult = null;
      await this._groupsRefresh();
      const gone = !this._groups.some((x) => Number(x.group_id) === gid);
      this._setStatus(gone ? "success" : "error", gone ? `Deleted ${name}.` : `ZHA still lists ${name} after deleting it. Try again.`, gone ? undefined : 0);
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
      wrap.innerHTML = `<tr><td colspan="8" class="muted">Loading devices…</td></tr>`;
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
        manufacturer: d.manufacturer || "—",
        model: d.model || "—",
        area: this._areaName(d.area_id),
        power: d.power_source || "—",
        count: this._deviceBindingCount(d.ieee),
        scanRank: scanCell.scanRank,
        scanHtml: scanCell.html,
      };
    });
    rows = this._devicesSort.key ? this._sortRows(rows, this._devicesSort) : rows.sort((a, b) => a.name.localeCompare(b.name));

    if (!rows.length) {
      wrap.innerHTML = search
        ? `<tr><td colspan="8" class="muted">No devices match “${escapeHtml(search)}”. Clear the search box to see all ${this._devices.length} devices.</td></tr>`
        : `<tr><td colspan="8" class="muted">No devices found.</td></tr>`;
      return;
    }
    wrap.innerHTML = rows
      .map(
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
      )
      .join("");

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
        btn.textContent = "Scanning…";
        this._rescanDeviceFull(btn.dataset.ieee, { tries: this._retryCount }).finally(() => {
          // _renderDevicesTab() (called at the end of _scanBindings) will
          // have already replaced this button — nothing to reset if so.
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
      /* ignore corrupt cache */
    }
    const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
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
      legacyFloor: typeof raw.legacyFloor === "string" ? raw.legacyFloor : null,
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
      activeFloor: this._fpFloor || null,
    });
  }

  /** Home Assistant floors (Settings → Areas, labels & zones → Floors),
   *  lowest level first. Empty when none are set up. */
  _haFloors() {
    const floors = (this._hass && this._hass.floors) || {};
    return Object.values(floors)
      .filter((f) => f && f.floor_id)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || String(a.name).localeCompare(String(b.name)));
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
    // See _renderGraph() — same fire-and-forget cluster-metadata fetch, so
    // _isControlBinding() has what it needs to filter this view's edges too.
    this._ensureHealthData();
    const urlInput = this._q("#fp-image-url");
    if (urlInput && document.activeElement !== urlInput) urlInput.value = this._fpImageUrl || "";
    this._renderFpFloorPicker();

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    this._fpEdgesLayer = null;
    this._fpNodesLayer = null;

    if (!this._fpImageUrl || !this._fpImageSize) {
      empty.style.display = "flex";
      empty.textContent = this._fpImageUrl ? "Loading image…" : "Set a floor plan image URL above to get started.";
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
      href: this._fpImageUrl,
    });
    bg.setAttributeNS("http://www.w3.org/1999/xlink", "href", this._fpImageUrl);
    svg.appendChild(bg);

    this._fpEdgesLayer = this._svgEl("g");
    this._fpNodesLayer = this._svgEl("g");
    svg.appendChild(this._fpEdgesLayer);
    svg.appendChild(this._fpNodesLayer);

    const placedIeees = Object.keys(this._fpPositions).filter((ieee) =>
      this._devices.some((d) => d.ieee === ieee)
    );
    this._fpNodeEls = new Map();
    placedIeees.forEach((ieee) => this._renderFpNode(ieee));
    this._renderFpEdges(placedIeees);
    this._renderFpUnplacedList();
    const placedDevices = placedIeees
      .map((ieee) => this._devices.find((d) => d.ieee === ieee))
      .filter(Boolean);
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
    const pairCount = new Map();
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
        "marker-end": "url(#fp-arrow)",
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
    // Matches _renderFpNode()'s radius (including the manual marker-size
    // setting) so the trim below lines up with the actual drawn circle.
    const nodeRadius = this._fpNodeRadius();
    this._fpEdgesLayer.querySelectorAll(".edge").forEach((el) => {
      const fromFrac = this._fpPositions[el.dataset.from];
      const toFrac = this._fpPositions[el.dataset.to];
      if (!fromFrac || !toFrac) return;
      const from = { x: fromFrac.x * this._fpImageSize.w, y: fromFrac.y * this._fpImageSize.h };
      const to = { x: toFrac.x * this._fpImageSize.w, y: toFrac.y * this._fpImageSize.h };
      const offset = Number(el.dataset.offset || 0);
      const dx = to.x - from.x,
        dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist,
        ny = dx / dist;
      const bend = offset * 18;
      const mx = (from.x + to.x) / 2 + nx * bend;
      const my = (from.y + to.y) / 2 + ny * bend;
      // Same fix as the Map view: pull the endpoint back to just outside the
      // target icon along the curve's actual incoming direction, so the
      // arrowhead is visible next to the icon instead of hidden under it.
      const tdx = to.x - mx,
        tdy = to.y - my;
      const tdist = Math.hypot(tdx, tdy) || 1;
      const targetGap = nodeRadius + 3;
      const ex = to.x - (tdx / tdist) * targetGap;
      const ey = to.y - (tdy / tdist) * targetGap;
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
          <li><strong>Settings → Areas, labels &amp; zones → Floors</strong>: add a floor for each level (for example Ground floor and First floor), with its level number (0, 1, …).</li>
          <li><strong>Settings → Areas, labels &amp; zones → Areas</strong>: open each area and choose its floor.</li>
          <li>Reload this page. A <strong>Floor</strong> picker appears here: choose a floor, set its image, and place its devices.</li>
        </ol>
        Your current plan becomes the lowest floor's plan, so nothing is lost. A device's floor comes from its area; placing it on a floor's plan overrides that.</details>`;
      return;
    }
    wrap.style.display = "";
    const sel = this._q("#fp-floor");
    if (sel && document.activeElement !== sel) {
      sel.innerHTML = floors
        .map((f) => `<option value="${escapeHtml(f.floor_id)}" ${f.floor_id === this._fpFloor ? "selected" : ""}>${escapeHtml(f.name)}</option>`)
        .join("");
    }
    const noArea = this._devices.filter((d) => !this._deviceFloor(d.ieee)).length;
    help.innerHTML = `<span class="muted">Each floor has its own image and placements. A device's floor comes from its area's floor in Home Assistant
      (Settings → Areas, labels &amp; zones); placing it on a floor's plan overrides that.${
        noArea ? ` ${noArea} device${noArea === 1 ? " has" : "s have"} no floor yet: ${noArea === 1 ? "it's" : "they're"} listed on every floor until placed.` : ""
      }</span>`;
  }

  _renderFpUnplacedList() {
    const list = this._q("#fp-unplaced-list");
    if (!list) return;
    if (!this._loaded) {
      list.innerHTML = `<span class="muted">Loading devices…</span>`;
      return;
    }
    const placed = new Set(Object.keys(this._fpPositions));
    const floors = this._haFloors();
    // With floors: list devices not placed anywhere whose area is on this
    // floor or has no floor (a device on another floor's plan is placed).
    const unplaced = this._devices.filter((d) => {
      if (placed.has(d.ieee)) return false;
      if (!floors.length) return true;
      const f = this._deviceFloor(d.ieee);
      return !f || f === this._fpFloor;
    });
    // Placed on this plan but belonging to another floor (e.g. the original
    // plan drew the office beside the garage): say so, so it can be moved.
    const misplaced = floors.length
      ? this._devices.filter((d) => placed.has(d.ieee) && this._deviceFloor(d.ieee) && this._deviceFloor(d.ieee) !== this._fpFloor)
      : [];
    if (!unplaced.length && !misplaced.length) {
      list.innerHTML = `<span class="muted">All devices ${floors.length ? "on this floor " : ""}placed.</span>`;
      return;
    }
    list.innerHTML =
      unplaced.map((d) => `<div class="fp-chip" data-ieee="${escapeHtml(d.ieee)}">${escapeHtml(this._deviceLabel(d))}</div>`).join("") +
      (misplaced.length
        ? `<p class="hint">On this plan but on another floor in Home Assistant: ${misplaced
            .map((d) => `${escapeHtml(this._deviceLabel(d))} (${escapeHtml(this._floorName(this._deviceFloor(d.ieee)))})`)
            .join(", ")}. Click one on the plan to remove it, then place it on its own floor's plan.</p>`
        : "");
    list.querySelectorAll(".fp-chip").forEach((el) => {
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
      return; // dropped outside the map — leave it in the unplaced list
    }
    const svg = this._q("#fp-svg");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    this._fpPositions[ieee] = {
      x: clamp(svgPt.x / this._fpImageSize.w, 0, 1),
      y: clamp(svgPt.y / this._fpImageSize.h, 0, 1),
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
      startClient: { x: e.clientX, y: e.clientY },
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
      // A plain click (no drag) sends the device back to the unplaced list.
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
    const cx = vb.x + vb.w / 2,
      cy = vb.y + vb.h / 2;
    const w = clamp(vb.w / factor, 100, 20000);
    const h = clamp(vb.h / factor, 60, 20000);
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
        <div class="capexp-strip">Built from real scans shared by ZHA users — <span id="capexp-strip-count">…</span>
          devices confirmed so far. Every scan you share adds to it.</div>
        <p class="capexp-mission">Understand what Zigbee devices report — from real community scans, not
          manufacturer claims.</p>
        <p class="hint" style="margin-top:0">Based on real scans, not manufacturer claims — nothing about your
          devices (IEEE addresses, entities, areas, names) ever leaves this browser. Only covers devices someone's
          already scanned and shared, so a gap here means nobody's confirmed it yet, not that it doesn't exist. See
          the <a href="https://github.com/${CAPABILITY_DB_REPO}" target="_blank" rel="noopener">zigbee-capabilities</a>
          database.</p>
        <p class="hint" style="margin-top:0">Capabilities are inferred from what the device itself reports — this
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
          <button class="btn btn-small" id="capexp-refresh">⟳ Refresh</button>
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
    fetchCapabilityIndex({ force })
      .then((index) => {
        this._capExpIndex = index;
      })
      .catch((err) => {
        this._capExpError = (err && err.message) || String(err);
      })
      .finally(() => {
        this._capExpLoading = false;
        this._renderCapExpBody();
        // The exploded device dialog's Compare My Device panel needs this
        // same index but can be open on its own, independent of whether the
        // Capability Explorer tab has ever been visited — re-render it in
        // place so a "Checking…" placeholder resolves into a real answer.
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
      statusEl.textContent = "Loading community capability data…";
      bodyEl.innerHTML = `<p class="muted">Loading…</p>`;
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
    statusEl.textContent = `${this._capExpIndex.length} firmware observation${
      this._capExpIndex.length === 1 ? "" : "s"
    } from the community database${this._capExpLoading ? " (refreshing…)" : ""}`;

    const stripCountEl = this._q("#capexp-strip-count");
    if (stripCountEl) {
      const uniqueDevices = new Set(this._capExpIndex.map((e) => `${e.manufacturer_slug}|${e.model_slug}`));
      stripCountEl.textContent = uniqueDevices.size;
    }

    // Community heartbeat (formerly "Interesting so far") — real feedback
    // was that leading with a fact like "newest contribution: X on firmware
    // Y" doesn't read as interesting to someone who just wants to know
    // whether a relay they're considering can do what they need; it's an
    // artifact of how this was computed, not a message aimed at the
    // reader. The lead sentence below always renders (framing this as a
    // living, community-built resource, not a random-fact generator);
    // the specific conservatively-gated highlights (see
    // interestingDiscoveries' own doc comment for why there's no
    // percentage/ratio claim in here) still follow underneath when there
    // are any worth showing, same "quietly omit, never show a hedge"
    // pattern as elsewhere in this tab.
    const discoveriesEl = this._q("#capexp-discoveries");
    if (discoveriesEl) {
      // Cached on the instance so _renderCapExpExplore can look up whether
      // any one device card happens to be the subject of a discovery
      // (see discoveryForDevice) without recomputing this over the whole
      // index once per card.
      const discoveries = interestingDiscoveries(this._capExpIndex);
      this._capExpDiscoveries = discoveries;
      discoveriesEl.innerHTML = `<div class="capexp-discoveries">
             <div class="capexp-discoveries-label">Community heartbeat</div>
             <p class="capexp-discoveries-lead">This dataset is entirely community-built. Every scan shared by the
               community adds real evidence for others deciding whether to buy or configure a device.</p>
             ${
               discoveries.length
                 ? `<ul class="capexp-discoveries-list">${discoveries
                     .map((d) => `<li>${escapeHtml(d.text)}</li>`)
                     .join("")}</ul>`
                 : ""
             }
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
        const epScan = ((entry.scan.endpoints) || []).find((e) => Number(e.id) === ep);
        const identity = epScan && this._extractIdentity(epScan);
        if (identity && identity.sw_build_id) return identity.sw_build_id;
      }
    }
    const reg = this._haDeviceRegistryEntry(device.ieee);
    return (reg && reg.sw_version) || null;
  }

  _capExpFormatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
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
      return `<span class="capexp-trust-stars capexp-trust-conflict" title="Community confidence: the community's own scans disagree with each other for this device — see Technical evidence below">⚠ Conflicting</span>`;
    }
    const filled = "★".repeat(rating.stars);
    const empty = "☆".repeat(5 - rating.stars);
    return `<span class="capexp-trust-stars" title="Community confidence: ${rating.stars}/5, based on ${
      rating.totalScans
    } scan${rating.totalScans === 1 ? "" : "s"}">${filled}${empty}</span>`;
  }

  // Shared by Explore My Devices and Find a Device — one compact
  // "Community confidence" panel (star rating + firmware/observation
  // counts + last confirmed) instead of duplicating this markup per mode.
  _capExpTrustPanelHtml(rating, fwCount, fwLabel, totalScans, lastSeen) {
    return `<div class="capexp-trust-panel">
      ${this._capExpStarsHtml(rating)}
      <div class="capexp-trust-text">
        <span class="capexp-trust-label">Community confidence</span>
        <span class="capexp-evidence-tag" title="Evidence level: this is based on what the device itself reported during a scan. Community-observed, function-verified and integration-confirmed evidence aren't tracked yet — this is the only evidence tier that exists so far.">Reported by device</span>
        <div class="capexp-trust-detail muted">
          ${fwCount} firmware version${fwCount === 1 ? "" : "s"}${fwLabel ? ` (${escapeHtml(fwLabel)})` : ""} ·
          ${totalScans} observation${totalScans === 1 ? "" : "s"}${
      lastSeen ? ` · last confirmed ${escapeHtml(this._capExpFormatDate(lastSeen))}` : ""
    }
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
      <div class="capexp-goodfor-tags">${goodFor
        .map(
          (t) =>
            `<span class="capexp-tag capexp-goodfor-tag"${
              t.exactFirmware
                ? ""
                : ` title="Reported on a different firmware than ${possessive} — likely still applies, but not confirmed on that exact version."`
            }>${escapeHtml(t.label)}${t.exactFirmware ? "" : " *"}</span>`
        )
        .join("")}</div>
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
      const mfrLabel = manufacturer
        ? isGenericTuyaManufacturer(manufacturer) ? GENERIC_TUYA_LABEL : manufacturer
        : "Manufacturer";
      links.push({ label: mfrLabel, url: references.manufacturer.url });
    }
    if (!links.length) return "";
    const linksHtml = links.map(
      (l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)} ↗</a>`
    ).join(" · ");
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
    return canControl
      ? `<span class="capexp-badge capexp-badge-output" title="This card calls this an Output capability: the device's own Zigbee signature declares that it can send this command directly to another device. That's a declaration, not an independently tested behavior — accurate for the large majority of devices, but occasionally a device declares more than its hardware actually uses.">Can control other devices (Output)</span>`
      : `<span class="capexp-badge capexp-badge-input" title="This card calls this Input only: this device can only receive this command — it has no declared way to send it to another device.">Can't control other devices (Input only)</span>`;
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
      directly to another device over a Zigbee bind — without Home Assistant involved. That's the device's own
      declaration rather than an independently tested behavior: accurate for the large majority of devices, but
      occasionally a device declares a capability its hardware doesn't actually use. <strong>Input only</strong>
      means this device can only receive the command itself; it has no declared way to send it onward to control
      something else.
      <a href="${CAPEXP_CLUSTERS_URL}" target="_blank" rel="noopener noreferrer">What does this mean for each specific cluster? ↗</a>
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
    const text = sentences
      .map((s) => {
        if (s.kind === "control") return `${this._capExpOverviewControlBadgeHtml(true)} ${escapeHtml(s.text)}`;
        if (s.kind === "not-control") return `${this._capExpOverviewControlBadgeHtml(false)} ${escapeHtml(s.text)}`;
        return escapeHtml(s.text);
      })
      .join(" ");
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
      independently tested — it holds for the large majority of devices, but occasionally a device declares a
      capability its hardware doesn't actually use. Most switches and dimmers — even ones with a physical button —
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
    // Split off reports-only clusters this card can't put a real name to
    // (raw "Cluster 0xNNNN" fallback) — giving each of those its own bold
    // heading with nothing under it reads as broken, not informative.
    // They're combined into one honest summary line instead, rather than
    // hidden outright (see groupCapabilitiesByOutcome). An unscanned
    // output-only cluster is exempt from that merge even when
    // unidentified — "this device might control something over an
    // undocumented cluster" is worth its own line, not folded into a
    // "reports on N clusters" summary that would be describing the wrong
    // thing entirely.
    const shown = capGroups.filter((g) => g.identified || !g.reportsOnly || g.unscanned);
    const unidentifiedEmpty = capGroups.filter((g) => !g.identified && g.reportsOnly && !g.unscanned);
    const groupsHtml = shown
      .map(
        (g) => `
        <div class="capexp-cap-group">
          <span class="capexp-cap-group-label">${escapeHtml(g.label)}</span>
          ${this._capExpRoleBadgeHtml(g.role)}
          ${
            g.items.length
              ? `<div class="capexp-cap-tags">${g.items
                  .map(
                    (i) =>
                      `<span class="capexp-tag${
                        i.firmwareDependent ? " capexp-tag-fwdep" : ""
                      }">${escapeHtml(i.name)}${
                        i.firmwareDependent ? " · firmware-dependent" : ""
                      }</span>`
                  )
                  .join("")}</div>`
              : g.unscanned
              ? `<div class="capexp-cap-reportsonly hint">Declared as an output cluster — this device can potentially control another device with it, but this project's scans don't discover specific output-side commands.</div>`
              : `<div class="capexp-cap-reportsonly hint">Reports data on this cluster — no commands to send.</div>`
          }
        </div>`
      )
      .join("");
    const unidentifiedHtml = unidentifiedEmpty.length
      ? `<div class="capexp-cap-group capexp-cap-group-unidentified">
           <span class="capexp-cap-group-label">Other reported clusters</span>
           <div class="capexp-cap-reportsonly hint">Also reports on ${
             unidentifiedEmpty.length
           } manufacturer-specific cluster${unidentifiedEmpty.length === 1 ? "" : "s"} this card
             can't yet put a name to (${unidentifiedEmpty
               .map((g) => escapeHtml(g.clusterId))
               .join(", ")}) — no commands confirmed on any of them.</div>
         </div>`
      : "";
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

    const matchedHtml = matches.length
      ? matches
          .map((m) => {
            const key = `${m.manufacturerSlug}|${m.modelSlug}`;
            const expanded = this._capExpExpanded.has(key);
            const fw = firmwareVersions(m.entries);
            const fwLabel = fw.length ? fw.map((f) => (f === null ? "unknown" : f)).join(", ") : "unknown";
            const totalScans = m.entries.reduce((sum, e) => sum + (e.scan_count || 0), 0);

            // "Supports" = every confirmed command, grouped under a plain-
            // English outcome heading per cluster (see
            // groupCapabilitiesByOutcome) instead of one flat alphabetical
            // tag wall mixing e.g. color and lock commands together —
            // that's the "Capability Outcomes" piece of the PRD. A cluster
            // with no confirmed commands (sensor/reporting clusters like
            // Occupancy) still gets its own group with no items — the
            // group label itself is the capability.
            const capGroups = groupCapabilitiesByOutcome(m.entries);
            const reports = m.entries.some((entry) => reportsState(entry));

            const lastSeenTimes = m.entries.map((e) => e.last_seen).filter(Boolean).sort();
            const lastSeen = lastSeenTimes.length ? lastSeenTimes[lastSeenTimes.length - 1] : null;

            // One compact trust rating for the whole device (every
            // firmware entry combined) instead of a confidence badge in
            // the header plus a separate scan-count summary line plus a
            // separate discovery note — real feedback specifically asked
            // for these to consolidate into one panel that answers "how
            // mature is the evidence, how much should I trust it" at a
            // glance. See confidenceStars' own doc comment for why
            // conflicting evidence gets its own callout instead of a
            // lower star count.
            const rating = confidenceStars(m.entries);

            const localFirmware = this._capExpLocalFirmwareFor(m.device);
            const gap = localFirmware ? newestFirmwareGap(localFirmware, m.entries) : null;

            // Connects this card to the global Interesting Discoveries
            // panel when it happens to be the device one of those
            // highlights is about — real feedback was that the panel felt
            // trivial precisely because its facts never touched anything
            // the reader actually owned; this makes that link concrete
            // instead of leaving two disconnected panels.
            const discoveryNote = discoveryForDevice(
              this._capExpDiscoveries || [],
              m.manufacturerSlug,
              m.modelSlug
            );

            // "Good for" (the most-requested item from real feedback):
            // short, plain-English use-case tags derived from confirmed
            // cluster+command evidence for this model across every
            // firmware on file — see useCaseTags' own doc comment for why
            // the evidence bar is "same model, any firmware" rather than
            // this exact device's exact firmware. A tag whose only
            // confirming evidence came from a different firmware than this
            // device's own still shows (real evidence, not a guess) but
            // gets a small caveat marker rather than reading as fully
            // verified for this exact unit.
            const goodFor = useCaseTags(m.entries, localFirmware);

            // Capability Outcomes — every confirmed command grouped under
            // a plain-English outcome heading per cluster (see
            // groupCapabilitiesByOutcome), plus the raw per-firmware
            // endpoint breakdown. Computed here but rendered only inside
            // the "Technical evidence" disclosure below: real feedback
            // was that this protocol-level detail (clusters, commands,
            // endpoint evidence) should explain why the summary above is
            // true, not compete with it for the first few seconds of
            // attention — the summary (name, Community confidence, Good
            // for) is what answers "is this the device I'm looking for."
            const capabilitiesHtml = this._capExpCapabilitiesHtml(capGroups);
            const references = (m.entries[0] && m.entries[0].references) || null;

            return `
              <div class="capexp-device-card">
                <div class="capexp-device-top">
                  ${this._capExpDevicePhotoHtml(m.device.model, m.device.manufacturer)}
                  <div class="capexp-device-main">
                    <div class="capexp-device-header">
                      <span class="capexp-device-name">${escapeHtml(manufacturerDisplayLabel(m.device.manufacturer))} ${escapeHtml(
              m.device.model || "—"
            )}</span>
                      ${
                        // Only show the entity's own name as a secondary line
                        // when there actually is one — this database is about
                        // products, not entity names, so a manufacturer/model
                        // repeated twice (the _deviceLabel() fallback when no
                        // custom name exists) would just be noise.
                        m.device.user_given_name || m.device.name
                          ? `<span class="muted">${escapeHtml(m.device.user_given_name || m.device.name)}</span>`
                          : ""
                      }
                      <a class="capexp-website-link" href="${escapeHtml(this._capExpWebsiteUrl(m.device.manufacturer, m.device.model))}" target="_blank" rel="noopener noreferrer">View on website ↗</a>
                    </div>
                    ${this._capExpTrustPanelHtml(rating, fw.length, fwLabel, totalScans, lastSeen)}
                  </div>
                </div>
                ${this._capExpDeviceOverviewHtml(m.entries)}
                ${this._capExpExternalReferencesHtml(references, m.device.manufacturer)}
                ${
                  discoveryNote
                    ? `<div class="capexp-discovery-note">${escapeHtml(discoveryNote.cardNote)}</div>`
                    : ""
                }
                ${this._capExpGoodForHtml(goodFor, "yours")}
                <div class="capexp-report-line muted">${
                  reports
                    ? "Reports its state back automatically — no need to poll it to see changes."
                    : "Doesn't automatically report state changes — Home Assistant may need to poll it."
                }</div>
                ${
                  gap
                    ? `<div class="capexp-fwgap-alert">Your device is on ${escapeHtml(
                        localFirmware
                      )}. The community has also confirmed ${escapeHtml(
                        gap.newestFirmware
                      )} for this model${
                        gap.diff && gap.diff.length ? `, which ${this._capExpFwGapSummary(gap.diff)}` : ""
                      }. Nobody's scanned anything newer yet — share a scan if you are.</div>`
                    : ""
                }
                <div class="capexp-techtoggle" data-capexp-toggle="${escapeHtml(key)}">
                  Technical evidence <span class="capexp-chevron-inline">${expanded ? "▾" : "▸"}</span>
                </div>
                ${
                  expanded
                    ? `<div class="capexp-tech-panel">${capabilitiesHtml}${this._capExpDeviceDetailHtml(
                        m.entries
                      )}</div>`
                    : ""
                }
              </div>`;
          })
          .join("")
      : `<p class="muted">None of your devices match anything in the community database yet.</p>`;

    const noMatchHtml = noMatch.length
      ? `
        <div class="capexp-section-title">No community data yet (${noMatch.length})</div>
        <p class="hint">Scan one of these and share the result — you'd be the first confirmed data point for it.</p>
        <div class="capexp-nomatch-list">
          ${noMatch
            .map(
              (d) => `
            <div class="capexp-nomatch-row">
              <span>${escapeHtml(this._deviceLabel(d))} <span class="muted">(${escapeHtml(
                d.manufacturer || "—"
              )} · ${escapeHtml(d.model || "—")})</span></span>
              <button class="btn btn-small capexp-scan-btn" data-ieee="${escapeHtml(d.ieee)}">Scan and share</button>
            </div>`
            )
            .join("")}
        </div>`
      : "";

    bodyEl.innerHTML = `
      <div class="capexp-section-title">Devices with confirmed capabilities (${matches.length})</div>
      <div class="capexp-device-list">${matchedHtml}</div>
      ${noMatchHtml}`;

    // Toggle target is its own "Technical evidence" row now, not the
    // device header — the header used to double as both "what device is
    // this" and "click here to see raw protocol data", which stopped
    // making sense once the header no longer previews any of that detail
    // (see the summary-first restructure above).
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
        ${entries
          .map((entry) => {
            const cmds = confirmedCommands(entry);
            return `
              <div class="capexp-entry">
                <div class="capexp-entry-title">Endpoint ${entry.endpoint ?? "?"} · firmware ${escapeHtml(
              entry.firmware || "unknown"
            )} · ${entry.scan_count || 0} scan${(entry.scan_count || 0) === 1 ? "" : "s"}</div>
                ${
                  cmds.length
                    ? `<div class="capexp-cap-tags">${cmds
                        .map(
                          (c) =>
                            `<span class="capexp-tag${c.conflicting ? " capexp-tag-conflict" : ""}">${escapeHtml(
                              c.name
                            )}${c.conflicting ? " ⚠" : ""}</span>`
                        )
                        .join("")}</div>`
                    : `<p class="muted">No confirmed commands.</p>`
                }
              </div>`;
          })
          .join("")}
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
    const set = new Set();
    if (field === "manufacturer") {
      let hasGenericTuya = false;
      idx.forEach((e) => {
        if (!e.manufacturer) return;
        if (isGenericTuyaManufacturer(e.manufacturer)) hasGenericTuya = true;
        else set.add(e.manufacturer);
      });
      // One "Generic Tuya" entry stands in for every _TZ.../_TY... code so
      // the dropdown isn't dominated by strings nobody recognizes — see
      // _capExpRunSearch() for how selecting it expands back to all of
      // them. Mirrors docs/app.js's facetValues() in zigbee-capabilities.
      if (hasGenericTuya) set.add(GENERIC_TUYA_LABEL);
    } else if (field === "model") idx.forEach((e) => e.model && set.add(e.model));
    else if (field === "firmware") idx.forEach((e) => set.add(e.firmware || "unknown"));
    else if (field === "cluster") {
      idx.forEach((e) => Object.values(e.clusters || {}).forEach((c) => c.name && set.add(c.name)));
    } else if (field === "command") {
      idx.forEach((e) =>
        Object.values(e.clusters || {}).forEach((c) =>
          (c.commands_received || []).forEach((row) => {
            if (row.present === true && row.name) set.add(row.name);
          })
        )
      );
    } else if (field === "attribute") {
      idx.forEach((e) =>
        Object.values(e.clusters || {}).forEach((c) =>
          (c.attributes_confirmed || []).forEach((a) => {
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
          { label: "Color control", field: "cluster", value: resolve("color") },
        ],
      },
      {
        category: "Sensors",
        examples: [
          { label: "Motion / occupancy sensing", field: "cluster", value: resolve("occupancy") },
          { label: "Reports illuminance", field: "cluster", value: resolve("illuminance") },
          { label: "Security / contact sensing (IAS Zone)", field: "cluster", value: resolve("ias zone") },
          { label: "Temperature monitoring", field: "cluster", value: resolve("temperature") },
          { label: "Humidity monitoring", field: "cluster", value: resolve("humidity") },
          { label: "Energy monitoring", field: "cluster", value: resolve("metering") },
        ],
      },
      {
        category: "Networking",
        examples: [
          { label: "Group control", field: "cluster", value: resolve("groups") },
          { label: "OTA support", field: "cluster", value: resolve("ota") },
        ],
      },
    ];
    return groups.map((g) => ({ ...g, examples: g.examples.filter((ex) => ex.value) })).filter((g) => g.examples.length);
  }

  _capExpSearchSelectHtml(field, placeholder) {
    const s = this._capExpSearch;
    const opts = this._capExpFacetValues(field);
    return `<select id="capexp-s-${field}" data-field="${field}">
        <option value="">${escapeHtml(placeholder)}</option>
        ${opts
          .map(
            (v) =>
              `<option value="${escapeHtml(v)}" ${s[field] === v ? "selected" : ""}>${escapeHtml(v)}</option>`
          )
          .join("")}
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
      ${groups
        .map(
          (g) => `
        <div class="capexp-search-example-group">
          <div class="capexp-search-example-category">${escapeHtml(g.category)}</div>
          <div class="capexp-search-examples">
            ${g.examples
              .map(
                (ex) =>
                  `<button type="button" class="chip capexp-search-example" data-field="${escapeHtml(
                    ex.field
                  )}" data-value="${escapeHtml(ex.value)}">${escapeHtml(ex.label)}</button>`
              )
              .join("")}
          </div>
        </div>`
        )
        .join("")}
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
          [btn.dataset.field]: btn.dataset.value,
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
    // "Generic Tuya" isn't a real manufacturer string any entry actually
    // has, so it can't go through searchIndex()'s own (shared, untouched)
    // substring match — ask it for everything else, then expand the
    // sentinel back out to every _TZ/_TY entry here instead. Mirrors
    // docs/app.js's runSearch() in zigbee-capabilities.
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
        <p class="muted">This does not necessarily mean the capability is unsupported — it simply means nobody
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
      countEl.textContent =
        devices.length > 100
          ? `Showing the top 100 of ${devices.length} matching devices, ranked by community confidence — narrow your search to see more.`
          : `${devices.length} matching device${devices.length === 1 ? "" : "s"}, ranked by community confidence`;
    }

    resultsEl.innerHTML = shown
      .map((r) => {
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
          r.model || "—"
        )}</span>
                  <a class="capexp-website-link" href="${escapeHtml(this._capExpWebsiteUrl(r.manufacturer, r.model))}" target="_blank" rel="noopener noreferrer">View on website ↗</a>
                </div>
                ${this._capExpTrustPanelHtml(r.rating, r.firmwareCount, null, r.totalScans, r.lastSeen)}
              </div>
            </div>
            ${this._capExpDeviceOverviewHtml(r.entries)}
            ${this._capExpExternalReferencesHtml(r.references, r.manufacturer)}
            ${this._capExpGoodForHtml(r.goodFor, "this record's")}
            <div class="capexp-techtoggle" data-capexp-toggle="${escapeHtml(key)}">
              ${expanded ? "Hide capabilities" : "View capabilities"}
              <span class="capexp-chevron-inline">${expanded ? "▾" : "→"}</span>
            </div>
            ${
              expanded
                ? `<div class="capexp-tech-panel">${this._capExpCapabilitiesHtml(
                    capGroups
                  )}${this._capExpDeviceDetailHtml(r.entries)}</div>`
                : ""
            }
          </div>`;
      })
      .join("");

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
    const modelsForManufacturer = c.manufacturer
      ? [
          ...new Set(
            this._capExpIndex.filter((e) => e.manufacturer === c.manufacturer).map((e) => e.model).filter(Boolean)
          ),
        ].sort()
      : [];
    const entriesForModel =
      c.manufacturer && c.model
        ? this._capExpIndex.filter((e) => e.manufacturer === c.manufacturer && e.model === c.model)
        : [];
    const fwOptions = firmwareVersions(entriesForModel).map((f) => (f === null ? "unknown" : f));

    const pickEntry = (fw) =>
      entriesForModel
        .filter((e) => (e.firmware || "unknown") === fw)
        .sort((a, b) => Object.keys(b.clusters || {}).length - Object.keys(a.clusters || {}).length)[0];

    const entryA = c.firmwareA ? pickEntry(c.firmwareA) : null;
    const entryB = c.firmwareB ? pickEntry(c.firmwareB) : null;

    let diffHtml = `<p class="muted">Pick a manufacturer, model, and two firmware versions to compare.</p>`;
    if (entryA && entryB) {
      if (c.firmwareA === c.firmwareB) {
        diffHtml = `<p class="muted">Pick two different firmware versions to compare.</p>`;
      } else {
        const diff = diffFirmware(entryA, entryB);
        diffHtml = diff.length
          ? diff
              .map((row) => {
                if (row.onlyIn) {
                  return `<div class="capexp-diff-row"><strong>${escapeHtml(
                    row.name
                  )}</strong> — cluster only confirmed on firmware ${
                    row.onlyIn === "A" ? escapeHtml(c.firmwareA) : escapeHtml(c.firmwareB)
                  }, not scanned on the other.</div>`;
                }
                const parts = [];
                if (row.addedCommands.length) parts.push(`+ ${row.addedCommands.map((n) => escapeHtml(n)).join(", ")}`);
                if (row.removedCommands.length)
                  parts.push(`− ${row.removedCommands.map((n) => escapeHtml(n)).join(", ")}`);
                row.attributeChanges.forEach((a) =>
                  parts.push(`${a.change === "added" ? "+attr " : "−attr "}${escapeHtml(a.name)}`)
                );
                return `<div class="capexp-diff-row"><strong>${escapeHtml(row.name)}</strong> — ${parts.join(
                  " · "
                )}</div>`;
              })
              .join("")
          : `<p class="muted">No confirmed differences between these two firmware versions.</p>`;
      }
    }

    bodyEl.innerHTML = `
      <p class="hint" style="margin-top:0">Pick a manufacturer, model, and two firmware versions the community has
        confirmed, to see exactly what changed between them.</p>
      <div class="capexp-compare-form">
        <label>Manufacturer
          <select id="capexp-c-manufacturer">
            <option value="">— choose —</option>
            ${manufacturers
              .map((m) => `<option value="${escapeHtml(m)}" ${m === c.manufacturer ? "selected" : ""}>${escapeHtml(m)}</option>`)
              .join("")}
          </select>
        </label>
        <label>Model
          <select id="capexp-c-model" ${modelsForManufacturer.length ? "" : "disabled"}>
            <option value="">— choose —</option>
            ${modelsForManufacturer
              .map((m) => `<option value="${escapeHtml(m)}" ${m === c.model ? "selected" : ""}>${escapeHtml(m)}</option>`)
              .join("")}
          </select>
        </label>
        <label>Firmware A
          <select id="capexp-c-fwa" ${fwOptions.length ? "" : "disabled"}>
            <option value="">— choose —</option>
            ${fwOptions
              .map((f) => `<option value="${escapeHtml(f)}" ${f === c.firmwareA ? "selected" : ""}>${escapeHtml(f)}</option>`)
              .join("")}
          </select>
        </label>
        <label>Firmware B
          <select id="capexp-c-fwb" ${fwOptions.length ? "" : "disabled"}>
            <option value="">— choose —</option>
            ${fwOptions
              .map((f) => `<option value="${escapeHtml(f)}" ${f === c.firmwareB ? "selected" : ""}>${escapeHtml(f)}</option>`)
              .join("")}
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
            does it step by step with <strong>New group for a remote…</strong>, including creating the group.</p>
          <p class="muted">Direct access to <code>zha_toolkit.bind_ieee</code> / <code>binds_remove_all</code> /
            <code>bind_group</code> for edge cases (specific endpoints, clusters not auto-detected, etc).</p>
          <label>Source device
            <select id="adv-source"></select>
          </label>
          <label>Source endpoint
            <select id="adv-src-ep"><option value="">Loading…</option></select>
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
            <select id="adv-dst-ep"><option value="">Loading…</option></select>
          </label>
          <label>Cluster
            <select id="adv-cluster"><option value="">— zha-toolkit default —</option></select>
          </label>
          <p id="adv-group-support" class="hint adv-group-support" style="display:none"></p>
          <label id="adv-cluster-custom-wrap" style="display:none">Custom cluster ID
            <input type="text" id="adv-cluster-custom" placeholder="e.g. 0x0000 or 0">
          </label>
          <p id="adv-cluster-custom-hint" class="hint" style="display:none">Expert option. Most devices don't
            expose this cluster for binding, that's why it's not in the list above — an accepted bind doesn't
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
      this._setStatus("info", "Binding…", 0);
      // Group targets have no device IEEE of their own to rescan; coordinator
      // and device targets do — resolve it up front so the finally block can
      // rescan both ends regardless of how the bind call turns out.
      let targetIeeeForRescan = null;
      if (type === "coordinator") targetIeeeForRescan = this._coordinatorIeee();
      else if (type === "device") targetIeeeForRescan = this._q("#adv-target-device").value;
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
        // Rescan regardless of outcome — see v0.8.2 diagnosis: a failure here
        // often just means the cache was already stale, so refreshing both
        // ends clears phantom entries instead of leaving a confusing error.
        const scan = await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan), {
          tries: this._retryCount,
        });
        this._advRenderSourceBindings();
        this._advRenderTargetBindings();
        const sourceRead = scan.read.has(normIeee(sourceIeee));

        // Precise verification only makes sense when exactly one cluster and
        // a complete target (endpoint included) were specified — otherwise
        // ("bind default clusters", or a target endpoint zha_toolkit picked
        // on its own) we don't know exactly what to check, so fall back to
        // relaying zha_toolkit's own report instead of guessing.
        const bindTarget =
          type === "group"
            ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) }
            : { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint };
        const canVerify =
          clusters.length === 1 && opts.endpoint != null && (bindTarget.isGroup || bindTarget.endpoint != null);
        if (canVerify) {
          const res = this._settleChange(
            "bind",
            { sourceIeee, sourceEndpoint: opts.endpoint, clusterId: clusters[0], target: bindTarget },
            scan
          );
          // A confirmed group binding that nothing in the group can use is
          // worth saying out loud, not just in the hint above the button.
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
          this._setStatus(res.level, res.message, res.level === "success" ? undefined : 0, res.action);
        } else if (!callErr && !sourceRead) {
          this._setStatus(
            "warning",
            `Bind command sent, but ${this._ieeeLabel(sourceIeee, { plain: true })} didn't answer the check, so the table may not show it yet. Wake the device and rescan it.`,
            0
          );
        } else {
          this._setStatus(
            callErr ? "error" : "success",
            callErr ? callErr.message || String(callErr) : "Bind command sent.",
            callErr ? 0 : undefined
          );
        }
      }
    });

    this._q("#adv-unbind").addEventListener("click", async () => {
      const sourceIeee = this._q("#adv-source").value;
      const type = this._q("#adv-target-type").value;
      const clusters = getClusterIds();
      const opts = getOpts();
      this._setStatus("info", "Unbinding…", 0);
      let targetIeeeForRescan = null;
      if (type === "coordinator") targetIeeeForRescan = sourceIeee; // no separate device to add
      else if (type === "device") targetIeeeForRescan = this._q("#adv-target-device").value;

      // Capture "before" state ahead of the call so the finally block can
      // verify what actually changed, instead of trusting zha_toolkit's own
      // report (see v0.8.2 diagnosis). Coordinator unbind is a bulk op — it
      // can hit every cluster bound to the coordinator on this endpoint if
      // no single cluster was chosen — so its "before" is a list, not one
      // binding.
      const coord = this._coordinatorIeee();
      const beforeCoordList =
        type === "coordinator"
          ? this._rawBindings()
              .filter(
                (b) =>
                  normIeee(b.sourceIeee) === normIeee(sourceIeee) &&
                  !b.isGroup &&
                  normIeee(b.targetIeee) === normIeee(coord) &&
                  (opts.endpoint == null || Number(b.sourceEndpoint) === Number(opts.endpoint)) &&
                  (clusters.length === 0 || clusters.includes(b.clusterId))
              )
              .map((b) => ({
                clusterId: b.clusterId,
                target: { isGroup: false, ieee: b.targetIeee, endpoint: b.targetEndpoint },
              }))
          : null;
      const bindTarget =
        type === "group"
          ? { isGroup: true, groupId: Number(this._q("#adv-target-group").value) }
          : type === "device"
          ? { isGroup: false, ieee: targetIeeeForRescan, endpoint: opts.dstEndpoint }
          : null;
      const before =
        bindTarget && clusters.length === 1 && opts.endpoint != null && (bindTarget.isGroup || bindTarget.endpoint != null)
          ? this._bindingPresent(sourceIeee, opts.endpoint, clusters[0], bindTarget)
          : null;

      let callErr = null;
      try {
        if (type === "group") {
          const groupId = Number(this._q("#adv-target-group").value);
          await this._api.unbindGroup(sourceIeee, groupId, clusters, opts);
        } else if (type === "coordinator") {
          await this._api.callToolkit("unbind_coordinator", {
            ieee: sourceIeee,
            ...(clusters.length ? { cluster: clusters } : {}),
          });
        } else {
          await this._api.unbindIeee(sourceIeee, targetIeeeForRescan, clusters, opts);
        }
      } catch (err) {
        callErr = err;
        console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
      } finally {
        const scan = await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan), {
          tries: this._retryCount,
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
            this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
          }
        } else if (before !== null) {
          const res = this._settleChange(
            "unbind",
            { sourceIeee, sourceEndpoint: opts.endpoint, clusterId: clusters[0], target: bindTarget },
            scan,
            before
          );
          this._setStatus(res.level, res.message, res.level === "success" ? undefined : 0, res.action);
        } else {
          this._setStatus(
            callErr ? "error" : "success",
            callErr ? callErr.message || String(callErr) : "Unbind command sent.",
            callErr ? 0 : undefined
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
    const sortedDevices = [...this._devices].sort((a, b) =>
      this._deviceLabel(a).localeCompare(this._deviceLabel(b), undefined, { sensitivity: "base" })
    );
    const options = sortedDevices
      .map((d) => `<option value="${d.ieee}">${escapeHtml(this._deviceLabel(d))}</option>`)
      .join("");
    src.innerHTML = options;
    tgtDev.innerHTML = options;
    tgtGroup.innerHTML = [...this._groups]
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
      .map((g) => `<option value="${g.group_id}">${escapeHtml(g.name)} (${g.group_id})</option>`)
      .join("");
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
    // Guard against out-of-order responses: if the source device is changed
    // again (or a pre-fill happens) before this fetch resolves, a stale
    // response must not clobber the newer one's dropdown.
    const reqId = (this._advSourceReqId = (this._advSourceReqId || 0) + 1);
    sel.innerHTML = `<option value="">Loading…</option>`;
    let endpoints = [];
    let failed = false;
    try {
      endpoints = await this._advDeviceEndpoints(ieee);
    } catch (err) {
      failed = true;
    }
    if (reqId !== this._advSourceReqId) return;
    sel.innerHTML = failed
      ? `<option value="">(failed to load)</option>`
      : endpoints.length
      ? endpoints.map((ep) => `<option value="${ep}">${ep}</option>`).join("")
      : `<option value="">(none found)</option>`;
    this._advPopulateClusterOptions();
    this._advRenderSourceBindings();
  }

  async _advPopulateTargetEndpoints() {
    const sel = this._q("#adv-dst-ep");
    const ieee = this._q("#adv-target-device").value;
    if (!sel || !ieee) return;
    const reqId = (this._advTargetReqId = (this._advTargetReqId || 0) + 1);
    sel.innerHTML = `<option value="">Loading…</option>`;
    let endpoints = [];
    let failed = false;
    try {
      endpoints = await this._advDeviceEndpoints(ieee);
    } catch (err) {
      failed = true;
    }
    if (reqId !== this._advTargetReqId) return;
    sel.innerHTML = failed
      ? `<option value="">(failed to load)</option>`
      : endpoints.length
      ? endpoints.map((ep) => `<option value="${ep}">${ep}</option>`).join("")
      : `<option value="">(none found)</option>`;
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
    const opts = [`<option value="">— zha-toolkit default —</option>`]
      .concat(outClusters.map((c) => `<option value="${c.id}">${escapeHtml(clusterName(c.id))} (${hex4(c.id)})</option>`))
      .concat([`<option value="__custom__">Custom cluster ID…</option>`]);
    clusterSel.innerHTML = opts.join("");
    // A custom cluster picked for a different endpoint/device likely doesn't
    // apply here — reset rather than carry stale state across selections.
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
    const reqId = (this._advGroupSupportReq = (this._advGroupSupportReq || 0) + 1);
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
    await Promise.all(toRead.map((m) => this._ensureClusters(m.ieee).catch(() => {})));
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
          btn.textContent = "Scanning…";
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
    wrap.innerHTML =
      this._advBindingRows(rows, "source") +
      `<p class="hint" style="margin-top:6px;">Based on devices scanned so far — run a full scan for complete results.</p>`;
  }

  /** Renders a list of binding rows; `otherEnd` is "target" (for the source panel) or "source" (for the target panel). */
  _advBindingRows(rows, otherEnd) {
    if (!rows.length) return `<p class="advanced-empty">No matching bindings found.</p>`;
    return rows
      .map((b) => {
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
      })
      .join("");
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
      this._setStatus("info", `Source set to ${this._deviceLabel(sourceDevice)} — pick a target below.`);
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
}
