---
title: Adding Zoomable Images with Juncture
description: How to use the Juncture image viewer in your Markdown posts.
permalink: /docs/juncture-image-viewer
date: 2019-08-08
order: 4
juncture:
    mode: 2col
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
    pre .s2 {
        white-space: pre-wrap;
        word-break: break-word;
    }
</style>

Juncture lets you add **zoomable, interactive images** to your Markdown posts using a simple include. You do not need to write HTML, CSS, or JavaScript.

---

# The Simplest Example

This creates an image that when clicked will open a dialog with an image at full resolution with zoom and pan features enabled.

<div class="example">

<div markdown="1">
{% raw %}
```liquid
{% include embed/image.html
    src="wc:Monument_Valley,_Utah,_USA.jpg"
%}
```
{% endraw %}

Click on the image to open the dialog.

</div>

<div>
{% include embed/image.html
    src="wc:Monument_Valley,_Utah,_USA.jpg"
%}
</div>

</div>

---

# When Do You Need an `id`?

You only need to provide an `id` if you plan to create **interactive links** in your text that control the image (for example, zooming to a specific region).

If you are not using interactive links, you can safely omit `id`.

---

# Example with an `id`

<div class="example">
<div markdown="1">
{% raw %}
```liquid
{% include embed/image.html
    id="image"
    src="wc:Monument_Valley,_Utah,_USA.jpg"
%}
```
{% endraw %}

When an image includes an `id` attribute it may be referenced in an action link.  An action link is a standard Markdown link where the URL is formatted with information needed trigger an action on the referenced item when clicked.  In tbe example below that `zoomto` action is triggered on the image with the `image` id.

```markdown
[zoomto example](image/zoomto/pct:45.45,39.44,13.25,18.56)
```

[zoomto example](image/zoomto/pct:45.45,39.44,13.25,18.56)

</div>

<div>
{% include embed/image.html
    id="image"
    src="wc:Monument_Valley,_Utah,_USA.jpg"
    caption="Monument Valley, UT"
%}
</div>
</div>

---

# Required Setting

You must provide one of the following:

## `src`

The image source.

You can use:

**A local image**

    src="/assets/posts/my-post/photo.jpg"

**A full web URL**

    src="https://example.org/image.jpg"

**A Wikimedia shortcut**

    src="wc:File_Name.jpg"

---

# Optional Settings

These improve presentation but are not required.

---

## `caption`

Text displayed below the image.

    caption="Monument Valley, UT"

Keep captions short and descriptive.

---

## `cover="true"`

Makes the image fill its space more dramatically, similar to a cover photo.

    cover="true"

This works well for wide landscape images.

---

## `aspect`

Controls the image shape.

    aspect="1200/630"

You usually don’t need to change this unless you want a taller or more square presentation.

---

## `region`

Starts the viewer zoomed into a specific area.

    region="pct:10,20,30,40"

Most users won’t type this manually. You can use the viewer’s selection tool to generate region values.

---

## `rotate`

Rotates the image.

    rotate="90"

---

# Linking to a Specific Part of an Image

To create interactive zoom links, your image must have an `id`.

Example image:

    {% include embed/image.html
      id="valley"
      src="/assets/posts/monument-valley/Monument_Valley.jpg"
      caption="Monument Valley"
    %}

Then in your text:

    Notice the dramatic formations like 
    [West Mitten Butte](image/zoomto/pct:10,20,30,40).

When a reader clicks that link:

- The image zooms to that region  
- The selected area is highlighted  

This allows you to guide the reader’s attention while telling a visual story.

---

# Complete Example

    {% include embed/image.html
      id="valley"
      src="/assets/posts/monument-valley/Monument_Valley.jpg"
      caption="Monument Valley"
      cover="true"
    %}

If you are not using zoom links, you can remove the `id` entirely.

---

# Tips for Visual Essays

- Use zoomable images when detail matters.
- Place images near the text that discusses them.
- Add an `id` only when you plan to use interactive links.
- Use zoom links sparingly to guide attention.
- Keep captions concise.

---

# When to Use This Viewer

Use the Juncture image viewer when:

- The image contains fine detail  
- You want readers to explore  
- You want to direct attention to specific areas  
- You’re creating an interactive visual essay  

For simple decorative images, a standard Markdown image may be sufficient.
