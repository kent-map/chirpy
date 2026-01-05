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

/* Reposition floated elements (.left, .right) to appear before the
   paragraph block they are intended to float alongside. This is to
   accommodate markdown that positions the floated element
   after the paragraph block in the HTML structure. */

const floats = Array.from(document.querySelectorAll('.left, .right')).reverse();

floats.forEach(floatedEl => {
    const parent = floatedEl.parentNode;
    if (!parent) return;

    let ref = floatedEl.previousElementSibling;

    // Walk backward over contiguous <p> elements
    while (ref && ref.tagName === 'P' && !ref.classList.contains('left') && !ref.classList.contains('right')) {
        ref = ref.previousElementSibling;
    }

    // ref is now:
    // - null (floated element should go first), or
    // - the element BEFORE the paragraph block
    const insertBeforeNode = ref
        ? ref.nextElementSibling
        : parent.firstElementChild;

    parent.insertBefore(floatedEl, insertBeforeNode);
})


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

// For cropping regular images
async function imageDataUrl(url, region, dest) {
    return new Promise((resolve) => {
        let { x, y, w, h } = region
        let { width, height } = dest

        let image = new Image()
        image.crossOrigin = 'anonymous'
        x = x ? x / 100 : 0
        y = y ? y / 100 : 0
        w = w ? w / 100 : 0
        h = h ? h / 100 : 0

        image.onload = () => {
            let sw = image.width
            let sh = image.height
            let swScaled = w > 0 ? sw * w : sw - (sw * x)
            let shScaled = h > 0 ? sh * h : sh - (sh * y)
            let ratio = swScaled / shScaled
            if (ratio > 1) height = width / ratio
            else width = height * ratio
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            canvas.width = width
            canvas.height = height
            x = x * sw
            y = y * sh
            ctx?.drawImage(image, x, y, swScaled, shScaled, 0, 0, width, height)
            let dataUrl = canvas.toDataURL()
            resolve(dataUrl)
        }
        image.src = url

    })
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
