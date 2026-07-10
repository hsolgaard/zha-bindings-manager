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
<img width="1201" height="625" alt="Screenshot 2026-07-10 at 22 10 02" src="https://github.com/user-attachments/assets/2f452e56-cea5-4527-ae1b-9ea1ef92de10" />

**Bindings view** — a flat, searchable, sortable table of every binding.
<img width="1201" height="372" alt="Screenshot 2026-07-10 at 22 10 52" src="https://github.com/user-attachments/assets/5af7e6e5-e8c1-4929-8fe4-4c65809e7042" />

**Devices view** — every ZHA device with manufacturer, model, and binding count.
<img width="1201" height="454" alt="Screenshot 2026-07-10 at 22 11 25" src="https://github.com/user-attachments/assets/80c632c5-d7b5-4218-a520-b4e8b996d571" />

**Advanced view** — endpoint- and cluster-aware manual bind/unbind, with existing-binding context.
<img width="1201" height="519" alt="Screenshot 2026-07-10 at 22 12 15" src="https://github.com/user-attachments/assets/00b993ac-eee0-42be-a2e9-b439267b3f75" />



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
  coordinator bindings" toggle (on by default) filters out the reporting
  bindings most devices auto-create to the coordinator, so what's left is the
  device-to-device bindings you actually went looking for. A fullscreen
  toggle (⛶) expands the card to fill the browser window.
- **Floor Plan view** — set an image URL (a floor plan you drop into `www/`),
  drag devices from an "unplaced" list onto their physical spot, and see
  bindings drawn as lines on top of the image instead of an auto-arranged
  graph. Positions are saved as percentages of the image, so they survive a
  higher-resolution version of the same image later.
- **Bindings view** — a flat, searchable table of every binding read so far,
  with sortable Type/Area/Manufacturer/Model columns and a one-click unbind
  button. Click a source device's name to filter the table to just that
  device — a "+ Add binding" button then appears, which jumps to the
  Advanced tab with that device pre-selected as Source. Stale bindings
  (pointing at a device that's since been removed or re-paired) are flagged.
  Export the current (filtered) view as CSV, JSON, or print / save as PDF —
  all three include IEEE addresses, which the visible table doesn't show but
  which you need for manual zha-toolkit calls.
- **Devices view** — every ZHA device in one table (Name, Type, Manufacturer,
  Model, Area, Power source, binding count), independent of any binding data.
  Click a name to jump to the Bindings tab filtered to that device.
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

Edit a dashboard, add card → search "ZHA Bindings Manager", or add manually via YAML:

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
   they're awake** — you may need to press a button on the remote and re-scan
   just that device. (There isn't a way around this: it's how Zigbee sleepy
   end devices work, not a limitation of this card.)
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
  after making changes outside this card.
- Sleepy end devices may fail to respond to a bind table read; retry while
  the device is awake.
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
- "Stale binding" detection only knows about devices/groups currently in
  ZHA — it can't tell you a binding is *wrong*, only that its target no
  longer exists.
- Print / Save as PDF opens a new browser tab and relies on your browser's
  native print dialog; if pop-ups are blocked for Home Assistant's URL,
  allow them first.

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
network. Development assisted by [Claude](https://www.anthropic.com/claude) (Anthropic) — code
generation and iteration were AI-assisted; the requirements, design decisions,
and validation against real hardware were not.

Built on top of:
- [ZHA](https://www.home-assistant.io/integrations/zha/) (Home Assistant core)
- [zha-toolkit](https://github.com/mdeweerd/zha-toolkit) by mdeweerd and contributors
