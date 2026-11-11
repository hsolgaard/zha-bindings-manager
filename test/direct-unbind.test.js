import { describe, it, expect } from "vitest";
import { ZhaApi } from "../src/api-client.js";
import { removeAndRestoreOp } from "../src/groups.js";

const SRC = "bb:bb:bb:bb:bb:bb:bb:02";
const GONE = "90:fd:9f:ff:fe:d4:b7:4e";
const C = "00:12:4b:00:00:00:00:01";

describe("direct unbind through the integration (1.10.6)", () => {
  it("sends the unbind itself, without zha-toolkit, and reports the removal", async () => {
    const sent = [];
    const api = new ZhaApi({ callWS: async (m) => (sent.push(m), m.type.endsWith("/unbind") ? { status: "SUCCESS" } : {}), services: {} });
    api.directUnbind = true;
    api.watchEnabled = true;
    await api.unbindIeee(SRC, GONE, [0, 6], { endpoint: 1, dstEndpoint: 1 });
    expect(sent.filter((m) => m.type.endsWith("/unbind")).map((m) => [m.cluster, m.target_ieee, m.target_endpoint])).toEqual([
      [0, GONE, 1],
      [6, GONE, 1],
    ]);
    expect(sent.at(-1).type).toBe("zha_bindings_manager/watch_removed");
    await api.unbindGroup(SRC, 5, [0], { endpoint: 1 });
    expect(sent.find((m) => m.group_id === 5)).toMatchObject({ endpoint: 1, cluster: 0 });
  });
  it("throws with the device's own answer", async () => {
    const api = new ZhaApi({ callWS: async () => ({ status: "NO_ENTRY" }), services: {} });
    api.directUnbind = true;
    await expect(api.unbindGroup(SRC, 5, [6], { endpoint: 1 })).rejects.toThrow("the device answered NO_ENTRY");
  });
});

describe("removeAndRestoreOp (card only, 1.10.6)", () => {
  it("removes the bindings to the removed device and puts the others on that cluster back", () => {
    const b = (t, ep = 1, cid = 6) => ({ sourceIeee: SRC, sourceEndpoint: ep, clusterId: cid, isGroup: false, targetIeee: t, targetEndpoint: 1 });
    const dead = b(GONE);
    const all = [dead, b(C), b(GONE, 1, 8), { sourceIeee: SRC, sourceEndpoint: 1, clusterId: 6, isGroup: true, groupId: 3 }];
    expect(removeAndRestoreOp(dead, all)).toEqual({
      sourceIeee: SRC,
      endpoint: 1,
      clusterId: 6,
      method: "remove",
      restore: [{ isGroup: false, ieee: C, endpoint: 1 }, { isGroup: true, groupId: 3 }],
    });
  });
});
