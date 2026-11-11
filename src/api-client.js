import { ZTK_DOMAIN } from "./constants.js";
import { extractErrorMessage } from "./utils.js";
import { normalizeBinding, extractBindingsFromReplies, bindingIdentityKey } from "./parser.js";

// ---------------------------------------------------------------------------
// Thin wrapper around the ZHA + zha_toolkit APIs used by this card.
// ---------------------------------------------------------------------------
export class ZhaApi {
  constructor(hass) {
    this.hass = hass;
    /** Set by the card when the integration watches for lost bindings
     *  (1.8.0): unbinds made here are then reported as "removed on
     *  purpose", so the watch doesn't put them back. */
    this.watchEnabled = false;
  }

  /** 1.10.0: short-address history and missed presses. */
  async evidenceGet() {
    return this.hass.callWS({ type: "zha_bindings_manager/evidence_get" });
  }

  // --- Replace a device (integration 1.9.0) -----------------------------------

  async replacePlan(oldIeee, newIeee, { oldClusters, newClusters, endpointMap } = {}) {
    const clean = (list) => (list || []).map((c) => ({ endpoint_id: Number(c.endpoint_id), id: Number(c.id), type: c.type }));
    const msg = { type: "zha_bindings_manager/replace_plan", old_ieee: oldIeee, new_ieee: newIeee };
    if (oldClusters && oldClusters.length) msg.old_clusters = clean(oldClusters);
    if (newClusters && newClusters.length) msg.new_clusters = clean(newClusters);
    if (endpointMap && Object.keys(endpointMap).length) msg.endpoint_map = endpointMap;
    return this.hass.callWS(msg);
  }

  async replaceRun(planId, items) {
    return this.hass.callWS({ type: "zha_bindings_manager/replace_run", plan_id: planId, items });
  }

  async replaceCleanup(planId, unbindOld) {
    return this.hass.callWS({ type: "zha_bindings_manager/replace_cleanup", plan_id: planId, unbind_old: !!unbindOld });
  }

  /** Removes a device from ZHA (ZHA's own zha.remove action). */
  async removeZhaDevice(ieee) {
    return this.hass.callService("zha", "remove", { ieee });
  }

  // --- Lost bindings (integration 1.8.0) -------------------------------------

  async watchGet() {
    return this.hass.callWS({ type: "zha_bindings_manager/watch_get" });
  }

  /** Puts lost bindings back: one device, or every device when ieee is omitted. */
  async watchPutBack(ieee) {
    const msg = { type: "zha_bindings_manager/watch_put_back" };
    if (ieee) msg.ieee = ieee;
    return this.hass.callWS(msg);
  }

  /** Stops expecting bindings (all of a device's, or just these keys). */
  async watchForget(ieee, keys) {
    const msg = { type: "zha_bindings_manager/watch_forget", ieee };
    if (keys && keys.length) msg.keys = keys;
    return this.hass.callWS(msg);
  }

  async watchPolicy(ieee, policy) {
    return this.hass.callWS({ type: "zha_bindings_manager/watch_policy", ieee, policy });
  }

  /** Switch the lights from Home Assistant when a press doesn't reach them. */
  async watchFallback(ieee, enabled) {
    return this.hass.callWS({ type: "zha_bindings_manager/watch_fallback", ieee, enabled: !!enabled });
  }

  async watchCheckAll() {
    return this.hass.callWS({ type: "zha_bindings_manager/watch_check_all" });
  }

  /** Tells the watch which bindings were removed on purpose. Patterns:
   *  {sourceIeee, sourceEndpoint?, clusterIds?, isGroup?, groupId?,
   *  targetIeee?, targetEndpoint?}; anything left out matches all. Never
   *  throws: this is bookkeeping, the unbind itself already happened. */
  async _reportRemoved(pattern) {
    if (!this.watchEnabled) return;
    const clean = {};
    for (const [k, v] of Object.entries(pattern)) if (v != null) clean[k] = v;
    try {
      await this.hass.callWS({ type: "zha_bindings_manager/watch_removed", bindings: [clean] });
    } catch (e) {
      /* older integration, or watch switched off */
    }
  }

  /** A device left a group (removed from it, or the group deleted): its own
   *  bindings to that group go with it, on purpose (1.10.4). */
  async reportLeftGroup(ieee, groupId) {
    await this._reportRemoved({ sourceIeee: ieee, isGroup: true, groupId: Number(groupId) });
  }

  async fetchDevices() {
    return this.hass.callWS({ type: "zha/devices" });
  }

  async fetchGroups() {
    return this.hass.callWS({ type: "zha/groups" });
  }

  /** Experimental (integration only): read one router's routing and
   *  neighbour tables; returns the stored entry. */
  async meshRead(ieee) {
    return this.hass.callWS({ type: "zha_bindings_manager/mesh_read", ieee });
  }

  /** Binding tables the integration read itself (1.5.0):
   *  {scans: {ieee: {at, bindings, partial}}}. */
  async deviceScans() {
    return this.hass.callWS({ type: "zha_bindings_manager/device_scans" });
  }

  /** Experimental: every stored entry, {devices: {ieee: entry}}. */
  async meshGet() {
    return this.hass.callWS({ type: "zha_bindings_manager/mesh_get" });
  }

  /** Experimental (1.7.0): messages per device to Home Assistant. */
  async activityGet() {
    return this.hass.callWS({ type: "zha_bindings_manager/activity_get" });
  }

  async fetchClusters(ieee) {
    return this.hass.callWS({ type: "zha/devices/clusters", ieee });
  }

  /** Native "bind everything compatible" - used only as a fallback/quick action. */
  async nativeBindDevices(sourceIeee, targetIeee) {
    return this.hass.callWS({
      type: "zha/devices/bind",
      source_ieee: sourceIeee,
      target_ieee: targetIeee,
    });
  }

  async nativeUnbindDevices(sourceIeee, targetIeee) {
    return this.hass.callWS({
      type: "zha/devices/unbind",
      source_ieee: sourceIeee,
      target_ieee: targetIeee,
    });
  }

  // Native HA's zha/groups/bind and zha/groups/unbind websocket commands
  // used to live here (bindDeviceToGroup/unbindDeviceFromGroup). Removed —
  // bindDeviceToGroup had zero callers, and unbindDeviceFromGroup was the
  // confirmed root cause of "still on the device after rescanning" on group
  // unbinds (Hans tested zha_toolkit's unbind_group directly and it worked
  // immediately, while this native path kept failing). unbindGroup() below,
  // which goes through zha_toolkit like every other bind/unbind action in
  // this card, replaced its one real caller.

  /** Calls a zha_toolkit service and returns the event_data response object.
   *  On any failure, logs the full request + raw response to the browser
   *  console before throwing — the toast/error message the UI shows is
   *  necessarily short, but the console has everything zha_toolkit sent
   *  back (useful for diagnosing failures with no human-readable "warning"
   *  attached, e.g. a bare `success: false`). */
  async callToolkit(service, data, opts = {}) {
    if (!this.hass.services || !this.hass.services[ZTK_DOMAIN] || !this.hass.services[ZTK_DOMAIN][service]) {
      throw new Error(
        `Service ${ZTK_DOMAIN}.${service} is not available. Is the "zha-toolkit" ` +
          `custom component installed and loaded? (HACS > Integrations)`
      );
    }
    let result;
    try {
      // notifyOnError=false: we always catch and report failures ourselves
      // (status bar, console diagnostics, Binding Health) — HA's own generic
      // "Failed to perform the action..." toast was firing on top of that
      // for every expected sleepy/offline device, which is redundant noise
      // at best and misleading ("unknown error") at worst.
      result = await this.hass.callService(ZTK_DOMAIN, service, data, undefined, false, true);
    } catch (err) {
      console.error(`[ZHA Bindings Manager] ${service} call threw`, { request: data, error: err });
      throw new Error(`${service} failed: ${extractErrorMessage(err)}`);
    }
    const response = result && result.response ? result.response : result;
    if (!response) {
      console.error(`[ZHA Bindings Manager] ${service} returned no response data`, { request: data, result });
      throw new Error(
        `${service} returned no data. Your Home Assistant core version may be older than ` +
          `2023.7 (response data support) or zha-toolkit needs updating.`
      );
    }
    const hasErrors = response.errors && response.errors.length;
    const failed = hasErrors || response.success === false;
    // Callers that can make use of partial data (currently just
    // getDeviceBindings — a later page of a binding table can time out
    // while an earlier page already has valid entries) opt in via
    // allowPartial instead of losing the whole response to a throw. Every
    // other caller (bind/unbind/etc.) keeps the original all-or-nothing
    // behavior, since a partial bind/unbind isn't a meaningful concept.
    if (failed) {
      if (opts.allowPartial) {
        console.warn(`[ZHA Bindings Manager] ${service} reported failure — continuing with any partial data`, {
          request: data,
          response,
        });
      } else if (hasErrors) {
        console.error(`[ZHA Bindings Manager] ${service} reported errors`, { request: data, response });
        throw new Error(`${service}: ${response.errors.join("; ")}`);
      } else {
        console.error(`[ZHA Bindings Manager] ${service} reported failure (full response below)`, {
          request: data,
          response,
        });
        throw new Error(`${service} reported failure${response.warning ? `: ${response.warning}` : ""}`);
      }
    }
    return response;
  }

  /** Reads the on-device binding table for one device via zha_toolkit.binds_get.
   *  Merges both response shapes zha_toolkit versions have used —
   *  `response.result` (a keyed dict) and `response.replies` (raw ZDO pages,
   *  seen on newer zha_toolkit/zigpy) — and keeps whatever valid entries
   *  come back even if the overall call reports failure (e.g. a later page
   *  timing out shouldn't discard an earlier page that already succeeded).
   *  Returns `{bindings, partial, retrievedCount, totalCount}`; `partial`
   *  means the read may be incomplete even though the entries returned are
   *  valid, and `totalCount` (when known) is the device's own reported
   *  binding-table size, so the UI can show "X of Y retrieved".
   *  `opts.tries` (optional) is passed straight through to zha_toolkit's
   *  `tries` parameter — confirmed via live testing (2026-07-15) that each
   *  try costs ~45s when a device doesn't respond at all, and that it's a
   *  real sequential retry loop, not a no-op. Left unset (zha_toolkit's own
   *  default of 1) for the bulk network scan; callers doing a deliberate
   *  single-device rescan can opt into more. */
  async getDeviceBindings(ieee, opts = {}) {
    const data = { ieee };
    if (opts.tries != null) data.tries = opts.tries;
    const response = await this.callToolkit("binds_get", data, { allowPartial: true });
    const failed = (response.errors && response.errors.length) || response.success === false;
    const fromResult =
      response.result && Object.keys(response.result).length
        ? Object.values(response.result).map((b) => normalizeBinding(ieee, b))
        : [];
    const { entries: fromReplies, total: repliesTotal } = extractBindingsFromReplies(ieee, response.replies);
    const seen = new Set();
    // Dedup on normalized identity, not the raw .id string — result-path and
    // replies-path entries for the same real binding format their .id
    // differently (see bindingIdentityKey) and would otherwise both survive
    // as a false "duplicate binding" Health warning.
    const bindings = [...fromResult, ...fromReplies].filter((b) => {
      const key = bindingIdentityKey(b);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (failed && !bindings.length) {
      // Nothing usable came back at all — this is a real failure (e.g. a
      // sleepy device that never replied), not a partial success.
      throw new Error(
        `binds_get reported failure${response.warning ? `: ${response.warning}` : ""}${
          response.errors && response.errors.length ? ` (${response.errors.join("; ")})` : ""
        }`
      );
    }
    return { bindings, partial: failed, retrievedCount: bindings.length, totalCount: repliesTotal };
  }

  /** Create a device -> device binding for one or more clusters. */
  async bindIeee(sourceIeee, targetIeee, clusterIds, opts = {}) {
    const data = {
      ieee: sourceIeee,
      command_data: targetIeee,
    };
    if (clusterIds && clusterIds.length) data.cluster = clusterIds.length === 1 ? clusterIds[0] : clusterIds;
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    if (opts.dstEndpoint != null) data.dst_endpoint = opts.dstEndpoint;
    return this.callToolkit("bind_ieee", data);
  }

  /** Remove binding(s) matching source/target/cluster filters (precise unbind).
   *  dst_endpoint is required to identify the exact binding-table entry on a
   *  target that has more than one endpoint — without it, zha_toolkit can't
   *  tell which entry to remove and reports failure even when the source,
   *  target, and cluster are all correct (see v0.8.1 bug report). */
  async unbindIeee(sourceIeee, targetIeee, clusterIds, opts = {}) {
    if (this.directUnbind && opts.endpoint != null && opts.dstEndpoint != null && clusterIds && clusterIds.length) {
      for (const c of clusterIds) {
        await this.unbindDirect(sourceIeee, opts.endpoint, c, { targetIeee, targetEndpoint: opts.dstEndpoint });
      }
      await this._reportRemoved({ sourceIeee, sourceEndpoint: opts.endpoint, clusterIds: clusterIds.map(Number), targetIeee, targetEndpoint: opts.dstEndpoint });
      return { success: true };
    }
    const data = {
      ieee: sourceIeee,
      command_data: targetIeee,
    };
    if (clusterIds && clusterIds.length) data.cluster = clusterIds;
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    if (opts.dstEndpoint != null) data.dst_endpoint = opts.dstEndpoint;
    const res = await this.callToolkit("binds_remove_all", data);
    await this._reportRemoved({
      sourceIeee,
      sourceEndpoint: opts.endpoint,
      clusterIds: clusterIds && clusterIds.length ? clusterIds.map(Number) : null,
      targetIeee,
      targetEndpoint: opts.dstEndpoint,
    });
    return res;
  }

  /** Live per-device command-discovery scan via zha_toolkit.scan_device —
   *  separate from the passive binds_get-based network scan this card
   *  otherwise relies on. Sends the real ZCL Discover_Commands_Received/
   *  Generated requests to the device itself, so it's slower and heavier
   *  than everything else the card does (multiple round-trips per cluster)
   *  and zha_toolkit also writes a copy of the result to
   *  config/scan/*_result.txt on the HA side — deliberately not run
   *  automatically, only on explicit user action.
   *  Returns the raw `scan` object zha_toolkit produces (see its
   *  scan_device.py: {ieee, nwk, model, manufacturer, endpoints: [...]});
   *  parsing which clusters/commands came back is left to the caller.
   *  Not every device implements command discovery — an empty
   *  commands_received/generated for a cluster can mean either "confirmed
   *  zero commands" or "device didn't answer discovery at all"; zha_toolkit
   *  doesn't currently preserve that distinction in the data it returns
   *  (only in its own HA-side log), so callers must present an empty
   *  result as ambiguous, not as a confirmed negative. */
  async scanDeviceCommands(ieee, opts = {}) {
    const data = { ieee };
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    if (opts.tries != null) data.tries = opts.tries;
    const response = await this.callToolkit("scan_device", data);
    return response.scan || null;
  }

  async bindGroup(sourceIeee, groupId, clusterIds, opts = {}) {
    const data = { ieee: sourceIeee, command_data: groupId };
    if (clusterIds && clusterIds.length === 1) data.cluster = clusterIds[0];
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    return this.callToolkit("bind_group", data);
  }

  /** Creates a ZHA group, optionally with members, using ZHA's own
   *  websocket API (what Home Assistant's Groups page uses). Members are
   *  [{ieee, endpoint}]. Returns ZHA's group record when it sends one. */
  async createGroup(name, members = []) {
    return this.hass.callWS({
      type: "zha/group/add",
      group_name: name,
      members: members.map((m) => ({ ieee: m.ieee, endpoint_id: Number(m.endpoint) })),
    });
  }

  /** Creates a ZHA group with a given group ID (one that devices already
   *  use, e.g. made by Find & Bind). */
  async createGroupWithId(name, groupId) {
    return this.hass.callWS({ type: "zha/group/add", group_name: name, group_id: Number(groupId) });
  }

  /** Adds [{ieee, endpoint}] to an existing ZHA group. */
  async addGroupMembers(groupId, members) {
    return this.hass.callWS({
      type: "zha/group/members/add",
      group_id: Number(groupId),
      members: members.map((m) => ({ ieee: m.ieee, endpoint_id: Number(m.endpoint) })),
    });
  }

  /** binds_remove_all limited to one source endpoint and cluster, with no
   *  target filter: removes every binding on that endpoint and cluster,
   *  group bindings included. Used for a light's reporting binding to a
   *  group, which unbind_group can't remove (see groups.js). */
  async removeBindingsOnCluster(sourceIeee, endpoint, clusterId) {
    const res = await this.callToolkit("binds_remove_all", { ieee: sourceIeee, endpoint: Number(endpoint), cluster: [Number(clusterId)] });
    await this._reportRemoved({ sourceIeee, sourceEndpoint: Number(endpoint), clusterIds: [Number(clusterId)] });
    return res;
  }

  /** Removes [{ieee, endpoint}] from a ZHA group (ZHA's own websocket). */
  async removeGroupMembers(groupId, members) {
    return this.hass.callWS({
      type: "zha/group/members/remove",
      group_id: Number(groupId),
      members: members.map((m) => ({ ieee: m.ieee, endpoint_id: Number(m.endpoint) })),
    });
  }

  /** Deletes ZHA groups (ZHA's own websocket, as the Groups page uses). */
  async removeGroups(groupIds) {
    return this.hass.callWS({ type: "zha/group/remove", group_ids: groupIds.map(Number) });
  }

  /** 1.10.6: the integration sends the ZDO Unbind_req itself. Needs no
   *  lookup of the target (so bindings to devices no longer in ZHA can be
   *  removed) and works for a light's own binding to a group too. Throws
   *  with the device's own answer unless it removed it (SUCCESS). */
  async unbindDirect(sourceIeee, endpoint, clusterId, { groupId = null, targetIeee = null, targetEndpoint = null } = {}) {
    const msg = { type: "zha_bindings_manager/unbind", source_ieee: sourceIeee, endpoint: Number(endpoint), cluster: Number(clusterId) };
    if (groupId != null) msg.group_id = Number(groupId);
    else {
      msg.target_ieee = targetIeee;
      msg.target_endpoint = Number(targetEndpoint);
    }
    const res = await this.hass.callWS(msg);
    const status = res && res.status;
    if (status === "SUCCESS") return res;
    if (status === "no_answer") throw new Error("the device didn't answer");
    if (status === "unavailable") throw new Error(`the device isn't available${res.detail ? ` (${res.detail})` : ""}`);
    throw new Error(`the device answered ${status}`);
  }

  async unbindGroup(sourceIeee, groupId, clusterIds, opts = {}) {
    if (this.directUnbind && opts.endpoint != null && clusterIds && clusterIds.length) {
      for (const c of clusterIds) await this.unbindDirect(sourceIeee, opts.endpoint, c, { groupId });
      await this._reportRemoved({ sourceIeee, sourceEndpoint: opts.endpoint, clusterIds: clusterIds.map(Number), isGroup: true, groupId: Number(groupId) });
      return { success: true };
    }
    const data = { ieee: sourceIeee, command_data: groupId };
    if (clusterIds && clusterIds.length === 1) data.cluster = clusterIds[0];
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    const res = await this.callToolkit("unbind_group", data);
    await this._reportRemoved({
      sourceIeee,
      sourceEndpoint: opts.endpoint,
      clusterIds: clusterIds && clusterIds.length === 1 ? [Number(clusterIds[0])] : null,
      isGroup: true,
      groupId: Number(groupId),
    });
    return res;
  }
}
