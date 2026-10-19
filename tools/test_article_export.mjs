import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('article export is local and uses a pinned, integrity-checked Word dependency', async () => {
  const include = await read('_includes/article-download.html');
  const legacy = await read('_includes/pdf-download.html');

  assert.match(include, /page\.url \| absolute_url/);
  assert.match(include, /jszip@3\.10\.1\/dist\/jszip\.min\.js/);
  assert.match(include, /sha384-\+mbV2IY1Zk\/X1p\/nWllGySJSUN8uMs\+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG/);
  assert.doesNotMatch(include + legacy, /pdf-converter|\.run\.app\/pdf/);
  assert.match(legacy, /include article-download\.html/);
});

test('PDF preparation preserves internal targets and replaces interactive frames', async () => {
  const source = await read('assets/js/article-export.js');

  assert.match(source, /idMap\.set\(oldId, newId\)/);
  assert.match(source, /link\.setAttribute\('href', `#\$\{idMap\.get\(oldId\)\}`\)/);
  assert.match(source, /await replaceFrames\(source, clone, config\)/);
  assert.match(source, /className = 'article-export-note'/);
  assert.match(source, /window\.print\(\)/);
});

test('map export composites Leaflet tiles and markers while retaining its online link', async () => {
  const source = await read('assets/js/article-export.js');
  const styles = await read('assets/css/article-export.css');
  const map = await read('assets/components/map.html');

  assert.match(source, /\.leaflet-tile-pane img/);
  assert.match(source, /\.leaflet-marker-pane img/);
  assert.match(source, /canvas\.toDataURL\('image\/png'\)/);
  assert.match(source, /Open the interactive map online\./);
  assert.match(source, /article-export-float--right/);
  assert.match(styles, /\.article-print-sheet \.article-export-float--right/);
  assert.match(styles, /float: right !important/);
  assert.match(map, /markerStr\.split\("~"\)\.map\(part => part\.trim\(\)\)/);
});

test('Word export retains images and gives mixed nested lists separate numbering', async () => {
  const source = await read('assets/js/article-export.js');

  assert.match(source, /node\.tagName === 'IMG' \|\| node\.querySelector\?\.\('img'\)/);
  assert.match(source, /inherited\.ordered === ordered \? inherited\.numId : addNumbering/);
  assert.match(source, /word\/media\/\$\{record\.filename\}/);
  assert.match(source, /relationships\/styles/);
  assert.match(source, /relationships\/numbering/);
});

test('the post layout supports the new setting and the legacy pdf alias', async () => {
  const layout = await read('_layouts/post.html');

  assert.match(layout, /page\.entreluma\.downloads/);
  assert.match(layout, /site\.entreluma\.pdf/);
  assert.match(layout, /include article-download\.html/);
});
