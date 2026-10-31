// ---------------------------------------------------------------------------
// Capability-record helpers for "Share this scan".
//
// Background: zha_toolkit's scan_device sends real ZCL discovery requests,
// but it picks which endpoints and clusters to ask about, and reports the
// profile, device type, manufacturer and model, from zigpy's in-memory
// device, which is the quirk's version whenever a quirk is loaded. ZHA's own
// device list shows a quirk's friendly_name too. So a record built only from
// those can describe the quirk instead of the device (the database had to
// quarantine several such records, e.g. a Tuya switch submitted as
// "18ejxno0 / Moes-2-gang" with a device_type 0xffff the device never
// reports).
//
// When the integration is installed, its raw_device_info command asks the
// device itself (ZDO descriptors + raw Basic/OTA reads). applyRawDeviceInfo()
// below folds that into the record. Without the integration the record is
// built as before, but marked identity_source/signature_source "zha" so the
// database can tell the two apart.
// ---------------------------------------------------------------------------

const IDENTITY_FIELDS = ["sw_build_id", "app_version", "hw_version", "date_code", "ota_file_version"];

const num = (v) => Number(v);
const hex4 = (n) => `0x${Number(n).toString(16).padStart(4, "0")}`;

/** Basic-cluster identity values from one endpoint's scan_device result,
 *  matched by zigpy's decoded attribute names. Every field that has a value
 *  is kept (previously the whole identity was dropped unless sw_build_id
 *  was present, which threw away hw_version/date_code on most Tuya devices). */
export function extractIdentity(epScan) {
  const inClusters = (epScan && epScan.in_clusters) || {};
  const basicKey = Object.keys(inClusters).find((k) => num(k) === 0);
  const basic = basicKey != null ? inClusters[basicKey] : null;
  const find = (name) => {
    if (!basic || !basic.attributes) return null;
    const hit = Object.values(basic.attributes).find((a) => a.attribute_name === name);
    return hit && hit.attribute_value != null && hit.attribute_value !== "" ? hit.attribute_value : null;
  };
  return {
    sw_build_id: find("sw_build_id"),
    app_version: find("app_version"),
    hw_version: find("hw_version"),
    date_code: find("date_code"),
  };
}

/** Merges identities field by field: the first non-null value wins. */
export function mergeIdentity(...identities) {
  const out = {};
  IDENTITY_FIELDS.forEach((f) => {
    const hit = identities.find((i) => i && i[f] != null && i[f] !== "");
    out[f] = hit ? hit[f] : null;
  });
  return out;
}

/** One human-readable firmware label for titles: sw_build_id, then the OTA
 *  file version, then app_version, then date code. Null if nothing is known. */
export function firmwareLabel(identity) {
  if (!identity) return null;
  if (identity.sw_build_id) return String(identity.sw_build_id);
  if (identity.ota_file_version) return `OTA ${identity.ota_file_version}`;
  if (identity.app_version != null && identity.app_version !== "") return `app ${identity.app_version}`;
  if (identity.date_code) return `date ${identity.date_code}`;
  return null;
}

const okValue = (part) =>
  part && part.status === "ok" && part.value != null && part.value !== "" ? part.value : null;

/** Folds the integration's raw_device_info result into a record built by
 *  the card from scan_device + ZHA. Returns a new record; the input isn't
 *  mutated. `zhaDevice` is ZHA's device entry (for the displayed name).
 *
 *  - manufacturer/model: the device's own Basic values when it answered.
 *  - identity: raw values first, scan values as fallback, plus a per-field
 *    identity_status (ok / unsupported / no_response / ...).
 *  - endpoints: the device's own descriptors decide which endpoints exist,
 *    their profile/device type and cluster lists. Scanned cluster results
 *    are kept only for clusters the device itself declares; clusters only
 *    the quirk declared are listed under quirk_only_clusters (never as
 *    capabilities), and declared clusters the scan couldn't reach under
 *    not_scanned_clusters.
 *  - Standard cluster names come from zigpy's registry, not quirk classes. */
export function applyRawDeviceInfo(record, raw, zhaDevice) {
  const out = JSON.parse(JSON.stringify(record));
  out.provenance = { ...(out.provenance || {}) };
  if (!raw) {
    out.provenance.identity_source = "zha";
    out.provenance.signature_source = "zha";
    return out;
  }

  const rawMfr = okValue(raw.manufacturer);
  const rawModel = okValue(raw.model);
  if (rawMfr && rawModel) {
    out.manufacturer = rawMfr;
    out.model = rawModel;
    out.provenance.identity_source = "device";
    const shownMfr = (zhaDevice && zhaDevice.manufacturer) || record.manufacturer;
    const shownModel = (zhaDevice && zhaDevice.model) || record.model;
    // Only the fact is recorded, never the displayed name itself: a local
    // quirk's friendly_name can be any text the user chose.
    out.provenance.display_name_differs = shownMfr !== rawMfr || shownModel !== rawModel;
  } else {
    out.provenance.identity_source = "zha";
  }

  const rawIdentity = {};
  const status = {};
  IDENTITY_FIELDS.forEach((f) => {
    const part = raw.identity && raw.identity[f];
    rawIdentity[f] = okValue(part);
    if (part && part.status) status[f] = part.status;
  });
  out.identity = mergeIdentity(rawIdentity, record.identity);
  out.identity_status = status;

  if (raw.node && Object.keys(raw.node).length) out.node = { ...raw.node };
  if (typeof raw.quirk_applied === "boolean") out.provenance.quirk_applied = raw.quirk_applied;

  const names = raw.standard_cluster_names || {};
  const sig = raw.signature || {};
  const rawEps = (sig.endpoints || []).filter((e) => e && e.status === "ok");
  if (!rawEps.length) {
    out.provenance.signature_source = "zha";
    return out;
  }

  const byId = new Map((record.endpoints || []).map((e) => [num(e.endpoint && e.endpoint.id), e]));
  const failedIds = new Set((sig.endpoints || []).filter((e) => e && e.status !== "ok").map((e) => num(e.id)));
  const endpoints = [];
  let allFromDevice = sig.status === "ok";

  rawEps.forEach((rep) => {
    const epId = num(rep.id);
    const inIds = (rep.in_clusters || []).map(num);
    const outIds = (rep.out_clusters || []).map(num);
    const prev = byId.get(epId);
    const ep = {
      endpoint: {
        id: epId,
        profile: rep.profile || null,
        device_type: rep.device_type || null,
        in_clusters: inIds.map(hex4),
        out_clusters: outIds.map(hex4),
      },
      scanned: !!(prev && prev.scanned),
    };
    if (prev && prev.scanned) {
      const clusters = {};
      const quirkOnly = [];
      Object.entries(prev.clusters || {}).forEach(([key, c]) => {
        const id = num(key);
        if (!inIds.includes(id)) {
          quirkOnly.push(hex4(id));
          return;
        }
        const std = names[hex4(id)];
        clusters[hex4(id)] = { ...c, name: std || c.name };
      });
      ep.clusters = clusters;
      const notScanned = inIds.filter((id) => !(hex4(id) in clusters)).map(hex4);
      if (quirkOnly.length) ep.quirk_only_clusters = quirkOnly;
      if (notScanned.length) ep.not_scanned_clusters = notScanned;
    }
    endpoints.push(ep);
    byId.delete(epId);
  });

  // Endpoints the device didn't describe: keep ZHA's version only when the
  // descriptor request for that endpoint failed (marked as such); endpoints
  // that exist only in the quirk are dropped and listed.
  const quirkOnlyEndpoints = [];
  byId.forEach((e, epId) => {
    if (failedIds.has(epId)) {
      endpoints.push({ ...e, signature_source: "zha" });
      allFromDevice = false;
    } else {
      quirkOnlyEndpoints.push(epId);
    }
  });
  endpoints.sort((a, b) => a.endpoint.id - b.endpoint.id);
  out.endpoints = endpoints;
  if (quirkOnlyEndpoints.length) out.quirk_only_endpoints = quirkOnlyEndpoints;
  out.provenance.signature_source = allFromDevice ? "device" : "partial";
  return out;
}
