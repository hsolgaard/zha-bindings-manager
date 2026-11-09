import { describe, it, expect } from "vitest";
import fs from "fs";
import {
  detectDeviceType,
  questionsFor,
  buildRecord,
  draftProblem,
  issueUrl,
  answersForFirmware,
  summaryLines,
  answerCountsText,
  cleanText,
} from "../src/device-answers.js";

const q = JSON.parse(fs.readFileSync(new URL("./fixtures/questions.json", import.meta.url), "utf8"));
const c = (id, type, ep = 1) => ({ id, type, endpoint_id: ep });

describe("device answers", () => {
  it("guesses the device type from clusters", () => {
    expect(detectDeviceType([c(0x0006, "in"), c(0x0008, "in"), c(0x0300, "in")])).toBe("light");
    expect(detectDeviceType([c(0x0000, "in"), c(0x0001, "in"), c(0x0006, "out"), c(0x0008, "out")], "Battery")).toBe("remote");
    // Repenic: relay on ep1, buttons on ep2
    expect(detectDeviceType([c(0x0006, "in", 1), c(0x0702, "in", 1), c(0x0006, "out", 2)], "Mains")).toBe("wall_switch");
    expect(detectDeviceType([c(0x0006, "in"), c(0x0702, "in")], "Mains")).toBe("plug");
    expect(detectDeviceType([c(0x0102, "in")])).toBe("cover");
    expect(detectDeviceType([c(0x0406, "in"), c(0x0001, "in")], "Battery")).toBe("sensor");
    expect(detectDeviceType([])).toBe("other");
  });

  it("asks questions that fit the type and use", () => {
    const remoteOnly = questionsFor(q, "wall_switch", "remote_only").map((x) => x.id);
    expect(remoteOnly).toContain("press_sends");
    expect(remoteOnly).not.toContain("power_on");
    expect(remoteOnly).not.toContain("update_changed");
    const wired = questionsFor(q, "wall_switch", "wired_own_load").map((x) => x.id);
    expect(wired).toContain("power_on");
    expect(wired).not.toContain("press_sends");
    expect(questionsFor(q, "light", "lamp", { firmwareChanged: true }).map((x) => x.id)).toContain("update_changed");
  });

  it("builds a record with only answers that apply, and clean free text", () => {
    const draft = {
      deviceType: "wall_switch",
      use: "remote_only",
      answers: { needed_setting: "other", power_on: "last_state", presses_arrive: "", hold_to_dim: "works" },
      other: { needed_setting: "Attr 0 on 0xE00B = 1, mine is 54:f2:83:ff:fe:8a:ae:53" },
      rating: 2,
      tip: "  ",
      context: { system: "zha", coordinator: "" },
    };
    const r = buildRecord(q, { manufacturer: "Repenic Ltd.", model: "RS-R03AZG" }, { sw_build_id: "1.0.5", registry_sw_version: "0x00000017" }, draft, "1.9.0b1", "2026-11-08T12:00:00Z");
    expect(r.answers).toEqual({ needed_setting: "other", hold_to_dim: "works" });
    expect(r.other.needed_setting).toContain("0xE00B");
    expect(r.other.needed_setting).not.toContain("54:f2");
    expect(r.rating).toBe(2);
    expect(r.tip).toBeUndefined();
    expect(r.context).toEqual({ system: "zha" });
    expect(r.firmware).toEqual({ sw_build_id: "1.0.5", registry_sw_version: "0x00000017" });
    const url = issueUrl(r);
    expect(url).toContain("issues/new?title=%5BDevice%20Answers%5D%20Repenic");
    expect(url).toContain("labels=device-answers");
  });

  it("says what's missing before submitting", () => {
    expect(draftProblem(q, {}, { deviceType: "light", use: "lamp", answers: { pairing: "first_time" } })).toMatch(/firmware/);
    expect(draftProblem(q, { sw_build_id: "1" }, { deviceType: "light", answers: {} })).toMatch(/use it for/);
    expect(draftProblem(q, { sw_build_id: "1" }, { deviceType: "light", use: "other", other: {}, answers: {} })).toMatch(/Other/);
    expect(draftProblem(q, { sw_build_id: "1" }, { deviceType: "light", use: "lamp", answers: {} })).toMatch(/at least one/);
    expect(draftProblem(q, { sw_build_id: "1" }, { deviceType: "light", use: "lamp", answers: {}, rating: 4 })).toBe("");
  });

  it("finds this firmware's answers by either version string and summarises them", () => {
    const doc = {
      "repenic-ltd/rs-r03azg": {
        total: 3,
        by_firmware: {
          "1.0.5": {
            total: 2,
            scan_linked: true,
            by_use: {
              remote_only: {
                count: 2,
                ratings: { 2: 1, 3: 1 },
                rating_average: null,
                answers: { presses_arrive: { sometimes_missed: 2 }, needed_setting: { other: 1, mode_setting: 1 } },
                tips: [{ text: "Group bindings only", kind: "tip" }],
              },
            },
          },
          "1.0.6": { total: 1, by_use: {} },
        },
      },
    };
    const dev = { manufacturer: "Repenic Ltd.", model: "RS-R03AZG" };
    const hit = answersForFirmware(doc, dev, { registry_sw_version: "1.0.5" });
    expect(hit.hereKey).toBe("1.0.5");
    expect(hit.others).toEqual([{ firmware: "1.0.6", total: 1 }]);
    const lines = summaryLines(q, hit.here);
    expect(lines[0].useLabel).toMatch(/used as a remote/);
    expect(lines[0].ratingCount).toBe(2);
    const presses = lines[0].questions.find((x) => x.id === "presses_arrive");
    expect(answerCountsText(presses)).toBe("2 of 2: Sometimes missed");
    expect(answersForFirmware(doc, { manufacturer: "X", model: "Y" }, {}).here).toBeNull();
  });

  it("cleans like the database does", () => {
    expect(cleanText("see https://x.y and 10.0.0.1")).toBe("see [link] and [address]");
  });
});

import { formQuestions } from "../src/device-answers.js";
describe("form order", () => {
  it("puts questions for the use first, hides battery ones on mains, keeps the rest behind More", () => {
    const { main, more } = formQuestions(q, "wall_switch", "remote_only", { battery: false });
    expect(main[0].id).toBe("direct_control");
    expect(main.length).toBe(8);
    expect([...main, ...more].some((x) => x.topic === "battery")).toBe(false);
    expect(formQuestions(q, "wall_switch", "wired_own_load").main[0].id).toBe("power_on");
  });
});

describe("switch module behind a normal wall switch", () => {
  it("asks about the switch wired to it, not a button, and about remotes bound to it", () => {
    const { main, more } = formQuestions(q, "switch_module", "wired_own_load", { battery: false });
    const ids = [...main, ...more].map((x) => x.id);
    expect(main[0].id).toBe("power_on");
    expect(ids).toContain("input_detached");
    expect(ids).toContain("wiring");
    expect(main.map((x) => x.id)).toContain("responds_to_bindings");
    expect(ids).not.toContain("decoupled");
    expect(ids).not.toContain("hold_to_dim");
    expect(ids).not.toContain("direct_control");
    expect(q.questions.find((x) => x.id === "router_quality").answers.map((a) => a.id)).toContain("not_a_router");
  });
  it("asks the direct-control questions when the switch input is separated and drives smart bulbs", () => {
    const ids = questionsFor(q, "switch_module", "decoupled_smart_bulbs").map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["direct_control", "press_sends", "presses_arrive", "keeps_bindings"]));
  });
});
