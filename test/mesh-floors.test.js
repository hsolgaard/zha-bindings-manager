import { describe, it, expect } from "vitest";
import { allFloorsGeometry, allFloorsPos, PANEL_SIZE } from "../src/mesh-floors.js";

const floors = [
  { id: "ground", name: "Ground", w: 600, h: 1000 },
  { id: "first", name: "First", w: 1200, h: 1000 },
];

describe("all floors picture (1.11.0)", () => {
  it("puts floors side by side at the same height, lowest first", () => {
    const g = allFloorsGeometry(floors);
    expect(g.panels.ground).toMatchObject({ x: 0, w: 600, h: PANEL_SIZE });
    expect(g.panels.first.x).toBeGreaterThan(600);
    expect(g.panels.first.w).toBe(1200);
    expect(g.panels.first.y).toBe(g.panels.ground.y);
    expect(g.w).toBe(Math.round(g.panels.first.x + 1200));
  });

  it("stacks floors at the same width on a phone", () => {
    const g = allFloorsGeometry(floors, { stacked: true });
    expect(g.panels.ground).toMatchObject({ x: 0, w: PANEL_SIZE, h: (1000 * PANEL_SIZE) / 600 });
    expect(g.panels.first.y).toBeGreaterThan(g.panels.ground.y + g.panels.ground.h);
    expect(g.w).toBe(PANEL_SIZE);
  });

  it("skips floors whose image size isn't known", () => {
    const g = allFloorsGeometry([...floors, { id: "loft", name: "Loft", w: 0, h: 0 }]);
    expect(g.panels.loft).toBeUndefined();
  });

  it("places a device from its spot on its own floor's plan", () => {
    const g = allFloorsGeometry(floors);
    expect(allFloorsPos(g, "first", { x: 0.5, y: 0.5 })).toEqual({ x: g.panels.first.x + 600, y: g.panels.first.y + 500 });
    expect(allFloorsPos(g, "loft", { x: 0.5, y: 0.5 })).toBeNull();
    expect(allFloorsPos(g, "first", null)).toBeNull();
  });
});
