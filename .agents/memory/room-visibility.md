---
name: Catalog visibility compatibility
description: The public room and art catalogs support hiding items while preserving older records.
---

An omitted catalog visibility flag means visible; only an explicit `false` hides a room or art object from the public placement experience.

**Why:** The catalogs predate these settings, so treating missing values as hidden would make existing rooms or art disappear when the feature is introduced.

**How to apply:** Keep the admin catalogs able to read all items, filter only explicit `false` values from public catalog responses, and default newly created items to visible.