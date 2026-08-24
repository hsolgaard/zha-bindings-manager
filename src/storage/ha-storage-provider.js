import { StorageProvider } from "./storage-provider.js";

const WS_GET_STATE = "zha_bindings_manager/get_state";
const WS_SAVE_STATE = "zha_bindings_manager/save_state";
const WS_GET_CAPABILITIES = "zha_bindings_manager/get_capabilities";

// Coalesces rapid successive writes (e.g. several settings changed in a
// row) into one network round trip instead of one save per field — see
// the delivery plan's "whole-state save with a debounce on the frontend".
const SAVE_DEBOUNCE_MS = 1500;

/**
 * Backend-backed implementation of StorageProvider, talking to the
 * optional zha-bindings-manager-backend integration over its WebSocket
 * commands. Mirrors LocalStorageProvider's interface exactly — card.js
 * doesn't need to know which one it's using.
 *
 * The backend stores one whole-state JSON blob per card_id (last-write-
 * wins, no patch API — see that repo's design notes), not per-key like
 * localStorage. This provider is what reshapes that single blob into the
 * same items/scanState/history split LocalStorageProvider exposes.
 */
export class HaStorageProvider extends StorageProvider {
  constructor(hass, cardId) {
    super();
    this._hass = hass;
    this._cardId = cardId || "default";
    this._state = null; // {items:{}, scanState, history} once loaded
    this._updatedAt = null;
    this._loadPromise = null;
    this._saveTimer = null;
    this._savePromise = null;
    this._resolveSave = null;
  }

  /** Feature detection — a static-ish helper rather than an instance
   *  method, since card.js needs an answer *before* deciding whether to
   *  construct a HaStorageProvider at all. Returns false (not a thrown
   *  error) for "not installed", same as for any other failure — the
   *  caller only needs yes/no, not why. */
  static async isAvailable(hass) {
    try {
      const res = await hass.connection.sendMessagePromise({ type: WS_GET_CAPABILITIES });
      return !!(res && res.available);
    } catch (e) {
      return false;
    }
  }

  async _ensureLoaded() {
    if (this._state) return this._state;
    if (!this._loadPromise) {
      this._loadPromise = this._hass.connection
        .sendMessagePromise({ type: WS_GET_STATE, card_id: this._cardId })
        .then((res) => {
          this._updatedAt = res ? res.updated_at : null;
          this._state = (res && res.state) || { items: {}, scanState: null, history: {} };
          return this._state;
        })
        .catch((e) => {
          console.warn("ZHA Binding Map: could not load shared state, starting empty:", e.message || e);
          this._state = { items: {}, scanState: null, history: {} };
          return this._state;
        });
    }
    return this._loadPromise;
  }

  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    if (!this._savePromise) {
      this._savePromise = new Promise((resolve) => {
        this._resolveSave = resolve;
      });
    }
    this._saveTimer = setTimeout(() => this._flushSave(), SAVE_DEBOUNCE_MS);
    return this._savePromise;
  }

  async _flushSave() {
    this._saveTimer = null;
    try {
      const res = await this._hass.connection.sendMessagePromise({
        type: WS_SAVE_STATE,
        card_id: this._cardId,
        state: this._state,
        base_updated_at: this._updatedAt,
      });
      this._updatedAt = res.updated_at;
    } catch (e) {
      if (e && e.code === "stale_write") {
        // Something else saved in between (another browser, most likely).
        // Re-fetch its version to learn the real current updated_at, then
        // retry once with whatever's currently in our in-memory state —
        // no merge beyond that, matching the backend's own "last write
        // wins, reload and retry" design rather than inventing frontend
        // conflict resolution for a problem that needs real evidence
        // before it's worth building.
        try {
          const fresh = await this._hass.connection.sendMessagePromise({
            type: WS_GET_STATE,
            card_id: this._cardId,
          });
          this._updatedAt = fresh ? fresh.updated_at : null;
          const res2 = await this._hass.connection.sendMessagePromise({
            type: WS_SAVE_STATE,
            card_id: this._cardId,
            state: this._state,
            base_updated_at: this._updatedAt,
          });
          this._updatedAt = res2.updated_at;
        } catch (e2) {
          console.warn("ZHA Binding Map: shared save failed after a conflict retry:", e2.message || e2);
        }
      } else {
        console.warn("ZHA Binding Map: shared save failed:", e.message || e);
      }
    } finally {
      if (this._resolveSave) this._resolveSave();
      this._savePromise = null;
      this._resolveSave = null;
    }
  }

  /** Flushes a pending debounced save immediately instead of waiting it
   *  out — not called anywhere yet in this milestone, kept available for
   *  call sites that later want to confirm a save actually landed (e.g.
   *  right before showing a "saved" confirmation) rather than trusting
   *  the debounce timer alone. */
  async flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      await this._flushSave();
    } else if (this._savePromise) {
      await this._savePromise;
    }
  }

  async getItem(cardId, key) {
    const state = await this._ensureLoaded();
    return state.items && key in state.items ? state.items[key] : null;
  }

  async setItem(cardId, key, value) {
    const state = await this._ensureLoaded();
    if (!state.items) state.items = {};
    state.items[key] = value;
    this._scheduleSave();
    return true;
  }

  async getScanState(cardId) {
    const state = await this._ensureLoaded();
    return state.scanState || { last_complete: null, latest: null };
  }

  async setScanState(cardId, scanState) {
    const state = await this._ensureLoaded();
    state.scanState = scanState;
    this._scheduleSave();
    return true;
  }

  async getHistory(cardId) {
    const state = await this._ensureLoaded();
    return state.history || {};
  }

  async setHistory(cardId, history) {
    const state = await this._ensureLoaded();
    state.history = history;
    this._scheduleSave();
    return true;
  }
}
