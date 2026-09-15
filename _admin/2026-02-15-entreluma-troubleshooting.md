---
title: "Entreluma: Troubleshooting"
description: Fixes for the most common problems authors hit — blank viewers, action links that do nothing, images that won't update, and popups that never load.
permalink: /admin/entreluma-troubleshooting
date: 2026-02-15
toc: true
order: 40
entreluma:
    mode: flat
    toolbar: false
---

This guide covers the problems authors actually run into, roughly in order of how often they happen. Each section describes the symptom, the likely causes, and how to fix them.

## An Action Link Does Nothing

**Symptom:** You click a link like `[West Butte](img1/zoomto/pct:10,20,30,40)` and nothing happens.

This is the most common Entreluma problem, and it is almost always an `id` mismatch:

1. **The viewer has no `id`.** Action links find their viewer through the `id` attribute in the include tag. Check that the tag includes one:

   {% raw %}
   ```liquid
   {% include embed/image.html id="img1" src="..." %}
   ```
   {: .nolineno }
   {% endraw %}

2. **The link's first segment doesn't match the `id`.** The match is exact and case-sensitive: a link starting `img1/` will not find a viewer with `id="Img1"` or `id="image1"`.

3. **The action name is wrong for that viewer.** Each viewer supports specific actions — `zoomto` is an image action, `flyto` is a map action, and `playat` is a YouTube or Vimeo action. See the [Action Links reference](entreluma-action-links) for the full table.

4. **The arguments are malformed.** Check for missing commas, extra spaces, or a missing `pct:` prefix where percentages were intended.

## A Viewer Shows Nothing (Blank or Placeholder)

**Symptom:** Where the viewer should be, there's an empty box, a broken layout, or nothing at all.

- **Check the include path.** The tag must name a real include file: `embed/image.html`, `embed/map.html`, `embed/image-compare.html`, `embed/youtube.html`, `embed/vimeo.html`, `embed/vis-network.html`, or `embed/iframe.html`. A typo here (e.g. `embed/img.html`) renders nothing.
- **Check required attributes.** Every viewer has one or two attributes it cannot work without — `src`, `iiif`, or `manifest` for images; `center` for maps; `before`/`after` for image compare; and `vid` for YouTube or Vimeo. The viewer's reference page lists them.
- **Check the file path or URL.** If `src` points at a local image, the file must actually exist at that path (see the next section for `media_subpath` pitfalls). If it's a remote URL, open it directly in a browser tab to confirm it loads.
- **Check the Liquid syntax.** A missing `%}` or a smart-quote (`”`) pasted from a word processor instead of a straight quote (`"`) will break the tag. Retype the quotes if you pasted the tag from anywhere.

## Images Don't Load (But the Viewer Appears)

**Symptom:** The viewer frame renders but the image inside is missing or broken.

Nearly always a path problem:

- **`media_subpath` must exactly match the asset folder.** If your front matter says `media_subpath: /assets/posts/monument-valley`, the folder must be exactly `/assets/posts/monument-valley/` — same spelling, same case.
- **Use only the filename when `media_subpath` is set.** Write `src="Monument_Valley.jpg"`, not the full path — the system joins them for you. A full path on top of `media_subpath` produces a doubled, broken URL.
- **Wikimedia Commons shorthand needs the exact file name.** `wc:File_Name.jpg` must match the name on Commons, including underscores and capitalization. Open the Commons page and copy the name directly.

## My Change Doesn't Show Up on the Site

**Symptom:** You committed an edit but the published page looks the same.

- **The site rebuild takes 1–5 minutes.** After committing, GitHub Pages must rebuild before changes go live. Check your repository's *Actions* tab to watch the build.
- **Your browser cached the old page.** Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R).
- **The build failed.** If the Actions tab shows a red ✗, the build hit an error (often a Liquid syntax problem in the newest edit) and the site was never updated. Open the failed run to see the message.
- **`published: false` is still set.** Drafts don't appear on the live site until you change it to `true`.

## The Editor Preview Shows Something Different from the Live Site

**Symptom:** The post looks right in the live preview but different after publishing (or vice versa).

The Entreluma Editor renders a publication-style preview, so small differences remain possible in unusual Markdown constructs and site-wide theme features. The published site is always authoritative. If a discrepancy matters, commit and check the deployed page before investigating further. See [Editor and Preview Setup](entreluma-preview-setup) for preview boundaries.

Use **Refresh publication preview** if repository context or published runtime assets have changed. Ordinary text and viewer edits update from the current editor buffer without a commit.

## An Entity Popup Never Loads

**Symptom:** Clicking a `[name](Q12345)` link shows an empty or stuck popup.

- **Wikidata may be slow or briefly unavailable.** The popup data is fetched live from Wikidata when clicked. Try again in a moment.
- **Check the Q number.** Open `https://www.wikidata.org/wiki/Q12345` in a browser to confirm it's the entity you meant. A typo produces an empty or wrong popup.
- **Sparse entries produce sparse popups.** The popup can only show what Wikidata has — obscure entities may have little more than a label.

## Two-Column Mode Looks Wrong

**Symptom:** The right-hand viewer panel is empty, shows the wrong viewer, or the layout breaks.

- **Viewer order drives the pairing.** The right panel shows the most recent viewer declared *before* the text currently in view. If the wrong viewer appears, check the order of paragraphs and includes in your Markdown — see [Display Modes](entreluma-display-modes).
- **On phones, two-column mode is disabled by design.** Small screens always show the flat layout; that's expected behavior, not a bug.
- **Toggling modes acts oddly?** Reload the page in the mode you want to check. If you can reproduce a problem after a fresh reload, report it.

## Adjacent Viewers Merged into Tabs Unexpectedly

**Symptom:** Two viewers you placed one after another appear as a single tabbed component.

That's the `group_embeds` feature, which combines directly adjacent viewers into tabs. If you want them stacked separately, either separate them with a paragraph of text, or turn the feature off for the post:

```yaml
entreluma:
    group_embeds: false
```

## Still Stuck?

1. Compare your tag against the worked example in the viewer's reference page — the examples are tested and copy-pasteable.
2. Simplify: reduce the tag to only its required attributes, confirm that works, then add attributes back one at a time.
3. Look at a working post in this site's `_posts` folder (e.g. the Monument Valley example) and compare.
