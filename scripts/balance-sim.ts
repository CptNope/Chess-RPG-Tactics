/**
 * Balance check: plays each campaign chapter many times headless, with the squad on AUTO against
 * the enemy AI, using the game's own rules (turn order, planner, combat engine), and prints the
 * squad's win rate at a few levels.
 *
 *   npm run balance                      # 30 battles per chapter at L3, L4, L5
 *   npm run balance -- 100 chapter_2b 3,4
 *
 * It's a yardstick, not the real game: no reactions, no gear upgrades, no player cleverness.
 * Compare numbers between versions rather than reading them as absolute difficulty.
 */
import { BattleGrid } from '../src/core/Grid';
import { TurnManager } from '../src/core/TurnManager';
import { JobSystem } from '../src/core/JobSystem';
import { CombatEngine } from '../src/core/CombatEngine';
import { planTurn, unitsInBlast } from '../src/core/EnemyAI';
import { MAPS, spawnsFor } from '../src/data/maps';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import type { Unit } from '../src/core/types';

function squad(level: number, bria: boolean): Unit[] {
  const s = [
    JobSystem.createUnit('p1', 'Rowan', 'player', 'squire', 0, 0, 'N', level),
    JobSystem.createUnit('p2', 'Maren', 'player', 'knight', 0, 0, 'N', level),
    JobSystem.createUnit('p3', 'Tobin', 'player', 'archer', 0, 0, 'N', level),
    JobSystem.createUnit('p4', 'Corvin', 'player', 'dragoon', 0, 0, 'N', level)
  ];
  JobSystem.setSecondarySkillset(s[0], 'knight'); s[0].unlockedAbilities['kn_rend_armor'] = true;
  s[0].unlockedAbilities['sq_move_plus'] = true; s[0].equippedAbilities.movement = 'sq_move_plus'; JobSystem.recalculateDerivedStats(s[0]);
  s[3].unlockedAbilities['dr_jump'] = true; s[3].unlockedAbilities['dr_ignore_height'] = true; s[3].equippedAbilities.movement = 'dr_ignore_height'; JobSystem.recalculateDerivedStats(s[3]);
  if (bria) s.push(JobSystem.createUnit('bria', 'Bria', 'player', 'geomancer', 0, 0, 'N', Math.max(4, level)));
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
    const u = JobSystem.createUnit(`e${i}`, e.name, 'enemy', e.jobId, e.x, e.z, e.facing || 'S', e.level);
    if (e.isBoss) JobSystem.makeBoss(u);
    passives(u);
    return u;
  });
  const sq = squad(level, chId !== 'chapter_1');
  const spawns = spawnsFor(map);
  sq.forEach((m, i) => JobSystem.resetForBattle(m, spawns[i % spawns.length].x, spawns[i % spawns.length].z));
  const units = [...sq, ...enemies];
  const tm = new TurnManager(units);
  for (let turn = 0; turn < 400; turn++) {
    if (!units.some((u) => !u.isDead && u.team === 'player')) return 'loss';
    if (!units.some((u) => !u.isDead && u.team === 'enemy')) return 'win';
    const r = tm.advanceToNextActiveTurn();
    if (!r) return 'timeout';
    const u = r.activeUnit;
    if (u.isDead) { tm.endTurn(u); continue; }
    const plan = planTurn(u, units, grid);
    u.x = plan.moveTo.x; u.z = plan.moveTo.z; u.hasMoved = true;
    if (plan.ability && plan.targetTile) {
      const ab = plan.ability, { x: tx, z: tz } = plan.targetTile;
      u.currentMp = Math.max(0, u.currentMp - ab.mpCost);
      const victims = ab.isSelfOnly ? [u] : ab.aoe > 0 ? unitsInBlast(u, ab, tx, tz, units) : units.filter((v) => !v.isDead && v.x === tx && v.z === tz);
      for (const t of victims) {
        if (t.isDead) continue;
        const isSplash = ab.aoe > 0 && (t.x !== tx || t.z !== tz);
        const f = CombatEngine.getForecast(u, t, ab, grid.getHeight(u.x, u.z), grid.getHeight(t.x, t.z), grid.getTile(t.x, t.z)?.terrain, isSplash);
        CombatEngine.executeAttack(f);
        if (u.isDead) break;
      }
    }
    u.hasActed = true;
    if (!u.isDead) u.facing = plan.facing;
    tm.endTurn(u);
  }
  return 'timeout';
}

const N = Number(process.argv[2] || 30);
// Optional roster override to try changes without editing the data: '{"chapter_2b": [EnemySpawn...]}'
if (process.argv[5]) Object.assign(CAMPAIGN_CHAPTERS[Object.keys(JSON.parse(process.argv[5]))[0]], { enemyRoster: Object.values(JSON.parse(process.argv[5]))[0] });
const chapters = (process.argv[3] || 'chapter_1,chapter_2a,chapter_2b,chapter_3').split(',');
const levels = (process.argv[4] || '3,4,5').split(',').map(Number);
for (const ch of chapters) {
  const row: string[] = [];
  for (const lv of levels) {
    let w = 0, l = 0, t = 0;
    for (let i = 0; i < N; i++) { const r = battle(ch, lv); if (r === 'win') w++; else if (r === 'loss') l++; else t++; }
    row.push(`L${lv}: ${Math.round((w / N) * 100)}%${t ? ` (${t} timeouts)` : ''}`);
  }
  console.log(ch.padEnd(11), row.join('   '));
}
