/**
 * Mirror duels (0.57.0): every job against every other, three of a kind a side, on a flat 12×12
 * field. It ranks raw strength with the maps, the story and the squad's mix taken out, which the
 * chapter sweeps (`SWAP`, 0.46) can't: each chapter rewards different things (ADR 0051).
 *
 *   npm run duels -- [battles per pair] [level] [jobs] [--matrix]
 *   npm run duels -- 12 10                      every job at Lv 10, 12 battles per pair
 *   npm run duels -- 20 10 sapper,knight,monk   just these
 *
 * Each unit knows every action of its job and wears its starting gear; from Lv 4 it has the job's
 * veteran reaction and support, as in the campaign. The sides swap ends every battle, both play
 * the same AI (careful, no items), and a battle still going after 400 turns counts as a draw.
 * The dice are seeded (SEED=n, default 1).
 */
import { BattleGrid } from '../src/core/Grid';
import { JobSystem } from '../src/core/JobSystem';
import { Battle, Decide, runBattle } from '../src/core/Battle';
import { seededRng } from '../src/core/Rng';
import { planTurn } from '../src/core/EnemyAI';
import type { BattleRules } from '../src/core/Rules';
import type { MapData } from '../src/data/maps';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import type { TileData, Unit } from '../src/core/types';

const RULES: BattleRules = { progressionTeams: [] };
const SIZE = 12;
const TEAM = Number(process.env.TEAM || 3);

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Math.max(2, Number(args[0] || 12));
const LEVEL = Number(args[1] || 10);
const JOB_IDS = args[2] ? args[2].split(',') : PLAYER_JOB_IDS.filter((id) => id !== 'tamer'); // a Tamer's craft needs beasts to work on
for (const id of JOB_IDS) if (!JOBS[id]) throw new Error(`No job ${id}`);
const dice = seededRng(Number(process.env.SEED || 1));

function field(): MapData {
  const tiles: TileData[] = [];
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) tiles.push({ x, z, height: 1, terrain: 'grass', walkable: true });
  return { id: 'duel', name: 'Duel', theme: 'day', width: SIZE, depth: SIZE, tiles };
}

function side(jobId: string, team: 'player' | 'enemy', south: boolean): Unit[] {
  const z = south ? SIZE - 2 : 1;
  const xs = [SIZE / 2 - 2, SIZE / 2, SIZE / 2 + 2, SIZE / 2 - 1, SIZE / 2 + 1];
  return [...Array(TEAM).keys()].map((i) => {
    const u = JobSystem.createUnit(`${team}${i}`, `${JOBS[jobId].name} ${i + 1}`, team, jobId, xs[i], z + (i >= 3 ? (south ? 1 : -1) : 0), south ? 'N' : 'S', LEVEL);
    for (const a of JOBS[jobId].abilities) if (a.type === 'action') u.unlockedAbilities[a.id] = true;
    JobSystem.equipVeteranPassives(u);
    JobSystem.applyGearStatuses(u);
    JobSystem.recalculateDerivedStats(u);
    u.currentHp = u.maxHp;
    u.currentMp = u.maxMp;
    return u;
  });
}

/** One battle: `a` on the player side. Returns 1 when a wins, 0 when b does, 0.5 for a draw. */
function duel(a: string, b: string, aSouth: boolean): number {
  const grid = new BattleGrid(field());
  const units = [...side(a, 'player', aSouth), ...side(b, 'enemy', !aSouth)];
  const battle = new Battle({ units, grid, seed: Math.floor(dice() * 4294967296), rules: RULES, pouchOf: () => ({}) });
  const decide: Decide = (_b, u) => {
    const plan = planTurn(u, units, grid, { caution: 'full' });
    return { moveTo: plan.moveTo, ability: plan.ability, target: plan.targetTile, facing: plan.facing };
  };
  const { outcome } = runBattle(battle, decide);
  if (!outcome?.winner) return 0.5;
  return outcome.winner === 'player' ? 1 : 0;
}

const score: Record<string, Record<string, number>> = {};
for (const a of JOB_IDS) score[a] = {};
const started = Date.now();
for (let i = 0; i < JOB_IDS.length; i++) {
  for (let j = i + 1; j < JOB_IDS.length; j++) {
    const a = JOB_IDS[i], b = JOB_IDS[j];
    let s = 0;
    for (let k = 0; k < N; k++) s += duel(a, b, k % 2 === 0);
    score[a][b] = s / N;
    score[b][a] = 1 - s / N;
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(4);
const rows = JOB_IDS.map((id) => {
  const vs = Object.entries(score[id]);
  const mean = vs.reduce((t, [, v]) => t + v, 0) / vs.length;
  const sorted = [...vs].sort((x, y) => x[1] - y[1]);
  return { id, mean, worst: sorted[0], best: sorted[sorted.length - 1] };
}).sort((x, y) => y.mean - x.mean);

console.log(`Mirror duels: ${TEAM} v ${TEAM}, Lv ${LEVEL}, ${N} battles per pair, ${JOB_IDS.length} jobs (${((Date.now() - started) / 1000).toFixed(0)} s)\n`);
console.log('| # | Job | Wins | Best against | Worst against |');
console.log('| ---: | :--- | ---: | :--- | :--- |');
rows.forEach((r, i) => console.log(`| ${i + 1} | ${JOBS[r.id].name} | ${pct(r.mean)} | ${JOBS[r.best[0]].name} ${pct(r.best[1])} | ${JOBS[r.worst[0]].name} ${pct(r.worst[1])} |`));

if (process.argv.includes('--matrix')) {
  const short = (id: string) => JOBS[id].name.slice(0, 4);
  console.log('\nRow against column (the row side\'s share of wins):\n');
  console.log('      ' + rows.map((r) => short(r.id).padStart(5)).join(''));
  for (const r of rows) console.log(short(r.id).padEnd(6) + rows.map((c) => (c.id === r.id ? '    ·' : pct(score[r.id][c.id]).padStart(5))).join(''));
}
