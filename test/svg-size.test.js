import { describe, it, expect } from "vitest";
import { isSvgUrl, svgIntrinsicSize } from "../src/svg-size.js";

describe("SVG floor plan size (1.11.0)", () => {
  it("recognises SVG addresses", () => {
    expect(isSvgUrl("/local/floor1.svg")).toBe(true);
    expect(isSvgUrl("/local/Floor1.SVG?v=2")).toBe(true);
    expect(isSvgUrl("/local/floor1.png")).toBe(false);
    expect(isSvgUrl("")).toBe(false);
  });

  it("uses width and height when the file has them", () => {
    expect(svgIntrinsicSize('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 160 100">', 1200)).toEqual({ w: 1600, h: 1000, explicit: true });
    expect(svgIntrinsicSize("<svg width='1300px' height='800px'>")).toEqual({ w: 1300, h: 800, explicit: true });
  });

  it("falls back to the viewBox, scaled up with the same proportions", () => {
    expect(svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1000">')).toEqual({ w: 1200, h: 2000, explicit: false });
    expect(svgIntrinsicSize('<svg width="100%" height="100%" viewBox="0,0,2000,1000">')).toEqual({ w: 2000, h: 1000, explicit: false });
  });

  it("gives up rather than guess", () => {
    expect(svgIntrinsicSize("<svg>")).toBeNull();
    expect(svgIntrinsicSize("not an svg")).toBeNull();
    expect(svgIntrinsicSize(null)).toBeNull();
  });
});
