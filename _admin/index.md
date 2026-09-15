---
layout: admin
title: Admin
permalink: /admin/
toc: true
order: 0
---

# Entreluma Author Documentation

This is the documentation home for authors writing content on this site. It covers everything you need to create posts — from plain Markdown articles to interactive visual essays with zoomable images, maps, video, and text-driven interactions.

**New here?** Start with the **[Authors Guide](entreluma-authors-guide)** — it walks you through creating, previewing, and publishing your first post entirely from GitHub's web interface. If you are brand new to GitHub and Markdown as well, the **[Authoring a Visual Narrative](entreluma-authoring-a-visual-narrative)** tutorial assumes no prior experience at all and takes you from creating a GitHub account to publishing a first essay.

## Finding Your Way

The guides are organized in the order most authors need them:

### Getting Started

| Guide | What it covers |
|---|---|
{% for guide in site.data.entreluma_admin_guides %}
| [{{ guide.title }}]({{ guide.url }}) | {{ guide.description }} |
{% endfor %}
| [Authoring a Visual Narrative](entreluma-authoring-a-visual-narrative) | A start-to-finish tutorial for first-time authors — no GitHub, Jekyll, or Markdown experience assumed |
| [Entreluma Overview](entreluma-overview) | What Entreluma is, what it adds, and how it is enabled |
| [Authors Guide](entreluma-authors-guide) | Creating, previewing, and publishing a post step by step |
| [Preview Setup](entreluma-preview-setup) | Editor setup, GitHub connection, bookmarklet, and preview boundaries |
| [Formatting Tips](entreluma-formatting-tips) | Controlling viewer size, position, and text wrapping |

### Tools

The **[Entreluma Editor](https://editor.entreluma.org)** is a browser-based Markdown editor for Entreluma posts: live preview, viewer-tag autocomplete, drag-and-drop media, and GitHub sync. One central editor serves every Entreluma repository; sign in with GitHub when you need private-repository access or want to commit changes.

### Viewers

Viewers are the interactive elements you add to a post with a simple include tag. The **[Viewers Overview](entreluma-viewers-overview)** lists them all at a glance; each then has its own reference page:

| Guide | Viewer |
|---|---|
| [Image Viewer](entreluma-image-viewer) | Zoomable, pannable high-resolution images (incl. Wikimedia Commons and IIIF) |
| [Map Viewer](entreluma-map-viewer) | Interactive maps with markers, overlays, and fly-to actions |
| [Image Compare Viewer](entreluma-image-compare-viewer) | Before/after image slider with alignment tools |
| [YouTube Viewer](entreluma-youtube-viewer) | Clean video previews with timed playback actions |
| [Vimeo Viewer](entreluma-vimeo-viewer) | Vimeo poster previews, expanded playback, and timed playback actions |
| [Network Viewer](entreluma-vis-network-viewer) | Node-and-edge relationship diagrams from simple CSV data |
| [Iframe Viewer](entreluma-iframe-viewer) | Embed any external web page or widget |
| [Entity Info Popups](entreluma-entity-info-popups) | Contextual popups powered by Wikidata |

### Interaction and Layout

| Guide | What it covers |
|---|---|
| [Action Links](entreluma-action-links) | The complete reference for making text trigger viewer actions |
| [Display Modes](entreluma-display-modes) | Flat pages vs. the two-column scrollytelling layout |

### When Something Goes Wrong

The **[Troubleshooting Guide](entreluma-troubleshooting)** covers the most common problems — a viewer that shows nothing, an action link that does nothing, images that don't update — and how to fix them.

## Who This Is For

Most content authors do **not** need to understand HTML, CSS, or JavaScript.

If you are comfortable writing basic Markdown and copying small snippets of example code, you have all the technical background required. The examples in these guides are meant to be copied directly into your own posts and adapted.

## How to Use This Documentation

1. Read the [Authors Guide](entreluma-authors-guide) and set up the [Entreluma Editor](entreluma-preview-setup).
2. Browse the viewer guides and copy the examples that fit your story.
3. Modify the parameters (image paths, captions, IDs, etc.) to fit your content.
4. If something doesn't work, check the [Troubleshooting Guide](entreluma-troubleshooting).

## About the Underlying Theme

This site is built on the [Chirpy Jekyll theme](https://github.com/cotes2020/jekyll-theme-chirpy). Chirpy provides the publishing engine — layouts, navigation, typography, tags, and categories — and Entreluma adds the interactive storytelling layer on top. For theme-level topics not covered here (site configuration, favicons, advanced typography), see the [official Chirpy documentation](https://chirpy.cotes.page/).

---

# All Guides
