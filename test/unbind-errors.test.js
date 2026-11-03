import { describe, it, expect } from "vitest";
import { explainUnbindFailure, toolkitErrorText } from "../src/unbind-errors.js";

describe("explainUnbindFailure", () => {
  it("explains the known removed-device bug", () => {
    expect(explainUnbindFailure({ errors: ["Unknown error"], targetRemoved: true })).toMatch(/known zha-toolkit bug/);
    expect(explainUnbindFailure({ errors: [], targetRemoved: true })).toMatch(/pair the removed device again/);
  });
  it("shows zha-toolkit's own error otherwise", () => {
    expect(explainUnbindFailure({ errors: ["Timeout", "Timeout", "Delivery failed"] })).toBe("zha-toolkit said: Timeout; Delivery failed.");
    expect(explainUnbindFailure({ errors: [] })).toBe("");
  });
  it("strips the service prefix", () => {
    expect(toolkitErrorText(new Error("binds_remove_all failed: Unknown error"))).toBe("Unknown error");
  });
});
