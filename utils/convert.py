#!/usr/bin/env python
# -*- coding: utf-8 -*-

from ast import pattern
import os
import json
import argparse
import pathlib
import re
import shlex
import hashlib
from unittest import result
from urllib.parse import unquote, quote
from pathlib import Path
from datetime import datetime
import traceback

import requests
import shelve
from PIL import Image
from io import BytesIO
from pathlib import Path

CACHE_PATH = Path('.image_aspect_cache')

import markdown
from bs4 import BeautifulSoup

from typing import Dict, Any, Optional, List, Tuple
from openai import OpenAI
import time

client = OpenAI()

MODEL = "gpt-5.2"

TAG_VOCABULARY = {
  "tag_vocabulary": {
    "version": "1.0",
    "size": 25,
    "rules_of_thumb": {
      "target_tags_per_article": { "min": 3, "max": 5 },
      "suggested_mix": [
        "1 core theme tag",
        "1 landscape/place tag",
        "1 framing/method tag",
        "optional: Time periods when periodization is central",
        "optional: Methods & digital for tooling/method essays"
      ]
    },
    "tags": [
      {
        "tag": "literary-places",
        "label": "Literary places",
        "scope_note": "Texts/authors/readers connected to Kent locations; settings, inspirations, literary tourism, walking trails."
      },
      {
        "tag": "authors-and-lives",
        "label": "Authors & lives",
        "scope_note": "Biographical focus on writers/artists/public figures; networks, relationships, careers."
      },
      {
        "tag": "texts-and-genres",
        "label": "Texts & genres",
        "scope_note": "Works and genres (novels, poetry, periodicals, crime, children's literature, travel writing); publication forms."
      },
      {
        "tag": "culture-and-society",
        "label": "Culture & society",
        "scope_note": "Everyday life, class, leisure, popular culture, institutions, civic life, manners."
      },
      {
        "tag": "politics-and-reform",
        "label": "Politics & reform",
        "scope_note": "Suffrage, law, policy, protest movements, governance, civic disputes, social reform."
      },
      {
        "tag": "conflict-and-war",
        "label": "Conflict & war",
        "scope_note": "Military history and wartime life including home front, raids, defenses, memorials."
      },
      {
        "tag": "faith-and-belief",
        "label": "Faith & belief",
        "scope_note": "Religious institutions and practices; dissent, missions, church culture, belief and debate."
      },
      {
        "tag": "crime-and-punishment",
        "label": "Crime & punishment",
        "scope_note": "Prisons, policing, trials, penal policy, carceral institutions, notable cases."
      },
      {
        "tag": "work-and-industry",
        "label": "Work & industry",
        "scope_note": "Dockyards, coal, rail, trades, labor history, economic change, infrastructure as work."
      },
      {
        "tag": "science-and-ideas",
        "label": "Science & ideas",
        "scope_note": "Scientific lives and knowledge networks; medicine, technology, intellectual history."
      },
      {
        "tag": "coast-and-sea",
        "label": "Coast & sea",
        "scope_note": "Seaside towns, maritime travel, wrecks, coastal identity, sea-bathing culture."
      },
      {
        "tag": "rivers-and-marshes",
        "label": "Rivers & marshes",
        "scope_note": "Rivers/estuaries, Romney Marsh, drainage, wetlands, floods and water management."
      },
      {
        "tag": "countryside-and-farming",
        "label": "Countryside & farming",
        "scope_note": "Orchards, hop growing/picking, rural labor, horticulture, land use, agrarian change."
      },
      {
        "tag": "nature-and-environment",
        "label": "Nature & environment",
        "scope_note": "Ecology, wildlife, geology, weather/extreme weather, conservation, environmental change."
      },
      {
        "tag": "towns-and-cities",
        "label": "Towns & cities",
        "scope_note": "Urban change, development, civic institutions, streetscapes, tourism economies."
      },
      {
        "tag": "travel-and-mobility",
        "label": "Travel & mobility",
        "scope_note": "Routes and movement: rail, roads, ferries, coaching, guidebooks, walking, touring."
      },
      {
        "tag": "buildings-and-architecture",
        "label": "Buildings & architecture",
        "scope_note": "Churches, castles, houses, civic buildings; architectural styles, restoration, reuse."
      },
      {
        "tag": "heritage-and-memory",
        "label": "Heritage & memory",
        "scope_note": "Museums, preservation, commemoration, heritage debates, public memory."
      },
      {
        "tag": "maps-and-place-making",
        "label": "Maps & place-making",
        "scope_note": "Mapping/carto­graphy; spatial storytelling; reading landscapes; geographic method."
      },
      {
        "tag": "representation-and-interpretation",
        "label": "Representation & interpretation",
        "scope_note": "Conflicting perspectives, gaps in the record, contested narratives, historiography."
      },
      {
        "tag": "identity-and-community",
        "label": "Identity & community",
        "scope_note": "Belonging, migration, race, gender, local identity, community histories."
      },
      {
        "tag": "material-culture",
        "label": "Material culture",
        "scope_note": "Objects/artifacts, collections, print as material, visual/aural sources, embodied evidence."
      },
      {
        "tag": "arts-and-performance",
        "label": "Arts & performance",
        "scope_note": "Visual art, music, theatre, festivals, performance culture, creative production."
      },
      {
        "tag": "time-periods",
        "label": "Time periods",
        "scope_note": "Use when periodization is central to the essay (store specific era/range in separate metadata)."
      },
      {
        "tag": "methods-and-digital",
        "label": "Methods & digital",
        "scope_note": "Digital humanities, archival practice, project method, interactive/technical notes about the site."
      }
    ]
  }
}

PROMPT_VERSION = "v3-controlled-vocab-labels"

TAG_LOOKUP = {t["tag"]: t["label"] for t in TAG_VOCABULARY["tag_vocabulary"]["tags"]}
ALLOWED_TAGS = list(TAG_LOOKUP.keys())

VOCAB_VERSION = TAG_VOCABULARY["tag_vocabulary"]["version"]
MIN_TAGS = TAG_VOCABULARY["tag_vocabulary"]["rules_of_thumb"]["target_tags_per_article"]["min"]
MAX_TAGS = TAG_VOCABULARY["tag_vocabulary"]["rules_of_thumb"]["target_tags_per_article"]["max"]

SCHEMA_OBJ = {
    "type": "object",
    "properties": {
        "description": {"type": "string"},
        "tags": {  # tags returned by the model are *slugs* (enforced)
            "type": "array",
            "items": {"type": "string", "enum": ALLOWED_TAGS},
            "minItems": MIN_TAGS,
            "maxItems": MAX_TAGS,
        },
    },
    "required": ["description", "tags"],
    "additionalProperties": False,
}

def _dedupe_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
  
def _normalize_and_convert_tags(slug_tags: List[str]) -> List[str]:
    slug_tags = [t.strip() for t in slug_tags if isinstance(t, str) and t.strip()]
    slug_tags = _dedupe_preserve_order(slug_tags)
    slug_tags = [t for t in slug_tags if t in TAG_LOOKUP]

    if len(slug_tags) < MIN_TAGS:
        raise ValueError(f"Too few valid tags after filtering: {slug_tags}")
    if len(slug_tags) > MAX_TAGS:
        slug_tags = slug_tags[:MAX_TAGS]

    return [TAG_LOOKUP[t] for t in slug_tags]  # labels

def _format_tag_vocab_for_prompt() -> str:
    # Stable order (as provided)
    lines = []
    for t in TAG_VOCABULARY["tag_vocabulary"]["tags"]:
        lines.append(f"- {t['tag']}: {t['scope_note']}")
    return "\n".join(lines)

def _cache_key(markdown_text: str, title: str) -> str:
    h = hashlib.sha256()
    # Only stable inputs—DO NOT include the full prompt text.
    h.update(MODEL.encode("utf-8")); h.update(b"\0")
    h.update(PROMPT_VERSION.encode("utf-8")); h.update(b"\0")
    h.update(VOCAB_VERSION.encode("utf-8")); h.update(b"\0")
    h.update((title or "").encode("utf-8")); h.update(b"\0")
    h.update(markdown_text.encode("utf-8"))
    return h.hexdigest()

def _call_openai(markdown_text: str, title: str) -> Dict[str, Any]:
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

    raw = json.loads(resp.output_text)  # tags are slugs here
    return {
        "description": raw["description"].strip(),
        "tags": _normalize_and_convert_tags(raw["tags"]),  # convert to labels
    }
    
def generate_description_and_tags(
    markdown_text: str,
    title: str = "",
    cache_path: str = "essay_meta_cache.shelve",
    force_refresh: bool = False,
) -> Dict[str, Any]:
    key = _cache_key(markdown_text, title)

    # Make sure cache_path is stable even if cwd changes:
    cache_path = os.path.abspath(cache_path)

    with shelve.open(cache_path) as db:
        if not force_refresh and key in db:
            return db[key]

        # retry a couple times for transient errors
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
  
def wc_title_to_url(title, width=100):
  title = unquote(title).replace(' ','_')
  md5 = hashlib.md5(title.encode('utf-8')).hexdigest()
  ext = title.split('.')[-1]
  baseurl = 'https://upload.wikimedia.org/wikipedia/commons/'
  if ext == 'svg':
    url = f'{baseurl}thumb/{md5[:1]}/{md5[:2]}/{quote(title)}/{width}px-${quote(title)}.png'
  elif ext in ('tif', 'tiff'):
    url = f'{baseurl}thumb/{md5[:1]}/{md5[:2]}/{quote(title)}/{width}px-${quote(title)}.jpg'
  else:
    url = f'{baseurl}thumb/{md5[:1]}/{md5[:2]}/{quote(title)}/{width}px-${quote(title)}' if width is None else f'{baseurl}{md5[:1]}/{md5[:2]}/{quote(title)}'
  return url

def get_image_aspect_ratio(url: str, timeout: int = 10) -> float:
  try:
    if url.startswith('wc:'):
      url = wc_title_to_url(url.replace('wc:',''))
    with shelve.open(str(CACHE_PATH)) as cache:
      if url in cache:
        return cache[url]

      resp = requests.get(url, timeout=timeout, headers={'User-Agent': 'Mozilla/5.0'})
      resp.raise_for_status()

      img = Image.open(BytesIO(resp.content))
      width, height = img.size

      if width == 0 or height == 0:
        raise ValueError("Invalid image dimensions")

      ratio = width / height
      cache[url] = ratio
      return round(ratio, 2)
  except Exception as e:
    print(f"Error fetching image from {url}: {e}")
    return 1.0  # Default aspect ratio

def convert_permalink(md):
  return re.sub(r'# permalink:', 'permalink:', md)

def insert_blank_line_before_param_blocks(md):
  lines = md.splitlines(keepends=True)
  output = []
  start_param = re.compile(r'^[ \t]*<param\b')
  i, n = 0, len(lines)

  while i < n:
    line = lines[i]

    # If this line begins a <param…> block:
    if start_param.match(line):
      # only insert if the *previous* line exists and is non-blank
      if i > 0 and lines[i-1].strip() != '':
        output.append('\n')

      # now consume the *entire* block of non-blank lines
      while i < n and lines[i].strip() != '':
        output.append(lines[i])
        i += 1
    else:
      output.append(line)
      i += 1

  return ''.join(output)

def convert_entity_infoboxes(md):
  regex = re.compile(r'<span\s+e?id="(Q\d+)"\s*>[_*](.+?)[_*]</span>', re.DOTALL)
  md = regex.sub(r'_[\2](\1)_', md)
  regex = re.compile(r'<span\s+e?id="(Q\d+)"\s*>(.+?)</span>', re.DOTALL)
  return regex.sub(r'[\2](\1)', md)

def convert_zoomto_links(md, image_id='image-id'):
  SPAN_ZOOMTO_RE = re.compile(
    r'<span\b[^>]*\bdata-(?:click|mouseover)-image-zoomto="'   # opening tag + attribute
    r'\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)'     # x, y
    r'\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)' # w, h
    r'"\s*[^>]*>'                                             # end of opening tag
    r'(.*?)'                                                  # inner text (non-greedy)
    r'</span>',                                               # closing tag
    re.DOTALL
  )

  def _span_zoomto_to_md(match, image_id):
      x, y, w, h, text = match.groups()
      region = f"{x},{y},{w},{h}"
      return f"[{text}]({image_id}/zoomto/{region})"

  return SPAN_ZOOMTO_RE.sub(lambda m: _span_zoomto_to_md(m, image_id), md)
  
  
def convert_flyto_links(md, map_id='map-id'):
  SPAN_FLYTO_RE = re.compile(
    r'<span\b[^>]*\bdata-(?:click|mouseover)-map-flyto="'     # opening
    r'\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)'  # lat, lon, zoom
    r'"\s*[^>]*>(.*?)</span>',                                # inner text + closing
    re.DOTALL
  )
  def _span_to_md(m, map_id):
    lat, lon, zoom, text = m.groups()
    coords = f"{lat},{lon},{zoom}"
    return f"[{text}]({map_id}/flyto/{coords})"

  return SPAN_FLYTO_RE.sub(lambda m: _span_to_md(m, map_id), md)

ALIASES_CACHE_PATH = Path('.entity_names_cache')
def get_entity_names(text: str, shelve_path: str):
  
  eids = set()
  from_tag = {}
  
  text = """
  <param ve-entity eid="Q12345" aliases="Canterbury|Cathedral">
  <param ve-entity aliases="Kent|County|England" eid="Q23211">
  <param ve-entity eid="Q99999">
  """

  # Find all <param ve-entity ...> tags
  tag_pattern = re.compile(
      r'<param\s+ve-entity\b[^>]*>',
      re.IGNORECASE
  )

  # Attribute extractors
  eid_pattern = re.compile(r'\beid="([^"]+)"')
  aliases_pattern = re.compile(r'\baliases="([^"]+)"')

  for tag_match in tag_pattern.finditer(text):
      tag = tag_match.group(0)

      eid_match = eid_pattern.search(tag)
      if not eid_match:
          continue  # eid is required

      eid = eid_match.group(1)
      eids.add(eid)

      aliases_match = aliases_pattern.search(tag)
      aliases = (
          [a for a in aliases_match.group(1).split("|") if a]
          if aliases_match
          else []
      )

      if eid in from_tag:
          from_tag[eid].extend(aliases)
          from_tag[eid] = list(set(from_tag[eid]))  # Deduplicate

  with shelve.open(str(shelve_path)) as cache:
    
    to_get = [eid for eid in eids if eid not in cache]

    if to_get:
      sparql = '''
        SELECT ?item (SAMPLE(?label) AS ?label) (GROUP_CONCAT(?alias; separator=" | ") AS ?aliases) 
        WHERE {
          VALUES (?item) { %s }
          OPTIONAL { ?item rdfs:label ?label . FILTER (LANG(?label) = "en") }
          OPTIONAL { ?item skos:altLabel ?alias . FILTER (LANG(?alias) = "en") }
        }
        GROUP BY ?item
        '''  % ( '(wd:' + ') (wd:'.join(to_get) + ')' )

      resp = requests.post(
          'https://query.wikidata.org/sparql',
          headers={
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/sparql-results+json',
              'User-Agent': 'Mozilla/5.0'
          },
          data={'query': sparql}
      )
      if resp.status_code != 200: 
          print('Wikidata SPARQL query failed:', resp.status_code, resp.text)
          return {}
        
      aliases = {}
      for rec in resp.json()['results']['bindings']:
        qid = rec.get('item', {}).get('value', '').split('/')[-1]
        label = rec.get('label', {}).get('value', '')
        entity_names = [name for name in rec.get('aliases', {}).get('value', '').split(' | ') if name]
        entity_names = from_tag.get(qid, []) + [label] + entity_names
        cache[qid] = entity_names 
  
def convert_ve_entity_tags(md):
  get_entity_names(md, shelve_path=ALIASES_CACHE_PATH)
  
  PARAM_TAG_RE = re.compile(r'<param\s+ve-entity\b[^>]*>', re.IGNORECASE)
  EID_RE = re.compile(r'\beid="([^"]+)"', re.IGNORECASE)

  MD_LINK_RE = re.compile(r'\[[^\]]*\]\([^)]+\)')
  INLINE_CODE_RE = re.compile(r'`[^`]*`')
  HTML_TAG_RE = re.compile(r'<[^>]+>')
  FENCE_RE = re.compile(r'^\s*(```|~~~)')

  def _ranges(regex: re.Pattern, s: str) -> List[Tuple[int, int]]:
      return [(m.start(), m.end()) for m in regex.finditer(s)]

  def _in_any_range(pos: int, ranges: List[Tuple[int, int]]) -> bool:
      return any(a <= pos < b for a, b in ranges)

  def _compile_name_pattern(names: List[str]) -> Optional[re.Pattern]:
      names = [n for n in names if isinstance(n, str) and n.strip()]
      if not names:
          return None

      def wrap(n: str) -> str:
          esc = re.escape(n)
          left = r"\b" if re.match(r"^\w", n) else ""
          right = r"\b" if re.search(r"\w$", n) else ""
          return f"{left}{esc}{right}"

      uniq = sorted(set(names), key=len, reverse=True)
      return re.compile("|".join(wrap(n) for n in uniq), re.IGNORECASE)

  def _find_first_safe_match(paragraph: str, name_pat: re.Pattern) -> Optional[re.Match]:
      blocked = (
          _ranges(MD_LINK_RE, paragraph)
          + _ranges(INLINE_CODE_RE, paragraph)
          + _ranges(HTML_TAG_RE, paragraph)
      )
      for m in name_pat.finditer(paragraph):
          if not _in_any_range(m.start(), blocked):
              return m
      return None

  # Split into blocks separated by blank lines (paragraph-ish)
  blocks = re.split(r'\n\s*\n', md)

  def fence_toggle_count(block: str) -> int:
      return sum(1 for line in block.splitlines() if FENCE_RE.match(line))

  in_fence = False

  with shelve.open(ALIASES_CACHE_PATH) as cache:
      for i in range(len(blocks)):
          block = blocks[i]

          # maintain fence state at block granularity
          if fence_toggle_count(block) % 2 == 1:
              in_fence = not in_fence

          if in_fence:
              continue

          original_block = blocks[i]

          # Process ALL param tags in this block (use original_block, not a mutated string)
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

              # Scan forward and link first safe match (same logic you already have)
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

          # Now remove ALL param tags from this block (not just one)
          cleaned = PARAM_TAG_RE.sub("", original_block)

          # If tags were on their own lines, this helps avoid leftover blank lines
          cleaned = re.sub(r"\n[ \t]*\n", "\n\n", cleaned).strip()

          blocks[i] = cleaned
  return "\n\n".join(blocks)
  
def convert_params(md):
  
  md = convert_ve_entity_tags(md)
  
  # attribution caption cover description fit label license manifest region rotate seq src title url 
  image_attrs = set()
  def transform_image(attrs):
    aspect_ratio = 1.0
    attribution = ''
    caption = ''
    license = ''
    src = ''
    
    for key, value in attrs.items():
      if key in ['manifest', 'src', 'url']:
        src = value
        # aspect_ratio = get_image_aspect_ratio(src)
      elif key in ['caption', 'label', 'title']:
        caption = value
      elif key in ['attribution',]:
        attribution = value
      elif key in ['license',]:
        license = value
        
    return f'\n![{caption}]({src})\n_{caption}_\n{{: .right}}'
  
  # basemap center zoom
  map_attrs = set()
  def transform_map(attrs):
    basemap = ''
    caption = ''
    center = ''
    zoom = ''

    for key, value in attrs.items():
      if key in ['ve-map',]: continue
      map_attrs.add(key)
      if key == 'center':
          center = value
      elif key == 'zoom':
        zoom = value
      elif key in ['caption', 'label', 'title']:
        caption = value
      elif key in ['basemap',]:
        basemap = value
    
    tag = '\n{% include embed/map.html '
    if center:
      tag += f'center="{center}" '
    if zoom:
      tag += f'zoom="{zoom}" '
    if caption:
      tag += f'caption="{caption}" '
    if basemap:
      tag += f'basemap="{basemap}" '
    tag += 'marker="true" %}{: .right}\n'
    
    return tag

  # 
  map_layer_attrs = set()
  def transform_map_layer(attrs):
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-map-layer',]: continue
      map_layer_attrs.add(key)
      if key == 'title':
        repl_attrs['layer'] = value
      else:
        repl_attrs[key] = value
    repl_str = '`-'
    for key, value in repl_attrs.items():
      if value is None:
        repl_str += f' {key}'
      else:
        if ' ' in value: value = f'"{value}"'
        repl_str += f' {key}={value}'
    repl_str += '`'
    return repl_str
    
  # 
  map_marker_attrs = set()
  def transform_map_marker(attrs):
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-map-marker',]: continue
      map_marker_attrs.add(key)
      repl_attrs[key] = value
    repl_str = '`- marker'
    for key, value in repl_attrs.items():
      if value is None:
        repl_str += f' {key}'
      else:
        if ' ' in value: value = f'"{value}"'
        repl_str += f' {key}={value}'
    repl_str += '`'
    return repl_str

  # id title
  video_attrs = set()
  def transform_video(attrs):
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-video',]: continue
      video_attrs.add(key)
      if key == 'title':
        repl_attrs['caption'] = value
      elif key in ['caption',]:
        repl_attrs[key] = value
      elif key in ['id', 'vid']:
        repl_attrs['vid'] = value
      #elif key in ['cover',]: # boolean attributes
      #  repl_attrs[key] = None
    repl_str = '`youtube'
    for key, value in repl_attrs.items():
      if value is None:
        repl_str += f' {key}'
      else:
        if ' ' in value: value = f'"{value}"'
        repl_str += f' {key}={value}'
    repl_str += '`'
    return repl_str
  
  # 
  compare_attrs = set()
  def transform_compare(attrs):
    global first
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-compare',]: continue
      compare_attrs.add(key)
      if key in ['manifest', 'url']:
        repl_attrs[key + ('1' if first is None else '2')] = value
      elif key in ['caption', ]:
        repl_attrs[key] = value
    if first is None:
      first = repl_attrs
      return None
    
    repl_str = '`image-compare'
    for key, value in first.items():
      repl_str += f' {key}={value}'
    for key, value in repl_attrs.items():
      repl_str += f' {key}={value}'
    repl_str += '`'
    first = None
    return repl_str
  
  def transform_iframe(attrs):
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-iframe',]: continue
      repl_attrs[key] = value
    
    repl_str = '`iframe '
    for key, value in repl_attrs.items():
      repl_str += f' {key}={value}'
    repl_str += '`'
    return repl_str

  def transform(match):
    full_tag = match.group(0)
    attr_text = match.group(1)

    # Use shlex to safely split while respecting quotes
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
            # Handle attributes without = (e.g., "ve-map-marker")
            attrs[token] = None

    if 've-image' in attrs: return transform_image(attrs)
    if 've-map' in attrs: return transform_map(attrs)
    '''
    if 've-map-layer' in attrs: return transform_map_layer(attrs)
    if 've-map-marker' in attrs: return transform_map_marker(attrs)
    if 've-video' in attrs: return transform_video(attrs)
    if 've-compare' in attrs: return transform_compare(attrs)
    if 've-knightlab-timeline' in attrs: return transform_knightlab_timeline(attrs)
    if 've-iframe' in attrs: return transform_iframe(attrs)
    '''

    return full_tag

  regex = re.compile(r'^[ \t]*<param\s+(.+?)>[ \t]*$', re.DOTALL | re.MULTILINE)
  
  md = regex.sub(transform, md)
  return md

def get_thumbnails(path):
  thumbnails = {}
  md = pathlib.Path(path).read_text(encoding='utf-8')
  soup = BeautifulSoup(markdown.markdown(md), 'html.parser')
  for a in soup.find_all('a'): 
    img = a.find_next('img')
    href = a.get('href','')
    img_src = img.get('src','') if img else ''
    thumbnails[href] = img_src
  return thumbnails
  
def get_front_matter(src_path, md, **kwargs):
  cat_index_path = os.path.dirname(src_path) + '/README.md'
  if os.path.exists(cat_index_path):
    thumbnails = get_thumbnails(cat_index_path)
  
  config_attrs = {}
  regex = re.compile(r'^[ \t]*<param\s+ve-config\s+(.+?)>[ \t]*$', re.DOTALL | re.MULTILINE)
  match = regex.search(md)

  if match:
    attr_text = match.group(1)
    # Use shlex to safely split while respecting quotes
    lexer = shlex.shlex(attr_text, posix=True)
    lexer.whitespace_split = True
    lexer.commenters = ''
    tokens = list(lexer)
    for token in tokens:
        if '=' in token:
            key, value = token.split('=', 1)
            config_attrs[key] = value.strip('"\'')

    if config_attrs.get('layout','') == 'index':
      return

    fm_str = '''---
title: "%s"
description: "%s"
author: %s
date: %s
categories: [ %s ]
tags: [ %s ]
image: 
  path: "%s"
layout: post
permalink: %s
published: true
toc: false    
---\n''' % (
      config_attrs.get('title',''),
      config_attrs.get('description','') or kwargs.get("description",""),
      config_attrs.get('author',''),
      kwargs.get('date',''),
      ', '.join(kwargs.get('categories',[])),
      ', '.join(kwargs.get('tags',[])),
      config_attrs.get('banner',''),
      kwargs.get('permalink','')
    )
    return fm_str

RE_REMOVE = re.compile(
    r'''
    <a\b[^>]*>\s*<img\b[^>]*\bve-button\b[^>]*>\s*</a>
    |
    <param\b[^>]*\bve-config\b[^>]*>
    |
    ^\s*(?:<br\s*/?>\s*)+\s*$
    ''',
    re.IGNORECASE | re.VERBOSE | re.MULTILINE | re.DOTALL
)

RE_COLLAPSE_BLANK_LINES = re.compile(r'\n\s*\n+', re.MULTILINE)

RE_ADD_BLANK_AFTER_HEADING = re.compile(
    r'^(#{1,6}\s+.+)\n(?!\s*\n)',
    re.MULTILINE
)

RE_EMPTY_HEADINGS = re.compile(
    r'^\s*#{1,6}\s*$',
    re.MULTILINE
)

def clean(text):
  text = RE_REMOVE.sub('', text)
  text = RE_COLLAPSE_BLANK_LINES.sub('\n\n', text)
  text = RE_ADD_BLANK_AFTER_HEADING.sub(r'\1\n\n', text)
  text = RE_EMPTY_HEADINGS.sub('', text)
  return text

all_tags = {}
def convert(src, dest, max=None, **kwargs):
  ctr = 0
  for root, dir, files in os.walk(src):
    for fname in files:
      if fname == 'README.md' and not dir:
        src_path = root.split('/')
        creation_date = datetime.fromtimestamp(Path(root).stat().st_birthtime).strftime('%Y-%m-%d')
        categories = [ src_path[-2] ]
        base_fname = src_path[-1] if not src_path[-1].startswith(categories[0]) else src_path[-1][len(categories[0])+1:]
        if base_fname.endswith('test'):
          print('Skipping test file:', root)
          continue

        dest_path = f'{dest}/{creation_date}-{base_fname}.md'
  
        md = pathlib.Path(root + '/README.md').read_text(encoding='utf-8')
        try:
          md = convert_params(md)
        except Exception as e:
          print('Error converting params in:', root, e)
          traceback.print_exc()
        
        ai_metadata = generate_description_and_tags(md, dest_path)
        for t in ai_metadata['tags']:
          if t not in all_tags:
            all_tags[t] = 0
          all_tags[t] += 1

        fm = get_front_matter(root, md, **{
          'date': creation_date, 
          'categories': categories, 
          'permalink': f'/{categories[0]}/{base_fname}/', 
          'description': ai_metadata['description'],
          'tags': ai_metadata['tags']
        })
        md = clean(md)
        
        if fm:

          ctr += 1
          with open(dest_path, 'w') as fp:
            fp.write(fm + md)
            print(ctr, root, '->', dest_path)
            if max and ctr >= max:
              break
    if max and ctr >= max:
      break
    
  tags = []
  for t in sorted(all_tags.keys()):
    tags.append(f'"{t}": {all_tags[t]}')
  # print(', '.join(tags))
  
  '''
  orig = f'{path}/orig.md'
  index = f'{path}/index.md'
  if not os.path.exists(orig):
    shutil.copy(index, orig)
  md = pathlib.Path(orig if kwargs['orig'] else index).read_text(encoding='utf-8'
  
  md = convert_permalink(md)
  md = insert_blank_line_before_param_blocks(md)
  md = convert_entity_infoboxes(md)
  md = convert_zoomto_links(md)
  md = convert_flyto_links(md)
  md = convert_params(md)
  
  with open(index, 'w') as fp:
    fp.write(md)
  '''

if __name__ == '__main__':
  parser = argparse.ArgumentParser(description='Converts a V1 Juncture essay to latest format.')  
  parser.add_argument('--src', default='/Users/ron/projects/kent-map/kent', help='Path to source directory')
  parser.add_argument('--dest', default='/Users/ron/projects/kent-map/chirpy/_posts', help='Path to destination directory')
  parser.add_argument('--max', type=int, default=None, help='Maximum number of files to convert')

  args = vars(parser.parse_args())

  convert(**args)
