---
title: "Entreluma: Map Viewer"
description: How to use the Entreluma map viewer in your Markdown posts.
permalink: /admin/entreluma-map-viewer
date: 2026-02-15
media_subpath: /assets/posts/entreluma
# image: map.png
# show_header_image: false
toc: true
order: 22
entreluma:
    mode: flat
    toolbar: false
---
<style>
    @media (min-width: 1650px) {
    #main-wrapper>.container {
            max-width: 1600px;
            padding-left: 1.75rem !important;
            padding-right: 1.75rem !important;
        }
    }
    .example {
        display: grid;
        gap: 1rem;
    }

    @media (min-width: 640px) {
        .example {
            grid-template-columns: 1fr 1fr;
        }
    }
    iframe {
        width: 100%;
    }
    pre .s2,
    pre .sx {
        white-space: pre-wrap;
        word-break: break-word;
    }
    .attribute > h2,
    .attribute > h3,
    .attribute > h4 {
        color: red;
        font-weight: bold;
    }
</style>

Entreluma lets you add **interactive maps** to your Markdown posts using a simple include. You do not need to write HTML, CSS, or JavaScript.

---

# The Simplest Example

This creates a map centered on Monument Valley in Utah.

<div class="example">

<div markdown="1">
{% raw %}
```liquid
{% include embed/map.html
    center="37.01056, -110.2425"
%}
```
{: .nolineno }
{% endraw %}

This example creates a map centered on the coordinates 37.01056, -110.2425, which correspond to the location of Monument Valley in Utah.  The map is displayed at the default zoom level. 

</div>

<div>
{% include embed/map.html
    center="37.01056, -110.2425"
%}
</div>

</div>

---

# Example with a Custom Caption and Location Marker

In this example a custom caption is defined

<div class="example">

<div markdown="1">
{% raw %}
```liquid
{% include embed/map.html
    center="37.01056, -110.2425"
    caption="Monument Valley, UT USA"
    markers="37.01056, -110.2425~Monument Valley"
%}
```
{: .nolineno }
{% endraw %}

In this example a caption and map marker are displayed. 

</div>

<div>
{% include embed/map.html
    center="37.01056, -110.2425"
    caption="Monument Valley, UT USA"
    markers="37.01056,-110.2425~Monument Valley"
%}
</div>

</div>

---

# Component Attribute

## Required Attributes

You must provide a **center** attribute to the map tag.  This defines the map location.  The **zoom** attribute is typically provided to control the level of detail displayed on the map when initially displayed.  This can be changed by viewer.  If not specified in an attribute, the initial zoom level is `8`.

### center
{: .attribute }

Defines the location the map is centered on.

You can use:

**Geo Coordinates**

    center="37.01056, -110.2425"

**A Wikidata ID**

    center="Q852197"

For example, 

<div class="example">
<div markdown="1">
{% raw %}
```liquid
{% include embed/map.html
    center="32.783333, -79.931944"
%}
```
{: .nolineno }
{% endraw %}

</div>

<div>
{% include embed/map.html
    center="32.783333, -79.931944"
%}
</div>
</div>

---

# Optional Attributes

These improve presentation but are not required.

---

## allmaps
{: .attribute }

Defines an Allmaps ID referencing an IIIF image to use as a map layer.  This is often used to create a historical map overlay.

## aspect
{: .attribute }

The width-to-height ratio of the map. Defaults to `1.0` (square).

    aspect="1.5"

## basemap
{: .attribute }

Defines the basemap — the tiled map imagery drawn underneath your markers and overlays. Defaults to `OpenStreetMap`.

    basemap="OpenTopoMap"

Five basemaps are available:

| Name | What it looks like | Max zoom |
|---|---|---|
| `OpenStreetMap` | The familiar street map: roads, labels, and place names. The default. | 19 |
| `OpenTopoMap` | Topographic — contour lines, terrain shading, trails. | 17 |
| `Esri_WorldPhysical` | Physical relief with no roads or labels, for a natural-landscape feel. | 10 |
| `Esri_WorldImagery` | Satellite and aerial imagery. | 18 |
| `CartoDB_Positron` | Pale, low-contrast streets that keep your markers prominent. | 20 |

Spell the name exactly as shown, underscores included. An unrecognized name is ignored; if none of the names given are recognized, the map falls back to `OpenStreetMap`.

The **max zoom** column matters when you also set `zoom`. `Esri_WorldPhysical` has no tiles past level 10, so asking for `zoom="14"` with it will not show you more detail.

**Letting readers switch basemaps.** List several names separated by commas and the map gains a layer picker in its top-right corner. The **first** name listed is the one shown when the map loads. The picker labels them with spaces in place of the underscores, so `Esri_WorldImagery` appears there as "Esri WorldImagery".

<div class="example">

<div markdown="1">
{% raw %}
```liquid
{% include embed/map.html
    center="37.01056, -110.2425"
    zoom="11"
    basemap="Esri_WorldImagery, OpenTopoMap, OpenStreetMap"
%}
```
{: .nolineno }
{% endraw %}

The map opens on satellite imagery. Use the control in the top-right corner to compare it against the topographic and street maps.

</div>

<div>
{% include embed/map.html
    center="37.01056, -110.2425"
    zoom="11"
    basemap="Esri_WorldImagery, OpenTopoMap, OpenStreetMap"
%}
</div>

</div>

## caption
{: .attribute }

Defines a caption to add to the map viewer.

## class
{: .attribute }

Size and position words like `medium right float` — see [Formatting Tips](entreluma-formatting-tips).

    class="medium right"

## geojson
{: .attribute }

Defines a URL to a GeoJSON file to apply as a map layer.

## id
{: .attribute }

An identifier for the viewer, **required when using action links** such as `flyto` (see below).

    id="map1"

## markers
{: .attribute }

Defines markers to add to the map.  Multiple markers are delimited with the pipe ('|') character.  A marker can be defined using a Wikidata ID or lat/lon position coordinates.  When using coordinates a label and image can also be provided using a tilde ('~') delimited values for the marker.

    markers="37.01056,-110.2425~Monument Valley"

## src
{: .attribute }

An image or IIIF resource to use as a map layer.

## zoom
{: .attribute }

Defines initial zoom level.  This is a number between 1 and 20, where the higher number reveals more detail.  Defaults to `8`.

    zoom="10"

---

# Action Links — Flying the Map from Your Text

The map's distinguishing interactive feature is the `flyto` action: a normal-looking Markdown link that animates the map to a new location when clicked. To use it, the map must declare an `id`.

<div class="example">

<div markdown="1">
{% raw %}
```liquid
{% include embed/map.html
    id="map1"
    center="37.01056, -110.2425"
    zoom="9"
%}
```
{: .nolineno }
{% endraw %}

Note the `id` attribute — the action links below target it.

```markdown
[Monument Valley](map1/flyto/37.02828,-110.23819,11)
[Grand Canyon](map1/flyto/Q118841,12)
```
{: .nolineno }

</div>

<div>
{% include embed/map.html
    id="map1"
    center="37.01056, -110.2425"
    zoom="9"
%}
</div>

</div>

The link URL has three segments: the map's `id`, the action name `flyto`, and the destination. The destination can be either:

| Form | Example | Meaning |
|---|---|---|
| `lat,lng,zoom` | `map1/flyto/37.02828,-110.23819,11` | Fly to exact coordinates at the given zoom level |
| `wikidata-id,zoom` | `map1/flyto/Q118841,12` | Look up the location of a Wikidata entity and fly there |

Try it: fly to [Monument Valley](map1/flyto/37.02828,-110.23819,11), or to the [Grand Canyon](map1/flyto/Q118841,12) by its Wikidata ID.

Clicking the **same** link a second time returns the map to the view it had before — readers can peek at a location and come right back.

The full action-link syntax, including custom labels, is in the [Action Links reference](entreluma-action-links).

---
