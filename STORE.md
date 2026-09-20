# Chrome Web Store listing

Copy for the Developer Dashboard. Keep this file in step with `manifest.json`.

## Store listing

**Name** (45 max): `Smart Photo Deduper`

**Short description** (132 max, 121 used) — comes from `manifest.json`:

> Finds duplicate photos in your Google Photos library by what they look like, not their names, and bins the ones you pick.

**Category**: Workflow & Planning · **Language**: English (UK)

**Detailed description**:

> Smart Photo Deduper finds duplicate photos in your Google Photos library and
> lets you clear them out in bulk.
>
> What makes it smart
> • It matches what a photo looks like, not its filename, date or size. The copy
>   that was re-saved, resized, recompressed or passed through a chat app is
>   still grouped with the original.
> • One similarity slider decides how alike is alike. At 100% only near-identical
>   copies group together; ease it down to catch crops and re-saves. The results
>   regroup as you drag, with no rescanning.
> • Each group arrives with a keeper already chosen — the oldest photo, the
>   likely original — and the rest marked for the bin. Change it with one click.
> • It remembers what it has already fingerprinted, so a second scan costs only
>   the new photos.
>
> How it works
> • Open photos.google.com. The panel opens from "Smart Deduper" in the sidebar,
>   below Bin, or from the toolbar icon.
> • Pick a date range and a similarity, then scan. Photos are fingerprinted in
>   your own browser; nothing is uploaded anywhere.
> • Review the results as cards. Hover a photo to see it large with its capture
>   time, click one to keep it instead, click a badge to change one photo's fate,
>   or use a card's own Skip and "Move to bin" buttons.
> • When you are happy, move the selection to the bin. Everything goes to the
>   Google Photos bin, where it stays recoverable for 60 days. The extension
>   never deletes anything permanently.
>
> What it does not do
> • No account sign-in, no servers, no analytics. The fingerprints and your
>   review decisions live in your browser's own storage and never leave it.
> • Nothing is deleted without you selecting it and confirming.
>
> Smart Photo Deduper is an independent extension. It is not made by, endorsed
> by, or affiliated with Google, and "Google Photos" is named only to say which
> site the extension works on.
>
> Disclaimer
> This extension is provided as is, with no warranty of any kind. It moves
> photos in a real Google account, and the developer accepts no responsibility
> for any loss of data, however caused. Deletes stay recoverable in the Google
> Photos bin for 60 days — check a run did what you expected before that window
> closes. Use it at your own risk.

**Screenshots** (1280×800 PNG, at least one, up to five), in
`store/screenshots/`:

| File | Shows |
| --- | --- |
| `01-start.png` | The panel before a scan: date range, similarity and the scan button, nothing found yet |
| `02-groups.png` | Duplicate groups, each with its keeper ringed green and the others marked for the bin |
| `03-preview.png` | A hovered thumbnail shown large with its capture time |
| `04-sidebar.png` | The panel closed, with the note pointing at the Smart Deduper entry in Google's own sidebar |

They were taken against a real library, so every photo is blurred in CSS before
capture — a listing screenshot is public. `src/dev-shot.js` does the blurring;
load the page as `https://photos.google.com/?shot=1#gpdd-shot=blur` (add `,arm`
for the confirm step), then capture the viewport and scale it:

```
screencapture -x -R<x>,<y>,1440,900 /tmp/s.png
sips -z 800 1280 -s format png /tmp/s.png --out store/screenshots/01-start.png
```

The helper is development-only and `tools/package.sh` keeps it out of the zip.

## Privacy tab

**Single purpose**:

> Find visually duplicate photos in the user's own Google Photos library and
> move the copies the user selects to the Google Photos bin.

**Permission justifications**:

| Requested | Justification |
| --- | --- |
| `host_permissions: https://photos.google.com/*` | The extension only works on this one site. It fetches each photo's own thumbnail to fingerprint it, and calls the same endpoints the page itself uses to list the library and to move the selected photos to the bin. |
| Content script on `https://photos.google.com/*` | The review panel is drawn into the page, and those endpoints only answer from inside it, with the signed-in session the page already holds. |

No other permissions are requested. Fingerprints are stored in IndexedDB, which
needs no permission, and there is no remote code: every script ships in the
package.

**Data usage disclosure** — tick nothing, and certify:

- Does not collect or transmit any user data. Photo fingerprints and grouping
  results stay in the browser's IndexedDB on the user's machine.
- Not being sold to third parties; not used or transferred for purposes
  unrelated to the single purpose; not used to determine creditworthiness.

**Privacy policy URL**: <https://nvkudva.github.io/smart-photo-deduper/>

Served from `docs/index.html` in this repo; the same text is in `PRIVACY.md`.
Turn it on once under repo Settings → Pages → Source: `main` / `/docs`.

## Before the first upload

- Register as a Chrome Web Store developer ($5 one-time) and verify the
  publisher email.
- Build the zip with `tools/package.sh`; it leaves `src/dev-reload.js` out.
- Bump `version` in `manifest.json` for every upload — the store rejects a
  version it has already seen.

## Expect questions at review

The extension calls Google Photos' own internal endpoint (the same
`batchexecute` request the page makes when you click Delete) with the session
already in the browser. That is how a bulk bin operation is possible at all, but
reviewers treat automating another site's private API as high risk, and Google
Photos' terms may be read as prohibiting it. Be ready to explain that the
extension acts only on the signed-in user's own library, only on photos that
user selected, and only into the recoverable bin — and be prepared for a
rejection that no change to the listing can fix.
