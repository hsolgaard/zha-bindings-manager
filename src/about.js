/** The ⚙ → About line about the ZHA Bindings Manager integration. Plain
 *  function so it can be unit tested without the card. */
export function aboutIntegrationText({ checked, installed, storageOn, version, bundledCardVersion, cardVersion }) {
  if (!checked) return "";
  if (!installed) {
    return "Card-only install. The ZHA Bindings Manager integration adds shared storage, a sidebar page and notices when a bound device is removed.";
  }
  const parts = [`ZHA Bindings Manager integration ${version ? "v" + version : "(version not reported)"} is installed.`];
  if (bundledCardVersion && bundledCardVersion !== cardVersion) {
    parts.push(
      `This page is running card v${cardVersion}, but the integration includes card v${bundledCardVersion}: another copy of the card loaded first. See Settings → Repairs.`
    );
  }
  if (!storageOn) parts.push("Shared storage is switched off in the integration's options.");
  return parts.join(" ");
}
