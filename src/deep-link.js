// Deep link into the card: /zha-bindings-manager?device=<ieee> opens that
// device's view. Used by the integration's device-page Bindings sensor and
// its Repairs issues (1.3.1), so they can click through to the card.

/** The IEEE address in `?device=` (case and separators normalised to
 *  lower-case colon form), or null. Accepts "08:FD:52:…", "08fd52…" or
 *  "08-fd-52-…". */
export function deepLinkIeee(search) {
  let raw;
  try {
    raw = new URLSearchParams(search || "").get("device");
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  const hex = raw.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 16) return null;
  return hex.match(/../g).join(":");
}

/** `search` with the device parameter removed, so a reload doesn't reopen it. */
export function withoutDeviceParam(search) {
  const params = new URLSearchParams(search || "");
  params.delete("device");
  const s = params.toString();
  return s ? `?${s}` : "";
}

// The selected tab in the address (1.10.2), in the integration's sidebar
// page only: /zha-bindings-manager#bindings. A reload keeps you on the same
// tab, and a link can open one directly. Readable names, matching the tab
// labels, mapped to the card's internal view ids.
export const TAB_NAMES = {
  graph: "map",
  floorplan: "floor-plan",
  table: "bindings",
  devices: "devices",
  groups: "groups",
  capexplorer: "capabilities",
  advanced: "advanced",
  mesh: "network",
};

/** The view id for a location hash such as "#bindings" (case-insensitive),
 *  or null if it isn't one of the tabs. */
export function viewFromHash(hash) {
  const name = String(hash || "").replace(/^#/, "").trim().toLowerCase();
  if (!name) return null;
  const hit = Object.entries(TAB_NAMES).find(([, n]) => n === name);
  return hit ? hit[0] : null;
}

/** The hash for a view id ("#map" for anything unknown). */
export function hashForView(view) {
  return `#${TAB_NAMES[view] || TAB_NAMES.graph}`;
}
