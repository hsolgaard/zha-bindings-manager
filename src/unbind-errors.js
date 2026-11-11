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
 *  errors: error texts (zha-toolkit's, or the device's own answer when the
 *  integration sent the unbind); targetRemoved: the binding points at a
 *  device no longer in ZHA; targetIeee: that device's address. zha-toolkit's
 *  KeyError for a removed device shows up as just the address (1.10.6). */
export function explainUnbindFailure({ errors = [], targetRemoved = false, targetIeee = null } = {}) {
  const real = [...new Set(errors.filter(Boolean))];
  const addr = targetIeee ? String(targetIeee).toLowerCase() : null;
  const isLookupBug = (e) => /keyerror|unknown error/i.test(e) || (addr && String(e).toLowerCase().includes(addr));
  if (targetRemoved && (!real.length || real.some(isLookupBug))) {
    return (
      "zha-toolkit can't remove a binding to a device that's no longer in ZHA: it looks the removed device up, " +
      "fails, and never sends the unbind (a known zha-toolkit bug, reported to its developer). With the ZHA Bindings " +
      "Manager integration installed, the card sends the unbind itself and isn't affected."
    );
  }
  if (real.some((e) => /NO_ENTRY/.test(e))) {
    return (
      "The device answered NO_ENTRY: it says it has no such binding, although its binding table lists it. Some devices " +
      "won't remove a binding they created themselves. A factory reset of the device clears it."
    );
  }
  if (real.some((e) => /NOT_SUPPORTED/.test(e))) {
    return "The device answered NOT_SUPPORTED: it doesn't let bindings be removed this way. A factory reset of the device clears them.";
  }
  if (real.length) {
    const fromDevice = real.every((e) => /^the device /i.test(e));
    return `${fromDevice ? "" : "zha-toolkit said: "}${real.slice(0, 2).join("; ")}${real.length > 2 ? " (and more)" : ""}.`.replace(/^the/, "The");
  }
  return "";
}
