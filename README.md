# Google Photos DeDuper

A Chrome extension that scans the Google Photos library of whoever is signed in,
finds visually duplicate photos, and moves the ones you choose to the bin.

## Why it works this way

The Google Photos Library API has **no delete method** — `mediaItems` exposes
list/get/search/batchCreate/patch, and `albums.batchRemoveMediaItems` only
unlinks items from an album your own app created. So any deduper has to drive
the photos.google.com UI. Everything below was verified against the live site.

| What | Finding |
|---|---|
| Tile | `a[href*="/photo/"]` — `./photo/<id>` in the main library, `./documents/<album>/photo/<id>` in album and Screenshots views; id is the segment after `/photo/` |
| Capture date | in the tile's `aria-label` (`"Photo – Portrait – 24 Aug 2025, 12:34:56"`) — free, no extra request |
| Thumbnail | `background-image` on a `[data-latest-bg]` descendant, served from `photos.fife.usercontent.google.com` |
| Rendering | stops entirely while the tab is hidden — no new tiles, no thumbnails |
| Thumbnail pixels | **not readable by any download path.** `crossOrigin="anonymous"` loads a transparent placeholder with identical pixels for every photo (the host sends no `Access-Control-Allow-Origin`); without `crossOrigin` the canvas taints; and fetching the URL without session cookies returns a ~940KB HTML sign-in page with a 200 status |
| Grid | virtualised — ~130 tiles live, ~108 dropped per 6000px of scroll |
| Scroll container | a `c-wiz` in the main library, a plain `div[jsname]` in album views — found by walking up from a tile, not by tag |
| Selection | per-tile `[role="checkbox"]`; date headers use the same role, labelled `"Select all …"` |
| Deletion | `[aria-label="Move to bin"]` |
| Input | **scripted clicks are ignored** — `.click()` and full synthetic pointer/mouse sequences both fail, including on the always-visible "Clear selection" button |

Because no download path works, nothing is downloaded: the service worker takes
one `captureVisibleTab` screenshot per scroll step and crops each tile out of it,
then hashes the crop (dHash, 64-bit). No network traffic, no CORS, no auth — and
it hashes exactly what is on screen. The panel hides itself for the instant the
screenshot is taken so it cannot be baked into a tile's hash.

`captureVisibleTab` is the reason for the `<all_urls>` host permission: Chrome
only allows it under `<all_urls>` or `activeTab`, and a permission for
photos.google.com alone is refused. The content script still only ever runs on
photos.google.com.

The input row is the reason for the `debugger` permission: trusted input events
can only come from the DevTools protocol (`Input.dispatchMouseEvent`). Chrome
shows a "Google Photos DeDuper started debugging this browser" bar whenever a
delete pass is running; that is expected, and it only attaches during deletion.

## Install

Unpacked only. The `debugger` permission makes this impractical to publish on
the Chrome Web Store, so there is no store listing to install from.

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Open <https://photos.google.com> and click the extension's toolbar icon to
   show or hide the panel

## First run — do this before pointing it at anything large

Verified end to end on a live album: scan, dry run, and a real delete. Still
worth walking through in this order on anything you have not scanned before:

1. Open a small album (not the main library), set **Scan at most** to `50`, Scan.
2. Check the panel reports a sane number of groups and does not abort with
   "every tile hashed identically". Spot-check that the photos inside a group
   really do look alike.
3. **Dry run** — confirm the count it reports matches what you selected.
4. Let it do one live delete on a single group, watch the checkbox tick, then
   check the Bin. Google Photos sometimes shows a "Move to bin" confirm dialog
   and sometimes trashes straight to an Undo snackbar; both are handled.

Only then raise the cap.

## Use

1. **Scan** — walks the grid, hashing each thumbnail (dHash, 64-bit) and writing
   it to IndexedDB as it goes. Start with the default cap of 2000 rather than the
   whole library. **The tab has to stay visible**: Google Photos stops rendering
   tiles when it is hidden, and the scan will report that it has paused.
2. Adjust **Similarity** to regroup — 100% is byte-identical thumbnails, lower
   values catch recompressions and burst shots.
3. Review the groups. Green is the keeper (oldest by default). Click a thumbnail
   to make it the keeper; click the caption under one to flip that single item.
   **Hover a thumbnail** to see the photo large (up to 1200px) with its capture
   time, so you can tell two near-identical shots apart before deleting one. The
   preview works because the thumbnail URL's size segment is rewritable —
   `=w144-h193-no` becomes `=w1200-h1200-no` and returns a genuinely larger
   image rather than an upscale.

   For a long review, hit the maximise button in the panel header to go full
   page: same controls and the same Dry run / Move to bin actions, but every
   group laid out as a row — count and date in the first column, photos filling
   the rest at 240px tall and their own aspect ratio. There, **click** a photo
   to open it centred at full size. Numbered buttons switch between the photos
   in that group without leaving the dialog — arrow keys and the number keys
   work too — and a green ring marks whichever is currently the keeper, so
   **Keep this one** applies to whatever is on screen. Escape, Close, or a click
   outside dismisses it. The minimise button collapses the panel to its
   title bar.
4. **Dry run** first — it reports what it would delete and touches nothing.
5. **Move selected to bin** — click it twice (the button arms itself for five
   seconds rather than opening a dialog; a content script's native `confirm()`
   blocks the whole renderer, including the page the deleter has to drive).
   It deletes a screenful at a time, verifying the selection count before each
   trash click. Items land in the Google Photos bin and stay recoverable there
   for 60 days.

During a delete run you will see Chrome's "started debugging this browser" bar —
that is the `debugger` permission at work, and it appears once per run — and
Google's own "Moved to the bin / Undo" snackbar. Neither is avoidable. Google
Photos trashes immediately without a confirm dialog of its own.

**Scope** is whatever grid you are on. The main library, an album, the
`Screenshots and recordings` view, or a search result all work — open the view
first, then scan. On a ~100k-photo library a full pass is an hours-long session,
which is why scoping to an album or raising the cap gradually is the better way
in.

## Reloading during development

Chrome only picks up edits to an unpacked extension after a reload on
`chrome://extensions`, which no script on a page can reach. As a shortcut, the
content script listens for a page event that asks the service worker to restart
itself:

```js
document.dispatchEvent(new Event('gpdd-reload'))
```

Run that in DevTools on a Google Photos tab, then reload the page. It restarts
this extension and nothing else.

## Limits

- Hashes the on-screen thumbnail (~165×220 in a JPEG screenshot), not the
  original file, so it finds visual duplicates rather than proving byte-identity.
- A tile is only hashed while it is wholly inside the viewport, so the scan
  steps by 60% of a screen to give every row a fully-visible moment.
- Another extension's floating panel overlapping the grid will corrupt the hashes
  of the tiles underneath it. Close other Google Photos extensions before scanning.
- The first batch of each scan is sanity-checked: if the hashes come back
  identical the scan aborts, so a blank capture surfaces as an error rather than
  as a library full of bogus "duplicates".
- Throughput is unmeasured; watch the first scan's rate before pointing it at a
  large library. At ~100k photos this is an overnight job either way, so scope to
  an album or raise the cap in stages.
- Filename-based matching would need the info panel opened per photo — one page
  load each. Not viable at library scale, so it is not implemented.
- Videos are hashed from their poster frame and are excluded by default.
- Selectors are all in `src/selectors.js` with a self-check that surfaces
  "Google Photos looks different" in the panel instead of silently finding
  nothing.
