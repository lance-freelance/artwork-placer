---
name: Room visibility compatibility
description: The public room catalog supports hiding rooms while preserving older catalog records.
---

An omitted room visibility flag means visible; only an explicit `false` hides a room from the public placement experience.

**Why:** The catalog predates this setting, so treating missing values as hidden would make existing rooms disappear when the feature is introduced.

**How to apply:** Keep the admin catalog able to read all rooms, filter only explicit `false` values from the public catalog, and default newly created rooms to visible.