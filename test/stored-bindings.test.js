import { describe, it, expect } from "vitest";
import { sanitizeStoredBinding, sanitizeStoredBindings, isIeee } from "../src/parser.js";

const R = "aa:aa:aa:aa:aa:aa:aa:01";
const L = "bb:bb:bb:bb:bb:bb:bb:02";
const good = { id: `${R}|1|0x0006|${L}:1`, sourceIeee: R, sourceEndpoint: 1, clusterId: 6, isGroup: false, targetIeee: L, targetEndpoint: 1, groupId: null };

describe("sanitizeStoredBindings", () => {
  it("keeps well-formed device and group bindings as they were", () => {
    const g = { id: `${R}|1|8|g5`, sourceIeee: R, sourceEndpoint: 1, clusterId: 8, isGroup: true, targetIeee: null, targetEndpoint: null, groupId: 5 };
    const { bindings, dropped } = sanitizeStoredBindings({ [R]: [good, g] });
    expect(dropped).toBe(0);
    expect(bindings.get(R)).toEqual([good, g]);
  });

  it("drops markup in any field and replaces an unsafe id", () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const { bindings, dropped } = sanitizeStoredBindings({
      [R]: [
        { ...good, id: evil },
        { ...good, sourceEndpoint: evil },
        { ...good, targetEndpoint: "1<b>" },
        { ...good, targetIeee: evil },
        { ...good, clusterId: "x" },
        { ...good, isGroup: true, groupId: evil },
      ],
      [evil]: [good],
    });
    expect(dropped).toBe(6);
    expect(bindings.size).toBe(1);
    expect(bindings.get(R)).toHaveLength(1);
    expect(bindings.get(R)[0].id).toBe(`${R}|1|6|${L}:1`);
  });

  it("coerces numeric strings and hex, rejects out-of-range values", () => {
    expect(sanitizeStoredBinding({ ...good, sourceEndpoint: "2", clusterId: "0x0008" }, R)).toMatchObject({ sourceEndpoint: 2, clusterId: 8 });
    expect(sanitizeStoredBinding({ ...good, sourceEndpoint: 256 }, R)).toBeNull();
    expect(sanitizeStoredBinding({ ...good, clusterId: 0x10000 }, R)).toBeNull();
    expect(sanitizeStoredBinding({ ...good, sourceEndpoint: 1.5 }, R)).toBeNull();
  });

  it("handles junk input", () => {
    expect(sanitizeStoredBindings(null).bindings.size).toBe(0);
    expect(sanitizeStoredBindings([good]).bindings.size).toBe(0);
    expect(sanitizeStoredBindings({ [R]: "nope" }).dropped).toBe(1);
    expect(isIeee("AA:AA:AA:AA:AA:AA:AA:01")).toBe(true);
    expect(isIeee("aa:aa")).toBe(false);
  });
});
