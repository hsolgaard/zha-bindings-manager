// Minimal, scoped test harness for M5 (see the ZHA Bindings Manager
// delivery plan's "Optimized path" — this deliberately does NOT set up
// the full M1 fixture corpus; just enough coverage for the one piece of
// logic this milestone's real value depends on: that a failed or partial
// scan attempt survives a page reload instead of silently reverting to
// "looks fine" once _scanFailures/_scanPartial reset to empty in memory.
import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageProvider } from "../src/storage/local-storage-provider.js";

// Same in-memory localStorage mock pattern already used by smoke-test.js
// in this repo, kept here rather than pulling in jsdom for one object's
// worth of behavior.
function installFakeLocalStorage() {
  const store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
  return store;
}

describe("LocalStorageProvider — generic getItem/setItem", () => {
  beforeEach(() => installFakeLocalStorage());

  it("round-trips a value through set then get", async () => {
    const storage = new LocalStorageProvider();
    await storage.setItem("card1", "filters", { coordinator: true, types: ["Light"] });
    expect(await storage.getItem("card1", "filters")).toEqual({ coordinator: true, types: ["Light"] });
  });

  it("returns null for a key that was never set", async () => {
    const storage = new LocalStorageProvider();
    expect(await storage.getItem("card1", "nope")).toBeNull();
  });

  it("namespaces keys per card id, so two card instances never collide", async () => {
    const storage = new LocalStorageProvider();
    await storage.setItem("card1", "filters", { a: 1 });
    await storage.setItem("card2", "filters", { a: 2 });
    expect(await storage.getItem("card1", "filters")).toEqual({ a: 1 });
    expect(await storage.getItem("card2", "filters")).toEqual({ a: 2 });
  });

  it("fails soft (returns null) on corrupt JSON rather than throwing", async () => {
    const store = installFakeLocalStorage();
    const storage = new LocalStorageProvider();
    store["zha-binding-map-card:card1:filters"] = "{not valid json";
    expect(await storage.getItem("card1", "filters")).toBeNull();
  });
});

describe("LocalStorageProvider — scan state (latest / last_complete split)", () => {
  beforeEach(() => installFakeLocalStorage());

  it("starts empty on a fresh install", async () => {
    const storage = new LocalStorageProvider();
    expect(await storage.getScanState("card1")).toEqual({ last_complete: null, latest: null });
  });

  it("persists last_complete and latest together, and reads them back intact", async () => {
    const storage = new LocalStorageProvider();
    const state = {
      last_complete: {
        savedAt: "2026-08-16T10:00:00.000Z",
        bindings: { "00:11:22:33:44:55:66:77": [{ id: "b1" }] },
      },
      latest: {
        attemptedAt: "2026-08-16T10:05:00.000Z",
        failures: ["aa:bb:cc:dd:ee:ff:00:11"],
        partial: { "11:22:33:44:55:66:77:88": { retrieved: 1, total: 2 } },
      },
    };
    await storage.setScanState("card1", state);
    expect(await storage.getScanState("card1")).toEqual(state);
  });

  it("this is the M5 fix: a failed device's status survives a reload", async () => {
    // Simulates the exact bug: a scan attempt fails for one device, gets
    // saved, then a fresh LocalStorageProvider instance stands in for the
    // page reload (mirrors card.js constructing a new one on every load —
    // nothing about scan outcome should live only in the old instance's
    // memory).
    const firstLoad = new LocalStorageProvider();
    await firstLoad.setScanState("card1", {
      last_complete: { savedAt: "2026-08-16T10:00:00.000Z", bindings: { dev1: [{ id: "b1" }] } },
      latest: { attemptedAt: "2026-08-16T10:05:00.000Z", failures: ["dev1"], partial: {} },
    });

    const afterReload = new LocalStorageProvider();
    const state = await afterReload.getScanState("card1");

    // The binding data is still there (never regresses)...
    expect(state.last_complete.bindings.dev1).toEqual([{ id: "b1" }]);
    // ...but the most recent attempt is known to have failed for dev1,
    // which is what card.js uses to repopulate _scanFailures on load so
    // Rule 7 (binding health) still flags it instead of showing "OK".
    expect(state.latest.failures).toContain("dev1");
  });

  it("migrates a pre-M5 legacy 'bindings' key into last_complete, with an empty latest", async () => {
    const store = installFakeLocalStorage();
    store["zha-binding-map-card:card1:bindings"] = JSON.stringify({
      savedAt: "2026-08-01T00:00:00.000Z",
      bindings: { dev1: [{ id: "old" }] },
    });
    const storage = new LocalStorageProvider();
    const state = await storage.getScanState("card1");
    expect(state.last_complete).toEqual({
      savedAt: "2026-08-01T00:00:00.000Z",
      bindings: { dev1: [{ id: "old" }] },
    });
    expect(state.latest).toBeNull();
  });

  it("prefers the new scan-state key over the legacy one once both exist", async () => {
    const store = installFakeLocalStorage();
    store["zha-binding-map-card:card1:bindings"] = JSON.stringify({
      savedAt: "2026-08-01T00:00:00.000Z",
      bindings: { dev1: [{ id: "old" }] },
    });
    const storage = new LocalStorageProvider();
    await storage.setScanState("card1", {
      last_complete: { savedAt: "2026-08-16T00:00:00.000Z", bindings: { dev1: [{ id: "new" }] } },
      latest: null,
    });
    const state = await storage.getScanState("card1");
    expect(state.last_complete.bindings.dev1).toEqual([{ id: "new" }]);
  });
});

describe("LocalStorageProvider — history", () => {
  beforeEach(() => installFakeLocalStorage());

  it("returns an empty object when nothing has been saved yet", async () => {
    const storage = new LocalStorageProvider();
    expect(await storage.getHistory("card1")).toEqual({});
  });

  it("round-trips per-device history", async () => {
    const storage = new LocalStorageProvider();
    const history = { dev1: { successMs: [120, 140], outcomes: [true, true, false] } };
    await storage.setHistory("card1", history);
    expect(await storage.getHistory("card1")).toEqual(history);
  });
});
