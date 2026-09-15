const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SCORE_RATIO = 0.05;
const DEFAULT_DEBOUNCE_MS = 150;

export function normalizePagefindBaseUrl(value) {
  let baseUrl = String(value || '').trim();
  if (baseUrl === '' || baseUrl === '/') return '/';
  if (!baseUrl.startsWith('/')) baseUrl = `/${baseUrl}`;
  return `${baseUrl.replace(/\/+$/, '')}/`;
}

export function filterPagefindResults(results, minimumRatio = DEFAULT_SCORE_RATIO) {
  if (!Array.isArray(results) || results.length === 0) return [];

  const ratio = Number(minimumRatio);
  const topScore = Number(results[0].score);
  if (!Number.isFinite(ratio) || ratio <= 0 || !Number.isFinite(topScore) || topScore <= 0) {
    return [...results];
  }

  return results.filter((result) => Number(result.score) >= topScore * ratio);
}

export function pagefindResultModel(result) {
  const data = result && typeof result === 'object' ? result : {};
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  const url = typeof data.url === 'string' && data.url !== '' ? data.url : '#';

  return {
    url,
    title: typeof meta.title === 'string' && meta.title !== '' ? meta.title : url,
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
    categories: typeof meta.categories === 'string' ? meta.categories : '',
    tags: typeof meta.tags === 'string' ? meta.tags : ''
  };
}

export function runPagefindSearch(pagefind, query, debounceMs = DEFAULT_DEBOUNCE_MS) {
  return pagefind.debouncedSearch(query, undefined, debounceMs);
}

function appendMetadata(container, iconClass, value) {
  if (!value) return;

  const item = document.createElement('div');
  item.className = 'me-sm-4';

  const icon = document.createElement('i');
  icon.className = iconClass;
  icon.setAttribute('aria-hidden', 'true');
  item.append(icon, document.createTextNode(value));
  container.append(item);
}

function renderResult(result) {
  const model = pagefindResultModel(result);
  const article = document.createElement('article');
  article.className = 'px-1 px-sm-2 px-lg-4 px-xl-0';

  const header = document.createElement('header');
  const heading = document.createElement('h2');
  const link = document.createElement('a');
  link.href = model.url;
  link.textContent = model.title;
  heading.append(link);
  header.append(heading);

  if (model.categories || model.tags) {
    const metadata = document.createElement('div');
    metadata.className = 'post-meta d-flex flex-column flex-sm-row text-muted mt-1 mb-1';
    appendMetadata(metadata, 'far fa-folder fa-fw', model.categories);
    appendMetadata(metadata, 'fa fa-tag fa-fw', model.tags);
    header.append(metadata);
  }

  const excerpt = document.createElement('p');
  // Pagefind HTML-escapes excerpts and adds only its own <mark> elements.
  excerpt.innerHTML = model.excerpt;
  article.append(header, excerpt);
  return article;
}

export function mountEntrelumaPagefind(options) {
  const {
    input,
    results,
    notFoundHtml,
    pagefindUrl,
    baseUrl,
    production,
    fallback,
    pageSize = DEFAULT_PAGE_SIZE,
    minimumScoreRatio = DEFAULT_SCORE_RATIO,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    importer = (url) => import(url)
  } = options;

  if (!input || !results) return;

  results.setAttribute('aria-live', 'polite');

  const count = document.createElement('p');
  count.className = 'text-muted small w-100';
  count.setAttribute('role', 'status');
  count.hidden = true;
  results.insertAdjacentElement('beforebegin', count);

  const loadMore = document.createElement('button');
  loadMore.id = 'search-load-more';
  loadMore.type = 'button';
  loadMore.className = 'btn btn-outline-secondary d-none mx-auto w-100 my-3';
  loadMore.setAttribute('aria-controls', results.id);
  results.insertAdjacentElement('afterend', loadMore);

  let mode = production ? 'pagefind' : 'fallback';
  let pagefindPromise;
  let activeSearch = null;
  let generation = 0;

  function setLoadMoreVisible(visible) {
    loadMore.classList.toggle('d-block', visible);
    loadMore.classList.toggle('d-none', !visible);
  }

  function clearPagefindUi() {
    activeSearch = null;
    results.replaceChildren();
    count.hidden = true;
    count.textContent = '';
    loadMore.textContent = '';
    loadMore.disabled = false;
    setLoadMoreVisible(false);
  }

  function activateFallback() {
    if (mode === 'fallback-mounted') return;
    mode = 'fallback-mounted';
    generation += 1;
    clearPagefindUi();
    fallback();
  }

  if (!production) {
    activateFallback();
    return;
  }

  function loadPagefind() {
    if (!pagefindPromise) {
      pagefindPromise = importer(pagefindUrl)
        .then(async (pagefind) => {
          await pagefind.options({
            baseUrl: normalizePagefindBaseUrl(baseUrl),
            ranking: { termSimilarity: 5.0 }
          });
          await pagefind.init();
          return pagefind;
        })
        .catch((error) => {
          console.warn('Pagefind is unavailable; using Chirpy search instead.', error);
          return null;
        });
    }
    return pagefindPromise;
  }

  async function renderNextPage() {
    const search = activeSearch;
    if (!search || search.loading) return;

    const batch = search.results.slice(search.shown, search.shown + pageSize);
    if (batch.length === 0) return;

    search.loading = true;
    loadMore.disabled = true;
    let entries;
    try {
      entries = await Promise.all(batch.map((result) => result.data()));
    } catch (error) {
      if (activeSearch === search) {
        console.warn('Pagefind results could not be loaded; using Chirpy search instead.', error);
        activateFallback();
      }
      return;
    }
    if (activeSearch !== search) return;

    entries.forEach((entry) => results.append(renderResult(entry)));
    search.shown += entries.length;
    search.loading = false;
    loadMore.disabled = false;

    const remaining = search.results.length - search.shown;
    loadMore.textContent = remaining > 0 ? `Load more (${remaining} remaining)` : '';
    setLoadMoreVisible(remaining > 0);
  }

  input.addEventListener('focus', () => {
    // Warm the Pagefind bundle before typing. If it is unavailable, the input
    // handler mounts the fallback with the user's current query.
    void loadPagefind();
  }, { once: true });

  input.addEventListener('input', async () => {
    if (mode === 'fallback-mounted') return;

    const requestGeneration = ++generation;
    const query = input.value.trim();
    if (query === '') {
      clearPagefindUi();
      return;
    }

    const pagefind = await loadPagefind();
    if (requestGeneration !== generation) return;
    if (!pagefind) {
      activateFallback();
      return;
    }

    let search;
    try {
      search = await runPagefindSearch(pagefind, query, debounceMs);
    } catch (error) {
      if (requestGeneration === generation) {
        console.warn('Pagefind search failed; using Chirpy search instead.', error);
        activateFallback();
      }
      return;
    }
    if (requestGeneration !== generation || input.value.trim() !== query || !search) return;

    const filtered = filterPagefindResults(search.results, minimumScoreRatio);
    activeSearch = { results: filtered, shown: 0, loading: false };
    results.replaceChildren();
    setLoadMoreVisible(false);

    if (filtered.length === 0) {
      results.innerHTML = notFoundHtml;
      count.hidden = true;
      return;
    }

    count.textContent = `${filtered.length} result${filtered.length === 1 ? '' : 's'}`;
    count.hidden = false;
    await renderNextPage();
  });

  loadMore.addEventListener('click', () => void renderNextPage());
}
