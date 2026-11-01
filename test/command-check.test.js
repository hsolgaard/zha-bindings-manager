import { describe, it, expect } from "vitest";
import { formatElapsed, shouldApplyResult, COMMAND_CHECK_LIMIT_MS } from "../src/command-check.js";

describe("formatElapsed", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7400)).toBe("0:07");
    expect(formatElapsed(90000)).toBe("1:30");
    expect(formatElapsed(COMMAND_CHECK_LIMIT_MS)).toBe("2:00");
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("shouldApplyResult", () => {
  it("applies the answer to the check that is running", () => {
    expect(shouldApplyResult({ status: "loading", token: 2 }, 2, true)).toBe(true);
    expect(shouldApplyResult({ status: "loading", token: 2 }, 2, false)).toBe(true);
  });
  it("still uses a late answer after the card stopped waiting", () => {
    expect(shouldApplyResult({ status: "timeout", token: 2 }, 2, true)).toBe(true);
    expect(shouldApplyResult({ status: "stopped", token: 2 }, 1, true)).toBe(true);
  });
  it("doesn't let an older attempt's error overwrite a newer check", () => {
    expect(shouldApplyResult({ status: "loading", token: 3 }, 2, false)).toBe(false);
  });
  it("shows the real error if the same check fails after the card stopped waiting", () => {
    expect(shouldApplyResult({ status: "timeout", token: 2 }, 2, false)).toBe(true);
  });
  it("keeps a result that is already shown", () => {
    expect(shouldApplyResult({ status: "done", token: 3 }, 2, true)).toBe(false);
    expect(shouldApplyResult({ status: "done", token: 3 }, 3, false)).toBe(false);
    expect(shouldApplyResult(undefined, 1, true)).toBe(false);
  });
});
