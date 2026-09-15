---
title: "Entreluma: Network Viewer"
description: How to use the Entreluma network viewer to draw node-and-edge relationship diagrams from simple CSV data in your Markdown posts.
permalink: /admin/entreluma-vis-network-viewer
date: 2026-02-15
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
    .attribute > h2,
    .attribute > h3,
    .attribute > h4 {
        color: red;
        font-weight: bold;
    }
</style>

## Overview

The Entreluma Network Viewer draws an interactive node-and-edge diagram — the kind of picture you'd use to show relationships: people connected to places, plants to the countries that use them, concepts to related concepts.

You provide the relationships as a few lines of simple comma-separated data placed right in your post. The viewer lays the diagram out automatically; readers can drag nodes around and click the diagram to open a larger version.

Use it for:

- Family, social, or influence networks
- A subject's connections to places, names, or uses
- Any "this relates to that" structure that's clearer as a picture than as prose

## How It Works

The network viewer has two parts that work together in your Markdown:

1. **A data block** — a paragraph of CSV lines describing the nodes and edges, tagged with a special ID so Entreluma can find it (and hide it from readers).
2. **The include tag** — declares the viewer and connects it to the data block by ID.

The connection is a naming convention: if the viewer has `id="my_network"`, its data block must be tagged `{: #my_network-csv }` — the viewer's ID plus `-csv`.

## The Data Format

Each line of the data block is either a node or an edge:

```
node,<node-id>,<label>
edge,<from-node-id>,<to-node-id>,<label>
```

| Line type | Fields | Meaning |
|---|---|---|
| `node` | id, label | A circle in the diagram. The `id` is how edges refer to it; the `label` is the text shown. |
| `edge` | from, to, label | A line connecting two nodes, with optional text along it. |

Node IDs can be numbers or short codes — they just need to be consistent between the `node` lines and the `edge` lines that reference them.

## A Complete Example

This describes a tiny network of a plant and two countries that use it:

{% raw %}
```markdown
node,1,Tamarind
node,2,India
node,3,Mexico
edge,1,2,used in cuisine
edge,1,3,used in aguas frescas
{: #plant_network-csv }

{% include embed/vis-network.html id="plant_network" caption="Tamarind connections" %}
```
{: .nolineno }
{% endraw %}

And here is that example rendered:

<div markdown="1">
node,1,Tamarind
node,2,India
node,3,Mexico
edge,1,2,used in cuisine
edge,1,3,used in aguas frescas
{: #plant_network-csv }
</div>

{% include embed/vis-network.html id="plant_network" caption="Tamarind connections" %}

The data paragraph is invisible on the published page — Entreluma hides any element whose ID ends in `-csv`. Readers only see the diagram. Click the diagram to open the expanded version.

> The `{: #plant_network-csv }` line is a kramdown *attribute block* — it attaches the ID to the paragraph of CSV lines directly above it. It must come immediately after the last CSV line, with no blank line between.
{: .prompt-info }

## Attributes

### Required Attributes

#### id
{: .attribute }

The viewer's identifier. Also determines which data block is used: the viewer looks for an element with the ID `<id>-csv`.

    id="plant_network"

---

### Optional Attributes

#### caption
{: .attribute }

Text displayed below the diagram.

    caption="Tamarind connections"

---

#### dataid
{: .attribute }

Points the viewer at a data block with a different ID, instead of the default `<id>-csv` convention. Useful if several viewers share one data block.

    dataid="shared_data-csv"

---

#### aspect
{: .attribute }

The width-to-height ratio of the viewer. Defaults to `1.0` (square).

    aspect="1.5"

---

#### class
{: .attribute }

Size and position words like `medium right float` — see [Formatting Tips](entreluma-formatting-tips).

    class="medium right"

---

## Troubleshooting

**The diagram is empty.**
The viewer couldn't find its data. Check that the data block's attribute tag is exactly the viewer's `id` plus `-csv` (e.g. `id="plant_network"` → `{: #plant_network-csv }`), and that the tag sits immediately after the last CSV line with no blank line in between.

**Some nodes or edges are missing.**
Check that every `edge` line refers to node IDs that exist in `node` lines, and that each line starts with exactly `node,` or `edge,` (lowercase, no leading spaces).

**The raw CSV text shows on the page.**
The attribute block didn't attach — usually a blank line crept in between the CSV lines and the `{: #...-csv }` tag, or the `#` is missing.
