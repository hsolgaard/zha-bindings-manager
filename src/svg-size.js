// 1.11.0: the size of an SVG floor plan.
// A plan's positions are stored as fractions of its width and height, so
// only the proportions matter, but the Network tab and Floor Plan tab work
// in the plan's own units. An SVG exported with only a viewBox has no size
// of its own: Chromium then reports 300×150-style defaults (90×150 for a
// 600×1000 viewBox) and Firefox reports 0×0. Reading the file's own
// width/height (or viewBox) gives the real proportions.

export function isSvgUrl(url) {
  return typeof url === "string" && /\.svg(?:[?#]|$)/i.test(url.trim());
}

function length(value) {
  // Absolute lengths only: "600", "600px", "600.5". Percentages and
  // relative units (em, %) say nothing about the drawing's own size.
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(value || "");
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n > 0 ? n : null;
}

/** {w, h} from an SVG document's text, or null if it can't tell.
 *  Small drawings are scaled up (same proportions) so the plan has room. */
export function svgIntrinsicSize(text, minWidth = 1200) {
  if (typeof text !== "string") return null;
  const tag = /<svg\b[^>]*>/i.exec(text);
  if (!tag) return null;
  const attr = (name) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag[0]);
    return m ? (m[2] ?? m[3]) : null;
  };
  let w = length(attr("width"));
  let h = length(attr("height"));
  // The browser already reads an explicit size correctly.
  if (w && h) return { w: Math.round(w), h: Math.round(h), explicit: true };
  {
    const vb = (attr("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      w = vb[2];
      h = vb[3];
    }
  }
  if (!(w && h)) return null;
  if (w < minWidth) {
    h = (h * minWidth) / w;
    w = minWidth;
  }
  return { w: Math.round(w), h: Math.round(h), explicit: false };
}
