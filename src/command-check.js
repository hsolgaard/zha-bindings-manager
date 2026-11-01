// Time limit and elapsed-time display for "Check supported commands"
// (zha_toolkit.scan_device). The service call itself can't be cancelled from
// the browser, so "Stop waiting" and the time limit only stop the card
// waiting: if the device answers later, the result is still used.
// Forum report (John_smith, 1.0.3): checks sat on "Checking…" indefinitely.

export const COMMAND_CHECK_LIMIT_MS = 120000;

/** "0:07", "1:30", "12:04" */
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Whether a result that arrives for check `token` should be applied to the
 * current entry. A success is always applied unless a result is already
 * shown (a late answer is still a real answer). An error only replaces the
 * entry if it belongs to the check currently on screen, so an old attempt
 * failing can't overwrite a newer one that is still running.
 */
export function shouldApplyResult(entry, token, ok) {
  if (!entry) return false;
  if (ok) return entry.status !== "done" || entry.token === token;
  return entry.token === token && entry.status !== "done";
}
