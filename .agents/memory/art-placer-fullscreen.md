---
name: Art Placer fullscreen control
description: Browser fullscreen behavior and compatibility constraints for the TV-friendly board control.
---

The board's fullscreen control must call the Fullscreen API directly from the user's click/tap. Track `fullscreenchange` so the icon reflects browser exits, and keep a WebKit-prefixed fallback for older Chrome-based TV browsers. Target the document root so the entire matted board fills the viewport rather than fullscreening only the room photo.

**Why:** Browsers reject fullscreen requests made from effects or delayed callbacks, and embedded or older TV browsers may expose only prefixed methods.

**How to apply:** Keep the control unobtrusive and hide it when neither request nor exit support is available; never attempt to enter fullscreen automatically on page load.