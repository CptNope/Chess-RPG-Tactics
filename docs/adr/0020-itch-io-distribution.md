# ADR 0020: Distributing on itch.io from the Same Build

## Status
Accepted (0.12.0, 2026-11-20).

## Context
The game lived only on GitHub Pages. itch.io is where browser-game players look, and the author's other games are there, free with donations. itch runs HTML5 games inside an iframe on a per-upload subfolder of `html-classic.itch.zone`, and that breaks some common assumptions:
- Absolute asset paths don't resolve.
- Audio stays muted until a user gesture inside the frame.
- Arrow keys and Space scroll the store page once the game doesn't use them.
- The game only gets keyboard focus after a click.
- `location` is the iframe's, so links built from it lead nowhere useful.

Fonts loaded from Google's CDN also meant a third-party request on every play.

## Decision
1. **One build for both stores.** Vite's `base: './'` already made every path relative; `scripts/package-itch.mjs` zips `dist/` with `index.html` at the root and refuses to package if it finds an absolute path, a remote script, stylesheet or font, or more than itch's 1,000 files and 500 MB.
2. **Bundle the fonts** with Fontsource (latin subset only, ~46 KB), so the game makes no third-party requests.
3. **A title screen** is the first thing on every platform. Its first press unlocks Web Audio and focuses the frame; it also carries Continue, Fullscreen and the support link. Automated tests skip it with `?fast` or `?notitle`.
4. **`platform.ts`** knows whether it's on itch or embedded. It points Workshop share links at the web version, offers Fullscreen only where the browser allows it (itch's fullscreen embed option), and stops scroll keys from reaching the page after the game has handled them.
5. **Publishing is automatic but opt-in.** CI uploads the zip as an artifact on every push; with a `BUTLER_API_KEY` repository secret it also runs butler on `main` to push to the `html5` channel. Store text and settings live in `docs/ITCH_PAGE.md`, and store images in `docs/itch/`.

## Consequences
- The web version gains a title screen too (a click before play), and the music now starts reliably.
- Saves on itch live in the itch iframe's origin: they survive updates to the upload but are separate from the GitHub Pages version's saves.
- Share links open the web version rather than the itch page.
