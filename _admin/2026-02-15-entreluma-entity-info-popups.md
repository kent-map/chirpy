---
title: "Entreluma: Entity Info Popups"
description: How to create rich information popups using Wikidata entities in Entreluma.
date: 2026-02-15
toc: true
permalink: /admin/entreluma-entity-info-popups
order: 27
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
    .attribute {
        color: red;
        font-weight: bold;
    }
</style>

Entreluma adds support for **Entity Info Popups** — lightweight, contextual information panels that appear when a reader clicks a linked term in your text.

They allow you to reference people, places, organizations, works, and concepts without interrupting the flow of your writing. Instead of sending readers off-site, the relevant details appear instantly in a clean, structured popup.

---

## What Are Entity Info Popups?

An Entity Info Popup is a small, on-demand information panel generated from a **Wikidata entity**.

For example, instead of linking directly to Wikipedia, you can reference a person or place using its Wikidata identifier (a `Q` number). Entreluma then:

* Retrieves the entity's name and description from Wikidata
* Displays a concise summary drawn from Wikipedia
* Shows an image (if available)
* Provides a link to the full Wikipedia article

The result is a richer reading experience with minimal effort from the author.

> Entity popups are especially useful for educational, historical, or research-oriented writing where contextual clarity matters.
> {: .prompt-info }

---

## Where the Data Comes From

Entity popups rely on **Wikidata**.

### What Is Wikidata?

[Wikidata](https://www.wikidata.org/) is a free, collaboratively edited knowledge base maintained by the Wikimedia Foundation. It underpins Wikipedia and many other structured data services.

Each entity in Wikidata has:

* A unique identifier (e.g., `Q42`)
* A canonical label
* Structured properties (birth date, occupation, location, etc.)
* Links to Wikipedia and other knowledge sources
* Often an associated image from Wikimedia Commons

Unlike Wikipedia (which is primarily narrative text), Wikidata is structured and machine-readable. That makes it ideal for dynamic components like Entreluma popups.

---

## How to Create an Entity Popup

Creating an entity popup is simple:

1. Identify the Wikidata ID (`Q` number) for the entity.
2. Link text in your Markdown to that ID using Entreluma entity syntax.

### Step 1: Find the Wikidata ID

* Search for the subject on Wikipedia.
* Click the “Wikidata item” link in the sidebar.
* Copy the `Q` identifier from the URL (e.g., `Q937`).

### Step 2: Link the Text

Use the Entreluma entity reference format in your Markdown:

```markdown
[Charles Darwin](Q1035)
```

When rendered, clicking the name will open the popup.

That’s it. No additional configuration required.

#### Example

<div class="example">

<div markdown="1">
{% raw %}
```markdown
[Charles Darwin](Q1035)
```
{: .nolineno }
{% endraw %}
</div>

<div markdown="1">
The work of [Charles Darwin](Q1035) continues to influence modern biology, from genetics to ecology. Although controversial in his time, his ideas are now foundational to the life sciences.
</div>

</div>

---

## What Appears in the Popup?

Depending on what Wikidata and Wikipedia contain, the popup may include:

* Title / canonical name
* Short description
* A summary paragraph from Wikipedia
* Thumbnail image
* Link to the full Wikipedia article

Because the data is structured, Entreluma can present it consistently across different types of entities.

> The quality of the popup depends on the completeness of the Wikidata entry. Well-documented subjects produce better popups.
> {: .prompt-tip }

---

## Why Use Entity Popups Instead of Normal Links?

Traditional links:

* Interrupt reading flow
* Send users away from your site
* Require multiple tabs for context

Entity popups:

* Preserve reading flow
* Provide just enough context
* Reduce unnecessary navigation
* Encourage exploratory reading

They are particularly effective in:

* Historical essays
* Biographical writing
* Digital humanities content
* Art history discussions
* Geographically rich narratives

---

## How This Fits with Chirpy and Jekyll

Chirpy already supports rich formatting, attribute blocks, and structured content (see the [official Chirpy documentation](https://chirpy.cotes.page/)).

Entreluma builds on that foundation by introducing semantic linking through Wikidata entities. Instead of simply formatting text, you are adding structured meaning.

From an author’s perspective:

* You continue writing standard Markdown.
* You add entity links where helpful.
* Entreluma handles the data retrieval and display.

No JavaScript knowledge or API work is required.

---

## Best Practices

**Use popups selectively.**
Too many can make a page visually noisy.

**Link the first meaningful occurrence.**
Avoid repeating the same entity multiple times on a page.

**Prefer canonical subjects.**
Well-known entities tend to have better Wikidata records.

**Verify the Q ID.**
Some names are ambiguous. Make sure the ID matches the intended subject.

---

## Summary

Entreluma Entity Info Popups:

* Turn plain text references into structured, interactive knowledge
* Pull live data from Wikidata
* Improve clarity without disrupting reading
* Require only a simple entity link in Markdown

They are a small addition from an authoring standpoint, but they significantly elevate the reader experience.

