# ADR 0044: Reserve training

## Status
Accepted (0.37.0, 2026-11-25). Supersedes point 6 of [ADR 0033](0033-recruiting-and-the-party.md).

## Context
- Since 0.25 the barracks hold ten and six fight. ADR 0033 gave the reserve nothing, to keep the party choice meaningful and a big squad's levels from running away.
- The story now runs nine chapters, with side battles and the Trials. A unit left on the bench for a few chapters (a hire, a tamed beast, a story recruit you've rotated out) falls levels behind and stays there. It's hard to bring back without grinding, which works against the job system's point of swapping people in and out.
- The roadmap held "reserve training" for this.

## Decision
1. **The reserve trains at camp.** After every win (story, side battle or Trials, but not a Workshop scenario), each squad member who sat it out earns **half a share**: +20 EXP and +30 JP in their current job. JP Boost counts, as it would in battle. No kill bonus.
2. **Falling pays the same half share.** A party member who fell used to get 15 EXP and 20 JP, less than the new reserve share. They now get 20 and 30 (plus 10 EXP a KO), so sitting out never pays better than fighting and falling.
3. **The party still pays best.** A survivor earns +40 EXP, +60 JP, 10 EXP a KO, and the EXP and JP of every action in the battle (10 EXP and 24 JP each). The bench catches up, but slowly. Choosing who fights still matters.
4. **Shown on the spoils screen.** One RESERVE row lists who trained, with any level-up, job level, mastery or new job it brought. The battle log gets a [CAMP] line for each.
5. The rules live in `core/Reserve.ts` (`trainReserve`, `RESERVE_EXP`, `RESERVE_JP`), so the numbers have one home and tests.

## Consequences
- A unit benched for a whole chapter or two gains about a level and a job level per few wins. That's enough to field it again without grinding.
- Lost battles still pay nobody at camp. The party keeps what it earned during the fight, as before.
- The balance sim fields a fixed party and doesn't model the bench, so chapter tuning is unchanged.
