---
title: "Image usage examples"
description: "This essay demonstrates how to embed and display images using Juncture, including examples from Wikimedia Commons and self-hosted files on GitHub. It explains how IIIF manifests are generated and how optional attributes like labels, descriptions, attribution, and licenses can be set or overridden."
author: 
date: 2024-03-01
categories: [ kent ]
tags: [ Methods & digital, Material culture, Representation & interpretation ]
image: 
  path: ""
layout: post
permalink: /kent/image-examples/
published: true
toc: false    
---


# Using an image from Wikimedia Commons

In this example a Wikimedia Commons image is used to dynamically create an IIIF image using properties defined in the ve-image tag.  In this use the `url` attribute in the ve-image tag should reference the highest-resolution version of the image available from the Wikimedia Commons site.  This is usually found in the `Original file` link.  In addition to the `url` attribute, the attributes `label`, `description`, `attribution`, and `license` may also be specified.  At a minimum the `label` attribute should be defined.

![Lilac-breasted roller](https://upload.wikimedia.org/wikipedia/commons/0/06/Lilac-breasted_roller_%28Coracias_caudatus_caudatus%29_Botswana.jpg)
_Lilac-breasted roller_
{: .right}

In this example a Wikimedia Commons image is again used to dynamically create an IIIF image.  In this example the `manifest` attribute is defined in the ve-image tag.  No other attributes are needed as the Juncture IIIF service is able to automatically retrieve IIIF property values from the Wikimedia Commons web site.  If a custom caption is desired an optional `title` attribute can be used to override the default label in the generated IIIF Manifest.

![](https://iiif.juncture-digital.org/wc:Lilac-breasted_roller_(Coracias_caudatus_caudatus)_Botswana.jpg/manifest.json)
__
{: .right}

In this example the `title` attribute is used to override the auto-generated label attribute in the IIIF manifest.

![Lilac-breasted roller](https://iiif.juncture-digital.org/wc:Lilac-breasted_roller_(Coracias_caudatus_caudatus)_Botswana.jpg/manifest.json)
_Lilac-breasted roller_
{: .right}

In this example the shortform version of the manifest URL is used.

![](wc:Lilac-breasted_roller_(Coracias_caudatus_caudatus)_Botswana.jpg)
__
{: .right}

# Using a self-hosted image in Github

In this example an image hosted in a Github repository is used to create an IIIF version of the image used in image viewer.  The `url` attribute in the ve-image tag references the file using the Github `raw.githubusercontent.com` URL syntax.  Other IIIF properties are also defined using ve-image attributes.  Recognized attributes are `label`, `description`, `attribution`, and `license`.

![Childe Hassam, Bleak House, Broadstairs, 1889](https://raw.githubusercontent.com/kent-map/images/main/dickens/Hassam.jpg)
_Childe Hassam, Bleak House, Broadstairs, 1889_
{: .right}

In this example an image hosted in a Github repository is used to create an IIIF version of the image used in image viewer.

![](https://iiif.juncture-digital.org/gh:kent-map/images/dickens/Hassam.jpg/manifest.json)
__
{: .right}

In this example an image hosted in a Github repository is referenced using a shorthand manifest URL.

![](gh:kent-map/images/dickens/Hassam.jpg)
__
{: .right}