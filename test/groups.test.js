import { describe, it, expect } from "vitest";
import { groupRows, groupUnbindPlan, groupIdHex, groupDeleteReasons } from "../src/groups.js";

const C = "00:12:4b:00:00:00:00:01";
const R = "aa:aa:aa:aa:aa:aa:aa:01";
const L1 = "bb:bb:bb:bb:bb:bb:bb:02";
const L2 = "cc:cc:cc:cc:cc:cc:cc:03";
const gb = (src, ep, cid, gid) => ({ sourceIeee: src, sourceEndpoint: ep, clusterId: cid, isGroup: true, groupId: gid, targetIeee: null });
const groups = [
  { group_id: 5, name: "Kitchen", members: [{ device: { ieee: L1 }, endpoint_id: 1 }, { device: { ieee: C }, endpoint_id: 1 }, { device: { ieee: L2.toUpperCase() }, endpoint_id: 11 }] },
  { group_id: 6, name: "attic", members: [] },
];
const bindings = [gb(R, 1, 6, 5), gb(R, 1, 8, 5), gb(R, 2, 6, 5), gb(L1, 1, 0, 5), gb(R, 1, 6, 6), { sourceIeee: R, sourceEndpoint: 1, clusterId: 6, isGroup: false, targetIeee: L1 }];
const classify = (b) => (b.clusterId === 0 ? "reporting" : "control");

describe("groupRows", () => {
  it("lists members without the coordinator, controllers per endpoint, and other bindings", () => {
    const rows = groupRows({ groups, bindings, classify, coordinatorIeee: C });
    expect(rows.map((r) => r.name)).toEqual(["attic", "Kitchen"]);
    const k = rows[1];
    expect(k.members).toEqual([{ ieee: L1, endpoint: 1 }, { ieee: L2, endpoint: 11 }]);
    expect(k.controllers).toEqual([
      { sourceIeee: R, endpoint: 1, clusters: [6, 8] },
      { sourceIeee: R, endpoint: 2, clusters: [6] },
    ]);
    expect(k.others).toBe(1);
    expect(rows[0].controllers).toEqual([{ sourceIeee: R, endpoint: 1, clusters: [6] }]);
  });
});

describe("groupUnbindPlan", () => {
  const clusters = {
    [R]: [{ id: 6, endpoint_id: 1, type: "out" }, { id: 8, endpoint_id: 1, type: "out" }, { id: 6, endpoint_id: 2, type: "out" }],
    [L1]: [{ id: 0, endpoint_id: 1, type: "in" }, { id: 6, endpoint_id: 1, type: "in" }],
  };
  const clustersFor = (i) => clusters[i];
  it("unbind_group for clusters the device sends, binds_remove_all for a light reporting to the group", () => {
    expect(groupUnbindPlan(5, [...bindings, gb(R, 1, 6, 5)], { clustersFor })).toEqual([
      { sourceIeee: R, endpoint: 1, clusterId: 6, method: "group" },
      { sourceIeee: R, endpoint: 1, clusterId: 8, method: "group" },
      { sourceIeee: R, endpoint: 2, clusterId: 6, method: "group" },
      { sourceIeee: L1, endpoint: 1, clusterId: 0, method: "remove" },
    ]);
    expect(groupUnbindPlan(9, bindings, { clustersFor })).toEqual([]);
  });
  it("skips a reporting binding that shares its endpoint and cluster with another binding", () => {
    const more = [...bindings, { sourceIeee: L1, sourceEndpoint: 1, clusterId: 0, isGroup: false, targetIeee: C, targetEndpoint: 1 }];
    expect(groupUnbindPlan(5, more, { clustersFor }).find((o) => o.sourceIeee === L1).method).toBe("skip");
  });
  it("falls back to unbind_group when the clusters aren't known", () => {
    expect(groupUnbindPlan(5, [gb(L1, 1, 0, 5)]).map((o) => o.method)).toEqual(["group"]);
  });
});

describe("groupDeleteReasons", () => {
  it("says why per device", () => {
    expect(
      groupDeleteReasons([
        { name: "Wall", battery: false, errors: ["unknown error (no details)"], answered: true },
        { name: "Orb", battery: true, errors: [], answered: false },
        { name: "Spots", skipped: true },
        { name: "Odd", battery: false, errors: ["Status.NOT_SUPPORTED"], answered: true },
        { name: "Stuck", battery: false, errors: [], answered: true },
      ])
    ).toEqual([
      "Wall didn't answer: it may be offline or switched off at the wall.",
      "Orb didn't answer: it's on battery, so wake it (press a button) and try again.",
      "Spots: it reports its own state to the group on a cluster it also uses for other bindings, and zha-toolkit can only remove them all together, so this one was left.",
      "Odd: zha-toolkit said Status.NOT_SUPPORTED.",
      "Stuck: zha-toolkit reported success, but the binding is still there.",
    ]);
  });
});

it("groupIdHex", () => expect(groupIdHex(5)).toBe("0x0005"));
