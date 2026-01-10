import 'https://cdn.jsdelivr.net/npm/js-md5@0.8.3/src/md5.min.js'
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/button/button.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/card/card.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/carousel/carousel.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/carousel-item/carousel-item.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/copy-button/copy-button.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/dialog/dialog.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/dropdown/dropdown.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/tab/tab.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/tab-group/tab-group.js';
import 'https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace/cdn/components/tab-panel/tab-panel.js';

let isMobile = ('ontouchstart' in document.documentElement && /mobi/i.test(navigator.userAgent))

function wrapAdjacentEmbedsAsTabs({
    root = document.body,
    minRunLength = 2,
    wrapperClass = 'embed-tabs',

    // Font Awesome classes for each item type
    iconFor = (node) => {
        if (node.tagName === 'IFRAME') return 'fa-regular fa-map';
        if (node.tagName === 'P' && node.querySelector('img')) return 'fa-regular fa-image';
        return 'fa-solid fa-square';
    },

    // Accessible label + tooltip text for each item type
    labelFor = (node, idx) => {
        if (node.tagName === 'IFRAME') return `Map ${idx + 1}`;
        if (node.tagName === 'P' && node.querySelector('img')) return `Image ${idx + 1}`;
        return `Item ${idx + 1}`;
    }
} = {}) {
    const isIgnorableText = (n) =>
        n.nodeType === Node.TEXT_NODE && n.nodeValue.trim() === '';

    const isEmbedItem = (n) =>
        n instanceof Element &&
        (n.tagName === 'IFRAME' ||
            (n.tagName === 'P' && n.querySelector('img')));

    const nextNonIgnorableSibling = (node) => {
        let n = node.nextSibling;
        while (n && isIgnorableText(n)) n = n.nextSibling;
        return n;
    };

    let groupCounter = 0;

    // Process each parent container's direct children/siblings
    for (const parent of root.querySelectorAll('*')) {
        if (!parent.childNodes || parent.childNodes.length === 0) continue;

        let nodes = Array.from(parent.childNodes);
        let i = 0;

        while (i < nodes.length) {
            const start = nodes[i];

            if (!isEmbedItem(start)) {
                i++;
                continue;
            }

            // Build a run of adjacent embed-items, ignoring whitespace-only text nodes
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
                // Avoid double-wrapping
                if (run[0].closest(`sl-tab-group.${wrapperClass}`)) {
                    i++;
                    continue;
                }

                const tabGroup = document.createElement('sl-tab-group');
                tabGroup.classList.add(wrapperClass);
                tabGroup.classList.add('right');

                // Insert the tab group where the run starts
                parent.insertBefore(tabGroup, run[0]);

                run.forEach((node, idx) => {
                    const panelName = `embed-panel-${++groupCounter}`;
                    const label = labelFor(node, idx);

                    // Tab (icon-only)
                    const tab = document.createElement('sl-tab');
                    tab.slot = 'nav';
                    tab.panel = panelName;

                    // Accessibility + tooltip
                    tab.setAttribute('aria-label', label);
                    tab.title = label;

                    const icon = document.createElement('i');
                    icon.className = iconFor(node);
                    icon.setAttribute('aria-hidden', 'true');

                    tab.appendChild(icon);

                    // Panel
                    const panel = document.createElement('sl-tab-panel');
                    panel.name = panelName;

                    // Move the original node into the panel
                    panel.appendChild(node);

                    tabGroup.appendChild(tab);
                    tabGroup.appendChild(panel);
                });

                // Refresh snapshot after mutation and continue after inserted tab group
                nodes = Array.from(parent.childNodes);
                i = nodes.indexOf(tabGroup) + 1;
                continue;
            }

            i++;
        }
    }
}

// Usage
wrapAdjacentEmbedsAsTabs();

const repositionFloats = () => {
    /* Reposition floated elements (.left, .right) to appear before the
       paragraph block they are intended to float alongside, and wrap
       each float + its corresponding paragraph block in a container
       suitable for `display: flow-root` (or grid/flex later). */

    const floats = Array.from(document.querySelectorAll('.left, .right')).reverse();

    floats.forEach(floatedEl => {
        const parent = floatedEl.parentNode;
        if (!parent) return;

        // Find the contiguous preceding <p> block this float belongs to
        let p = floatedEl.previousElementSibling;

        // Collect paragraphs (closest first)
        const paras = [];
        while (p && p.tagName === 'P' && !p.classList.contains('left') && !p.classList.contains('right')) {
            p.classList.add('text');
            paras.push(p);
            // If you truly only want ONE paragraph, uncomment the next line:
            // break;
            p = p.previousElementSibling;
        }

        if (paras.length === 0) {
            // Nothing to pair with; just move float to start like before
            parent.insertBefore(floatedEl, parent.firstElementChild);
            return;
        }

        // We walked backwards; restore document order
        paras.reverse();

        // Anchor: insert wrapper where the paragraph block starts
        const anchor = paras[0];

        // Create wrapper for flow-root solution
        const wrapper = document.createElement('div');
        wrapper.className = 'media-pair';

        // Insert wrapper before the first paragraph, then move nodes into it
        parent.insertBefore(wrapper, anchor);

        // Put float first, then the paragraph(s)
        wrapper.appendChild(floatedEl);
        paras.forEach(pEl => wrapper.appendChild(pEl));
    });
};
if (!isMobile) {
    repositionFloats();
}

// setup action links to iframes (e.g., zoomto, flyto, play)
const addActionLinks = (rootEl) => {
    rootEl.querySelectorAll('iframe').forEach(iframe => {
        if (!iframe.id) return
        rootEl.querySelectorAll('a').forEach(a => {
            let href = a.href || a.getAttribute('data-href')
            let target, action, args, text
            let actionAttribute = Array.from(a.attributes).filter(attr => !['href', 'class', 'id', 'label', 'target'].includes(attr.name)).pop()
            if (actionAttribute) {
                action = actionAttribute.name;
                [target, ...args] = actionAttribute.value.split('/').filter(p => p)
                if (iframe.id !== target) return
            } else {
                let path = href?.split('/').slice(3).filter(p => p !== '#' && p !== '')
                const targetIdx = path?.findIndex(p => p == iframe.id);
                if (targetIdx < 0) return
                [target, action, ...args] = path.slice(targetIdx).slice('/')
            }
            if (isStatic) {
                a.removeAttribute('href')
                a.style.color = 'inherit'
            } else {
                if (a.href) {
                    a.setAttribute('data-href', href)
                    a.classList.add('trigger')
                    a.removeAttribute('href')
                    a.style.cursor = 'pointer'
                    a.addEventListener('click', () => {
                        console.log(action, text, args);
                        let msg = { event: 'action', action, text, args }
                        document.getElementById(iframe.id)?.contentWindow.postMessage(JSON.stringify(msg), '*')
                    })
                }
            }
        })
    })
}

// addActionLinks();


////////// Start Wikidata Entity functions //////////

async function getEntityData(qids, language) {
    language = language || 'en'
    let entities = {}
    let summaryUrls = {}
    let entityUrls = qids.map(qid => `(wd:${qid})`)
    let query = `
    SELECT ?item (SAMPLE(?label) AS ?label) (SAMPLE(?description) AS ?description) (GROUP_CONCAT(?alias; separator=" | ") AS ?aliases) 
        (SAMPLE(?image) AS ?image) (SAMPLE(?logoImage) AS ?logoImage) 
        (SAMPLE(?coords) AS ?coords) (SAMPLE(?pageBanner) AS ?pageBanner)
        (SAMPLE(?whosOnFirst) AS ?whosOnFirst) (SAMPLE(?wikipedia) AS ?wikipedia)
    WHERE {
      VALUES (?item) { ${entityUrls.join(' ')} }

      # BIND(NOW() AS ?timestamp)  # Forces fresh evaluation

      OPTIONAL { ?item rdfs:label ?label . FILTER (LANG(?label) = "en") }
      OPTIONAL { ?item schema:description ?description . FILTER (LANG(?description) = "en") }
      OPTIONAL { ?item skos:altLabel ?alias . FILTER (LANG(?alias) = "en") }
      OPTIONAL { ?item wdt:P625 ?coords . }
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P154 ?logoImage . }
      OPTIONAL { ?item wdt:P948 ?pageBanner . }
      OPTIONAL { ?item wdt:P6766 ?whosOnFirst . }
      OPTIONAL { ?wikipedia schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> . }
    }
    GROUP BY ?item
    `
    let resp = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/sparql-results+json'
        },
        body: `query=${encodeURIComponent(query)}`
    })
    if (resp.ok) {
        let sparqlResp = await resp.json()
        sparqlResp.results.bindings.forEach(rec => {
            let qid = rec.item.value.split('/').pop()
            let _entityData = { id: qid }
            if (rec.description) _entityData.description = rec.description.value
            if (rec.alias) _entityData.aliases = [rec.alias.value]
            if (rec.coords) _entityData.coords = rec.coords.value.slice(6, -1).split(' ').reverse().join(',')
            if (rec.wikipedia) _entityData.wikipedia = rec.wikipedia.value
            if (rec.pageBanner) _entityData.pageBanner = rec.pageBanner.value
            if (rec.image) {
                _entityData.image = rec.image.value
                _entityData.thumbnail = mwImage(rec.image.value, 300)
            }
            if (rec.logoImage) {
                _entityData.logoImage = rec.logoImage.value
                if (!_entityData.thumbnail) _entityData.thumbnail = mwImage(rec.logoImage.value, 300)
            }
            if (rec.whosOnFirst) _entityData.geojson = whosOnFirstUrl(rec.whosOnFirst.value)

            if (_entityData.wikipedia) {
                let page = _entityData.wikipedia.replace(/\/w\//, '/wiki').split('/wiki/').pop()
                summaryUrls[`https://${language}.wikipedia.org/api/rest_v1/page/summary/${page}`] = qid
            }
            entities[qid] = _entityData
        })
        await Promise.all(Object.keys(summaryUrls).map(url => fetch(url)))
            .then(responses => { return Promise.all(responses.map(resp => resp.json())) })
            .then(data => {
                data.forEach((data, idx) => {
                    let qid = summaryUrls[Object.keys(summaryUrls)[idx]]
                    if (data.extract_html) entities[qid].summaryText = data.extract_html
                    else if (data.extract) entities[qid].summaryText = data.extract
                })
            })
            .catch(err => console.error('Error fetching summaries:', err))
    }

    return entities
}

function mwImage(mwImg, width) {
    width = width || 0
    // Converts Wikimedia commons image URL to a thumbnail link
    mwImg = mwImg.replace(/^wc:/, '').replace(/Special:FilePath\//, 'File:').split('File:').pop()
    mwImg = decodeURIComponent(mwImg).replace(/ /g, '_')
    const _md5 = md5(mwImg)
    const extension = mwImg.split('.').pop()
    let url = `https://upload.wikimedia.org/wikipedia/commons${width ? '/thumb' : ''}`
    url += `/${_md5.slice(0, 1)}/${_md5.slice(0, 2)}/${mwImg}`
    if (width > 0) {
        url += `/${width}px-${mwImg}`
        if (extension === 'svg') {
            url += '.png'
        } else if (extension === 'tif' || extension === 'tiff') {
            url += '.jpg'
        }
    }
    return url
}

// Creates a GeoJSON file URL from a Who's on First ID 
function whosOnFirstUrl(wof) {
    let wofParts = []
    for (let i = 0; i < wof.length; i += 3) {
        wofParts.push(wof.slice(i, i + 3))
    }
    return `https://data.whosonfirst.org/${wofParts.join('/')}/${wof}.geojson`
}

const makeEntityPopups = async () => {
    let qids = new Set()
    Array.from(document.body.querySelectorAll('a')).forEach(async a => {
        let qid = a.getAttribute('qid')
        if (!qid) {
            let path = a.href?.split('/').slice(3).filter(p => p !== '#' && p !== '')
            qid = path?.find(p => /Q\d+$/.test(p))?.split('#').pop()
        }
        if (qid) qids.add(qid)
    })
    let entities = await getEntityData(Array.from(qids), 'en')
    Array.from(document.body.querySelectorAll('a')).forEach(async a => {
        let qid = a.getAttribute('qid')
        if (!qid) {
            let path = a.href?.split('/').slice(3).filter(p => p !== '#' && p !== '')
            qid = path?.find(p => /Q\d+$/.test(p))?.split('#').pop()
        }
        let entity = entities[qid]
        if (!entity) return
        let dd = document.createElement('sl-dropdown')
        dd.className = 'entity-popup'
        dd.setAttribute('placement', 'top')
        dd.setAttribute('distance', '12')

        let trigger = document.createElement('div')
        trigger.setAttribute('slot', 'trigger')
        trigger.innerHTML = a.textContent
        dd.appendChild(trigger)

        let card = document.createElement('sl-card')
        card.setAttribute('hoist', '')
        if (entity.thumbnail) {
            let img = document.createElement('img')
            img.setAttribute('slot', 'image')
            img.src = entity.thumbnail
            img.setAttribute('alt', entity.label)
            card.appendChild(img)
        }
        let content = document.createElement('div')
        content.className = 'content'
        if (entity.label) {
            let heading = document.createElement('h2')
            heading.textContent = entity.label
            content.appendChild(heading)
        }
        if (entity.description) {
            let description = document.createElement('p')
            description.className = 'description'
            description.innerHTML = entity.description
            content.appendChild(description)
        }
        if (entity.summaryText) {
            let summaryText = document.createElement('div')
            summaryText.className = 'description'
            summaryText.innerHTML = entity.summaryText
            content.appendChild(summaryText)
        }
        card.appendChild(content)
        let footer = document.createElement('div')
        footer.setAttribute('slot', 'footer')
        if (entity.wikipedia)
            footer.innerHTML = `<a href="${entity.wikipedia}" target="_blank">View on Wikipedia</a>`
        card.appendChild(footer)
        dd.appendChild(card)

        a.replaceWith(dd)

    })
}

makeEntityPopups();

////////// End Wikidata Entity functions //////////

// export { repositionFloats, makeEntityPopups };
