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
  escapeHtml,
  toCsv,
  downloadFile,
} from "./utils.js";
import { bindingMatches } from "./parser.js";
import { ZhaApi } from "./api-client.js";
import { SHELL_HTML } from "./template.js";
import { LocalStorageProvider } from "./storage/local-storage-provider.js";
import { HaStorageProvider } from "./storage/ha-storage-provider.js";
import { STYLE } from "./styles.js";
import {
  slugify,
  fetchCapabilityIndex,
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
export class ZhaBindingMapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._api = null;
    this._config = {};

    this._devices = [];
    this._groups = [];
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
    this._status = null; // {level: 'info'|'error'|'success', text}
    this._scanState = { running: false, done: 0, total: 0 };
    this._selectedEdgeId = null;
    this._loaded = false;
    this._dragCtx = null;
    this._fullscreen = false;
    this._lastScanAt = null; // ISO timestamp of the last time bindings were (re)scanned
    this._tableSourceFilter = null; // ieee — set by clicking a source device in the Bindings table
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
  }
  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
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
    this._backendAvailable = await HaStorageProvider.isAvailable(this._hass);
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
      "ZHA Bindings Manager found a shared storage backend on this Home Assistant instance.\n\n" +
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
        badge.title = "This card's scan data is saved centrally via the ZHA Bindings Manager Backend integration — available from any browser or device.";
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
          ? "Using shared storage: this browser's scan data is saved via the ZHA Bindings Manager Backend integration, so it's the same data in every browser and device that opens this card."
          : "Using this browser's local storage: scan data is only available here, not shared with other browsers or devices.";
    }

    const hint = this._q("#storage-backend-hint");
    if (hint) {
      const show = !this._backendAvailable && !this._loadStorageHintDismissed();
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
        this._bindings = new Map(Object.entries(state.last_complete.bindings));
        this._lastScanAt = state.last_complete.savedAt || null;
      }
      this._scanFailures = new Set(
        (state.latest && state.latest.failures) || []
      );
      this._scanPartial = new Map(
        Object.entries((state.latest && state.latest.partial) || {})
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

  _setStatus(level, text, timeout = 6000) {
    this._status = { level, text };
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
    await this._loadFloorplan();
    await this._loadEndpointAnnotations();
    await this._loadShowDevicePhotos();
    if (this._fpImageUrl) this._loadFpImage(this._fpImageUrl);
    this._setStatus("info", "Loading ZHA devices…", 0);
    try {
      const [devices, groups] = await Promise.all([this._api.fetchDevices(), this._api.fetchGroups()]);
      this._devices = devices
        .filter((d) => !!d.ieee)
        .map((d) => ({ ...d, ieee: normIeee(d.ieee) }));
      this._groups = groups;
      this._loaded = true;
      this._setStatus("success", `Loaded ${this._devices.length} devices, ${this._groups.length} groups.`);
      this._render();
      this._renderFilterChips();
    } catch (err) {
      console.error(err);
      this._setStatus("error", `Failed to load ZHA devices: ${err.message || err}`, 0);
    }
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

  /** Call after the post-action rescan completes. */
  _verifyBindOutcome(sourceIeee, sourceEp, clusterId, target) {
    const after = this._bindingPresent(sourceIeee, sourceEp, clusterId, target);
    return after
      ? { ok: true, message: "Binding confirmed on the device." }
      : { ok: false, message: "Bind failed — this binding is not on the device after rescanning." };
  }

  /** Call after the post-action rescan completes; `before` must have been
   *  captured (via _bindingPresent) prior to the unbind API call. */
  _verifyUnbindOutcome(before, sourceIeee, sourceEp, clusterId, target) {
    const after = this._bindingPresent(sourceIeee, sourceEp, clusterId, target);
    if (!after) {
      return before
        ? { ok: true, message: "Binding confirmed removed." }
        : { ok: true, message: "This binding didn't actually exist on the device — table refreshed." };
    }
    return { ok: false, message: "Unbind failed — this binding is still on the device after rescanning." };
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
    if (this._scanState.running) return;
    const targets = ieeeList && ieeeList.length ? ieeeList : this._devices.map((d) => d.ieee);
    this._scanState = { running: true, done: 0, total: targets.length };
    this._renderStatus();
    let okCount = 0;
    let failCount = 0;
    let partialCount = 0;

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
        if (partial) {
          this._scanPartial.set(normIeee(ieee), { retrieved: retrievedCount, total: totalCount });
          partialCount++;
        } else {
          this._scanPartial.delete(normIeee(ieee));
        }
        okCount++;
      } catch (err) {
        failCount++;
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
    // No args: _scanFailures/_scanPartial already reflect this just-
    // completed run (updated live per device inside scanOne above), so
    // _saveScanState reads current state rather than needing it passed in.
    await this._saveScanState();
    const summary = [`${okCount} device(s) read`];
    if (partialCount) summary.push(`${partialCount} partial (a later page timed out — rescan for the rest)`);
    if (failCount) summary.push(`${failCount} did not respond (sleepy/offline devices are normal)`);
    // timeout: 0 — the final scan summary stays on screen until dismissed
    // (via the × button) rather than auto-hiding after a few seconds, since
    // it's easy to miss if you glance away while a larger scan is running.
    this._setStatus(
      failCount ? "error" : partialCount ? "info" : "success",
      `Scan complete: ${summary.join(", ")}.`,
      0
    );
    this._renderGraph();
    this._renderTable();
    this._renderDevicesTab();
    this._renderStatus();
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
      return raw.filter((b) => b.isGroup || !coord || b.targetIeee !== coord);
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
    if (cls === "reporting") return "edge edge-reporting";
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
    return all.filter((b) => this._classifyBinding(b) !== "reporting");
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
    if (AMBIGUOUS_TUYA_MODELS.includes(d.model)) return null;
    return `https://www.zigbee2mqtt.io/images/devices/${encodeURIComponent(d.model.replace(/\//g, "-"))}.png`;
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
          if (cls === "control") {
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

    // Mirrors Rule 1, for the source side (implied by "source device exists"
    // being an OK condition) — reachable when a device is removed/re-paired
    // after being scanned, since scan results are cached across reloads.
    if (!this._devices.some((d) => normIeee(d.ieee) === sourceIeeeN)) {
      return {
        level: "error",
        code: "source_missing",
        message: "The source device no longer exists.",
        why: "This binding was read from a device that's since been removed or re-paired, so it's leftover data rather than something currently controllable.",
        recommendation: "Remove the binding or recreate it.",
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
          why: "A binding sends commands from the source straight to this target over Zigbee. Since the target no longer exists, those commands go nowhere.",
          recommendation: "Remove the binding or recreate it.",
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
    if (this._view === "capexplorer") this._renderCapabilityExplorer();
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
    this._qa(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    this._render();
  }

  _wireShell() {
    this._qa(".tab").forEach((btn) => {
      btn.addEventListener("click", () => this._switchView(btn.dataset.view));
    });

    this._q("#btn-scan").addEventListener("click", () => this._scanBindings());
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
    el.innerHTML = `<span class="status-text">${escapeHtml(this._status.text)}</span><button type="button" class="status-close" aria-label="Dismiss">×</button>`;
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

  _deviceLabel(d) {
    return d.user_given_name || d.name || d.model || d.ieee;
  }

  /** Display label for a device referenced only by IEEE (a binding's
   *  source/target), falling back to the raw IEEE if it's since left the
   *  network — shared by the exploded view's badge renderers so they don't
   *  each repeat the same find-or-fallback lookup. */
  _targetDeviceLabel(ieee) {
    const d = this._devices.find((x) => x.ieee === ieee);
    return d ? this._deviceLabel(d) : ieee;
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
    this._updateEdgePositions();
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
      "This device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here — click to see the per-endpoint breakdown.";
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
      if (ctx.node.kind === "device") this._openDeviceExplodedView(ctx.node.device);
      return;
    }
    this._savePositions();
    if (ctx.dropTarget) {
      if (ctx.node.kind !== "device") {
        this._setStatus("error", "You can only bind from a device (not a group).");
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
      <p class="hint">This isn't a binding-table entry — it's real ZCL group
        membership, sourced from ZHA's own group data. The member receives
        this group's commands without needing any binding of its own. To
        change group membership, use Home Assistant's own group management
        (Settings &rarr; Devices &amp; Services &rarr; Zigbee Home
        Automation &rarr; Groups) — this card doesn't offer a "remove from
        group" action yet.</p>
      <div class="dialog-actions">
        <button class="btn" id="unbind-cancel">Close</button>
      </div>`;
    this._q("#dialog").classList.add("open");
    this._q("#unbind-cancel").addEventListener("click", () => this._closeDialog());
  }

  _closeDialog() {
    this._q("#dialog").classList.remove("open");
    const panel = this._q(".dialog-panel");
    if (panel) panel.classList.remove("wide");
    this._explodedDeviceIeee = null;
  }

  // -------------------------------------------------------------------
  // Exploded device view dialog — triggered from the Devices tab. Scans the
  // one device on demand (same binds_get + cluster-scan calls the rest of
  // the card already makes against your own HA instance), then renders a
  // per-endpoint breakdown. No external lookups, nothing asked of the user.
  // -------------------------------------------------------------------
  async _openDeviceExplodedView(d) {
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

    this._q("#dialog-title").textContent = this._deviceLabel(d);
    this._q("#dialog-body").innerHTML = `
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
        <button class="btn" id="explode-close">Close</button>
      </div>`;
    this._q("#explode-close").addEventListener("click", () => this._closeDialog());
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
    this._commandScans.set(key, { status: "loading" });
    if (this._q("#dialog").classList.contains("open")) this._renderExplodedView(d);
    // Kick off the community index load in the background too (if it
    // hasn't already been fetched via the Capability Explorer tab), so
    // Compare My Device below has something to compare against as soon as
    // this scan completes rather than showing "Checking…" and needing a
    // second wait.
    if (!this._capExpIndex && !this._capExpLoading) this._capExpLoadIndex();
    try {
      const scan = await this._api.scanDeviceCommands(d.ieee, { endpoint: ep, tries: this._retryCount });
      this._commandScans.set(key, { status: "done", scan });
    } catch (err) {
      this._commandScans.set(key, { status: "error", error: err.message || String(err) });
    }
    if (!this._q("#dialog").classList.contains("open")) return; // closed while scanning
    const fresh = this._devices.find((x) => x.ieee === d.ieee) || d;
    this._renderExplodedView(fresh);
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
        <p class="hint ep-cmd-status">Checking supported commands&hellip; this queries the device directly and can take a while.</p>
        ${wakeHint}`;
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
        const main = `Self-bound${b.targetEndpoint !== ep ? ` (ep ${b.targetEndpoint})` : ""}`;
        badges.push(badge("ep-badge-self", main, clusters));
      }
    );
    this._groupBindingsByKey(rel.controlsDevice, (b) => `${b.targetIeee}:${b.targetEndpoint}`).forEach(
      ({ binding: b, clusters }) => {
        const main = `Controls ${escapeHtml(this._targetDeviceLabel(b.targetIeee))} (ep ${b.targetEndpoint})`;
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
        : `Unclassified binding to ${escapeHtml(this._targetDeviceLabel(b.targetIeee))} (ep ${b.targetEndpoint})`;
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
      unknown:
        "Unknown &mdash; the source device hasn't been cluster-scanned yet, so this can't be classified as control or reporting. Shown either way rather than guessing.",
    }[cls];
    this._q("#dialog-body").innerHTML = `
      <table class="detail-table">
        <tr><td>Source</td><td>${escapeHtml(sourceLabel)} (ep ${binding.sourceEndpoint})</td></tr>
        <tr><td>Target</td><td>${escapeHtml(targetLabel)}${
      binding.isGroup ? "" : ` (ep ${binding.targetEndpoint})`
    }</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
        <tr><td>Type</td><td>${typeText}</td></tr>
      </table>
      <div class="dialog-actions">
        <button class="btn btn-danger" id="unbind-confirm">Remove binding</button>
        <button class="btn" id="unbind-cancel">Close</button>
      </div>`;
    this._q("#dialog").classList.add("open");
    this._q("#unbind-cancel").addEventListener("click", () => this._closeDialog());
    this._q("#unbind-confirm").addEventListener("click", async () => {
      this._closeDialog();
      this._setStatus("info", "Removing binding…", 0);
      const bindTarget = binding.isGroup
        ? { isGroup: true, groupId: binding.groupId }
        : { isGroup: false, ieee: binding.targetIeee, endpoint: binding.targetEndpoint };
      const before = this._bindingPresent(binding.sourceIeee, binding.sourceEndpoint, binding.clusterId, bindTarget);
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
        console.warn("[ZHA Bindings Manager] unbind call raised, verifying against rescan anyway", err);
      } finally {
        await this._scanBindings(rescanTargets);
        const outcome = this._verifyUnbindOutcome(
          before,
          binding.sourceIeee,
          binding.sourceEndpoint,
          binding.clusterId,
          bindTarget
        );
        this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
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

  /** `healthMap` is optional — pass the one _renderTable() already computed
   *  to avoid a redundant pass; callers like _exportRowsData() that don't
   *  have one handy get a freshly-computed one for free. */
  _filteredBindingRows(healthMap) {
    const map = healthMap || this._computeHealthMap();
    const s = this._filters.search;
    return this._allBindings().filter((b) => {
      if (this._tableSourceFilter && b.sourceIeee !== this._tableSourceFilter) return false;
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
      const hay = `${source ? this._deviceLabel(source) : ""} ${
        target ? target.name || this._deviceLabel(target) : ""
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

    const filterInfo = this._q("#table-filter-info");
    if (filterInfo) {
      if (this._tableSourceFilter) {
        const dev = this._devices.find((d) => d.ieee === this._tableSourceFilter);
        const name = dev ? this._deviceLabel(dev) : this._tableSourceFilter;
        filterInfo.innerHTML = `Filtering to bindings sourced from <strong>${escapeHtml(name)}</strong>
          <button class="btn btn-small" id="btn-clear-source-filter">Clear filter</button>
          <button class="btn btn-small btn-primary" id="btn-add-binding-from-filter">+ Add binding</button>`;
        filterInfo.style.display = "flex";
        this._q("#btn-clear-source-filter").addEventListener("click", () => {
          this._tableSourceFilter = null;
          this._renderTable();
        });
        this._q("#btn-add-binding-from-filter").addEventListener("click", () => this._openAddBindingFromFilter());
      } else {
        filterInfo.style.display = "none";
      }
    }

    const healthMap = this._computeHealthMap();
    this._renderHealthSummary(healthMap);

    this._updateSortIndicators("#view-table", this._tableSort);

    let rows = this._filteredBindingRows(healthMap).map((b) => {
      const source = this._devices.find((d) => d.ieee === b.sourceIeee);
      const target = b.isGroup
        ? this._groups.find((g) => g.group_id === b.groupId)
        : this._devices.find((d) => d.ieee === b.targetIeee);
      const sourceLabel = source ? this._deviceLabel(source) : b.sourceIeee;
      const targetLabel = b.isGroup
        ? (target && target.name) || `Group ${b.groupId}`
        : target
        ? this._deviceLabel(target)
        : b.targetIeee;
      const typeLabel = source ? this._devicePrimaryType(source) : "—";
      const typeFull = source ? this._deviceTypeTags(source).join(", ") : "";
      const areaLabel = source ? this._areaName(source.area_id) : "—";
      const manModel = source ? [source.manufacturer, source.model].filter(Boolean).join(" / ") || "—" : "—";
      const health = healthMap.get(b.id) || {
        level: "ok",
        code: "ok",
        message: "",
        why: "",
        recommendation: null,
      };
      return {
        binding: b,
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
    rows = this._sortRows(rows, this._tableSort);

    if (!rows.length) {
      wrap.innerHTML = `<tr><td colspan="8" class="muted">No bindings loaded yet. Click "Scan bindings" above.</td></tr>`;
      return;
    }

    wrap.innerHTML = rows
      .map((r) => {
        const b = r.binding;
        const h = r.health;
        return `
        <tr data-id="${b.id}">
          <td><a href="#" class="src-link" data-ieee="${escapeHtml(b.sourceIeee)}">${escapeHtml(
          r.sourceLabel
        )}</a> <span class="muted">(ep ${b.sourceEndpoint})</span></td>
          <td title="${escapeHtml(r.typeFull)}">${escapeHtml(r.typeLabel)}</td>
          <td>${escapeHtml(r.areaLabel)}</td>
          <td>${escapeHtml(r.manModel)}</td>
          <td><span class="dot" style="background:${clusterColor(b.clusterId)}"></span> ${escapeHtml(
          r.clusterLabel
        )}</td>
          <td>${escapeHtml(r.targetLabel)} ${
          b.isGroup ? "(group)" : `<span class="muted">(ep ${b.targetEndpoint})</span>`
        }</td>
          <td><button class="health-badge health-${h.level}" data-health="${b.id}" title="${escapeHtml(
          h.message
        )}">${HEALTH_ICON[h.level]} ${escapeHtml(HEALTH_LABEL[h.level])}</button></td>
          <td><button class="btn btn-small btn-danger" data-unbind="${b.id}">Unbind</button></td>
        </tr>`;
      })
      .join("");

    this._qa("[data-unbind]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const binding = this._allBindings().find((b) => b.id === btn.dataset.unbind);
        if (binding) this._openUnbindPopover(binding);
      });
    });

    this._qa(".src-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        this._tableSourceFilter = el.dataset.ieee;
        this._renderTable();
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
      <span class="health-chip health-ok">${HEALTH_ICON.ok} ${counts.ok} OK</span>
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
        <tr><td>Binding</td><td>${escapeHtml(sourceLabel)} (ep ${binding.sourceEndpoint}) → ${escapeHtml(
      targetLabel
    )}${binding.isGroup ? " (group)" : ` (ep ${binding.targetEndpoint})`}</td></tr>
        <tr><td>Cluster</td><td>${clusterName(binding.clusterId)} (${hex4(binding.clusterId)})</td></tr>
      </table>
      ${detailHtml}
      <div class="dialog-actions">
        ${
          (health.code === "unable_to_verify" || health.code === "partial_scan") && source
            ? `<button class="btn" id="health-detail-rescan" data-ieee="${escapeHtml(source.ieee)}">Rescan now</button>`
            : ""
        }
        <button class="btn" id="health-detail-close">Close</button>
      </div>`;
    this._q("#dialog").classList.add("open");
    this._q("#health-detail-close").addEventListener("click", () => this._closeDialog());
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

  /** "+ Add binding" from a filtered Bindings-tab source device now jumps straight to the
   *  Advanced tab with that device pre-selected as Source, instead of showing a separate
   *  target-picker popup first — see _jumpToAdvancedBind for why the popup was retired. */
  _openAddBindingFromFilter() {
    const sourceIeee = this._tableSourceFilter;
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
        target_name: b.isGroup ? (target && target.name) || `Group ${b.groupId}` : target ? this._deviceLabel(target) : "",
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

  _renderDevicesTab() {
    const wrap = this._q("#devices-table-body");
    if (!wrap) return;
    this._updateSortIndicators("#view-devices", this._devicesSort);
    if (!this._loaded) {
      wrap.innerHTML = `<tr><td colspan="9" class="muted">Loading devices…</td></tr>`;
      return;
    }
    let rows = this._devices.map((d) => {
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
      wrap.innerHTML = `<tr><td colspan="9" class="muted">No devices found.</td></tr>`;
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
          <td><button class="btn btn-small explode-btn" data-ieee="${escapeHtml(
            r.device.ieee
          )}">Explode</button></td>
        </tr>`
      )
      .join("");

    this._qa("#devices-table-body .src-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        this._tableSourceFilter = el.dataset.ieee;
        this._switchView("table");
      });
    });
    this._qa("#devices-table-body .explode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const device = this._devices.find((x) => x.ieee === btn.dataset.ieee);
        if (device) this._openDeviceExplodedView(device);
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
  async _loadFloorplan() {
    try {
      const raw = await this._storage.getItem(this._config.id, "floorplan");
      if (raw) {
        this._fpImageUrl = raw.imageUrl || "";
        this._fpPositions = raw.positions || {};
      }
    } catch (e) {
      /* ignore corrupt cache */
    }
  }
  async _saveFloorplan() {
    await this._storage.setItem(this._config.id, "floorplan", {
      imageUrl: this._fpImageUrl,
      positions: this._fpPositions,
    });
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

  _renderFpUnplacedList() {
    const list = this._q("#fp-unplaced-list");
    if (!list) return;
    if (!this._loaded) {
      list.innerHTML = `<span class="muted">Loading devices…</span>`;
      return;
    }
    const placed = new Set(Object.keys(this._fpPositions));
    const unplaced = this._devices.filter((d) => !placed.has(d.ieee));
    if (!unplaced.length) {
      list.innerHTML = `<span class="muted">All devices placed.</span>`;
      return;
    }
    list.innerHTML = unplaced
      .map((d) => `<div class="fp-chip" data-ieee="${escapeHtml(d.ieee)}">${escapeHtml(this._deviceLabel(d))}</div>`)
      .join("");
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

  // Device photo for a Capability Explorer card — same zigbee2mqtt.io URL
  // derivation and AMBIGUOUS_TUYA_MODELS exclusion as the Exploded view's
  // own _deviceImageUrl (this just calls it), and the same "show device
  // photo" preference (this._showDevicePhotos) rather than a second,
  // separate toggle just for this tab: it's one card-level setting, not a
  // per-view one. Falls back to a generic placeholder box, not the
  // Exploded view's gang-count shape — there's no endpoint/gang context
  // for a bare search-result/index entry the way there is for a real
  // device you've scanned.
  _capExpDevicePhotoHtml(model) {
    if (!this._showDevicePhotos) return "";
    const imgUrl = this._deviceImageUrl({ model });
    if (!imgUrl) return `<div class="capexp-device-photo-fallback" aria-hidden="true"></div>`;
    return `<img src="${escapeHtml(imgUrl)}" alt="" loading="lazy" class="capexp-device-photo"
         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
       <div class="capexp-device-photo-fallback" style="display:none" aria-hidden="true"></div>`;
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
    // hidden outright (see groupCapabilitiesByOutcome).
    const shown = capGroups.filter((g) => g.identified || !g.reportsOnly);
    const unidentifiedEmpty = capGroups.filter((g) => !g.identified && g.reportsOnly);
    const groupsHtml = shown
      .map(
        (g) => `
        <div class="capexp-cap-group">
          <span class="capexp-cap-group-label">${escapeHtml(g.label)}</span>
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
      <div class="capexp-cap-groups">${groupsHtml}${unidentifiedHtml}</div>`;
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
                  ${this._capExpDevicePhotoHtml(m.device.model)}
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
              ${this._capExpDevicePhotoHtml(r.model)}
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

    this._q("#adv-source").addEventListener("change", () => this._advPopulateSourceEndpoints());
    this._q("#adv-src-ep").addEventListener("change", () => {
      this._advPopulateClusterOptions();
      this._advRenderSourceBindings();
    });
    this._q("#adv-target-device").addEventListener("change", () => this._advPopulateTargetEndpoints());
    this._q("#adv-dst-ep").addEventListener("change", () => this._advRenderTargetBindings());
    this._q("#adv-cluster").addEventListener("change", () => this._advUpdateCustomClusterState());
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
        await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan));
        this._advRenderSourceBindings();
        this._advRenderTargetBindings();

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
          const outcome = this._verifyBindOutcome(sourceIeee, opts.endpoint, clusters[0], bindTarget);
          this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
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
        await this._scanBindings(this._impactedIeees(sourceIeee, targetIeeeForRescan));
        this._advRenderSourceBindings();
        this._advRenderTargetBindings();

        if (type === "coordinator") {
          const outcome = this._verifyCoordinatorUnbindOutcome(beforeCoordList, sourceIeee, opts.endpoint);
          this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
        } else if (before !== null) {
          const outcome = this._verifyUnbindOutcome(before, sourceIeee, opts.endpoint, clusters[0], bindTarget);
          this._setStatus(outcome.ok ? "success" : "error", outcome.message, outcome.ok ? undefined : 0);
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

  /** Cluster dropdown = EVERY cluster the selected source endpoint declares
   *  (both "in" and "out"), plus any cluster already used by a real binding
   *  sourced from this endpoint even if it isn't declared at all, plus a
   *  "Custom cluster ID…" escape hatch for the rare case where neither
   *  applies (e.g. an IKEA controller's genBasic/0x0000 group-binding trick).
   *
   *  Used to filter to "out" only, on the theory that only a declared
   *  client cluster can be a bind source. That's the spec-book answer, but
   *  it doesn't hold on real hardware: zha_toolkit's bind_ieee, like most
   *  ZDO Bind_req implementations, doesn't require the source to have
   *  declared a cluster as "out" before writing a binding table entry for
   *  it — it only needs the coordinator to reach the device. Confirmed
   *  against a Repenic RD-250ZG, which has working bindings on On/Off and
   *  Level Control despite never declaring either as "out" — the "out"-only
   *  filter hid both, and a later attempt to key the list off "is there
   *  currently a binding for this cluster" instead was worse: the option
   *  disappeared the instant that exact binding was removed to test
   *  something, even though the device obviously still has the cluster.
   *  The only thing users actually need is "what clusters does this
   *  endpoint have" — so that's what this lists now, unconditionally;
   *  declared-"in"-only clusters get a note since they're less likely to
   *  actually generate outbound commands, but they're never hidden.
   *  See _advUpdateCustomClusterState(). */
  _advPopulateClusterOptions() {
    const clusterSel = this._q("#adv-cluster");
    const ieee = this._q("#adv-source").value;
    const ep = Number(this._q("#adv-src-ep").value);
    if (!clusterSel) return;
    const clusters = this._clusterCache.get(ieee) || [];
    const epClusters = clusters.filter((c) => c.endpoint_id === ep);
    const outIds = new Set(epClusters.filter((c) => c.type === "out").map((c) => c.id));
    const inIds = new Set(epClusters.filter((c) => c.type === "in").map((c) => c.id));
    const boundIds = new Set(
      (this._bindings.get(normIeee(ieee)) || [])
        .filter((b) => Number(b.sourceEndpoint) === ep)
        .map((b) => b.clusterId)
    );
    const allIds = [...new Set([...outIds, ...inIds, ...boundIds])].sort((a, b) => a - b);
    const noteFor = (id) => {
      if (outIds.has(id)) return "";
      if (inIds.has(id)) return " — input/reporting cluster, may not support commands";
      return " — already bound here";
    };
    const opts = [`<option value="">— zha-toolkit default —</option>`]
      .concat(
        allIds.map(
          (id) => `<option value="${id}">${escapeHtml(clusterName(id))} (${hex4(id)})${noteFor(id)}</option>`
        )
      )
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
            label = `${escapeHtml(d ? this._deviceLabel(d) : b.targetIeee)} <span class="muted">(ep ${b.targetEndpoint})</span>`;
          }
        } else {
          const d = this._devices.find((dv) => dv.ieee === b.sourceIeee);
          label = `${escapeHtml(d ? this._deviceLabel(d) : b.sourceIeee)} <span class="muted">(ep ${b.sourceEndpoint})</span>`;
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
