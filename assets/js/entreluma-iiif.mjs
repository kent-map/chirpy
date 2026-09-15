/**
 * Pure IIIF helpers shared by the image viewer and its Node regression tests.
 * Keep this module free of browser globals so it can be tested without a DOM.
 */

function addValue(map, language, value) {
  if (value == null) return;
  const text = String(value).trim();
  if (!text) return;
  const key = String(language || "none").toLowerCase();
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(text);
}

function collectLanguageValues(value, map, language = "none") {
  if (value == null) return;
  if (typeof value === "string" || typeof value === "number") {
    addValue(map, language, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectLanguageValues(item, map, language));
    return;
  }
  if (typeof value !== "object") return;

  if (Object.prototype.hasOwnProperty.call(value, "@value")) {
    addValue(map, value["@language"] || language, value["@value"]);
    return;
  }

  Object.entries(value).forEach(([key, item]) => {
    collectLanguageValues(item, map, key === "@none" ? "none" : key);
  });
}

function preferredLanguageKeys(preferredLanguages) {
  const keys = [];
  for (const language of preferredLanguages || []) {
    const normalized = String(language || "").trim().toLowerCase();
    if (!normalized) continue;
    if (!keys.includes(normalized)) keys.push(normalized);
    const base = normalized.split("-")[0];
    if (base && !keys.includes(base)) keys.push(base);
  }
  return keys;
}

/** Select strings from an IIIF v3 language map or a v2 language value. */
export function selectLanguageValues(value, preferredLanguages = []) {
  const map = new Map();
  collectLanguageValues(value, map);
  if (map.size === 0) return [];

  for (const key of preferredLanguageKeys(preferredLanguages)) {
    if (map.has(key)) return map.get(key);
    const regional = [...map.keys()].find((candidate) => candidate.split("-")[0] === key);
    if (regional) return map.get(regional);
  }
  if (map.has("none")) return map.get("none");
  return map.values().next().value || [];
}

/**
 * Return normalized attribution content from Presentation API 2 or 3.
 * Values remain strings because the browser layer is responsible for safely
 * rendering the limited HTML permitted by IIIF.
 */
export function extractManifestAttribution(manifest, preferredLanguages = []) {
  if (!manifest || typeof manifest !== "object") return null;

  const statement = manifest.requiredStatement;
  if (statement && typeof statement === "object") {
    const values = selectLanguageValues(statement.value, preferredLanguages);
    if (values.length === 0) return null;
    return {
      label: selectLanguageValues(statement.label, preferredLanguages).join("; "),
      values,
      version: 3,
    };
  }

  const values = selectLanguageValues(manifest.attribution, preferredLanguages);
  return values.length > 0 ? { label: "", values, version: 2 } : null;
}

function firstServiceId(service) {
  const value = Array.isArray(service) ? service[0] : service;
  return value?.id || value?.["@id"] || null;
}

/** Return the Image API service for a canvas in a Presentation 2 or 3 manifest. */
export function getImageServiceId(manifest, sequenceIndex = 0) {
  if (!manifest || typeof manifest !== "object") return null;
  const parsedIndex = Number.parseInt(sequenceIndex, 10);
  const index = Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0;
  const contexts = Array.isArray(manifest["@context"])
    ? manifest["@context"]
    : [manifest["@context"]];
  const isV3 = manifest.type === "Manifest" || contexts.some((context) =>
    typeof context === "string" && context.includes("iiif.io/api/presentation/3/context.json")
  );

  if (isV3) {
    const canvases = manifest.items || [];
    const canvas = canvases[index] || canvases[0];
    const body = canvas?.items?.[0]?.items?.[0]?.body;
    return firstServiceId(body?.service);
  }

  const canvases = manifest.sequences?.[0]?.canvases || [];
  const canvas = canvases[index] || canvases[0];
  return firstServiceId(canvas?.images?.[0]?.resource?.service);
}

/** Add /info.json to a IIIF service base without corrupting query/fragment data. */
export function normalizeInfoJsonUrl(serviceId) {
  if (serviceId == null) return null;
  const input = String(serviceId).trim();
  if (!input) return null;
  const match = input.match(/^([^?#]*)([?#][\s\S]*)?$/);
  let path = (match?.[1] || input).replace(/\/+$/, "");
  const suffix = match?.[2] || "";
  if (!/\/info\.json$/i.test(path)) path += "/info.json";
  return path + suffix;
}

export function looksLikeIIIFInfoJsonUrl(value) {
  return /\/info\.json(?:[?#].*)?$/i.test(String(value || "").trim());
}

/** Conservatively identify an Image API information response. */
export function isIIIFImageInfo(info) {
  if (!info || typeof info !== "object" || Array.isArray(info)) return false;
  const contexts = Array.isArray(info["@context"]) ? info["@context"] : [info["@context"]];
  if (contexts.some((value) => typeof value === "string" && value.includes("iiif.io/api/image/"))) {
    return true;
  }
  if (typeof info.protocol === "string" && /^https?:\/\/iiif\.io\/api\/image\/?$/i.test(info.protocol)) {
    return true;
  }
  if (typeof info.type === "string" && /^ImageService\d+$/i.test(info.type)) return true;
  const profiles = Array.isArray(info.profile) ? info.profile : [info.profile];
  return profiles.some((value) => typeof value === "string" && value.includes("iiif.io/api/image/"));
}
