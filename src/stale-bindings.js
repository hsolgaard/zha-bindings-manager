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

/** IEEEs present in `prev` but missing from `next`: devices removed from
 *  ZHA since the list was last loaded. Empty when `next` is empty, so a
 *  failed or partial reload never reports every device as removed. */
export function vanishedDevices(prev, next) {
  if (!next || !next.length) return [];
  const now = knownIeees(next);
  return (prev || []).map((d) => normIeee(d.ieee)).filter((ieee) => !now.has(ieee));
}

/** Records what each live device was called and where it was, so a device
 *  that is later removed can still be shown by name. `label` turns a ZHA
 *  device into its display name. Updates `known` (a Map keyed by
 *  lower-case IEEE) in place and returns true if anything changed. */
export function rememberDevices(known, devices, label) {
  let changed = false;
  for (const d of devices || []) {
    const ieee = normIeee(d.ieee);
    if (!ieee) continue;
    const info = {
      name: label(d) || "",
      manufacturer: d.manufacturer || "",
      model: d.model || "",
      area_id: d.area_id || null,
    };
    const old = known.get(ieee);
    if (
      !old ||
      old.name !== info.name ||
      old.manufacturer !== info.manufacturer ||
      old.model !== info.model ||
      old.area_id !== info.area_id
    ) {
      known.set(ieee, info);
      changed = true;
    }
  }
  return changed;
}

/** The part of `known` worth saving: live devices, plus removed devices
 *  the saved bindings still mention (as source or target). Anything else
 *  is a removed device whose data has been forgotten, so its name is no
 *  longer needed. Returns a plain object sorted by IEEE so two snapshots
 *  of the same data compare equal as JSON. */
export function knownDevicesToSave(known, devices, bindingsMap) {
  const keep = knownIeees(devices);
  for (const [ieee, list] of bindingsMap || []) {
    keep.add(normIeee(ieee));
    for (const b of list || []) if (b.targetIeee) keep.add(normIeee(b.targetIeee));
  }
  const out = {};
  [...(known || new Map()).keys()]
    .filter((ieee) => keep.has(ieee))
    .sort()
    .forEach((ieee) => (out[ieee] = known.get(ieee)));
  return out;
}
