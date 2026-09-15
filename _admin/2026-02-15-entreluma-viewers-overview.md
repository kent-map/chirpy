---
title: "Entreluma: Viewers Overview"
description: A one-page tour of every Entreluma viewer — what each one does, when to use it, and where to find its full reference guide.
permalink: /admin/entreluma-viewers-overview
date: 2026-02-15
toc: true
order: 20
entreluma:
    mode: flat
    toolbar: false
---

Viewers are the interactive elements you add to an Entreluma post. Each one is added with a single include tag in your Markdown — you describe *what* to show, and Entreluma handles the presentation, interactivity, and layout.

This page lists every available viewer so you can pick the right one. Each viewer has its own reference page with a full attribute list, worked examples, and troubleshooting tips.

## The Viewers at a Glance

| Viewer | Include tag | Use it for |
|---|---|---|
| [Image](entreluma-image-viewer) | `embed/image.html` | Zoomable high-resolution images: maps, artworks, archival photos. First-class support for Wikimedia Commons and IIIF. |
| [Map](entreluma-map-viewer) | `embed/map.html` | Interactive maps with markers, GeoJSON overlays, and historical map layers. Text links can fly the map to a location. |
| [Image Compare](entreluma-image-compare-viewer) | `embed/image-compare.html` | Before/after sliders: then-and-now photographs, restorations, X-rays of paintings. |
| [YouTube](entreluma-youtube-viewer) | `embed/youtube.html` | Video with a clean inline preview. Text links can play a specific segment. |
| [Vimeo](entreluma-vimeo-viewer) | `embed/vimeo.html` | Vimeo video with a poster preview, expanded playback, unlisted-video hashes, and timed action links. |
| [Network](entreluma-vis-network-viewer) | `embed/vis-network.html` | Node-and-edge relationship diagrams built from simple CSV data in your post. |
| [Iframe](entreluma-iframe-viewer) | `embed/iframe.html` | Anything else — embed an external web page, exhibit, or widget. |

There is one more interactive feature that isn't a viewer include: **[Entity Info Popups](entreluma-entity-info-popups)** turn a plain Markdown link like `[Charles Darwin](Q1035)` into a contextual popup powered by Wikidata.

## The Common Pattern

Every viewer follows the same authoring pattern. You place an include tag in your Markdown where you want the viewer to appear:

{% raw %}
```liquid
{% include embed/image.html
    id="fig1"
    src="wc:Monument_Valley,_Utah,_USA.jpg"
    caption="Monument Valley, UT"
%}
```
{: .nolineno }
{% endraw %}

A few attributes appear on every viewer and are worth knowing from the start:

| Attribute | Purpose |
|---|---|
| `id` | A unique name for this viewer on the page. **Required if you want [action links](entreluma-action-links) to target it** — without an `id`, links in your text cannot control the viewer. |
| `caption` | Text displayed below the viewer. |
| `aspect` | The width-to-height ratio of the viewer (e.g. `1.5` for landscape, `0.75` for portrait). Each viewer has a sensible default. |
| `class` | Size and position words like `medium right float` — see [Formatting Tips](entreluma-formatting-tips). |

## Making Text Control a Viewer

The feature that sets Entreluma apart is that your prose can drive the viewers. A normal-looking Markdown link can zoom an image, fly a map to a location, or play a video segment:

```markdown
Major formations include [West Mitten Butte](fig1/zoomto/pct:10.94,27.88,21.05,30).
```
{: .nolineno }

The complete syntax, and the list of actions each viewer supports, is in the **[Action Links reference](entreluma-action-links)**.

## Layout

By default Entreluma floats a viewer beside the paragraph it follows and wraps the text around it. You can control size and placement per viewer, or switch the whole post to a two-column scrollytelling layout:

- [Formatting Tips](entreluma-formatting-tips) — sizing, positioning, and floating individual viewers
- [Display Modes](entreluma-display-modes) — flat pages vs. the two-column layout
