---
name: Art image aspect consistency
description: Why opaque uploaded artwork can appear incorrectly cropped even after transparent-margin trimming
---

The catalog's physical width and height must describe the orientation of the uploaded pixels. Transparent-edge trimming only removes alpha padding; it cannot remove or reinterpret an opaque background, frame, or matte. When a landscape image is cataloged as portrait, the renderer creates a portrait aspect-ratio box and `object-contain` makes the work appear incorrectly cropped or letterboxed.

**Why:** the board derives displayed width from physical width and displayed height from the catalog aspect ratio. The image itself is not used to correct physical dimensions at render time, because the physical measurements are the source of truth.

**How to apply:** when an uploaded piece looks wrong, inspect the actual served image mode, dimensions, and orientation before changing crop code. For opaque files, compare the catalog aspect ratio with the source image; correct the catalog dimensions when the entry is wrong, and preserve intentional opaque borders or frames.