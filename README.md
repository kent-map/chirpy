# Chirpy Juncture Starter

This repository powers a Jekyll site built on the **[Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy)** theme, extended with a set of Juncture components for creating rich, interactive content.

At its core, this is a standard Chirpy-based site. If you are already familiar with Chirpy, most of the structure will look familiar. What makes this repository different is the addition of reusable viewer components and supporting scripts that allow content authors to build more visual, interactive essays without writing custom HTML or JavaScript.

---

## What This Repository Contains

### 1. The Chirpy Foundation

The site follows the normal Chirpy conventions for:

* Posts in `_posts`
* Configuration in `_config.yml`
* Data files in `_data`
* Static assets in `assets/`

If you are new to Chirpy, review:

* **Getting Started** 
* **Writing a New Post** 
* **Text and Typography** 

Those documents describe the baseline structure and expectations for posts.

---

### 2. Juncture Extensions

On top of Chirpy, this repository adds:

* Single-page iframe viewer components (image viewers, comparisons, etc.)
* Liquid include wrappers that simplify usage
* Supporting JavaScript for:

  * DOM restructuring where needed
  * Communication between the parent page and iframe components
  * Action links that trigger component behavior

The design goal is separation of concerns:

* Content authors work in Markdown.
* Viewer logic lives in self-contained iframe pages.
* Liquid includes bridge the two.

Authors should not need to understand how the components are implemented — only how to invoke them.

---

## Who This Repository Is For

There are two primary audiences:

### Content Authors

You primarily need to:

* Create Markdown posts
* Use front matter correctly
* Insert Juncture components using documented include syntax

You do **not** need to modify theme files or JavaScript.

---

### Maintainers / Developers

If you are extending or modifying the Juncture components, you will be working with:

* Liquid include files
* Single-page viewer HTML/CSS/JS
* Parent/iframe messaging logic
* Site-wide configuration and layout files

Changes to these areas affect how all content renders.

---

## Authoring Workflow (Typical)

1. Create a new post in `_posts`.
2. Add required front matter.
3. Write content in Markdown.
4. Insert Juncture components using documented include tags.
5. Preview locally with `bundle exec jekyll serve`.
6. Commit and deploy.

The structure is intentionally simple. Complexity is pushed into reusable components so that posts remain readable and maintainable.

---

## Design Principles

This repository follows a few clear principles:

* **Keep posts readable.** Markdown should remain the primary authoring format.
* **Encapsulate complexity.** Interactive behavior lives in isolated components.
* **Favor reuse over duplication.** Liquid includes act as stable interfaces.
* **Minimize coupling to theme internals.** Juncture additions extend Chirpy rather than rewriting it.

---

## Important Notes

* Some features depend on specific front matter variables.
* File paths must be accurate — most issues stem from incorrect paths.
* If action links are used, components may require an `id` attribute.
* The admin documentation section explains usage in detail.

---

## Summary

This is a Chirpy-based publishing platform with enhanced capabilities for interactive storytelling.

If you are writing content, focus on the documentation and examples.
If you are extending the system, treat the viewer components and include files as the primary integration layer.

The goal is straightforward: make it easy to create visually rich content without making authors learn the underlying implementation.
