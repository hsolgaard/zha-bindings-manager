export const STYLE = `
:host { display:block; max-width:100%; }
.card {
  background: var(--ha-card-background, var(--card-background-color, #fff));
  border-radius: var(--ha-card-border-radius, 12px);
  box-shadow: var(--ha-card-box-shadow, none);
  border: 1px solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
  padding: 12px 16px 16px;
  color: var(--primary-text-color);
  font-family: var(--paper-font-body1_-_font-family, inherit);
  box-sizing: border-box; max-width:100%; overflow-x:hidden;
}
.toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
.tabs { display:flex; gap:4px; flex-wrap:wrap; }
/* Any element that would otherwise force the card wider than the screen
   (a wide table, a long unbreakable label) scrolls within itself instead. */
.table-scroll { max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; }
.tab {
  background: none; border: none; padding: 6px 12px; border-radius: 8px;
  color: var(--secondary-text-color); cursor: pointer; font-weight:500;
}
.tab.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }
.search {
  flex: 1 1 160px; min-width: 120px; padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color);
}
.btn {
  border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 0.9em;
}
.btn:hover { filter: brightness(0.97); }
.btn:disabled { opacity: 0.6; cursor: default; }
.btn-primary { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: transparent; }
.btn-danger { background: var(--error-color, #db4437); color: #fff; border-color: transparent; }
.btn-small { padding: 3px 8px; font-size: 0.8em; }
.status { margin: 4px 0 10px; padding: 8px 12px; border-radius: 8px; font-size: 0.9em; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.status-info { background: rgba(3,169,244,0.12); color: var(--primary-text-color); }
.status-success { background: rgba(76,175,80,0.15); color: var(--primary-text-color); }
.status-error { background: rgba(244,67,54,0.15); color: var(--primary-text-color); }
.status-text { flex: 1; }
.status-close {
  flex: none; border: none; background: transparent; cursor: pointer; font-size: 1.1em;
  line-height: 1; padding: 0 2px; color: inherit; opacity: 0.6;
}
.status-close:hover { opacity: 1; }
.scan-cell { display:flex; flex-direction:column; align-items:flex-start; gap:4px; min-width:150px; }
.scan-cell-status { font-size:0.85em; }
.scan-cell-failed .scan-cell-status, .scan-cell-never .scan-cell-status { color: var(--error-color, #db4437); }
.scan-cell-partial .scan-cell-status { color: var(--warning-color, #ff9800); }
.scan-cell-ok .scan-cell-status { color: var(--success-color, #4caf50); }
.scan-wake-hint { font-size:0.78em; color: var(--secondary-text-color); font-style:italic; }
.scan-cell-btn { align-self:flex-start; }
.view { display:none; }
.view.active { display:block; }
.graph-toolbar { display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:6px; font-size:0.85em; }
.graph-toolbar .row { display:flex; align-items:center; gap:4px; cursor:pointer; user-select:none; }
.spacer { flex:1; }
.scan-info { font-size: 0.85em; white-space: nowrap; }
.storage-mode-badge { font-size: 0.8em; white-space: nowrap; }
.filter-panel { display:none; border:1px solid var(--divider-color, #e0e0e0); border-radius:10px;
  padding:10px 12px 12px; margin-bottom:10px; background: var(--secondary-background-color, #fafafa); }
.filter-panel.open { display:block; }
.filter-group { margin-bottom:8px; }
.filter-group-title { font-size:0.72em; text-transform:uppercase; letter-spacing:.04em;
  color: var(--secondary-text-color); margin-bottom:5px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chip { border:1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color); border-radius: 999px; padding: 3px 10px; font-size: 0.78em; cursor: pointer; }
.chip:hover { filter: brightness(0.97); }
.chip.active { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: transparent; }
/* Base (in-dashboard card) graph height scales with viewport so it isn't
   cramped on a laptop-sized window, but stays reasonable on small screens. */
.graph-wrap { position:relative; width:100%; height: clamp(420px, 62vh, 820px); border-radius: 10px; overflow:hidden;
  background: var(--secondary-background-color, #fafafa); border: 1px solid var(--divider-color, #e0e0e0); }
#graph-svg { width:100%; height:100%; touch-action:none; cursor: grab; }
/* Fullscreen mode: card takes over the whole browser viewport, graph fills
   all remaining vertical space after the toolbars. */
.card.fullscreen {
  position: fixed; inset: 0; z-index: 1000; border-radius: 0;
  display: flex; flex-direction: column; overflow: auto;
}
.card.fullscreen #view-graph.active { display:flex; flex-direction:column; flex:1; min-height:0; }
.card.fullscreen .graph-wrap { flex:1; height:auto; min-height: 260px; }

/* Floor plan tab */
.fp-image-row { flex: 1 1 320px; display:flex; align-items:center; gap:6px; }
.fp-image-row input { flex:1; padding:5px 8px; border-radius:6px; border:1px solid var(--divider-color, #ccc);
  background: var(--card-background-color); color: var(--primary-text-color); }
.floorplan-layout { display:flex; gap:10px; align-items:stretch; }
.fp-sidebar { flex: 0 0 180px; width:180px; border:1px solid var(--divider-color, #e0e0e0); border-radius:10px;
  padding:8px; overflow-y:auto; max-height: clamp(420px, 62vh, 820px);
  background: var(--secondary-background-color, #fafafa); }
.fp-unplaced-list { display:flex; flex-direction:column; gap:6px; }
.fp-chip { border:1px solid var(--divider-color, #ccc); background: var(--card-background-color);
  color: var(--primary-text-color); border-radius:8px; padding:5px 8px; font-size:0.8em; cursor:grab; user-select:none; }
.fp-chip:active { cursor:grabbing; }
.floorplan-layout .graph-wrap { flex:1; min-width:0; }
.fp-ghost { position:fixed; z-index:2000; background: var(--primary-color); color: var(--text-primary-color, #fff);
  padding:4px 10px; border-radius:8px; font-size:0.8em; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.3); }
.card.fullscreen #view-floorplan.active { display:flex; flex-direction:column; flex:1; min-height:0; }
.card.fullscreen #view-floorplan.active .floorplan-layout { flex:1; min-height:0; }
.card.fullscreen #view-floorplan.active .graph-wrap { height:auto; }
.card.fullscreen #view-floorplan.active .fp-sidebar { max-height:none; }
.graph-empty { position:absolute; inset:0; display:none; align-items:center; justify-content:center; color: var(--secondary-text-color); }
.hint { font-size: 0.8em; color: var(--secondary-text-color); margin: 8px 2px 0; }
.node { cursor: grab; }
.node-shape { stroke: var(--card-background-color, #fff); stroke-width: 2; }
.node-device { fill: #607d8b; }
.node-coordinator { fill: #ffb300; }
.node-group { fill: none; stroke: #8e24aa; stroke-width: 2.5; }
.node.drop-target .node-shape { filter: drop-shadow(0 0 6px var(--primary-color)); stroke: var(--primary-color); }
.node-icon { font-size: 18px; pointer-events:none; }
.node-role-badge-bg { fill: var(--card-background-color, #fff); stroke: #8e24aa; stroke-width: 1.5; }
.node-role-badge-icon { pointer-events:none; }
.node-label { font-size: 11px; text-anchor: middle; fill: var(--primary-text-color); pointer-events:none; }
/* Floor Plan labels sit on an arbitrary uploaded image, not the card's own
   background, so trusting the theme's text color (as the Map view safely
   does) can go invisible — e.g. dark theme = light text, sitting on a white
   blueprint. A halo outline in the card's background color keeps the label
   readable against light or dark image content either way. */
.fp-node .node-label {
  paint-order: stroke;
  stroke: var(--card-background-color, #fff);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.edge { stroke-width: 2.5; cursor:pointer; opacity: 0.85; }
.edge:hover { stroke-width: 4; opacity: 1; }
/* Reporting-type bindings (see _isControlBinding) — only ever drawn when
   "Show reporting-only bindings" is on, so they need to read as secondary
   background info rather than compete with real control arrows. */
.edge-reporting { stroke-width: 1.2; stroke-dasharray: 4,3; opacity: 0.45; }
.edge-reporting:hover { stroke-width: 2; opacity: 0.8; }
/* Distinct from both control (solid) and reporting (faint dashed) — this
   binding hasn't been classified yet (device not cluster-scanned, or the
   cluster isn't declared on this endpoint at all), and stays visible by
   default same as control, just visually flagged as unresolved. */
.edge-unknown { stroke-width: 1.6; stroke-dasharray: 2,2; opacity: 0.7; }
.edge-unknown:hover { stroke-width: 2.2; opacity: 1; }
.table-filter-info { display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:6px 10px;
  border-radius:8px; background: rgba(76,154,255,0.12); font-size:0.85em; }
.table-toolbar { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:0.85em; flex-wrap:wrap; }
.health-filters { display:flex; gap:6px; flex-wrap:wrap; }
.bindings-table { width:100%; border-collapse: collapse; font-size: 0.9em; }
.bindings-table th, .bindings-table td { text-align:left; padding: 8px 10px; border-bottom: 1px solid var(--divider-color, #eee); }
.bindings-table th[data-sort] { cursor: pointer; user-select: none; white-space: nowrap; }
.bindings-table th[data-sort]:hover { color: var(--primary-color); }
.bindings-table th.sort-asc::after { content: " \\25B2"; font-size: 0.75em; }
.bindings-table th.sort-desc::after { content: " \\25BC"; font-size: 0.75em; }
.health-summary { display:flex; align-items:center; gap:10px; margin-bottom:10px; padding:8px 12px;
  border-radius:8px; background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee);
  font-size:0.85em; flex-wrap:wrap; }
.health-summary-title { font-weight:600; }
.health-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:12px; font-size:0.9em; }
.health-badge { border:none; border-radius:12px; padding:4px 10px; font-size:0.85em; cursor:pointer; white-space:nowrap; }
.health-ok, .health-badge.health-ok, .health-chip.health-ok { background: rgba(76,206,172,0.15); color: #2e9e83; }
.health-info, .health-badge.health-info, .health-chip.health-info { background: rgba(76,154,255,0.15); color: #2f6fce; }
.health-warning, .health-badge.health-warning, .health-chip.health-warning { background: rgba(255,179,0,0.18); color: #b26a00; }
.health-error, .health-badge.health-error, .health-chip.health-error { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.src-link { color: var(--primary-color); cursor: pointer; text-decoration: none; }
.src-link:hover { text-decoration: underline; }
.muted { color: var(--secondary-text-color); }
.dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.advanced-form-wrap { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.advanced-form { display:flex; flex-direction:column; gap:10px; flex: 1 1 340px; max-width: 480px; }
.advanced-form label { display:flex; flex-direction:column; gap:4px; font-size:0.85em; color: var(--secondary-text-color); }
.advanced-form select, .advanced-form input { padding:6px 8px; border-radius:6px; border:1px solid var(--divider-color, #ccc);
  background: var(--card-background-color); color: var(--primary-text-color); }
.advanced-side { display:flex; flex-direction:column; gap:12px; flex: 1 1 280px; min-width:0; }
.advanced-panel { border:1px solid var(--divider-color, #e0e0e0); border-radius:10px; padding:8px 10px;
  background: var(--secondary-background-color, #fafafa); }
.advanced-binding-list { display:flex; flex-direction:column; gap:6px; font-size:0.85em; max-height:280px; overflow-y:auto; margin-top:6px; }
.advanced-binding-row { display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:6px;
  background: var(--card-background-color); }
.advanced-empty { color: var(--secondary-text-color); font-size:0.85em; padding:4px 0 0; margin:0; }
.dialog { position: fixed; inset:0; display:none; z-index: 20; align-items:center; justify-content:center; }
.dialog.open { display:flex; }
.dialog-backdrop { position:absolute; inset:0; background: rgba(0,0,0,0.4); }
.dialog-panel { position:relative; background: var(--card-background-color, #fff); color: var(--primary-text-color);
  border-radius: 12px; padding: 16px 18px; width: min(560px, 92vw); max-height: 82vh; overflow:auto; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
.dialog-panel.wide { width: min(760px, 94vw); }
.dialog-header { display:flex; align-items:center; justify-content:space-between; font-weight:600; margin-bottom:10px; }
.row { display:flex; align-items:center; gap:6px; font-size:0.92em; }
.dialog-actions { display:flex; gap:8px; margin-top:14px; }
.detail-table td { padding: 4px 8px; font-size: 0.9em; }

/* Exploded device view — per-endpoint cards inside the (widened) dialog. */
.ep-photo-toggle { font-size:0.82em; color: var(--secondary-text-color); margin-bottom:10px; }
.ep-device-header { display:flex; align-items:flex-start; gap:14px; }
.ep-device-visual { flex: 0 0 auto; width:64px; }
.ep-device-photo { width:64px; max-height:110px; object-fit:contain; border-radius:6px;
  background: var(--card-background-color); }
.ep-device-shape { width:64px; }
.ep-shape-svg { display:block; }
.ep-shape-plate { fill: var(--secondary-background-color, #eee); stroke: var(--divider-color, #ccc); }
.ep-shape-gang { fill: var(--primary-color, #039be5); opacity:0.75; }
.ep-device-header .detail-table { flex:1; }
.ep-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap:10px; margin-top:12px; }
.ep-card { border:1px solid var(--divider-color, #e0e0e0); border-radius:10px; padding:10px 12px;
  background: var(--secondary-background-color, #fafafa); }
.ep-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.ep-card-title { font-weight:600; font-size:0.95em; }
.ep-badges { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }
.ep-badge { display:inline-block; font-size:0.78em; padding:3px 8px; border-radius:10px; line-height:1.5; }
.ep-badge-clusters { display:block; font-size:0.88em; opacity:0.75; }
.ep-badge-self { background:#ede7f6; color:#4a2f8f; }
.ep-badge-out { background:#e1f5ee; color:#0a5c46; }
.ep-badge-in { background:#faece7; color:#8f3d1c; }
.ep-badge-member { background:#f3e5f5; color:#6a1b78; }
.ep-badge-unknown { background:#fff3e0; color:#8a5a00; }
.ep-badge-reporting { background: var(--divider-color, #e0e0e0); color: var(--secondary-text-color); }
.ep-badge-muted { background: var(--divider-color, #e0e0e0); color: var(--secondary-text-color); }
.ep-report { font-size:0.82em; color: var(--secondary-text-color); margin: 4px 0 8px; }
.ep-picker-label { display:block; font-size:0.8em; color: var(--secondary-text-color); margin-bottom:3px; }
.ep-cmd-section { margin:10px 0; padding:8px 0; border-top:1px solid var(--divider-color, #e0e0e0); border-bottom:1px solid var(--divider-color, #e0e0e0); }
.ep-cmd-status { margin:4px 0; }
.ep-cmd-actions { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
.ep-cmd-discovery-note { margin: 0 0 8px; padding:6px 8px; border-radius:8px;
  background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee); }
.ep-cmd-results { display:flex; flex-direction:column; gap:6px; margin-bottom:8px; }
.ep-cmd-cluster { border:1px solid var(--divider-color, #e0e0e0); border-radius:8px; padding:6px 8px; }
.ep-cmd-cluster-head {
  display:flex; align-items:center; gap:6px; width:100%; text-align:left;
  border:none; background:none; padding:0; margin:0; font: inherit; font-size:0.85em; font-weight:600;
  color:inherit; cursor:pointer;
}
.ep-cmd-cluster-head:hover { color: var(--primary-color); }
.ep-cmd-chevron { flex:none; opacity:0.6; font-size:0.9em; }
.ep-cmd-cluster-title { flex:1; }
.ep-cmd-summary { flex:none; font-weight:400; font-size:0.82em; opacity:0.7; white-space:nowrap; }
.ep-cmd-cluster-body { margin-top:6px; display:flex; flex-direction:column; gap:4px; }
.ep-cmd-cluster-id { font-weight:400; opacity:0.65; margin-left:4px; }
.ep-cmd-row { display:flex; align-items:center; gap:6px; padding:3px 6px; border-radius:6px; font-size:0.82em; }
.ep-cmd-row.ep-cmd-yes { }
.ep-cmd-row.ep-cmd-no { background:#faece7; }
.ep-cmd-yes .ep-cmd-icon { color:#0a5c46; }
.ep-cmd-no .ep-cmd-icon { color:#8f3d1c; }
.ep-cmd-no .ep-cmd-name, .ep-cmd-no .ep-cmd-hex { color:#8f3d1c; }
.ep-cmd-name { flex:1; }
.ep-cmd-hex { opacity:0.65; font-size:0.9em; }
.ep-cmd-share-draft { border:1px dashed var(--divider-color, #ccc); border-radius:8px; padding:8px; margin-top:4px; }
.ep-cmd-share-json {
  width:100%; box-sizing:border-box; font-family: var(--code-font-family, monospace); font-size:0.72em;
  background: var(--card-background-color); color: var(--primary-text-color);
  border:1px solid var(--divider-color, #ccc); border-radius:6px; padding:6px; resize:vertical;
}
.ep-cmd-share-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
.ep-control-select { width:100%; }

/* Capability Explorer tab */
.capexp-strip { display:flex; align-items:center; gap:8px; background: rgba(76,154,255,0.1);
  border:1px solid rgba(76,154,255,0.3); border-radius:10px; padding:8px 12px; margin-bottom:10px; font-size:0.85em; }
.capexp-mission { font-size:1em; font-weight:600; margin: 0 0 4px; }
.capexp-discoveries { background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee);
  border-radius:10px; padding:8px 12px; margin: 8px 0; }
.capexp-discoveries-label { font-size:0.78em; font-weight:600; color: var(--secondary-text-color); margin-bottom:4px; }
.capexp-discoveries-lead { margin:0 0 6px; font-size:0.88em; }
.capexp-discoveries-list { margin:0; padding-left:18px; display:flex; flex-direction:column; gap:3px; font-size:0.88em; }
.capexp-modes { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:2px; }
.capexp-mode-btn { display:flex; flex-direction:column; align-items:flex-start; gap:2px; text-align:left;
  border:1px solid var(--divider-color, #ccc); background: var(--card-background-color); color: var(--primary-text-color);
  border-radius:10px; padding:7px 12px; cursor:pointer; }
.capexp-mode-btn:hover { filter: brightness(0.97); }
.capexp-mode-btn.active { background: var(--primary-color); border-color: transparent; }
.capexp-mode-btn .capexp-mode-title { font-size:0.88em; font-weight:600; }
.capexp-mode-btn.active .capexp-mode-title { color: var(--text-primary-color, #fff); }
.capexp-mode-btn .capexp-mode-sub { font-size:0.76em; color: var(--secondary-text-color); }
.capexp-mode-btn.active .capexp-mode-sub { color: var(--text-primary-color, #fff); opacity:0.85; }
.capexp-status-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
.capexp-status-row .hint { margin:0; }
.capexp-error { color: var(--error-color, #db4437); }
.capexp-section-title { font-weight:600; margin: 14px 0 6px; }
.capexp-section-title:first-child { margin-top:6px; }
.capexp-device-list { display:flex; flex-direction:column; gap:8px; }
.capexp-device-card { border:1px solid var(--divider-color, #e0e0e0); border-radius:10px; padding:10px 12px;
  background: var(--secondary-background-color, #fafafa); }
.capexp-device-top { display:flex; gap:12px; align-items:flex-start; }
.capexp-device-main { flex:1 1 auto; min-width:0; }
.capexp-device-photo, .capexp-device-photo-fallback { width:56px; height:56px; border-radius:8px; flex:0 0 auto;
  background: var(--card-background-color, #fff); border:1px solid var(--divider-color, #e0e0e0); object-fit:contain; }
.capexp-device-photo-fallback { position:relative; background: var(--secondary-background-color, #fafafa); }
.capexp-device-photo-fallback::after { content:""; position:absolute; inset:15px;
  background-color: var(--secondary-text-color, #727272); opacity:0.45;
  mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='3' y='3' width='18' height='18' rx='3' fill='none' stroke='black' stroke-width='2'/><circle cx='12' cy='12' r='3' fill='black'/></svg>");
  -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='3' y='3' width='18' height='18' rx='3' fill='none' stroke='black' stroke-width='2'/><circle cx='12' cy='12' r='3' fill='black'/></svg>");
  mask-size:contain; -webkit-mask-size:contain; mask-repeat:no-repeat; -webkit-mask-repeat:no-repeat;
  mask-position:center; -webkit-mask-position:center; }
.capexp-device-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.capexp-device-name { font-weight:600; }
.capexp-website-link { margin-left:auto; font-size:0.78em; font-weight:500; color: var(--primary-color);
  text-decoration:none; white-space:nowrap; }
.capexp-website-link:hover { text-decoration:underline; }
.capexp-external-refs { font-size:0.78em; margin-top:6px; }
.capexp-external-refs a { color: var(--primary-color); text-decoration:none; }
.capexp-external-refs a:hover { text-decoration:underline; }
.capexp-chevron { margin-left:auto; opacity:0.6; }
.capexp-techtoggle { display:flex; align-items:center; gap:4px; cursor:pointer; user-select:none;
  margin-top:10px; padding-top:8px; border-top:1px solid var(--divider-color, #e0e0e0);
  font-size:0.78em; font-weight:600; color: var(--secondary-text-color); }
.capexp-techtoggle:hover { color: var(--primary-text-color); }
.capexp-chevron-inline { opacity:0.7; }
.capexp-tech-panel { margin-top:6px; }
.capexp-trust-panel { display:flex; align-items:center; gap:8px; margin-top:6px; }
.capexp-trust-stars { font-size:1.05em; letter-spacing:1px; color:#e0a400; white-space:nowrap; }
.capexp-trust-conflict { font-size:0.82em; letter-spacing:normal; color: var(--error-color, #db4437); font-weight:600; }
.capexp-trust-text { display:flex; flex-direction:column; }
.capexp-trust-label { font-size:0.78em; font-weight:600; color: var(--secondary-text-color); }
.capexp-evidence-tag { display:inline-block; align-self:flex-start; font-size:0.68em; font-weight:500;
  padding:1px 7px; border-radius:8px; margin:2px 0; background: var(--divider-color, #e0e0e0);
  color: var(--secondary-text-color); }
.capexp-trust-detail { font-size:0.8em; }
.capexp-cap-label { font-size:0.78em; color: var(--secondary-text-color); margin-top:8px; margin-bottom:2px; }
.capexp-cap-groups { display:flex; flex-direction:column; gap:6px; margin-top:2px; }
.capexp-cap-group-label { font-size:0.85em; font-weight:600; }
.capexp-cap-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:3px; }
.capexp-cap-reportsonly { margin-top:2px; }
.capexp-cap-group-unidentified .capexp-cap-group-label { font-weight:500; font-style:italic; }
.capexp-tag { display:inline-block; font-size:0.78em; padding:3px 9px; border-radius:10px;
  background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-tag-conflict { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.capexp-tag-fwdep { background: rgba(142,36,170,0.13); color: #6a1b78; }
.capexp-report-line { font-size:0.85em; margin-top:8px; }
.capexp-discovery-note { font-size:0.8em; margin-top:6px; padding:4px 8px; border-radius:6px;
  background: rgba(76,154,255,0.10); color: #2f6fce; display:inline-block; }
.capexp-goodfor { margin-top:8px; }
.capexp-goodfor-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:3px; }
.capexp-goodfor-tag { background: rgba(76,206,172,0.15); color: #1f7a63; }
.capexp-fwgap-alert { margin-top:8px; padding:7px 10px; border-radius:8px; font-size:0.82em;
  background: rgba(255,179,0,0.12); border:1px solid rgba(255,179,0,0.35); color: var(--primary-text-color); }
.capexp-confidence-badge { display:inline-block; font-size:0.72em; padding:3px 9px; border-radius:10px;
  white-space:nowrap; background: var(--divider-color, #e0e0e0); color: var(--secondary-text-color); }
.capexp-confidence-strong-evidence { background: rgba(76,206,172,0.18); color: #2e9e83; }
.capexp-confidence-well-confirmed { background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-confidence-repeated-observation { background: rgba(76,154,255,0.15); color: #2f6fce; }
.capexp-confidence-single-observation { background: rgba(255,179,0,0.18); color: #b26a00; }
.capexp-confidence-conflicting-evidence { background: rgba(219,68,55,0.15); color: var(--error-color, #db4437); }
.capexp-device-detail { margin-top:10px; padding-top:8px; border-top:1px solid var(--divider-color, #e0e0e0);
  display:flex; flex-direction:column; gap:10px; opacity:0.85; }
.capexp-techlabel { font-size:0.7em; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;
  color: var(--secondary-text-color); margin-bottom:2px; }
.capexp-entry-title { font-size:0.8em; font-weight:400; color: var(--secondary-text-color); margin-bottom:4px; }
.capexp-nomatch-list { display:flex; flex-direction:column; gap:6px; }
.capexp-nomatch-row { display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:6px 10px; border-radius:8px; background: var(--secondary-background-color, #fafafa);
  border:1px solid var(--divider-color, #eee); font-size:0.9em; }
.capexp-search-example-group { margin-bottom:8px; }
.capexp-search-example-category { font-size:0.72em; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;
  color: var(--secondary-text-color); margin-bottom:4px; }
.capexp-search-examples { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:2px; }
.capexp-advanced-filters { margin:10px 0; }
.capexp-advanced-filters summary { cursor:pointer; font-size:0.85em; font-weight:600; color: var(--secondary-text-color); }
.capexp-search-form { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; margin-bottom:8px; }
.capexp-search-form input, .capexp-search-form select { flex: 1 1 150px; min-width:120px; padding:6px 8px; border-radius:6px;
  border:1px solid var(--divider-color, #ccc); background: var(--card-background-color); color: var(--primary-text-color); }
.capexp-empty-search { padding:12px; border-radius:10px; background: var(--secondary-background-color, #fafafa);
  border:1px solid var(--divider-color, #eee); }
.capexp-empty-search p { margin: 0 0 6px; }
.capexp-compare-form { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:12px; }
.capexp-compare-form label { display:flex; flex-direction:column; gap:4px; font-size:0.85em;
  color: var(--secondary-text-color); flex: 1 1 160px; }
.capexp-compare-form select { padding:6px 8px; border-radius:6px; border:1px solid var(--divider-color, #ccc);
  background: var(--card-background-color); color: var(--primary-text-color); }
.capexp-compare-my-device { margin:10px 0; padding:10px 12px; border-radius:10px;
  background: var(--secondary-background-color, #fafafa); border:1px solid var(--divider-color, #eee);
  display:flex; flex-direction:column; gap:6px; font-size:0.9em; }
.capexp-compare-my-device.muted { color: var(--secondary-text-color); }
.capexp-compare-my-device.capexp-compare-ok { border-color: var(--success-color, #2e7d32); }
.capexp-compare-fw-row { display:flex; justify-content:space-between; gap:10px; }
.capexp-compare-label { font-weight:600; font-size:0.85em; margin-top:2px; }
.capexp-compare-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.capexp-compare-list li { padding:2px 0; }
.capexp-diff-wrap { display:flex; flex-direction:column; gap:6px; }
.capexp-diff-row { padding:8px 10px; border-radius:8px; background: var(--secondary-background-color, #fafafa);
  border:1px solid var(--divider-color, #eee); font-size:0.9em; }

/* Narrow (phone) screens: stack the floor-plan sidebar above the map
   instead of beside it, and trim padding so nothing forces extra width. */
@media (max-width: 600px) {
  .card { padding: 10px 10px 12px; }
  .floorplan-layout { flex-direction: column; }
  .fp-sidebar { width:100%; flex: 0 0 auto; max-height: 160px; }
  .card.fullscreen #view-floorplan.active .fp-sidebar { max-height: 160px; }
  .dialog-panel { width: min(560px, 96vw); padding: 12px 14px; }
  .dialog-panel.wide { width: min(560px, 96vw); }
  .ep-grid { grid-template-columns: 1fr; }
  .capexp-search-form { flex-direction: column; }
  .capexp-compare-form { flex-direction: column; }
  .capexp-modes { flex-direction: column; }
  .capexp-mode-btn { width: 100%; }
}
`;
