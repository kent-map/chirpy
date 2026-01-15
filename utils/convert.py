#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Juncture Essay Converter
========================
Converts Juncture V1 essays (markdown with custom <param> tags) to Jekyll/Chirpy format.

Main conversions:
- Custom <param> tags → Jekyll includes/standard markdown
- Entity references → Wikidata links
- Image/map/video viewers → Jekyll includes
- AI-generated metadata (description and tags)
"""

import os
import json
import argparse
import pathlib
import re
import shlex
import hashlib
import traceback
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from urllib.parse import unquote, quote
from io import BytesIO

import requests
import shelve
from PIL import Image
import markdown
from bs4 import BeautifulSoup
from openai import OpenAI

allmaps_fragment = ''

# ============================================================================
# Configuration & Constants
# ============================================================================

# OpenAI client for metadata generation
client = OpenAI()
MODEL = "gpt-5.2"
PROMPT_VERSION = "v3-controlled-vocab-labels"

# Cache paths
CACHE_PATH = Path('.image_aspect_cache')
ALIASES_CACHE_PATH = Path('.entity_names_cache')

# Tag vocabulary - defines allowed tags and their scope
TAG_VOCABULARY = {
    "tag_vocabulary": {
        "version": "1.0",
        "size": 25,
        "rules_of_thumb": {
            "target_tags_per_article": {"min": 3, "max": 5},
            "suggested_mix": [
                "1 core theme tag",
                "1 landscape/place tag",
                "1 framing/method tag",
                "optional: Time periods when periodization is central",
                "optional: Methods & digital for tooling/method essays"
            ]
        },
        "tags": [
            {"tag": "literary-places", "label": "Literary places",
             "scope_note": "Texts/authors/readers connected to Kent locations; settings, inspirations, literary tourism, walking trails."},
            {"tag": "authors-and-lives", "label": "Authors & lives",
             "scope_note": "Biographical focus on writers/artists/public figures; networks, relationships, careers."},
            {"tag": "texts-and-genres", "label": "Texts & genres",
             "scope_note": "Works and genres (novels, poetry, periodicals, crime, children's literature, travel writing); publication forms."},
            {"tag": "culture-and-society", "label": "Culture & society",
             "scope_note": "Everyday life, class, leisure, popular culture, institutions, civic life, manners."},
            {"tag": "politics-and-reform", "label": "Politics & reform",
             "scope_note": "Suffrage, law, policy, protest movements, governance, civic disputes, social reform."},
            {"tag": "conflict-and-war", "label": "Conflict & war",
             "scope_note": "Military history and wartime life including home front, raids, defenses, memorials."},
            {"tag": "faith-and-belief", "label": "Faith & belief",
             "scope_note": "Religious institutions and practices; dissent, missions, church culture, belief and debate."},
            {"tag": "crime-and-punishment", "label": "Crime & punishment",
             "scope_note": "Prisons, policing, trials, penal policy, carceral institutions, notable cases."},
            {"tag": "work-and-industry", "label": "Work & industry",
             "scope_note": "Dockyards, coal, rail, trades, labor history, economic change, infrastructure as work."},
            {"tag": "science-and-ideas", "label": "Science & ideas",
             "scope_note": "Scientific lives and knowledge networks; medicine, technology, intellectual history."},
            {"tag": "coast-and-sea", "label": "Coast & sea",
             "scope_note": "Seaside towns, maritime travel, wrecks, coastal identity, sea-bathing culture."},
            {"tag": "rivers-and-marshes", "label": "Rivers & marshes",
             "scope_note": "Rivers/estuaries, Romney Marsh, drainage, wetlands, floods and water management."},
            {"tag": "countryside-and-farming", "label": "Countryside & farming",
             "scope_note": "Orchards, hop growing/picking, rural labor, horticulture, land use, agrarian change."},
            {"tag": "nature-and-environment", "label": "Nature & environment",
             "scope_note": "Ecology, wildlife, geology, weather/extreme weather, conservation, environmental change."},
            {"tag": "towns-and-cities", "label": "Towns & cities",
             "scope_note": "Urban change, development, civic institutions, streetscapes, tourism economies."},
            {"tag": "travel-and-mobility", "label": "Travel & mobility",
             "scope_note": "Routes and movement: rail, roads, ferries, coaching, guidebooks, walking, touring."},
            {"tag": "buildings-and-architecture", "label": "Buildings & architecture",
             "scope_note": "Churches, castles, houses, civic buildings; architectural styles, restoration, reuse."},
            {"tag": "heritage-and-memory", "label": "Heritage & memory",
             "scope_note": "Museums, preservation, commemoration, heritage debates, public memory."},
            {"tag": "maps-and-place-making", "label": "Maps & place-making",
             "scope_note": "Mapping/carto­graphy; spatial storytelling; reading landscapes; geographic method."},
            {"tag": "representation-and-interpretation", "label": "Representation & interpretation",
             "scope_note": "Conflicting perspectives, gaps in the record, contested narratives, historiography."},
            {"tag": "identity-and-community", "label": "Identity & community",
             "scope_note": "Belonging, migration, race, gender, local identity, community histories."},
            {"tag": "material-culture", "label": "Material culture",
             "scope_note": "Objects/artifacts, collections, print as material, visual/aural sources, embodied evidence."},
            {"tag": "arts-and-performance", "label": "Arts & performance",
             "scope_note": "Visual art, music, theatre, festivals, performance culture, creative production."},
            {"tag": "time-periods", "label": "Time periods",
             "scope_note": "Use when periodization is central to the essay (store specific era/range in separate metadata)."},
            {"tag": "methods-and-digital", "label": "Methods & digital",
             "scope_note": "Digital humanities, archival practice, project method, interactive/technical notes about the site."}
        ]
    }
}

# Extract tag lookup and constraints
TAG_LOOKUP = {t["tag"]: t["label"] for t in TAG_VOCABULARY["tag_vocabulary"]["tags"]}
ALLOWED_TAGS = list(TAG_LOOKUP.keys())
VOCAB_VERSION = TAG_VOCABULARY["tag_vocabulary"]["version"]
MIN_TAGS = TAG_VOCABULARY["tag_vocabulary"]["rules_of_thumb"]["target_tags_per_article"]["min"]
MAX_TAGS = TAG_VOCABULARY["tag_vocabulary"]["rules_of_thumb"]["target_tags_per_article"]["max"]

# JSON schema for OpenAI structured output
SCHEMA_OBJ = {
    "type": "object",
    "properties": {
        "description": {"type": "string"},
        "tags": {
            "type": "array",
            "items": {"type": "string", "enum": ALLOWED_TAGS},
            "minItems": MIN_TAGS,
            "maxItems": MAX_TAGS,
        },
    },
    "required": ["description", "tags"],
    "additionalProperties": False,
}

# Regex patterns for cleaning
RE_REMOVE = re.compile(
    r'''
    <a\b[^>]*>\s*<img\b[^>]*\bve-button\b[^>]*>\s*</a>  # Remove button links
    |
    <param\b[^>]*\bve-config\b[^>]*>                     # Remove config params
    |
    ^\s*(?:<br\s*/?>\s*)+\s*$                            # Remove standalone <br> tags
    ''',
    re.IGNORECASE | re.VERBOSE | re.MULTILINE | re.DOTALL
)

RE_COLLAPSE_BLANK_LINES = re.compile(r'\n\s*\n+', re.MULTILINE)
RE_ADD_BLANK_AFTER_HEADING = re.compile(r'^(#{1,6}\s+.+)\n(?!\s*\n)', re.MULTILINE)
RE_EMPTY_HEADINGS = re.compile(r'^\s*#{1,6}\s*$', re.MULTILINE)


# ============================================================================
# AI Metadata Generation
# ============================================================================

def _dedupe_preserve_order(items: List[str]) -> List[str]:
    """Remove duplicates while preserving order."""
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _normalize_and_convert_tags(slug_tags: List[str]) -> List[str]:
    """
    Normalize tag slugs and convert to display labels.
    
    Args:
        slug_tags: List of tag slugs from AI model
        
    Returns:
        List of display labels for valid tags
        
    Raises:
        ValueError: If too few valid tags after filtering
    """
    # Clean and dedupe
    slug_tags = [t.strip() for t in slug_tags if isinstance(t, str) and t.strip()]
    slug_tags = _dedupe_preserve_order(slug_tags)
    
    # Filter to allowed tags only
    slug_tags = [t for t in slug_tags if t in TAG_LOOKUP]

    # Validate count
    if len(slug_tags) < MIN_TAGS:
        raise ValueError(f"Too few valid tags after filtering: {slug_tags}")
    if len(slug_tags) > MAX_TAGS:
        slug_tags = slug_tags[:MAX_TAGS]

    # Convert slugs to labels
    return [TAG_LOOKUP[t] for t in slug_tags]


def _format_tag_vocab_for_prompt() -> str:
    """Format tag vocabulary for inclusion in AI prompt."""
    lines = []
    for t in TAG_VOCABULARY["tag_vocabulary"]["tags"]:
        lines.append(f"- {t['tag']}: {t['scope_note']}")
    return "\n".join(lines)


def _cache_key(markdown_text: str, title: str) -> str:
    """
    Generate a stable cache key for AI metadata requests.
    
    Only includes inputs that affect the output (model, prompt version, content).
    """
    h = hashlib.sha256()
    h.update(MODEL.encode("utf-8"))
    h.update(b"\0")
    h.update(PROMPT_VERSION.encode("utf-8"))
    h.update(b"\0")
    h.update(VOCAB_VERSION.encode("utf-8"))
    h.update(b"\0")
    h.update((title or "").encode("utf-8"))
    h.update(b"\0")
    h.update(markdown_text.encode("utf-8"))
    return h.hexdigest()


def _call_openai(markdown_text: str, title: str) -> Dict[str, Any]:
    """
    Call OpenAI API to generate description and tags.
    
    Returns dict with 'description' (str) and 'tags' (list of display labels).
    """
    rules = TAG_VOCABULARY["tag_vocabulary"]["rules_of_thumb"]
    suggested_mix = rules["suggested_mix"]

    prompt = f"""Generate metadata for an essay.

RULES (strict):
- description: exactly 2 or 3 sentences, plain English, no quotes
- tags:
  - choose ONLY from the controlled vocabulary below
  - select {MIN_TAGS}–{MAX_TAGS} DISTINCT tags (no duplicates)
  - use tag identifiers exactly as written (e.g. "literary-places")
  - do NOT invent new tags
- Return only JSON matching the schema.

Suggested mix:
{chr(10).join("- " + s for s in suggested_mix)}

Controlled tag vocabulary:
{_format_tag_vocab_for_prompt()}

Title: {title}

Essay (markdown):
{markdown_text}
"""

    resp = client.responses.create(
        model=MODEL,
        input=prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": "essay_metadata",
                "strict": True,
                "schema": SCHEMA_OBJ,
            }
        },
    )

    raw = json.loads(resp.output_text)
    return {
        "description": raw["description"].strip(),
        "tags": _normalize_and_convert_tags(raw["tags"]),
    }


def generate_description_and_tags(
    markdown_text: str,
    title: str = "",
    cache_path: str = "essay_meta_cache.shelve",
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Generate description and tags for an essay using AI.
    
    Results are cached to avoid redundant API calls.
    
    Args:
        markdown_text: Essay content in markdown
        title: Essay title
        cache_path: Path to cache database
        force_refresh: If True, ignore cache and regenerate
        
    Returns:
        Dict with 'description' and 'tags' keys
    """
    key = _cache_key(markdown_text, title)
    cache_path = os.path.abspath(cache_path)

    with shelve.open(cache_path) as db:
        if not force_refresh and key in db:
            return db[key]

        # Retry logic for transient errors
        last_err = None
        for attempt in range(3):
            try:
                data = _call_openai(markdown_text, title)
                db[key] = data
                return data
            except Exception as e:
                last_err = e
                time.sleep(1.5 * (attempt + 1))
        raise last_err


# ============================================================================
# Image Processing
# ============================================================================

def wc_title_to_url(title: str, width: int = 100) -> str:
    """
    Convert Wikimedia Commons title to direct image URL.
    
    Args:
        title: Wikimedia Commons file title
        width: Desired image width in pixels
        
    Returns:
        Direct URL to the image
    """
    title = unquote(title).replace(' ', '_')
    md5 = hashlib.md5(title.encode('utf-8')).hexdigest()
    ext = title.split('.')[-1]
    baseurl = 'https://upload.wikimedia.org/wikipedia/commons/'
    
    if ext == 'svg':
        url = f'{baseurl}thumb/{md5[:1]}/{md5[:2]}/{quote(title)}/{width}px-{quote(title)}.png'
    elif ext in ('tif', 'tiff'):
        url = f'{baseurl}thumb/{md5[:1]}/{md5[:2]}/{quote(title)}/{width}px-{quote(title)}.jpg'
    else:
        url = f'{baseurl}thumb/{md5[:1]}/{md5[:2]}/{quote(title)}/{width}px-{quote(title)}' if width else f'{baseurl}{md5[:1]}/{md5[:2]}/{quote(title)}'
    
    return url


API = "https://commons.wikimedia.org/w/api.php"

HEADERS = {
    "User-Agent": "Juncture/-Chirpy/1.0 python-requests"
}

def _commons_title_from_url(url: str) -> str | None:
    """
    Extract 'File:...' title from a Wikimedia Commons image URL.
    Handles original and /thumb/ URLs.
    """
    if "upload.wikimedia.org" not in url:
        return None

    # Normalize thumb URLs to original path
    if "/thumb/" in url:
        url = url.replace("/thumb/", "/").rsplit("/", 1)[0]

    filename = unquote(url.rsplit("/", 1)[-1])
    return f"File:{filename}"


def _get_commons_dimensions(file_title: str, timeout: int) -> tuple[int, int]:
    params = {
        "action": "query",
        "format": "json",
        "titles": file_title,
        "prop": "imageinfo",
        "iiprop": "size",
    }

    r = requests.get(API, params=params, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    data = r.json()

    page = next(iter(data["query"]["pages"].values()))
    info = page["imageinfo"][0]
    return int(info["width"]), int(info["height"])


def get_image_aspect_ratio(url: str, timeout: int = 10, refresh: bool = False) -> float:
    """
    Calculate image aspect ratio (width / height).

    - Uses Wikimedia Commons API for Commons images (no image download).
    - Results are cached.
    - Returns 1.0 on error.
    """
    try:
        # Handle wc:File:... shortcut
        if url.startswith("wc:"):
            file_title = url.replace("wc:", "", 1)
        else:
            file_title = _commons_title_from_url(url)

        cache_key = file_title or url

        with shelve.open(str(CACHE_PATH)) as cache:
            if cache_key in cache and not refresh:
                return cache[cache_key]

            if file_title:
                # Wikimedia Commons path (preferred)
                width, height = _get_commons_dimensions(file_title, timeout)
            else:
                # Non-Wikimedia fallback: download image (rare path)
                resp = requests.get(url, timeout=timeout, headers=HEADERS)
                resp.raise_for_status()
                img = Image.open(BytesIO(resp.content))
                width, height = img.size

            if width <= 0 or height <= 0:
                raise ValueError("Invalid image dimensions")

            ratio = round(width / height, 3)
            cache[cache_key] = ratio
            return ratio

    except Exception as e:
        print(f"Error computing aspect ratio for {url}: {e}")
        return 1.0

# ============================================================================
# Wikidata Entity Handling
# ============================================================================

def get_entity_names(text: str, shelve_path: Path) -> None:
    """
    Extract entity IDs from <param ve-entity> tags and fetch their names from Wikidata.
    
    Caches results to avoid redundant SPARQL queries.
    
    Args:
        text: Markdown text containing ve-entity tags
        shelve_path: Path to entity names cache
    """
    eids = set()
    from_tag = {}
    
    # Find all <param ve-entity ...> tags
    tag_pattern = re.compile(r'<param\s+ve-entity\b[^>]*>', re.IGNORECASE)
    eid_pattern = re.compile(r'\beid="([^"]+)"')
    aliases_pattern = re.compile(r'\baliases="([^"]+)"')

    for tag_match in tag_pattern.finditer(text):
        tag = tag_match.group(0)

        eid_match = eid_pattern.search(tag)
        if not eid_match:
            continue

        eid = eid_match.group(1)
        eids.add(eid)

        # Extract aliases from tag
        aliases_match = aliases_pattern.search(tag)
        aliases = (
            [a.strip() for a in aliases_match.group(1).split("|") if a.strip()]
            if aliases_match
            else []
        )

        if eid in from_tag:
            from_tag[eid].extend(aliases)
            from_tag[eid] = list(set(from_tag[eid]))  # Deduplicate

    # Query Wikidata for entities not in cache
    with shelve.open(str(shelve_path)) as cache:
        to_get = [eid for eid in eids if eid not in cache]

        if to_get:
            # SPARQL query to get labels and aliases
            sparql = '''
                SELECT ?item (SAMPLE(?label) AS ?label) (GROUP_CONCAT(?alias; separator=" | ") AS ?aliases) 
                WHERE {
                  VALUES (?item) { %s }
                  OPTIONAL { ?item rdfs:label ?label . FILTER (LANG(?label) = "en") }
                  OPTIONAL { ?item skos:altLabel ?alias . FILTER (LANG(?alias) = "en") }
                }
                GROUP BY ?item
            ''' % ('(wd:' + ') (wd:'.join(to_get) + ')')

            try:
                resp = requests.post(
                    'https://query.wikidata.org/sparql',
                    headers={
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/sparql-results+json',
                        'User-Agent': 'Mozilla/5.0'
                    },
                    data={'query': sparql},
                    timeout=30
                )
                
                if resp.status_code != 200:
                    print(f'Wikidata SPARQL query failed: {resp.status_code} {resp.text}')
                    return
                
                # Parse results and cache
                for rec in resp.json()['results']['bindings']:
                    qid = rec.get('item', {}).get('value', '').split('/')[-1]
                    label = rec.get('label', {}).get('value', '')
                    wikidata_aliases = [
                        name.strip() 
                        for name in rec.get('aliases', {}).get('value', '').split(' | ') 
                        if name.strip()
                    ]
                    
                    # Combine tag aliases, label, and Wikidata aliases
                    entity_names = from_tag.get(qid, []) + [label] + wikidata_aliases
                    cache[qid] = entity_names
                    
            except Exception as e:
                print(f'Error querying Wikidata: {e}')


# ============================================================================
# Markdown Conversion Functions
# ============================================================================

def convert_entity_infoboxes(md: str) -> str:
    """
    Convert entity span tags to markdown links.
    
    Before: <span eid="Q12345">_text_</span>
    After: _[text](Q12345)_
    """
    # Handle emphasized text
    regex = re.compile(r'<span\s+e?id="(Q\d+)"\s*>[_*](.+?)[_*]</span>', re.DOTALL)
    md = regex.sub(r'_[\2](\1)_', md)
    
    # Handle regular text
    regex = re.compile(r'<span\s+e?id="(Q\d+)"\s*>(.+?)</span>', re.DOTALL)
    return regex.sub(r'[\2](\1)', md)


def convert_zoomto_links(md: str, image_id: str = 'image-id') -> str:
    """
    Convert zoom-to span tags to markdown links.
    
    Before: <span data-click-image-zoomto="x,y,w,h">text</span>
    After: [text](image-id/zoomto/x,y,w,h)
    """
    SPAN_ZOOMTO_RE = re.compile(
        r'<span\b[^>]*\bdata-(?:click|mouseover)-image-zoomto="'
        r'\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)'
        r'\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)"\s*[^>]*>'
        r'(.*?)</span>',
        re.DOTALL
    )

    def _replace(match):
        x, y, w, h, text = match.groups()
        region = f"{x},{y},{w},{h}"
        return f"[{text}]({image_id}/zoomto/{region})"

    return SPAN_ZOOMTO_RE.sub(_replace, md)


def convert_flyto_links(md: str, map_id: str = 'map-id') -> str:
    """
    Convert fly-to span tags to markdown links.
    
    Before: <span data-click-map-flyto="lat,lon,zoom">text</span>
    After: [text](map-id/flyto/lat,lon,zoom)
    """
    SPAN_FLYTO_RE = re.compile(
        r'<span\b[^>]*\bdata-(?:click|mouseover)-map-flyto="'
        r'\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)"\s*[^>]*>'
        r'(.*?)</span>',
        re.DOTALL
    )

    def _replace(m):
        lat, lon, zoom, text = m.groups()
        coords = f"{lat},{lon},{zoom}"
        return f"[{text}]({map_id}/flyto/{coords})"

    return SPAN_FLYTO_RE.sub(_replace, md)


def convert_ve_entity_tags(md: str) -> str:
    """
    Convert <param ve-entity> tags by linking first occurrence of entity names.
    
    This function:
    1. Fetches entity names from Wikidata (cached)
    2. Finds first safe occurrence of each entity name in subsequent paragraphs
    3. Links that occurrence to the entity ID
    4. Removes the param tags
    """
    # Fetch entity names first
    get_entity_names(md, shelve_path=ALIASES_CACHE_PATH)
    
    PARAM_TAG_RE = re.compile(r'<param\s+ve-entity\b[^>]*>', re.IGNORECASE)
    EID_RE = re.compile(r'\beid="([^"]+)"', re.IGNORECASE)

    # Patterns for contexts where we shouldn't link
    MD_LINK_RE = re.compile(r'\[[^\]]*\]\([^)]+\)')
    INLINE_CODE_RE = re.compile(r'`[^`]*`')
    HTML_TAG_RE = re.compile(r'<[^>]+>')
    FENCE_RE = re.compile(r'^\s*(```|~~~)')

    def _ranges(regex: re.Pattern, s: str) -> List[Tuple[int, int]]:
        """Get all match ranges for a pattern."""
        return [(m.start(), m.end()) for m in regex.finditer(s)]

    def _in_any_range(pos: int, ranges: List[Tuple[int, int]]) -> bool:
        """Check if position is within any range."""
        return any(a <= pos < b for a, b in ranges)

    def _compile_name_pattern(names: List[str]) -> Optional[re.Pattern]:
        """Compile regex pattern for entity names with word boundaries."""
        names = [n for n in names if isinstance(n, str) and n.strip()]
        if not names:
            return None

        def wrap(n: str) -> str:
            """Add word boundaries if name starts/ends with word char."""
            esc = re.escape(n)
            left = r"\b" if re.match(r"^\w", n) else ""
            right = r"\b" if re.search(r"\w$", n) else ""
            return f"{left}{esc}{right}"

        # Sort by length (longest first) to match longer names first
        uniq = sorted(set(names), key=len, reverse=True)
        return re.compile("|".join(wrap(n) for n in uniq), re.IGNORECASE)

    def _find_first_safe_match(paragraph: str, name_pat: re.Pattern) -> Optional[re.Match]:
        """Find first occurrence of name that's not in a link, code, or tag."""
        blocked = (
            _ranges(MD_LINK_RE, paragraph)
            + _ranges(INLINE_CODE_RE, paragraph)
            + _ranges(HTML_TAG_RE, paragraph)
        )
        for m in name_pat.finditer(paragraph):
            if not _in_any_range(m.start(), blocked):
                return m
        return None

    # Split into blocks (paragraphs separated by blank lines)
    blocks = re.split(r'\n\s*\n', md)

    def fence_toggle_count(block: str) -> int:
        """Count fence delimiters to track code block state."""
        return sum(1 for line in block.splitlines() if FENCE_RE.match(line))

    in_fence = False

    with shelve.open(str(ALIASES_CACHE_PATH)) as cache:
        for i in range(len(blocks)):
            block = blocks[i]

            # Track code fence state
            if fence_toggle_count(block) % 2 == 1:
                in_fence = not in_fence

            if in_fence:
                continue

            original_block = blocks[i]

            # Process all param tags in this block
            for tag_m in PARAM_TAG_RE.finditer(original_block):
                tag = tag_m.group(0)

                eid_m = EID_RE.search(tag)
                if not eid_m:
                    continue

                qid = eid_m.group(1)
                names = list(cache.get(qid, []))
                name_pat = _compile_name_pattern(names)
                if not name_pat:
                    continue

                # Scan forward to find first safe match
                j = i + 1
                j_in_fence = in_fence
                while j < len(blocks):
                    para = blocks[j]

                    if fence_toggle_count(para) % 2 == 1:
                        j_in_fence = not j_in_fence

                    if not j_in_fence:
                        m = _find_first_safe_match(para, name_pat)
                        if m:
                            matched = m.group(0)
                            blocks[j] = para[:m.start()] + f"[{matched}]({qid})" + para[m.end():]
                            break
                    j += 1

            # Remove all param tags from this block
            cleaned = PARAM_TAG_RE.sub("", original_block)
            cleaned = re.sub(r"\n[ \t]*\n", "\n\n", cleaned).strip()
            blocks[i] = cleaned

    return "\n\n".join(blocks)

image_attrs = {}

def convert_params(md: str) -> str:
    """
    Convert <param> tags to Jekyll includes or markdown.
    
    Handles:
    - ve-entity: Entity definitions and linking
    - ve-image: Image displays
    - ve-map: Map viewers
    - ve-map-layer: Map layers
    """
    # First, convert entity tags
    md = convert_ve_entity_tags(md)
    
    def transform_image(attrs: Dict[str, str]) -> str:
        """Transform ve-image params to markdown image with caption."""
        attribution = ''
        caption = ''
        src = ''
        
        for key, value in attrs.items():
            if key not in image_attrs: 
                image_attrs[key] = 0
            image_attrs[key] = image_attrs[key] + 1
            if key in ['manifest', 'src', 'url']:
                src = value
            elif key in ['caption', 'label', 'title']:
                caption = value
            elif key in ['attribution',]:
                attribution = value
        
        aspect_ratio = get_image_aspect_ratio(src)

        looks_like_wikimedia = src.startswith('wc:') or 'wikimedia.org' in src
        
        if 'wikimedia.org' in src:
            src = 'wc:' + re.sub(r'^\d+px-', '', src.split('/')[-1].split('File:')[-1])

        tag = f'\n{{% include embed/image.html src="{src}" aspect="{round(aspect_ratio,3)}"'
        if caption:
            tag += f' caption="{caption}"'
        if attribution and not looks_like_wikimedia:
            tag += f' attribution="{attribution}"'
        
        tag += ' %}{: .right}\n'
        
        return tag
    
    def transform_map(attrs: Dict[str, str]) -> str:
        """Transform ve-map params to Jekyll map include."""
        global allmaps_fragment
        center = attrs.get('center', '')
        zoom = attrs.get('zoom', '')
        caption = attrs.get('caption') or attrs.get('label') or attrs.get('title', '')
        basemap = attrs.get('basemap', '')
        markers = attrs.get('marker', center)
        
        tag = '\n{% include embed/map.html '
        if center:
            tag += f'center="{center}" '
        if zoom:
            tag += f'zoom="{zoom}" '
        if caption:
            tag += f'caption="{caption}" '
        if basemap:
            tag += f'basemap="{basemap}" '
        if markers:
            tag += f'markers="{markers}" '
        tag += f'{allmaps_fragment} %}}{{: .right}}\n'
        
        return tag
    
    def get_allmaps_fragment(attrs: Dict[str, str]) -> str:
        """Transform ve-map-layer params to Jekyll map include."""
        global allmaps_fragment
        allmaps_id = attrs.get('allmaps-id', '')
        title = attrs.get('label') or attrs.get('title', '')
        allmaps_fragment = f'allmaps="{allmaps_id}'
        if title: allmaps_fragment += f'~{title}'
        allmaps_fragment += '"'

    def transform(match) -> str:
        """Transform a single param tag based on its type."""
        global allmaps_fragment
        attr_text = match.group(1)

        # Parse attributes using shlex (respects quotes)
        lexer = shlex.shlex(attr_text, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = ''
        tokens = list(lexer)

        attrs = {}
        for token in tokens:
            if '=' in token:
                key, value = token.split('=', 1)
                attrs[key] = value.strip('"\'')
            else:
                attrs[token] = None

        # Route to appropriate transformer
        if 've-map-layer' in attrs:
            get_allmaps_fragment(attrs)
            return ''
        if 've-image' in attrs:
            return transform_image(attrs)
        if 've-map' in attrs:
            return transform_map(attrs)
        
        # Return unchanged if no handler
        return match.group(0)

    # Match all param tags
    regex = re.compile(r'^[ \t]*<param\s+(.+?)>[ \t]*$', re.DOTALL | re.MULTILINE)
    md = regex.sub(transform, md)
    
    return md



def clean(text: str) -> str:
    """
    Clean up converted markdown.
    
    Removes:
    - Button links
    - ve-config params
    - Standalone <br> tags
    - Excessive blank lines
    - Empty headings
    
    Ensures:
    - Blank line after headings
    """
    text = RE_REMOVE.sub('', text)
    text = RE_COLLAPSE_BLANK_LINES.sub('\n\n', text)
    text = RE_ADD_BLANK_AFTER_HEADING.sub(r'\1\n\n', text)
    text = RE_EMPTY_HEADINGS.sub('', text)
    return text


# ============================================================================
# Front Matter Generation
# ============================================================================

def get_thumbnails(path: str) -> Dict[str, str]:
    """
    Extract thumbnail mappings from category index README.
    
    Returns dict mapping href → img src.
    """
    thumbnails = {}
    try:
        md = pathlib.Path(path).read_text(encoding='utf-8')
        soup = BeautifulSoup(markdown.markdown(md), 'html.parser')
        for a in soup.find_all('a'):
            img = a.find_next('img')
            href = a.get('href', '')
            img_src = img.get('src', '') if img else ''
            thumbnails[href] = img_src
    except Exception as e:
        print(f"Error extracting thumbnails from {path}: {e}")
    return thumbnails


def get_front_matter(src_path: str, md: str, **kwargs) -> Optional[str]:
    """
    Generate Jekyll front matter from ve-config params.
    
    Args:
        src_path: Path to source file
        md: Markdown content
        **kwargs: Additional front matter values (date, categories, tags, etc.)
        
    Returns:
        Front matter string or None if this is an index page
    """
    # Check for thumbnails in category index
    cat_index_path = os.path.dirname(src_path) + '/README.md'
    if os.path.exists(cat_index_path):
        thumbnails = get_thumbnails(cat_index_path)
    
    # Extract ve-config attributes
    config_attrs = {}
    regex = re.compile(r'^[ \t]*<param\s+ve-config\s+(.+?)>[ \t]*$', re.DOTALL | re.MULTILINE)
    match = regex.search(md)

    if match:
        attr_text = match.group(1)
        lexer = shlex.shlex(attr_text, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = ''
        tokens = list(lexer)
        
        for token in tokens:
            if '=' in token:
                key, value = token.split('=', 1)
                config_attrs[key] = value.strip('"\'')

        # Skip index pages
        if config_attrs.get('layout', '') == 'index':
            return None

        # Generate front matter
        fm_str = f'''---
title: "{config_attrs.get('title', '')}"
description: "{config_attrs.get('description', '') or kwargs.get('description', '')}"
author: {config_attrs.get('author', '')}
date: {kwargs.get('date', '')}
categories: [ {', '.join(kwargs.get('categories', []))} ]
tags: [ {', '.join(kwargs.get('tags', []))} ]
image: 
  path: "{config_attrs.get('banner', '')}"
layout: post
permalink: {kwargs.get('permalink', '')}
published: true
toc: false    
---
'''
        return fm_str
    
    return None


# ============================================================================
# Main Conversion Logic
# ============================================================================

def convert(src: str, dest: str, max: Optional[int] = None, **kwargs):
    """
    Convert all Juncture essays in a directory tree.
    
    Args:
        src: Source directory containing essays
        dest: Destination directory for converted files
        max: Maximum number of files to convert (for testing)
    """
    all_tags = {}
    ctr = 0
    
    for root, dirs, files in os.walk(src):
        if 'README.md' not in files or dirs:
            continue
            
        src_path = root.split('/')
        
        # Get creation date
        creation_date = datetime.fromtimestamp(
            Path(root).stat().st_birthtime
        ).strftime('%Y-%m-%d')
        
        # Determine categories and filename
        categories = [src_path[-2]]
        base_fname = src_path[-1]
        #if base_fname.startswith(categories[0]):
        #    base_fname = base_fname[len(categories[0]) + 1:]
        
        # Skip test files
        if base_fname.endswith('test'):
            print(f'Skipping test file: {root}')
            continue

        dest_path = f'{dest}/{creation_date}-{base_fname}.md'
        
        # Read and convert markdown
        md = pathlib.Path(f'{root}/README.md').read_text(encoding='utf-8')
        
        try:
            md = convert_params(md)
        except Exception as e:
            print(f'Error converting params in {root}: {e}')
            traceback.print_exc()
            continue
        
        # Generate AI metadata
        try:
            ai_metadata = generate_description_and_tags(md, dest_path)
            for t in ai_metadata['tags']:
                all_tags[t] = all_tags.get(t, 0) + 1
        except Exception as e:
            print(f'Error generating metadata for {root}: {e}')
            traceback.print_exc()
            continue

        # Generate front matter
        fm = get_front_matter(
            root, md,
            date=creation_date,
            categories=categories,
            permalink=f'/{categories[0]}/{base_fname}/',
            description=ai_metadata['description'],
            tags=ai_metadata['tags']
        )
        
        # Clean markdown
        md = clean(md)
        
        # Write converted file
        if fm:
            ctr += 1
            with open(dest_path, 'w') as fp:
                fp.write(fm + md)
            print(f'{ctr}. {root} -> {dest_path}')
            
            if max and ctr >= max:
                break
    
        if max and ctr >= max:
            break
        
    # print('image attrs', json.dumps(image_attrs, indent=2))
    
    # Print tag statistics
    '''
    print("\nTag usage statistics:")
    for t in sorted(all_tags.keys()):
        print(f'  "{t}": {all_tags[t]}')
    '''


# ============================================================================
# CLI Entry Point
# ============================================================================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Convert Juncture V1 essays to Jekyll/Chirpy format.'
    )
    parser.add_argument(
        '--src',
        default='/Users/ron/projects/kent-map/kent',
        help='Path to source directory'
    )
    parser.add_argument(
        '--dest',
        default='/Users/ron/projects/kent-map/chirpy/_posts',
        help='Path to destination directory'
    )
    parser.add_argument(
        '--max',
        type=int,
        default=None,
        help='Maximum number of files to convert (for testing)'
    )

    args = vars(parser.parse_args())
    convert(**args)