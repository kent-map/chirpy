/** Pure Vimeo helpers shared by the viewer and its Node regression tests. */

export function normalizeVimeoVideoId(value) {
  const id = String(value ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

export function normalizeVimeoHash(value) {
  if (value == null || String(value).trim() === "") return null;
  const hash = String(value).trim();
  return /^[A-Za-z0-9]+$/.test(hash) ? hash : null;
}

/** Convert seconds, m:ss, or h:mm:ss to a non-negative number of seconds. */
export function parseVimeoTime(value) {
  if (value == null || String(value).trim() === "") return null;
  const input = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(input)) {
    const seconds = Number(input);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const parts = input.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.slice(0, -1).every((part) => /^\d+$/.test(part))) return null;
  if (!/^\d+(?:\.\d+)?$/.test(parts.at(-1))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((part) => part >= 60)) return null;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

/** Parse an action-link range in the form start or start,end. */
export function parseVimeoPlaybackRange(value) {
  if (value == null) return null;
  const parts = String(value).split(",").map((part) => part.trim());
  if (parts.length < 1 || parts.length > 2 || !parts[0]) return null;
  const start = parseVimeoTime(parts[0]);
  if (start == null) return null;
  if (parts.length === 1 || !parts[1]) return { start, end: null };
  const end = parseVimeoTime(parts[1]);
  if (end == null || end <= start) return null;
  return { start, end };
}

export function buildVimeoWatchUrl(videoId, hash = null) {
  const id = normalizeVimeoVideoId(videoId);
  const normalizedHash = normalizeVimeoHash(hash);
  if (!id || (hash != null && String(hash).trim() !== "" && !normalizedHash)) return null;
  return `https://vimeo.com/${id}${normalizedHash ? `/${normalizedHash}` : ""}`;
}

/** Build an embeddable player URL while retaining an unlisted video's hash. */
export function buildVimeoPlayerUrl(videoId, hash = null, { autoplay = false } = {}) {
  const id = normalizeVimeoVideoId(videoId);
  const normalizedHash = normalizeVimeoHash(hash);
  if (!id || (hash != null && String(hash).trim() !== "" && !normalizedHash)) return null;
  const url = new URL(`https://player.vimeo.com/video/${id}`);
  if (normalizedHash) url.searchParams.set("h", normalizedHash);
  url.searchParams.set("title", "0");
  url.searchParams.set("byline", "0");
  url.searchParams.set("portrait", "0");
  url.searchParams.set("dnt", "1");
  url.searchParams.set("playsinline", "1");
  if (autoplay) url.searchParams.set("autoplay", "1");
  return url.href;
}

/** Build the max-mode component URL, preserving parameters unless overridden. */
export function buildExpandedVimeoUrl(currentUrl, overrides = {}) {
  const url = new URL(currentUrl);
  url.searchParams.set("max", "true");
  for (const name of ["autoplay", "start", "end"]) {
    if (!Object.prototype.hasOwnProperty.call(overrides, name)) continue;
    const value = overrides[name];
    if (value == null || value === false) url.searchParams.delete(name);
    else url.searchParams.set(name, value === true ? "true" : String(value));
  }
  return url.href;
}
