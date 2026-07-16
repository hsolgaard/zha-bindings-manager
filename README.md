# ZHA Bindings Manager

A visual manager for Zigbee **direct bindings** in Home Assistant's ZHA
integration: a graph and table overview of every binding on your network,
plus drag-and-drop bind/unbind — an alternative to hand-writing `zha_toolkit`
service calls in Developer Tools every time you want to see or change what's
bound to what.

![status](https://img.shields.io/badge/status-experimental-orange)
![license](https://img.shields.io/badge/license-MIT-blue)

> The Lovelace card itself is still added to a dashboard as
> `type: custom:zha-binding-map-card` — that internal name won't change even
> as the project has grown beyond "just a map."

## Screenshots

**Map view** — every device and its bindings, colour-coded by cluster type.
<img width="1425" height="735" alt="mapview" src="https://github.com/user-attachments/assets/8f28371b-301f-4eb6-ae26-805451041f80" />

**Bindings view** — a flat, searchable, sortable table of every binding, with Binding Health (summary card, Health column, and status filter chips).
<img width="1425" height="735" alt="bindings" src="https://github.com/user-attachments/assets/64294804-5788-4c1a-84a5-36abb755bb5e" />

**Binding Health detail** — clicking a Health badge explains what's wrong, why it matters, and what to do about it in plain English.
<img width="620" height="227" alt="Screenshot 2026-07-16 at 17 17 56" src="https://github.com/user-attachments/assets/dd7109e4-8d94-4751-83a9-216b021d70e7" />

**Devices view** — every ZHA device with manufacturer, model, binding count, and a Last scan column that doubles as a rescan/wake-device control.
<img width="2850" height="1080" alt="Devices screenshot" src="https://github.com/user-attachments/assets/8dc6f677-0840-45b9-ac30-d8dedf0bbad1" />

**Advanced view** — endpoint- and cluster-aware manual bind/unbind, with existing-binding context.
<img width="1201" height="519" alt="Screenshot 2026-07-10 at 22 12 15" src="https://github.com/user-attachments/assets/00b993ac-eee0-42be-a2e9-b439267b3f75" />

## Vision

ZHA Bindings Manager is designed to make Zigbee bindings understandable.

It is not intended to replace `zha_toolkit`, nor does it attempt to expose
every Zigbee capability. Instead, it provides a simple, visual interface
that helps users understand, create, and troubleshoot direct Zigbee
bindings.

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

A user noticed that an outside light kept turning on whenever the wrong
switch was pressed. The switch wasn't faulty. Home Assistant wasn't
involved. The user wasn't pressing the wrong button.

The cause was an unexpected direct Zigbee binding that had been forgotten.
A simple visual overview immediately revealed the rogue binding. Without
visibility, problems like this can be extremely difficult to diagnose.

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
  target. Drag a node to reposition it (saved per-browser); drag it **onto**
  another node to jump to the Advanced tab with both devices pre-selected as
  Source/Target and the most likely compatible cluster pre-picked, so you can
  choose the exact endpoint(s) before creating the bind. Click a line to
  inspect or remove it. Filter by device role (coordinator/routers/end devices/groups/
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
  higher-resolution version of the same image later.
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
  Click a name to jump to the Bindings tab filtered to that device. A
  **Last scan** column shows each device's status (never scanned / OK /
  partial / failed), when, its typical response time, and how often it's
  actually responded — learned from real scan history rather than guessed —
  and doubles as a one-click rescan button, so retrying one stubborn device
  doesn't mean re-running the whole network scan. Battery-powered devices
  that just failed or partially responded get a wake-device hint ("press a
  button on it, then rescan"); mains-powered devices get a different message
  ("check it's powered on and in range"), since a mains device can't be
  asleep. A small settings panel (⚙, next to "Scan bindings") lets you
  configure how many extra retries a single-device rescan uses — each retry
  costs a real ~45 seconds against a device that genuinely doesn't respond,
  so this is a deliberate trade-off, not a free improvement, and only
  applies to single-device rescans, never the full network scan.
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
   card — but retrying one device is much cheaper than a full rescan.)
3. Drag a button/switch node onto a relay/light node to bind them. Pick the
   cluster(s) in the dialog (On/Off and Level Control are pre-checked when
   present).
4. Click a line to see or remove a binding. Or use the **Bindings** tab for a
   flat list with unbind buttons.
5. For anything unusual (specific endpoint on a multi-gang switch, a cluster
   that wasn't auto-detected, binding directly to the coordinator), use the
   **Advanced** tab.

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
- The cluster pre-picked when you drag one device onto another (or use "+ Add
  binding") is based on matching output clusters on the source device with
  input clusters on the target device, and is only a suggestion — the
  dropdown always shows every output cluster on the chosen source endpoint,
  so you can pick something else. Some real-world bindings (e.g. certain IAS
  Zone sensor → siren setups) don't fit the auto-matched pattern at all;
  nothing is stopping you from picking any cluster manually.
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
