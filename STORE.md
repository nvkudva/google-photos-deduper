# Chrome Web Store listing

Copy for the Developer Dashboard. Keep this file in step with `manifest.json`.

## Store listing

**Name** (45 max): `Photo DeDuper`

**Short description** (132 max, 119 used):

> Finds visually duplicate photos in your Google Photos library, right in your browser, and bins the ones you choose to remove.

**Category**: Workflow & Planning · **Language**: English (UK)

**Detailed description**:

> Photo DeDuper finds near-identical photos in your Google Photos library and
> lets you clear them out in bulk.
>
> How it works
> • Open photos.google.com and click the toolbar icon to show the panel.
> • Pick a date range and a similarity threshold, then scan. Thumbnails are
>   fingerprinted in your own browser; nothing is uploaded anywhere.
> • Review the results as cards. Each card keeps one photo and marks the rest
>   for the bin. Click a photo to keep that one instead, click a badge to change
>   one photo's fate, or use a card's own Skip and "Move to bin" buttons.
> • When you are happy, move the selection to the bin. Everything goes to the
>   Google Photos bin, where it stays recoverable for 60 days. The extension
>   never deletes anything permanently.
>
> What it does not do
> • No account sign-in, no servers, no analytics. The fingerprints and your
>   review decisions live in your browser's own storage and never leave it.
> • Nothing is deleted without you selecting it and confirming.
>
> Photo DeDuper is an independent extension. It is not made by, endorsed by, or
> affiliated with Google, and "Google Photos" is named only to say which site
> the extension works on.

**Screenshots** (1280×800 PNG, at least one, up to five): the panel over the
grid with a few result cards; the maximised review view; the confirm step.
Take them on a demo account, or blur faces — a listing screenshot is public.

## Privacy tab

**Single purpose**:

> Find visually duplicate photos in the user's own Google Photos library and
> move the copies the user selects to the Google Photos bin.

**Permission justifications**:

| Requested | Justification |
| --- | --- |
| `host_permissions: https://photos.google.com/*` | The extension only works on this one site. It reads the photo grid to fingerprint thumbnails, and calls the same endpoints the page itself uses to move the selected photos to the bin. |
| Content script on `https://photos.google.com/*` | The review panel is drawn into the page, and the grid can only be read from inside it. |

No other permissions are requested. Fingerprints are stored in IndexedDB, which
needs no permission, and there is no remote code: every script ships in the
package.

**Data usage disclosure** — tick nothing, and certify:

- Does not collect or transmit any user data. Photo fingerprints and grouping
  results stay in the browser's IndexedDB on the user's machine.
- Not being sold to third parties; not used or transferred for purposes
  unrelated to the single purpose; not used to determine creditworthiness.

**Privacy policy URL**: required by the dashboard even with nothing collected.
A single page saying the above is enough — a GitHub Pages page or a README
anchor works.

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
