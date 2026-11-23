---
title: "Entreluma: Audio Viewer"
description: How to use the Entreluma audio viewer in your Markdown posts.
permalink: /admin/entreluma-audio-viewer
date: 2026-11-23
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
    pre .s2, pre .sx { white-space: pre-wrap; word-break: break-word; }
    .attribute > h2, .attribute > h3, .attribute > h4 {
        color: red;
        font-weight: bold;
    }
</style>

## Overview

The Entreluma Audio Viewer adds a compact player for an audio file — an oral-history interview, a reading, a piece of music — with an optional title and caption. It follows the site's light and dark modes, and, like the video viewers, it supports timed playback and action links, so the text of a story can play a particular passage.

The player handles any format the reader's browser can play. MP3 and M4A (AAC) work everywhere; Ogg and WAV work in most browsers.

## Attributes

### Required Attributes

#### src
{: .attribute }

The audio file. A plain filename is resolved against the post's `media_subpath`, exactly as images are; a full URL is used as is.

    src="interview.m4a"
    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Gymnopedie_No._1_%28ISRC_USUAN1100787%29.mp3"

### Optional Attributes

#### title
{: .attribute }

A short title shown above the controls. It also labels the player for screen readers.

    title="Interview with Mary Wynne"

---

#### caption
{: .attribute }

Text shown below the controls, typically a credit or licence. Markdown links and HTML are allowed.

    caption="Recorded 1978. Courtesy of the Kent Archives."

---

#### start
{: .attribute }

The initial playback position, expressed as seconds, `m:ss`, or `h:mm:ss`.

    start="1:30"

---

#### end
{: .attribute }

The position at which playback pauses. It uses the same formats as `start` and must be later than the start time.

    end="2:15"

---

#### autoplay
{: .attribute }

Starts playback when the page loads. Browsers usually block audio autoplay until the reader has interacted with the page, so use this sparingly.

    autoplay="true"

---

#### loop
{: .attribute }

Repeats the recording when it reaches the end.

    loop="true"

---

#### id
{: .attribute }

A unique viewer identifier, required when an action link targets the player.

    id="audio1"

---

#### class
{: .attribute }

Size and position words such as `medium right float`; see [Formatting Tips](entreluma-formatting-tips).

    class="medium right"

## Examples

### Basic Player

<div class="example">
<div markdown="1">
{% raw %}
```liquid
{% include embed/audio.html
    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Gymnopedie_No._1_%28ISRC_USUAN1100787%29.mp3"
    title="Gymnopédie No. 1 — Erik Satie"
    caption="Performed by Kevin MacLeod. [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), via Wikimedia Commons."
%}
```
{: .nolineno }
{% endraw %}
</div>
<div>
{% include embed/audio.html
    id="audio1"
    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Gymnopedie_No._1_%28ISRC_USUAN1100787%29.mp3"
    title="Gymnopédie No. 1 — Erik Satie"
    caption="Performed by Kevin MacLeod. [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), via Wikimedia Commons."
%}
</div>
</div>

### A Local File

Place the file alongside the post's other media and refer to it by name:

{% raw %}
```liquid
{% include embed/audio.html
    src="interview.m4a"
    title="Interview, 1978"
%}
```
{: .nolineno }
{% endraw %}

### Action Links

Give the player an `id`, then target it from ordinary Markdown text:

```markdown
[Hear the opening phrase](audio1/playat/0,0:20)
```
{: .nolineno }

Try it on the example above: [hear the opening phrase](audio1/playat/0,0:20), [continue from 1:00](audio1/play/1:00), or [pause](audio1/pause).

Unlike the video viewers, `playat` plays in place rather than opening an expanded dialog. The `play` action takes an optional start time; `pause` takes none. See the [Action Links reference](entreluma-action-links).

### In a Tab Group

Adjacent viewers are combined into a tab group, and the audio player's tab shows a headphones icon. This is a convenient way to pair a recording with a portrait or a transcript image.

<div class="example">
<div markdown="1">
{% raw %}
```liquid
{% include embed/image.html
    src="wc:Erik_Satie_by_Henri_Manuel.jpg"
%}
{% include embed/audio.html
    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Gymnopedie_No._1_%28ISRC_USUAN1100787%29.mp3"
    title="Gymnopédie No. 1 — Erik Satie"
%}
```
{: .nolineno }
{% endraw %}
</div>
<div>
{% include embed/image.html
    src="wc:Erik_Satie_by_Henri_Manuel.jpg"
%}
{% include embed/audio.html
    src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Gymnopedie_No._1_%28ISRC_USUAN1100787%29.mp3"
    title="Gymnopédie No. 1 — Erik Satie"
%}
</div>
</div>

## Troubleshooting

- **"Unable to load audio file."** Check the filename and `media_subpath`, and that the file is published with the site. A full URL must allow embedding by other sites.
- **Nothing plays in Safari.** Safari does not play Ogg; supply MP3 or M4A instead.
- **Autoplay doesn't start.** Browsers block autoplaying sound until the reader interacts with the page. This is expected.
- **Older posts using `{% raw %}{% include audio.html %}{% endraw %}`** continue to work; that tag is an alias for `embed/audio.html`.
