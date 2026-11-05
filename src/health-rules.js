// Binding Health rules that only need the binding itself plus what the card
// already knows about the source endpoint's clusters. Kept out of card.js so
// they can be unit tested.

export const BASIC_CLUSTER = 0x0000;

/** Clusters 0xFC00-0xFFFF are manufacturer-specific: not part of the Zigbee
 *  standard, so what they do (and who should receive them) is unknown.
 *  Out of scope for the card's checks since 1.5.1 (forum report, ozaz:
 *  IKEA TRADFRI bulbs bound to their own group on 0xFFFD were warned about). */
export function isManufacturerSpecific(clusterId) {
  const id = Number(clusterId);
  return id >= 0xfc00 && id <= 0xffff;
}

/** Health result for a binding on a manufacturer-specific cluster. */
export function manufacturerSpecificRule(clusterId) {
  const hex = `0x${Number(clusterId).toString(16).padStart(4, "0")}`;
  return {
    level: "info",
    code: "manufacturer_specific",
    message: `Manufacturer-specific cluster (${hex}), not checked.`,
    why:
      "Clusters from 0xFC00 up aren't part of the Zigbee standard: each manufacturer uses them for its own features, and devices usually set these bindings up themselves. The card can't tell what they do, so it doesn't check them.",
    recommendation: "Leave it in place unless you know the device doesn't need it.",
  };
}

/**
 * Flags device-to-device bindings that are structurally valid but almost
 * certainly not what anyone meant. Called only for bindings whose target is
 * another device (not the coordinator, not a group) and that already passed
 * the endpoint and cluster checks.
 *
 * `classification` is the card's _classifyBinding() result for the source
 * endpoint: "control" (the source sends this cluster's commands),
 * "reporting" (the source holds this cluster and only reports it) or
 * "unknown" (source clusters not read yet).
 *
 * Returns a health result, or null when nothing is unusual.
 * Forum report (John_smith, 1.0.3): a light bound to its own remote on
 * Basic was shown as plain "OK".
 */
export function unusualDeviceBindingRule({ clusterId, classification }) {
  if (Number(clusterId) === BASIC_CLUSTER) {
    return {
      level: "warning",
      code: "unusual_basic",
      message: "Unusual binding: Basic cluster bound to another device.",
      why:
        "The Basic cluster only holds device information such as the manufacturer and model. Binding it to another device doesn't let either one control the other. Bindings like this are usually left by a manufacturer's pairing routine or created by mistake, often in the wrong direction (for example from a light to its remote).",
      recommendation:
        "Unless a device's manual says it needs this, it's safe to remove. To control a light from a switch, bind On/Off (and Level Control for dimming) from the switch to the light.",
    };
  }
  if (classification === "reporting") {
    return {
      level: "info",
      code: "reporting_to_device",
      message: "Reporting binding to another device, not a control binding.",
      why:
        "The source sends its own status for this cluster to the target, rather than sending it commands. That is sometimes intended (for example a temperature sensor reporting to a thermostat), but it doesn't let the source control the target.",
      recommendation:
        "If you meant the source to control the target, check the direction: the binding should start on the device that sends the commands, such as a switch or remote.",
    };
  }
  return null;
}
