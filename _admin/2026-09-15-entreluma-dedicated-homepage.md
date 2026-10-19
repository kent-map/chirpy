---
title: "Entreluma: Dedicated Homepage and Examples Index"
description: How to separate a project landing page from the Entreluma post collection while preserving the standard theme, cards, navigation, and publishing workflow.
permalink: /admin/entreluma-dedicated-homepage
date: 2026-09-15
toc: true
order: 14
entreluma:
  mode: flat
  toolbar: false
---

Entreluma can use a dedicated homepage for introducing a project while listing its published stories on a separate **Examples** page. This variation changes the site structure, but it does not introduce a separate publishing system: stories remain ordinary files in `_posts`, and the Examples page uses the standard Entreluma cards and list/grid control.

The starter template includes the shared layouts and includes needed for this variation. Site owners customize only their homepage, navigation copy, and optional CSS.

## Resulting site structure

```text
/
├── Landing page
├── /examples/
│   └── Published files from _posts
├── /posts/:title/
│   └── Individual stories
├── /categories/
├── /tags/
├── /archives/
├── /about/
└── /admin/
```

The landing page remains on the standard `home` layout. A front matter setting prevents that layout from appending the post index. The Examples tab then renders the same post index through a reusable include.

## Files involved

The shared framework supplies these files:

| File | Role |
|---|---|
| `_layouts/home.html` | Renders homepage content and conditionally appends the post index |
| `_layouts/examples.html` | Wraps an Examples page in the standard page layout and post index |
| `_includes/post-index.html` | Selects visible posts and renders standard Entreluma cards |
| `_includes/post_index_item.html` | Defines each story card |

Each site owns these files and may customize them safely:

| File | Role |
|---|---|
| `index.html` | Landing-page content and the `show_posts` setting |
| `_tabs/examples.md` | Examples navigation entry and introductory copy |
| `_tabs/*.md` | Navigation order |
| `assets/css/custom.css` | Optional landing-page presentation |
| `_config.yml` | Site configuration, including whether root pagination is enabled |

Keeping framework and site-owned files separate allows `tools/sync_code.py` to update the shared behavior without overwriting local content or branding.

## Configure the landing page

Set the homepage to the standard `home` layout and disable its post index:

```yaml
---
layout: home
show_posts: false
---
```

Add the project introduction beneath the front matter. For example:

{% raw %}
```html
<h1>Stories about our region</h1>
<p>Explore the people, places, and records that shape this community.</p>
<p>
  <a href="{{ '/examples/' | relative_url }}">Browse the stories</a>
  or
  <a href="{{ '/about/' | relative_url }}">learn about the project</a>.
</p>
```
{% endraw %}

Continue using `layout: home` rather than creating a site-specific landing layout. This preserves the normal Home navigation state, top bar, sidebar, search, theme controls, and footer.

The `show_posts` option is deliberately opt-out. Existing Entreluma homepages without the setting continue to show their post index.

## Create the Examples tab

Create `_tabs/examples.md`:

```yaml
---
layout: examples
title: Examples
icon: fas fa-compass
order: 1
format: list
description: Interactive stories published with Entreluma.
---

Explore the stories published on this site.
```

The `examples` layout automatically appends every visible published post. No Liquid loop is needed in the tab file.

Use `format: list` for a small collection. Use `format: grid` when several examples benefit from a compact gallery. Readers can switch between the two views, and Entreluma remembers their choice in the browser.

Give every tab a distinct `order` value. For example:

| Tab | Order |
|---|---:|
| Examples | 1 |
| Categories | 2 |
| Tags | 3 |
| Archives | 4 |
| About | 5 |

For a small collection, you can keep taxonomy pages available to post metadata
while hiding their top-level navigation entries. Add `nav: false` to the front
matter of `_tabs/categories.md`, `_tabs/tags.md`, or `_tabs/archives.md`. Remove
that setting when the collection is large enough to make the tab useful. Avoid
using `published: false` for Categories or Tags; posts may still link to their
generated taxonomy pages.

## Disable root pagination

Remove the following setting from `_config.yml` when the homepage is dedicated to landing content:

```yaml
paginate: 12
```

The version of `jekyll-paginate` used by the theme associates pagination with the root index. Leaving it enabled can generate `/page2/`, `/page3/`, and later pages from the landing page once the site has enough posts.

The Examples page intentionally lists the complete collection for this small-site variation. Categories, tags, feeds, search, and individual post URLs continue to work normally.

If the Examples collection eventually becomes large enough to require pagination, choose and test a pagination approach specifically for that route rather than re-enabling root pagination.

## Add and manage examples

Continue creating stories in the usual location:

```text
_posts/YYYY-MM-DD-story-name.md
```

No post front matter changes are required. The index:

- places pinned posts first;
- excludes posts with `hidden: true`;
- uses each post's title, description, date, category, and preview image;
- preserves `/posts/:title/` or any explicit permalink;
- supports local, remote, CDN, and Wikimedia Commons preview images through the existing media helpers.

Set `published: false` while a story is not ready to appear. Change it to `true` when the story should be built and listed.

The optional `featured` field is not used by the default landing or Examples pages. It remains available to sites that explicitly add the `featured_posts.html` include.

## Customize without forking the framework

Put project-specific presentation rules in `assets/css/custom.css`. Useful, low-risk enhancements include:

- a bordered introduction panel;
- clearer primary and secondary calls to action;
- a small feature summary;
- responsive spacing;
- colors derived from the project's existing identity.

Avoid copying the post-index markup into `index.html` or editing `_includes/post-index.html` for one site's visual treatment. Reusing the shared include ensures future fixes to images, metadata, view controls, and filtering reach the site through the normal sync process.

The Entreluma project site demonstrates this boundary: its landing-page copy and styles are local, while its home layout, Examples layout, and post-index include match the template.

## Migrate an existing Entreluma site

1. Commit or back up any local work.
2. Update the shared framework files:

   ```sh
   python3 tools/sync_code.py --check
   python3 tools/sync_code.py --apply
   ```

3. Remove `paginate: 12` from `_config.yml`.
4. Add `show_posts: false` to the front matter in `index.html`.
5. Rewrite the body of `index.html` as the project introduction.
6. Create `_tabs/examples.md` with `layout: examples`.
7. Adjust the `order` values of the other tab files.
8. Add only project-specific styling to `assets/css/custom.css`.
9. Build and inspect both `/` and `/examples/`.

The sync tool does not change `index.html`, `_tabs`, `_config.yml`, or `custom.css`, because those files belong to the individual site.

## Return to a combined homepage

To place the post index beneath the homepage content again:

1. Remove `show_posts: false` from `index.html`.
2. Remove the Examples tab if it would duplicate the same collection.
3. Leave pagination disabled to show all posts, or restore `paginate: 12` if the root homepage should use traditional pagination.
4. Restore the other tab order values if needed.

No story files or permalinks need to change.

## Verify the variation

Run the normal checks after making the change:

```sh
bundle exec jekyll build
python3 tools/check_consistency.py
```

The included Pages workflow also runs HTML-Proofer with the repository's
project-specific exclusions.

Then verify:

- the homepage contains no post index or list/grid button;
- the Examples page lists every intended published post;
- list/grid switching works;
- hidden and unpublished posts do not appear;
- preview images resolve correctly;
- Categories, Tags, Archives, About, search, and feeds still work;
- the layout remains usable on mobile and in both color modes.
