# Repository boundaries

`rsnyder/entreluma` owns the GitHub Pages publishing template and the project site at `entreluma.org`: Jekyll configuration, theme overrides, Liquid includes, iframe viewers, JavaScript/CSS, one sample story, a compact author guide, and build checks.

`rsnyder/entreluma-editor` will own the optional editor at `editor.entreluma.org`: the authoring application, client-side renderer, authentication service, editor deployment, and editor tests. A template user's site needs no editor deployment.

## Clean-start selection

Copied the publishing runtime from the local `rsnyder/storykit-starter` working tree without its Git history. Retained pinned Ruby/theme dependencies, the Pages workflow, local-media rendering checks, Leaflet assets, existing book icon/favicons, and the Monument Valley example and its local image.

Omitted the old author-guide collection and regression fixture, documentation screenshots and unused example media, and technical history. Template copies use the manifest-driven `tools/sync_code.py` described in [upstream-sync.md](upstream-sync.md) to check and apply reusable framework changes without overwriting site-owned content.

## Entreluma integration contract

This is a new template, not an in-place compatibility release. Configuration and front matter use `entreluma`; workspace metadata uses `entreluma_workspace` and `_data/entreluma_workspaces`. Runtime files are `assets/js/entreluma*.js` and `assets/css/entreluma.css`. Capability discovery is `assets/entreluma-preview.json`. The component global is `window.Entreluma`, host initialization is `initEntreluma`, and message types use the `entreluma:` prefix. Payload schemas and viewer include arguments are unchanged. Internal `sk` CSS hooks and utility identifiers are retained where they do not contain the former product name.

The editor migration must update these names together, including its renderer, fixtures, capability discovery, and message handlers, before it can preview this template. Changing the link does not migrate or deploy the editor. See [the messaging protocol](postmessage-protocol.md).

## Hosting boundary

Configure the canonical custom domain and template flag in GitHub repository settings. Do not add a shared `CNAME` to this template. The Pages workflow obtains deployment identity from `actions/configure-pages` and writes a temporary Jekyll override outside the published source. Template copies therefore resolve their own repository paths and domains.
