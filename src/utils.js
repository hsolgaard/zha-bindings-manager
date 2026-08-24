/** Parses a manually-typed cluster ID (Advanced tab's "Custom cluster ID"
 *  field) — accepts "0x0000"/"0x6" style hex or a plain decimal number.
 *  Returns null for anything that isn't a valid 0..0xFFFF cluster id,
 *  rather than throwing, so callers can just check for null. */
export function parseClusterIdInput(raw) {
  const s = (raw || "").trim();
  if (!s) return null;
  const n = /^0x/i.test(s) ? parseInt(s, 16) : Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) return null;
  return n;
}
export function normIeee(ieee) {
  return (ieee || "").toLowerCase();
}
export function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
export function relTime(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  if (diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Median of successful response durations (ms) — used instead of mean as
 *  the headline number since it resists being skewed by one freak slow
 *  reading. Returns null for an empty list. */
export function medianMs(values) {
  if (!values || !values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function meanMs(values) {
  if (!values || !values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Formats a millisecond duration the way a person would say it — "~1s",
 *  "~4s" — never fake precision like "1243ms". */
export function formatDurationMs(ms) {
  if (ms == null) return null;
  const s = ms / 1000;
  return s < 1 ? "<1s" : `~${Math.round(s)}s`;
}

/**
 * hass.callService() rejections aren't always plain Error objects — depending
 * on whether it's a websocket-level failure, an auth/connection issue, or a
 * Python exception bubbled up from the service handler, the rejection can be
 * a string, a bare number (e.g. an internal connection error code), or an
 * object shaped like {code, message}. Normalize all of those into one
 * readable string instead of letting them stringify to "[object Object]".
 */
export function extractErrorMessage(err) {
  if (err === null || err === undefined) return "unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "number") {
    return `connection error (code ${err}) — check Settings → System → Logs for details`;
  }
  if (err.message) return err.message;
  if (err.error && err.error.message) return err.error.message;
  try {
    const s = JSON.stringify(err);
    if (s && s !== "{}") return s;
  } catch (e) {
    /* fall through */
  }
  return String(err);
}
export function uniqueClusters(clusters) {
  const seen = new Set();
  const out = [];
  clusters.forEach((c) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  });
  return out;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
