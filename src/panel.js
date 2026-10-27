/**
 * Full-page sidebar panel for the ZHA Bindings Manager integration.
 *
 * The integration registers this element as a custom panel ("ZHA Bindings"
 * in the sidebar) and loads this file only when the panel is opened. It's a
 * thin wrapper: a header like Home Assistant's own pages (with the menu
 * button phones need to open the sidebar) around one zha-binding-map-card.
 * The card gets the same config as a dashboard card without an id, so it
 * reads and writes the same saved data as an existing dashboard card.
 *
 * Home Assistant sets hass, narrow, route and panel on this element.
 */
const STYLE = `
:host { display: block; min-height: 100vh; background: var(--primary-background-color); }
.header {
  display: flex; align-items: center; gap: 4px; height: var(--header-height, 56px); padding: 0 12px;
  background: var(--app-header-background-color, var(--primary-color));
  color: var(--app-header-text-color, var(--text-primary-color, #fff));
  border-bottom: var(--app-header-border-bottom, none);
  box-sizing: border-box; position: sticky; top: 0; z-index: 2;
}
.title { font-size: 20px; font-weight: 400; margin-left: 8px; }
.content { padding: 8px; box-sizing: border-box; }
`;

export class ZhaBindingsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._narrow = false;
    this._card = null;
    this._menu = null;
  }

  connectedCallback() {
    if (this._card) return;
    this.shadowRoot.innerHTML = `<style>${STYLE}</style>
      <div class="header"><span class="menu"></span><div class="title">ZHA Bindings</div></div>
      <div class="content"></div>`;
    // ha-menu-button is Home Assistant's own sidebar toggle; it only shows
    // itself when it's needed (narrow screens or a hidden sidebar).
    this._menu = document.createElement("ha-menu-button");
    this.shadowRoot.querySelector(".menu").appendChild(this._menu);
    this._card = document.createElement("zha-binding-map-card");
    if (typeof this._card.setConfig === "function") {
      this._card.setConfig({ type: "custom:zha-binding-map-card" });
    }
    this.shadowRoot.querySelector(".content").appendChild(this._card);
    this._apply();
  }

  set hass(hass) {
    this._hass = hass;
    this._apply();
  }

  get hass() {
    return this._hass;
  }

  set narrow(narrow) {
    this._narrow = !!narrow;
    this._apply();
  }

  get narrow() {
    return this._narrow;
  }

  // route and panel are set by Home Assistant; nothing here needs them yet.
  set route(route) {
    this._route = route;
  }

  set panel(panel) {
    this._panel = panel;
  }

  _apply() {
    if (this._menu) {
      this._menu.hass = this._hass;
      this._menu.narrow = this._narrow;
    }
    if (this._card && this._hass) this._card.hass = this._hass;
  }
}
