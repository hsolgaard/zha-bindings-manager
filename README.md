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
- Which endpoint on a multi-gang device is actually involved?

A real example: an outside light kept turning on when the wrong switch was pressed. The switch was not faulty and Home Assistant was not triggering it. An old direct Zigbee binding was. The map made the cause immediately visible.

## Requirements

- Home Assistant using the **ZHA** integration
- Home Assistant Core **2023.7 or newer**
- [`zha-toolkit`](https://github.com/mdeweerd/zha-toolkit) installed and working

ZHA Bindings Manager is a frontend-only Lovelace card. It uses Home Assistant's built-in ZHA websocket API to read devices, endpoints, clusters and groups, and uses `zha-toolkit` to read and modify device binding tables.

## Installation

### HACS — recommended

This repository is not yet in the default HACS store, so add it as a custom repository:

1. Open **HACS**.
2. Select **⋮ → Custom repositories**.
3. Add:

   ```text
   https://github.com/hsolgaard/zha-bindings-manager
   ```

4. Select category **Dashboard**.
5. Install **ZHA Bindings Manager**.

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

Reading binding tables is a real Zigbee operation. Battery-powered buttons and remotes may need to be woken before they respond. When one device fails, wake it and use its individual **Rescan** action rather than scanning the entire network again.

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
- an optional local annotation for what each endpoint is physically wired to.

The physical-load annotation is saved **in the current browser only**. It is not written to Home Assistant and does not automatically follow you to another browser or device.

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

## Credits

Designed, specified and tested by [Hans Solgaard](https://github.com/hsolgaard) against a real ZHA network.

Development assisted by [Claude](https://www.anthropic.com/claude) (Anthropic).

Built on:

- [ZHA](https://www.home-assistant.io/integrations/zha/) in Home Assistant
- [`zha-toolkit`](https://github.com/mdeweerd/zha-toolkit) by mdeweerd and contributors
- [Zigbee2MQTT](https://www.zigbee2mqtt.io/)'s device-image database for optional product images

Zigbee2MQTT is an independent, unaffiliated project. Disable **Show device photo** in the exploded device view to prevent those image requests and use the local diagram fallback instead.

## Licence

MITbindings.

Under the hood, ZHA Bindings Manager uses the excellent `zha_toolkit`
services where appropriate, while presenting the information in a way
that's approachable for everyday Home Assistant users.

### Why ZHA Bindings Manager?

Creating bindings is only part of the problem. Understanding them is often
much harder. Questions such as:

- Why is this switch controlling that light?
- Which switches control this light?
- Why does this still work when Home Assistant is offline?
- Did I leave old bindings behind after re-pairing a device?
- Why isn't the binding I expected actually there?

are surprisingly difficult to answer using the standard ZHA interface. ZHA
Bindings Manager focuses on making these answers obvious.

### Real-world example

I originally built ZHA Bindings Manager after an outside light in my own network kept turning on 'randomly'.
The switch was not faulty. Home Assistant was not involved, and the automation configuration appeared correct.
The cause was an old direct Zigbee binding that had been forgotten. Once the network was visualised, the rogue relationship was immediately obvious.

Without visibility, problems like this can be extremely difficult to diagnose.

### Design philosophy

- **Visibility before complexity** — show users what exists before asking
  them to understand Zigbee internals.
- **Plain English where possible** — explain concepts without assuming
  Zigbee knowledge.
- **Guide rather than expose** — help users achieve common tasks without
  requiring protocol expertise.
- **Advanced features remain available** — experienced users can still
  work directly with endpoints, clusters, and `zha_toolkit` where required.

### Project goals

ZHA Bindings Manager aims to answer questions such as:

- What does this switch control?
- What controls this light?
- Are any of my bindings likely to be broken?
- Are there any unexpected or duplicate bindings?
- Can I safely create this binding?

If users can answer those questions without reading Zigbee documentation,
the project has achieved its goal.

## What this is (and isn't)

This is a **Lovelace card** (frontend only, no custom backend integration). It doesn't
replace `zha-toolkit` — it's a UI on top of it:

- **Reading devices, endpoints, clusters, groups** → Home Assistant's built-in ZHA
  websocket API (the same API the native "Manage Zigbee Device" dialog uses).
- **Reading the current binding table of a device, creating bindings, removing
  bindings** → [`zha-toolkit`](https://github.com/mdeweerd/zha-toolkit) services
  (`binds_get`, `bind_ieee`, `binds_remove_all`, `bind_group`, `unbind_group`).
  The native ZHA API has no way to read a device's existing binding table and only
  supports coarse "bind everything compatible" device-to-device binding, which is
  exactly the limitation this card is working around.

**zha-toolkit must already be installed and working** (HACS → Integrations →
"zha-toolkit"), and your Home Assistant core needs to be **2023.7 or newer**
(for service call response data).

## Features

- **Map view** — every ZHA device and group as a node on a canvas. Existing
  bindings are drawn as coloured lines (colour = cluster type) from source to
  target, and a device that's a member of a Zigbee group also gets a
  group → member arrow sourced from real ZCL group membership data — a
  separate mechanism from bindings, since a group member receives that
  group's commands without needing a binding-table entry of its own. Each
  binding is classified as control, reporting, or unknown (based on whether
  its cluster is declared as an output on the source endpoint); reporting
  and unknown bindings are visually distinct and reporting ones are hidden
  by default (toggle below) so the graph reads as "who controls what," not
  a wall of every cluster interaction. A device that has both its own
  light/switch/cover/fan role and a real control binding elsewhere gets a
  small controller badge on its node — common on detachable/combo switches
  where one gang drives its own load and another gang has been rebound to
  control something else. Drag a node to reposition it (saved per-browser);
  drag it **onto** another node to jump to the Advanced tab with both
  devices pre-selected as Source/Target and the most likely compatible
  cluster pre-picked, so you can choose the exact endpoint(s) before
  creating the bind. Click a line to inspect or remove it; click a device
  node (without dragging it) to open its exploded per-endpoint view (see
  below). Filter by device role (coordinator/routers/end devices/groups/
  unbound), by entity type (Light, Switch, Garage Door, Motion Sensor, etc —
  derived from each entity's `device_class`, not just its raw domain), by
  manufacturer, or by area — all remembered across reloads. A "hide
  coordinator bindings" toggle (on by default, and affects both the Map and
  the Bindings tab) filters out the reporting bindings most devices
  auto-create to the coordinator, so what's left is the device-to-device
  bindings you actually went looking for. A fullscreen toggle (⛶) expands
  the card to fill the browser window.
- **Floor Plan view** — set an image URL (a floor plan you drop into `www/`),
  drag devices from an "unplaced" list onto their physical spot, and see
  bindings drawn as lines on top of the image instead of an auto-arranged
  graph. Positions are saved as percentages of the image, so they survive a
  higher-resolution version of the same image later. A "Marker size" setting
  scales device markers independently of the image's own resolution, useful
  when a lower-resolution floor plan leaves auto-scaled markers looking
  oversized. The same multi-role controller badge from the Map view appears
  here too; group → member edges don't, since this view doesn't place group
  nodes.
- **Exploded device view** — click "Explode" on a device (Devices tab) or
  click its node on the Map to open a per-endpoint breakdown built from a
  live scan of that one device, not assumptions:
  - Every endpoint's real relationships — self-bound, controls another
    device, controls a group, receives control, group membership,
    reporting-only, or unknown — shown as separate badges, since one
    endpoint can genuinely be more than one of these at once.
  - Detach-relay-mode state read live from the matching
    `switch.*_detach_relay_N` entity, never guessed from binding shape.
  - Manufacturer, model, quirk, power source, area, IEEE, network address,
    and firmware/hardware version (where available from Home Assistant's
    device registry).
  - A real product photo (fetched from Zigbee2MQTT's device image database
    by model id — see Credits) with a simple wall-plate diagram as an
    offline/no-match fallback showing one rectangle per real endpoint. A
    checkbox turns photos off if you'd rather this card never contact the
    internet.
  - A "What does this control?" picker per endpoint (Light / Fan / Outlet /
    Heating / Cover / Other appliance / Not set) — a closed list rather than
    free text, saved locally, for the one thing no Zigbee data can ever
    supply: what's physically wired to the other end.
- **Bindings view** — a flat, searchable table of every binding read so far,
  with sortable Type/Area/Manufacturer/Model columns and a one-click unbind
  button. Click a source device's name to filter the table to just that
  device — a "+ Add binding" button then appears, which jumps to the
  Advanced tab with that device pre-selected as Source. A **Health** column
  and summary card flag structural problems in plain English — missing
  source/target devices, endpoints, or clusters; duplicate bindings; bindings
  pointing at a Zigbee group that no longer exists — with filter chips (All /
  Problems Only / Errors / Warnings / Info) and a click-through detail popover
  explaining what's wrong, why it matters, and what to do about it, with a
  one-click "Rescan now" button where a rescan is the likely fix. This is a
  structural check only (does everything the binding refers to still exist?),
  not a live verification that the binding actually works over Zigbee.
  Export the current (filtered) view as CSV, JSON, or print / save as PDF —
  all three include IEEE addresses, which the visible table doesn't show but
  which you need for manual zha-toolkit calls.
- **Devices view** — every ZHA device in one table (Name, Type, Manufacturer,
  Model, Area, Power source, binding count), independent of any binding data.
  Click a name to jump to the Bindings tab filtered to that device, or click
  "Explode" for the per-endpoint breakdown above. A **Last scan** column
  shows each device's status (never scanned / OK / partial / failed), when,
  its typical response time, and how often it's actually responded — learned
  from real scan history rather than guessed — and doubles as a one-click
  rescan button, so retrying one stubborn device doesn't mean re-running the
  whole network scan. Battery-powered devices that just failed or partially
  responded get a wake-device hint ("press a button on it, then rescan");
  mains-powered devices get a different message ("check it's powered on and
  in range"), since a mains device can't be asleep. A small settings panel
  (⚙, next to "Scan bindings") lets you configure how many devices the full
  network scan reads concurrently (default 10 — higher isn't automatically
  better, see Known limitations) and how many extra retries a single-device
  rescan uses — each retry costs a real ~45 seconds against a device that
  genuinely doesn't respond, so this is a deliberate trade-off, not a free
  improvement, and only applies to single-device rescans, never the full
  network scan.
- **Advanced view** — a raw form over `bind_ieee` / `binds_remove_all` /
  `bind_group` / `unbind_group` / `unbind_coordinator` for cases the automatic
  cluster-matching elsewhere doesn't handle (specific endpoints on
  multi-gang devices, clusters not in the auto-detected list, etc). Source and
  target endpoints are real dropdowns populated from each device's actual
  endpoint list (not free-typed numbers), the Cluster field is a dropdown of
  the selected source endpoint's actual output clusters by friendly name
  (e.g. "On/Off" instead of `0x0006`), and side panels show existing bindings
  already on the source endpoint and already pointing at the chosen target —
  both drawn from your local scan cache, so scan first for complete results.
  A "Custom cluster ID…" option lets you bind a cluster the source device
  doesn't declare as bindable at all (e.g. binding the Basic cluster,
  `0x0000`, to a group — a firmware-specific trick some controllers respond
  to) — an expert option with no guarantee the device will actually behave
  as expected.

## Installing

### Via HACS (custom repository)

1. This project isn't in the default HACS store — add it as a custom
   repository instead: **HACS → ⋮ → Custom repositories**, add
   `https://github.com/hsolgaard/zha-bindings-manager` with category
   **Dashboard**.
2. Install "ZHA Bindings Manager" from HACS, then add the Lovelace resource if
   HACS doesn't do it automatically (**Settings → Dashboards → ⋮ → Resources**
   → `/hacsfiles/zha-bindings-manager/zha-binding-map-card.js`, type: JavaScript Module).

### Manual

1. Copy `zha-binding-map-card.js` into `config/www/`.
2. Add it as a Lovelace resource: **Settings → Dashboards → ⋮ → Resources → Add
   Resource**, URL `/local/zha-binding-map-card.js`, type **JavaScript Module**.

**Updating a manual install:** HACS installs auto-bust the browser cache on
update; a manual `/local/` resource doesn't, so after replacing the file your
browser may keep serving the old cached copy even after restarting Home
Assistant. A hard refresh (Ctrl/Cmd+Shift+R) usually fixes it. If it doesn't,
add a version tag to the resource URL itself — e.g.
`/local/zha-binding-map-card.js?v=0172` — and bump that number each time you
update the file manually; a changed URL forces the browser to fetch fresh
rather than serve its cache.

### Add the card

Add manually via YAML, or edit a dashboard → add card → search "ZHA Bindings Manager":

```yaml
type: custom:zha-binding-map-card
```

There is currently no visual card editor — all configuration is optional and
the card works with just the line above.

**This card looks and works best in a dedicated Panel-type view** — full
width, no competing cards, plenty of room for the graph. See "Recommended: a
dedicated full-page dashboard" below, which sets this up for you.

If you'd rather add it into an existing dashboard instead, a **Sections**
view works too (the card requests full row width by default, and is
resizable via the section's own grid handles), though it won't look quite as
clean as a dedicated Panel view. It does **not** work inside a classic
**Masonry** view at all — Masonry cards can't span more than one fixed-width
column, no matter what the card itself requests; that's a Home Assistant
limitation, not this card's.

### Recommended: a dedicated full-page dashboard

Give the card its own **Panel**-type view instead of squeezing it into an
existing dashboard — this is the setup this project is designed and tested
around. This repo ships a ready-made dashboard file
(`zha-binding-map-dashboard.yaml`) pre-configured that way:

1. Copy `zha-binding-map-dashboard.yaml` into your Home Assistant config
   directory (the same folder as `configuration.yaml` — **not** inside `www/`).
2. Add this to `configuration.yaml` (merge into an existing `lovelace:` block
   if you already have one):
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
3. Restart Home Assistant. A new "ZHA Bindings" entry appears in your
   sidebar, already full-width, no manual dashboard editing required.

(Home Assistant doesn't allow a Lovelace card/resource to register a
dashboard fully automatically on install — this two-step config is the
closest practical equivalent, and it's scripted/repeatable rather than a
one-off UI click-through that's easy to get wrong.)

## Using it

1. Open the card. It loads your ZHA device and group list automatically
   (read-only, instant).
2. Click **Scan bindings** to actually query each device's binding table over
   Zigbee (`zha_toolkit.binds_get`). This is a real radio operation per
   device, so it can take a little while on a large network, and **sleepy
   battery-powered devices (most buttons/remotes) often won't respond unless
   they're awake**. If a device doesn't respond, use the **Rescan** /
   **Wake & rescan** button next to it in the Devices tab afterwards — wake
   it first if it's battery-powered, then retry just that one device rather
   than the whole network. (There isn't a way around needing the device
   awake: it's how Zigbee sleepy end devices work, not a limitation of this
   card — but retrying one device is much cheaper than a full rescan.) The
   ⚙ settings panel next to "Scan bindings" lets you adjust how many devices
   the full scan reads concurrently and how many retries a single-device
   rescan uses, if the defaults don't suit your network.
3. Drag a button/switch node onto a relay/light node to bind them. Pick the
   cluster(s) in the dialog (On/Off and Level Control are pre-checked when
   present).
4. Click a line to see or remove a binding, or click a device node to open
   its exploded per-endpoint view. Or use the **Bindings** tab for a flat
   list with unbind buttons.
5. For anything unusual (specific endpoint on a multi-gang switch, a cluster
   that wasn't auto-detected, binding directly to the coordinator), use the
   **Advanced** tab.

## Community and support

Questions, ideas and examples from real ZHA networks are very welcome.

- [Questions and help interpreting results](https://github.com/hsolgaard/zha-bindings-manager/discussions/categories/q-a)
- [Feature ideas](https://github.com/hsolgaard/zha-bindings-manager/discussions/categories/ideas)
- [Show and Tell — networks, screenshots and successful diagnoses](https://github.com/hsolgaard/zha-bindings-manager/discussions/categories/show-and-tell)
- [General project discussion](https://github.com/hsolgaard/zha-bindings-manager/discussions/categories/general)
- [Report a reproducible bug](https://github.com/hsolgaard/zha-bindings-manager/issues)
- [Home Assistant Community thread](https://community.home-assistant.io/t/zha-bindings-manager-visual-manager-for-zha-zigbee-direct-bindings-graph-table-view-drag-and-drop-bind-unbind/1016911)

When asking for help or reporting an issue, please include where possible:

- ZHA Bindings Manager version
- Home Assistant version
- browser
- Zigbee coordinator
- device manufacturer and model
- relevant screenshots or diagnostic output

Please remove IEEE addresses or anything else you would prefer not to publish.

## Known limitations

- Binding data is only as fresh as your last **Scan bindings** — it is not
  live-updated, since reading it requires an actual Zigbee query. Re-scan
  after making changes outside this card. Bindings changed by other tools or
  by re-pairing a device are only picked up by a manual scan.
- A device with a large binding table can time out partway through — a
  later "page" of results doesn't arrive in time, even though an earlier
  page did. The card keeps whatever valid bindings were already returned
  instead of discarding them, and flags the device as "partial" (Binding
  Health shows this as an Info status) so you know to rescan it rather than
  assuming its binding list is complete.
- Bind/unbind from within this card automatically rescans the affected
  device(s) afterwards and reports what the rescan actually found, rather
  than the raw success/failure text zha_toolkit returns — that raw report
  can be misleading (e.g. reporting failure for a binding that turns out
  not to have existed in the first place). The status message you see (e.g.
  "Binding confirmed removed") reflects a real before/after comparison, not
  just zha_toolkit's opinion of what happened.
- Sleepy battery-powered end devices may fail to respond to a bind table
  read; the Devices tab's per-device Rescan/Wake & rescan button and its
  learned response-time history (see Features, above) help here, but there's
  no way around a device genuinely needing to be awake — that's how Zigbee
  sleepy end devices work.
- The concurrent scan batch size trades speed for reliability: testing on a
  real ~64-device network found batches much above ~10-12 can cause
  otherwise-healthy devices to intermittently fail to respond (Zigbee
  airtime/collision contention from that much traffic at once, not an
  actual device fault) — increase the default cautiously and only if you've
  confirmed it holds up on your own network.
- The cluster pre-picked when you drag one device onto another (or use "+ Add
  binding") is based on matching output clusters on the source device with
  input clusters on the target device, and is only a suggestion — the
  dropdown always shows every output cluster on the chosen source endpoint,
  so you can pick something else. Some real-world bindings (e.g. certain IAS
  Zone sensor → siren setups) don't fit the auto-matched pattern at all;
  nothing is stopping you from picking any cluster manually.
- The multi-role controller badge (Map/Floor Plan) is a heuristic, not a
  precise endpoint-level fact — Home Assistant's device registry has no
  field tying an entity to a specific Zigbee endpoint, so the badge can only
  tell you a device has both a light/switch/cover/fan role *and* a real
  control binding elsewhere, not confirm they're on different endpoints.
  Open the exploded device view for the definitive per-endpoint picture.
- No visual Lovelace card editor yet (YAML-only config, though the only
  required line is `type: custom:zha-binding-map-card`).
- This card calls `zha_toolkit` services with `return_response: true`, which
  requires Home Assistant Core ≥ 2023.7 and a reasonably recent zha-toolkit.
- Binding Health only knows about devices/groups/endpoints/clusters currently
  in ZHA — it's a structural check, not a live Zigbee verification. A binding
  can look perfectly healthy and still not work in practice (e.g. the devices
  are out of range), and it can't detect that until you actually test it.
- Print / Save as PDF opens a new browser tab and relies on your browser's
  native print dialog; if pop-ups are blocked for Home Assistant's URL,
  allow them first.
- If a bind/unbind/scan action fails, the on-screen message is intentionally
  short. Open your browser's developer console (F12) and look for a
  `[ZHA Bindings Manager]` log line right before the failure — it includes
  the full request sent and the raw response zha-toolkit returned, which is
  usually more diagnostic than the toast message alone.

## Related projects

- Native ZHA "Manage Zigbee Device → Bindings" tab — lets you create one
  binding at a time, but doesn't show what's already bound. This project
  exists to fill that gap.
- [zigbee-floorplan-card](https://github.com/TheLarsinator/zigbee-floorplan-card) —
  a different (and actively maintained) tool: it visualizes Zigbee mesh
  routing/link quality on a floorplan, primarily for Zigbee2MQTT. It doesn't
  read or manage bindings.

## Credits

Designed, specified, and tested by [Hans Solgaard](https://github.com/hsolgaard) against a real ZHA
network. Development assisted by [Claude](https://www.anthropic.com/claude) (Anthropic)

Built on top of:
- [ZHA](https://www.home-assistant.io/integrations/zha/) (Home Assistant core)
- [zha-toolkit](https://github.com/mdeweerd/zha-toolkit) by mdeweerd and contributors
- Device photos in the exploded device view are fetched from
  [Zigbee2MQTT](https://www.zigbee2mqtt.io/)'s device image database — an
  independent, unaffiliated project, credited here for the images this card
  displays but otherwise not used by or connected to it in any way. Turn off
  "Show device photo" in that view if you'd rather this card never contact
  it (or the internet at all).

## Licence

ZHA Bindings Manager is open source and released under the [MIT Licence](LICENSE).
