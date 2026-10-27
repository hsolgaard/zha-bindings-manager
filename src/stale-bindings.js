/**
 * Saved scan data that refers to devices Home Assistant no longer has.
 *
 * The card keeps each device's last binding-table read between sessions,
 * keyed by the source device's IEEE address. Two kinds of leftovers build
 * up over time:
 *
 *  - Removed sources: a device was removed from ZHA after it was scanned.
 *    Its saved entry is never rescanned again, so its bindings stay in the
 *    table for ever. Nothing on the Zigbee network needs changing; the
 *    saved copy just needs forgetting.
 *  - Dead targets: a live device still holds a binding to a device that
 *    has been removed. That entry is real (it uses a binding-table slot and
 *    the source keeps sending commands to nobody), so the fix is an unbind
 *    on the source.
 *
 * Kept free of card state so it can be unit tested directly.
 */
import { normIeee } from "./utils.js";

function knownIeees(devices) {
  return new Set((devices || []).map((d) => normIeee(d.ieee)));
}

/** Removed sources still in the saved data: [{ ieee, count }], where ieee
 *  is the key as stored in the map. */
export function removedSources(bindingsMap, devices) {
  const known = knownIeees(devices);
  const out = [];
  for (const [ieee, list] of bindingsMap || []) {
    if (!known.has(normIeee(ieee))) out.push({ ieee, count: (list || []).length });
  }
  return out;
}

/** Bindings held by a live device whose target device no longer exists.
 *  Group bindings are never included: a missing group is a different
 *  problem with a different fix. */
export function deadTargetBindings(bindingsMap, devices) {
  const known = knownIeees(devices);
  const out = [];
  for (const [ieee, list] of bindingsMap || []) {
    if (!known.has(normIeee(ieee))) continue;
    for (const b of list || []) {
      if (!b.isGroup && b.targetIeee && !known.has(normIeee(b.targetIeee))) out.push(b);
    }
  }
  return out;
}

/** Deletes saved entries for devices that are no longer in ZHA, in place.
 *  Returns the removed keys. Does nothing when the device list is empty, so
 *  a ZHA that failed to load (or is still loading) can never wipe the
 *  saved data. */
export function pruneRemovedSources(bindingsMap, devices) {
  if (!devices || !devices.length || !bindingsMap) return [];
  const removed = removedSources(bindingsMap, devices).map((r) => r.ieee);
  removed.forEach((ieee) => bindingsMap.delete(ieee));
  return removed;
}

/** Deletes one removed device's saved entry, matching the key however it
 *  was cased when saved. Returns how many bindings were dropped. */
export function forgetSource(bindingsMap, ieee) {
  let dropped = 0;
  for (const key of [...bindingsMap.keys()]) {
    if (normIeee(key) === normIeee(ieee)) {
      dropped += (bindingsMap.get(key) || []).length;
      bindingsMap.delete(key);
    }
  }
  return dropped;
}
