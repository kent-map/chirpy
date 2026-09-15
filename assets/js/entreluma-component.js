/**
 * Entreluma component runtime
 * --------------------------
 * Shared messaging layer for the iframe viewer components in
 * /assets/components/. Loaded as a classic script so both module and
 * non-module component pages can use it:
 *
 *     <script src="../js/entreluma-component.js"></script>
 *
 * Exposes a single global, window.Entreluma, implementing the component
 * side of the Entreluma postMessage protocol (see docs/postmessage-protocol.md).
 *
 * All messages use one envelope in both directions:
 *
 *     { type: "entreluma:<name>", payload: { ... } }
 *
 * Components and the host page are always same-origin (components are
 * static pages served from the same site), so messages are sent to and
 * accepted from location.origin only. Set window.SK_TARGET_ORIGIN before
 * loading this script to override (e.g. for an unusual embedding setup).
 */
(function () {
  "use strict";

  // The host is usually same-origin (components are static pages on the same
  // site), but a host page may embed components CROSS-origin — e.g. the
  // editor/preview running on a local Jekyll server while components load
  // from the deployed site. The embedder's origin is then available via
  // document.referrer (referrer policies expose at least the origin for
  // cross-origin embeds). Trust order: explicit override → referrer origin
  // (when embedded and different) → own origin.
  var EMBEDDER_ORIGIN = null;
  try {
    if (window.parent !== window && document.referrer) {
      var refOrigin = new URL(document.referrer).origin;
      if (refOrigin && refOrigin !== "null" && refOrigin !== window.location.origin) {
        EMBEDDER_ORIGIN = refOrigin;
      }
    }
  } catch (e) { /* unparsable referrer — fall through to own origin */ }

  var OPAQUE_SANDBOX = window.origin === 'null';
  var TARGET_ORIGIN = window.SK_TARGET_ORIGIN || EMBEDDER_ORIGIN || window.location.origin;

  /** Tolerant message parse: accepts objects or JSON strings, never throws. */
  function safeParse(data) {
    if (!data) return null;
    if (typeof data === "object") return data;
    if (typeof data !== "string") return null;
    try { return JSON.parse(data); } catch (e) { return null; }
  }

  function isTrustedOrigin(origin) {
    // Accept the embedder (TARGET_ORIGIN) and our own origin: host messages
    // arrive with the host document's SECURITY origin — the site origin in
    // same-origin setups, the embedder origin in cross-origin ones.
    return origin === TARGET_ORIGIN || origin === window.location.origin;
  }

  /** Send an enveloped message to the host page. */
  function sendToHost(type, payload) {
    if (window.parent === window) return; // not embedded; nothing to do
    window.parent.postMessage(
      { type: "entreluma:" + type, payload: payload || {} },
      OPAQUE_SANDBOX ? '*' : TARGET_ORIGIN
    );
  }

  /**
   * Listen for enveloped messages from the host. The handler receives
   * (name, payload, event) where name is the type without the
   * "entreluma:" prefix. Messages from other origins or without the
   * prefix are ignored.
   */
  function onMessage(handler) {
    window.addEventListener("message", function (event) {
      if (event.source !== window.parent) return;
      if (event.origin === 'null' ? !OPAQUE_SANDBOX : !isTrustedOrigin(event.origin)) return;
      var msg = safeParse(event.data);
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type.indexOf("entreluma:") !== 0) return;
      handler(msg.type.slice("entreluma:".length), msg.payload || {}, event);
    });
  }

  /**
   * Register a handler for host-initiated viewer actions (trigger links).
   * The handler receives ({ action, args, label }) where action is
   * lower-cased and args is an array of strings (usually one element —
   * the raw argument segment of the action link).
   */
  function onAction(handler) {
    onMessage(function (name, payload) {
      if (name !== "action") return;
      handler({
        action: String(payload.action || "").toLowerCase(),
        args: Array.isArray(payload.args) ? payload.args : [],
        label: payload.label != null ? String(payload.label) : ""
      });
    });
  }

  /** Ask the host to open the expanded dialog on the given URL. */
  function showDialog(src, aspect) {
    sendToHost("showDialog", { src: src, aspect: aspect || 1.0 });
  }

  /** Report this component's desired iframe height (px) to the host. */
  function reportHeight(px) {
    var h = Number(px);
    if (!isFinite(h) || h <= 0) return;
    sendToHost("height", { height: Math.round(h) });
  }

  /**
   * Request/reply helper. Components can load and send before the host
   * page's module (which registers the reply handler) has executed, so
   * the request is re-sent periodically until a reply arrives or the
   * timeout elapses.
   */
  function requestFromHost(sendType, sendPayload, replyName, matchFn, timeoutMs) {
    return new Promise(function (resolve) {
      var settled = false;
      var interval = setInterval(function () {
        sendToHost(sendType, sendPayload);
      }, 400);
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        clearInterval(interval);
        resolve(null);
      }, timeoutMs || 8000);
      onMessage(function (name, payload) {
        if (settled || name !== replyName || !matchFn(payload)) return;
        settled = true;
        clearInterval(interval);
        clearTimeout(timer);
        resolve(payload);
      });
      sendToHost(sendType, sendPayload);
    });
  }

  /**
   * Ask the host page for the id it assigned to this component's iframe.
   * Resolves to the id string (or null if the host doesn't answer).
   */
  function getHostId(timeoutMs) {
    return requestFromHost("getId", {}, "id", function () { return true; }, timeoutMs)
      .then(function (payload) {
        return payload && payload.id != null ? String(payload.id) : null;
      });
  }

  /**
   * Ask the host page for an element by id. Resolves to
   * { html, text } (values null if the element doesn't exist) or null
   * if the host doesn't answer.
   */
  function requestHostElement(id, timeoutMs) {
    return requestFromHost(
      "getElementById", { id: id }, "element",
      function (payload) { return payload.id === id; }, timeoutMs
    ).then(function (payload) {
      return payload
        ? { html: payload.html || null, text: payload.text || null }
        : null;
    });
  }

  /**
   * Copy text to the clipboard as robustly as an embedded context allows.
   * Components run inside iframes (sometimes nested inside a preview frame),
   * where the async Clipboard API additionally requires clipboard-write to
   * be delegated by EVERY ancestor frame's allow attribute. When it isn't
   * (older embedders, third-party sites), fall back to the legacy
   * execCommand path, which only needs a user gesture.
   * @param {string} text
   * @returns {Promise<boolean>} true when a copy path succeeded
   */
  function copyText(text) {
    var value = String(text == null ? "" : text);
    function legacyCopy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(
        function () { return true; },
        function () { return legacyCopy(); }
      );
    }
    return Promise.resolve(legacyCopy());
  }

  window.Entreluma = {
    safeParse: safeParse,
    sendToHost: sendToHost,
    onMessage: onMessage,
    onAction: onAction,
    showDialog: showDialog,
    reportHeight: reportHeight,
    getHostId: getHostId,
    requestHostElement: requestHostElement,
    copyText: copyText
  };
})();
