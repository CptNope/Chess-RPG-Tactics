# ADR 0026: Difficulty and Save Slots

## Status
Accepted (0.18.0, 2026-11-23).

## Context
- Act II (0.17) was balanced by simulation with a weak squad. Some players will find it hard, others easy; the game had one setting.
- There was one save. **New Game overwrote it** at the first autosave, there was no way to keep two playthroughs, and no way to move a save between browsers (itch.io and GitHub Pages don't share storage, nor do phone and desktop).
- Two known issues: a retry kept supplies spent in the lost battle while loading a save restored them; and the Trials and New Game+ only opened after the whole story, which Act II had just doubled.

## Decision
1. **Difficulty turns three dials, all on the enemy side:** a level shift (−1 / 0 / +1), boss HP (×0.7 / ×1 / ×1.15) and the enemy raise cap (0 / 1 / 2). Player stats, EXP, JP and prices stay the same, so a save can change difficulty without anything to undo. Bounties follow enemy level, so Hard pays a little more and Easy a little less, which is fair.
2. **Normal is exactly the game as tuned.** No existing number moved.
3. **Difficulty belongs to the save**, not the device: two slots can be played differently. It is chosen at New Game and changeable any time from the Menu, effective from the next battle (changing it mid-battle would mean rebuilding enemies).
4. **It applies everywhere except the Workshop.** Trials records therefore mix difficulties; a record is a personal best, not a leaderboard.
5. **Three slots; slot 1 keeps the old storage key.** Every existing save becomes slot 1 with no migration. Autosaves go to the slot being played. New Game takes the first empty slot, or asks which to replace, and saves at once so the slot is visibly its own.
6. **Overwriting and deleting ask first**; loading doesn't (it never destroys a save).
7. **Export is the save's JSON**, shown as text with Copy and Download. Text works in every embed (some block downloads); a file is easier to keep.
8. **An import is untrusted input.** A save file can come from anyone, and unit names reach the page. `parseImport` rebuilds each unit with `JobSystem.createUnit` and copies over only known jobs, learned abilities, items (from the game's own table, never the file's stats) and clamped numbers; names are reduced to letters, digits, spaces and `'.-`, 16 characters; `__proto__`, `constructor` and `prototype` are refused as keys; files over 512 KB are rejected. Everything else in a save already passes through the loader's own sanitizers.
9. **A lost battle refunds its supplies**, whatever the player does next. The inventory is snapshotted when a battle starts and restored on defeat. EXP and JP stay earned. Generous, but consistent with "a defeat costs time, not progress", and it removes the reload-to-refund trick.
10. **The Gate of Trials opens after Chapter III** (the end of Act I), New Game+ after Chapter VI. A player who stops after Act I still finds the post-game.

## Consequences
- **Easy helps every chapter but III** in the simulation, which stays near 0% for an AI squad in starter gear on every setting. That points at the battlefield and the planner, not the numbers, and is listed for hands-on play.
- **The slot screen reuses the result modal** (body HTML plus listeners) instead of a new dialog, so it inherits its focus trap, controller navigation and phone layout.
- **Save files are about 10 KB** of readable JSON. Anyone can edit their own; the importer keeps edits within what the game allows.
- **Refunds make a hopeless fight free to retry**, which suits the game's no-permadeath tone.
