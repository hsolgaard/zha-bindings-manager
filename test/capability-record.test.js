import { describe, it, expect } from "vitest";
import { extractIdentity, mergeIdentity, firmwareLabel, applyRawDeviceInfo } from "../src/capability-record.js";

const basicScan = (attrs) => ({
  in_clusters: {
    "0x0000": {
      attributes: Object.fromEntries(
        Object.entries(attrs).map(([name, value], i) => [i, { attribute_name: name, attribute_value: value }])
      ),
    },
  },
});

describe("extractIdentity", () => {
  it("keeps every field that has a value, even without sw_build_id", () => {
    expect(extractIdentity(basicScan({ hw_version: 1, date_code: "20240101", app_version: 70 }))).toEqual({
      sw_build_id: null,
      app_version: 70,
      hw_version: 1,
      date_code: "20240101",
    });
  });
  it("treats empty strings as missing and copes with no Basic cluster", () => {
    expect(extractIdentity(basicScan({ date_code: "" })).date_code).toBe(null);
    expect(extractIdentity({ in_clusters: {} })).toEqual({ sw_build_id: null, app_version: null, hw_version: null, date_code: null });
  });
});

describe("firmwareLabel / mergeIdentity", () => {
  it("prefers sw_build_id, then OTA file version, then app_version, then date code", () => {
    expect(firmwareLabel({ sw_build_id: "1.0.8", ota_file_version: "0x00001008" })).toBe("1.0.8");
    expect(firmwareLabel({ ota_file_version: "0x00000046", app_version: 70 })).toBe("OTA 0x00000046");
    expect(firmwareLabel({ app_version: 0 })).toBe("app 0");
    expect(firmwareLabel({ date_code: "20240101" })).toBe("date 20240101");
    expect(firmwareLabel({})).toBe(null);
  });
  it("merges field by field, first non-null wins", () => {
    expect(mergeIdentity({ app_version: 70 }, { app_version: 1, hw_version: 2 })).toEqual({
      sw_build_id: null,
      app_version: 70,
      hw_version: 2,
      date_code: null,
      ota_file_version: null,
    });
  });
});

// A record as the card builds it from a quirked device: ZHA shows the
// quirk's friendly name, endpoint 1 claims the quirk's virtual 0x0012
// cluster with quirk class names, and the quirk adds a fake endpoint 3.
const quirkedRecord = () => ({
  manufacturer: "18ejxno0",
  model: "Moes-2-gang",
  identity: { sw_build_id: null, hw_version: 1, date_code: null },
  endpoints: [
    {
      endpoint: { id: 1, profile: "0x0104", device_type: "0xffff", in_clusters: ["0x0000", "0x0006", "0x0012"], out_clusters: ["0x0019"] },
      scanned: true,
      clusters: {
        "0x0000": { name: "CustomBasicCluster", commands_received: [], attributes_confirmed: [{ id: 4 }] },
        "0x0006": { name: "TuyaOnOff", commands_received: [{ id: 0, name: "off", present: true }] },
        "0x0012": { name: "CustomMultistateInputCluster", commands_received: [] },
      },
    },
    { endpoint: { id: 3, in_clusters: ["0x0006"], out_clusters: [] }, scanned: false },
  ],
  provenance: { submitted_at: "2026-10-31T00:00:00Z", card_version: "1.1.0" },
});

const raw = () => ({
  manufacturer: { status: "ok", value: "_TZ3000_18ejxno0" },
  model: { status: "ok", value: "TS0012" },
  identity: {
    sw_build_id: { status: "unsupported", value: null },
    app_version: { status: "ok", value: 70 },
    hw_version: { status: "ok", value: 1 },
    date_code: { status: "ok", value: "" },
    ota_file_version: { status: "ok", value: "0x00000046" },
  },
  signature: {
    status: "ok",
    endpoints: [
      { id: 1, status: "ok", profile: "0x0104", device_type: "0x0100", in_clusters: ["0x0000", "0x0006", "0xe001"], out_clusters: ["0x0019"] },
      { id: 242, status: "ok", profile: "0xa1e0", device_type: "0x0061", in_clusters: [], out_clusters: ["0x0021"] },
    ],
  },
  standard_cluster_names: { "0x0000": "Basic", "0x0006": "OnOff", "0x0019": "Ota", "0x0021": "GreenPowerProxy" },
  node: { logical_type: "Router", mains_powered: true, rx_on_when_idle: true },
  quirk_applied: true,
});

describe("applyRawDeviceInfo", () => {
  it("without integration data, marks the record as ZHA-sourced and leaves it alone", () => {
    const r = applyRawDeviceInfo(quirkedRecord(), null, null);
    expect(r.model).toBe("Moes-2-gang");
    expect(r.provenance.identity_source).toBe("zha");
    expect(r.provenance.signature_source).toBe("zha");
  });

  it("uses the device's own manufacturer/model and only flags that ZHA showed something else", () => {
    const r = applyRawDeviceInfo(quirkedRecord(), raw(), { manufacturer: "18ejxno0", model: "Moes-2-gang" });
    expect(r.manufacturer).toBe("_TZ3000_18ejxno0");
    expect(r.model).toBe("TS0012");
    expect(r.provenance.identity_source).toBe("device");
    expect(r.provenance.display_name_differs).toBe(true);
    expect(JSON.stringify(r)).not.toContain("Moes-2-gang");
    expect(r.provenance.quirk_applied).toBe(true);
  });

  it("fills firmware from the raw reads and keeps per-field status", () => {
    const r = applyRawDeviceInfo(quirkedRecord(), raw(), null);
    expect(r.identity).toEqual({ sw_build_id: null, app_version: 70, hw_version: 1, date_code: null, ota_file_version: "0x00000046" });
    expect(r.identity_status.sw_build_id).toBe("unsupported");
    expect(firmwareLabel(r.identity)).toBe("OTA 0x00000046");
  });

  it("takes the signature from the device, drops quirk-only clusters and endpoints, renames standard clusters", () => {
    const r = applyRawDeviceInfo(quirkedRecord(), raw(), null);
    expect(r.endpoints.map((e) => e.endpoint.id)).toEqual([1, 242]);
    const ep1 = r.endpoints[0];
    expect(ep1.endpoint.device_type).toBe("0x0100");
    expect(ep1.endpoint.in_clusters).toEqual(["0x0000", "0x0006", "0xe001"]);
    expect(Object.keys(ep1.clusters)).toEqual(["0x0000", "0x0006"]);
    expect(ep1.clusters["0x0000"].name).toBe("Basic");
    expect(ep1.clusters["0x0006"].name).toBe("OnOff");
    expect(ep1.clusters["0x0006"].commands_received[0].name).toBe("off"); // scan results kept
    expect(ep1.quirk_only_clusters).toEqual(["0x0012"]);
    expect(ep1.not_scanned_clusters).toEqual(["0xe001"]);
    expect(r.endpoints[1].scanned).toBe(false);
    expect(r.quirk_only_endpoints).toEqual([3]);
    expect(r.node.logical_type).toBe("Router");
    expect(r.provenance.signature_source).toBe("device");
  });

  it("falls back to ZHA's endpoint when one descriptor request failed, and says so", () => {
    const x = raw();
    x.signature.status = "no_response";
    x.signature.endpoints.push({ id: 3, status: "no_response" });
    const r = applyRawDeviceInfo(quirkedRecord(), x, null);
    const ep3 = r.endpoints.find((e) => e.endpoint.id === 3);
    expect(ep3.signature_source).toBe("zha");
    expect(r.quirk_only_endpoints).toBeUndefined();
    expect(r.provenance.signature_source).toBe("partial");
  });

  it("keeps ZHA's identity when the device didn't answer the Basic read", () => {
    const x = raw();
    x.manufacturer = { status: "no_response", value: null };
    const r = applyRawDeviceInfo(quirkedRecord(), x, null);
    expect(r.manufacturer).toBe("18ejxno0");
    expect(r.provenance.identity_source).toBe("zha");
  });
});
