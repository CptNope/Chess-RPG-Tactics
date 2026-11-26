/**
 * Balance check: plays each campaign chapter many times headless, with the squad on AUTO against
 * the enemy AI, using the game's own rules (turn order, planner, combat engine), and prints the
 * squad's win rate at a few levels.
 *
 *   npm run balance                      # 30 battles per chapter at L3, L4, L5
 *   npm run balance -- 100 chapter_2b 3,4
 *
 * Whole battles run in the game's engine (core/Battle.ts, 0.44.0): turn order and CT refunds,
 * Poison and Regen, calls landing, encores, rounds and each chapter's objective; actions go
 * through the game's resolver (core/Action.ts). It's still a yardstick, not the real game: no
 * gear upgrades, no player cleverness. Compare numbers between versions rather than reading them
 * as absolute difficulty.
 *
 * The dice are seeded (SEED=n, default 1), so the same command gives the same numbers.
 *
 * Comparing jobs (0.45.0): TOBIN_JOB=<job> FULLKIT=1 puts Tobin in that job, knowing all its actions.
 */
import { BattleGrid } from '../src/core/Grid';
import { JobSystem } from '../src/core/JobSystem';
import { Battle, Decide, runBattle } from '../src/core/Battle';
import { seededRng } from '../src/core/Rng';
import type { BattleRules } from '../src/core/Rules';
import { planTurn } from '../src/core/EnemyAI';
import { DIFFICULTIES, enemyLevel, sanitizeDifficulty, scaleBoss } from '../src/core/Difficulty';

/** DIFFICULTY=easy|normal|hard npm run balance */
const DIFF = sanitizeDifficulty(process.env.DIFFICULTY);
/** OLD_AI=1 plays without 0.31's caution and enemy items, to compare. */
const OLD_AI = process.env.OLD_AI === '1';
/** For experiments: CAUTION=enemy|player|none (default both sides), ITEMS=0 (no enemy pouches). */
const CAUTION = process.env.CAUTION || 'both';
const ITEMS = process.env.ITEMS !== '0';
/** SEED=n: where the dice start (each battle draws its own seed from this). */
const dice = seededRng(Number(process.env.SEED || 1));
/** Nobody levels up mid-battle in the sim: the squad's level is the thing being measured. */
const SIM_RULES: BattleRules = { progressionTeams: [] };
import { enemyCaution, enemyPouch } from '../src/core/EnemyPouch';
import { MAPS, spawnsFor } from '../src/data/maps';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { JOBS } from '../src/data/jobs';
import { ITEMS as ITEM_DATA } from '../src/data/items';
import type { Unit } from '../src/core/types';

function squad(level: number, bria: boolean, sable = false, kestrel = false): Unit[] {
  const s = [
    JobSystem.createUnit('p1', 'Rowan', 'player', 'squire', 0, 0, 'N', level),
    JobSystem.createUnit('p2', 'Maren', 'player', 'knight', 0, 0, 'N', level),
    JobSystem.createUnit('p3', 'Tobin', 'player', process.env.TOBIN_JOB || (process.env.GUNNER === '1' ? 'gunner' : 'archer'), 0, 0, 'N', level), // GUNNER=1: Tobin as a Gunner (0.36.0); TOBIN_JOB=<job> for any job (0.45.0)
    JobSystem.createUnit('p4', 'Corvin', 'player', 'dragoon', 0, 0, 'N', level)
  ];
  JobSystem.setSecondarySkillset(s[0], 'knight'); s[0].unlockedAbilities['kn_rend_armor'] = true;
  s[0].unlockedAbilities['sq_move_plus'] = true; s[0].equippedAbilities.movement = 'sq_move_plus'; JobSystem.recalculateDerivedStats(s[0]);
  // GUNNER=1: Tobin keeps the archer's band and boots, as he would after a job change (0.36.0)
  if (process.env.GUNNER === '1') { s[2].equipment.head = ITEM_DATA.shinobi_band; s[2].equipment.body = undefined; s[2].equipment.accessory = ITEM_DATA.feather_boots; JobSystem.recalculateDerivedStats(s[2]); }
  // FULLKIT=1: Tobin knows every action of his job, for comparing jobs like for like (0.36.0)
  if (process.env.FULLKIT === '1') for (const a of JOBS[s[2].jobId].abilities) if (a.type === 'action') s[2].unlockedAbilities[a.id] = true;
  s[3].unlockedAbilities['dr_jump'] = true; s[3].unlockedAbilities['dr_ignore_height'] = true; s[3].equippedAbilities.movement = 'dr_ignore_height'; JobSystem.recalculateDerivedStats(s[3]);
  if (bria) s.push(JobSystem.createUnit('bria', 'Bria', 'player', 'geomancer', 0, 0, 'N', Math.max(4, level)));
  if (sable) s.push(JobSystem.createUnit('sable', 'Sable', 'player', 'thief', 0, 0, 'N', Math.max(6, level)));
  if (kestrel) s.push(JobSystem.createUnit('kestrel', 'Kestrel', 'player', 'tamer', 0, 0, 'N', Math.max(9, level)));
  return s;
}

function passives(u: Unit) {
  JobSystem.equipVeteranPassives(u);
  JobSystem.applyGearStatuses(u);
}

function battle(chId: string, level: number): 'win' | 'loss' | 'timeout' {
  const ch = CAMPAIGN_CHAPTERS[chId];
  const map = MAPS[ch.mapId]();
  const grid = new BattleGrid(map);
  const enemies = ch.enemyRoster.map((e, i) => {
    const u = JobSystem.createUnit(`e${i}`, e.name, 'enemy', e.jobId, e.x, e.z, e.facing || 'S', enemyLevel(e.level, DIFF));
    if (e.isBoss) { JobSystem.makeBoss(u); scaleBoss(u, DIFF); }
    passives(u);
    if (!OLD_AI && ITEMS) u.pouch = enemyPouch(u, i, DIFF);
    return u;
  });
  const sq = squad(level, chId !== 'chapter_1', /chapter_[456]/.test(chId) || (/chapter_[789]/.test(chId) && process.env.KESTREL === '0'), /chapter_[789]/.test(chId) && process.env.KESTREL !== '0'); // a party of six: Kestrel takes Sable's place in Act III
  const spawns = spawnsFor(map);
  sq.forEach((m, i) => JobSystem.resetForBattle(m, spawns[i % spawns.length].x, spawns[i % spawns.length].z));
  const units = [...sq, ...enemies];
  const squadPouch: Record<string, number> = {};
  // The whole battle runs in the engine (core/Battle.ts, 0.44.0): turn starts, calls, encores,
  // rounds and the chapter's objective, as in the game
  const b = new Battle({
    units, grid, seed: Math.floor(dice() * 4294967296), rules: SIM_RULES, objective: ch.objective,
    pouchOf: (c) => (c.team === 'enemy' ? c.pouch : squadPouch)
  });
  let enemyRaises = 0;
  const decide: Decide = (_b, u) => {
    const foe = u.team === 'enemy';
    const plan = planTurn(u, units, grid, {
      noRevive: foe && enemyRaises >= DIFFICULTIES[DIFF].raiseCap,
      caution: OLD_AI ? false : foe ? (CAUTION === 'both' || CAUTION === 'enemy' ? enemyCaution(DIFF) : false) : (CAUTION === 'both' || CAUTION === 'player' ? 'full' : false),
      pouch: foe ? u.pouch : undefined,
      holdBack: !foe // the squad on AUTO, as in the game
    });
    if ((plan.ability?.revive || plan.ability?.rebirth) && foe) enemyRaises++;
    return { moveTo: plan.moveTo, ability: plan.ability, target: plan.targetTile, facing: plan.facing };
  };
  const { outcome } = runBattle(b, decide);
  return !outcome ? 'timeout' : outcome.winner === 'player' ? 'win' : 'loss';
}

const N = Number(process.argv[2] || 30);
// Optional roster override to try changes without editing the data: '{"chapter_2b": [EnemySpawn...]}'
if (process.argv[5]) Object.assign(CAMPAIGN_CHAPTERS[Object.keys(JSON.parse(process.argv[5]))[0]], { enemyRoster: Object.values(JSON.parse(process.argv[5]))[0] });
const chapters = (process.argv[3] || 'chapter_1,chapter_2a,chapter_2b,chapter_3,chapter_4,chapter_5,chapter_6').split(',');
const levels = (process.argv[4] || '3,4,5').split(',').map(Number);
// Act II is met at higher levels: shift the default levels up by the chapter's enemy level
const ACT_TWO_SHIFT: Record<string, number> = { chapter_4: 3, chapter_5: 4, chapter_6: 5, chapter_7: 6, chapter_8: 7, chapter_9: 8 };
console.log(`Difficulty: ${DIFFICULTIES[DIFF].label}`);
for (const ch of chapters) {
  const row: string[] = [];
  for (const lv of process.argv[4] ? levels : levels.map((l) => l + (ACT_TWO_SHIFT[ch] || 0))) {
    let w = 0, l = 0, t = 0;
    for (let i = 0; i < N; i++) { const r = battle(ch, lv); if (r === 'win') w++; else if (r === 'loss') l++; else t++; }
    row.push(`L${lv}: ${Math.round((w / N) * 100)}%${t ? ` (${t} timeouts)` : ''}`);
  }
  console.log(ch.padEnd(11), row.join('   '));
}
