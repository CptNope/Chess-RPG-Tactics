# ADR 0033: Recruiting and the Party

## Status
Accepted (0.25.0, 2026-11-24).

## Context
- The squad was the opening four plus two story recruits, and everyone fought every battle. Gil had one sink (gear and supplies), and there was no way to try a job without retraining a story character.
- Every battlefield has six spawn tiles, and the Workshop limits scenarios to six squad tiles.

## Decision
1. **A recruiting board at the market,** worked out from progress like the travelling merchant (ADR 0029): a board per "visit" (battles won on the map), three hopefuls with seeded names, jobs and levels. The save only records which board slots were hired (`recruitHires`), so a hired hopeful shows "Hired" until the board changes.
2. **Fair hires, not shortcuts.** A hopeful comes about a level below the squad's average (sometimes at it), so hiring fills a gap without skipping the grind. Price is 200 G + 90 per level, ×1.25 for jobs with prerequisites: about one battle's income. More jobs open as chapters are won. Names come from an original list that no story character uses, and never repeat a squad member's.
3. **Hired through the normal unit path.** `hireRecruit` is `createUnit` (job gear, prerequisites, first ability) plus `gainJp(level × 40)` in the job. A hired unit is an ordinary squad member, saved and loaded like anyone else. Its id starts with `hire-`, which is what makes it dismissable.
4. **A barracks of ten, a party of six.** `chooseParty` puts the leader (Rowan) first, then anyone required (a story recruit in the battle they join), then the player's last pick in order, or the squad in order if none, up to six. When the squad fits, everyone goes and no screen appears.
5. **The party screen sits in front of the battle,** wrapping the world map's march, side battle and Trials actions. It's the result modal with cards (a toggle each, Dismiss for hires in the Barracks), so focus navigation, keyboard and controller work as in the save-slot screen. New Game+, Workshop battles and Retry reuse the saved pick without asking.
6. **Reserve earns nothing.** Spoils (EXP, JP) go to whoever deployed. That keeps the choice meaningful and the levels of a big squad from running away. *(Superseded in 0.37.0 by [ADR 0044](0044-reserve-training.md): the reserve takes half a share.)*

## Consequences
- **Gil has a second sink**, and players can try a job by hiring rather than retraining.
- **A big squad can fall behind:** reserve units don't level. A training share for the reserve is a possible follow-up if hand play shows it's needed.
- **Dismissal is permanent** and can't be undone in-game; the confirmation says so.
- **Saves grow** a little (ten units at most; import still caps the file size).
