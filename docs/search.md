# Search

Entreluma uses Pagefind for production search. Pagefind runs after Jekyll and
writes its browser bundle and static index into the generated site. There is no
search server and no external search service.

Only post content marked with `data-pagefind-body` is indexed. Post titles,
categories, and tags are exposed as Pagefind metadata so the results retain the
useful context from Chirpy's search UI.

Results retain Pagefind's ranking order. A modest relative-score cutoff removes
matches below five percent of the strongest result; results are then displayed
ten at a time with an explicit load-more control. Searches wait 150 milliseconds
after the most recent input before displaying results, reducing repeated work
while keeping the interface responsive.

## Local development

The normal development server keeps using Chirpy's built-in search:

```sh
bundle exec jekyll serve --livereload
```

To exercise Pagefind locally, make a production build, generate the index, and
serve the output directory:

```sh
JEKYLL_ENV=production bundle exec jekyll build
npx --yes pagefind@1.5.2 --site _site
ruby -run -e httpd _site -p 4000
```

The production loader falls back to Chirpy search if the Pagefind bundle cannot
be loaded. This keeps search available if indexing is accidentally omitted from
a custom deployment.

For a project site, build with its base URL and point Pagefind at the same output
directory. The browser loader reads `site.baseurl` and prefixes result links.

## Deployment

The included Pages workflow pins Pagefind 1.5.2 and runs it after Jekyll, before
link checking and artifact upload. Any replacement deployment must preserve that
ordering and must pass Pagefind the exact directory that Jekyll generated.
