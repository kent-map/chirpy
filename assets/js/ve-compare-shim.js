// ve-compare-shim.js
// Converts legacy Juncture <param ve-compare curtain url="..."> pairs
// into image-compare iframes, without editing any markdown files.

(function () {
  function basePath() {
    // Find the base URL from an existing embed-image-compare iframe if present,
    // otherwise fall back to the site root.
    const existing = document.querySelector('iframe.embed-image-compare');
    if (existing) {
      return existing.src.split('?')[0];
    }
    // Walk <link rel="canonical"> or just use root-relative path
    const base = document.querySelector('base');
    return (base ? base.href.replace(/\/$/, '') : '') + '/assets/components/image-compare.html';
  }

  function convert() {
    // Find all <param> elements that have the ve-compare attribute AND curtain (the "before" image)
    const curtainParams = Array.from(document.querySelectorAll('param')).filter(
      el => el.hasAttribute('ve-compare') && el.hasAttribute('curtain')
    );

    if (!curtainParams.length) return;

    const componentUrl = basePath();

    curtainParams.forEach(function (beforeEl) {
      // The "after" param is the immediately following sibling param with ve-compare
      let afterEl = beforeEl.nextElementSibling;
      while (afterEl && afterEl.tagName !== 'PARAM') {
        afterEl = afterEl.nextElementSibling;
      }
      if (!afterEl || !afterEl.hasAttribute('ve-compare')) return;

      const beforeUrl = beforeEl.getAttribute('url') || '';
      const afterUrl  = afterEl.getAttribute('url')  || '';
      if (!beforeUrl || !afterUrl) return;

      const beforeLabel = beforeEl.getAttribute('label') || 'Before';
      const afterLabel  = afterEl.getAttribute('label')  || 'After';

      const qs = new URLSearchParams({
        before:       beforeUrl,
        after:        afterUrl,
        label_before: beforeLabel,
        label_after:  afterLabel
      });

      const iframe = document.createElement('iframe');
      iframe.className    = 'embed-image-compare';
      iframe.loading      = 'lazy';
      iframe.title        = beforeLabel + ' / ' + afterLabel;
      iframe.style.cssText = 'aspect-ratio: 1.5; width: 100%; display: block; margin: 1rem 0;';
      iframe.src          = componentUrl + '?' + qs.toString();
      iframe.allowFullscreen = true;
      iframe.setAttribute('allow', 'clipboard-write');

      beforeEl.parentNode.insertBefore(iframe, beforeEl);
      beforeEl.remove();
      afterEl.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', convert);
  } else {
    convert();
  }
})();