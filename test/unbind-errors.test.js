import { describe, it, expect } from "vitest";
import { explainUnbindFailure, toolkitErrorText } from "../src/unbind-errors.js";

describe("explainUnbindFailure", () => {
  it("explains the known removed-device bug", () => {
    expect(explainUnbindFailure({ errors: ["Unknown error"], targetRemoved: true })).toMatch(/known zha-toolkit bug/);
    expect(explainUnbindFailure({ errors: [], targetRemoved: true })).toMatch(/sends the unbind itself/);
    // zha-toolkit's KeyError for a removed device arrives as just its address (Mayhem_SWE, 1.10.6)
    expect(explainUnbindFailure({ errors: ["90:fd:9f:ff:fe:d4:b7:4e"], targetRemoved: true, targetIeee: "90:FD:9F:FF:FE:D4:B7:4E" })).toMatch(/known zha-toolkit bug/);
    expect(explainUnbindFailure({ errors: ["the device answered NO_ENTRY"] })).toMatch(/won't remove a binding they created themselves/);
    expect(explainUnbindFailure({ errors: ["the device didn't answer"] })).toBe("The device didn't answer.");
  });
  it("shows zha-toolkit's own error otherwise", () => {
    expect(explainUnbindFailure({ errors: ["Timeout", "Timeout", "Delivery failed"] })).toBe("zha-toolkit said: Timeout; Delivery failed.");
    expect(explainUnbindFailure({ errors: [] })).toBe("");
  });
  it("strips the service prefix", () => {
    expect(toolkitErrorText(new Error("binds_remove_all failed: Unknown error"))).toBe("Unknown error");
  });
});
