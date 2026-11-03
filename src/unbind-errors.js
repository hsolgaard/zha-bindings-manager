// -----------------------------------------------------------------------
// Explaining failed unbinds (1.5.0). zha-toolkit's own error is shown
// instead of only "still present", and its known failure on bindings to
// devices removed from ZHA is explained (found 2026-11-01: binds_remove_all
// looks the target device up again, gets a KeyError for a removed device,
// and never sends the Unbind request; reported to zha-toolkit).
// -----------------------------------------------------------------------

/** "binds_remove_all failed: Unknown error" -> "Unknown error". */
export function toolkitErrorText(err) {
  const msg = (err && (err.message || String(err))) || "";
  return msg.replace(/^binds_remove_all failed:\s*/i, "").trim();
}

/** Explanation for bindings that are still there after an unbind.
 *  errors: zha-toolkit error texts (empty when it reported success).
 *  targetRemoved: the binding points at a device no longer in ZHA. */
export function explainUnbindFailure({ errors = [], targetRemoved = false } = {}) {
  const real = [...new Set(errors.filter(Boolean))];
  if (targetRemoved && (!real.length || real.some((e) => /keyerror|unknown error/i.test(e)))) {
    return (
      "zha-toolkit can't remove a binding to a device that's no longer in ZHA: it looks the removed device up, " +
      "fails, and never sends the unbind (a known zha-toolkit bug, reported to its developer). Until it's fixed, " +
      "these bindings stay. They only use a slot in the switch's binding table. If you need the slot now, pair the " +
      "removed device again (it keeps its address), then unbind it normally."
    );
  }
  if (real.length) return `zha-toolkit said: ${real.slice(0, 2).join("; ")}${real.length > 2 ? " (and more)" : ""}.`;
  return "";
}
