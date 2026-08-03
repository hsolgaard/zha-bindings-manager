# ZHA Bindings Manager

A visual topology, binding and endpoint diagnostic tool for Home Assistant's ZHA integration.

See what controls what, identify stale or unexpected bindings, inspect devices endpoint by endpoint, and create or remove direct Zigbee bindings without hand-writing `zha_toolkit` service calls.

![status](https://img.shields.io/badge/status-experimental-orange)
![license](https://img.shields.io/badge/license-MIT-blue)

> [!NOTE]
> The Lovelace card is added as `type: custom:zha-binding-map-card`. That internal name remains unchanged even though the project has grown beyond a binding map.

![ZHA Bindings Manager map view](https://github.com/user-attachments/assets/63a7c281-5043-40a2-a19c-23ec6ceab3cf)

## Why use it?

Direct Zigbee bindings let devices communicate without Home Assistant being involved. That makes them fast and resilient — but it can also make them difficult to understand and troubleshoot.

ZHA Bindings Manager helps answer questions such as:

- What does this switch control?
- What controls this light?
- Why does this still work when Home Assistant is offline?
- Did re-pairing a device leave an old binding behind?
- Is a binding missing, duplicated or pointing at something that no longer exists?
- Does the target device actually support the command the source sends?
- Which endpoint on a multi-gang device is actually involved?

A real example: an outside light kept turning on when the wrong switch was pressed. The switch was not faulty and Home Assistant was not triggering it. An old direct Zigbee binding was. The map made the cause immediately visible.

## Requirements

- Home Assistant using the **ZHA** integration
- Home Assistant Core **2023.7 or newer**
- [`zha-toolkit`](https://github.com/mdeweerd/zha-toolkit) installed and working

ZHA Bindings Manager is a frontend-only Lovelace card. It uses Home Assistant's built-in ZHA websocket API to read devices, endpoints, clusters and groups, and uses `zha-toolkit` to read and modify device binding tables.

## Installation

### HACS — recommended

This repository is in the default HACS store, so no custom repository step is needed:

1. Open **HACS**.
2. Select **Frontend → Explore & add repositories**.
3. Search for **ZHA Bindings Manager**.
4. Select **Download**.

HACS should add the Lovelace resource automatically. If it does not, add this under **Settings → Dashboards → ⋮ → Resources**:

```text
/hacsfiles/zha-bindings-manager/zha-binding-map-card.js
```

Resource type: **JavaScript Module**.

### Add the card

Add the card through the dashboard UI, or use:

```yaml
type: custom:zha-binding-map-card
```

No other configuration is required.

> [!TIP]
> The card works best in a dedicated **Panel** view, where it can use the full browser width. A **Sections** view also works. Classic **Masonry** views cannot give the card enough horizontal space.

## First use

1. Open the card. Your ZHA devices and groups load immediately.
2. Select **Scan bindings** to read each device's binding table.
3. Explore the **Map**, **Bindings** and **Devices** views.
4. Select a map connection to inspect or remove it.
5. Drag a controller device onto a target device to start creating a binding.
6. Select a device node, or **Explode** in the Devices view, for an endpoint-by-endpoint breakdown.
7. In an endpoint card, select **Check supported commands** when you need to verify what that device firmware actually implements.
8. Open the **Zigbee Capability Explorer** view to see what your own devices — or a device you're considering buying — are confirmed to support, based on scans shared by the community.

Reading binding tables is a real Zigbee operation. Battery-powered buttons and remotes may need to be woken before they respond. When one device fails, wake it and use its individual **Rescan** action rather than scanning the entire network again.

Supported-command discovery is a separate, on-demand live-device scan. It is intentionally not included in the normal network scan because it requires several additional Zigbee requests to the selected device.

## What you can do

### Understand your network

- View every ZHA device and Zigbee group on an interactive map.
- See device-to-device bindings, group bindings and real group membership.
- Distinguish control, reporting and currently unclassified relationships.
- Hide coordinator/reporting noise to focus on direct control relationships.
- Filter by role, entity type, manufacturer or Home Assistant area.
- Place devices over your own floor-plan image.

### Diagnose bindings

- Search and sort every discovered binding in a flat table.
- Detect missing devices, targets, endpoints or clusters.
- Flag duplicates and bindings to groups that no longer exist.
- Explain each health finding in plain English.
- Rescan the relevant device directly from a health finding.
- Export the filtered data as CSV or JSON, or print/save it as PDF.

Binding Health is a **structural check**. It verifies that the objects referenced by a binding still exist in ZHA; it does not prove that the devices can currently communicate over the air.

### Inspect devices endpoint by endpoint

The exploded device view is built from a live scan rather than assumptions. It shows:

- each endpoint's input and output clusters;
- self-bindings, outgoing control, incoming control and group relationships;
- reporting-only and unclassified relationships;
- detach-relay state where Home Assistant exposes a matching entity;
- manufacturer, model, quirk, power source, IEEE address, network address and firmware details;
- a product image where a Zigbee2MQTT device-image match is available;
- an offline endpoint diagram when no image is available;
- an optional local annotation for what each endpoint is physically wired to;
- an on-demand **Supported commands** check for the control-capable clusters declared by that endpoint.

The supported-command check uses `zha_toolkit.scan_device` to query the device directly. Each applicable cluster appears as a collapsed row and, after scanning, expands to show the complete known command set, including both confirmed supported and unsupported commands.

This helps diagnose an important class of problem that Binding Health cannot detect: a binding may be structurally correct while the receiving device's firmware does not implement the particular command sent by the controller.

Completed scans can also be reviewed and shared with the public [`zigbee-capabilities`](https://github.com/hsolgaard/zigbee-capabilities) dataset — see [Explore device capabilities](#explore-device-capabilities) below. **Share scan to community database** covers the whole device in one submission, not one per endpoint: every endpoint you've checked is included, and any endpoint the device declares but that hasn't been (or can't be) checked — such as a Green Power proxy endpoint — is still listed rather than left out. Shared records contain the manufacturer, model, firmware identity, per-endpoint cluster signatures, and discovered command and attribute support. They deliberately exclude IEEE addresses, entity IDs, Home Assistant areas and binding data.

Nothing is submitted automatically. The card prepares a GitHub issue for the user to review and submit using their own GitHub account.

The physical-load annotation is saved **in the current browser only**. It is not written to Home Assistant and does not automatically follow you to another browser or device.

### Explore device capabilities

The **Zigbee Capability Explorer** view answers what a device can actually do, using evidence from real scans shared by the community rather than manufacturer claims or trial and error.

- **Explore my devices** cross-references your own ZHA devices against the community dataset. Each device card leads with a summary — manufacturer + model, local device name, a **Community confidence** panel, and **Good for** tags — answering "is this the device I'm looking for" before any protocol detail appears. Confirmed commands, grouped under plain-English **Capabilities** headings (for example, *Brightness control*), plus the raw per-firmware endpoint breakdown, sit behind a "Technical evidence ▾" disclosure: full detail for advanced users, never in the way for anyone just checking what a device can do. The Community confidence panel is a ★★★★☆-style star rating plus firmware version count, observation count and last-confirmed date, all in one place instead of spread across a badge, a summary line and a separate note; the underlying tiers are Preliminary, Growing evidence, Well confirmed and High confidence (plus a distinct "⚠ Conflicting" callout when the community's own scans disagree with each other), and the star scale is its own graduated 1–5 rating so a device backed by 50 scans reads as more confirmed than one with exactly 5.
- A **Good for** row on each device card turns confirmed evidence into short use-case tags — *Switch things on/off*, *Detect motion / occupancy*, *Act as a remote / controller* — so you don't need to know what a cluster or command is to answer "would this device do what I want." The evidence bar is the same model on any firmware in the dataset, not necessarily your device's exact firmware version; a tag backed only by evidence from a different firmware is marked with a small caveat rather than presented as fully verified for your unit. The same tags appear in the standalone site's search results, for deciding whether to buy a device you don't own yet.
- **Find a device** (formerly "Search database") answers "which device should I buy or use for X?" first, and still gives experts full precision when they need it. A dozen Quick Search chips — grouped under Lighting, Sensors and Networking — cover the most common questions (on/off control, dimming, scene control, color control, motion/occupancy sensing, temperature/humidity/energy monitoring, security/contact sensing, group control, OTA support) without requiring any Zigbee vocabulary. The exact manufacturer/model/cluster/command/attribute/firmware dropdowns are unchanged and still available, collapsed by default behind an "Advanced filters" disclosure. Results are device cards — the same Community confidence panel, Good for tags, and "View capabilities" disclosure used in Explore my devices — grouped and ranked by community confidence, then recency, then firmware coverage, then name, rather than one row per firmware record. A search with no matches explains that a gap isn't proof a device lacks a capability, with a direct link to contribute a scan.
- **Compare firmware** shows exactly what changed between two firmware versions of the same model, command by command.
- If the community has confirmed a newer firmware than the one your device reports, this is flagged directly against your device — the card only ever states what has been *observed*, never what a manufacturer calls "latest."
- From the exploded device view, **Check supported commands** followed by the **Compare My Device** panel runs the same firmware comparison against your own live scan, without leaving that dialog.
- A **Community heartbeat** panel frames the dataset as what it is — entirely community-built, with every scan contributing real evidence for someone else — and then highlights a small number of factual observations underneath: the most-confirmed device, a device whose capabilities genuinely differ by firmware version, the newest contribution, and how much activity the dataset has seen recently. It deliberately excludes manufacturer-level comparisons or percentages; the dataset isn't yet large enough to support that kind of claim reliably. When a highlight is about a device you're currently looking at, that device's own card says so directly rather than leaving the connection to you.

Coverage is limited to devices someone has scanned and shared. A missing or empty result means no submission exists yet, not that a device is incapable of something.

### Create and remove bindings

- Drag a source device onto a target device to pre-select a likely binding.
- Choose the exact source endpoint, target endpoint and cluster before committing.
- Remove bindings directly from the map or table.
- Bind devices to Zigbee groups.
- Use the Advanced view for multi-endpoint devices, unusual clusters and coordinator bindings.
- Enter a custom cluster ID for firmware-specific expert use cases.

After a bind or unbind operation, ZHA Bindings Manager rescans the affected device and compares the result. Confirmation is therefore based on the resulting binding table, not only on the raw response returned by `zha-toolkit`.

## Screenshots

<details>
<summary><strong>Map and binding interaction</strong></summary>

### Map overview

Every device and binding, colour-coded by cluster type.

![Map overview](https://github.com/user-attachments/assets/63a7c281-5043-40a2-a19c-23ec6ceab3cf)

### Inspect or create a binding

Select a connection to inspect or remove it, or drag one device onto another to start a new binding.

![Map interaction](https://github.com/user-attachments/assets/f0272567-483e-43e2-8935-4acbe38316c4)

</details>

<details>
<summary><strong>Bindings and health diagnostics</strong></summary>

### Bindings table

A searchable and sortable view of every binding, including Binding Health.

![Bindings view](https://github.com/user-attachments/assets/d8179c72-1c5f-40f8-9689-8194413b7017)

### Health details

Plain-English explanations of what is wrong, why it matters and what to do next.

![Binding Health details](https://github.com/user-attachments/assets/0e5b8a3d-172c-422e-a9f4-05466e427ee7)

</details>

<details>
<summary><strong>Devices and endpoint inspection</strong></summary>

### Devices

All ZHA devices with manufacturer, model, binding count and scan status.

![Devices view](https://github.com/user-attachments/assets/08965127-62c4-4859-a3dc-f3460457b5ed)

### Exploded device view

A live, per-endpoint view of the device's roles and relationships.

![Exploded device view](https://github.com/user-attachments/assets/96cc4e6c-7d0e-41ff-be4f-0d7dbb62b1ff)

</details>

<details>
<summary><strong>Advanced binding</strong></summary>

Endpoint- and cluster-aware manual binding with existing-binding context.

![Advanced view](https://github.com/user-attachments/assets/d3369c99-26b2-4b42-a597-79bd0805522c)

</details>

## Dedicated full-page dashboard

The repository includes `zha-binding-map-dashboard.yaml`, which creates a ready-made Panel dashboard.

1. Copy `zha-binding-map-dashboard.yaml` into your Home Assistant config directory, alongside `configuration.yaml`.
2. Add the following, merging it into an existing `lovelace:` block where necessary:

```yaml
lovelace:
  dashboards:
    zha-bindings:
      mode: yaml
      title: ZHA Bindings
      icon: mdi:led-strip-variant
      show_in_sidebar: true
      filename: zha-binding-map-dashboard.yaml
```

3. Restart Home Assistant.

A **ZHA Bindings** entry should then appear in the sidebar.

## Manual installation

1. Copy `zha-binding-map-card.js` into `config/www/`.
2. Add this Lovelace resource:

   ```text
   /local/zha-binding-map-card.js
   ```

   Resource type: **JavaScript Module**.

3. Add the card:

   ```yaml
   type: custom:zha-binding-map-card
   ```

### Browser caching after a manual update

A browser may continue serving an older copy of a manually installed `/local/` resource. Try a hard refresh first: **Ctrl/Cmd+Shift+R**.

When necessary, add and increment a version query to the resource URL:

```text
/local/zha-binding-map-card.js?v=0181
```

## Important limitations

- Binding data reflects the most recent scan; it is not updated continuously.
- Sleepy battery-powered devices may need to be woken before scanning or binding.
- A device with a large binding table may return only a partial result. Partial data is retained and clearly marked.
- Higher scan concurrency is not always better. On a real network of roughly 64 devices, values much above 10–12 caused intermittent response failures.
- Suggested clusters are based on compatible source output and target input clusters. They are suggestions, not guarantees of device behaviour.
- The controller badge on a combined actuator/controller device is a device-level heuristic. Use the exploded view for endpoint-level evidence.
- Binding Health checks structure, not radio reachability or real-world operation.
- **Check supported commands** is a separate live-device query and may take several seconds. It is not part of the normal binding-table scan.
- Some devices do not respond to Zigbee command-discovery requests. An empty response is therefore reported as inconclusive rather than treated as proof that the device supports no commands.
- Very large capability scans may not fit in a pre-filled GitHub issue URL. In that case, the card copies the formatted JSON so it can be pasted into the prepared issue manually.
- The Zigbee Capability Explorer view only reflects devices that have been scanned and shared. A missing result is a coverage gap, not evidence that a device cannot do something.
- Firmware comparisons in the Capability Explorer are intentionally conservative. If a device's reported firmware string isn't in a directly comparable format to the community dataset — Home Assistant's device registry `sw_version` frequently differs from the Basic cluster's `sw_build_id` that submissions actually use — no comparison is shown rather than an inferred one.
- The Capability Explorer dataset is fetched from GitHub and needs outbound internet access from the browser. Results are cached in `localStorage` for six hours.
- There is currently no visual Lovelace configuration editor, although the card requires only one YAML line.
- Printing to PDF uses the browser's print dialog and may require pop-ups to be allowed for Home Assistant.

<details>
<summary><strong>Troubleshooting failed operations</strong></summary>

On-screen error messages are intentionally brief. Open the browser developer console and look for a line beginning:

```text
[ZHA Bindings Manager]
```

The log contains the full request and raw `zha-toolkit` response, which is normally the most useful information to include in a bug report.

</details>

## What this project is — and is not

ZHA Bindings Manager is designed to make direct Zigbee bindings visible and understandable. It is not intended to replace `zha-toolkit`, expose every part of the Zigbee specification, or act as a Zigbee mesh-routing analyser.

Its design principles are:

- **Visibility before complexity** — show what exists before requiring protocol knowledge.
- **Plain English where possible** — explain findings rather than merely displaying raw data.
- **Guide rather than expose** — make common operations safe and approachable.
- **Keep expert controls available** — endpoints, clusters and raw binding operations remain accessible when needed.

## Related projects

- Home Assistant's native **ZHA → Manage Zigbee Device → Bindings** interface can create bindings, but does not provide a network-wide view of existing binding tables.
- [`zigbee-floorplan-card`](https://github.com/TheLarsinator/zigbee-floorplan-card) visualises Zigbee mesh routing and link quality, primarily for Zigbee2MQTT. It does not read or manage ZHA binding tables.
- [`zigbee-capabilities`](https://github.com/hsolgaard/zigbee-capabilities) is the openly licensed community device-capability dataset behind the Zigbee Capability Explorer view. ZHA Bindings Manager is one contributor and one consumer of it, not the other way around — the dataset itself is usable independently of this card, and of Home Assistant entirely.

## Credits

Designed, specified and tested by [Hans Solgaard](https://github.com/hsolgaard) against a real ZHA network.

Development assisted by [Claude](https://www.anthropic.com/claude) (Anthropic).

Built on:

- [ZHA](https://www.home-assistant.io/integrations/zha/) in Home Assistant
- [`zha-toolkit`](https://github.com/mdeweerd/zha-toolkit) by mdeweerd and contributors
- [Zigbee2MQTT](https://www.zigbee2mqtt.io/)'s device-image database for optional product images

Zigbee2MQTT is an independent, unaffiliated project. Disable **Show device photo** in the exploded device view to prevent those image requests and use the local diagram fallback instead.

## Licence

ZHA Bindings Manager is open source and released under the [MIT Licence](LICENSE).
