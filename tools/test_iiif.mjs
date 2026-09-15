import assert from "node:assert/strict";
import test from "node:test";

import {
  extractManifestAttribution,
  getImageServiceId,
  isIIIFImageInfo,
  looksLikeIIIFInfoJsonUrl,
  normalizeInfoJsonUrl,
  selectLanguageValues,
} from "../assets/js/entreluma-iiif.mjs";

test("extracts Image API services from Presentation 2 and 3 manifests", () => {
  const v2 = {
    "@context": "http://iiif.io/api/presentation/2/context.json",
    sequences: [{ canvases: [{ images: [{ resource: {
      service: { "@id": "https://images.example/v2" },
    } }] }] }],
  };
  const v3 = {
    "@context": ["http://iiif.io/api/presentation/3/context.json"],
    type: "Manifest",
    items: [{ items: [{ items: [{ body: {
      service: [{ id: "https://images.example/v3" }],
    } }] }] }],
  };
  assert.equal(getImageServiceId(v2), "https://images.example/v2");
  assert.equal(getImageServiceId(v3), "https://images.example/v3");
  assert.equal(getImageServiceId(v3, 99), "https://images.example/v3");
  assert.equal(getImageServiceId({}, 0), null);
});

test("normalizes IIIF service and info.json URLs", () => {
  assert.equal(normalizeInfoJsonUrl("https://images.example/id/"), "https://images.example/id/info.json");
  assert.equal(normalizeInfoJsonUrl("https://images.example/id/info.json"), "https://images.example/id/info.json");
  assert.equal(
    normalizeInfoJsonUrl("https://images.example/id/?token=abc#view"),
    "https://images.example/id/info.json?token=abc#view",
  );
  assert.equal(normalizeInfoJsonUrl("  "), null);
});

test("recognizes explicit info.json URLs", () => {
  assert.equal(looksLikeIIIFInfoJsonUrl("https://images.example/id/info.json?token=abc"), true);
  assert.equal(looksLikeIIIFInfoJsonUrl("https://images.example/id/full/max/0/default.jpg"), false);
});

test("recognizes Image API 2 and 3 information documents", () => {
  assert.equal(isIIIFImageInfo({ "@context": "http://iiif.io/api/image/2/context.json" }), true);
  assert.equal(isIIIFImageInfo({ type: "ImageService3", profile: "level1" }), true);
  assert.equal(isIIIFImageInfo({ protocol: "http://iiif.io/api/image" }), true);
  assert.equal(isIIIFImageInfo({ profile: "http://iiif.io/api/image/2/level2.json" }), true);
  assert.equal(isIIIFImageInfo({ type: "Image" }), false);
});

test("selects exact, base-language, none, and first-available values", () => {
  const map = { "en-GB": ["British"], fr: ["Français"], none: ["Neutral"] };
  assert.deepEqual(selectLanguageValues(map, ["en-GB"]), ["British"]);
  assert.deepEqual(selectLanguageValues(map, ["en-US"]), ["British"]);
  assert.deepEqual(selectLanguageValues(map, ["de"]), ["Neutral"]);
  assert.deepEqual(selectLanguageValues({ fr: ["Français"] }, ["de"]), ["Français"]);
});

test("normalizes v2 language-tagged attribution", () => {
  const attribution = [
    { "@value": "Avec la permission du musée", "@language": "fr" },
    { "@value": "Courtesy of the museum", "@language": "en" },
  ];
  assert.deepEqual(selectLanguageValues(attribution, ["en-GB"]), ["Courtesy of the museum"]);
});

test("extracts Presentation 3 requiredStatement label and values", () => {
  const result = extractManifestAttribution({
    requiredStatement: {
      label: { en: ["Attribution"] },
      value: { en: ["Provided by Example Institution", "CC BY 4.0"] },
    },
  }, ["en"]);
  assert.deepEqual(result, {
    label: "Attribution",
    values: ["Provided by Example Institution", "CC BY 4.0"],
    version: 3,
  });
});

test("extracts Presentation 2 attribution and ignores empty statements", () => {
  assert.deepEqual(extractManifestAttribution({ attribution: "Courtesy of Example" }), {
    label: "",
    values: ["Courtesy of Example"],
    version: 2,
  });
  assert.equal(extractManifestAttribution({ requiredStatement: { label: { en: ["Credit"] } } }), null);
  assert.equal(extractManifestAttribution(null), null);
});
