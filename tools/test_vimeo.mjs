import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVimeoWatchUrl,
  buildVimeoPlayerUrl,
  buildExpandedVimeoUrl,
  normalizeVimeoHash,
  normalizeVimeoVideoId,
  parseVimeoPlaybackRange,
  parseVimeoTime,
} from "../assets/js/entreluma-vimeo.mjs";

test("accepts numeric Vimeo video ids", () => {
  assert.equal(normalizeVimeoVideoId(" 76979871 "), "76979871");
  assert.equal(normalizeVimeoVideoId("video-76979871"), null);
  assert.equal(normalizeVimeoVideoId(""), null);
});

test("accepts an optional alphanumeric unlisted-video hash", () => {
  assert.equal(normalizeVimeoHash(" 8272103f6e "), "8272103f6e");
  assert.equal(normalizeVimeoHash(null), null);
  assert.equal(normalizeVimeoHash("bad/hash"), null);
});

test("parses seconds and colon-delimited times", () => {
  assert.equal(parseVimeoTime("90"), 90);
  assert.equal(parseVimeoTime("1:30"), 90);
  assert.equal(parseVimeoTime("1:02:30"), 3750);
  assert.equal(parseVimeoTime("2:03.5"), 123.5);
});

test("rejects malformed and out-of-range times", () => {
  assert.equal(parseVimeoTime("-1"), null);
  assert.equal(parseVimeoTime("1:60"), null);
  assert.equal(parseVimeoTime("one minute"), null);
  assert.equal(parseVimeoTime(""), null);
});

test("parses playat ranges", () => {
  assert.deepEqual(parseVimeoPlaybackRange("42"), { start: 42, end: null });
  assert.deepEqual(parseVimeoPlaybackRange("1:30,2:45"), { start: 90, end: 165 });
});

test("rejects invalid or reversed playat ranges", () => {
  assert.equal(parseVimeoPlaybackRange(""), null);
  assert.equal(parseVimeoPlaybackRange("90,30"), null);
  assert.equal(parseVimeoPlaybackRange("10,20,30"), null);
});

test("builds public and unlisted Vimeo watch URLs", () => {
  assert.equal(buildVimeoWatchUrl("76979871"), "https://vimeo.com/76979871");
  assert.equal(
    buildVimeoWatchUrl("76979871", "8272103f6e"),
    "https://vimeo.com/76979871/8272103f6e",
  );
});

test("builds public and unlisted player URLs with privacy controls", () => {
  const publicUrl = new URL(buildVimeoPlayerUrl("19231868"));
  assert.equal(publicUrl.pathname, "/video/19231868");
  assert.equal(publicUrl.searchParams.get("dnt"), "1");
  assert.equal(publicUrl.searchParams.has("h"), false);

  const unlistedUrl = new URL(buildVimeoPlayerUrl(
    "76979871",
    "8272103f6e",
    { autoplay: true },
  ));
  assert.equal(unlistedUrl.searchParams.get("h"), "8272103f6e");
  assert.equal(unlistedUrl.searchParams.get("autoplay"), "1");
});

test("refuses to build URLs from invalid identifiers", () => {
  assert.equal(buildVimeoWatchUrl("not-an-id"), null);
  assert.equal(buildVimeoWatchUrl("76979871", "bad/hash"), null);
});

test("expanded URLs preserve authored playback settings by default", () => {
  const url = new URL(buildExpandedVimeoUrl(
    "https://site.example/assets/components/vimeo.html?vid=12&hash=abc&start=5&end=10",
  ));
  assert.equal(url.searchParams.get("max"), "true");
  assert.equal(url.searchParams.get("hash"), "abc");
  assert.equal(url.searchParams.get("start"), "5");
  assert.equal(url.searchParams.get("end"), "10");
});

test("expanded URLs apply playat overrides and remove an absent end", () => {
  const url = new URL(buildExpandedVimeoUrl(
    "https://site.example/assets/components/vimeo.html?vid=12&end=99",
    { autoplay: true, start: 42, end: null },
  ));
  assert.equal(url.searchParams.get("autoplay"), "true");
  assert.equal(url.searchParams.get("start"), "42");
  assert.equal(url.searchParams.has("end"), false);
});
