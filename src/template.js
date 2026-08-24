import { DEFAULT_SCAN_BATCH_SIZE, DEFAULT_RETRY_COUNT } from "./constants.js";

export const SHELL_HTML = `
<div class="card">
  <div class="toolbar">
    <div class="tabs">
      <button class="tab active" data-view="graph">Map</button>
      <button class="tab" data-view="floorplan">Floor Plan</button>
      <button class="tab" data-view="table">Bindings</button>
      <button class="tab" data-view="devices">Devices</button>
      <button class="tab" data-view="capexplorer">Zigbee Capability Explorer</button>
      <button class="tab" data-view="advanced">Advanced</button>
    </div>
    <input id="search" class="search" placeholder="Search devices…">
    <span id="storage-mode-badge" class="storage-mode-badge muted"></span>
    <button class="btn" id="btn-refresh-devices" title="Reload device list">⟳ Devices</button>
    <button class="btn btn-primary" id="btn-scan" title="Read current bindings from your Zigbee devices">Scan bindings</button>
    <button class="btn btn-small" id="btn-rescan-settings" title="Scan settings">⚙</button>
  </div>
  <div id="rescan-settings-panel" class="filter-panel">
    <div class="filter-group">
      <label class="row" for="scan-batch-size">Devices scanned at once (full network scan)
        <input type="number" id="scan-batch-size" min="1" max="30" style="width:4em; margin-left:6px;">
      </label>
      <p class="hint">Only applies to the full "Scan bindings" network scan — devices are read in concurrent
        batches of this size rather than one at a time, confirmed via live testing to genuinely overlap rather
        than just queue behind each other. A larger batch makes it less likely that several sleepy/offline
        devices happen to land in different batches and each drag their own batch out by ~45 seconds — but
        bigger isn't free: testing found that batches much above ~10-12 can cause otherwise-healthy devices to
        occasionally fail to respond (Zigbee airtime/collision contention from that much traffic at once, not
        a real device problem — retrying individually or rescanning usually succeeds). Increase cautiously and
        only if you've confirmed it holds up reliably on your own network. Default is ${DEFAULT_SCAN_BATCH_SIZE}.</p>
    </div>
    <div class="filter-group">
      <label class="row" for="rescan-retry-count">Retries for single-device rescan
        <input type="number" id="rescan-retry-count" min="1" max="10" style="width:4em; margin-left:6px;">
      </label>
      <p class="hint">Only applies when you rescan one device (e.g. the Devices tab or "Scan this device") —
        the full "Scan bindings" network scan is unaffected. Each extra retry costs about 45 seconds if the
        device genuinely doesn't respond, so more isn't free — it's a real trade-off between a better chance
        of catching a briefly-unreachable device and a longer wait. Default is ${DEFAULT_RETRY_COUNT}.</p>
    </div>
    <div class="filter-group">
      <div class="filter-group-title">Storage</div>
      <div id="storage-mode-detail" class="hint"></div>
      <button type="button" class="btn btn-small" id="btn-use-shared-storage" style="display:none">Use shared storage</button>
      <button type="button" class="btn btn-small" id="btn-use-local-storage" style="display:none">Use this browser only</button>
      <div id="storage-backend-hint" class="hint" style="display:none">
        Your data is only saved in this browser. An optional backend integration can save it centrally in
        Home Assistant instead, so it's available from every browser and device.
        <a href="https://github.com/hsolgaard/zha-bindings-manager-backend" target="_blank" rel="noopener">Learn more →</a>
        <button type="button" class="btn btn-small" id="btn-dismiss-storage-hint">Dismiss</button>
      </div>
    </div>
  </div>
  <div id="status" class="status" style="display:none"></div>

  <div id="view-graph" class="view active">
    <div class="graph-toolbar">
      <label class="row"><input type="checkbox" id="f-coordinator"> Coordinator</label>
      <label class="row"><input type="checkbox" id="f-routers"> Routers</label>
      <label class="row"><input type="checkbox" id="f-endDevices"> End devices</label>
      <label class="row"><input type="checkbox" id="f-groups"> Groups</label>
      <label class="row"><input type="checkbox" id="f-unbound"> Unbound devices</label>
      <label class="row" title="Also filters the Bindings tab, not just this Map view"><input type="checkbox" id="f-hideCoordinatorBindings" checked> Hide coordinator bindings (Map &amp; Bindings tab)</label>
      <label class="row" title="Some real bindings are a device reporting its own state (e.g. a light reporting to a group it belongs to) rather than controlling anything. These are hidden here by default so the map reads as &quot;who controls what&quot; — they're still real and still shown in full on the Bindings tab."><input type="checkbox" id="f-showReportingBindings"> Show reporting-only bindings (Map only)</label>
      <span class="spacer"></span>
      <span id="scan-info" class="scan-info muted"></span>
      <button class="btn btn-small" id="btn-filters">Filters ▾</button>
      <button class="btn btn-small" id="btn-zoom-out">－</button>
      <button class="btn btn-small" id="btn-zoom-fit">Fit</button>
      <button class="btn btn-small" id="btn-zoom-in">＋</button>
      <button class="btn btn-small" id="btn-fullscreen" title="Toggle fullscreen">⛶</button>
    </div>
    <div id="filter-panel" class="filter-panel">
      <div class="filter-group">
        <div class="filter-group-title">Type</div>
        <div id="chips-types" class="chips"></div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">Manufacturer</div>
        <div id="chips-manufacturers" class="chips"></div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">Area</div>
        <div id="chips-areas" class="chips"></div>
      </div>
      <button class="btn btn-small" id="btn-clear-filters">Clear type / manufacturer / area filters</button>
    </div>
    <div class="graph-wrap">
      <svg id="graph-svg" viewBox="0 0 1200 840" preserveAspectRatio="xMidYMid meet"></svg>
      <div id="graph-empty" class="graph-empty"></div>
    </div>
    <p class="hint">Drag a device onto another device (or onto a group) to create a binding. Click a line to inspect / remove it.</p>
    <p id="graph-role-legend" class="hint" style="display:none">🕹 badge = this device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here (e.g. a wired/local load alongside a Zigbee-bound one) — click the device to see the full per-endpoint breakdown.</p>
  </div>

  <div id="view-table" class="view">
    <div id="health-summary" class="health-summary" style="display:none"></div>
    <div id="table-filter-info" class="table-filter-info" style="display:none"></div>
    <div class="table-toolbar">
      <span class="health-filters" id="health-filters">
        <button class="chip active" data-health-filter="all">All</button>
        <button class="chip" data-health-filter="problems">Problems Only</button>
        <button class="chip" data-health-filter="error">Errors</button>
        <button class="chip" data-health-filter="warning">Warnings</button>
        <button class="chip" data-health-filter="info">Info</button>
      </span>
      <span class="spacer"></span>
      <button class="btn btn-small" id="btn-export-csv">Export CSV</button>
      <button class="btn btn-small" id="btn-export-json">Export JSON</button>
      <button class="btn btn-small" id="btn-export-print">Print / Save as PDF</button>
    </div>
    <div class="table-scroll">
    <table class="bindings-table">
      <thead><tr>
        <th data-sort="sourceLabel">Source</th>
        <th data-sort="typeLabel">Type</th>
        <th data-sort="areaLabel">Area</th>
        <th data-sort="manModel">Manufacturer / Model</th>
        <th data-sort="clusterLabel">Cluster</th>
        <th data-sort="targetLabel">Target</th>
        <th data-sort="healthRank">Health</th>
        <th></th>
      </tr></thead>
      <tbody id="table-body"></tbody>
    </table>
    </div>
  </div>

  <div id="view-devices" class="view">
    <div class="table-scroll">
    <table class="bindings-table">
      <thead><tr>
        <th data-sort="name">Name</th>
        <th data-sort="type">Type</th>
        <th data-sort="manufacturer">Manufacturer</th>
        <th data-sort="model">Model</th>
        <th data-sort="area">Area</th>
        <th data-sort="power">Power</th>
        <th data-sort="count">Bindings</th>
        <th data-sort="scanRank">Last scan</th>
        <th>Endpoints</th>
      </tr></thead>
      <tbody id="devices-table-body"></tbody>
    </table>
    </div>
  </div>

  <div id="view-floorplan" class="view">
    <div class="graph-toolbar">
      <label class="row fp-image-row">Image URL
        <input type="text" id="fp-image-url" placeholder="/local/floorplan.png">
      </label>
      <button class="btn btn-small" id="fp-set-image">Set image</button>
      <span class="spacer"></span>
      <button class="btn btn-small" id="btn-fp-zoom-out">－</button>
      <button class="btn btn-small" id="btn-fp-zoom-fit">Fit</button>
      <button class="btn btn-small" id="btn-fp-zoom-in">＋</button>
      <label class="row fp-marker-row" for="fp-marker-scale" title="Scales device markers independently of image resolution — useful when a lower-resolution floor plan leaves markers looking oversized.">Marker size
        <input type="number" id="fp-marker-scale" min="40" max="200" step="10" style="width:4.5em; margin-left:6px;">%
      </label>
    </div>
    <div class="floorplan-layout">
      <div class="fp-sidebar">
        <div class="filter-group-title">Unplaced devices</div>
        <div id="fp-unplaced-list" class="fp-unplaced-list"></div>
      </div>
      <div class="graph-wrap">
        <svg id="fp-svg" viewBox="0 0 1200 840" preserveAspectRatio="xMidYMid meet"></svg>
        <div id="fp-empty" class="graph-empty"></div>
      </div>
    </div>
    <p class="hint">Drop an image into your <code>www/</code> folder (e.g. <code>config/www/floorplan.png</code>) and reference it above as <code>/local/floorplan.png</code>. Drag a device from the list onto its spot on the plan to place it; drag a placed device to move it; click a placed device (without dragging) to send it back to the list.</p>
    <p id="fp-role-legend" class="hint" style="display:none">🕹 badge = this device also has its own Light/Switch/Cover/Fan role, in addition to what's shown by the edges here (e.g. a wired/local load alongside a Zigbee-bound one) — click the device to see the full per-endpoint breakdown.</p>
  </div>

  <div id="view-capexplorer" class="view"></div>

  <div id="view-advanced" class="view"></div>

  <div id="dialog" class="dialog">
    <div id="dialog-backdrop" class="dialog-backdrop"></div>
    <div class="dialog-panel">
      <div class="dialog-header">
        <span id="dialog-title"></span>
        <button id="dialog-close" class="btn btn-small">✕</button>
      </div>
      <div id="dialog-body" class="dialog-body"></div>
    </div>
  </div>
</div>`;
