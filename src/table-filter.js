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
 * Explains an empty Bindings table. Exactly one of three cases:
 *  - "not-scanned": no bindings have been loaded at all.
 *  - "device-filter": the device filter (and its direction toggle) matches nothing.
 *  - "other-filters": the device filter is fine, but the health chips or
 *    search box hide everything.
 *
 * `coordinatorHidden` is true when the filtered device is the coordinator and
 * the "Hide coordinator bindings" setting is on: that setting is the reason
 * it looks empty, so the message says so instead of implying it has none.
 *
 * `total` is every binding currently available to the table, before any
 * filtering. `deviceMatches` is how many of those pass the device filter
 * alone (ignoring health chips and search).
 */
export function emptyTableState({ total, deviceFilterActive, deviceMatches, direction, deviceName, coordinatorHidden }) {
  if (!total) {
    return { kind: "not-scanned", message: 'No bindings loaded yet. Click "Scan bindings" above.' };
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
  return { kind: "other-filters", message: "No bindings match the current filters." };
}
