import { describe, it, expect } from "vitest";
import { replacementCandidates, commandGaps, defaultSelection, runSummary } from "../src/replace.js";

const old = { ieee: "aa:aa:aa:aa:aa:aa:aa:01", manufacturer: "IKEA of Sweden", model: "TRADFRI bulb", name: "Old bulb" };

describe("replace a device", () => {
  it("offers likely replacements first, never the old device or the coordinator", () => {
    const devices = [
      old,
      { ieee: "aa:aa:aa:aa:aa:aa:aa:00", device_type: "Coordinator", name: "Coordinator" },
      { ieee: "aa:aa:aa:aa:aa:aa:aa:02", manufacturer: "Signify", model: "LCT", name: "A Hue bulb" },
      { ieee: "aa:aa:aa:aa:aa:aa:aa:03", manufacturer: "IKEA of Sweden", model: "TRADFRI bulb", name: "Z new bulb" },
      { ieee: "aa:aa:aa:aa:aa:aa:aa:04", manufacturer: "Sonoff", model: "Plug", name: "B plug" },
    ];
    const typeOf = (d) => (/bulb|LCT/.test(d.model || "") ? "light" : "plug");
    const out = replacementCandidates(devices, old, { typeOf });
    expect(out.map((c) => c.device.name)).toEqual(["Z new bulb", "A Hue bulb", "B plug"]);
    expect(out[0].why).toBe("same model");
    expect(out[1].why).toBe("same kind of device");
  });

  it("finds commands the new model was checked and doesn't accept", () => {
    const entry = (model, cmds) => ({
      manufacturer_slug: "x",
      model_slug: model,
      clusters: { "0x0008": { commands_received_scan_count: 1, commands_received: cmds.map((name) => ({ name, present: true })) } },
    });
    const index = [entry("old", ["move", "step", "move_to_level"]), entry("new", ["move_to_level"])];
    const r = commandGaps(index, { manufacturer: "x", model: "old" }, { manufacturer: "x", model: "new" }, [8]);
    expect(r.gaps).toEqual([{ clusterId: 8, missing: ["move", "step"] }]);
    expect(r.unknown).toBe(false);
    expect(commandGaps(index, { manufacturer: "x", model: "old" }, { manufacturer: "x", model: "other" }, [8]).unknown).toBe(true);
  });

  it("ticks what the new device can do, and sums up a run", () => {
    const plan = { items: [{ id: "a", ok: true, new_ep: 1 }, { id: "b", ok: false, new_ep: null }, { id: "c", ok: null, new_ep: 1 }] };
    expect([...defaultSelection(plan)]).toEqual(["a", "c"]);
    expect(runSummary({ a: "confirmed", b: "waiting" })).toEqual({
      level: "info",
      text: "1 copied and confirmed, 1 waiting for a button press on a battery device (they go on automatically when it wakes up)",
    });
    expect(runSummary({ a: "rejected" }).level).toBe("warning");
  });
});
