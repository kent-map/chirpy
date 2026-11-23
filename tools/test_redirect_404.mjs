// Unit tests for the 404 redirect (_includes/redirect-404.html).
// Runs the script from the built 404 page with a fake location, so the test
// covers the generated lookup table as well as normalize/resolve/suggest.
// Cases are derived from the site's own pages and _data/redirects.yml, so the
// same test works on any Entreluma site.
//
// Usage: SITE_DIR=_site node --test tools/test_redirect_404.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const site = process.env.SITE_DIR || '_site';
const html = readFileSync(`${site}/404.html`, 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .find((s) => s.includes('window.entreluma404'));

function run(pathname) {
  const replaced = [];
  const ctx = {
    window: {},
    location: { pathname, search: '?q=1', hash: '#h', replace: (u) => replaced.push(u) },
    sessionStorage: { setItem() {} },
    document: { head: { appendChild() {} }, createElement: () => ({}) },
  };
  vm.runInNewContext(script, ctx);
  return { api: ctx.window.entreluma404, replaced };
}

test('the redirect script is in the built 404 page', () => {
  assert.ok(script, 'redirect script not found in 404.html');
});

test('normalize', () => {
  const { normalize } = run('/x').api;
  assert.equal(normalize('/Black_Eyed_Peas/'), '/black-eyed-peas');
  assert.equal(normalize('/Agave.html'), '/agave');
  assert.equal(normalize('//posts//guelder-rose/'), '/posts/guelder-rose');
  assert.equal(normalize('/%E2%80%8Bcoffee'), '/coffee');
  assert.equal(normalize('/'), '/');
});

const { api } = run('/x');
const base = api.base || '';
const P = (p) => base + p; /* site-relative path -> served path */
const pages = [...new Set(Object.values(api.table))].filter((u) => u !== '/');

test('the lookup table lists the site pages', () => {
  assert.ok(pages.length > 0, 'no pages in the lookup table');
});

test('case, trailing-slash, .html and underscore variants redirect to every page', () => {
  for (const url of pages) {
    const bare = url.replace(/\/$/, '');
    const variants = [
      bare.toUpperCase() + '/',
      bare + '.html',
      bare.replace(/-/g, '_'),
    ].filter((v) => v !== url);
    for (const v of variants) {
      const { replaced } = run(P(v));
      assert.deepEqual(replaced, [`${P(url)}?q=1#h`], `${v} should redirect to ${url}`);
    }
  }
});

test('explicit aliases from _data/redirects.yml', () => {
  for (const [from, to] of Object.entries(api.explicit)) {
    assert.equal(api.resolve(P(from + '/')), to, from);
  }
});

test('pattern rules', () => {
  const resolve = (p) => api.resolve(P(p));
  assert.equal(resolve('/Q11756'), 'https://www.wikidata.org/wiki/Q11756');
  assert.equal(resolve('/posts/some-essay/Q775'), 'https://www.wikidata.org/wiki/Q775');
  const essay = pages.find((u) => /^\/[\w-]+$/.test(u));
  if (essay) {
    const slug = essay.slice(1);
    assert.equal(resolve(`/assets/posts/${slug}/${slug}.pdf`), essay);
  }
  const guide = pages.find((u) => u.startsWith('/admin/entreluma-'));
  if (guide) {
    assert.equal(resolve(guide.replace('/admin/entreluma-', '/admin/storykit-')), guide);
  }
});

test('unknown paths stay on the 404 page and never go home', () => {
  for (const p of ['/no-such-page-at-all-xyz/', '/']) {
    const { api: a, replaced } = run(P(p));
    assert.equal(a.resolve(P(p)), null);
    assert.deepEqual(replaced, []);
  }
});

test('the 404 page never redirects to itself', () => {
  assert.deepEqual(run(P('/404.html')).replaced, []);
});

test('suggestions rank near-misses', () => {
  const target = pages.find((u) => /^\/[\w-]{6,}$/.test(u));
  if (!target) return;
  const typo = target.slice(0, -1);
  assert.equal(api.suggest(P(typo), 3)[0], target);
});
