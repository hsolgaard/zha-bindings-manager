import { describe, it, expect } from "vitest";
import { activityRows, median, timesTypical, interestingCounters } from "../src/activity.js";

const flat = (n, len = 60) => Array(len).fill(n);
const spike = (base, last5) => [...flat(base, 55), ...flat(last5, 5)];

describe("activityRows (1.7.0)", () => {
  it("sorts busiest first and works out now, hour and typical", () => {
    const snap = {
      by_device: {
        "AA:00": { nwk: 1, per_minute: flat(2), clusters: { "0x0006": 100, "0x0702": 20 } },
        "aa:01": { nwk: 2, per_minute: spike(1, 4), clusters: {} },
      },
    };
    const { rows, chatty } = activityRows(snap);
    expect(rows.map((r) => r.ieee)).toEqual(["aa:01", "aa:00"]);
    expect(rows[1]).toMatchObject({ now: 2, hour: 120, typical: 2 });
    expect(rows[1].clusters[0]).toEqual(["0x0006", 100]);
    expect(chatty).toEqual([]);
  });
  it("flags a sudden burst, and a device flooding all hour", () => {
    const snap = { by_device: { a: { per_minute: spike(1, 30) }, b: { per_minute: flat(90) }, c: { per_minute: flat(30) } } };
    const { chatty } = activityRows(snap);
    // a: 30/min vs usual 1 -> chatty; b: 90/min all hour -> flood; c: 30/min all hour -> steady, not flagged
    expect(chatty.map((r) => r.ieee)).toEqual(["b", "a"]);
  });
  it("reports messages 'from' the coordinator separately", () => {
    const snap = { coordinator_ieee: "CC:00", by_device: { "cc:00": { per_minute: flat(1) }, a: { per_minute: flat(1) } } };
    const r = activityRows(snap);
    expect(r.fromCoordinator.hour).toBe(60);
    expect(r.rows.map((x) => x.ieee)).toEqual(["a"]);
  });
  it("helpers", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBe(0);
    expect(timesTypical({ now: 30, typical: 1 })).toBe("×30");
    expect(timesTypical({ now: 3, typical: 2 })).toBe("");
    expect(interestingCounters({ coordinator_counters: [{ name: "a", value: 0 }, { name: "b", value: 5 }] })).toEqual([{ name: "b", value: 5 }]);
  });
  it("copes with nothing", () => {
    expect(activityRows(null)).toEqual({ rows: [], chatty: [], fromCoordinator: null });
  });
});
