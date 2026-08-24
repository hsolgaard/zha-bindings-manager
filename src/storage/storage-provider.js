/**
 * StorageProvider — the persistence boundary between the card's scan/UI
 * logic and wherever that state actually lives.
 *
 * `LocalStorageProvider` (this file's sibling) is the only implementation
 * that exists today. The ZHA Bindings Manager delivery plan's M7/M8 add a
 * second one, `HaStorageProvider`, backed by the optional
 * `zha-bindings-manager-backend` HACS integration — the card will pick
 * whichever provider applies at load time via feature detection and never
 * needs to know which one it's actually talking to, as long as both
 * implement this same interface.
 *
 * Every method here is async even though `LocalStorageProvider` resolves
 * synchronously under the hood — deliberately, so call sites in card.js
 * are already correct for a network-backed provider before one exists,
 * instead of needing a second pass through every call site later.
 *
 * Not a TypeScript interface (this project has no build-time type
 * checking), just a documented contract enforced by "throws if a subclass
 * doesn't override it" — good enough to catch a missing method during
 * manual testing without adding a type-checking toolchain for one file.
 */
export class StorageProvider {
  /**
   * Generic per-card-instance key/value storage for simple preferences —
   * filters, node positions, endpoint annotations, floor plan state,
   * settings (retry count, scan batch size, etc). `key` is an opaque
   * string the caller chooses; the provider doesn't need to know what it
   * means, only how to namespace it per card instance.
   *
   * @param {string} cardId - this._config.id (or "default")
   * @param {string} key
   * @returns {Promise<any>} the stored value, or null if absent/unreadable
   */
  async getItem(cardId, key) {
    throw new Error("StorageProvider.getItem not implemented");
  }

  /** @returns {Promise<boolean>} true on success, false on a soft failure
   *  (quota exceeded, storage disabled) — never throws, matching the
   *  fail-soft behavior the scattered localStorage try/catch blocks had
   *  before this boundary existed. */
  async setItem(cardId, key, value) {
    throw new Error("StorageProvider.setItem not implemented");
  }

  /**
   * The one piece of state with real persistence semantics beyond plain
   * key/value — scan results. See the delivery plan's "latest /
   * last_complete observation split":
   *
   *   last_complete — the best known-good data per device, built up over
   *     time. Never regresses: a device that fails one scan attempt keeps
   *     whatever binding data its last successful scan produced.
   *   latest — the outcome of the most recent scan attempt as a whole,
   *     including which devices failed to respond or only partially
   *     responded. Fixes the bug where that information lived in memory
   *     only and silently vanished on a page reload, making a device that
   *     just failed to respond look identical to one that's fine.
   *
   * @returns {Promise<{
   *   last_complete: {savedAt: string, bindings: object} | null,
   *   latest: {attemptedAt: string, failures: string[], partial: object} | null
   * }>}
   */
  async getScanState(cardId) {
    throw new Error("StorageProvider.getScanState not implemented");
  }
  async setScanState(cardId, state) {
    throw new Error("StorageProvider.setScanState not implemented");
  }

  /** Learned per-device response-time/outcome history (see
   *  _recordScanOutcome/_historyFor in card.js) — kept separate from scan
   *  state since it's additive/rolling rather than latest-vs-complete.
   *  @returns {Promise<object>} ieee(lower) -> {successMs, outcomes, ...} */
  async getHistory(cardId) {
    throw new Error("StorageProvider.getHistory not implemented");
  }
  async setHistory(cardId, history) {
    throw new Error("StorageProvider.setHistory not implemented");
  }
}
