/**
 * The message shown when a binding scan finishes.
 *
 * "N did not respond (sleepy/offline devices are normal)" was misleading in
 * two ways (see integration issue #2):
 *  - When every device fails, including mains-powered ones and the
 *    coordinator, the devices aren't asleep: zha-toolkit isn't working. The
 *    message now says so and shows the first real error.
 *  - When some fail, it now separates battery devices (asleep is normal)
 *    from mains devices (worth checking), and names the mains ones.
 *
 * Kept free of card state so it can be unit tested directly.
 */

/** Same rule as the card's wake-up advice: only a battery device can be
 *  asleep. ZHA's ambiguous "Battery or Unknown" counts as battery. */
export function isBatteryPowered(device) {
  return !!(device && device.power_source && /battery/i.test(device.power_source));
}

/** Whether the zha-toolkit action the scan needs is registered in HA. */
export function toolkitAvailable(hass, service = "binds_get") {
  return !!(hass && hass.services && hass.services.zha_toolkit && hass.services.zha_toolkit[service]);
}

function shortError(err) {
  const text = String((err && (err.message || err)) || "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function nameList(names, max = 3) {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/**
 * @param {object} p
 * @param {number} p.okCount       devices read successfully
 * @param {number} p.partialCount  devices only partly read
 * @param {Array<{device?: object, name: string, error?: any}>} p.failures
 * @param {string[]} [p.skippedNames]  devices skipped because they're no longer in ZHA
 * @param {number} [p.prunedCount]     removed devices whose saved data was cleared
 * @returns {{level: "success"|"info"|"error", message: string}}
 */
export function summarizeScan({ okCount, partialCount, failures, skippedNames = [], prunedCount = 0 }) {
  const failed = failures || [];
  const battery = failed.filter((f) => isBatteryPowered(f.device));
  const mains = failed.filter((f) => !isBatteryPowered(f.device));
  const extras = [];
  if (skippedNames.length) extras.push(`skipped ${skippedNames.join(", ")} (no longer in ZHA)`);
  if (prunedCount) extras.push(`cleared saved data for ${prunedCount} device(s) no longer in ZHA`);
  const tail = extras.length ? ` Also ${extras.join("; ")}.` : "";

  // Nothing read at all, and at least one failure was a device that can't
  // be asleep: the problem is the toolkit or the Zigbee setup, not the
  // devices. (A single failed device is too little to go on.)
  if (okCount === 0 && partialCount === 0 && failed.length >= 2 && mains.length > 0) {
    const firstError = shortError((mains[0] || failed[0]).error);
    return {
      level: "error",
      message:
        `Scan failed: no device responded (${failed.length} of ${failed.length}), including mains-powered ` +
        `devices that never sleep, so this isn't sleepy devices. It usually means zha-toolkit isn't working. ` +
        (firstError ? `First error: "${firstError}". ` : "") +
        `Check Settings → System → Logs for zha_toolkit errors.` +
        tail,
    };
  }

  const parts = [`${okCount} device(s) read`];
  if (partialCount) parts.push(`${partialCount} partial (a later page timed out — rescan for the rest)`);
  if (mains.length) {
    parts.push(
      `${mains.length} mains-powered device(s) did not respond (check they're online in ZHA): ${nameList(
        mains.map((f) => f.name)
      )}`
    );
  }
  if (battery.length) {
    parts.push(
      `${battery.length} battery device(s) did not respond (normal, they sleep: wake one and use its Rescan)`
    );
  }
  const level = mains.length ? "error" : battery.length || partialCount ? "info" : "success";
  return { level, message: `Scan complete: ${parts.join(", ")}.${tail}` };
}
