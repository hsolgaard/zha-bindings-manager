import { normIeee } from "./utils.js";

/** Stable identity key for a normalized binding — same source/target/
 *  endpoint/cluster identity no matter which raw response shape it was
 *  parsed from. zha_toolkit can (and on a fully successful call, usually
 *  does) return the *same* real binding in both `response.result` (older
 *  dict shape) and `response.replies` (newer ZDO-page shape) at once. The
 *  two parsers' raw `.id` strings format the cluster id differently (a hex
 *  string like "0x0006" from normalizeBinding vs a plain number like "6"
 *  from extractBindingsFromReplies), so they never matched as "the same
 *  entry" for dedup purposes — meaning one real binding could survive into
 *  the list twice and get flagged as a false "duplicate binding" by Binding
 *  Health (found via testing immediately after the 0.9.2 IEEE-parsing fix,
 *  which is what made the two copies' targets finally resolve to the same
 *  real device instead of one being garbled). This key uses each binding's
 *  already-normalized object fields (both parsers agree on those) instead
 *  of the inconsistently-formatted `.id` string. */
export function bindingIdentityKey(b) {
  const target = b.isGroup ? `g:${Number(b.groupId)}` : `d:${normIeee(b.targetIeee)}:${Number(b.targetEndpoint)}`;
  return `${normIeee(b.sourceIeee)}|${Number(b.sourceEndpoint)}|${Number(b.clusterId)}|${target}`;
}

/** Normalize a raw binds_get entry into a stable shape used throughout the card. */
export function normalizeBinding(sourceIeee, raw) {
  const dst = raw.dst || {};
  const isGroup = Number(dst.addrmode) === 1;
  return {
    id: `${sourceIeee}|${raw.src_ep}|${raw.cluster_id}|${isGroup ? "g" + dst.group : dst.dst_ieee + ":" + dst.dst_ep}`,
    sourceIeee: normIeee(sourceIeee),
    sourceEndpoint: raw.src_ep,
    clusterId: parseInt(raw.cluster_id, 16),
    isGroup,
    targetIeee: isGroup ? null : normIeee((dst.dst_ieee || "").replace(/^0x/i, "")),
    targetEndpoint: isGroup ? null : dst.dst_ep,
    groupId: isGroup ? parseInt(String(dst.group).replace(/^0x/i, ""), 16) : null,
  };
}

/** True if a normalized binding `b` matches the given source/target
 *  identity, comparing on normalized IEEE fields rather than raw ID-string
 *  prefixes (which aren't guaranteed to share exactly the same casing/format
 *  across different call paths). Used to verify bind/unbind outcomes against
 *  a fresh rescan instead of trusting zha_toolkit's own success/failure
 *  report — see the v0.8.2 diagnosis, where that report was misleading in
 *  both directions. `target` is `{isGroup:true, groupId}` or
 *  `{isGroup:false, ieee, endpoint}`. */
export function bindingMatches(b, sourceIeee, sourceEp, clusterId, target) {
  if (normIeee(b.sourceIeee) !== normIeee(sourceIeee)) return false;
  if (Number(b.sourceEndpoint) !== Number(sourceEp)) return false;
  if (Number(b.clusterId) !== Number(clusterId)) return false;
  if (target.isGroup) return b.isGroup && Number(b.groupId) === Number(target.groupId);
  return !b.isGroup && normIeee(b.targetIeee) === normIeee(target.ieee) && Number(b.targetEndpoint) === Number(target.endpoint);
}

/** Like bindingMatches, but any of `sourceEp`, `clusterIds` (array) and the
 *  target's `endpoint` may be null/empty to mean "any". Used to check an
 *  Advanced-tab bind where zha_toolkit picked endpoints or default clusters
 *  itself (zigbee-capabilities#387). */
export function bindingMatchesLoose(b, { sourceIeee, sourceEp = null, clusterIds = null, target }) {
  if (normIeee(b.sourceIeee) !== normIeee(sourceIeee)) return false;
  if (sourceEp != null && Number(b.sourceEndpoint) !== Number(sourceEp)) return false;
  if (clusterIds && clusterIds.length && !clusterIds.map(Number).includes(Number(b.clusterId))) return false;
  if (target.isGroup) return b.isGroup && Number(b.groupId) === Number(target.groupId);
  if (b.isGroup || normIeee(b.targetIeee) !== normIeee(target.ieee)) return false;
  return target.endpoint == null || Number(b.targetEndpoint) === Number(target.endpoint);
}

/** Stable key for one binding, for before/after comparisons. */
export function bindingKey(b) {
  const dst = b.isGroup ? `g${Number(b.groupId)}` : `${normIeee(b.targetIeee)}:${Number(b.targetEndpoint)}`;
  return `${normIeee(b.sourceIeee)}|${Number(b.sourceEndpoint)}|${Number(b.clusterId)}|${dst}`;
}

/** Converts a Zigbee IEEE address serialized as an array of 8 decimal bytes
 *  in little-endian (wire) order — e.g. [255,255,21,126,16,56,193,164] — into
 *  the standard colon-hex string (e.g. "a4:c1:38:10:7e:15:ff:ff") that
 *  normIeee() and every device's own `ieee` field elsewhere use. Confirmed
 *  against a real captured binds_get response (2026-07-14): the same
 *  payload's top-level `ieee_org` array reverses to exactly its own `ieee`
 *  string field. The earlier assumption that DstAddress.ieee was already a
 *  hex string was the root cause of every reply-path binding showing
 *  "target device no longer exists" — this replaces that assumption.
 *  Returns null for anything that isn't exactly 8 bytes. */
export function ieeeBytesToString(bytes) {
  if (!Array.isArray(bytes) || bytes.length !== 8) return null;
  return bytes
    .slice()
    .reverse()
    .map((b) => Number(b).toString(16).padStart(2, "0"))
    .join(":");
}

/** Same byte-order idea for a 2-byte little-endian value (e.g. a group/NWK
 *  id). Not yet confirmed against a real group-bound reply — kept as a
 *  defensive fallback since it's the same Struct-serialization layer that
 *  turned out to array-ify the 8-byte IEEE case. */
export function le16ToNumber(bytes) {
  if (!Array.isArray(bytes) || bytes.length !== 2) return null;
  return Number(bytes[0]) + Number(bytes[1]) * 256;
}

/** Parses zha_toolkit's newer `response.replies` shape — raw ZDO
 *  Mgmt_Bind_rsp pages, `[Status, BindingTableEntries, StartIndex,
 *  BindingTableList]` per zigpy's zdo/types.py — into the same normalized
 *  shape normalizeBinding() produces from the older `response.result`
 *  shape. Needed because a later page can time out (reporting `success:
 *  false` for the whole call) while an earlier page already contains valid
 *  entries that would otherwise be discarded entirely.
 *  Field names are confirmed against zigpy's actual `Binding` /
 *  `MultiAddress` Struct definitions (SrcAddress/SrcEndpoint/ClusterId/
 *  DstAddress, and addrmode/nwk/ieee/endpoint on the nested address) AND
 *  against a real captured response — IEEE addresses come across as 8-byte
 *  arrays, not hex strings (see ieeeBytesToString above). Alternate-cased
 *  fallbacks are kept only in case Home Assistant's websocket JSON layer
 *  ever re-cases these; unrecognized shapes are skipped (and logged)
 *  per-entry rather than crashing the whole scan.
 *  Returns `{entries, total}` — `total` is the device's own reported
 *  binding-table size (`BindingTableEntries`), used to show "X of Y
 *  retrieved" when a later page times out. */
export function extractBindingsFromReplies(sourceIeee, replies) {
  const out = [];
  let total = null;
  if (!Array.isArray(replies)) return { entries: out, total };
  for (const page of replies) {
    let entries = null;
    if (Array.isArray(page)) {
      const last = page[page.length - 1];
      if (Array.isArray(last)) entries = last;
      else if (page.length && page.every((p) => p && typeof p === "object" && !Array.isArray(p))) entries = page;
      // page shape: [Status, BindingTableEntries, StartIndex, BindingTableList]
      if (page.length >= 2 && typeof page[1] === "number") total = page[1];
    }
    if (!entries) continue;
    for (const raw of entries) {
      try {
        const srcEp = raw.SrcEndpoint ?? raw.src_ep ?? raw.srcEndpoint;
        const clusterIdRaw = raw.ClusterId ?? raw.cluster_id ?? raw.clusterId;
        const dst = raw.DstAddress ?? raw.dst ?? {};
        // MultiAddress.addrmode: 0x01 = group (nwk), 0x03 = extended (ieee+endpoint).
        const addrMode = Number(dst.addrmode ?? dst.AddrMode ?? dst.addr_mode ?? raw.DstAddrMode ?? 3);
        const isGroup = addrMode === 1;
        const dstIeeeRaw = dst.ieee ?? dst.IEEE ?? dst.dst_ieee;
        const dstIeee = Array.isArray(dstIeeeRaw) ? ieeeBytesToString(dstIeeeRaw) : dstIeeeRaw;
        const dstEp = dst.endpoint ?? dst.Endpoint ?? dst.dst_ep;
        const groupRaw = dst.nwk ?? dst.NWK ?? dst.group ?? dst.Group ?? dst.group_id;
        const group = Array.isArray(groupRaw) ? le16ToNumber(groupRaw) : groupRaw;
        if (srcEp == null || clusterIdRaw == null) continue;
        if (!isGroup && !dstIeee) {
          // Couldn't resolve a usable target IEEE — skip rather than show a
          // confusing "target device no longer exists" for a device that's
          // actually fine (this is what the byte-array bug used to do).
          console.warn("[ZHA Bindings Manager] skipped a binds_get reply entry with an unparseable target IEEE", raw);
          continue;
        }
        const clusterId =
          typeof clusterIdRaw === "string" ? parseInt(clusterIdRaw.replace(/^0x/i, ""), 16) : Number(clusterIdRaw);
        out.push({
          id: `${sourceIeee}|${srcEp}|${clusterId}|${isGroup ? "g" + group : `${dstIeee}:${dstEp}`}`,
          sourceIeee: normIeee(sourceIeee),
          sourceEndpoint: srcEp,
          clusterId,
          isGroup,
          targetIeee: isGroup ? null : normIeee(String(dstIeee || "").replace(/^0x/i, "")),
          targetEndpoint: isGroup ? null : dstEp,
          groupId: isGroup ? Number(group) : null,
        });
      } catch (err) {
        console.warn("[ZHA Bindings Manager] skipped an unparseable binds_get reply entry", raw, err);
      }
    }
  }
  return { entries: out, total };
}

// -----------------------------------------------------------------------
// Stored bindings (1.4.1). Saved scan data comes back from storage (the
// browser, or the integration's shared storage), so it's treated as
// untrusted: every binding is rebuilt from strictly typed fields, and
// anything malformed is dropped. After this, every field is an integer, a
// boolean, a colon-hex IEEE address or an id made only from those, so
// nothing stored can carry markup into the page.
// -----------------------------------------------------------------------
const IEEE_RE = /^[0-9a-f]{2}(:[0-9a-f]{2}){7}$/;
const SAFE_ID_RE = /^[0-9A-Za-z:|]{1,120}$/;

export function isIeee(value) {
  return typeof value === "string" && IEEE_RE.test(value.toLowerCase());
}

function intIn(value, max) {
  const n = typeof value === "string" && /^0x[0-9a-f]+$/i.test(value) ? parseInt(value, 16) : Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

/** One stored binding rebuilt from its fields, or null if it's malformed. */
export function sanitizeStoredBinding(b, sourceKey) {
  if (!b || typeof b !== "object") return null;
  const sourceIeee = normIeee(typeof b.sourceIeee === "string" ? b.sourceIeee : sourceKey);
  if (!isIeee(sourceIeee)) return null;
  const sourceEndpoint = intIn(b.sourceEndpoint, 255);
  const clusterId = intIn(b.clusterId, 0xffff);
  if (sourceEndpoint == null || clusterId == null) return null;
  const isGroup = b.isGroup === true;
  let targetIeee = null;
  let targetEndpoint = null;
  let groupId = null;
  if (isGroup) {
    groupId = intIn(b.groupId, 0xffff);
    if (groupId == null) return null;
  } else {
    targetIeee = normIeee(typeof b.targetIeee === "string" ? b.targetIeee : "");
    targetEndpoint = intIn(b.targetEndpoint, 255);
    if (!isIeee(targetIeee) || targetEndpoint == null) return null;
  }
  const rebuilt = `${sourceIeee}|${sourceEndpoint}|${clusterId}|${isGroup ? "g" + groupId : `${targetIeee}:${targetEndpoint}`}`;
  // Keep the stored id when it's harmless, so anything keyed by it (health
  // details, pending checks) still matches; otherwise use the rebuilt one.
  const id = typeof b.id === "string" && SAFE_ID_RE.test(b.id) ? b.id : rebuilt;
  return { id, sourceIeee, sourceEndpoint, clusterId, isGroup, targetIeee, targetEndpoint, groupId };
}

/** {ieee: [binding]} from storage → Map of sanitized lists. Malformed
 *  devices and bindings are dropped; `dropped` says how many. */
export function sanitizeStoredBindings(raw) {
  const out = new Map();
  let dropped = 0;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { bindings: out, dropped };
  for (const [key, list] of Object.entries(raw)) {
    const ieee = normIeee(key);
    if (!isIeee(ieee) || !Array.isArray(list)) {
      dropped += Array.isArray(list) ? list.length : 1;
      continue;
    }
    const clean = [];
    for (const b of list) {
      const s = sanitizeStoredBinding(b, ieee);
      if (s) clean.push(s);
      else dropped++;
    }
    out.set(ieee, clean);
  }
  return { bindings: out, dropped };
}
