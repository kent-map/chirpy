---
title: "Entreluma: Editor and Preview Setup"
description: Set up the Entreluma Editor for live preview, GitHub access, and one-click opening from GitHub.
permalink: /admin/entreluma-preview-setup
date: 2026-02-15
toc: true
order: 12
entreluma:
  mode: flat
  toolbar: false
---

The [Entreluma Editor](https://editor.entreluma.org) provides live publication-style preview, viewer-tag assistance, local media management, and optional GitHub synchronization. Drafts remain in your browser until you explicitly save them to GitHub or export them.

## Open or create a story

1. Open the [Entreluma Editor](https://editor.entreluma.org).
2. Choose **Open…** to paste a GitHub file URL, or choose **New Post** to start a new story.
3. Public GitHub files can be opened without signing in. Use the **GitHub** button when you need a private repository or want to commit changes.
4. Keep the Markdown editor and preview visible side by side. The preview updates from the current editing buffer; you do not need to commit before seeing changes.

You can also drag a GitHub file link into the editor's document list.

## Connect GitHub

1. Select **GitHub** above the document list.
2. Choose **Sign in with GitHub** and complete authorization.
3. Select a writable repository and branch.
4. Connect the open document to its repository path.
5. Use **Sync with GitHub** to commit or pull changes.

Signing in does not upload a draft. The editor asks for confirmation before saving to GitHub, and signing out leaves browser drafts intact.

## Install the optional bookmarklet

The GitHub panel contains an **Edit in Entreluma** bookmarklet. Drag it to your bookmarks bar. When viewing a Markdown file on GitHub, select the bookmarklet to open that file directly in Entreluma.

The bookmarklet is a shortcut only; **Open…** and drag-and-drop work without it.

## Understand the preview

The editor preview accurately covers the parts authors change most:

- Markdown text, headings, lists, links, footnotes, and formatting
- Front matter, title, description, and header image
- Entreluma image, comparison, map, YouTube, network, and iframe viewers
- Action links, display modes, and local story media

The published site remains authoritative for site-wide navigation, search, tag pages, related stories, deployment-only configuration, and unusual Markdown edge cases. Before publishing, commit the story and review the page produced by the normal GitHub Pages build.

## Protect your work

Browser drafts are local to the current browser profile. Commit important work to GitHub or export the story package regularly. If GitHub reports a conflict, compare the local and remote versions in the editor before choosing which one to keep.
