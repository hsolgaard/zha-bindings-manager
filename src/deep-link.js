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
