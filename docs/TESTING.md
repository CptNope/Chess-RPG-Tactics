# Testing

What is tested, how to run it, and what still needs a human.

---

## 1. Test layers

```mermaid
flowchart TB
    subgraph Auto["Automated in CI (every push and PR)"]
        T1["Type check<br/>tsc"]
        T2["Unit tests<br/>vitest · 44 tests"]
        T3["Build smoke test<br/>check-dist.mjs"]
        T4["Docs check<br/>CONTENT_REFERENCE.md current"]
    end
    subgraph Dev["Run during development (Playwright, not yet in CI)"]
        P1["Campaign bot<br/>AUTO plays every turn"]
        P2["Device matrix<br/>7 viewports × 11 screens"]
        P4["Workshop flow<br/>edit → play → end, 3 viewports"]
        P3["Input suite<br/>63 checks: touch, pen,<br/>mouse, keyboard, controller,<br/>Workshop"]
        P5["Balance sim<br/>npm run balance"]
    end
    subgraph Human["Needs a person"]
        H1["iOS Safari, Android"]
        H2["Physical controllers"]
        H3["Feel and balance"]
    end
    Auto --> Dev --> Human
```

| Layer | Command | Runs in CI | What it catches |
| :--- | :--- | :---: | :--- |
| Type check + build | `npm run build` | ✅ | Type errors, broken imports |
| Unit tests | `npm test` | ✅ | Rule regressions (combat, AI, pathing, data) |
| Build smoke test | `npm run test:build` | ✅ | Missing assets in `dist/` |
| Docs check | `npm run docs:check` | ✅ | Data changed without regenerating the Content Reference |
| Browser play-tests | Playwright scripts (see §3) | ❌ | Runtime errors, layout collisions, broken gestures |

---

## 2. Unit tests (`tests/core.test.ts`, `tests/scenario.test.ts`)

All 44 tests import `src/core` and `src/data` directly in Node. No browser is needed.

| Group | Tests | Guards against |
| :--- | :---: | :--- |
| **Data integrity** | 6 | Engine code referencing an ability id that doesn't exist (the bug that silently disabled three reactions before 0.7.0); chapters pointing at missing maps, items or chapters; enemies or deploy tiles on unwalkable tiles; bad armory ids; maps under 16×16; any campaign or Trials (floors 1–20) enemy that melee units can't walk to from the deploy zone |
| **Combat** | 9 | Gear not counting; balance (2–6 hits per same-level basic attack, no spell one-shots); facing math; area splash falloff; reactions firing; Focus being temporary; boss enrage once; Dragonheart once per battle |
| **Progression** | 2 | Level-up math; passive cycling only offering learned abilities |
| **Grid** | 7 | Range/height/self-target rule; water costs; enemies blocking and allies not standable; Teleport; walking paths are adjacent, climbable, within Move, avoid enemies, and none for teleporters |
| **Geomancy** | 1 | Terrain → spell mapping |
| **Enemy AI** | 4 | Never hitting its own team; finishing wounded foes; healing allies, never buffing players; never casting unaffordable spells |
| **Trials** | 3 | Determinism; walkable unique spawns; boss every 5th floor; drops never repeat owned items |
| **Turn manager** | 1 | Speed order; timeline prediction doesn't mutate state |
| **Workshop scenarios** | 11 | Blank and remixed scenarios are playable; scenarios become chapters without sharing state; validation errors and warnings; hostile JSON (huge sizes, `__proto__` job ids, control characters, duplicate tiles, unknown items) is clamped or dropped; old editor maps import; share links round-trip under 4 KB and damaged links fail cleanly |

Randomness is injectable: `CombatEngine.executeAttack(forecast, rng)` takes an `rng` so tests force hits, misses and crits.

---

## 3. Browser play-tests

These scripts ran during 0.7–0.8 development against `npm run preview` with `?debug&fast`. `?debug` exposes the game as `window.__tactics`; `?fast` speeds animations up about 8×.

| Script | What it does | Last result |
| :--- | :--- | :--- |
| **Campaign bot** | Clicks through dialogue, presses AUTO every turn, takes either branch, retries on defeat, continues into the Trials | 0.10.0 on 16×16 maps: Chapter I → II-A → Final → Trials 1–3, 4 retries in total (AUTO only), zero console errors |
| **Device matrix** | Loads 7 viewports (375×667 to 1920×1080, touch on for phones and tablets) and opens 11 screens; measures off-screen panels, overlapping HUD panels, and touch targets under 40px | No off-screen panels, no unintended overlaps, no small targets |
| **Input suite** (run on Low graphics, since CI machines have no GPU) | CDP multi-touch (tap, drag, pinch, twist, two-finger tap), pen pointer events (hover, tap, barrel button, drag), mouse (wheel, left/right drag, click), a full keyboard-only turn, a full turn on an emulated standard gamepad, the Workshop driven by keyboard and controller only (open, navigate, place, undo, close and resume the battle), and Workshop brush strokes by mouse and by touch (each tile once, one undo step, panning still pans) | 63 / 63 |
| **Workshop flow** | Desktop, phone portrait and phone landscape: open from the menu, sculpt with a brush, undo, switch every tab, set a title and objective, play, win via the boss objective, spoils, end screen, back to the campaign | No console errors on all three |

Committing these to the repo and running them in CI is on the [roadmap](ROADMAP.md).

---

## 3b. Balance yardstick (`npm run balance`)

`scripts/balance-sim.ts` plays each campaign chapter headless with the squad on AUTO against the enemy AI, using the game's own turn order, planner and combat engine, and prints the squad's win rate at levels 3–5. A run of 30 battles per chapter takes a few seconds; pass a count, chapters and levels to narrow it (`npm run balance -- 100 chapter_2b 3,4`), or a JSON roster override to try a change without editing data.

It leaves out reactions, gear upgrades and human play, so read it relatively: compare versions, and keep branch choices in the same range. 0.11.0 (60 battles each):

| Chapter | L3 | L4 | L5 |
| :--- | :---: | :---: | :---: |
| I | 67% | 72% | 87% |
| II-A | 10% | 22% | 33% |
| II-B | 17% | 52% | 65% |
| Final | 0% | 0% | 2% |

The Final Chapter is near 0% on pure AUTO in 0.9 as well; the campaign bot clears it with the gear it has collected by then, after a few retries.

---

## 4. Manual checklist (before a release)

| ✔ | Check |
| :---: | :--- |
| ☐ | iPhone Safari, portrait and landscape: tap, drag, pinch, twist; nothing under the notch or home bar |
| ☐ | Android Chrome: same gestures; back gesture doesn't leave the game |
| ☐ | iPad + Apple Pencil: hover preview, tap, barrel/eraser cancel (where supported) |
| ☐ | Xbox and PlayStation controllers over USB and Bluetooth: connect banner, every button, rumble |
| ☐ | Keyboard only: play a full battle without touching the mouse |
| ☐ | Screen reader spot-check: command buttons, dialogs and the banner are announced |
| ☐ | `prefers-reduced-motion`: shake is subtle, the banner fades instead of sliding |
| ☐ | Save, reload the page, load: squad, armory and chapter restored |
| ☐ | Play the Final Chapter with a re-geared squad: hard but fair |
