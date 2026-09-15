import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterPagefindResults,
  normalizePagefindBaseUrl,
  pagefindResultModel,
  runPagefindSearch
} from '../assets/js/entreluma-pagefind.mjs';

test('normalizes root and project-site base URLs', () => {
  assert.equal(normalizePagefindBaseUrl(''), '/');
  assert.equal(normalizePagefindBaseUrl('/'), '/');
  assert.equal(normalizePagefindBaseUrl('time-walk'), '/time-walk/');
  assert.equal(normalizePagefindBaseUrl('/time-walk/'), '/time-walk/');
});

test('filters weak matches relative to the strongest result', () => {
  const results = [{ score: 10 }, { score: 3 }, { score: 2.99 }];
  assert.deepEqual(filterPagefindResults(results, 0.3), results.slice(0, 2));
});

test('uses a modest relevance cutoff by default', () => {
  const results = [{ score: 10 }, { score: 0.1 }];
  assert.deepEqual(filterPagefindResults(results), results.slice(0, 1));
});

test('keeps results when scores cannot be compared safely', () => {
  const results = [{}, { score: 2 }];
  assert.deepEqual(filterPagefindResults(results), results);
  assert.deepEqual(filterPagefindResults(results, 0), results);
});

test('normalizes Pagefind result data for safe DOM rendering', () => {
  assert.deepEqual(pagefindResultModel({
    url: '/posts/example/',
    excerpt: 'Some <mark>matching</mark> text',
    meta: { title: 'Example', categories: 'Places', tags: 'Kent, Coast' }
  }), {
    url: '/posts/example/',
    title: 'Example',
    excerpt: 'Some <mark>matching</mark> text',
    categories: 'Places',
    tags: 'Kent, Coast'
  });
});

test('provides stable fallbacks for incomplete result data', () => {
  assert.deepEqual(pagefindResultModel({ url: '/posts/example/' }), {
    url: '/posts/example/',
    title: '/posts/example/',
    excerpt: '',
    categories: '',
    tags: ''
  });
});

test('uses a 150 ms Pagefind debounce by default', async () => {
  const calls = [];
  const pagefind = {
    debouncedSearch(...args) {
      calls.push(args);
      return Promise.resolve({ results: [] });
    }
  };

  await runPagefindSearch(pagefind, 'Canterbury');
  assert.deepEqual(calls, [['Canterbury', undefined, 150]]);
});

test('allows the Pagefind debounce to be tuned', async () => {
  const calls = [];
  const pagefind = {
    debouncedSearch(...args) {
      calls.push(args);
      return Promise.resolve({ results: [] });
    }
  };

  await runPagefindSearch(pagefind, 'Kent', 200);
  assert.deepEqual(calls, [['Kent', undefined, 200]]);
});
