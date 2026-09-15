---
title: "Entreluma: Iframe Viewer"
description: How to embed external web pages, exhibits, and widgets in your Markdown posts with the Entreluma iframe viewer.
permalink: /admin/entreluma-iframe-viewer
date: 2026-02-15
toc: true
order: 26
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

## Overview

The iframe viewer is the general-purpose embed: it places any external web page inside your post, framed and captioned consistently with the other Entreluma viewers.

Use it when none of the specialized viewers fits — digital exhibits, library viewers (like the Biodiversity Heritage Library), data dashboards, interactive timelines, or any web resource that offers an embeddable URL.

Use a specialized viewer instead when one exists for your content: the [Image](entreluma-image-viewer), [Map](entreluma-map-viewer), [Image Compare](entreluma-image-compare-viewer), [YouTube](entreluma-youtube-viewer), [Vimeo](entreluma-vimeo-viewer), and [Network](entreluma-vis-network-viewer) viewers all offer interactivity that a plain iframe can't (zooming, action links, and so on).

## Attributes

### Required Attributes

#### src
{: .attribute }

The URL of the page to embed.

    src="https://www.biodiversitylibrary.org/item/128371#page/12/mode/1up"

Not every site allows itself to be embedded — see [Troubleshooting](#troubleshooting) below.

---

### Optional Attributes

#### caption
{: .attribute }

Text displayed below the embedded page.

    caption="Curtis's Botanical Magazine, 1845"

---

#### aspect
{: .attribute }

The width-to-height ratio of the frame (e.g. `1.5` for landscape, `0.75` for portrait). If neither `aspect` nor `height` is set, the frame uses the browser's default iframe height, which is usually too short — set one of them.

    aspect="1.33"

---

#### height
{: .attribute }

An explicit frame height in pixels, as an alternative to `aspect`.

    height="600"

---

#### width
{: .attribute }

An explicit frame width in pixels. Normally omitted — the frame fills the available width.

    width="800"

---

#### class
{: .attribute }

Size and position words like `medium right float` — see [Formatting Tips](entreluma-formatting-tips).

    class="medium right"

---

#### id
{: .attribute }

An identifier for the frame. The iframe viewer doesn't support [action links](entreluma-action-links), so an `id` is rarely needed, but it can be useful as a link target.

    id="bhl1"

---

## Example

<div class="example">

<div markdown="1">
{% raw %}
```liquid
{% include embed/iframe.html
    src="https://www.openstreetmap.org/export/embed.html?bbox=-110.3,36.9,-110.1,37.1&layer=mapnik"
    caption="An embedded external page"
    aspect="1.5"
%}
```
{: .nolineno }
{% endraw %}
</div>

<div>
{% include embed/iframe.html
    src="https://www.openstreetmap.org/export/embed.html?bbox=-110.3,36.9,-110.1,37.1&layer=mapnik"
    caption="An embedded external page"
    aspect="1.5"
%}
</div>

</div>

## Troubleshooting

**The frame is blank or shows a refusal message.**
Many sites block embedding (with the `X-Frame-Options` or `frame-ancestors` security headers). There's no way around this from Entreluma — check whether the site offers a dedicated "embed" URL (many viewers and exhibits do), or link to it normally instead.

**The frame is tiny or cut off.**
Set `aspect` (or `height`) explicitly. Without one, browsers give iframes a small default height.

**The page inside looks cramped.**
Try the site's mobile or embed-specific URL if it has one; full desktop pages often don't adapt well to a framed area.
