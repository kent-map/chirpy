---
title: "Image usage examples"
description: "This essay demonstrates several ways to embed and display images using Juncture, including dynamically generated IIIF manifests from Wikimedia Commons and from self-hosted images in GitHub. It explains how to use different URL forms and how to supply or override metadata such as labels, captions, attribution, and licenses."
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

{% include embed/image.html src="wc:Lilac-breasted_roller_%28Coracias_caudatus_caudatus%29_Botswana.jpg" aspect="1.5" caption="Lilac-breasted roller" %}{: .right}

In this example a Wikimedia Commons image is again used to dynamically create an IIIF image.  In this example the `manifest` attribute is defined in the ve-image tag.  No other attributes are needed as the Juncture IIIF service is able to automatically retrieve IIIF property values from the Wikimedia Commons web site.  If a custom caption is desired an optional `title` attribute can be used to override the default label in the generated IIIF Manifest.

{% include embed/image.html src="https://iiif.juncture-digital.org/wc:Lilac-breasted_roller_(Coracias_caudatus_caudatus)_Botswana.jpg/manifest.json" aspect="1.0" %}{: .right}

In this example the `title` attribute is used to override the auto-generated label attribute in the IIIF manifest.

{% include embed/image.html src="https://iiif.juncture-digital.org/wc:Lilac-breasted_roller_(Coracias_caudatus_caudatus)_Botswana.jpg/manifest.json" aspect="1.0" caption="Lilac-breasted roller" %}{: .right}

In this example the shortform version of the manifest URL is used.

{% include embed/image.html src="wc:Lilac-breasted_roller_(Coracias_caudatus_caudatus)_Botswana.jpg" aspect="1.0" %}{: .right}

# Using a self-hosted image in Github

In this example an image hosted in a Github repository is used to create an IIIF version of the image used in image viewer.  The `url` attribute in the ve-image tag references the file using the Github `raw.githubusercontent.com` URL syntax.  Other IIIF properties are also defined using ve-image attributes.  Recognized attributes are `label`, `description`, `attribution`, and `license`.

{% include embed/image.html src="https://raw.githubusercontent.com/kent-map/images/main/dickens/Hassam.jpg" aspect="0.711" caption="Childe Hassam, Bleak House, Broadstairs, 1889" attribution="Collection of the Canton Museum of Art, Purchased by the Canton Museum of Art, 2017.83" %}{: .right}

In this example an image hosted in a Github repository is used to create an IIIF version of the image used in image viewer.

{% include embed/image.html src="https://iiif.juncture-digital.org/gh:kent-map/images/dickens/Hassam.jpg/manifest.json" aspect="1.0" %}{: .right}

In this example an image hosted in a Github repository is referenced using a shorthand manifest URL.

{% include embed/image.html src="gh:kent-map/images/dickens/Hassam.jpg" aspect="1.0" %}{: .right}
