---
title: "Entreluma: Authors Guide"
description: A practical guide for writing, previewing, and publishing Entreluma posts with the Entreluma Editor and GitHub. It explains front matter, media folders, asset references, preview, and publishing.
permalink: /admin/entreluma-authors-guide
date: 2026-02-15
toc: true
mermaid: true
order: 11
entreluma:
    mode: flat
    toolbar: false
---

# Entreluma Authoring Guide

*(Entreluma Editor + GitHub Workflow)*

This guide explains how to create, preview, and publish posts using the Entreluma Editor and GitHub.

## 1. Open the Entreluma Editor

Open the [Entreluma Editor](https://editor.entreluma.org) to create or open a post with a live publication-style preview. Select **Open…** to paste a GitHub file URL, or select **GitHub** to sign in and connect a writable repository.

The optional **Edit in Entreluma** bookmarklet is available in the GitHub panel. The [Editor and Preview Setup guide](entreluma-preview-setup) covers sign-in, repository connection, the bookmarklet, and safe handling of browser-local drafts.

---

## 2. Creating a New Post

*(Example: Monument Valley)*

Go to `_posts`.

Open `.template.md` and copy the contents.

Create a new file using a filename formatted `YYYY-MM-DD-<Post_Title>.md`, for example"

```
2026-01-10-monument-valley.md
```

Paste the template contents into the newly created file and edit the front matter.  When finished with updating the front matter, commit (save) the file.

---

## 3. Completing the Front Matter

Example based on the [Monument Valley post](https://rsnyder.github.io/entreluma/monument-valley/):

```yaml
---
title: Monument Valley
description: Interactive visual essay on Monument Valley.
authors:
  - Ron Snyder
date: 2026-01-10
categories: [examples]
tags: [Monument Valley]
published: false
media_subpath: /assets/posts/monument-valley
image:
  path: Monument_Valley.jpg
  alt: Monument Valley
---
```

#### Key Points

* `published: false` while drafting; change to `true` to publish
* `media_subpath` must exactly match the folder name created in the `/assets/posts` folder
* `image.path` uses filename only
* A single author can also be given as `author: Name`; use the `authors:` list form for one or more authors
* Entreluma is **on by default** — no front matter needed to use viewers or action links. Add `entreluma: false` to opt a post out, or a `entreluma:` settings block to fine-tune behavior (see the [Display Modes guide](entreluma-display-modes))

---

## 4. Images and Assets (Monument Valley Example)

This is an optional step to be performed in locally hosted content (generally images) will be used in the post.

### Step 1 — Create Folder

```
/assets/posts/monument-valley/
```

Upload any local images used in post:

```
Monument_Valley.jpg
```

### Step 2 — Match media_subpath

```yaml
media_subpath: /assets/posts/monument-valley
```

Exact spelling matters.

### Step 3 — Reference Only Filenames

When `media_subpath` is set in the post front matter only filenames are used in image and Entreluma tags.

#### Markdown image

```markdown
![Monument Valley](Monument_Valley.jpg)
```

Not:

```
/assets/posts/monument-valley/Monument_Valley.jpg
```

The system automatically resolves the full path.

If an image doesn’t load, check that the folder name matches `media_subpath` exactly.

---

## 5. Previewing in the Entreluma Editor

Open the post in the Entreluma Editor with **Open…**, by dragging its GitHub link into the document list, or with the optional **Edit in Entreluma** bookmarklet.

The right-hand preview updates from the current editing buffer. You can inspect prose, front matter, viewers, captions, and action links before committing. Use **Sync with GitHub** when you are ready to save the revision to the connected repository and branch.

---

## 6. The Fast Edit → Preview → Save Loop

1. Edit the Markdown.
2. Review the live preview.
3. Run **Audit** and resolve relevant findings.
4. Use **Sync with GitHub** or export a story package.

Browser drafts are local, so commit or export important work regularly.

---

## 7. Entreluma Features

A basic post is created using plain text and standard Markdown tags. For general Markdown and theme formatting topics, see the [official Chirpy documentation](https://chirpy.cotes.page/).

Using the Entreluma extensions interactive images, maps, videos and more can easily be added to a post using simple tags.  More information on the Entreluma extensions can be found in the following guides.

- [Entreluma Overview](entreluma-overview)
- [Viewers Overview](entreluma-viewers-overview) — all viewers at a glance
- [Image Viewer](entreluma-image-viewer)
- [Map Viewer](entreluma-map-viewer)
- [Image Compare Viewer](entreluma-image-compare-viewer)
- [YouTube Viewer](entreluma-youtube-viewer)
- [Vimeo Viewer](entreluma-vimeo-viewer)
- [Network Viewer](entreluma-vis-network-viewer)
- [Iframe Viewer](entreluma-iframe-viewer)
- [Entity Info Popups](entreluma-entity-info-popups)
- [Action Links](entreluma-action-links) — making text control the viewers
- [Display Modes](entreluma-display-modes) — flat vs. two-column layout

---

## 8. Publishing

When satisfied:

Change:

```yaml
published: true
```

Commit.

The public site updates after GitHub completes its normal rebuild (typically in 1-5 minutes).

---

## 9. Troubleshooting

**Preview outdated?**
Use **Refresh publication preview** and confirm the document is connected to the intended repository and branch.

**GitHub access unavailable?**
Open the GitHub panel, verify that you are signed in, and confirm that the selected account can write to the repository.

**Images not showing?**
Check:

* `media_subpath`
* Folder name
* Exact filename match

**Embed shows placeholder?**
Confirm required `_includes/embed/` files exist.

---

## Final Author Checklist

* Correct filename format
* Front matter complete
* `media_subpath` matches folder exactly
* Images uploaded
* Only filenames used
* Every viewer that action links target has an `id`
* `published: true` when ready

More help: [Troubleshooting Guide](entreluma-troubleshooting).
