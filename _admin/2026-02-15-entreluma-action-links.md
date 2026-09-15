---
title: "Entreluma: Action Links"
description: The complete reference for action links — the Markdown links that let your text zoom images, fly maps, and play video segments.
permalink: /admin/entreluma-action-links
date: 2026-02-15
media_subpath: /assets/posts/entreluma
toc: true
order: 30
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
</style>

## What Is an Action Link?

An action link is a standard Markdown link whose URL, instead of pointing to a web page, tells a viewer on the same page to do something. To the reader it looks like any other link — but clicking it zooms an image, flies a map to a location, or plays a video segment.

This is the heart of Entreluma's interactive storytelling: your prose guides the reader visually. Instead of writing "see the butte in the upper right," you write a link that makes the image zoom to it.

## The Syntax

Action links always follow the same three-part format:

```
[link text]({viewer-id}/{action}/{arguments})
```

| Segment | Meaning |
|---|---|
| `viewer-id` | The `id` attribute of the viewer to control. **The viewer must declare this `id` in its include tag.** |
| `action` | What the viewer should do — each viewer type supports different actions (see below). |
| `arguments` | Action-specific details, such as a region, coordinates, or timestamps. |

For example, with an image viewer declared as:

{% raw %}
```liquid
{% include embed/image.html id="valley" src="wc:Monument_Valley,_Utah,_USA.jpg" %}
```
{: .nolineno }
{% endraw %}

this link zooms it to a region:

```markdown
[West Mitten Butte](valley/zoomto/pct:10.94,27.88,21.05,30)
```
{: .nolineno }

> **The `id` is not optional.** An action link can only find its viewer through the `id`. If the include tag has no `id`, or the `id` in the link doesn't match, clicking the link does nothing. This is the single most common reason an action link "doesn't work."
{: .prompt-warning }

## Actions by Viewer

### Image Viewer — `zoomto`

Zooms and pans the image to a region, and displays a label over it.

| Action | Arguments | Example |
|---|---|---|
| `zoomto` | An image region: `pct:x,y,w,h` (percentages) or `x,y,w,h` (pixels) | `[West Mitten](valley/zoomto/pct:10.94,27.88,21.05,30)` |

The link text is used as the region label by default. To show a different label, append an attribute block:

```markdown
[West](valley/zoomto/pct:10.94,27.88,21.05,30){: label="West Mitten Butte"}
```
{: .nolineno }

You normally don't work out region values by hand — the image viewer's selection tool generates them for you. See the [Image Viewer guide](entreluma-image-viewer) for details.

### Map Viewer — `flyto`

Animates the map to a new location and zoom level. Accepts either coordinates or a Wikidata ID:

| Action | Arguments | Example |
|---|---|---|
| `flyto` | `latitude,longitude,zoom` | `[Monument Valley](map1/flyto/37.02828,-110.23819,11)` |
| `flyto` | `wikidata-id,zoom` | `[Grand Canyon](map1/flyto/Q118841,12)` |

When you use a Wikidata ID (a `Q` number), the location is looked up automatically — handy when you don't know the coordinates.

Clicking the **same** fly-to link a second time returns the map to where it was before — readers can peek at a location and come right back.

### YouTube and Vimeo Viewers — `playat`, `play`, `pause`

| Action | Arguments | Example |
|---|---|---|
| `playat` | `start` or `start,end` — seconds or `h:mm:ss` | `[Watch the chorus](vid1/playat/42,1:15)` |
| `play` | optional `start` time | `[Resume the video](vid1/play)` |
| `pause` | none | `[Pause here](vid1/pause)` |

`playat` opens the expanded viewer and plays from `start`, stopping at `end` if given. Both video viewers use the same action syntax; see the [YouTube Viewer](entreluma-youtube-viewer) and [Vimeo Viewer](entreluma-vimeo-viewer) guides for details.

### Viewers Without Actions

The **Image Compare**, **Network**, and **Iframe** viewers do not currently support action links. If a story needs text-driven behavior, use one of the viewers above.

## Live Example

The image below has `id="demo"`. Try the links that follow it.

{% include embed/image.html
    id="demo"
    src="wc:Monument_Valley,_Utah,_USA.jpg"
    caption="Monument Valley, UT"
%}

Zoom to [Merrick Butte](demo/zoomto/pct:67.68,34.23,23.22,27), or to the [people in the foreground](demo/zoomto/pct:48.49,66.82,11.31,7.44){: label="Visitors"} for a sense of scale.

## Checklist When an Action Link Doesn't Work

1. Does the viewer's include tag have an `id` attribute?
2. Does the first segment of the link URL match that `id` exactly (case-sensitive)?
3. Is the action name one the target viewer supports (see tables above)?
4. Are the arguments in the right format — commas in the right places, no stray spaces?
5. Is the viewer on the same page as the link?

More help: [Troubleshooting Guide](entreluma-troubleshooting).
