// -----------------------------------------------------------------------
// Capability Explorer constants — genuinely standalone
// -----------------------------------------------------------------------
// No dependency on constants.js or anything else card-specific
// (CLUSTER_INFO, CLUSTER_COMMANDS, binding defaults, etc.) — this file plus
// capexplorer.js are the complete pure data layer behind the Zigbee
// Capability Explorer, and both are meant to be lifted wholesale into
// something that isn't this card (see docs/, the standalone zigbee-
// capabilities website, which imports these two files directly and nothing
// else from src/). constants.js re-exports CAPABILITY_DB_REPO from here so
// card.js's existing imports keep working unchanged.

// The community-maintained, openly-licensed device capability database
// this card can submit "Check supported commands" scans to (see that
// repo's own README for the schema and review process). One constant so
// the target repo only needs updating in one place if it's ever
// renamed/moved — which already happened once (zha-device-capabilities ->
// zigbee-capabilities).
export const CAPABILITY_DB_REPO = "hsolgaard/zigbee-capabilities";

// Plain-English "what this cluster lets a device do" labels for the
// Capability Explorer's "Supports" grouping (see capexplorer.js's
// groupCapabilitiesByOutcome). Spans control, sensor, and security
// clusters, since the Capability Explorer's job is describing a device's
// *entire* capability set, not just what a binding controls — "X control"
// would read wrong for a sensor ("occupancy control" isn't a thing;
// "occupancy sensing" is). Anything not listed here falls back to the
// cluster's own recorded name (every real submission carries one), or as
// a last resort a formatted hex ID — never a guess at a phrase.
export const CAPABILITY_OUTCOME_PHRASE = {
  0x0005: "Scene control",
  0x0006: "On/off control",
  0x0007: "On/off switch configuration",
  0x0008: "Brightness control",
  0x0101: "Lock control",
  0x0102: "Open/close control",
  0x0200: "Pump control",
  0x0201: "Thermostat control",
  0x0202: "Fan speed control",
  0x0203: "Dehumidification control",
  0x0300: "Color control",
  0x0301: "Ballast control",
  0x0400: "Illuminance sensing",
  0x0401: "Illuminance level sensing",
  0x0402: "Temperature sensing",
  0x0403: "Pressure sensing",
  0x0404: "Flow sensing",
  0x0405: "Humidity sensing",
  0x0406: "Occupancy sensing",
  0x0500: "Motion/intrusion alarm",
  0x0501: "Alarm control (ACE)",
  0x0502: "Siren/warning device",
  0x0702: "Energy metering",
  0x0b01: "Meter identification",
  0x0b04: "Electrical measurement",
  // 0xFC00-0xFFFF is the manufacturer-specific cluster range, so IDs in it
  // are normally NOT safe to map by number alone — the same numeric ID gets
  // reused by unrelated vendors for unrelated purposes (see
  // MANUFACTURER_SPECIFIC_CLUSTER_NAMES below for those). 0xFC57 is the one
  // documented exception: it's the semi-standardized "Works with all Hubs"
  // (WWAH) cluster, used consistently across multiple vendors (confirmed on
  // IKEA devices and referenced generally for hub-compatibility signaling,
  // e.g. when a device connects to Amazon Alexa/Echo) rather than being
  // vendor-private — verified via zigpy/zigpy#823 and community device
  // handler sources, not guessed from the hex ID alone.
  0xfc57: "Works with all hubs (WWAH)",
};

// Manufacturer-specific cluster names, keyed by a lowercased/trimmed
// manufacturer string then by cluster ID — deliberately separate from
// CAPABILITY_OUTCOME_PHRASE above because clusters in the 0xFC00-0xFFFF
// range are vendor-private by convention: the same numeric ID can mean
// completely unrelated things depending on which manufacturer implemented
// it, so a global id-only map risks confidently mislabeling one vendor's
// cluster with another's meaning — worse than the honest "unidentified"
// fallback it would replace. Each entry here is sourced from that vendor's
// actual quirk implementation, not inferred from the hex ID.
// 0xFC11 verified against zigpy/zha-device-handlers'
// zhaquirks/sonoff/zbminir2.py (SonoffCluster): attribute-only, no
// commands — external_trigger_mode, detach_relay, turbo_mode, network_led.
export const MANUFACTURER_SPECIFIC_CLUSTER_NAMES = {
  sonoff: {
    0xfc11: "Device settings (Sonoff)",
  },
};

export function capabilityOutcomePhrase(id, fallbackName, manufacturer) {
  const n = Number(id);
  const vendorKey = (manufacturer || "").toString().trim().toLowerCase();
  const vendorMap = MANUFACTURER_SPECIFIC_CLUSTER_NAMES[vendorKey];
  return (
    (vendorMap && vendorMap[n]) ||
    CAPABILITY_OUTCOME_PHRASE[n] ||
    fallbackName ||
    `Cluster 0x${n.toString(16).padStart(4, "0")}`
  );
}
