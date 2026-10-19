---
title: "Article Downloads"
description: Save an Entreluma article as a print-quality PDF or editable Word document without an external conversion service.
permalink: /admin/entreluma-article-downloads
date: 2026-09-23
toc: true
order: 85
entreluma:
    mode: flat
    toolbar: false
---

## Downloading an Article

Entreluma posts include a download button in the post toolbar. It offers two formats:

- **PDF** opens the browser print dialog with a publication-style version of the article. Choose **Save as PDF** as the printer or destination.
- **Word** downloads an editable `.docx` file.

Both formats are prepared in the reader's browser. Article content is not sent to an external PDF conversion service.

## What Happens to Interactive Viewers?

PDF and Word files cannot reproduce the full behavior of an interactive viewer. Entreluma therefore makes a stable document representation:

- Image viewers become ordinary images when the image is available.
- YouTube viewers become linked poster images.
- Maps become static images of the visible map, including rendered markers and overlays, and retain a link to the interactive map online.
- Networks, image comparisons, and other interactive frames become labeled links to the online edition.
- Headings, tables, lists, quotations, code, footnotes, links, captions, and image attribution are retained.
- Images and maps that float beside text in the online article keep that left/right placement and text wrapping in the PDF.

The PDF keeps internal links such as footnote references and starts the footnotes on a new page. Page size is selected in the browser print dialog, so readers can choose Letter, A4, or another installed paper size.

## Configuration

Site owners can hide the download menu globally in `_config.yml`:

```yaml
entreluma:
  downloads: false
```

An individual post can override the site setting:

```yaml
entreluma:
  downloads: true
```

The older `entreluma.pdf` setting remains a compatibility alias when `downloads` is not set.

## Browser Notes

PDF appearance is produced by the browser's print engine. Current versions of Chrome, Edge, Firefox, and Safari all support saving the prepared article as a PDF, but exact font metrics and page breaks can vary slightly. Enable **Background graphics** in the print dialog when the browser offers that option.

Word export loads a pinned copy of JSZip only when the reader selects Word. If a privacy extension blocks the jsDelivr CDN, PDF export continues to work but Word export reports that its library could not be loaded.

Static map capture depends on the map tile provider allowing the browser to re-read the displayed tiles. When a provider blocks that access, Entreluma uses the linked online-map fallback rather than exporting a blank or incomplete map.
