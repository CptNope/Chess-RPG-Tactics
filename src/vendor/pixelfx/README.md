# Vendored: pixelfx

Pixel-art effects from [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx), MIT License (see `LICENSE` and `NOTICE.md`), vendored at commit `5294518`.

- `core/` is the library's `src/core` unchanged.
- `fx/` holds only the effects the game plays, unchanged, plus their category's shared `_lib.js`.
- `registry.js` (ours) imports them and re-exports the few core functions the game calls; `registry.d.ts` types them.

The repo's gallery font (`gallery/fonts`) is not MIT and is not included. To update, copy the same files from a newer checkout, read the diff, and re-run the game's effect contact sheet.
