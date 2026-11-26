# ADR 0047: Scenario chains

## Status
Accepted (0.42.0, 2026-11-25).

## Context
- The Workshop makes single battles. The roadmap item was "mini campaigns from Workshop scenarios, no back end needed": an author strings several battles together and players run them in order.
- Scenarios live in each browser's library and travel as files or `#s=` links. A chain has to travel the same way, without a server.
- The squad already keeps EXP, JP and reward gear from Workshop battles, and those battles never touch campaign progress. Chains should behave the same.

## Decision
1. **A chain carries copies of its battles** (`core/Chain.ts`). A chain has a title, an author, opening words, and up to 8 full scenarios. Copies make a chain one self-contained thing to export or link: it plays the same anywhere, even where its scenarios aren't in the library.
   - The cost is that editing a scenario doesn't change the chain. *Update battles from the library* swaps in a newer library version of each battle, matched by scenario id and newer `updatedAt` only.
2. **Same formats as scenarios.**
   - A chain is plain JSON (`format: 'chess-rpg-tactics/chain'`).
   - Its link is `#c=`, made with the same deflate + base64url encoding as `#s=`. `encodePayload` and `decodePayload` were pulled out of `Scenario.ts` for that.
   - Each battle is packed as tile rows (`packForShare`), so a two-battle chain link is about 2,600 characters.
   - Every battle is re-sanitised on load; broken battles are dropped and the rest repaired.
   - The library stores the packed form, at most 20 chains, to stay well inside browser storage.
3. **Play.**
   - A chain plays its battles in order with the squad, as `custom` battles.
   - The first battle opens with the chain's opening words as a dialogue line. Each battle's subtitle says "*Chain*, battle *n* of *N*".
   - `chainStep` decides what follows a battle: next battle, retry, or complete.
   - **Progress** (the next battle per chain) is kept in `chess_rpg_tactics_chain_progress_v1`. It's set as each battle starts and after each win, and cleared when the chain is finished or deleted. A chain that has since got shorter starts over.
   - The squad starts each battle fresh, as campaign chapters do.
4. **UI.** A sixth Workshop tab, Chains, for editing, checking, playing, the chain list and sharing. Import and paste on the File tab recognise chain files and open them on Chains. On phones the six tabs size to their labels.

## Consequences
- Players can make and share mini campaigns with nothing but a link.
- **Fix found while testing:** startup only skipped the title for `#s=` links, so a `#c=` link would have been ignored. Both are recognised now.
- **Not done:**
  - Wounds carried between battles.
  - Branching chains.
  - Per-chain rewards.

  All three would fit the format later (a chain-level rules object, like `BattleRules`).
- 6 new tests (312 total).
