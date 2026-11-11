import { describe, it, expect } from "vitest";
import { ZhaApi } from "../src/api-client.js";

describe("a device leaving a group (1.10.4)", () => {
  it("tells the lost-bindings watch its bindings to that group go on purpose", async () => {
    const sent = [];
    const api = new ZhaApi({ callWS: async (m) => sent.push(m) });
    api.watchEnabled = true;
    await api.reportLeftGroup("aa:bb:cc:dd:ee:ff:00:11", "5");
    expect(sent).toEqual([
      { type: "zha_bindings_manager/watch_removed", bindings: [{ sourceIeee: "aa:bb:cc:dd:ee:ff:00:11", isGroup: true, groupId: 5 }] },
    ]);
  });
  it("sends nothing when the watch is off", async () => {
    const sent = [];
    const api = new ZhaApi({ callWS: async (m) => sent.push(m) });
    await api.reportLeftGroup("aa:bb:cc:dd:ee:ff:00:11", 5);
    expect(sent).toEqual([]);
  });
});
