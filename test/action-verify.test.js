import { describe, it, expect } from "vitest";
import { bindOutcome, unbindOutcome, pendingKey, reconcilePending, OUTCOME_LEVEL } from "../src/action-verify.js";

describe("bindOutcome", () => {
  it("is confirmed when the binding is there after the check", () => {
    expect(bindOutcome({ present: true, sourceRead: true })).toBe("confirmed");
  });
  it("counts the binding as confirmed even if this read failed but the cache already shows it", () => {
    expect(bindOutcome({ present: true, sourceRead: false })).toBe("confirmed");
  });
  it("is a real failure only when the device answered and the binding is missing", () => {
    expect(bindOutcome({ present: false, sourceRead: true })).toBe("failed");
  });
  it("is unconfirmed, not failed, when a sleeping device didn't answer the check", () => {
    expect(bindOutcome({ present: false, sourceRead: false })).toBe("unconfirmed");
    expect(OUTCOME_LEVEL.unconfirmed).toBe("warning");
  });
});

describe("unbindOutcome", () => {
  it("confirms removal when the device answered and the binding is gone", () => {
    expect(unbindOutcome({ before: true, present: false, sourceRead: true })).toBe("confirmed");
  });
  it("reports 'absent' when it wasn't there to begin with", () => {
    expect(unbindOutcome({ before: false, present: false, sourceRead: true })).toBe("absent");
    expect(unbindOutcome({ before: false, present: false, sourceRead: false })).toBe("absent");
  });
  it("fails when the device answered and the binding is still there", () => {
    expect(unbindOutcome({ before: true, present: true, sourceRead: true })).toBe("failed");
  });
  it("is unconfirmed when the device didn't answer (cache still shows the old binding)", () => {
    expect(unbindOutcome({ before: true, present: true, sourceRead: false })).toBe("unconfirmed");
  });
});

describe("pendingKey", () => {
  const base = { kind: "bind", sourceIeee: "AA:BB", sourceEndpoint: 1, clusterId: 6 };
  it("ignores IEEE case and separates device, endpoint and group targets", () => {
    const a = pendingKey({ ...base, target: { isGroup: false, ieee: "CC:DD", endpoint: 1 } });
    const b = pendingKey({ ...base, sourceIeee: "aa:bb", target: { isGroup: false, ieee: "cc:dd", endpoint: 1 } });
    const c = pendingKey({ ...base, target: { isGroup: false, ieee: "cc:dd", endpoint: 2 } });
    const g = pendingKey({ ...base, target: { isGroup: true, groupId: 5 } });
    expect(a).toBe(b);
    expect(new Set([a, c, g]).size).toBe(3);
    expect(pendingKey({ ...base, kind: "unbind", target: { isGroup: true, groupId: 5 } })).not.toBe(g);
  });
});

describe("reconcilePending", () => {
  const bindA = { kind: "bind", sourceIeee: "a", sourceEndpoint: 1, clusterId: 6, target: { isGroup: true, groupId: 1 } };
  const bindB = { kind: "bind", sourceIeee: "b", sourceEndpoint: 1, clusterId: 8, target: { isGroup: true, groupId: 1 } };
  const unbindC = { kind: "unbind", sourceIeee: "c", sourceEndpoint: 1, clusterId: 6, target: { isGroup: true, groupId: 2 } };

  it("keeps entries pending while their source still hasn't answered", () => {
    const r = reconcilePending([bindA, bindB], { isPresent: () => false, wasRead: () => false });
    expect(r.pending).toEqual([bindA, bindB]);
    expect(r.resolved).toEqual([]);
  });
  it("decides each entry once its source is read", () => {
    const present = new Set(["a"]);
    const read = new Set(["a", "b", "c"]);
    const r = reconcilePending([bindA, bindB, unbindC], {
      isPresent: (e) => present.has(e.sourceIeee),
      wasRead: (ieee) => read.has(ieee),
    });
    expect(r.pending).toEqual([]);
    expect(r.resolved.map((x) => [x.entry.sourceIeee, x.outcome])).toEqual([
      ["a", "confirmed"],
      ["b", "failed"],
      ["c", "confirmed"],
    ]);
  });
  it("handles an empty or missing list", () => {
    expect(reconcilePending(undefined, { isPresent: () => true, wasRead: () => true })).toEqual({ pending: [], resolved: [] });
  });
});
