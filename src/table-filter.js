// Pure logic for the Bindings tab's per-device filter, kept free of DOM and
// card state so it can be unit tested (see test/table-filter.test.js).
//
// A device filter is set by clicking a device name in the Devices tab or a
// Source name in the Bindings table. It shows every binding the device is
// involved in: the ones it is the source of (outbound) and the ones where it
// is the direct target of another device (inbound).
//
// "Inbound" uses the same rule as the device drawer's incoming list in
// _endpointRelationships: a direct (non-group) binding whose target is the
// device and whose source is a different device. Group membership is not
// treated as inbound here; the drawer shows that separately as "Member of".

export const DIRECTION_ALL = "all";
export const DIRECTION_OUTBOUND = "outbound";
export const DIRECTION_INBOUND = "inbound";

/** "outbound" | "inbound" | null for how binding `b` relates to device `ieee`.
 *  A self-bound row (source and target both the device) is outbound, so it
 *  is listed once and never counted twice. */
export function bindingDirection(b, ieee) {
  if (!ieee) return null;
  if (b.sourceIeee === ieee) return DIRECTION_OUTBOUND;
  if (!b.isGroup && b.targetIeee === ieee && b.sourceIeee !== ieee) return DIRECTION_INBOUND;
  return null;
}

/** Whether `b` passes the device filter for the given direction toggle. */
export function matchesDeviceFilter(b, ieee, direction = DIRECTION_ALL) {
  if (!ieee) return true;
  const dir = bindingDirection(b, ieee);
  if (!dir) return false;
  return direction === DIRECTION_ALL || direction === dir;
}

/** Sort rank for the Direction column: outbound first. */
export function directionRank(dir) {
  return dir === DIRECTION_OUTBOUND ? 0 : dir === DIRECTION_INBOUND ? 1 : 2;
}

/** Arrow label for the Direction column. */
export function directionLabel(dir) {
  return dir === DIRECTION_OUTBOUND ? "→ Outbound" : dir === DIRECTION_INBOUND ? "← Inbound" : "";
}

/**
 * Explains an empty Bindings table. One of four cases:
 *  - "not-scanned": no bindings have been loaded at all.
 *  - "coordinator-hidden": bindings were scanned, but every one of them
 *    targets the coordinator and "Hide coordinator bindings" is on. Before
 *    1.0.4 this read as "No bindings loaded yet" while the summary above
 *    said "34 bindings scanned" (forum report, John_smith).
 *  - "device-filter": the device filter (and its direction toggle) matches nothing.
 *  - "other-filters": the device filter is fine, but the health chips or
 *    search box hide everything. Names which one(s) when told.
 *
 * `coordinatorHidden` is true when the filtered device is the coordinator and
 * the "Hide coordinator bindings" setting is on: that setting is the reason
 * it looks empty, so the message says so instead of implying it has none.
 *
 * `total` is every binding currently available to the table (after the
 * coordinator setting, before any other filtering). `rawTotal` is every
 * scanned binding, including ones that setting hides; it defaults to
 * `total`. `deviceMatches` is how many of `total` pass the device filter
 * alone (ignoring health chips and search). `healthFilterLabel` and `search`
 * describe the other active filters, if any.
 */
export function emptyTableState({
  total,
  rawTotal,
  deviceFilterActive,
  deviceMatches,
  direction,
  deviceName,
  coordinatorHidden,
  healthFilterLabel,
  search,
}) {
  const scanned = rawTotal != null ? rawTotal : total;
  if (!scanned) {
    return { kind: "not-scanned", message: 'No bindings loaded yet. Click "Scan bindings" above.' };
  }
  if (!total) {
    return {
      kind: "coordinator-hidden",
      message: `All ${scanned} scanned binding${scanned === 1 ? "" : "s"} target${
        scanned === 1 ? "s" : ""
      } the coordinator, and "Hide coordinator bindings" is on in the Map filters. Untick it to see ${
        scanned === 1 ? "it" : "them"
      }.`,
    };
  }
  if (deviceFilterActive && !deviceMatches) {
    const what =
      direction === DIRECTION_OUTBOUND
        ? `No outbound bindings from ${deviceName}.`
        : direction === DIRECTION_INBOUND
        ? `No inbound bindings to ${deviceName}.`
        : `No bindings involve ${deviceName}.`;
    if (coordinatorHidden) {
      return {
        kind: "device-filter",
        message: `${what} Bindings that target the coordinator are hidden by "Hide coordinator bindings" in the Map filters. Untick it to see them.`,
      };
    }
    const hidden = `The filter is hiding ${total} other binding${total === 1 ? "" : "s"}. Clear the filter to see ${
      total === 1 ? "it" : "them"
    }.`;
    return { kind: "device-filter", message: `${what} ${hidden}` };
  }
  const reasons = [];
  if (healthFilterLabel) reasons.push(`the "${healthFilterLabel}" health filter`);
  if (search) reasons.push(`the search "${search}"`);
  return {
    kind: "other-filters",
    message: reasons.length
      ? `No bindings match ${reasons.join(" and ")}. ${total} binding${total === 1 ? " is" : "s are"} hidden.`
      : "No bindings match the current filters.",
  };
}

/** Lowercased text a search should match for a device by name: the name the
 *  user gave it in Home Assistant and the original ZHA name (usually
 *  manufacturer plus model). Matching both means a device is found whichever
 *  name the person types. */
export function deviceNameText(d) {
  if (!d) return "";
  return [d.user_given_name, d.name].filter(Boolean).join(" ").toLowerCase();
}

export const MIN_AUTO_FILTER_SEARCH_LENGTH = 3;

/**
 * The one device a search term points at, or null. Used so that typing a
 * device name into the search box behaves like clicking that device. Returns
 * null for short terms (so the layout does not jump while typing) and when
 * zero or several devices match by name, in which case search stays an
 * ordinary text filter.
 */
export function findSingleDeviceBySearch(devices, search) {
  const s = (search || "").trim().toLowerCase();
  if (s.length < MIN_AUTO_FILTER_SEARCH_LENGTH) return null;
  const matches = (devices || []).filter((d) => deviceNameText(d).includes(s));
  return matches.length === 1 ? matches[0] : null;
}
