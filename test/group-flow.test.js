import { describe, it, expect } from "vitest";
import {
  controllerEndpoints, candidateTargets, findMatchingGroup, missingMembers, planClusters,
  flowResult, buildBehaviourReport, knownBehaviour, firmwareKey, suggestGroupName,
  endpointHasGroups, modeOptions, suggestMode, testInstruction, FLOW_CLUSTERS,
} from "../src/group-flow.js";

const rodret = [
  { id: 0, endpoint_id: 1, type: "in" }, { id: 6, endpoint_id: 1, type: "out" },
  { id: 8, endpoint_id: 1, type: "out" }, { id: 0x19, endpoint_id: 1, type: "out" },
];
const dim = [{ id: 6, endpoint_id: 1, type: "in" }, { id: 8, endpoint_id: 1, type: "in" }];
const onoff = [{ id: 6, endpoint_id: 1, type: "in" }];
const twoGang = [{ id: 6, endpoint_id: 1, type: "in" }, { id: 6, endpoint_id: 2, type: "in" }];
const C = { r: rodret, d: dim, o: onoff, t: twoGang };
const clustersFor = (i) => C[i];

describe("controllerEndpoints", () => {
  it("lists endpoints that send light-control clusters", () => {
    expect(controllerEndpoints(rodret)).toEqual([{ endpoint: 1, clusters: [6, 8] }]);
    expect(controllerEndpoints(dim)).toEqual([]);
  });
});

describe("candidateTargets", () => {
  const devices = [
    { ieee: "r", name: "Rodret" }, { ieee: "d", name: "Spots" }, { ieee: "o", name: "Lamp" },
    { ieee: "t", name: "2-gang" }, { ieee: "c", name: "Coordinator", isCoordinator: true }, { ieee: "x", name: "Unread" },
  ];
  it("lists receiving endpoints, skipping the source, coordinator and unread devices, naming multi-endpoint ones", () => {
    const t = candidateTargets({ devices, clustersFor, sourceIeee: "r", clusterIds: [6, 8] });
    expect(t.map((x) => x.name)).toEqual(["2-gang (ep 1)", "2-gang (ep 2)", "Lamp", "Spots"]);
    expect(t.find((x) => x.name === "Spots").clusters).toEqual([6, 8]);
  });
});

describe("groups", () => {
  const groups = [
    { group_id: 3, name: "Test", members: [{ device: { ieee: "D" }, endpoint_id: 1 }, { device: { ieee: "coord" }, endpoint_id: 1 }] },
    { group_id: 4, name: "Two", members: [{ device: { ieee: "d" }, endpoint_id: 1 }, { device: { ieee: "o" }, endpoint_id: 1 }] },
  ];
  it("finds an exact-match group, ignoring the coordinator and IEEE case", () => {
    expect(findMatchingGroup(groups, [{ ieee: "d", endpoint: 1 }], "COORD").group_id).toBe(3);
    expect(findMatchingGroup(groups, [{ ieee: "o", endpoint: 1 }, { ieee: "d", endpoint: 1 }], "coord").group_id).toBe(4);
    expect(findMatchingGroup(groups, [{ ieee: "o", endpoint: 1 }], "coord")).toBeNull();
  });
  it("lists members to add to an existing group", () => {
    expect(missingMembers(groups[0], [{ ieee: "d", endpoint: 1 }, { ieee: "o", endpoint: 1 }])).toEqual([{ ieee: "o", endpoint: 1 }]);
  });
});

describe("planClusters", () => {
  it("includes clusters at least one light supports and explains the rest", () => {
    const p = planClusters([6, 8], [{ ieee: "o", endpoint: 1, name: "Lamp" }], clustersFor);
    expect(p.map((x) => [x.clusterId, x.include])).toEqual([[6, true], [8, false]]);
    expect(p[1].support.unsupported).toEqual(["Lamp"]);
  });
});

describe("flowResult", () => {
  it("is rejected when every bind failed", () => expect(flowResult(["failed", "failed"], null)).toBe("rejected"));
  it("waits while a bind is unconfirmed", () => expect(flowResult(["confirmed", "unconfirmed"], "all")).toBe("unconfirmed"));
  it("waits for the button test", () => expect(flowResult(["confirmed"], null)).toBe("pending_test"));
  it("maps the test answer", () => {
    expect(flowResult(["confirmed", "confirmed"], "all")).toBe("works");
    expect(flowResult(["confirmed", "failed"], "all")).toBe("partial");
    expect(flowResult(["confirmed"], "some")).toBe("partial");
    expect(flowResult(["confirmed"], "none")).toBe("stored_ignored");
  });
});

describe("buildBehaviourReport", () => {
  it("has no names or addresses and hex cluster ids", () => {
    const r = buildBehaviourReport({
      manufacturer: "IKEA of Sweden", model: "RODRET Dimmer", firmware: { sw_build_id: "1.0.47" }, mode: "group",
      endpoint: 1, clusters: [6, 8], targetCount: 2, result: "works", cardVersion: "1.1.0", now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(r).toEqual({
      kind: "behaviour_report", schema: 1, behaviour: "group_binding", manufacturer: "IKEA of Sweden", model: "RODRET Dimmer",
      firmware: { sw_build_id: "1.0.47", registry_sw_version: null }, endpoint: 1, clusters: ["0x0006", "0x0008"],
      target_count: 2, result: "works", card_version: "1.1.0", provenance: { submitted_at: "2026-11-01T00:00:00.000Z" },
    });
  });
});

describe("knownBehaviour", () => {
  const doc = {
    "ikea/rodret": {
      group_binding: {
        counts: { works: 3, rejected: 1 },
        by_firmware: { "1.0.47": { works: 3 }, "1.0.20": { rejected: 1 } },
      },
    },
  };
  it("prefers the user's firmware", () => {
    const k = knownBehaviour(doc, "ikea/rodret", "group_binding", { sw_build_id: "1.0.47" });
    expect(k.state).toBe("works");
    expect(k.text).toBe("Reported to work on firmware 1.0.47: 3 works (3 reports).");
  });
  it("falls back to all firmware and says so", () => {
    const k = knownBehaviour(doc, "ikea/rodret", "group_binding", { sw_build_id: "2.0" });
    expect(k.state).toBe("mixed");
    expect(k.firmwareMatched).toBe(false);
    expect(k.text).toContain("on other firmware than yours, 2.0");
  });
  it("says nobody has reported it yet", () => {
    expect(knownBehaviour(doc, "x/y", "group_binding", null).state).toBe("unknown");
    expect(knownBehaviour(null, "x/y", "group_binding", null).state).toBe("unknown");
  });
  it("reports problems", () => {
    const k = knownBehaviour({ "a/b": { group_binding: { counts: { stored_ignored: 2 } } } }, "a/b", "group_binding", null);
    expect(k.state).toBe("problems");
  });
});

describe("helpers", () => {
  it("firmwareKey and group names", () => {
    expect(firmwareKey({ registry_sw_version: "0x1004" })).toBe("0x1004");
    expect(firmwareKey(null)).toBe("unknown");
    expect(suggestGroupName("Lounge", "Rodret")).toBe("Lounge lights");
    expect(suggestGroupName("No area", "Rodret")).toBe("Rodret lights");
  });
});

describe("groups support and direct/group choice", () => {
  const withGroups = [{ id: 4, endpoint_id: 1, type: "in" }, { id: 6, endpoint_id: 1, type: "in" }];
  const noGroups = [{ id: 6, endpoint_id: 1, type: "in" }, { id: 4, endpoint_id: 2, type: "in" }];
  const CL = { g: withGroups, n: noGroups };
  const devices = [{ ieee: "g", name: "Relay" }, { ieee: "n", name: "ZBMINIL2" }];
  const t = (name, groupable = true) => ({ ieee: name, endpoint: 1, name, groupable });

  it("flags endpoints without the Groups cluster (on the same endpoint)", () => {
    expect(endpointHasGroups(withGroups, 1)).toBe(true);
    expect(endpointHasGroups(noGroups, 1)).toBe(false);
    const c = candidateTargets({ devices, clustersFor: (i) => CL[i], sourceIeee: "r", clusterIds: [6] });
    expect(c.map((x) => [x.name, x.groupable])).toEqual([["Relay", true], ["ZBMINIL2", false]]);
  });

  it("blocks a group when a selected light can't join one, never blocks direct", () => {
    const o = modeOptions([t("A"), t("Spots", false)]);
    expect(o.group.ok).toBe(false);
    expect(o.group.blocked).toEqual(["Spots"]);
    expect(o.direct.ok).toBe(true);
    expect(o.direct.warning).toBe("");
  });

  it("warns, but still allows, direct binding above the soft limit (#384)", () => {
    const five = ["A", "B", "C", "D", "E"].map((n) => t(n));
    const o = modeOptions(five, { clusterCount: 2 });
    expect(o.direct.ok).toBe(true);
    expect(o.direct.warning).toMatch(/about 10 binding-table slots/);
  });

  it("suggests direct for one light, group for several", () => {
    expect(suggestMode([t("A")])).toBe("direct");
    expect(suggestMode([t("A"), t("B")])).toBe("group");
    expect(suggestMode(["A", "B", "C", "D", "E"].map((n) => t(n)))).toBe("group");
  });

  it("suggests direct when a light can't join groups, whatever the count", () => {
    expect(suggestMode([t("A"), t("B"), t("Spots", false)])).toBe("direct");
  });

  it("follows what other users reported", () => {
    const bad = { state: "problems" };
    const five = ["A", "B", "C", "D", "E"].map((n) => t(n));
    // IKEA on/off switch: groups rejected -> direct, even for 5 lights (#384)
    expect(suggestMode(five, { groupKnown: bad })).toBe("direct");
    // Repenic rocker: direct stored but ignored -> group, even for one light
    expect(suggestMode([t("A")], { directKnown: bad })).toBe("group");
  });
});

describe("blinds (zigbee-capabilities#387)", () => {
  const openClose = [{ id: 0, endpoint_id: 1, type: "in" }, { id: 0x0102, endpoint_id: 1, type: "out" }, { id: 0x0019, endpoint_id: 1, type: "out" }];
  const blind = [{ id: 4, endpoint_id: 1, type: "in" }, { id: 0x0102, endpoint_id: 1, type: "in" }];
  it("treats a Window Covering remote as a controller and a blind as a target", () => {
    expect(FLOW_CLUSTERS).toContain(0x0102);
    expect(controllerEndpoints(openClose)).toEqual([{ endpoint: 1, clusters: [0x0102] }]);
    const c = candidateTargets({
      devices: [{ ieee: "b", name: "Blind" }],
      clustersFor: () => blind,
      sourceIeee: "r",
      clusterIds: [0x0102],
    });
    expect(c).toEqual([{ ieee: "b", endpoint: 1, name: "Blind", clusters: [0x0102], groupable: true }]);
  });
  it("asks for the right buttons in the test", () => {
    expect(testInstruction([6, 8])).toBe("Press on/off, then hold to dim");
    expect(testInstruction([6])).toBe("Press on/off");
    expect(testInstruction([0x0102])).toBe("Press open, then close");
    expect(testInstruction(new Set([6, 0x0102]))).toBe("Press on/off and press open/close");
  });
});
