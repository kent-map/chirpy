# External dependencies

Every third-party runtime dependency, its pinned version, where it is
referenced, and whether the reference carries an SRI `integrity` hash.
When bumping a version: update every listed reference, recompute SRI where
applicable (hashes below were computed from the npm tarball, which is
byte-identical to what jsDelivr/unpkg serve), and keep
`tools/check_consistency.py` green.

SRI applies only to `<script src>` / `<link>` tags. ES-module `import`
URLs cannot carry SRI — for those the exact version pin is the control.
Shoelace loads an internal lazy module graph, so it is pinned but not SRI'd.

## Site (host pages)

| Dependency | Version | Referenced in | SRI |
|---|---|---|---|
| Shoelace | 2.18.0 | `_layouts/post.html` (theme css + autoloader), `assets/js/entreluma.js` (component imports), `assets/css/entreluma.css` (@import theme), `assets/components/{image-compare,vis-network}.html` | no (module graph) |
| scrollama | 3.2.0 | `assets/js/entreluma.js` (import, cdnjs) | no (import) |
| js-md5 | 0.8.3 | `assets/js/entreluma.js`, `assets/components/image.html` (import) | no (import) |
| Font Awesome | 6.5.x | `_includes/sidebar.html` etc. (via Chirpy), `assets/components/map.html` (6.5.0) | no |

## Build-time dependencies

| Dependency | Version | Referenced in | Purpose |
|---|---|---|---|
| Pagefind | 1.5.2 | `.github/workflows/pages-deploy.yml`, `docs/search.md` | Generates the static production search index after Jekyll builds |

## Components (iframe viewers)

| Dependency | Version | Referenced in | SRI |
|---|---|---|---|
| OpenSeadragon | 5.0.1 | `assets/components/image.html` (script + `prefixUrl` images) | yes |
| Leaflet | 1.9.4 | `assets/components/map.html` (js + css) | yes |
| Leaflet.SmoothWheelZoom | vendored | `assets/js/vendor/Leaflet.SmoothWheelZoom.js` (was hotlinked from a personal github.io origin) | n/a (local) |
| Leaflet marker images | vendored (from Leaflet v0.7.7) | `assets/img/leaflet/marker-icon{,-2x}.png`, `marker-shadow.png` | n/a (local) |
| leaflet-gesture-handling | 1.2.2 | `assets/components/map.html` (js + css) | yes |
| @allmaps/leaflet | 1.0.0-beta.44 | `assets/components/map.html` | yes |
| exif-js | 2.3.0 | `assets/components/map.html` | yes |
| marked | 18.0.5 | `assets/components/{image,map,youtube,vimeo,vis-network}.html` (import) | no (import) |
| vis (vis-network) | 4.21.0 | `assets/components/vis-network.html` (cdnjs) | yes (pre-existing) |
| papaparse | 5.4.1 | `assets/components/vis-network.html` | yes |
| YouTube IFrame API | (unversioned by design) | `assets/components/youtube.html` | no — Google requires loading the live API |
| Vimeo Player SDK | (unversioned by design) | `assets/components/vimeo.html` | no — Vimeo requires loading the live API |

> **@allmaps/leaflet is pinned to 1.0.0-beta.44 deliberately**: it is the
> newest release that still ships `dist/bundled/allmaps-leaflet-1.9.umd.js`.
> Releases beta.45+ dropped the bundled build, which had silently broken the
> previously unversioned URL. When upgrading, check the package layout first.

## Live web services (runtime data, not code)

| Service | Used by | Resilience |
|---|---|---|
| query.wikidata.org (SPARQL) | entity popups, map QID lookups | per-QID sessionStorage cache (24 h TTL), request timeout, non-fatal failures |
| *.wikipedia.org REST (summaries) | entity popups | timeout, non-fatal |
| upload.wikimedia.org / Commons API | image viewer (`wc:` shorthand) | n/a (media host) |
| annotations.allmaps.org | map warped layers | non-fatal |
| youtube.com oembed + IFrame API | youtube viewer | caption falls back to blank |
| vimeo.com oEmbed + Player SDK | vimeo viewer | caption/poster fall back to blank; expanded player reports an error |


Editor and client-side rendering dependencies are maintained in `rsnyder/entreluma-editor`.
