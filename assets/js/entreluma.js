/**
 * Entreluma client helpers
 * ----------------------
 * Assumes this file is loaded as an ES module (e.g., <script type="module" ...>).
 *
 * Key goals:
 * - Avoid O(N_iframes * N_links) loops
 * - Reduce XSS / injection risk (avoid innerHTML where not needed; validate URLs)
 * - Avoid double-wrapping / double-binding
 * - Make async fetches more robust (timeouts, per-request error handling)
 * - Fix a few Wikidata query/response mismatches and ordering issues
 */

import "https://cdn.jsdelivr.net/npm/js-md5@0.8.3/src/md5.min.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/button/button.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/card/card.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/carousel/carousel.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/carousel-item/carousel-item.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/copy-button/copy-button.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/dialog/dialog.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/dropdown/dropdown.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/tab/tab.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/tab-group/tab-group.js";
import "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.18.0/cdn/components/tab-panel/tab-panel.js";
import "https://cdnjs.cloudflare.com/ajax/libs/scrollama/3.2.0/scrollama.min.js";

/* ---------------------------------------------
 * Environment / config
 * ------------------------------------------- */

// Touch + small viewport tends to be a better “mobile-ish” proxy than UA sniffing alone.
const isCoarsePointer =
    window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
const isNarrowViewport =
    window.matchMedia?.("(max-width: 768px)")?.matches ?? false;
const isMobile = isCoarsePointer || isNarrowViewport;

// If true, action links are disabled (no href + styled as plain text)
const isStatic = false;

// The host's effective origin for postMessage. Inside an about:srcdoc
// document (the preview tool and the editor preview render posts into
// srcdoc iframes) location.origin serializes as the literal string "null"
// even though the document's SECURITY origin is inherited from the
// embedder — using it broke component↔host messaging (viewer expand
// dialogs, action links) in every preview surface. window.origin reports
// the security origin correctly in both contexts.
const HOST_ORIGIN =
    (location.origin && location.origin !== 'null') ? location.origin : window.origin;

// Origins accepted for postMessage. Components are usually same-origin
// (static pages served by this site) but MAY be cross-origin — e.g. this
// page rendered by a local-dev editor/preview while components load from
// the deployed site. registerComponentOrigins() adds the origins of the
// actual component iframes on the page at init, so we trust exactly the
// places we load viewers from. Set to null to allow all origins (not
// recommended).
const OPAQUE_SANDBOX = window.origin === 'null';
const allowedMessageOrigins = new Set([HOST_ORIGIN]);

/** Trust the origins we actually load viewer component iframes from. */
function registerComponentOrigins(root = document) {
    root.querySelectorAll('iframe[src*="/assets/components/"]').forEach((f) => {
        try { allowedMessageOrigins.add(new URL(f.src, location.href).origin); }
        catch { /* unparsable src — skip */ }
    });
}

/** targetOrigin for posting INTO a component iframe: its own origin. */
function originOfIframe(el) {
    if (OPAQUE_SANDBOX) return '*'; // descendants inherit the opaque sandbox
    try { return new URL(el.src, location.href).origin; }
    catch { return HOST_ORIGIN; }
}

/* ---------------------------------------------
 * Small utilities
 * ------------------------------------------- */

function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

function parseAspect(value, fallback = 1) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function safeURL(urlLike, base = location.href) {
    // Accepts absolute or relative URLs. Returns URL instance or null.
    try {
        const u = new URL(urlLike, base);
        // If you want to restrict protocols, do it here:
        if (!["http:", "https:"].includes(u.protocol)) return null;
        return u;
    } catch {
        return null;
    }
}

/**
 * Fetch with timeout and sane defaults.
 */
async function fetchJson(url, { timeoutMs = 12000, ...opts } = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(url, { ...opts, signal: controller.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
        return await resp.json();
    } finally {
        clearTimeout(t);
    }
}

/* ---------------------------------------------
 * Dialog (single instance)
 * ------------------------------------------- */

let activeDialog = null;

function computeDialogWidth({ aspect }) {
    const ar = parseAspect(aspect, 1);
    const captionHeight = 36; // px (your assumption)
    // Effective AR when the iframe includes a caption area below in the frame itself
    const arWithCaption = window.innerWidth / (window.innerWidth / ar + captionHeight);

    const w =
        arWithCaption > 1
            ? window.innerWidth * 0.93
            : window.innerHeight * arWithCaption * 0.93;

    // Avoid absurd widths
    return clamp(Math.round(w), 320, Math.round(window.innerWidth * 0.98));
}

function showDialog({ aspect, src } = {}, localAssignment = null) {
    if (activeDialog) return;
    const srcUrl = safeURL(src);
    if (!srcUrl) {
        console.warn("showDialog: invalid src", src);
        return;
    }

    const width = computeDialogWidth({ aspect });

    const dialog = document.createElement("sl-dialog");
    dialog.id = "entrelumaDialog";
    dialog.setAttribute("size", "large");
    dialog.setAttribute("no-header", "");
    dialog.style.setProperty("--width", `${width}px`);

    // Clean up when hidden
    dialog.addEventListener(
        "sl-after-hide",
        () => {
            dialog.remove();
            activeDialog = null;
        },
        { once: true }
    );

    const closeButton = document.createElement("sl-button");
    closeButton.setAttribute("slot", "footer");
    closeButton.setAttribute("variant", "primary");
    closeButton.setAttribute("size", "small");
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => dialog.hide());
    dialog.appendChild(closeButton);

    const wrapper = document.createElement("div");

    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.aspectRatio = String(aspect);
    iframe.loading = "lazy";
    iframe.allow = "clipboard-write";
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("allow", "autoplay; encrypted-media");
    iframe.src = srcUrl.toString();
    // Only inherit a local assignment from the registered sending viewer.
    // The resource broker also checks the exact runtime URL and generation.
    if (localAssignment && srcUrl.searchParams.get('sk_resource') === localAssignment) {
        iframe.dataset.skResource = localAssignment;
    }

    wrapper.appendChild(iframe);
    dialog.appendChild(wrapper);

    document.body.appendChild(dialog);
    activeDialog = dialog;
    dialog.show();
}

/* ---------------------------------------------
 * postMessage handling
 * ------------------------------------------- */

function isOriginAllowed(origin) {
    if (!allowedMessageOrigins) return true;
    return allowedMessageOrigins.has(origin);
}

function findIframeBySourceWindow(sourceWindow) {
    // Note: querySelectorAll('iframe') can be expensive if huge DOM;
    // but message events should be infrequent.
    for (const iframe of document.querySelectorAll("iframe")) {
        if (iframe.contentWindow === sourceWindow) return iframe;
    }
    return null;
}

// Tolerant parse: accepts plain objects or JSON strings, never throws.
function safeParseMessage(data) {
    if (!data) return null;
    if (typeof data === "object") return data;
    if (typeof data !== "string") return null;
    try { return JSON.parse(data); } catch { return null; }
}

/**
 * Host side of the Entreluma postMessage protocol.
 * All messages use the envelope { type: "entreluma:<name>", payload: {...} }
 * — see docs/postmessage-protocol.md.
 */
function addMessageHandler() {
    window.addEventListener("message", (event) => {
        if (event.origin === 'null') {
            if (!OPAQUE_SANDBOX || !findIframeBySourceWindow(event.source)) return;
        } else if (!isOriginAllowed(event.origin)) return;

        const msg = safeParseMessage(event.data);
        if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("entreluma:")) return;

        const name = msg.type.slice("entreluma:".length);
        let payload = msg.payload || {};
        const reply = (type, replyPayload) =>
            event.source?.postMessage({ type: `entreluma:${type}`, payload: replyPayload }, event.origin === 'null' ? '*' : event.origin);

        switch (name) {
            case "showDialog": {
                // Resolve a relative src against the SENDING component's URL,
                // not this document's. Inside an about:srcdoc host (preview
                // tool, editor preview) location.href is not a usable base —
                // a component that sends a pathname-relative src (youtube/
                // image-compare historically did) would silently fail
                // safeURL. Components run at real URLs, so their iframe src
                // is always a valid base.
                const sender = findIframeBySourceWindow(event.source);
                if (sender && sender.src && payload && typeof payload.src === "string"
                    && !/^https?:/i.test(payload.src)) {
                    const resolved = safeURL(payload.src, sender.src);
                    if (resolved) payload = { ...payload, src: resolved.href };
                }
                showDialog(payload, sender?.dataset.skResource || null);
                return;
            }

            case "height": {
                const h = Number(payload.height);
                if (!Number.isFinite(h) || h <= 0) return;
                const sendingIframe = findIframeBySourceWindow(event.source);
                if (sendingIframe) sendingIframe.style.height = h + "px";
                return;
            }

            case "getId": {
                const sendingIframe = findIframeBySourceWindow(event.source);
                if (sendingIframe) {
                    reply("id", { id: sendingIframe.id || sendingIframe.getAttribute("data-id") });
                }
                return;
            }

            case "getElementById": {
                const el = document.getElementById(payload.id);
                reply("element", {
                    id: payload.id,
                    html: el ? el.outerHTML : null,
                    text: el ? el.textContent : null
                });
                return;
            }

            default:
                console.debug(`Entreluma: ignoring unknown message type entreluma:${name}`);
        }
    });
}

addMessageHandler();

/* ---------------------------------------------
 * Wrap adjacent embeds as Shoelace tabs
 * ------------------------------------------- */

function wrapAdjacentEmbedsAsTabs({
    root = document.body,
    minRunLength = 2,
    wrapperClass = "embed-tabs",
    iconFor = (node) => {
        if (node.classList.contains('embed-image')) return "fa-regular fa-image";
        if (node.classList.contains('embed-map')) return "fa-solid fa-map-pin";
        if (node.classList.contains('embed-image-compare')) return "fa-regular fa-images";
        if (node.classList.contains('embed-youtube')) return "fa-brands fa-youtube";
        if (node.classList.contains('iframe-wrapper')) return "fa-regular fa-file-lines";
        return "fa-solid fa-square";
    },
    labelFor = (node, idx) => {
        if (node.tagName === "IFRAME") return `Map ${idx + 1}`;
        if (node.tagName === "P" && node.querySelector("img")) return `Image ${idx + 1}`;
        return `Item ${idx + 1}`;
    }
} = {}) {

    const printing = !!(window.matchMedia && window.matchMedia("print").matches);

    const isIgnorableText = (n) =>
        (n.nodeType === Node.COMMENT_NODE) ||
        (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim() === "");

    const isEmbedItem = (n) =>
        n instanceof Element &&
        (n.tagName === "IFRAME" || n.tagName === "FIGURE" || (n.tagName === "P" && n.querySelector("img")));

    const nextNonIgnorableSibling = (node) => {
        let n = node.nextSibling;
        while (n && isIgnorableText(n)) n = n.nextSibling;
        return n;
    };

    // In print mode, hide everything in the run except the first item.
    const hideRunExceptFirst = (run) => {
        for (let k = 1; k < run.length; k++) {
            run[k].style.display = "none";
        }
    };

    let panelCounter = 0;

    for (const parent of root.querySelectorAll("*")) {
        if (!parent.childNodes?.length) continue;

        let nodes = Array.from(parent.childNodes);
        let i = 0;

        while (i < nodes.length) {
            const start = nodes[i];

            if (!isEmbedItem(start)) {
                i++;
                continue;
            }

            const run = [start];
            let cursor = start;

            while (true) {
                const next = nextNonIgnorableSibling(cursor);
                if (next && isEmbedItem(next)) {
                    run.push(next);
                    cursor = next;
                    continue;
                }
                break;
            }

            if (run.length >= minRunLength) {

                // --- PRINT BEHAVIOR ---
                if (printing) {
                    hideRunExceptFirst(run);

                    // Refresh snapshot after mutation
                    nodes = Array.from(parent.childNodes);
                    i = nodes.indexOf(run[0]) + 1;
                    continue;
                }

                // --- NORMAL (TABS) BEHAVIOR ---
                if (run[0].closest(`sl-tab-group.${wrapperClass}`)) {
                    i++;
                    continue;
                }

                const tabGroup = document.createElement("sl-tab-group");
                // tabGroup.classList.add(wrapperClass, "right");

                parent.insertBefore(tabGroup, run[0]);

                run.forEach((node, idx) => {
                    const panelName = `embed-panel-${++panelCounter}`;
                    const label = labelFor(node, idx);

                    const tab = document.createElement("sl-tab");
                    tab.slot = "nav";
                    tab.panel = panelName;
                    tab.setAttribute("aria-label", label);
                    tab.title = label;

                    const icon = document.createElement("i");
                    icon.className = iconFor(node);
                    icon.setAttribute("aria-hidden", "true");
                    tab.appendChild(icon);

                    const panel = document.createElement("sl-tab-panel");
                    panel.name = panelName;
                    panel.appendChild(node);

                    tabGroup.appendChild(tab);
                    tabGroup.appendChild(panel);
                });

                nodes = Array.from(parent.childNodes);
                i = nodes.indexOf(tabGroup) + 1;
                continue;
            }

            i++;
        }
    }
}


/* ---------------------------------------------
 * Auto floating: swap order of embed (or embed group) with prior paragraph
 * ------------------------------------------- */

function autoFloat({ root = document.body } = {}) {
    const embeds = Array.from(
        root.querySelectorAll('iframe, sl-tab-group, figure.iframe-wrapper, p:has(>img), p:has(>a>img)')
    ).reverse();

    embeds.forEach((embed) => {
        if (embed.classList.contains('full') || embed.classList.contains('right')) return;

        let previousSib = embed.previousElementSibling;
        while (
            (previousSib?.nodeName === 'P' && previousSib.id && previousSib.id.indexOf('-csv') > 0) ||
            previousSib?.nodeName === 'BLOCKQUOTE'
        ) {
            previousSib = previousSib.previousElementSibling;
        }
        if (previousSib?.nodeName !== 'P') return;

        const parent = embed.parentNode;
        if (!parent) return;

        embed.classList.add('right');
        embed.classList.add('float');

        // Existing behavior: swap order (embed before paragraph) and insert hr above embed
        parent.insertBefore(embed, previousSib);
        const hr = document.createElement('hr');
        parent.insertBefore(hr, embed);

        // Now wrap the pair (embed + previousSib) in a neutral wrapper.
        // After the swap, embed is immediately before previousSib.
        const wrapper = document.createElement('div');
        wrapper.className = 'float-pair';

        parent.insertBefore(wrapper, embed); // put wrapper where embed currently is
        wrapper.appendChild(embed);
        wrapper.appendChild(previousSib);
    });
}


/* ---------------------------------------------
 * Action links -> iframe postMessage
 * ------------------------------------------- */

function objectFromLink(linkEl, attrs) {
    const obj = {};
    for (const name of attrs) {
        if (linkEl.hasAttribute(name)) obj[name] = linkEl.getAttribute(name);
    }
    return obj;
}

/**
 * Parse action target/action/args from either:
 * - explicit attributes: action/label/target/args
 * - or URL path that contains .../<iframeId>/<action>/<args...>
 */
function parseActionLink(a) {
    const linkAttrs = objectFromLink(a, ["action", "label", "target", "args"]);
    const href = a.getAttribute("href") || a.getAttribute("data-href") || "";

    // If explicit args provided, accept them as a simple split (comma or space are common).
    // If you need to support JSON-in-attr, do it here.
    const explicitArgs =
        typeof linkAttrs.args === "string" && linkAttrs.args.trim()
            ? linkAttrs.args.split(/[\s,]+/).filter(Boolean)
            : null;

    const url = safeURL(href) || safeURL(a.getAttribute("data-href") || "");
    const pathParts = url
        ? url.pathname.split("/").filter((p) => p && p !== "#")
        : [];

    return {
        href,
        target: linkAttrs.target || null,
        action: linkAttrs.action || null,
        label: linkAttrs.label || a.textContent || "",
        explicitArgs,
        pathParts
    };
}

function addActionLinks({ root = document.body } = {}) {
    const iframes = Array.from(root.querySelectorAll("iframe")).filter((i) => i.id);

    // Diagnostics: embeds rendered without an id (embed/_iframe.html marks
    // them) can never be targeted by action links — surface once, quietly.
    const noId = root.querySelectorAll('[data-entreluma-warn="no-id"]');
    if (noId.length) {
        console.info(`Entreluma: ${noId.length} viewer embed(s) on this page have no id attribute; ` +
            `action links cannot target them. Add id="..." to the include if you need to.`);
    }

    if (!iframes.length) return;

    // Index iframes by id for quick lookup
    const iframeById = new Map(iframes.map((i) => [i.id, i]));

    // Process each <a> once (avoid nested loops)
    const links = Array.from(root.querySelectorAll("a"));
    const unboundTargets = [];

    for (const a of links) {
        // Avoid double-binding
        if (a.dataset.actionBound === "1") continue;

        const parsed = parseActionLink(a);

        // Determine target/action/args
        // Priority:
        // 1) explicit target/action/args (attrs)
        // 2) infer from path containing iframeId
        let target = parsed.target;
        let action = parsed.action;
        let args = parsed.explicitArgs;

        if (!target || !action || !args?.length) {
            // Try inferring from URL path if it includes an iframe id
            const idx = parsed.pathParts.findIndex((p) => iframeById.has(p));
            if (idx >= 0) {
                target = target || parsed.pathParts[idx];
                action = action || parsed.pathParts[idx + 1];
                args = args || parsed.pathParts.slice(idx + 2);
            }
        }

        if (!target || !action || !args?.length) continue;

        const iframe = iframeById.get(target);
        if (!iframe) {
            a.classList.add("disabled");
            unboundTargets.push(target);
            continue;
        }

        // If isStatic, disable link but keep it readable
        if (isStatic) {
            a.removeAttribute("href");
            a.style.color = "inherit";
            a.style.cursor = "default";
            a.dataset.actionBound = "1";
            continue;
        }

        // Convert to a trigger link (store original href)
        if (a.hasAttribute("href")) {
            a.setAttribute("data-href", parsed.href);
            a.removeAttribute("href");
            a.setAttribute("data-action", action);
            a.setAttribute("data-target", target);
            a.setAttribute("data-label", parsed.label);
            // args may themselves contain commas (regions, coordinates), so
            // store the array as JSON rather than a joined string.
            a.setAttribute("data-args", JSON.stringify(args));
        }

        a.classList.add("trigger");
        a.style.cursor = "pointer";
        a.dataset.actionBound = "1";

        a.addEventListener("click", (e) => {
            e.preventDefault();
            const ds = e.currentTarget.dataset;
            let parsedArgs;
            try { parsedArgs = JSON.parse(ds.args); } catch { parsedArgs = [ds.args]; }
            const targetEl =
                document.querySelector(`.col2 [data-id="${ds.target}"]`) ||
                document.getElementById(ds.target);
            if (!targetEl || !targetEl.contentWindow) {
                console.warn(`Entreluma: action link target "${ds.target}" not found — ` +
                    `check that a viewer include on this page has id="${ds.target}"`);
                return;
            }
            targetEl.contentWindow.postMessage({
                type: "entreluma:action",
                payload: { action: ds.action, args: parsedArgs, label: ds.label }
            }, originOfIframe(targetEl));
        });
    }

    if (unboundTargets.length) {
        const ids = [...new Set(unboundTargets)].join('", "');
        console.warn(`Entreluma: ${unboundTargets.length} action link(s) reference viewer id(s) "${ids}" ` +
            `that don't exist on this page — check that each targeted viewer include has a matching id attribute.`);
    }
}


/* ---------------------------------------------
 * Wikidata / Wikipedia helpers
 * ------------------------------------------- */

function mwImage(mwImg, width = 0) {
    // Converts Wikimedia commons image URL to a thumbnail link.
    // Accepts:
    // - full URL
    // - "Special:FilePath/..."
    // - "File:..."
    // - "wc:..."
    let name = mwImg
        .replace(/^wc:/, "")
        .replace(/Special:FilePath\//, "File:")
        .split("File:")
        .pop();

    name = decodeURIComponent(name).replace(/ /g, "_");

    const _md5 = md5(name);
    const extension = name.split(".").pop()?.toLowerCase();
    let url = `https://upload.wikimedia.org/wikipedia/commons${width ? "/thumb" : ""}`;
    url += `/${_md5.slice(0, 1)}/${_md5.slice(0, 2)}/${name}`;

    if (width > 0) {
        url += `/${width}px-${name}`;
        if (extension === "svg") url += ".png";
        if (extension === "tif" || extension === "tiff") url += ".jpg";
    }

    return url;
}

// Creates a GeoJSON file URL from a Who's on First ID
function whosOnFirstUrl(wof) {
    const parts = [];
    for (let i = 0; i < wof.length; i += 3) parts.push(wof.slice(i, i + 3));
    return `https://data.whosonfirst.org/${parts.join("/")}/${wof}.geojson`;
}

function extractQidFromAnchor(a) {
    const direct = a.getAttribute("qid");
    if (direct && /^Q\d+$/.test(direct)) return direct;

    const href = a.getAttribute("href") || "";
    const url = safeURL(href);
    const pathParts = url ? url.pathname.split("/").filter(Boolean) : [];

    const q = pathParts.find((p) => /^Q\d+$/.test(p));
    return q || null;
}

/* Entity data is cached per QID in sessionStorage so repeat page loads in a
 * reading session don't re-query Wikidata/Wikipedia (rate-limit and latency
 * resilience). Failures are non-fatal: uncached entities simply get no popup
 * and the anchor stays a normal link. */
const ENTITY_CACHE_PREFIX = "entreluma:entity:";
const ENTITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readEntityCache(qid) {
    try {
        const raw = sessionStorage.getItem(ENTITY_CACHE_PREFIX + qid);
        if (!raw) return null;
        const { t, e } = JSON.parse(raw);
        if (!t || Date.now() - t > ENTITY_CACHE_TTL_MS) return null;
        return e || null;
    } catch {
        return null;
    }
}

function writeEntityCache(qid, entity) {
    try {
        sessionStorage.setItem(ENTITY_CACHE_PREFIX + qid, JSON.stringify({ t: Date.now(), e: entity }));
    } catch {
        /* storage full or blocked — cache is best-effort */
    }
}

async function getEntityData(qids, language = "en") {
    const entities = {};
    if (!Array.isArray(qids) || qids.length === 0) return entities;

    // Serve from cache where possible; only query Wikidata for the misses.
    const misses = [];
    for (const qid of qids) {
        const cached = readEntityCache(qid);
        if (cached) entities[qid] = cached;
        else misses.push(qid);
    }
    if (!misses.length) return entities;

    const entityUrls = misses.map((qid) => `(wd:${qid})`);

    // NOTE: you used SAMPLE(label/description) but filtered to "en" hard-coded.
    // If you actually want `language`, adjust FILTER(LANG(...) = "...") accordingly.
    const lang = language || "en";

    const query = `
    SELECT
      ?item
      (SAMPLE(?label) AS ?label)
      (SAMPLE(?description) AS ?description)
      (GROUP_CONCAT(DISTINCT ?alias; separator=" | ") AS ?aliases)
      (SAMPLE(?image) AS ?image)
      (SAMPLE(?logoImage) AS ?logoImage)
      (SAMPLE(?coords) AS ?coords)
      (SAMPLE(?pageBanner) AS ?pageBanner)
      (SAMPLE(?whosOnFirst) AS ?whosOnFirst)
      (SAMPLE(?wikipedia) AS ?wikipedia)
    WHERE {
      VALUES (?item) { ${entityUrls.join(" ")} }

      OPTIONAL { ?item rdfs:label ?label . FILTER (LANG(?label) = "${lang}") }
      OPTIONAL { ?item schema:description ?description . FILTER (LANG(?description) = "${lang}") }
      OPTIONAL { ?item skos:altLabel ?alias . FILTER (LANG(?alias) = "${lang}") }

      OPTIONAL { ?item wdt:P625 ?coords . }
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P154 ?logoImage . }
      OPTIONAL { ?item wdt:P948 ?pageBanner . }
      OPTIONAL { ?item wdt:P6766 ?whosOnFirst . }

      OPTIONAL { ?wikipedia schema:about ?item; schema:isPartOf <https://${lang}.wikipedia.org/> . }
    }
    GROUP BY ?item
  `;

    let sparqlResp;
    try {
        // Wikidata endpoint sometimes prefers GET; POST is fine, but be ready for 429.
        sparqlResp = await fetchJson("https://query.wikidata.org/sparql", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/sparql-results+json"
            },
            body: `query=${encodeURIComponent(query)}`,
            timeoutMs: 20000
        });
    } catch (err) {
        console.error("Wikidata SPARQL error:", err);
        return entities;
    }

    // Prepare Wikipedia summary fetches (keep ordering stable)
    const summaryFetches = [];

    for (const rec of sparqlResp.results?.bindings || []) {
        const qid = rec.item?.value?.split("/").pop();
        if (!qid) continue;

        const e = { id: qid };

        if (rec.label?.value) e.label = rec.label.value;
        if (rec.description?.value) e.description = rec.description.value;

        // NOTE: your old code checked `rec.alias`, but the query returns `?aliases`
        if (rec.aliases?.value) {
            e.aliases = rec.aliases.value.split(" | ").map((s) => s.trim()).filter(Boolean);
        }

        if (rec.coords?.value) {
            // "Point(lon lat)" -> "lat,lon"
            e.coords = rec.coords.value.slice(6, -1).split(" ").reverse().join(",");
        }

        if (rec.wikipedia?.value) e.wikipedia = rec.wikipedia.value;
        if (rec.pageBanner?.value) e.pageBanner = rec.pageBanner.value;

        if (rec.image?.value) {
            e.image = rec.image.value;
            e.thumbnail = mwImage(rec.image.value, 330);
        }

        if (rec.logoImage?.value) {
            e.logoImage = rec.logoImage.value;
            if (!e.thumbnail) e.thumbnail = mwImage(rec.logoImage.value, 330);
        }

        if (rec.whosOnFirst?.value) e.geojson = whosOnFirstUrl(rec.whosOnFirst.value);

        // Wikipedia summary
        if (e.wikipedia) {
            // Normalize: /w/ -> /wiki/ then take title after /wiki/
            const title = e.wikipedia
                .replace(/\/w\//, "/wiki/")
                .split("/wiki/")
                .pop();

            if (title) {
                const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
                summaryFetches.push({ qid, summaryUrl });
            }
        }

        entities[qid] = e;
    }

    // Fetch summaries concurrently, but safely
    await Promise.all(
        summaryFetches.map(async ({ qid, summaryUrl }) => {
            try {
                const data = await fetchJson(summaryUrl, { timeoutMs: 12000 });
                const text = data.extract_html || data.extract;
                if (text && entities[qid]) entities[qid].summaryText = text;
            } catch (err) {
                // Non-fatal
                console.warn("Wikipedia summary fetch failed:", summaryUrl, err);
            }
        })
    );

    // Cache the freshly fetched entities for the rest of the session.
    for (const qid of misses) {
        if (entities[qid]) writeEntityCache(qid, entities[qid]);
    }

    return entities;
}

/**
 * Replace <a qid="Q..."> (or links with /Q... in URL path) with a Shoelace dropdown popup.
 * NOTE: this *replaces* the anchor, so you lose the original link semantics unless you
 * add them back explicitly in the card footer.
 */
async function makeEntityPopups({ root = document.body, language = "en" } = {}) {
    const anchors = Array.from(root.querySelectorAll("a"));
    const qids = new Set();

    for (const a of anchors) {
        const qid = extractQidFromAnchor(a);
        if (qid) qids.add(qid);
    }

    const entities = await getEntityData(Array.from(qids), language);

    for (const a of anchors) {
        const qid = extractQidFromAnchor(a);
        if (!qid) continue;

        const entity = entities[qid];
        if (!entity) continue;

        const dd = document.createElement("sl-dropdown");
        dd.className = "entity-popup";
        dd.setAttribute("placement", "top");
        dd.setAttribute("distance", "12");

        // Trigger: avoid innerHTML (use textContent)
        const trigger = document.createElement("span");
        trigger.setAttribute("slot", "trigger");
        trigger.textContent = a.textContent || entity.label || qid;
        dd.appendChild(trigger);

        const card = document.createElement("sl-card");
        card.setAttribute("hoist", "");

        if (entity.thumbnail) {
            const img = document.createElement("img");
            img.setAttribute("slot", "image");
            img.src = entity.thumbnail;
            img.alt = entity.label || qid;
            card.appendChild(img);
        }

        const content = document.createElement("div");
        content.className = "content";

        if (entity.label) {
            const heading = document.createElement("h2");
            heading.textContent = entity.label;
            content.appendChild(heading);
        }

        if (entity.description) {
            const description = document.createElement("p");
            description.className = "description";
            description.textContent = entity.description;
            content.appendChild(description);
        }

        if (entity.summaryText) {
            // Wikipedia returns HTML in extract_html; if you render that directly you’re trusting Wikipedia.
            // If you want to avoid HTML entirely, use extract (plain text) only.
            const summary = document.createElement("div");
            summary.className = "description";
            summary.innerHTML = entity.summaryText;
            content.appendChild(summary);
        }

        card.appendChild(content);

        const footer = document.createElement("div");
        footer.setAttribute("slot", "footer");

        if (entity.wikipedia) {
            const wikiLink = document.createElement("a");
            wikiLink.href = entity.wikipedia;
            wikiLink.target = "_blank";
            wikiLink.rel = "noopener noreferrer";
            wikiLink.textContent = "View on Wikipedia";
            footer.appendChild(wikiLink);
        }

        card.appendChild(footer);
        dd.appendChild(card);

        a.replaceWith(dd);
    }
}


/**
 * Two-column scrollytelling:
 * - Left column: article text steps
 * - Right column: "viewer" mirrors the most recent media element before the active paragraph
 *
 * Behavior:
 * - On entering a step paragraph, mark it active and update the viewer.
 * - Viewer content is cloned from the nearest preceding IFRAME or element with class "right".
 * - Viewer is positioned to the right of the article and sized to half the article width.
 */

const SELECTORS = {
    article: "article",
    header: "article > header",
    viewer: ".viewer",
    // Narrative "steps" may be direct children of .post-content or live inside
    // the <section> hierarchy built by restructureMarkdownToSections (which
    // now runs in both display modes).
    step: ".col2 .post-content > p:not(:has(>img)), .col2 .post-content section > p:not(:has(>img)), .col2 .post-content > blockquote, .col2 .post-content section > blockquote, .col2 .float-pair > p",
};

// Created lazily by init2col so pages that never enter two-column mode
// don't instantiate scrollama at all.
let scroller = null;
// Aborts all listeners added by init2col; recreated on each init.
let colAbort = null;
let colInitialized = false;

let els = {
    article: null,
    header: null,
    viewer: null,
};

// Cache last rendered "source" node so we don’t redraw unnecessarily
let lastSourceEl = null;

// rAF throttle for position updates
let rafPending = false;

function qs(sel, root = document) {
    return root.querySelector(sel);
}

function setActive(el) {
    const prior = qs(".active");
    if (prior) prior.classList.remove("active");
    el?.classList.add("active");
}

/**
 * Walk backward from a step paragraph to find the nearest content element
 * that should be mirrored into the right viewer.
 *
 * The walk is section-aware: when the siblings within the step's section
 * are exhausted, it climbs to the parent <section> and keeps walking, and
 * a preceding <section> is searched (deep) for its last viewer.
 */
const VIEWER_TAGS = ['IFRAME', 'SL-TAB-GROUP', 'FIGURE'];

function isViewerNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return (
        VIEWER_TAGS.includes(node.nodeName) ||
        (node.nodeName === 'P' && node.firstChild?.nodeName === 'IMG') ||
        (node.nodeName === 'P' && node.firstChild?.nodeName === 'A' && node.firstChild.firstChild?.nodeName === 'IMG') ||
        node.classList.contains('float-pair')
    );
}

function viewerFrom(node) {
    return node.classList.contains('float-pair')
        ? node.querySelector('iframe, img') || node
        : node;
}

/** Deep-search a container for its last mirrorable viewer element. */
function lastViewerWithin(el) {
    const list = el.querySelectorAll('iframe, sl-tab-group, figure, p > img');
    if (!list.length) return null;
    let last = list[list.length - 1];
    if (last.tagName === 'IMG') last = last.closest('p') || last;
    return last;
}

function findViewerSource(stepEl) {
    let node = stepEl?.previousElementSibling;
    if (node?.classList.contains('right') || node?.classList.contains('left')) return node;

    // A viewer declared immediately after the step pairs with it.
    node = stepEl?.nextElementSibling;
    while (node?.nodeName === 'HR') node = node.nextElementSibling;
    if (isViewerNode(node)) return viewerFrom(node);

    // Otherwise walk backward: siblings first, then climb out of sections.
    let scope = stepEl;
    while (scope) {
        node = scope.previousElementSibling;
        while (node?.nodeName === 'HR') node = node.previousElementSibling;
        while (node) {
            if (isViewerNode(node)) return viewerFrom(node);
            if (node.nodeName === 'SECTION') {
                const within = lastViewerWithin(node);
                if (within) return viewerFrom(within);
            }
            node = node.previousElementSibling;
        }
        const parent = scope.parentElement;
        scope = parent && parent.nodeName === 'SECTION' ? parent : null;
    }
}

/**`
 * Clone the source node into the viewer.
 * - Removes `.shimmer` class if present (avoids placeholder styles in clone).
 */
function renderViewerFrom(sourceEl) {
    if (!els.viewer || !sourceEl) return;

    // Avoid replacing if the source element is the same as last time.
    if (sourceEl === lastSourceEl) return;
    lastSourceEl = sourceEl;


    const clone = sourceEl.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('data-id', sourceEl.id);

    // Some nodes might not support querySelector; guard it.
    if (clone && clone.querySelector) {
        clone.querySelector(".shimmer")?.classList.remove("shimmer");
    }

    // In case original was hidden
    if (clone?.style) clone.style.display = "block";

    // Replace viewer content atomically
    els.viewer.replaceChildren(clone);
}

function updateViewerForStep(stepEl) {
    const source = findViewerSource(stepEl);
    if (!source) return;
    renderViewerFrom(source);
}

/**
 * Compute and apply viewer position and size.
 * Original behavior:
 * - viewer height = viewport minus header bottom (with small fudge)
 * - viewer width = half article width
 * - viewer right offset = distance from article right to window right
 */
function positionViewer() {
    if (!els.article || !els.header || !els.viewer) return;

    const articleRect = els.article.getBoundingClientRect();
    const headerRect = els.header.getBoundingClientRect();
    const viewerRect = els.viewer.getBoundingClientRect();

    // Height available below header (clamp to >= 0)
    const availableH = Math.max(0, window.innerHeight - viewerRect.top - 10);

    els.viewer.querySelectorAll("iframe").forEach((iframe) => {
        iframe.style.maxHeight = `${availableH - (iframe.parentElement.tagName === 'SL-TAB-PANEL' ? 50 : 0)}px`;
    });

    const viewerW = articleRect.width / 2;
    const rightOffset = Math.max(0, window.innerWidth - articleRect.right);

    els.viewer.style.height = `${availableH}px`;
    els.viewer.style.width = `${viewerW}px`;
    els.viewer.style.right = `${rightOffset}px`;
}

/**
 * Throttle position updates to animation frames (avoids layout thrash on scroll).
 */
function requestPositionUpdate() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        positionViewer();
    });
}

function handleStepEnter(response) {
    const stepEl = response?.element;
    if (!stepEl) return;

    setActive(stepEl);
    updateViewerForStep(stepEl);

    // Sometimes layout changes when viewer content changes; reposition.
    requestPositionUpdate();
}

function init2col() {
    if (colInitialized) return; // idempotent: repeated mode toggles must not stack observers

    els.article = qs(SELECTORS.article);
    els.header = qs(SELECTORS.header);
    els.viewer = qs(SELECTORS.viewer);

    if (!els.article || !els.header || !els.viewer) {
        // Fail quietly; this script may be used on pages without the 2-col layout.
        return;
    }
    colInitialized = true;

    // All listeners registered through one AbortController so teardown2col
    // can remove them wholesale.
    colAbort = new AbortController();
    const { signal } = colAbort;
    window.addEventListener("scroll", requestPositionUpdate, { passive: true, signal });
    window.addEventListener("resize", requestPositionUpdate, { signal });
    // If images/iframes load late and change layout, reposition.
    window.addEventListener("load", requestPositionUpdate, { signal });

    // Initial position (next frame is usually better than setTimeout)
    requestPositionUpdate();

    const firstStep = document.querySelector(SELECTORS.step);
    setActive(firstStep);
    updateViewerForStep(firstStep);

    scroller = scrollama();
    scroller
        .setup({
            step: SELECTORS.step,
            offset: 0.08,
            debug: false,
        })
        .onStepEnter(handleStepEnter);
}

/** Undo everything init2col set up, returning the page to flat-mode state. */
function teardown2col() {
    if (!colInitialized) return;
    colInitialized = false;

    colAbort?.abort();
    colAbort = null;

    try { scroller?.destroy(); } catch { /* scrollama throws if never set up */ }
    scroller = null;

    setActive(null);
    lastSourceEl = null;
    if (els.viewer) {
        els.viewer.replaceChildren();
        els.viewer.removeAttribute("style");
    }
    els = { article: null, header: null, viewer: null };
}

/* ---------------------------------------------
 * Display-mode controller (single source of truth)
 * ------------------------------------------- */

const MODE_STORAGE_KEY = "postViewMode";
let currentMode = null; // 'flat' | 'col2' once initEntreluma/setViewMode has run

function normalizeMode(value) {
    const v = String(value || "").toLowerCase();
    if (v === "col2" || v === "2col") return "col2";
    if (v === "flat" || v === "col1") return "flat";
    return null;
}

/**
 * Resolve the initial mode. Precedence: post front matter > the reader's
 * remembered choice (only when the toggle is enabled) > site default > flat.
 */
function resolveInitialMode({ pageMode, siteMode, modeToggle = true } = {}) {
    let saved = null;
    if (modeToggle) {
        try { saved = normalizeMode(localStorage.getItem(MODE_STORAGE_KEY)); } catch { /* storage blocked */ }
    }
    return normalizeMode(pageMode) || saved || normalizeMode(siteMode) || "flat";
}

/**
 * Switch the page between flat and two-column display. Idempotent; the only
 * place that toggles the col1/col2 classes, persists the reader's choice,
 * and initializes/tears down scrollytelling. Fires "entreluma:modechange"
 * on window so UI (e.g. the toolbar toggle icon) can follow along.
 */
function setViewMode(mode, { persist = true } = {}) {
    const wrapper = document.getElementById("main-wrapper");
    if (!wrapper) return;

    let effective = normalizeMode(mode) || "flat";
    if (isMobile) effective = "flat"; // no room for two columns
    if (effective === currentMode) return;
    currentMode = effective;

    const toCol2 = effective === "col2";
    wrapper.classList.toggle("col2", toCol2);
    wrapper.classList.toggle("col1", !toCol2);

    if (toCol2) init2col();
    else teardown2col();

    if (persist && !isMobile) {
        try { localStorage.setItem(MODE_STORAGE_KEY, toCol2 ? "col2" : "col1"); } catch { /* storage blocked */ }
    }

    window.dispatchEvent(new CustomEvent("entreluma:modechange", { detail: { mode: effective } }));
}

function getViewMode() {
    return currentMode;
}

/**
 * Page bootstrap: the one entry point layouts call. Builds the section
 * hierarchy (both display modes), applies the initial mode, and wires up
 * the interactive features.
 *
 * @param {object} cfg
 *   pageMode / siteMode  - entreluma.mode from front matter / _config.yml
 *   modeToggle           - whether the reader's toggle (and saved choice) applies
 *   autoFloat, groupEmbeds, wikidataInfoPopups - feature flags (default true)
 */
/**
 * Automatic attribution for Commons-hosted HEADER images. The image VIEWER
 * builds its caption from Commons extmetadata; this is the header's
 * equivalent — same source, same format:
 *   Source: Wikimedia Commons • © Artist — License
 * (the © segment only when the license requires attribution). Runs only
 * when the layout emitted no manual line (front matter image.attribution).
 */
async function headerAttribution(attempt = 0) {
  const img = document.querySelector('.preview-img img, img.preview-img');
  if (!img) return;
  const container = img.closest('div') || img.parentElement;
  if (!container || container.querySelector('.sk-header-attribution')) return;
  // Chirpy's LQIP/lazy pipeline may not have swapped the REAL src in yet at
  // init time (the placeholder is a data: URI) — read every known location
  // and, when none matches, retry after the image actually loads.
  const src = img.currentSrc || img.getAttribute('data-src') || img.src || '';
  const m = /upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^\/]+)/.exec(src);
  if (!m) {
    if (attempt >= 3) return;
    const retry = () => headerAttribution(attempt + 1);
    if (!img.complete) img.addEventListener('load', retry, { once: true });
    else setTimeout(retry, 800 * (attempt + 1));
    return;
  }
  let file;
  try { file = decodeURIComponent(m[1]); } catch { file = m[1]; }

  try {
    const resp = await fetch(
      'https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query' +
      '&titles=File:' + encodeURIComponent(file) + '&prop=imageinfo&iiprop=extmetadata');
    if (!resp.ok) return;
    const data = await resp.json();
    const pages = data && data.query && data.query.pages;
    const page = pages && Object.values(pages)[0];
    const info = page && page.imageinfo && page.imageinfo[0];
    const meta = {};
    for (const [k, v] of Object.entries((info && info.extmetadata) || {})) meta[k] = v && v.value;

    const stripHtml = (h) => {
      if (!h) return null;
      const d = document.createElement('div');
      d.innerHTML = h;
      const t = (d.textContent || '').replace(/\s+/g, ' ').trim();
      return t || null;
    };
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const commonsUrl = 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'));
    const parts = ['Source: <a href="' + esc(commonsUrl) + '" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>'];
    // Author + license ALWAYS shown for Commons headers (not only when the
    // license technically requires it) — credit is the norm, not the floor.
    {
      const artist = stripHtml(meta.Artist) || 'Unknown author';
      const license = stripHtml(meta.LicenseShortName) || stripHtml(meta.UsageTerms) || 'License';
      const licenseHtml = meta.LicenseUrl
        ? '<a href="' + esc(meta.LicenseUrl) + '" target="_blank" rel="license noopener noreferrer">' + esc(license) + '</a>'
        : esc(license);
      parts.push('\u00A9 ' + esc(artist) + ' \u2014 ' + licenseHtml);
    }

    // Auto-caption from the Commons image description when the author gave
    // no alt AT ALL. The DOM can't distinguish absent from empty (Chirpy's
    // "Preview Image" fallback + Liquid's default filter normalize both), so
    // post.html emits data-sk-alt with the front-matter truth: 'absent' →
    // auto-caption; 'empty' → the author's opt-out; alt text → figcaption
    // already rendered server-side.
    if (!container.querySelector('figcaption') && img.dataset.skAlt === 'absent') {
      const desc = stripHtml(meta.ImageDescription);
      if (desc) {
        const fig = document.createElement('figcaption');
        fig.className = 'text-center pt-2 pb-2';
        fig.textContent = desc;
        container.appendChild(fig);
      }
    }

    const el = document.createElement('small');
    el.className = 'sk-header-attribution text-center d-block';
    el.innerHTML = parts.join(' \u2022 ');
    container.appendChild(el);
  } catch { /* offline / API hiccup — attribution is best-effort */ }
}

function initEntreluma(cfg = {}) {
    // Trust messages from wherever this page's viewer components actually
    // load — same-origin normally, the deployed site when a local-dev
    // editor/preview renders this page.
    registerComponentOrigins();

    const contentEl = document.querySelector(".post-content");
    if (contentEl) {
        const restructured = restructureMarkdownToSections(contentEl);
        if (restructured) contentEl.replaceWith(restructured);
    }

    // Wire interactive features before entering a display mode so that
    // scrollytelling (if the initial mode is col2) sees the final DOM.
    if (cfg.wikidataInfoPopups !== false) makeEntityPopups();
    if (cfg.headerAttribution !== false) headerAttribution();
    if (cfg.groupEmbeds !== false) wrapAdjacentEmbedsAsTabs();
    addActionLinks();
    if (cfg.autoFloat !== false && !isMobile) autoFloat();

    setViewMode(resolveInitialMode(cfg), { persist: false });
}


/**
 * Restructure an HTML element (generated from Markdown) so that each heading
 * and its following content are wrapped in nested <section> elements according
 * to heading level. Runs in BOTH display modes (flat and two-column); the
 * scrollytelling selectors and viewer-source walk are section-aware.
 *
 * Behavior notes:
 * - Heading attributes (id/class/style, plus click/href/target used by some
 *   stories to make a whole section a link target) are MOVED from the heading
 *   to its generated <section>. Kramdown's auto-generated heading ids therefore
 *   become section ids, keeping anchors stable and linkable.
 * - Sections that end up without an id (e.g. from hashtag-only pseudo-heading
 *   paragraphs, which have no text for kramdown to slug) get a deterministic
 *   fallback id "sk-section-<n>", numbered in document order, so action links
 *   and navigation can always target them.
 * - Skipped heading levels are tolerated: an h4 directly after an h2 nests one
 *   level deeper (stack-based), it does not create empty intermediate sections.
 * - Repeated heading text is safe: kramdown deduplicates auto ids (-1, -2 …)
 *   before this code runs.
 * - A paragraph containing only "#"/"##"… becomes a pseudo-heading of that
 *   level; a paragraph containing only "^#"/"^##"… explicitly closes the
 *   current section at that level without starting a new one.
 *
 * @param {Element} contentEl - The HTML element rendered from Markdown.
 * @returns {Element} - A replacement element with the nested section tree.
 */
const restructureMarkdownToSections = (contentEl) => {
    // Create a container element to hold the content.
    const container = document.createElement(contentEl.tagName);

    if (contentEl.id) container.id = contentEl.id
    if (contentEl.className) container.className = contentEl.className
    if (contentEl.getAttribute('style')) container.setAttribute('style', contentEl.getAttribute('style'))
    container.innerHTML = contentEl.innerHTML;

    // Convert paragraphs with only hashtags into headings.
    Array.from(container.querySelectorAll('p'))
        .filter(p => /^#+\s*$/.test(p.textContent))
        .forEach(p => {
            let heading = document.createElement(`h${p.textContent.match(/^#+/)[0].length}`);
            // Transfer any id, class, and style attributes from the heading to the section.
            ['id', 'class', 'style'].forEach(attr => {
                if (p.hasAttribute(attr)) heading.setAttribute(attr, p.getAttribute(attr));
            });
            p.replaceWith(heading)
        })

    // Use a stack to keep track of the current section levels.
    // The stack starts with the container (level 0).
    const stack = [{ level: 0, element: container }];
    let sectionAutoId = 0;

    // Get a static list of the container’s children.
    const nodes = Array.from(container.childNodes);

    nodes.forEach(node => {
        // Check if the node is an element
        if (node.nodeType === Node.ELEMENT_NODE) {

            // Pop stack if the node is a closing section tag (e.g., ^#)
            if (/^\^#+\s*$/.test(node.textContent)) {
                let endOfSectionNumber = node.textContent.slice(1).trim().length
                node.style.display = 'none'
                while (stack.length > 0 && stack[stack.length - 1].level >= endOfSectionNumber) stack.pop();
            }

            // Check if heading (H1 - H6)
            if (/^H[1-6]$/.test(node.tagName)) {
                node.innerHTML = node.innerHTML.replace(/^\s+$/, '')
                // Determine the heading level (e.g., "H2" -> 2)
                const headingLevel = parseInt(node.tagName[1], 10);

                // Pop sections from the stack until we find one with a lower level.
                while (stack.length > 0 && stack[stack.length - 1].level >= headingLevel) {
                    stack.pop();
                }

                // Create a new section and move the heading into it.
                const section = document.createElement('section');

                // Transfer any id, class, and style attributes from the heading to the section.
                ['id', 'class', 'style', 'click', 'href', 'target'].forEach(attr => {
                    if (node.hasAttribute(attr)) {
                        section.setAttribute(attr, node.getAttribute(attr));
                        node.removeAttribute(attr);
                    }
                });
                section.classList.add(`section${headingLevel}`)

                // Guarantee a stable, targetable id even when the heading had
                // none (hashtag-only pseudo-headings).
                if (!section.id) section.id = `sk-section-${++sectionAutoId}`;

                // Add "Back to top" link to section heading
                // if (section.id) node.innerHTML = '<a href="#top" title="Back to top" style="font-size:80%; text-decoration: none;">⬆</a> ' + node.innerHTML

                // Move the heading into the new section.
                section.appendChild(node);

                // Append the new section to the element at the top of the stack.
                stack[stack.length - 1].element.appendChild(section);

                // Push the new section onto the stack with its heading level.
                stack.push({ level: headingLevel, element: section });

            } else {
                // For non-heading nodes, append them to the current (top of the stack) section.
                stack[stack.length - 1].element.appendChild(node);
            }
        }
    });
    if (!isMobile) {
        // container.querySelectorAll('section.wrap, iframe.left, iframe.right').forEach(el => {
        container.querySelectorAll('section.wrap').forEach(el => {
            let section = el.tagName === 'SECTION' ? el : el.closest('section');
            const heading = section.firstElementChild;
            if (!heading) return;

            // Find all direct children (paragraphs, blockquotes, iframes, lists, subsections, etc).
            // The :scope pseudo-class ensures we only select direct children of `section`.
            const children = section.querySelectorAll(':scope > *');

            if (children.length > 1) {
                // Get the very last candidate from the list.
                const lastElementToMove = children[children.length - 1];

                // Use the .after() method to move the last element to be
                // immediately after the heading. This is a clean, modern way to re-insert nodes.
                heading.after(lastElementToMove);
            }
        });
    }

    container.querySelector('hr.footnotes-sep')?.remove()
    let footnotes = container.querySelector('section.footnotes')
    if (footnotes) container.appendChild(footnotes)

    // return container.innerHTML;
    return container
}

/* ---------------------------------------------
 * Optional exports (if you import this elsewhere)
 * ------------------------------------------- */
export {
    isMobile,
    autoFloat,
    makeEntityPopups,
    wrapAdjacentEmbedsAsTabs,
    addActionLinks,
    init2col,
    restructureMarkdownToSections,
    initEntreluma,
    setViewMode,
    getViewMode,
};
