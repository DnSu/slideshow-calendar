# Offline behavior and the reboot test

The first load needs internet. After that, a service worker saves the page, every image and the latest playlist in the Pi's browser, and asks the browser to keep that storage (`navigator.storage.persist()`). Images that left the playlist are deleted, and saved app files from older deploys are cleaned up after a page loads from the network. While offline the screen keeps going: folder windows and event times are checked locally, the 6 hour page reload and the new-deploy reload are skipped (an offline screen keeps the old version and updates after it reconnects), and a small amber dot appears in the bottom-right corner (turn it off with `offline.showIndicator`).

The screen never trusts a clock earlier than the last successful contact with the server, because a Pi without a battery-backed clock restarts at its last saved time.

**Test this on your own player before relying on it** (it depends on PiSignage's browser keeping its storage across reboots):

1. Let the player show the Web Link online for a few minutes (a full cycle is about 2 min 40 s).
2. Unplug the network (or block the player at your router).
3. Confirm the slideshow keeps running and the dot appears.
4. Reboot the player while it is still offline.
5. After it starts, confirm the slideshow comes back. If it stays black, the browser is wiping its storage; use the fallback of packaging the app as a PiSignage offline web asset (zip).

[← Back to the README](../README.md)
