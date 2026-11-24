# ADR 0027: The Chemist, Item Potency, and an Installable Offline App

## Status
Accepted (0.19.0, 2026-11-23).

## Context
- Items (0.15) were six fixed supplies. The roadmap asked for "more supplies and a job that doubles item effects and throws them further".
- Phone players on the web version needed a connection every time, and a browser tab to find the game. The roadmap listed "PWA: install, offline".

## Decision
1. **The Chemist is an ordinary job.** Its actions use existing ability flags only (`scalesWith: 'attack'` heal, `cleanse`, `appliesStatus`, `aoe`), so the AI plans with them unchanged and enemy Chemists work in the Trials. Its reaction is one more case in `checkReaction`, reusing the Auto-Potion presentation.
2. **Item potency lives in one function**, `JobSystem.itemPotency(unit)`, read by the forecast, `useItem` and the item menu. Pharmacology is a support ability, so a Chemist-trained unit of any job can carry it, which is how the job tree already works. ×1.5 rather than ×2: a ×2 Phoenix Feather would raise at half HP, better than Raise.
3. **Reach +1 is applied where the item becomes the selected ability** (`handleAbilityCommand`), so targeting, highlights and victims all see the same range.
4. **A flask can carry an ailment** (`inflicts` → `appliesStatus`). It lands only on foes still standing and respects gear that wards it off, like any ailment.
5. **The Elixir is "a lot" of HP and MP**, not a new flag: `fixedHeal: 9999` and `fixedMp: 999`, capped by what's missing. The forecast special-cases the label.
6. **The service worker is generated at build time** by a small Vite plugin with the exact list of built files and a cache named after the version. No dependency (Workbox) for 40 lines.
7. **Pages network-first, assets cache-first.** A release reaches players on their next visit without waiting for the worker; fingerprinted assets are safe to serve from cache forever. Cache lookups ignore `Vary`, because module scripts are requested with CORS and servers answer `Vary: Origin`, which otherwise made every cached script miss (found by the offline test).
8. **Only on the web version.** Inside itch.io (or any iframe) and on http nothing is registered: itch can't host installs, and a worker on the dev server would cache stale code.
9. **Install is offered, not pushed.** The Menu shows **Install app** only after the browser fires `beforeinstallprompt`. iOS has no such event; the guide points to Safari's Share menu.
10. **Icons are drawn from the game's own sprite** at build-asset time (one headless render), keeping "no image files from elsewhere".

## Consequences
- **A new version reaches an installed app on the second launch** after release (the first downloads it). Listed as a known issue; acceptable for a game.
- **The build check now fails** if the worker lists a missing file or the manifest an icon that isn't there.
- **Old caches are deleted** when a new worker activates, so storage doesn't grow with releases. Saves live in localStorage and are untouched.
- **Supply power now depends on who uses it.** The forecast shows the real number for the unit using it.
