import { describe, it, expect } from "vitest";
import { summarizeScan, isBatteryPowered, toolkitAvailable } from "../src/scan-summary.js";

const plug = (name) => ({ device: { power_source: "Mains", name }, name, error: new Error("binds_get failed: timeout") });
const sensor = (name) => ({ device: { power_source: "Battery or Unknown", name }, name, error: new Error("timeout") });
const coordinator = { device: { power_source: "Mains", device_type: "Coordinator" }, name: "Coordinator", error: new Error("Service zha_toolkit.binds_get is not available.") };

describe("isBatteryPowered", () => {
  it("treats ZHA's 'Battery or Unknown' as battery and Mains as not", () => {
    expect(isBatteryPowered({ power_source: "Battery or Unknown" })).toBe(true);
    expect(isBatteryPowered({ power_source: "Mains" })).toBe(false);
    expect(isBatteryPowered(undefined)).toBe(false);
  });
});

describe("toolkitAvailable", () => {
  it("is true only when zha_toolkit.binds_get is registered", () => {
    expect(toolkitAvailable({ services: { zha_toolkit: { binds_get: {} } } })).toBe(true);
    expect(toolkitAvailable({ services: { zha_toolkit: {} } })).toBe(false);
    expect(toolkitAvailable({ services: {} })).toBe(false);
    expect(toolkitAvailable(null)).toBe(false);
  });
});

describe("summarizeScan", () => {
  it("everything failed including mains devices: blames zha-toolkit, shows the first mains error (issue #2)", () => {
    const r = summarizeScan({
      okCount: 0,
      partialCount: 0,
      failures: [sensor("Door"), coordinator, plug("Air Fryer"), sensor("Leak")],
    });
    expect(r.level).toBe("error");
    expect(r.message).toMatch(/no device responded \(4 of 4\)/);
    expect(r.message).toMatch(/isn't sleepy devices/);
    expect(r.message).toMatch(/First error: "Service zha_toolkit\.binds_get is not available\."/);
    expect(r.message).not.toMatch(/sleepy\/offline devices are normal/);
  });

  it("everything failed but all are battery devices: they're asleep, not a toolkit problem", () => {
    const r = summarizeScan({ okCount: 0, partialCount: 0, failures: [sensor("A"), sensor("B")] });
    expect(r.level).toBe("info");
    expect(r.message).toMatch(/2 battery device\(s\) did not respond \(normal/);
    expect(r.message).not.toMatch(/zha-toolkit/);
  });

  it("a single failed device isn't enough to blame zha-toolkit", () => {
    const r = summarizeScan({ okCount: 0, partialCount: 0, failures: [plug("Lamp")] });
    expect(r.message).toMatch(/1 mains-powered device\(s\) did not respond .*: Lamp/);
    expect(r.message).not.toMatch(/zha-toolkit/);
  });

  it("some failed: separates mains (named, error) from battery (normal)", () => {
    const r = summarizeScan({
      okCount: 20,
      partialCount: 0,
      failures: [sensor("A"), sensor("B"), plug("Kettle")],
    });
    expect(r.level).toBe("error");
    expect(r.message).toBe(
      "Scan complete: 20 device(s) read, 1 mains-powered device(s) did not respond (check they're online in ZHA): Kettle, " +
        "2 battery device(s) did not respond (normal, they sleep: wake one and use its Rescan)."
    );
  });

  it("only battery devices failed: info, not error", () => {
    expect(summarizeScan({ okCount: 10, partialCount: 0, failures: [sensor("A")] }).level).toBe("info");
  });

  it("names at most three mains devices", () => {
    const r = summarizeScan({ okCount: 5, partialCount: 0, failures: ["A", "B", "C", "D", "E"].map(plug) });
    expect(r.message).toMatch(/: A, B, C and 2 more\./);
  });

  it("all good, with skipped and cleared devices", () => {
    const r = summarizeScan({ okCount: 7, partialCount: 1, failures: [], skippedNames: ["Old switch"], prunedCount: 2 });
    expect(r.level).toBe("info");
    expect(r.message).toBe(
      "Scan complete: 7 device(s) read, 1 partial (a later page timed out — rescan for the rest). " +
        "Also skipped Old switch (no longer in ZHA); cleared saved data for 2 device(s) no longer in ZHA."
    );
    expect(summarizeScan({ okCount: 3, partialCount: 0, failures: [] })).toEqual({
      level: "success",
      message: "Scan complete: 3 device(s) read.",
    });
  });
});
