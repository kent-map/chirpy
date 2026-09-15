# Entreluma postMessage protocol

Maintainer-facing specification of the messaging between a Entreluma host
page (a post rendered by `_layouts/post.html`, logic in
`assets/js/entreluma.js`) and the iframe viewer components
(`assets/components/*.html`, shared runtime `assets/js/entreluma-component.js`).

## Envelope

Every message, in both directions, is a plain object (structured clone —
not a JSON string, though receivers tolerate JSON strings for robustness):

```js
{ type: "entreluma:<name>", payload: { ... } }
```

Messages whose `type` does not start with `entreluma:` are ignored.

## Origins

Host and components are usually same-origin (components are static pages
served by the same site), but two embedding contexts break the naive
`location.origin` assumption and are handled explicitly:

1. **srcdoc hosts** — the editor preview render posts
   into `about:srcdoc` iframes, where `location.origin` serializes as the
   literal string `"null"` even though the document's security origin is
   inherited. The host uses `HOST_ORIGIN` (falls back to `window.origin`)
   for its own identity.
2. **Cross-origin components** — a local-dev editor/preview page loads
   components from the deployed site. The component runtime derives the
   embedder's origin from `document.referrer` (referrer policies expose at
   least the origin for cross-origin embeds); the host trusts exactly the
   origins its component iframes load from (`registerComponentOrigins()`)
   and addresses each send to the target iframe's own origin.

Resulting rules:

- Components send to `SK_TARGET_ORIGIN override → referrer origin (when
  embedded cross-origin) → own origin`, and accept from that origin or
  their own.
- The host accepts from `HOST_ORIGIN` plus the origins of its component
  iframes (override: edit `allowedMessageOrigins` in `entreluma.js`;
  `null` disables the check).

There is no cross-version compatibility concern: host and components
deploy atomically from the same site, so protocol changes are safe as a
single commit that updates both sides.

## Host → component

### `entreluma:action`

Sent when a reader clicks an action (trigger) link. See the author-facing
[Action Links reference](/admin/entreluma-action-links) for link syntax.

```js
{ type: "entreluma:action",
  payload: {
    action: "zoomto" | "flyto" | "playat" | "play" | "pause",
    args:   ["<argument segment>", ...],  // slash-separated link segments after the action
    label:  "<link text or label attribute>"
  } }
```

`args` is a real array of the path segments after the action name.
Because action arguments themselves contain commas (`pct:1,2,3,4`,
`37.02,-110.23,11`, `42,75`), an argument string arrives as **one**
array element; components split it internally as their action requires.

Actions by component:

| Component | Action | args[0] format |
|---|---|---|
| image | `zoomto` | IIIF-style region: `pct:x,y,w,h` or `x,y,w,h`; `label` shown as region label |
| map | `flyto` | `lat,lng,zoom` or `Qxxxx[,zoom]`; repeating the same target restores the prior view |
| youtube | `playat` | `start[,end]`, seconds or `h:mm:ss` |
| youtube | `play` | optional `start` |
| youtube | `pause` | (none) |
| vimeo | `playat` | `start[,end]`, seconds or `h:mm:ss` |
| vimeo | `play` | optional `start` |
| vimeo | `pause` | (none) |
| image-compare, vis-network, iframe | — | no actions |

### `entreluma:id` (reply to `entreluma:getId`)

```js
{ type: "entreluma:id", payload: { id: "<iframe id or data-id>" } }
```

### `entreluma:element` (reply to `entreluma:getElementById`)

```js
{ type: "entreluma:element",
  payload: { id: "<requested id>", html: "<outerHTML>"|null, text: "<textContent>"|null } }
```

## Component → host

### `entreluma:showDialog`

Ask the host to open the expanded (max-mode) dialog.

```js
{ type: "entreluma:showDialog", payload: { src: "<url>", aspect: 1.5 } }
```

The payload is flat — `src`/`aspect` at the top level of `payload`.
(Historical note: the map component once wrapped these in a `props` object
the host never read, which silently broke its dialog. The runtime's
`showDialog(src, aspect)` makes the wrong shape impossible.)

### `entreluma:height`

Ask the host to resize this component's iframe (used by image-compare
when its alignment panel opens and closes).

```js
{ type: "entreluma:height", payload: { height: 640 } }  // px, positive number
```

### `entreluma:getId`

Ask the host for the id it assigned to this component's iframe. Used by
vis-network to derive its data-block id. Host replies with `entreluma:id`.

### `entreluma:getElementById`

Ask the host for an element's content by id. Used by vis-network to fetch
its hidden CSV data block (by convention the element id is the viewer's
`id` + `-csv`; the block is hidden by the `[id$="-csv"]` rule in
`entreluma.css`). Host replies with `entreluma:element`.

## Component runtime API

`assets/js/entreluma-component.js` (classic script; exposes `window.Entreluma`):

| Function | Purpose |
|---|---|
| `Entreluma.onAction(fn)` | Register handler for `entreluma:action`; receives `{ action, args, label }` with `action` lower-cased |
| `Entreluma.onMessage(fn)` | Lower-level handler for any `entreluma:*` message: `fn(name, payload, event)` |
| `Entreluma.sendToHost(type, payload)` | Send an enveloped message to the parent page |
| `Entreluma.showDialog(src, aspect)` | Request the expanded dialog |
| `Entreluma.reportHeight(px)` | Request an iframe resize |
| `Entreluma.getHostId()` | Promise for the host-assigned iframe id (null on timeout) |
| `Entreluma.requestHostElement(id)` | Promise for `{ html, text }` of a host element (null on timeout) |
| `Entreluma.safeParse(data)` | Tolerant object/JSON-string parse, never throws |

Component pages load the runtime before their own scripts:

```html
<script src="../js/entreluma-component.js"></script>
```

(Classic scripts execute in document order and before module scripts, so
`window.Entreluma` is available to both kinds of component code.)

## Host behavior notes (`entreluma.js`)

- Trigger-link clicks post `entreluma:action` to the iframe resolved by
  `.col2 [data-id="<target>"]` (the cloned viewer in two-column mode)
  falling back to `getElementById(target)`. If neither exists the click
  is a no-op and a `console.warn` names the missing id — the most common
  authoring error (viewer include missing its `id`).
- `entreluma:height` and the `entreluma:getId` reply resolve the sending
  iframe by matching `event.source` against iframe `contentWindow`s.
- Unknown `entreluma:*` types are ignored.
