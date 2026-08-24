import { StorageProvider } from "./storage-provider.js";

/**
 * Browser-local implementation of StorageProvider — everything lives in
 * `window.localStorage`, scoped by card id, exactly as the pre-M5 scattered
 * `localStorage.getItem`/`setItem` calls did. This is the only provider
 * that exists today; see the delivery plan for `HaStorageProvider`
 * (M7/M8), which will implement this identical interface against the
 * optional `zha-bindings-manager-backend` integration instead.
 */
export class LocalStorageProvider extends StorageProvider {
  _keyFor(cardId, key) {
    return `zha-binding-map-card:${cardId || "default"}:${key}`;
  }

  async getItem(cardId, key) {
    try {
      const raw = localStorage.getItem(this._keyFor(cardId, key));
      return raw == null ? null : JSON.parse(raw);
    } catch (e) {
      // Corrupt cache or storage unavailable — fail soft, same as before.
      return null;
    }
  }

  async setItem(cardId, key, value) {
    try {
      localStorage.setItem(this._keyFor(cardId, key), JSON.stringify(value));
      return true;
    } catch (e) {
      // Quota exceeded, or storage disabled entirely — fail soft, same as
      // every scattered localStorage call's try/catch did before.
      return false;
    }
  }

  async getScanState(cardId) {
    const raw = await this.getItem(cardId, "scan-state");
    if (raw && (raw.last_complete || raw.latest)) return raw;
    // Migration path from the pre-M5 "bindings" key, which only ever held
    // what's now last_complete — read it once so anyone upgrading from a
    // version before this boundary existed doesn't lose their cached scan
    // on the first load after updating. "latest" simply starts empty,
    // same as a fresh install; there's no attempt-level data to migrate.
    const legacy = await this.getItem(cardId, "bindings");
    if (legacy && legacy.bindings) {
      return { last_complete: legacy, latest: null };
    }
    return { last_complete: null, latest: null };
  }

  async setScanState(cardId, state) {
    return this.setItem(cardId, "scan-state", state);
  }

  async getHistory(cardId) {
    const raw = await this.getItem(cardId, "history");
    return raw && typeof raw === "object" ? raw : {};
  }

  async setHistory(cardId, history) {
    return this.setItem(cardId, "history", history);
  }
}
