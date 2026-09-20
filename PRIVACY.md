# Privacy policy — Photo DeDuper

_Last updated: 20 September 2026_

Photo DeDuper does not collect, transmit, sell or share any personal data.

## What the extension does

It runs only on `https://photos.google.com`, in your own browser, signed in as
you. It reads your library through the same requests the Google Photos page
itself makes, fingerprints each photo's thumbnail so it can group visual
duplicates, and moves the photos you select to the Google Photos bin.

## What is stored, and where

- A small numeric fingerprint of each photo, its capture date, its dimensions
  and its thumbnail URL are written to **IndexedDB inside your own browser**.
  This is what makes a second scan fast.
- Nothing else is stored. No account details, no photos, no file contents.
- **Reset** in the panel deletes everything the extension has stored.
  Uninstalling the extension has the same effect.

## What leaves your browser

Nothing. There is no server, no analytics, no telemetry, no crash reporting and
no remote code: every script runs from the installed package. The only network
requests the extension makes go to Google Photos itself, with the session your
browser already holds, and they are the same requests the page makes for you.

## Permissions

The extension requests access to `https://photos.google.com` and nothing else.

## Contact

Questions, or a problem to report: open an issue at
<https://github.com/nvkudva/google-photos-deduper/issues>.
