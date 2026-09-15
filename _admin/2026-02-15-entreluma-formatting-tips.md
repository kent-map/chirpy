---
title: "Entreluma: Formatting Tips"
description: Tips for formatting Entreluma posts.
permalink: /admin/entreluma-formatting-tips
date: 2026-02-22
media_subpath: /assets/posts/entreluma
toc: true
order: 13
entreluma:
    mode: flat
    toolbar: false
---

# Controlling How Viewers Appear in Your Post

*Viewers* are the interactive elements in your post — images, maps, and similar media that you add using the `{% raw %}{% include ... %}{% endraw %}` tags in your text.

Entreluma handles their size and placement automatically by default, but you have full control when you need it.

---

## How It Works By Default (Auto-Float)

Out of the box, Entreluma uses a feature called **auto-float**. Here's what it does:

- When a viewer follows a paragraph of text, Entreluma automatically places the viewer **to the right** of that paragraph at **half the screen width**
- The paragraph text **wraps around** the viewer, magazine-style
- This only happens on screens wide enough to make it look good

This requires no extra work from you — it just happens.

---

## Turning Off Auto Float

If you'd rather have your viewers stack naturally below your text (full-width, one after another), you can turn off auto-float for a specific post by adding these lines to the top of your post file (the "front matter"):

```yaml
entreluma:
  auto_float: false
```

---

## Manually Setting Size and Position

Once auto-float is off, you can control exactly how each viewer looks by adding a `class` to its `{% raw %}{% include %}{% endraw %}` tag. You can combine a **size word** and a **position word**.

### Size options

| Word | Width |
|------|-------|
| `small` | ⅓ of the screen |
| `medium` | ½ of the screen |
| `large` | ¾ of the screen |
| `full` | Full width *(default)* |

### Position options

| Word | Placement |
|------|-----------|
| `left` | Aligned to the left edge |
| `right` | Aligned to the right edge |
| `center` | Centered on the page *(default)* |

**Example** — a medium-sized viewer aligned to the right:

<div markdown="1">
{% raw %}
```liquid
{% include embed/map.html center="37.01056, -110.2425" class="medium right" %}
```
{: .nolineno }
{% endraw %}
</div>

---

## Making Text Wrap Around a Viewer (Manual Float)

If you want text to flow *around* a viewer — similar to auto float but under your control — add the word `float` to the class. The key difference from auto-float is **where you put the viewer tag**:

> ⚠️ With manual float, the `{% raw %}{% include %}{% endraw %}` tag must come **before** the text you want to wrap around it. With auto-float, it comes after.

By default, `float` pins the viewer to the **right**. Add `left` to pin it to the left instead:

<div markdown="1">
{% raw %}
```liquid
{% include embed/image.html src="photo.jpg" class="float" %}        ← right side (default)
{% include embed/image.html src="photo.jpg" class="float left" %}   ← left side
```
{: .nolineno }
{% endraw %}
</div>

All text and content that follows the viewer tag will wrap around it.

---

## Resetting the Float (Clearing the Column)

If you add multiple `float` viewers in a row, they'll stack up in the same column. To **start fresh** and clear the float at any point, add a horizontal rule on its own line:

<div markdown="1">
```
---
```
</div>

This resets the layout so that content below the rule goes back to normal full-width flow.

---

## Quick Reference

| Goal | What to do |
|------|------------|
| Automatic side-by-side layout | Do nothing — auto-float handles it |
| Full-width stacked layout | Add `auto_float: false` to front matter |
| Control a viewer's size | Add `small`, `medium`, `large`, or `full` to `class` |
| Control a viewer's position | Add `left`, `right`, or `center` to `class` |
| Wrap text around a viewer | Add `float` (and optionally `left`) to `class`; place tag *before* the text |
| Stop text from wrapping | Add a line with only `---` |
