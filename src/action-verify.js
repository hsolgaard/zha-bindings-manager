// Outcome of a bind or unbind, checked against a fresh read of the source
// device's binding table rather than zha_toolkit's own report (see v0.8.2).
//
// Before 1.0.4 there were only two outcomes, so a battery remote that went
// back to sleep before the check read like a failed bind even when the bind
// had gone through (forum report, John_smith, 1.0.3). There are now three:
//
//   confirmed    the source was read and the binding is (or, for an unbind,
//                is no longer) there
//   failed       the source was read and the change is not there
//   unconfirmed  the source didn't answer the check, so nothing is known yet
//
// For an unbind there is also "absent": the binding wasn't on the device to
// begin with, so there was nothing to remove.

/** @param {{present: boolean, sourceRead: boolean}} p */
export function bindOutcome({ present, sourceRead }) {
  if (present) return "confirmed";
  return sourceRead ? "failed" : "unconfirmed";
}

/** @param {{before: boolean|null, present: boolean, sourceRead: boolean}} p
 *  `before` is whether the cached data showed the binding before the call. */
export function unbindOutcome({ before, present, sourceRead }) {
  if (sourceRead) {
    if (present) return "failed";
    return before === false ? "absent" : "confirmed";
  }
  // Not read: the cache still holds whatever it held before the call.
  return before === false && !present ? "absent" : "unconfirmed";
}

export const OUTCOME_LEVEL = {
  confirmed: "success",
  absent: "success",
  unconfirmed: "warning",
  failed: "error",
};

/** Stable key for a pending check, so the same binding isn't listed twice. */
export function pendingKey(p) {
  const t = p.target && p.target.isGroup
    ? `g:${p.target.groupId}`
    : `d:${String((p.target && p.target.ieee) || "").toLowerCase()}:${p.target ? p.target.endpoint : ""}`;
  return `${p.kind}|${String(p.sourceIeee).toLowerCase()}|${p.sourceEndpoint}|${p.clusterId}|${t}`;
}

/**
 * Re-checks unconfirmed binds/unbinds after a scan. An entry is only decided
 * when its source device was actually read in that scan; otherwise it stays
 * pending. `isPresent(entry)` says whether the binding is now in the cached
 * data, `wasRead(ieee)` whether that device answered the scan.
 * Returns {pending, resolved: [{entry, outcome}]}.
 */
export function reconcilePending(entries, { isPresent, wasRead }) {
  const pending = [];
  const resolved = [];
  for (const entry of entries || []) {
    if (!wasRead(entry.sourceIeee)) {
      pending.push(entry);
      continue;
    }
    const present = !!isPresent(entry);
    const outcome =
      entry.kind === "unbind"
        ? unbindOutcome({ before: true, present, sourceRead: true })
        : bindOutcome({ present, sourceRead: true });
    resolved.push({ entry, outcome });
  }
  return { pending, resolved };
}
