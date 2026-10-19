(function () {
  'use strict';

  const EXPORT_PARAM = 'article-export';
  const CLEAN_SELECTORS = [
    'script', 'style', 'noscript', 'template', 'form', 'button', 'dialog',
    '.article-download', '.toolbar', '.post-navigation', '.share-wrapper',
    '.readtime', '.post-tail-wrapper'
  ];

  function escapeXml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function safeUrl(value, base = document.baseURI) {
    try {
      return new URL(value, base);
    } catch (_) {
      return null;
    }
  }

  function slug(value) {
    return String(value || 'article')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'article';
  }

  function directText(node) {
    return Array.from(node?.childNodes || [])
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function configFor(root) {
    const configuredSource = safeUrl(root.dataset.sourceUrl || location.href.split('#')[0]);
    const currentSource = safeUrl(location.pathname, location.origin);
    return {
      root,
      title: root.dataset.title || document.title,
      description: root.dataset.description || '',
      author: root.dataset.author || '',
      date: root.dataset.date || '',
      sourceUrl: ['http:', 'https:'].includes(location.protocol) ? currentSource.href : (configuredSource?.href || location.href.split('#')[0]),
      heroUrl: root.dataset.heroUrl || '',
      jszipSrc: root.dataset.jszipSrc,
      jszipIntegrity: root.dataset.jszipIntegrity
    };
  }

  function displayDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  }

  function setStatus(config, message, timeout = 0) {
    const status = config.root.querySelector('.article-download__status');
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(status._clearTimer);
    if (timeout) {
      status._clearTimer = window.setTimeout(() => { status.textContent = ''; }, timeout);
    }
  }

  function setBusy(config, busy) {
    config.root.classList.toggle('is-busy', busy);
    config.root.querySelectorAll('button').forEach((button) => {
      button.disabled = busy;
    });
  }

  function normalizeClone(source, clone) {
    const sourceElements = [source, ...source.querySelectorAll('*')];
    const cloneElements = [clone, ...clone.querySelectorAll('*')];
    const idMap = new Map();

    cloneElements.forEach((element, index) => {
      if (element.id) {
        const oldId = element.id;
        const safeId = oldId.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24);
        const newId = `article_${index}_${safeId}`;
        idMap.set(oldId, newId);
        element.id = newId;
      }

      ['src', 'poster'].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        const url = value && safeUrl(value);
        if (url) element.setAttribute(attribute, url.href);
      });

      const href = element.getAttribute('href');
      if (href && !href.startsWith('#')) {
        const url = safeUrl(href);
        if (url) element.setAttribute('href', url.href);
      }

      const original = sourceElements[index];
      if (element.tagName === 'IMG' && original?.tagName === 'IMG') {
        if (!element.getAttribute('width') && original.naturalWidth) {
          element.setAttribute('width', original.naturalWidth);
        }
        if (!element.getAttribute('height') && original.naturalHeight) {
          element.setAttribute('height', original.naturalHeight);
        }
        element.loading = 'eager';
      }
    });

    clone.querySelectorAll('a[href^="#"]').forEach((link) => {
      const oldId = decodeURIComponent(link.getAttribute('href').slice(1));
      if (idMap.has(oldId)) link.setAttribute('href', `#${idMap.get(oldId)}`);
    });

    CLEAN_SELECTORS.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((element) => element.remove());
    });
    clone.querySelectorAll('[contenteditable]').forEach((element) => element.removeAttribute('contenteditable'));
    return clone;
  }

  function iframeLabel(iframe) {
    if (iframe.classList.contains('embed-map')) return 'Interactive map';
    if (iframe.classList.contains('embed-youtube')) return 'Video';
    if (iframe.classList.contains('embed-vimeo')) return 'Video';
    if (iframe.classList.contains('embed-vis-network')) return 'Interactive network';
    if (iframe.classList.contains('embed-image-compare')) return 'Interactive image comparison';
    if (iframe.classList.contains('embed-image')) return 'Interactive image';
    return iframe.title || 'Interactive content';
  }

  function youtubePoster(url) {
    if (!url) return '';
    const src = url.searchParams.get('src') || url.searchParams.get('vid') || url.searchParams.get('id') || url.href;
    if (/^[\w-]{6,}$/.test(src)) return `https://i.ytimg.com/vi/${src}/hqdefault.jpg`;
    const match = src.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/i);
    return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : '';
  }

  function imageFromFrame(sourceFrame) {
    try {
      const image = sourceFrame.contentDocument?.querySelector('main img, .openseadragon-canvas img, img');
      if (image?.currentSrc || image?.src) return image.currentSrc || image.src;
    } catch (_) {
      // Cross-origin frames intentionally fall back to a linked note.
    }
    const url = safeUrl(sourceFrame.src);
    const candidate = url?.searchParams.get('src');
    const candidateUrl = candidate && safeUrl(candidate, url);
    return candidateUrl?.href || '';
  }

  function frameCaption(sourceFrame, frameUrl, fallback) {
    try {
      const caption = sourceFrame.contentDocument?.querySelector('.caption-text, figcaption');
      const rendered = (caption?.innerText || caption?.textContent)?.replace(/\s+/g, ' ').trim();
      if (rendered) return rendered;
    } catch (_) {
      // Cross-origin frames fall back to their URL parameters or label.
    }
    return frameUrl?.searchParams.get('caption') || fallback;
  }

  function applyExportPlacement(sourceFrame, replacement) {
    if (sourceFrame.classList.contains('full')) replacement.classList.add('article-export-full');
    if (sourceFrame.classList.contains('left')) {
      replacement.classList.add('article-export-float', 'article-export-float--left');
    } else if (sourceFrame.classList.contains('right') || sourceFrame.classList.contains('float')) {
      replacement.classList.add('article-export-float', 'article-export-float--right');
    }
    return replacement;
  }

  async function drawableImage(url) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await createImageBitmap(await response.blob());
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  function intersectsMap(elementRect, mapRect) {
    return elementRect.width > 0 && elementRect.height > 0 &&
      elementRect.right > mapRect.left && elementRect.left < mapRect.right &&
      elementRect.bottom > mapRect.top && elementRect.top < mapRect.bottom;
  }

  async function drawMapImages(context, elements, mapRect, scale) {
    let drawn = 0;
    let expected = 0;
    const images = await Promise.all(elements.map(async (element) => {
      const rect = element.getBoundingClientRect();
      const style = element.ownerDocument.defaultView.getComputedStyle(element);
      if (!intersectsMap(rect, mapRect) || style.display === 'none' || Number(style.opacity) === 0) return null;
      const url = element.currentSrc || element.src;
      if (!url) return null;
      expected += 1;
      try {
        return { bitmap: await drawableImage(url), rect, opacity: Number(style.opacity) || 1 };
      } catch (error) {
        console.warn('Article export could not rasterize a map image:', url, error);
        return null;
      }
    }));

    images.forEach((record) => {
      if (!record) return;
      context.save();
      context.globalAlpha = record.opacity;
      context.drawImage(
        record.bitmap,
        (record.rect.left - mapRect.left) * scale,
        (record.rect.top - mapRect.top) * scale,
        record.rect.width * scale,
        record.rect.height * scale
      );
      context.restore();
      record.bitmap.close();
      drawn += 1;
    });
    return { drawn, expected };
  }

  async function drawMapSvg(context, svg, mapRect, scale) {
    const rect = svg.getBoundingClientRect();
    if (!intersectsMap(rect, mapRect)) return;
    const clone = svg.cloneNode(true);
    const sourceShapes = svg.querySelectorAll('path, circle, ellipse, line, polygon, polyline, rect');
    const clonedShapes = clone.querySelectorAll('path, circle, ellipse, line, polygon, polyline, rect');
    sourceShapes.forEach((shape, index) => {
      const style = shape.ownerDocument.defaultView.getComputedStyle(shape);
      ['fill', 'fillOpacity', 'stroke', 'strokeOpacity', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin'].forEach((property) => {
        clonedShapes[index]?.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), style[property]);
      });
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const bitmap = await createImageBitmap(blob);
    context.drawImage(
      bitmap,
      (rect.left - mapRect.left) * scale,
      (rect.top - mapRect.top) * scale,
      rect.width * scale,
      rect.height * scale
    );
    bitmap.close();
  }

  async function waitForLeafletMap(sourceFrame, timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const frameDocument = sourceFrame.contentDocument;
        const map = frameDocument?.querySelector('#map, .leaflet-container');
        const mapRect = map?.getBoundingClientRect();
        const tiles = map && Array.from(map.querySelectorAll('.leaflet-tile-pane img'));
        const visibleTiles = mapRect && tiles?.filter((tile) => intersectsMap(tile.getBoundingClientRect(), mapRect));
        const tilesReady = visibleTiles?.length && visibleTiles.every((tile) => {
          const opacity = Number(frameDocument.defaultView.getComputedStyle(tile).opacity);
          return tile.complete && tile.naturalWidth && opacity >= 0.99;
        });
        if (mapRect?.width > 0 && mapRect?.height > 0 && tilesReady) {
          return { frameDocument, map, mapRect };
        }
      } catch (_) {
        return null;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return null;
  }

  async function staticMapFromFrame(sourceFrame) {
    const renderedMap = await waitForLeafletMap(sourceFrame);
    if (!renderedMap || !('createImageBitmap' in window)) {
      console.warn('Article export could not find a completed Leaflet map to rasterize.');
      return null;
    }
    const { frameDocument, map, mapRect } = renderedMap;

    const scale = Math.min(2, 1600 / Math.max(mapRect.width, mapRect.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(mapRect.width * scale));
    canvas.height = Math.max(1, Math.round(mapRect.height * scale));
    const context = canvas.getContext('2d');
    context.scale(1, 1);
    context.fillStyle = frameDocument.defaultView.getComputedStyle(map).backgroundColor || '#e5e3df';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const tileResult = await drawMapImages(
      context,
      Array.from(map.querySelectorAll('.leaflet-tile-pane img')),
      mapRect,
      scale
    );
    if (!tileResult.drawn || tileResult.drawn < tileResult.expected) {
      console.warn('Article export could not rasterize every visible Leaflet map tile.');
      return null;
    }

    await drawMapImages(
      context,
      Array.from(map.querySelectorAll('.leaflet-overlay-pane img, .leaflet-shadow-pane img')),
      mapRect,
      scale
    );
    for (const svg of map.querySelectorAll('.leaflet-overlay-pane svg')) {
      try {
        await drawMapSvg(context, svg, mapRect, scale);
      } catch (_) {
        // Image overlays and markers still provide a useful map if a vector layer cannot be serialized.
      }
    }
    await drawMapImages(
      context,
      Array.from(map.querySelectorAll('.leaflet-marker-pane img')),
      mapRect,
      scale
    );

    const attribution = frameDocument.querySelector('.leaflet-control-attribution')?.textContent
      ?.replace(/\s+/g, ' ').trim() || '';
    return { url: canvas.toDataURL('image/png'), attribution };
  }

  function appendOnlineLink(caption, sourceFrame, config, label = 'Open this item in the online edition') {
    caption.append(' ');
    const link = document.createElement('a');
    const sourceAnchor = sourceFrame.id ? `#${encodeURIComponent(sourceFrame.id)}` : '';
    link.className = 'article-export-online-link';
    link.href = `${config.sourceUrl}${sourceAnchor}`;
    link.textContent = label;
    caption.appendChild(link);
  }

  async function frameReplacement(sourceFrame, clonedFrame, config) {
    const frameUrl = safeUrl(sourceFrame.src);
    const label = iframeLabel(sourceFrame);
    let imageUrl = '';
    let mapImage = null;
    if (sourceFrame.classList.contains('embed-youtube')) imageUrl = youtubePoster(frameUrl);
    if (sourceFrame.classList.contains('embed-image')) imageUrl = imageFromFrame(sourceFrame);
    if (sourceFrame.classList.contains('embed-map')) mapImage = await staticMapFromFrame(sourceFrame);
    if (mapImage) imageUrl = mapImage.url;

    if (imageUrl) {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.className = 'article-export-image';
      image.src = imageUrl;
      const captionText = frameCaption(sourceFrame, frameUrl, label);
      image.alt = captionText;
      image.loading = 'eager';
      figure.appendChild(image);
      const caption = document.createElement('figcaption');
      caption.append(captionText);
      if (mapImage) {
        appendOnlineLink(caption, sourceFrame, config, 'Open the interactive map online.');
        if (mapImage.attribution) {
          const attribution = document.createElement('span');
          attribution.className = 'article-export-map-attribution';
          attribution.textContent = mapImage.attribution;
          caption.appendChild(attribution);
        }
      }
      figure.appendChild(caption);
      return applyExportPlacement(sourceFrame, figure);
    }

    const note = document.createElement('p');
    note.className = 'article-export-note';
    note.append(`${label}:`);
    if (frameUrl) {
      appendOnlineLink(note, sourceFrame, config);
    } else {
      note.append('available in the online edition');
    }
    return applyExportPlacement(sourceFrame, note);
  }

  async function replaceFrames(source, clone, config) {
    const sourceFrames = Array.from(source.querySelectorAll('iframe'));
    const clonedFrames = Array.from(clone.querySelectorAll('iframe'));
    const replacements = await Promise.all(clonedFrames.map((frame, index) => {
      return frameReplacement(sourceFrames[index] || frame, frame, config);
    }));
    clonedFrames.forEach((frame, index) => {
      frame.replaceWith(replacements[index]);
    });
  }

  function collapseEntityPopups(clone) {
    clone.querySelectorAll('.entity-popup').forEach((popup) => {
      const trigger = popup.querySelector('[slot="trigger"]');
      const destination = popup.querySelector('[slot="footer"] a[href]');
      const replacement = destination ? document.createElement('a') : document.createElement('span');
      replacement.textContent = trigger?.textContent?.replace(/\s+/g, ' ').trim() || 'Related information';
      if (destination) replacement.href = destination.href;
      popup.replaceWith(replacement);
    });
  }

  function flattenGroupedEmbeds(clone) {
    clone.querySelectorAll('sl-tab-group').forEach((group) => {
      const container = document.createElement('div');
      container.className = 'article-export-tab-content';
      group.querySelectorAll('sl-tab-panel').forEach((panel) => {
        const section = document.createElement('section');
        while (panel.firstChild) section.appendChild(panel.firstChild);
        container.appendChild(section);
      });
      group.replaceWith(container);
    });
    clone.querySelectorAll('sl-carousel').forEach((carousel) => {
      const container = document.createElement('div');
      container.className = 'article-export-carousel-content';
      carousel.querySelectorAll('sl-carousel-item').forEach((item) => {
        while (item.firstChild) container.appendChild(item.firstChild);
      });
      carousel.replaceWith(container);
    });
  }

  function renderedHero(config) {
    const sourceImage = document.querySelector('article > header .preview-img img, article > header img.preview-img');
    if (!sourceImage && !config.heroUrl) return null;

    const figure = document.createElement('figure');
    figure.className = 'article-print-sheet__hero';
    const image = document.createElement('img');
    const declaredSource = sourceImage?.getAttribute('src');
    image.src = (declaredSource && safeUrl(declaredSource)?.href) || sourceImage?.currentSrc || sourceImage?.src || config.heroUrl;
    image.alt = sourceImage?.alt || config.title;
    image.loading = 'eager';
    figure.appendChild(image);

    const container = sourceImage?.closest('.mt-3') || sourceImage?.parentElement;
    const caption = container?.querySelector('figcaption');
    const attribution = container?.querySelector('.sk-header-attribution');
    if (caption?.textContent.trim()) figure.appendChild(caption.cloneNode(true));
    if (attribution?.textContent.trim()) figure.appendChild(attribution.cloneNode(true));
    return figure;
  }

  async function preparedArticle(config) {
    const source = document.querySelector('.post-content');
    if (!source) throw new Error('Article content was not found.');
    const clone = normalizeClone(source, source.cloneNode(true));
    collapseEntityPopups(clone);
    await replaceFrames(source, clone, config);
    clone.querySelectorAll('.float-pair').forEach((pair) => {
      if (!pair.querySelector(':scope > .article-export-float')) return;
      pair.classList.add('article-export-float-pair');
      const section = pair.parentElement?.matches('section') &&
        pair.parentElement.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6')
        ? pair.parentElement : null;
      if (section) {
        section.classList.add('article-export-float-section');
      } else {
        pair.classList.add('article-export-new-page');
      }
    });
    flattenGroupedEmbeds(clone);
    return clone;
  }

  async function buildPrintSheet(config) {
    document.querySelectorAll('.article-print-sheet').forEach((sheet) => sheet.remove());
    const sheet = document.createElement('main');
    sheet.className = 'article-print-sheet';
    sheet.setAttribute('aria-label', `Printable article: ${config.title}`);

    const header = document.createElement('header');
    header.className = 'article-print-sheet__header';
    const title = document.createElement('h1');
    title.className = 'article-print-sheet__title';
    title.textContent = config.title;
    header.appendChild(title);

    if (config.description) {
      const description = document.createElement('p');
      description.className = 'article-print-sheet__description';
      description.textContent = config.description;
      header.appendChild(description);
    }

    const bylineParts = [config.author, displayDate(config.date)].filter(Boolean);
    if (bylineParts.length) {
      const byline = document.createElement('p');
      byline.className = 'article-print-sheet__byline';
      byline.textContent = bylineParts.join(' | ');
      header.appendChild(byline);
    }

    const source = document.createElement('p');
    source.className = 'article-print-sheet__source';
    source.append('Source: ');
    const sourceLink = document.createElement('a');
    sourceLink.className = 'article-print-sheet__source-link';
    sourceLink.href = config.sourceUrl;
    sourceLink.textContent = config.sourceUrl;
    source.appendChild(sourceLink);
    header.appendChild(source);
    sheet.appendChild(header);

    const hero = renderedHero(config);
    if (hero) sheet.appendChild(hero);
    sheet.appendChild(await preparedArticle(config));
    document.body.appendChild(sheet);
    return sheet;
  }

  async function waitForImages(container, timeoutMs = 12000) {
    const pending = Array.from(container.querySelectorAll('img')).map(async (image) => {
      if (image.complete && image.naturalWidth) return;
      try {
        if (image.decode) await image.decode();
        else await new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      } catch (_) {
        // Broken remote media remains represented by its alt text.
      }
    });
    await Promise.race([
      Promise.allSettled(pending),
      new Promise((resolve) => window.setTimeout(resolve, timeoutMs))
    ]);
  }

  async function waitForViewerMetadata(timeoutMs = 2500) {
    const pending = Array.from(document.querySelectorAll('.post-content iframe')).map((frame) => {
      try {
        if (frame.contentDocument?.readyState === 'complete') return Promise.resolve();
      } catch (_) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        frame.addEventListener('load', resolve, { once: true });
        frame.addEventListener('error', resolve, { once: true });
      });
    });
    await Promise.race([
      Promise.allSettled(pending),
      new Promise((resolve) => window.setTimeout(resolve, timeoutMs))
    ]);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }

  async function exportPdf(config, options = {}) {
    setBusy(config, true);
    setStatus(config, 'Preparing print-quality PDF…');
    try {
      await waitForViewerMetadata();
      const sheet = await buildPrintSheet(config);
      document.body.classList.add('article-export-printing');
      await waitForImages(sheet);
      setStatus(config, 'Choose “Save as PDF” in the print dialog.', 7000);
      if (options.print !== false) window.print();
      return sheet;
    } finally {
      setBusy(config, false);
    }
  }

  function loadJsZip(config) {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (window._entrelumaJsZipPromise) return window._entrelumaJsZipPromise;
    window._entrelumaJsZipPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = config.jszipSrc;
      script.integrity = config.jszipIntegrity;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('The Word export library could not be loaded.'));
      document.head.appendChild(script);
    });
    return window._entrelumaJsZipPromise;
  }

  function relsManager() {
    let next = 1;
    const entries = [];
    return {
      add(type, target, mode = '') {
        const id = `rId${next++}`;
        entries.push({ id, type, target, mode });
        return id;
      },
      xml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries.map((entry) => `<Relationship Id="${entry.id}" Type="${entry.type}" Target="${escapeXml(entry.target)}"${entry.mode ? ` TargetMode="${entry.mode}"` : ''}/>`).join('')}</Relationships>`;
      }
    };
  }

  async function blobDimensions(blob) {
    if ('createImageBitmap' in window) {
      const bitmap = await createImageBitmap(blob);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    }
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = reject;
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function wordCompatibleBlob(blob) {
    if (blob.type === 'image/png' || blob.type === 'image/jpeg') return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise((resolve, reject) => {
      canvas.toBlob((converted) => converted ? resolve(converted) : reject(new Error('Image conversion failed.')), 'image/png');
    });
  }

  async function collectImages(container, rels) {
    const records = new Map();
    let nextImage = 1;
    for (const image of container.querySelectorAll('img')) {
      const url = image.currentSrc || image.src;
      if (!url || records.has(url)) continue;
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const original = await response.blob();
        const blob = await wordCompatibleBlob(original);
        const dimensions = await blobDimensions(blob);
        const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
        const filename = `image${nextImage++}.${extension}`;
        const relId = rels.add('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', `media/${filename}`);
        records.set(url, {
          bytes: new Uint8Array(await blob.arrayBuffer()), filename, relId,
          width: dimensions.width, height: dimensions.height, contentType: blob.type
        });
      } catch (error) {
        console.warn('Article export could not embed an image:', url, error);
        records.set(url, { error: error.message });
      }
    }
    return records;
  }

  function imageDrawing(record, alt, drawingId) {
    const maxWidth = 6.3 * 914400;
    const maxHeight = 8.0 * 914400;
    const pxToEmu = 9525;
    const scale = Math.min(1, maxWidth / (record.width * pxToEmu), maxHeight / (record.height * pxToEmu));
    const cx = Math.round(record.width * pxToEmu * scale);
    const cy = Math.round(record.height * pxToEmu * scale);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${drawingId}" name="Picture ${drawingId}" descr="${escapeXml(alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${escapeXml(record.filename)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${record.relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  function run(text, styles = {}) {
    if (!text) return '';
    const properties = [
      styles.bold ? '<w:b/>' : '', styles.italic ? '<w:i/>' : '',
      styles.underline ? '<w:u w:val="single"/>' : '',
      styles.code ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="18"/>' : ''
    ].join('');
    return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }

  function inlineXml(node, context, styles = {}) {
    if (node.nodeType === Node.TEXT_NODE) return run(node.textContent, styles);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<w:r><w:br/></w:r>';
    if (tag === 'img') {
      const record = context.images.get(node.currentSrc || node.src);
      if (!record || record.error) return run(`[Image: ${node.alt || 'unavailable'}]`, { italic: true });
      return imageDrawing(record, node.alt || '', context.nextDrawingId++);
    }

    const nextStyles = {
      bold: styles.bold || ['strong', 'b'].includes(tag),
      italic: styles.italic || ['em', 'i', 'cite'].includes(tag),
      underline: styles.underline || tag === 'u',
      code: styles.code || tag === 'code'
    };
    const content = Array.from(node.childNodes).map((child) => inlineXml(child, context, nextStyles)).join('');
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (href.startsWith('#')) return `<w:hyperlink w:anchor="${escapeXml(href.slice(1))}">${content}</w:hyperlink>`;
      if (href) {
        const relId = context.rels.add('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', href, 'External');
        return `<w:hyperlink r:id="${relId}">${content}</w:hyperlink>`;
      }
    }
    return content;
  }

  function paragraphXml(content, options = {}) {
    const properties = [];
    if (options.style) properties.push(`<w:pStyle w:val="${options.style}"/>`);
    if (options.align) properties.push(`<w:jc w:val="${options.align}"/>`);
    if (options.keepNext) properties.push('<w:keepNext/>');
    if (options.numId) properties.push(`<w:numPr><w:ilvl w:val="${options.level || 0}"/><w:numId w:val="${options.numId}"/></w:numPr>`);
    if (options.pageBreakBefore) properties.push('<w:pageBreakBefore/>');
    let body = content || '';
    if (options.bookmark) {
      const id = options.bookmarkId || 1;
      body = `<w:bookmarkStart w:id="${id}" w:name="${escapeXml(options.bookmark)}"/>${body}<w:bookmarkEnd w:id="${id}"/>`;
    }
    return `<w:p>${properties.length ? `<w:pPr>${properties.join('')}</w:pPr>` : ''}${body}</w:p>`;
  }

  function paragraphBlocks(element, context, options = {}) {
    const blocks = [];
    let buffer = [];
    const flush = () => {
      if (!buffer.length) return;
      const wrapper = document.createElement('span');
      buffer.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
      blocks.push(paragraphXml(inlineXml(wrapper, context), options));
      buffer = [];
    };
    Array.from(element.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'IMG' || node.querySelector?.('img'))) {
        flush();
        const images = node.tagName === 'IMG' ? [node] : Array.from(node.querySelectorAll('img'));
        images.forEach((image) => blocks.push(paragraphXml(inlineXml(image, context), { align: 'center' })));
      } else {
        buffer.push(node);
      }
    });
    flush();
    return blocks.join('');
  }

  function tableXml(table, context) {
    const rows = Array.from(table.rows).map((row) => {
      const cells = Array.from(row.cells).map((cell) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraphXml(inlineXml(cell, context))}</w:tc>`).join('');
      return `<w:tr>${cells}</w:tr>`;
    }).join('');
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows}</w:tbl>`;
  }

  function addNumbering(context, ordered) {
    const numId = context.numberings.length + 1;
    context.numberings.push({ numId, ordered });
    return numId;
  }

  function listXml(list, context, level = 0, inherited = null) {
    const ordered = list.tagName.toLowerCase() === 'ol';
    const numId = inherited && inherited.ordered === ordered ? inherited.numId : addNumbering(context, ordered);
    let xml = '';
    Array.from(list.children).filter((item) => item.tagName === 'LI').forEach((item) => {
      const inlineNodes = Array.from(item.childNodes).filter((node) => !(node.nodeType === Node.ELEMENT_NODE && ['UL', 'OL'].includes(node.tagName)));
      const wrapper = document.createElement('span');
      inlineNodes.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
      xml += paragraphXml(inlineXml(wrapper, context), { numId, level: Math.min(level, 8) });
      Array.from(item.children).filter((child) => ['UL', 'OL'].includes(child.tagName)).forEach((child) => {
        xml += listXml(child, context, level + 1, { numId, ordered });
      });
    });
    return xml;
  }

  function elementBlocks(element, context) {
    if (element.nodeType === Node.TEXT_NODE) {
      const text = element.textContent.trim();
      return text ? paragraphXml(run(text)) : '';
    }
    if (element.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = element.tagName.toLowerCase();
    if (['script', 'style', 'button', 'form'].includes(tag)) return '';
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      return paragraphXml(inlineXml(element, context), {
        style: `Heading${level}`, keepNext: true,
        bookmark: element.id || '', bookmarkId: context.nextBookmarkId++
      });
    }
    if (tag === 'p') return paragraphBlocks(element, context, { bookmark: element.id || '', bookmarkId: context.nextBookmarkId++ });
    if (tag === 'ul' || tag === 'ol') return listXml(element, context);
    if (tag === 'table') return tableXml(element, context);
    if (tag === 'pre') return paragraphXml(run(element.textContent, { code: true }), { style: 'CodeBlock' });
    if (tag === 'blockquote') {
      return Array.from(element.children).map((child) => paragraphXml(inlineXml(child, context), { style: 'Quote' })).join('');
    }
    if (tag === 'figure') {
      let xml = '';
      element.querySelectorAll(':scope > img, :scope > a > img').forEach((image) => {
        xml += paragraphXml(inlineXml(image, context), { align: 'center' });
      });
      element.querySelectorAll(':scope > figcaption, :scope > .sk-header-attribution').forEach((caption) => {
        xml += paragraphXml(inlineXml(caption, context), { style: 'Caption', align: 'center' });
      });
      return xml;
    }
    if (tag === 'img') return paragraphXml(inlineXml(element, context), { align: 'center' });
    if (tag === 'hr') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="B7BCC2"/></w:pBdr></w:pPr></w:p>';
    if (element.classList.contains('footnotes')) {
      const children = Array.from(element.children).map((child) => elementBlocks(child, context)).join('');
      return paragraphXml('', { pageBreakBefore: true }) + children;
    }

    const blockChildren = Array.from(element.children).filter((child) => /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DIV|DL|FIELDSET|FIGCAPTION|FIGURE|FOOTER|HEADER|HR|MAIN|NAV|OL|P|PRE|SECTION|TABLE|UL|H[1-6])$/.test(child.tagName));
    if (blockChildren.length) return Array.from(element.childNodes).map((child) => elementBlocks(child, context)).join('');
    return paragraphBlocks(element, context);
  }

  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="160"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="52"/></w:rPr></w:style>${[1,2,3,4,5,6].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${level < 3 ? 320 : 240}" w:after="100"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="${Math.max(24, 38 - level * 3)}"/></w:rPr></w:style>`).join('')}<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="555555"/><w:sz w:val="27"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Byline"><w:name w:val="Byline"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="666666"/><w:sz w:val="19"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="480" w:right="240"/></w:pPr><w:rPr><w:i/><w:color w:val="444444"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F4F5F6"/><w:ind w:left="240" w:right="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
  }

  function numberingXml(numberings) {
    const abstracts = numberings.map((item) => `<w:abstractNum w:abstractNumId="${item.numId}">${Array.from({ length: 9 }, (_, level) => `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${item.ordered ? 'decimal' : 'bullet'}"/><w:lvlText w:val="${item.ordered ? `%${level + 1}.` : '•'}"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="${720 + level * 360}"/></w:tabs><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr></w:lvl>`).join('')}</w:abstractNum>`).join('');
    const nums = numberings.map((item) => `<w:num w:numId="${item.numId}"><w:abstractNumId w:val="${item.numId}"/></w:num>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${abstracts}${nums}</w:numbering>`;
  }

  async function createDocx(config, options = {}) {
    setBusy(config, true);
    setStatus(config, 'Preparing editable Word document…');
    try {
      const JSZip = await loadJsZip(config);
      await waitForViewerMetadata();
      const article = await preparedArticle(config);
      const documentRoot = document.createElement('div');
      const hero = renderedHero(config);
      if (hero) documentRoot.appendChild(hero);
      documentRoot.appendChild(article);

      const rels = relsManager();
      rels.add('http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', 'styles.xml');
      rels.add('http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', 'numbering.xml');
      await waitForImages(documentRoot);
      const images = await collectImages(documentRoot, rels);
      const context = { rels, images, numberings: [], nextDrawingId: 1, nextBookmarkId: 1 };
      let body = paragraphXml(run(config.title), { style: 'Title', keepNext: true });
      if (config.description) body += paragraphXml(run(config.description), { style: 'Subtitle' });
      const byline = [config.author, displayDate(config.date)].filter(Boolean).join(' | ');
      if (byline) body += paragraphXml(run(byline), { style: 'Byline' });
      body += paragraphXml(run(`Source: ${config.sourceUrl}`), { style: 'Byline' });
      body += Array.from(documentRoot.children).map((child) => elementBlocks(child, context)).join('');

      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
      const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(config.title)}</dc:title><dc:creator>${escapeXml(config.author)}</dc:creator><dc:description>${escapeXml(`Source: ${config.sourceUrl}`)}</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`;
      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
      const packageRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

      const zip = new JSZip();
      zip.file('[Content_Types].xml', contentTypes);
      zip.file('_rels/.rels', packageRels);
      zip.file('docProps/core.xml', coreXml);
      zip.file('word/document.xml', documentXml);
      zip.file('word/styles.xml', stylesXml());
      zip.file('word/numbering.xml', numberingXml(context.numberings));
      zip.file('word/_rels/document.xml.rels', rels.xml());
      images.forEach((record) => {
        if (!record.error) zip.file(`word/media/${record.filename}`, record.bytes);
      });
      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
      if (options.download !== false) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${slug(config.title)}.docx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 30000);
      }
      setStatus(config, 'Word document ready.', 3500);
      return blob;
    } finally {
      setBusy(config, false);
    }
  }

  function closeMenu(root) {
    const trigger = root.querySelector('.article-download__trigger');
    const menu = root.querySelector('.article-download__menu');
    if (!menu) return;
    menu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
  }

  function init(root) {
    if (root.dataset.articleExportReady === 'true') return;
    root.dataset.articleExportReady = 'true';
    const config = configFor(root);
    const trigger = root.querySelector('.article-download__trigger');
    const menu = root.querySelector('.article-download__menu');
    trigger?.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      trigger.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden) menu.querySelector('[role="menuitem"]')?.focus();
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu(root);
        trigger?.focus();
      }
    });
    root.querySelectorAll('[data-export-format]').forEach((button) => {
      button.addEventListener('click', async () => {
        const format = button.dataset.exportFormat;
        closeMenu(root);
        try {
          if (format === 'pdf') await exportPdf(config);
          if (format === 'docx') await createDocx(config);
        } catch (error) {
          console.error(error);
          setStatus(config, error.message || 'Export failed.', 6000);
          setBusy(config, false);
        }
      });
    });
    document.addEventListener('click', (event) => {
      if (!root.contains(event.target)) closeMenu(root);
    });
  }

  function initAll() {
    document.querySelectorAll('[data-article-export]').forEach(init);
    const params = new URLSearchParams(location.search);
    if (params.get(EXPORT_PARAM) === 'pdf') {
      const root = document.querySelector('[data-article-export]');
      if (root) {
        exportPdf(configFor(root), { print: params.get('article-export-auto') !== 'false' }).then(() => {
          if (params.get('article-export-preview') === 'true') document.body.classList.add('article-export-preview');
        });
      }
    }
  }

  window.EntrelumaArticleExport = { buildPrintSheet, exportPdf, createDocx, preparedArticle };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll, { once: true });
  else initAll();
  window.addEventListener('afterprint', () => document.body.classList.remove('article-export-printing'));
})();
