// 1.11.0: "All floors" on the Network tab (integration issue #49).
// Every floor's plan is drawn in its own panel in one picture, so links and
// routes between floors can be drawn as lines. Panels are scaled to the same
// height side by side (desktop) or the same width stacked (phone), in floor
// level order, with a band above each for the floor's name.

export const PANEL_SIZE = 1000; // common panel height (side by side) or width (stacked)

/** floors: [{id, name, w, h}] in level order (lowest first), w/h = image size.
 *  Returns {w, h, panels: {id: {x, y, w, h, name, titleY}}} in picture units. */
export function allFloorsGeometry(floors, { stacked = false } = {}) {
  const S = PANEL_SIZE;
  const gap = S * 0.06;
  const band = S * 0.07;
  const panels = {};
  let x = 0;
  let y = 0;
  let maxW = 0;
  let maxH = 0;
  for (const f of floors || []) {
    if (!(f && f.w > 0 && f.h > 0)) continue;
    const w = stacked ? S : (f.w * S) / f.h;
    const h = stacked ? (f.h * S) / f.w : S;
    panels[f.id] = { x, y: y + band, w, h, name: f.name, titleY: y + band * 0.7 };
    maxW = Math.max(maxW, x + w);
    maxH = Math.max(maxH, y + band + h);
    if (stacked) y += band + h + gap;
    else x += w + gap;
  }
  return { w: Math.round(maxW) || S, h: Math.round(maxH) || S, panels };
}

/** Position of a device in the all-floors picture, from its spot (fractions)
 *  on its own floor's plan; null if that floor isn't drawn. */
export function allFloorsPos(geometry, floorId, spot) {
  const p = geometry && geometry.panels[floorId];
  if (!p || !spot) return null;
  return { x: p.x + spot.x * p.w, y: p.y + spot.y * p.h };
}
