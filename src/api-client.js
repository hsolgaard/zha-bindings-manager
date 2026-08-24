import { ZTK_DOMAIN } from "./constants.js";
import { extractErrorMessage } from "./utils.js";
import { normalizeBinding, extractBindingsFromReplies, bindingIdentityKey } from "./parser.js";

// ---------------------------------------------------------------------------
// Thin wrapper around the ZHA + zha_toolkit APIs used by this card.
// ---------------------------------------------------------------------------
export class ZhaApi {
  constructor(hass) {
    this.hass = hass;
  }

  async fetchDevices() {
    return this.hass.callWS({ type: "zha/devices" });
  }

  async fetchGroups() {
    return this.hass.callWS({ type: "zha/groups" });
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
    const data = {
      ieee: sourceIeee,
      command_data: targetIeee,
    };
    if (clusterIds && clusterIds.length) data.cluster = clusterIds;
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    if (opts.dstEndpoint != null) data.dst_endpoint = opts.dstEndpoint;
    return this.callToolkit("binds_remove_all", data);
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

  async unbindGroup(sourceIeee, groupId, clusterIds, opts = {}) {
    const data = { ieee: sourceIeee, command_data: groupId };
    if (clusterIds && clusterIds.length === 1) data.cluster = clusterIds[0];
    if (opts.endpoint != null) data.endpoint = opts.endpoint;
    return this.callToolkit("unbind_group", data);
  }
}
