---
title: "Entreluma: Display Modes"
description: How Entreluma posts can be presented — as a traditional flat page or as a two-column scrollytelling layout — and how to choose and configure each mode.
permalink: /admin/entreluma-display-modes
date: 2026-02-15
toc: true
order: 31
entreluma:
    mode: flat
    toolbar: false
---

Entreluma posts can be presented in two ways. The same Markdown works in both — the mode only changes how text and viewers are arranged on screen.

## Flat Mode (Default)

In **flat mode** the post behaves like a traditional web page. Text and viewers appear in the order you wrote them, top to bottom. Viewers can float beside paragraphs with text wrapping around them (see [Formatting Tips](entreluma-formatting-tips)).

Flat mode is the right choice for most posts: articles, documentation, tutorials, and essays where the reader simply scrolls through.

## Two-Column Mode (Scrollytelling)

In **two-column mode** the page splits: your narrative text scrolls in the left column while the right column holds a fixed viewer panel that stays in place as the reader scrolls.

As the reader scrolls through your text, Entreluma watches which paragraph is currently in view and shows the **most recent viewer you declared before that paragraph** in the right panel. In practice this means:

1. Write a paragraph or two of narrative.
2. Add the viewer that belongs with that part of the story.
3. Continue with the next stretch of narrative, then the next viewer, and so on.

Each viewer "takes over" the right panel when the reader reaches the text that follows it, and stays there until the next viewer's text arrives. Action links work normally in either mode, so text in the left column can zoom, fly, or play the viewer currently on the right.

On phones and other small screens, two-column mode automatically falls back to flat mode — there isn't room for two columns.

## Choosing the Mode

### For a Single Post

Set the mode in the post's front matter:

```yaml
entreluma:
    mode: 2col      # two-column scrollytelling
```

or

```yaml
entreluma:
    mode: flat      # traditional page (the default)
```

### For the Whole Site

The site-wide default lives in `_config.yml` under the `entreluma:` block. Individual posts can always override it in their front matter.

## The Reader's Toggle Button

By default, readers get a small toggle button in the post toolbar that lets them switch between flat and two-column view themselves. Their choice is remembered by the browser for the next post they read — though a mode set explicitly in a post's front matter takes precedence.

To hide the toggle for a post (for example, when the layout only works well one way):

```yaml
entreluma:
    mode_toggle: false
```

## Related Settings

These live under the same `entreluma:` front-matter block (post) or `_config.yml` block (site-wide). All default to `true`:

| Setting | What it controls |
|---|---|
| `mode` | `flat` or `2col` — the initial display mode |
| `mode_toggle` | Show the flat/two-column toggle button to readers |
| `auto_float` | In flat mode, automatically float a viewer beside the paragraph it follows |
| `group_embeds` | Combine viewers placed directly next to each other into a tabbed group |
| `wikidata_info_popups` | Enable [entity info popups](entreluma-entity-info-popups) for `Q`-number links |
| `toolbar` | Show the post toolbar (mode toggle, cite, PDF buttons) |
| `cite` | Show the "cite this" button in the toolbar |
| `pdf` | Show the PDF download button in the toolbar |

Example — a post locked to two-column mode with no toolbar:

```yaml
entreluma:
    mode: 2col
    toolbar: false
```

## Tips for Two-Column Stories

- **Declare each viewer immediately after the paragraph that introduces it.** The pairing between text and viewer comes from their order in the Markdown.
- **Give every viewer an `id`** so your narrative can drive it with [action links](entreluma-action-links) while it's on screen.
- **Preview in both modes** (use the toggle button) before publishing — a layout that works beautifully in two columns can feel sparse in flat mode, and vice versa.
- **Check on a phone.** Small screens always get the flat layout, so make sure the reading order works there too.
