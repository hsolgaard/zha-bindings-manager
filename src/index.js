/**
 * Entry point for the build (see ../build.js). Source lives in ./src as real
 * modules; `npm run build` bundles this file and everything it imports into
 * the single zha-binding-map-card.js file Home Assistant actually loads.
 * The project header comment and version banner shown at the top of that
 * generated file come from build.js's BANNER, not from here — edit build.js
 * if you need to change that text, and bump CARD_VERSION below (kept in
 * sync with package.json's "version") when cutting a release.
 */

/* eslint-disable no-console */

import { ZhaBindingMapCard } from "./card.js";
import { CARD_VERSION } from "./constants.js";

// Logged once per script load (not per card instance) so you can confirm
// which build is actually active straight from the browser console —
// useful given HACS caches a pre-gzipped copy of this file that can go
// stale if you ever drop a replacement in manually.
console.info(
  `%c ZHA-BINDING-MAP-CARD %c v${CARD_VERSION} `,
  "color: white; background: #039be5; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #039be5; background: white; font-weight: 700; border-radius: 0 3px 3px 0;"
);

customElements.define("zha-binding-map-card", ZhaBindingMapCard);

window.customCards = window.customCards || [];
window.customCards.push({
  // NOTE: "type" and the customElements.define() name above must never change —
  // existing dashboards reference `custom:zha-binding-map-card` in their YAML.
  // Only the display name/description below (shown in the card picker and HACS)
  // reflect the "ZHA Bindings Manager" project name.
  type: "zha-binding-map-card",
  name: "ZHA Bindings Manager",
  description: "Visual manager for ZHA Zigbee direct bindings — graph/table overview plus drag-and-drop bind/unbind, built on top of zha-toolkit.",
});
