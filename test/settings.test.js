import { describe, it, expect } from "vitest";
import {
  applyItems,
  applySummary,
  claimantsText,
  defaultSelection,
  exportFile,
  formatValue,
  groupRows,
  isClaimant,
  parseImport,
  planCounts,
  resultText,
  rowKey,
  settingName,
  settingsCount,
  snapshotChoices,
  updateServerText,
} from "../src/settings.js";

const SW = "44:9f:da:ff:fe:a4:a7:6d";
const COORD = "44:9f:da:ff:fe:77:0b:94";

const snap = {
  id: "s1",
  taken_at: "2026-11-26T18:30:00+00:00",
  reason: "manual",
  model: "ZBM5-3C-80/86",
  endpoints: {
    1: { "0x0006": { name: "on_off", attributes: { "0x4003": { name: "start_up_on_off", value: 0, label: "Off" } } } },
    3: { "0xfc11": { name: "sonoff_cluster", attributes: { "0x0019": { name: "detach_relay_mode2", value: 4 }, "0x0001": { name: "network_led", value: false } } } },
  },
};

// What settings_plan sends back.
const rows = [
  { endpoint: 1, cluster: 6, cluster_name: "on_off", attribute: 0x4003, name: "start_up_on_off", saved: 0, saved_label: "Off", current: 1, current_label: "On", state: "differs" },
  { endpoint: 3, cluster: 0xfc11, cluster_name: "sonoff_cluster", attribute: 0x19, name: "detach_relay_mode2", saved: 4, current: 0, state: "differs" },
  { endpoint: 3, cluster: 0xfc11, cluster_name: "sonoff_cluster", attribute: 0x01, name: "network_led", saved: false, current: false, state: "same" },
  { endpoint: 2, cluster: 6, cluster_name: "on_off", attribute: 0x4003, name: "start_up_on_off", saved: 0, state: "not_on_device" },
];

describe("settings backups (1.12.0)", () => {
  it("lists a device's backups newest first, the after-reset read last", () => {
    const after = { ...snap, id: "r", reason: "after_reset" };
    const choices = snapshotChoices({ snapshots: [snap, { ...snap, id: "s0", reason: "auto" }], after_reset: after });
    expect(choices.map((c) => c.id)).toEqual(["s1", "s0", "after_reset"]);
    expect(choices[0].label).toContain("backed up by hand");
    expect(choices[2].label).toContain("factory settings");
    expect(snapshotChoices(null)).toEqual([]);
    expect(settingsCount(snap)).toBe(3);
  });

  it("shows values and names for people", () => {
    expect(formatValue(0, "Off")).toBe("Off (0)");
    expect(formatValue(true)).toBe("On");
    expect(formatValue(4)).toBe("4");
    expect(formatValue(undefined)).toBe("—");
    expect(settingName("detach_relay_mode2")).toBe("Detach relay mode2");
  });

  it("ticks only what differs, and writes the saved values", () => {
    const sel = defaultSelection(rows);
    expect([...sel]).toEqual([rowKey(rows[0]), rowKey(rows[1])]);
    sel.delete(rowKey(rows[1])); // the user unticked the detach-relay setting
    expect(applyItems(rows, sel)).toEqual([{ endpoint: 1, cluster: 6, attribute: 0x4003, value: 0 }]);
    expect(planCounts(rows)).toEqual({ differs: 2, same: 1, not_on_device: 1, not_read: 0 });
  });

  it("groups rows by endpoint and cluster", () => {
    const g = groupRows(rows);
    expect(g.map((e) => e.endpoint)).toEqual([1, 2, 3]);
    expect(g[2].clusters[0].rows.length).toBe(2);
  });

  it("says what happened to each setting", () => {
    expect(resultText({ result: "refused", status: "READ_ONLY" })).toBe("refused by the device (READ_ONLY)");
    expect(resultText({ result: "didnt_stick", now: 1, now_label: "On" })).toContain("On (1)");
    const ok = applySummary({ results: [{ result: "restored" }, { result: "restored" }] }, "Lounge switch");
    expect(ok).toEqual({ level: "success", text: "Lounge switch: 2 settings written and checked." });
    expect(applySummary({ results: [{ result: "restored" }, { result: "refused" }] }, "X").level).toBe("warning");
    expect(applySummary({ results: [{ result: "no_answer" }] }, "X").level).toBe("error");
  });

  it("exports and imports a backup", () => {
    const file = exportFile(snap, { ieee: SW, name: "Lounge switch", model: "ZBM5-3C-80/86" });
    const back = parseImport(JSON.stringify(file));
    expect(back.snapshot).toEqual(snap);
    expect(back.device.name).toBe("Lounge switch");
    expect(parseImport(JSON.stringify(snap)).snapshot.id).toBe("s1"); // a bare backup is fine too
    expect(() => parseImport("{nope")).toThrow("isn't JSON");
    expect(() => parseImport(JSON.stringify({ hello: 1 }))).toThrow("isn't a ZHA Bindings Manager settings backup");
  });
});

describe("firmware update servers (1.12.0)", () => {
  const nameOf = (i) => (i === SW ? "ZB-LoungeBIG-Switch-Wall2" : null);

  it("names where a device gets its updates", () => {
    expect(updateServerText({ status: "ok", server: COORD, is_coordinator: true }).level).toBe("ok");
    const bad = updateServerText({ status: "ok", server: SW, is_coordinator: false, not_set: false }, nameOf);
    expect(bad.level).toBe("warning");
    expect(bad.text).toContain("ZB-LoungeBIG-Switch-Wall2, not the coordinator");
    expect(updateServerText({ status: "ok", server: "ff:ff:ff:ff:ff:ff:ff:ff", not_set: true }).text).toContain("not set");
    expect(updateServerText({ status: "no_answer" }).text).toContain("press one of its buttons");
  });

  it("explains devices that claim to be an update server", () => {
    const list = [{ ieee: SW, endpoints: [3] }];
    expect(claimantsText(list, nameOf)).toContain("1 device claims to be a firmware update server (ZB-LoungeBIG-Switch-Wall2)");
    expect(claimantsText([], nameOf)).toBe("");
    expect(isClaimant(list, SW.toUpperCase()).endpoints).toEqual([3]);
    expect(isClaimant(list, COORD)).toBe(null);
  });
});
