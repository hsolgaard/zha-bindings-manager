// Minimal, scoped test harness for M8's HaStorageProvider — mirrors
// test/local-storage-provider.test.js in spirit: enough coverage for the
// one piece of real logic this class has (whole-state caching, debounced
// save, and the stale_write conflict retry), not an exhaustive suite.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HaStorageProvider } from "../src/storage/ha-storage-provider.js";

/** A fake hass.connection whose sendMessagePromise is driven by a queue
 *  of canned responses/errors per message type, and which records every
 *  call it received — enough to test HaStorageProvider without a real
 *  Home Assistant instance. */
function makeFakeConnection() {
  const calls = [];
  const handlers = {};
  return {
    calls,
    on(type, fn) {
      handlers[type] = fn;
    },
    sendMessagePromise(msg) {
      calls.push(msg);
      const fn = handlers[msg.type];
      if (!fn) return Promise.reject(new Error(`no handler for ${msg.type}`));
      return fn(msg);
    },
  };
}

describe("HaStorageProvider.isAvailable", () => {
  it("returns true when get_capabilities responds available", async () => {
    const connection = makeFakeConnection();
    connection.on("zha_bindings_manager/get_capabilities", async () => ({ available: true, version: "0.1.0" }));
    expect(await HaStorageProvider.isAvailable({ connection })).toBe(true);
  });

  it("returns false (not a throw) when the command is unrecognized — integration not installed", async () => {
    const connection = makeFakeConnection(); // no handler registered at all
    expect(await HaStorageProvider.isAvailable({ connection })).toBe(false);
  });
});

describe("HaStorageProvider — reads", () => {
  it("getScanState returns the default shape when the backend has nothing stored yet", async () => {
    const connection = makeFakeConnection();
    connection.on("zha_bindings_manager/get_state", async () => null);
    const storage = new HaStorageProvider({ connection }, "card1");
    expect(await storage.getScanState("card1")).toEqual({ last_complete: null, latest: null });
  });

  it("getScanState/getHistory read from the same loaded whole-state blob", async () => {
    const connection = makeFakeConnection();
    connection.on("zha_bindings_manager/get_state", async () => ({
      updated_at: "2026-08-16T10:00:00.000Z",
      state: {
        items: {},
        scanState: { last_complete: { savedAt: "t", bindings: { dev1: [] } }, latest: null },
        history: { dev1: { outcomes: [true] } },
      },
    }));
    const storage = new HaStorageProvider({ connection }, "card1");
    expect(await storage.getScanState("card1")).toEqual({
      last_complete: { savedAt: "t", bindings: { dev1: [] } },
      latest: null,
    });
    expect(await storage.getHistory("card1")).toEqual({ dev1: { outcomes: [true] } });
  });

  it("only calls get_state once even across several reads (loaded once, cached)", async () => {
    const connection = makeFakeConnection();
    let getStateCalls = 0;
    connection.on("zha_bindings_manager/get_state", async () => {
      getStateCalls++;
      return null;
    });
    const storage = new HaStorageProvider({ connection }, "card1");
    await storage.getScanState("card1");
    await storage.getHistory("card1");
    await storage.getItem("card1", "filters");
    expect(getStateCalls).toBe(1);
  });
});

describe("HaStorageProvider — debounced save", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("coalesces rapid successive writes into a single save_state call", async () => {
    const connection = makeFakeConnection();
    connection.on("zha_bindings_manager/get_state", async () => null);
    let saveCalls = 0;
    let lastSaved = null;
    connection.on("zha_bindings_manager/save_state", async (msg) => {
      saveCalls++;
      lastSaved = msg;
      return { updated_at: "2026-08-16T11:00:00.000Z" };
    });

    const storage = new HaStorageProvider({ connection }, "card1");
    await storage.setHistory("card1", { dev1: { outcomes: [true] } });
    await storage.setScanState("card1", { last_complete: { savedAt: "t", bindings: {} }, latest: null });

    expect(saveCalls).toBe(0); // still debouncing

    await vi.runAllTimersAsync();

    expect(saveCalls).toBe(1); // both writes landed in one save
    expect(lastSaved.state.history).toEqual({ dev1: { outcomes: [true] } });
    expect(lastSaved.state.scanState.last_complete.bindings).toEqual({});
    expect(lastSaved.base_updated_at).toBeNull();

    vi.useRealTimers();
  });

  it("on a stale_write rejection, re-fetches and retries once with the fresh base", async () => {
    const connection = makeFakeConnection();
    connection.on("zha_bindings_manager/get_state", async () => ({
      updated_at: "v1",
      state: { items: {}, scanState: null, history: {} },
    }));
    let saveAttempt = 0;
    connection.on("zha_bindings_manager/save_state", async (msg) => {
      saveAttempt++;
      if (saveAttempt === 1) {
        const err = new Error("stale");
        err.code = "stale_write";
        throw err;
      }
      // Second attempt should be using the freshly re-fetched base.
      expect(msg.base_updated_at).toBe("v2");
      return { updated_at: "v3" };
    });
    // The "someone else's save" that made the first attempt stale.
    let getStateCalls = 0;
    const originalHandler = connection.sendMessagePromise.bind(connection);
    connection.sendMessagePromise = (msg) => {
      if (msg.type === "zha_bindings_manager/get_state") {
        getStateCalls++;
        if (getStateCalls === 1) {
          connection.calls.push(msg);
          return Promise.resolve({ updated_at: "v1", state: { items: {}, scanState: null, history: {} } });
        }
        connection.calls.push(msg);
        return Promise.resolve({ updated_at: "v2", state: { items: {}, scanState: null, history: {} } });
      }
      return originalHandler(msg);
    };

    const storage = new HaStorageProvider({ connection }, "card1");
    await storage.setItem("card1", "filters", { a: 1 });
    await vi.runAllTimersAsync();

    expect(saveAttempt).toBe(2);

    vi.useRealTimers();
  });

  // Regression test for the v0.32.3 shared-storage bug: card.js's
  // _fillMissingBackendDataFromLocal (a one-time, user-confirmed "sync my
  // data now" action) was calling several setItem/setScanState/setHistory
  // in a row and returning as soon as those resolved — without ever
  // waiting for the debounced save behind them. That save only fires
  // ~1.5s later, so a page reload or the card re-rendering in that window
  // silently dropped everything just "imported": floor plan and device
  // positions appeared to carry over, then reverted to empty the next
  // time the card actually loaded fresh from the backend. flush() exists
  // specifically to force that save through immediately instead of
  // trusting the debounce timer — this proves it actually does, without
  // ever advancing fake timers (i.e. without the debounce ever firing on
  // its own), which is the exact scenario a real interrupted page load
  // would hit.
  it("flush() forces a pending save through immediately, without the debounce timer ever firing", async () => {
    const connection = makeFakeConnection();
    connection.on("zha_bindings_manager/get_state", async () => null);
    let saveCalls = 0;
    let lastSaved = null;
    connection.on("zha_bindings_manager/save_state", async (msg) => {
      saveCalls++;
      lastSaved = msg;
      return { updated_at: "2026-08-17T09:00:00.000Z" };
    });

    const storage = new HaStorageProvider({ connection }, "card1");
    // Mirrors _fillMissingBackendDataFromLocal: several writes to the same
    // instance before anything has a chance to flush on its own.
    await storage.setItem("card1", "positions", { dev1: { x: 10, y: 20 } });
    await storage.setItem("card1", "floorplan", { imageUrl: "/local/plan.png", positions: {} });

    expect(saveCalls).toBe(0); // still debouncing, same as before flush() existed

    await storage.flush();

    expect(saveCalls).toBe(1); // landed immediately, not 1.5s later
    expect(lastSaved.state.items.positions).toEqual({ dev1: { x: 10, y: 20 } });
    expect(lastSaved.state.items.floorplan.imageUrl).toBe("/local/plan.png");

    vi.useRealTimers();
  });
});
