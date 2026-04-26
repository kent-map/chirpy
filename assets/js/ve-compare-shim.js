// ve-compare-shim.js — debug version

(function () {

  function convert() {
    console.log('[ve-compare] shim running');

    // Try every plausible content container
    const candidates = [
      '.post-content',
      'article .content',
      '.content',
      'article',
      'main'
    ];

    let content = null;
    for (const sel of candidates) {
      content = document.querySelector(sel);
      if (content) {
        console.log('[ve-compare] found content with selector:', sel);
        break;
      }
    }

    if (!content) {
      console.warn('[ve-compare] could not find content container — tried:', candidates);
      return;
    }

    const html = content.innerHTML;
    console.log('[ve-compare] innerHTML contains ve-compare:', html.includes('ve-compare'));
    console.log('[ve-compare] innerHTML contains param:', html.toLowerCase().includes('<param'));

    // Log a snippet around any param tags for inspection
    const idx = html.toLowerCase().indexOf('<param');
    if (idx !== -1) {
      console.log('[ve-compare] param context:', html.slice(Math.max(0, idx - 20), idx + 200));
    }

    if (!html.includes('ve-compare')) {
      console.warn('[ve-compare] no ve-compare attributes found in innerHTML');
      return;
    }

    // Find component URL from an existing embed iframe or fall back to root-relative
    const existing = document.querySelector('iframe.embed-image-compare');
    const url = existing
      ? existing.src.split('?')[0]
      : '/assets/components/image-compare.html';

    console.log('[ve-compare] component URL:', url);

    function getAttr(tag, name) {
      const m = new RegExp(name + '(?:="([^"]*)")?', 'i').exec(tag);
      return m ? (m[1] || '') : null;
    }

    // Flexible pattern: ve-compare and curtain can appear in any order
    const pattern = /(<param\b[^>]*\bve-compare\b[^>]*\bcurtain\b[^>]*>|<param\b[^>]*\bcurtain\b[^>]*\bve-compare\b[^>]*>)\s*(?:<\/p>[\s\S]*?<p[^>]*>)?\s*(<param\b[^>]*\bve-compare\b[^>]*>)/gi;

    let matchCount = 0;
    const replaced = html.replace(pattern, function (match, beforeTag, afterTag) {
      // Skip if afterTag also has curtain (shouldn't happen but be safe)
      if (/\bcurtain\b/i.test(afterTag)) return match;

      const beforeUrl   = getAttr(beforeTag, 'url');
      const afterUrl    = getAttr(afterTag,  'url');

      console.log('[ve-compare] match found — before:', beforeUrl, 'after:', afterUrl);

      if (!beforeUrl || !afterUrl) {
        console.warn('[ve-compare] missing url in match, skipping');
        return match;
      }

      const beforeLabel = getAttr(beforeTag, 'label') || 'Before';
      const afterLabel  = getAttr(afterTag,  'label') || 'After';

      matchCount++;

      const qs = new URLSearchParams({
        before:       beforeUrl,
        after:        afterUrl,
        label_before: beforeLabel,
        label_after:  afterLabel
      });

      return `<iframe class="embed-image-compare" loading="lazy"`
           + ` title="${beforeLabel} / ${afterLabel}"`
           + ` style="aspect-ratio:1.5;width:100%;display:block;margin:1rem 0;"`
           + ` src="${url}?${qs}"`
           + ` allowfullscreen allow="clipboard-write"></iframe>`;
    });

    console.log('[ve-compare] replacements made:', matchCount);

    if (replaced !== html) {
      content.innerHTML = replaced;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', convert);
  } else {
    convert();
  }

})();