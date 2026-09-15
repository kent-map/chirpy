---
title: "Entreluma: Vimeo Viewer"
description: How to use the Entreluma Vimeo viewer in your Markdown posts.
permalink: /admin/entreluma-vimeo-viewer
date: 2026-09-14
toc: true
order: 25
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
    .example { display: grid; gap: 1rem; }
    @media (min-width: 640px) {
        .example { grid-template-columns: 1fr 1fr; }
    }
    iframe { width: 100%; }
    pre .s2, pre .sx { white-space: pre-wrap; word-break: break-word; }
    .attribute > h2, .attribute > h3, .attribute > h4 {
        color: red;
        font-weight: bold;
    }
</style>

## Overview

The Entreluma Vimeo Viewer adds a clean, responsive Vimeo preview to a post. Preview mode loads the video's poster and title through Vimeo's oEmbed service, but does not create a Vimeo player or begin playback. Clicking the preview opens the interactive player in Entreluma's expanded dialog.

Like the YouTube viewer, Vimeo supports timed playback and action links. This is useful when a story should direct readers to a particular passage rather than the beginning of a long video.

The viewer supports both public Vimeo videos and unlisted videos that have a privacy hash.

## Attributes

### Required Attributes

#### vid
{: .attribute }

The numeric Vimeo video ID.

    vid="19231868"

For `https://vimeo.com/19231868`, the ID is `19231868`.

### Optional Attributes

#### hash
{: .attribute }

The privacy hash required by an unlisted Vimeo video. For an unlisted URL such as `https://vimeo.com/123456789/abc123def4`, use:

    vid="123456789"
    hash="abc123def4"

The hash is part of the video's access URL, so do not use this viewer to publish a video that should remain inaccessible to readers of the page.

---

#### caption
{: .attribute }

Text displayed below the video. If omitted, the title is fetched from Vimeo.

    caption="Interview with the curator"

---

#### autoplay
{: .attribute }

Starts playback when the expanded viewer opens. Preview mode never autoplays.

    autoplay="true"

Browser autoplay policies can still prevent automatic playback in some circumstances.

---

#### start
{: .attribute }

The initial playback position, expressed as seconds, `m:ss`, or `h:mm:ss`.

    start="90"
    start="1:30"
    start="1:02:30"

---

#### end
{: .attribute }

The time at which the viewer pauses. It uses the same formats as `start` and must be later than the start time.

    end="2:15"

---

#### id
{: .attribute }

A unique viewer identifier, required when an action link targets the video.

    id="vimeo1"

---

#### aspect
{: .attribute }

The width-to-height ratio of the in-page preview. The default is `1.55`.

    aspect="1.78"

---

#### class
{: .attribute }

Size and position words such as `medium right float`; see [Formatting Tips](entreluma-formatting-tips).

    class="medium right"

## Examples

### Public Video

<div class="example">
<div markdown="1">
{% raw %}
```liquid
{% include embed/vimeo.html
    vid="19231868"
    caption="A Vimeo video"
%}
```
{: .nolineno }
{% endraw %}
</div>
<div>
{% include embed/vimeo.html
    vid="19231868"
    caption="A Vimeo video"
%}
</div>
</div>

### Unlisted Video

Use the video ID and privacy hash from the complete Vimeo share URL:

{% raw %}
```liquid
{% include embed/vimeo.html
    vid="123456789"
    hash="abc123def4"
    caption="An unlisted Vimeo video"
%}
```
{: .nolineno }
{% endraw %}

### Timed Playback

This opens at 1:30 and pauses at 2:15:

{% raw %}
```liquid
{% include embed/vimeo.html
    vid="19231868"
    autoplay="true"
    start="10"
    end="20"
%}
```
{: .nolineno }
{% endraw %}

### Action Link

First give the viewer an `id`:

{% raw %}
```liquid
{% include embed/vimeo.html
    id="vimeo1"
    vid="19231868"
%}
```
{: .nolineno }
{% endraw %}

Then target it from ordinary Markdown text:

```markdown
[Play the segment](vimeo1/playat/5,10)
```
{: .nolineno }

The `playat` action opens the expanded viewer, starts at 5 seconds, and pauses at 10 seconds. Vimeo also understands the `play` and `pause` actions described in the [Action Links reference](entreluma-action-links).

## Troubleshooting

- A Vimeo ID contains digits only. Do not paste the complete URL into `vid`.
- An unlisted video must include the `hash` from its full share URL.
- The video's owner must permit embedding. Domain-restricted videos work only on approved sites.
- Autoplay remains subject to browser policy even when `autoplay="true"` is present.
- Action links require an exact matching `id` on the viewer.
