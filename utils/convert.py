#!/usr/bin/env python
# -*- coding: utf-8 -*-

from operator import index
import os
import argparse
import pathlib
import re
import shlex
import shutil
import json
from urllib.parse import unquote
from copy import deepcopy
from pathlib import Path
from datetime import datetime

import markdown
from bs4 import BeautifulSoup

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

first = None

def convert_params(md):
  
  # attribution caption cover description fit label license manifest region rotate seq src title url 
  image_attrs = set()
  def transform_image(attrs):
    is_wc = False
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-image',]: continue
      image_attrs.add(key)
      if key in ['src', 'url']:
        if value.startswith('wc:') or '.wikimedia.org' in value:
          is_wc = True
          wc_title = unquote(value.replace('wc:','').split('/')[-1]).replace(' ','_')
          repl_attrs['src'] = f'wc:{wc_title}'
        else:
          repl_attrs['src'] = value
      if key == 'manifest':
        if value.startswith('wc:'):
          is_wc = True
          wc_title = unquote(value.replace('wc:','')).replace(' ','_')
          repl_attrs['src'] = f'wc:{wc_title}'
        elif value.startswith('gh:'):
          repl_attrs['src'] = value
        else:
          repl_attrs['manifest'] = value
      elif key == 'fit':
        if value == 'cover':
          repl_attrs['cover'] = None
      elif key == 'title':
          repl_attrs['caption'] = value
      elif key in ['attribution', 'caption', 'description', 'label', 'license', 'region', 'rotate', 'seq']:
        repl_attrs[key] = value
      elif key in ['cover',]: # boolean attribute
        repl_attrs[key] = None
    if is_wc:
      for key in ['label', 'description', 'attribution', 'license']:
        if key in repl_attrs: del repl_attrs[key]
    repl_str = '`image'
    for key, value in repl_attrs.items():
      if value is None:
        repl_str += f' {key}'
      else:
        if ' ' in value: value = f'"{value}"'
        repl_str += f' {key}={value}'
    repl_str += '`'
    return repl_str
  
  # basemap center zoom
  map_attrs = set()
  def transform_map(attrs):
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-map',]: continue
      map_attrs.add(key)
      if key == 'title':
          repl_attrs['caption'] = value
      elif key in ['caption',]:
        repl_attrs[key] = value
      elif key in ['basemap', 'center', 'zoom']:
        repl_attrs[key] = value.replace(' ', '')
      #elif key in ['cover',]: # boolean attributes
      #  repl_attrs[key] = None
    repl_str = '`map'
    for key, value in repl_attrs.items():
      if value is None:
        repl_str += f' {key}'
      else:
        if ' ' in value: value = f'"{value}"'
        repl_str += f' {key}={value}'
    repl_str += '`'
    return repl_str
  
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
  
  def transform_knightlab_timeline(attrs):
    repl_attrs = {}
    for key, value in attrs.items():
      if key in ['ve-knightlab-timeline',]: continue
      repl_attrs[key] = value
    
    repl_str = '`iframe src=https://cdn.knightlab.com/libs/timeline3/latest/embed/index.html'
    for key, value in repl_attrs.items():
      repl_str += f' {key}={value}'
    repl_str += '`'
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
    if 've-map-layer' in attrs: return transform_map_layer(attrs)
    if 've-map-marker' in attrs: return transform_map_marker(attrs)
    if 've-video' in attrs: return transform_video(attrs)
    if 've-compare' in attrs: return transform_compare(attrs)
    if 've-knightlab-timeline' in attrs: return transform_knightlab_timeline(attrs)
    if 've-iframe' in attrs: return transform_iframe(attrs)

    return full_tag

  regex = re.compile(r'^[ \t]*<param\s+(.+?)>[ \t]*$', re.DOTALL | re.MULTILINE)
  md = regex.sub(transform, md)
  print('image attrs', sorted(image_attrs))
  print('map attrs', sorted(map_attrs))
  print('map_layer attrs', sorted(map_layer_attrs))
  print('map_marker attrs', sorted(map_marker_attrs))
  print('video attrs', sorted(video_attrs))
  print('compare attrs', sorted(compare_attrs))
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
    print(json.dumps(thumbnails, indent=2))
  
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
    
    fm = {
      'title': f'"{config_attrs.get("title","")}"',
      'description': f'"{config_attrs.get("description","")}"',
      'author': config_attrs.get('author',''),
      'date': kwargs.get('date',''),
      'layout': 'post',
      'image': thumbnails.get(kwargs.get('permalink','').split('/')[-2], ''),
      'permalink': kwargs.get('permalink',''),
      'categories': kwargs.get('categories','[]'),
      'tags': '[]',
      'published': 'true',
      'featured': 'false'
    }
    m_lines = ['---']
    for key in 'title description author date layout image permalink categories tags published featured'.split():
      m_lines.append(f'{key}: {fm[key]}')
    m_lines.append('---\n')
    return '\n'.join(m_lines)
  
def convert(src, dest, max=None, **kwargs):
  ctr = 0
  for root, dir, files in os.walk(src):
    for fname in files:
      if fname == 'README.md' and not dir:
        src_path = root.split('/')
        print('src_path', src_path)
        creation_date = datetime.fromtimestamp(Path(root).stat().st_birthtime).strftime('%Y-%m-%d')
        category = src_path[-2]
        base_fname = src_path[-1] if not src_path[-1].startswith(category) else src_path[-1][len(category)+1:]
        dest_path = f'{dest}/{creation_date}-{base_fname}.md'
  
        md = pathlib.Path(root + '/README.md').read_text(encoding='utf-8')
        fm = get_front_matter(root, md, **{'date': creation_date, 'categories': f'[{category}]', 'permalink': f'/{category}/{base_fname}/'})
        if fm:
          print(fm)
          ctr += 1
          with open(dest_path, 'w') as fp:
            fp.write(fm + '\n' + md)
            print(ctr, root, '->', dest_path)
            if max and ctr >= max:
              break
    if max and ctr >= max:
      break
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
  parser.add_argument('--orig', default=False, action='store_true', help='Use original version')

  args = vars(parser.parse_args())

  convert(max=10, **args)
