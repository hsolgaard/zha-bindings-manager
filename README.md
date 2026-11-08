# ZHA Bindings Manager

A visual topology, binding and endpoint diagnostic tool for Home Assistant's ZHA integration.

See what controls what, identify stale or unexpected bindings, inspect devices endpoint by endpoint, and create or remove direct Zigbee bindings without hand-writing `zha_toolkit` service calls.

![release](https://img.shields.io/github/v/release/hsolgaard/zha-bindings-manager)
![HACS](https://img.shields.io/badge/HACS-Default-41BDF5)
![license](https://img.shields.io/badge/license-MIT-blue)

> [!IMPORTANT]
> **Most people want the [ZHA Bindings Manager integration](https://github.com/hsolgaard/zha-bindings-manager-integration) instead.** It includes this card, adds a **ZHA Bindings** sidebar page with no dashboard setup, and adds shared storage, bindings on each device's page, a nightly check for disappearing bindings and more. In HACS it's the **ZHA Bindings Manager** entry of type **Integration**; this one, **ZHA Bindings Manager (card only)**, is the Dashboard entry. Install one or the other, not both.

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
- Home Assistant Core **2023.7 or newer** for the card on its own, **2024.7 or newer** for the integration
- [`zha-toolkit`](https://github.com/mdeweerd/zha-toolkit) installed and working

ZHA Bindings Manager is a frontend-only Lovelace card. It uses Home Assistant's built-in ZHA websocket API to read devices, endpoints, clusters and groups, and uses `zha-toolkit` to read and modify device binding tables.

## Two ways to install

ZHA Bindings Manager comes in two forms. Both run exactly the same card, built from this repository, and both carry the same version number.

| | **Card only** (this repository) | **Integration** ([`zha-bindings-manager-integration`](https://github.com/hsolgaard/zha-bindings-manager-integration)) |
|---|---|---|
| Install | HACS → Frontend. No restart. | HACS → Integrations, restart, then **Add integration**. |
| Where your data is saved | Only in the browser you're using | Shared in Home Assistant, the same on every browser and device (can be switched off) |
| Sidebar page | Set up yourself (see [Dedicated full-page dashboard](#dedicated-full-page-dashboard)) | Added automatically: **ZHA Bindings**, admins only (can be switched off) |
| Notice when you remove a device others are bound to | No | Yes (can be switched off) |
| After an update | Hard-refresh your browser | Restart Home Assistant; the browser always picks up the new card |

**Install one or the other, not both.** If you have the integration, remove this card from HACS. The integration already includes it, and having both means two copies compete for the same page (the integration raises a Repairs notice if it finds both).

### Using the card on your own dashboards with the integration

The integration's sidebar page works on its own. To also place the card on your own dashboards (`type: custom:zha-binding-map-card`), open **Settings → Devices & services → ZHA Bindings Manager → Configure** and turn on **Load the card on every page**.

It's off by default for a reason: the card is about 380 KB (about 100 KB compressed), and with this option on, every dashboard page loads it, including on phones and tablets that never open it. Leave it off unless you want the card outside the sidebar page.

### Where your data is saved

Everything the card saves (bindings and health data, the floor plan and device placements, Map positions, endpoint annotations, filters and the other ⚙ settings) lives in the browser you're using, unless the integration is installed with shared storage on.

A badge in the toolbar always shows which mode is active: 🔒 **This browser only** or ☁ **Shared in Home Assistant**. The first time a browser finds shared storage, it asks once whether to use it. Nothing changes without confirming, and if shared storage already has data from another device, it's never overwritten: only what's missing is filled in from this browser. You can switch either way at any time in the ⚙ panel's Storage section.

⚙ → **About** shows the card version and, if the integration is installed, its version too.

## Installation

### HACS — recommended

These steps install the card only. For the integration, follow the installation steps in [its README](https://github.com/hsolgaard/zha-bindings-manager-integration) instead.

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
6. Click any device (a Map node, a name in the Devices or Bindings view) to open its side panel: what it controls, what controls it, and its actions. **Show endpoints…** there gives the endpoint-by-endpoint breakdown.
7. To make a remote control some lights, open the **Groups** tab, click **New group for a remote…** and follow the steps.
8. **Check and share capabilities…** in a device's side panel checks which commands its firmware actually implements, and lets you share the result with the community database.
9. Open the **Zigbee Capability Explorer** view to see what your own devices — or a device you're considering buying — are confirmed to support, based on scans shared by the community.

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
- Give each floor its own plan when your house has more than one level (uses Home Assistant's floors; see [Floors](#floors)).

### Diagnose bindings

- Search and sort every discovered binding in a flat table.
- Click a device (in the Devices tab, the Source or Target column, or on the Map) to open its side panel. **Show its bindings** there filters the table to every binding that device is involved in: the ones it controls (Outbound) and the ones where another device controls it (Inbound). A Direction column and an All / Outbound / Inbound toggle appear while a device is selected.
- Typing a name into the search box that matches exactly one device (at least three characters) does the same thing, and a "Clear search" button in the banner empties the box. A term that matches several devices stays an ordinary text search.
- Detect missing devices, targets, endpoints or clusters.
- Flag duplicates, and bindings to groups Home Assistant doesn't know (Info: often made on the devices themselves by Find & Bind).
- Explain each health finding in plain English.
- Rescan the relevant device directly from a health finding.
- Each device's side panel says whether its model is in the community capability database yet, with a link to check and share it if not.
- Export the filtered data as CSV or JSON, or print/save it as PDF.
- With the integration, see **lost bindings**: see [Lost bindings](#lost-bindings-needs-the-integration).

Binding Health is a **structural check**. It verifies that the objects referenced by a binding still exist in ZHA; it does not prove that the devices can currently communicate over the air.

### Lost bindings (needs the integration)

Bindings sometimes disappear: a remote is reset or re-paired, loses its table after a firmware update, or some
devices just drop them now and then. With the [integration](https://github.com/hsolgaard/zha-bindings-manager-integration)
and its **Watch for lost bindings** (on by default), every read of a device's binding table is compared with what it
had before:

- A **red banner** above the Bindings table lists lost bindings, with **Put all back**, **Check again** and, per
  binding, **Removed on purpose**. Binding Health shows a **Lost** count, and the Map draws them as dashed red lines.
- Battery devices that are asleep are put back the next time you press one of their buttons.
- In a device's side panel, choose **Off**, **Tell me** or **Put back automatically** (at most 3 times a day, then it
  stops and tells you: something keeps removing them).
- **Switch the lights from Home Assistant if a press doesn't reach them** (per remote): after On, Off or Toggle, a
  light bound directly that hasn't changed within 2 seconds is switched by Home Assistant and logged, and the
  remote's bindings are checked. Not for group bindings, and Toggle only when the lights agreed before the press.
- Unbinding in the card is never reported as lost. Removing a binding some other way is: use **Removed on purpose**.

### Address changes and missed presses (needs the integration)

Some remotes stop controlling a light although the binding is still in their table, and removing and re-adding it
fixes it. One theory is that the light's short network address changed and the battery remote, which never hears the
light announce its new address, keeps sending to the old one. With the integration's **Record address changes and
missed presses** (on by default), you can see whether that happens on your network:

- every device's network address is recorded over time (side panel: **Network address**, and how often it changed),
- when a remote's On, Off or Toggle doesn't reach a light it's bound to directly within 2 seconds, it's logged, with
  whether that light's address changed since the last press that worked,
- a notice on the Bindings tab when either happens, with **Show** and **Share anonymously…**: a report of every
  device's make, model, firmware, power source and role (coordinator included), the address changes and the missed
  presses, with devices numbered and no addresses, names, areas or times of day. You review it before anything is
  sent, as a GitHub issue to the community [zigbee-capabilities](https://github.com/hsolgaard/zigbee-capabilities)
  database.

It's read-only: nothing is sent to your devices.

### Replace a device

**Replace this device…** in a device's side panel (or **Move to a new device…** on the banner for bindings to
devices no longer in ZHA) moves everything to a new device, after checking it can do the same job:

1. Choose the new device: the same model and the same kind of device are listed first.
2. Check: each binding and group is checked against the new device's clusters in the right role (a light needs to
   accept the commands, a remote needs to send them), with the community database's confirmed commands where known.
   A verdict says whether it can do everything, most of it (what it can't do is unticked and explained), or not.
   Multi-gang devices get an endpoint choice.
3. Copy: bindings on other devices are pointed at the new one, its own bindings are recreated, and it joins the old
   device's groups. Each is read back. Battery devices that are asleep get theirs at their next button press.
4. Clean up: remove the bindings still pointing at the old device, take it out of its groups, and optionally remove
   it from ZHA. Until then both stay bound, so nothing goes dark.

Settings such as power-on behaviour aren't copied. Needs the integration.

### How does it behave? (device questions)

Every device's side panel has **How does it behave? Help the next person**: a minute's worth of questions with
preset answers about what a scan can't show. It starts with what you use the device for (a rocker wired to a light
and the same rocker used as a remote get different questions), then asks about staying connected, what a press
really sends, power-cut behaviour, batteries and firmware updates, with an optional 1–5 rating ("ignoring price, how
good is it at what you use it for?") and a tip.

- Answers go to the community [zigbee-capabilities](https://github.com/hsolgaard/zigbee-capabilities) database as a
  pre-filled GitHub issue that you review and submit. They're kept per firmware and per use, and free text is
  reviewed before it's shown.
- What others answered for your model and firmware is shown in the same place, and on the
  [website](https://hsolgaard.github.io/zigbee-capabilities/).
- For a model that isn't in the database yet, share its capability scan alongside your answers.

### Inspect devices endpoint by endpoint

Click a device anywhere in the card to open its side panel, then **Show endpoints…**. The Endpoints and clusters view is built from a live scan rather than assumptions. It shows:

- each endpoint's input and output clusters;
- self-bindings, outgoing control, incoming control and group relationships;
- reporting-only and unclassified relationships;
- detach-relay state where Home Assistant exposes a matching entity;
- manufacturer, model, quirk, power source, IEEE address, network address and firmware details;
- a product image where a Zigbee2MQTT device-image match is available;
- an offline endpoint diagram when no image is available;
- an optional local annotation for what each endpoint is physically wired to;
- an on-demand **Supported commands** check for the control-capable clusters declared by that endpoint;
- an **Open in Home Assistant** button that opens the device's own Home Assistant page (Zigbee device info, Reconfigure, entities and settings) in a new tab.

The supported-command check uses `zha_toolkit.scan_device` to query the device directly. Each applicable cluster appears as a collapsed row and, after scanning, expands to show the complete known command set, including both confirmed supported and unsupported commands.

This helps diagnose an important class of problem that Binding Health cannot detect: a binding may be structurally correct while the receiving device's firmware does not implement the particular command sent by the controller.

Completed scans can also be reviewed and shared with the public [`zigbee-capabilities`](https://github.com/hsolgaard/zigbee-capabilities) dataset — see [Explore device capabilities](#explore-device-capabilities) below. **Share scan to community database** covers the whole device in one submission, not one per endpoint: every endpoint you've checked is included, and any endpoint the device declares but that hasn't been (or can't be) checked — such as a Green Power proxy endpoint — is still listed rather than left out. Shared records contain the manufacturer, model, firmware identity, per-endpoint cluster signatures, and discovered command and attribute support. They deliberately exclude IEEE addresses, entity IDs, Home Assistant areas and binding data.

Nothing is submitted automatically. The card prepares a GitHub issue for the user to review and submit using their own GitHub account.

The physical-load annotation is saved locally by default, the same as everything else the card stores — see [Where your data is saved](#where-your-data-is-saved) above if you'd like it, along with the rest of the card's data, to follow you across browsers and devices.

### Explore device capabilities

The **Zigbee Capability Explorer** view answers what a device can actually do, using evidence from real scans shared by the community rather than manufacturer claims or trial and error.

- **Explore my devices** cross-references your own ZHA devices against the community dataset. Each device card leads with a summary — manufacturer + model, local device name, a **Community confidence** panel, and **Good for** tags — answering "is this the device I'm looking for" before any protocol detail appears. Confirmed commands, grouped under plain-English **Capabilities** headings (for example, *Brightness control*), plus the raw per-firmware endpoint breakdown, sit behind a "Technical evidence ▾" disclosure: full detail for advanced users, never in the way for anyone just checking what a device can do. The Community confidence panel is a ★★★★☆-style star rating plus firmware version count, observation count and last-confirmed date, all in one place instead of spread across a badge, a summary line and a separate note; the underlying tiers are Preliminary, Growing evidence, Well confirmed and High confidence (plus a distinct "⚠ Conflicting" callout when the community's own scans disagree with each other), and the star scale is its own graduated 1–5 rating so a device backed by 50 scans reads as more confirmed than one with exactly 5.
- A **Good for** row on each device card turns confirmed evidence into short use-case tags — *Switch things on/off*, *Detect motion / occupancy*, *Act as a remote / controller* — so you don't need to know what a cluster or command is to answer "would this device do what I want." The evidence bar is the same model on any firmware in the dataset, not necessarily your device's exact firmware version; a tag backed only by evidence from a different firmware is marked with a small caveat rather than presented as fully verified for your unit. The same tags appear in the standalone site's search results, for deciding whether to buy a device you don't own yet.
- **Find a device** (formerly "Search database") answers "which device should I buy or use for X?" first, and still gives experts full precision when they need it. A dozen Quick Search chips — grouped under Lighting, Sensors and Networking — cover the most common questions (on/off control, dimming, scene control, color control, motion/occupancy sensing, temperature/humidity/energy monitoring, security/contact sensing, group control, OTA support) without requiring any Zigbee vocabulary. The exact manufacturer/model/cluster/command/attribute/firmware dropdowns are unchanged and still available, collapsed by default behind an "Advanced filters" disclosure. Results are device cards — the same Community confidence panel, Good for tags, and "View capabilities" disclosure used in Explore my devices — grouped and ranked by community confidence, then recency, then firmware coverage, then name, rather than one row per firmware record. A search with no matches explains that a gap isn't proof a device lacks a capability, with a direct link to contribute a scan.
- Each matched device and search result opens with a plain-English **device overview**: what the device can be commanded to do, what it senses or reports, and whether it can directly control another Zigbee device over a bind without Home Assistant in the loop. A device that can be commanded but has no declared way to control another device gets an explicit "Cannot ... directly" statement rather than silence. Each capability group also carries an **Input**, **Output** or **Both** badge, with a legend above the list. Output means the device declares that capability itself. That is accurate for the large majority of devices, but it is a declaration and has not been independently tested.
- Device cards show a product photo (the same **Show device photo** setting as the Endpoints and clusters view), links to the device's Blakadder and manufacturer pages where they are known, and a **View on website** link to the full record on the public [zigbee-capabilities](https://hsolgaard.github.io/zigbee-capabilities/) site.
- Devices that report a raw Tuya manufacturer code such as `_TZ3000_46t1rvdu` are grouped and filterable as **Generic Tuya**. The raw string is still shown alongside the label.
- **Compare firmware** shows exactly what changed between two firmware versions of the same model, command by command.
- If the community has confirmed a newer firmware than the one your device reports, this is flagged directly against your device — the card only ever states what has been *observed*, never what a manufacturer calls "latest."
- From the Endpoints and clusters view, **Check supported commands** followed by the **Compare My Device** panel runs the same firmware comparison against your own live scan, without leaving that dialog.
- A **Community heartbeat** panel frames the dataset as what it is — entirely community-built, with every scan contributing real evidence for someone else — and then highlights a small number of factual observations underneath: the most-confirmed device, a device whose capabilities genuinely differ by firmware version, the newest contribution, and how much activity the dataset has seen recently. It deliberately excludes manufacturer-level comparisons or percentages; the dataset isn't yet large enough to support that kind of claim reliably. When a highlight is about a device you're currently looking at, that device's own card says so directly rather than leaving the connection to you.

Coverage is limited to devices someone has scanned and shared. A missing or empty result means no submission exists yet, not that a device is incapable of something.

### Create and remove bindings

- **Set up what this controls…** (in a remote's or switch's side panel) does it step by step: choose the lights, blinds or other devices it should control, then whether it controls them **directly** (a binding to each device) or **through a group** (one binding to a ZHA group). The card suggests one, based on how many devices you chose, whether they can join groups, and what other users reported for that remote. It then creates or updates the group if needed, binds the remote, checks the bindings were stored and asks you to test it. **New group for a remote…** in the Groups tab starts the same steps from a group.
- Devices without the Groups cluster (some relay modules, for example) are marked *can't join groups* and are only offered for direct control.
- Drag a source device onto a target device to pre-select a likely binding.
- Choose the exact source endpoint, target endpoint and cluster before committing.
- Remove bindings directly from the map or table.
- Bind devices to Zigbee groups.
- Use the Advanced view for multi-endpoint devices, unusual clusters and coordinator bindings.
- Enter a custom cluster ID for firmware-specific expert use cases.

After a bind or unbind operation, ZHA Bindings Manager rescans the affected device and compares the result. Confirmation is therefore based on the resulting binding table, not only on the raw response returned by `zha-toolkit`.

- A battery remote that was asleep can't be read straight away, so its change stays **not confirmed yet**. Unconfirmed binds are drawn as dashed lines on the Map (click one to check again) and are remembered across a page reload for up to 14 days.
- When **Unbind all** or an unbind fails, the card shows zha-toolkit's own error. Unbinding from a device that's already been removed from ZHA fails with a known zha-toolkit error; the card explains it and the workaround (pair the removed device again, then unbind it normally).

### Manage groups

The **Groups** tab lists every ZHA group with its lights and the remotes bound to it.

- **Add lights…** and **Remove** change a group's members straight away, using ZHA's own group commands. Every remote bound to the group controls the new set of lights without being touched.
- **Add a remote…** binds a remote to that group, step by step (the same guided setup, with the group already chosen).
- **New group for a remote…** picks a remote and its lights, and creates or reuses a group.
- **Delete group…** first lists any bindings that still point to the group. **Unbind them, then delete** removes those bindings (wake battery remotes first) and only deletes the group once they're gone; **Delete anyway** skips that. If some can't be removed, it says why for each device (a battery device asleep, a mains device offline) and offers **Try again** or **Delete and leave these bindings**. Deleting a group also removes its light entity in Home Assistant.
- A light reporting its own state to the group is bound on a cluster it receives, which zha-toolkit's `unbind_group` can't remove. The card removes that binding with `binds_remove_all` limited to its endpoint and cluster, but only when the light has no other binding on that endpoint and cluster (which would be removed too); otherwise it's left and the card says so.
- Bindings where a device only reports its own state to the group are counted separately, not listed as control.
- **Groups only on devices** lists group IDs that bindings use but ZHA doesn't know (for example made by a remote's Find & Bind). **Add to Home Assistant** creates a ZHA group with the same ID; add its lights with **Add lights…**.

### Floors

If your house has more than one level, give each floor its own floor-plan image:

1. In Home Assistant, **Settings → Areas, labels & zones → Floors**: add a floor for each level, with its level number (0 = ground, 1 = first, …).
2. In the same place, under **Areas**, open each area and choose its floor. Devices take their floor from their area.
3. Reload the card. A **Floor** picker appears on the Floor Plan tab: choose a floor, set its image and place its devices.

Your existing plan becomes the lowest floor's plan, so nothing is lost. Placing a device on a floor's plan overrides the floor its area gives it.

### Check your Zigbee network (beta, needs the integration)

With the [integration](https://github.com/hsolgaard/zha-bindings-manager-integration) installed and **Experimental features** turned on under its Configure, a **Network** tab (marked *beta*) appears. **Scan network** reads each router's routing and neighbour tables with `zha_toolkit.get_routes_and_neighbours`, one router at a time. Nothing on your network is changed.

- **Map:** routers on your floor plan (or in a circle without one), with lines coloured by link quality (LQI): green good, amber fair, red weak. Thresholds are 150 and 80 by default and can be changed under the integration's Configure. Tap a line for its details (both directions' readings, or a battery device's link to its parent); zoom and pan on a phone. Devices and labels keep their size as you zoom in.
- **Show:** *Strongest links* (each router's best few links, the default), *Every link heard* (everything in the neighbour tables), or *Routes my bindings use*. A **link** is two devices that can hear each other. A **route** is the way a command actually travels: for each binding the card follows the routing tables hop by hop and draws arrows, weakest first in a list.
- **Battery devices** don't route, so they're drawn as small dots joined to their parent router. One shown as *parent unknown* hasn't been heard by any router read so far.
- **Routers that didn't answer** are listed with **Read again**. Routers that haven't been read are drawn with *(not read)*; open one's side panel and choose **Read this router**.
- **Floors:** with Home Assistant floors set up, the map shows one floor at a time and lists the links between floors.
- **Suggestions and weakest links** point at devices that hang on a single weak link and places where an extra router would help.
- **Show route on the Map:** click a device-to-device binding on the Map, then **Show route on the Map** (or use **Show on the Map** next to a binding in a remote's **Check route…**). Each hop is drawn over the Map in its link-quality colour with its LQI, and a banner names the path and its weakest hop. **Clear route** removes it.
- **Check route…** in a remote's side panel shows the likely path of each of its bindings and the weakest hop. Group bindings are broadcast, so only the first hop to its parent is shown.

- **Messages to Home Assistant:** how many messages each device sends a minute now and over the hour, its busiest
  clusters, and the coordinator's own counters. A device sending far more than usual, or one using the
  coordinator's address, is flagged in red: it can slow the whole network down.

These tables are a snapshot: Zigbee re-chooses routes all the time, and an end device is only known through its parent. Treat the map as a guide, not proof.

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

### Endpoints and clusters view

A live, per-endpoint view of the device's roles and relationships.

![Endpoints and clusters view](https://github.com/user-attachments/assets/96cc4e6c-7d0e-41ff-be4f-0d7dbb62b1ff)

</details>

<details>
<summary><strong>Advanced binding</strong></summary>

Endpoint- and cluster-aware manual binding with existing-binding context.

![Advanced view](https://github.com/user-attachments/assets/d3369c99-26b2-4b42-a597-79bd0805522c)

</details>

## Dedicated full-page dashboard

With the integration installed, you don't need this: it adds the **ZHA Bindings** sidebar page for you. For a card-only install, the repository includes `zha-binding-map-dashboard.yaml`, which creates a ready-made Panel dashboard.

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

A browser may continue serving an older copy of a manually installed `/local/` resource. The version label in the card's toolbar shows which build is actually loaded. If it isn't the version you installed, try a hard refresh first: **Ctrl/Cmd+Shift+R**.

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
- The controller badge on a combined actuator/controller device is a device-level heuristic. Use the Endpoints and clusters view for endpoint-level evidence.
- Binding Health checks structure, not radio reachability or real-world operation.
- **Check supported commands** is a separate live-device query and may take several seconds. It is not part of the normal binding-table scan.
- Some devices do not respond to Zigbee command-discovery requests. An empty response is therefore reported as inconclusive rather than treated as proof that the device supports no commands.
- Very large capability scans may not fit in a pre-filled GitHub issue URL. In that case, the card copies the formatted JSON so it can be pasted into the prepared issue manually.
- Output capabilities in the Capability Explorer are what a device declares about itself, not what has been tested. Some older firmware, such as certain Xiaomi and Aqara sensors, declares output clusters the hardware cannot use. A declared Output means "the device says it can", not "it has been seen to work".
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

## Development

`zha-binding-map-card.js` — the single file Home Assistant/Lovelace actually loads — is a generated build output, not something to hand-edit. The real source lives in `src/`, split into modules; `build.js` (esbuild) bundles `src/index.js` and everything it imports into that one file.

```sh
npm ci
npm run build   # rebuilds zha-binding-map-card.js from src/
npm test        # vitest: storage providers, Bindings table filter logic, device links
node smoke-test.js   # broader logic coverage: parsing, capability records, endpoint classification, etc.
npm run watch    # rebuild on every src/ change, for local iteration
```

A GitHub Action (`.github/workflows/build.yml`) runs the build (plus tests) automatically on every push to `src/**`/`build.js`/`package.json` and commits the resulting `zha-binding-map-card.js` back to `main` — so in normal use, editing `src/` is the only step; you never need to run the build or commit the compiled file by hand.

`src/capexplorer.js` and `src/capexplorer-constants.js` are the pure data layer behind the Capability Explorer tab, deliberately kept dependency-free from the rest of `src/` — they're meant to be reusable outside this card, and in fact are: [`zigbee-capabilities`](https://github.com/hsolgaard/zigbee-capabilities), the standalone community device-capability website, imports byte-identical copies of both files directly as plain ES modules. Keeping them in sync across the two repos is still a manual step today, not automated.

## Related projects

- Home Assistant's native **ZHA → Manage Zigbee Device → Bindings** interface can create bindings, but does not provide a network-wide view of existing binding tables.
- [`zigbee-floorplan-card`](https://github.com/TheLarsinator/zigbee-floorplan-card) visualises Zigbee mesh routing and link quality, primarily for Zigbee2MQTT. It does not read or manage ZHA binding tables.
- [`zigbee-capabilities`](https://github.com/hsolgaard/zigbee-capabilities) is the openly licensed community device-capability dataset behind the Zigbee Capability Explorer view. ZHA Bindings Manager is one contributor and one consumer of it, not the other way around — the dataset itself is usable independently of this card, and of Home Assistant entirely.
- [`zha-bindings-manager-integration`](https://github.com/hsolgaard/zha-bindings-manager-integration) is the integration version described in [Two ways to install](#two-ways-to-install). It includes this card.

## Credits

Designed, specified and tested by [Hans Solgaard](https://github.com/hsolgaard) against a real ZHA network.

Development assisted by [Claude](https://www.anthropic.com/claude) (Anthropic).

Built on:

- [ZHA](https://www.home-assistant.io/integrations/zha/) in Home Assistant
- [`zha-toolkit`](https://github.com/mdeweerd/zha-toolkit) by mdeweerd and contributors
- [Zigbee2MQTT](https://www.zigbee2mqtt.io/)'s device-image database for optional product images

Zigbee2MQTT is an independent, unaffiliated project. Disable **Show device photo** in the Endpoints and clusters view to prevent those image requests and use the local diagram fallback instead.

## Licence

ZHA Bindings Manager is open source and released under the [MIT Licence](LICENSE).
