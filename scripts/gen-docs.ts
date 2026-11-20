/**
 * Generates docs/CONTENT_REFERENCE.md from the game's own data files, so the reference tables
 * can never drift from what the game actually ships.
 *
 *   npm run docs:gen      # rewrite the file
 *   npm run docs:check    # fail if the committed file is out of date (used in CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { JOBS, BASIC_ATTACK } from '../src/data/jobs';
import { ITEMS, STARTING_ARMORY, RARE_DROP_POOL } from '../src/data/items';
import { MAPS, spawnsFor } from '../src/data/maps';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { TERRAIN_SPELLS } from '../src/core/Geomancy';
import { STATUS_DURATION } from '../src/core/CombatEngine';
import { buildTrialFloor, isBossFloor } from '../src/core/Trials';
import { Ability, EquipmentSlot } from '../src/core/types';

const OUT = path.resolve('docs/CONTENT_REFERENCE.md');
const lines: string[] = [];
const w = (s = '') => lines.push(s);
const x = (n: number) => `${n.toFixed(2)}×`;
const jobName = (id: string) => JOBS[id]?.name || id;
const itemName = (id: string) => ITEMS[id]?.name || id;

function abilityRow(a: Ability): string {
  const kind = a.type === 'action' ? 'Action' : a.type[0].toUpperCase() + a.type.slice(1);
  const isAction = a.type === 'action';
  const power = a.power < 0 ? `Heal ${Math.abs(a.power)}` : a.power > 0 ? String(a.power) : '—';
  const extras = [
    a.appliesStatus ? `inflicts **${a.appliesStatus}**` : '',
    a.isSelfOnly ? 'self only' : '',
    a.terrainDriven ? 'changes with terrain' : ''
  ].filter(Boolean).join(', ');
  return `| **${a.name}** \`${a.id}\` | ${kind} | ${a.jpCost} | ${isAction ? a.mpCost : '—'} | ${isAction ? a.range : '—'} | ${isAction ? a.heightTolerance : '—'} | ${isAction && a.aoe ? a.aoe : '—'} | ${isAction ? power : '—'} | ${isAction ? a.element : '—'} | ${extras || '—'} | ${a.description.replace(/\|/g, '/')} |`;
}

w('# Content Reference');
w();
w('> **Generated file — do not edit by hand.** Run `npm run docs:gen` after changing anything in `src/data/` or the Trials generator. CI fails if this file is out of date.');
w();
w('Every number here is read straight from the game data, so it always matches what ships.');
w();
w('**Contents:** [Jobs](#jobs) · [Abilities](#abilities) · [Status effects](#status-effects) · [Geomancy](#geomancy-terrain-spells) · [Items](#items) · [Armory](#armory--drops) · [Battlefields](#battlefields) · [Campaign](#campaign) · [Trials of the Zodiac](#trials-of-the-zodiac)');
w();

// ---------------------------------------------------------------- Jobs
const jobs = Object.values(JOBS);
w('## Jobs');
w();
w(`${jobs.length} jobs. Stat multipliers scale a unit's base stats while it holds that job (base HP = 120 + 18 × level).`);
w();
w('| Job | Role | Move | Jump | HP | MP | ATK | MAG | SPD | Abilities |');
w('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
for (const j of jobs) {
  const m = j.statMultipliers;
  w(`| **${j.name}** \`${j.id}\` | ${j.role} | ${j.baseMove} | ${j.baseJump} | ${x(m.hp)} | ${x(m.mp)} | ${x(m.attack)} | ${x(m.magic)} | ${x(m.speed)} | ${j.abilities.length} |`);
}
w();
w('```mermaid');
w('xychart-beta');
w('  title "Job stat multipliers (ATK vs MAG)"');
w(`  x-axis [${jobs.map((j) => `"${j.name}"`).join(', ')}]`);
w('  y-axis "Multiplier" 0.6 --> 1.5');
w(`  bar [${jobs.map((j) => j.statMultipliers.attack).join(', ')}]`);
w(`  line [${jobs.map((j) => j.statMultipliers.magic).join(', ')}]`);
w('```');
w();
w('*Bars = ATK multiplier, line = MAG multiplier.*');
w();

// ---------------------------------------------------------------- Abilities
const all = jobs.flatMap((j) => j.abilities);
const byType = (t: string) => all.filter((a) => a.type === t).length;
w('## Abilities');
w();
w(`${all.length} learnable abilities: ${byType('action')} actions, ${byType('reaction')} reactions, ${byType('support')} supports, ${byType('movement')} movement. Every unit also has **${BASIC_ATTACK.name}** (range ${BASIC_ATTACK.range}, power ${BASIC_ATTACK.power}; spears and bows extend its range).`);
w();
w('```mermaid');
w('pie showData title Abilities by slot type');
for (const t of ['action', 'reaction', 'support', 'movement']) w(`  "${t[0].toUpperCase() + t.slice(1)}" : ${byType(t)}`);
w('```');
w();
for (const j of jobs) {
  w(`### ${j.name}`);
  w();
  w(`*${j.description}*`);
  w();
  w('| Ability | Slot | JP | MP | Range | Height | Area | Power | Element | Effect | Description |');
  w('| :--- | :--- | ---: | ---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- |');
  for (const a of j.abilities) w(abilityRow(a));
  w();
}

// ---------------------------------------------------------------- Statuses
w('## Status effects');
w();
w('| Status | Lasts (turns) | Effect |');
w('| :--- | :---: | :--- |');
const statusText: Record<string, string> = {
  haste: 'Speed ×1.5 (bosses get a permanent Haste when enraged)',
  slow: 'Speed ×0.67 (minimum 2)',
  protect: 'Physical damage taken ×0.7',
  immobilize: 'Move becomes 0',
  poison: 'Lose 10% max HP at the start of each turn',
  focus: 'Physical power ×1.25'
};
for (const [k, d] of Object.entries(STATUS_DURATION)) w(`| **${k}** | ${d} | ${statusText[k] || ''} |`);
w();

// ---------------------------------------------------------------- Geomancy
w('## Geomancy terrain spells');
w();
w("The Geomancer's **Elemental** becomes a different spell depending on the caster's tile.");
w();
w('| Caster stands on | Spell | Element | Status | Power scale |');
w('| :--- | :--- | :--- | :--- | :---: |');
for (const [terrain, sp] of Object.entries(TERRAIN_SPELLS)) w(`| ${terrain} | **${sp.name}** | ${sp.element} | ${sp.status || '—'} | ${x(sp.powerScale)} |`);
w();

// ---------------------------------------------------------------- Items
const slots: EquipmentSlot[] = ['weapon', 'shield', 'head', 'body', 'accessory'];
const fmtStats = (s: Record<string, number | undefined>) => Object.entries(s).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ') || '—';
const source = (id: string) => {
  if (STARTING_ARMORY.includes(id)) return 'Starting gear';
  const ch = Object.values(CAMPAIGN_CHAPTERS).find((c) => c.rewardItemIds?.includes(id));
  const choice = Object.values(CAMPAIGN_CHAPTERS).flatMap((c) => (c.choices || []).map((o) => ({ c, o }))).find(({ o }) => o.rewardItemIds?.includes(id));
  const parts = [];
  if (ch) parts.push(`Win ${ch.title}`);
  if (choice) parts.push(`Choose "${choice.o.text}"`);
  if (RARE_DROP_POOL.includes(id)) parts.push('Trials drop');
  return parts.join(' · ') || 'Starting gear of a job';
};
const items = Object.values(ITEMS);
w('## Items');
w();
w(`${items.length} items across five gear slots.`);
w();
for (const slot of slots) {
  const list = items.filter((i) => i.slot === slot);
  w(`### ${slot[0].toUpperCase() + slot.slice(1)} (${list.length})`);
  w();
  w(slot === 'weapon' ? '| Item | Type | Range | Stats | Price | How to get |' : '| Item | Stats | Price | How to get |');
  w(slot === 'weapon' ? '| :--- | :--- | :---: | :--- | ---: | :--- |' : '| :--- | :--- | ---: | :--- |');
  for (const i of list) {
    const stats = fmtStats(i.stats as Record<string, number | undefined>);
    if (slot === 'weapon') w(`| **${i.name}** \`${i.id}\` | ${i.weaponType} | ${i.range ?? 1} | ${stats} | ${i.price} | ${source(i.id)} |`);
    else w(`| **${i.name}** \`${i.id}\` | ${stats} | ${i.price} | ${source(i.id)} |`);
  }
  w();
}

// ---------------------------------------------------------------- Armory
w('## Armory & drops');
w();
w('| Pool | Items |');
w('| :--- | :--- |');
w(`| Starting armory (${STARTING_ARMORY.length}) | ${STARTING_ARMORY.map(itemName).join(', ')} |`);
w(`| Trials rare drops (${RARE_DROP_POOL.length}) | ${RARE_DROP_POOL.map(itemName).join(', ')} |`);
w();

// ---------------------------------------------------------------- Maps
w('## Battlefields');
w();
w('| Map | Id | Size | Theme | Height range | Terrain mix | Impassable tiles | Squad deploys on |');
w('| :--- | :--- | :---: | :--- | :---: | :--- | :---: | :--- |');
for (const [id, make] of Object.entries(MAPS)) {
  const m = make();
  const hs = m.tiles.map((t) => t.height);
  const mix: Record<string, number> = {};
  for (const t of m.tiles) mix[t.terrain] = (mix[t.terrain] || 0) + 1;
  const mixText = Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${Math.round((n / m.tiles.length) * 100)}%`).join(', ');
  w(`| **${m.name}** | \`${id}\` | ${m.width}×${m.depth} | ${m.theme} | ${Math.min(...hs)}–${Math.max(...hs)} | ${mixText} | ${m.tiles.filter((t) => !t.walkable).length} | ${spawnsFor(m).map((p) => `(${p.x}, ${p.z})`).join(' ')} |`);
}
w();

// ---------------------------------------------------------------- Campaign
const chapters = Object.values(CAMPAIGN_CHAPTERS);
w('## Campaign');
w();
w('```mermaid');
w('flowchart LR');
for (const c of chapters) w(`  ${c.id}["${c.title}<br/>${c.subtitle}<br/><i>${MAPS[c.mapId]().name}</i>"]`);
w('  epilogue(["Epilogue<br/>New Game+ / Trials"])');
for (const c of chapters) {
  if (c.choices?.length) for (const o of c.choices) w(`  ${c.id} -->|"${o.text.replace(/"/g, "'").replace(/!$/, '')}"| ${o.nextChapterId}`);
  else w(`  ${c.id} --> epilogue`);
}
w('```');
w();
w('| Chapter | Map | Enemies | Boss | Recruit | Win reward | Branch rewards |');
w('| :--- | :--- | :---: | :--- | :--- | :--- | :--- |');
for (const c of chapters) {
  const boss = c.enemyRoster.find((e) => e.isBoss);
  const branch = (c.choices || []).map((o) => `${o.rewardItemIds?.map(itemName).join(' + ')}`).join(' / ') || '—';
  w(`| **${c.title}**: ${c.subtitle} | ${MAPS[c.mapId]().name} | ${c.enemyRoster.length} | ${boss ? `${boss.name} (${jobName(boss.jobId)} L${boss.level})` : '—'} | ${c.recruit ? `${c.recruit.name} (${jobName(c.recruit.jobId)})` : '—'} | ${(c.rewardItemIds || []).map(itemName).join(', ') || '—'} | ${branch} |`);
}
w();
for (const c of chapters) {
  w(`<details><summary><b>${c.title}</b> enemy roster</summary>`);
  w();
  w('| Enemy | Job | Level | Tile | Boss |');
  w('| :--- | :--- | :---: | :---: | :---: |');
  for (const e of c.enemyRoster) w(`| ${e.name} | ${jobName(e.jobId)} | ${e.level} | (${e.x}, ${e.z}) | ${e.isBoss ? '★' : ''} |`);
  w();
  w('</details>');
  w();
}

// ---------------------------------------------------------------- Trials
w('## Trials of the Zodiac');
w();
w('Unlocked after the campaign. Each floor is generated from its number with a seeded RNG, so floor *N* is always the same battle. Enemy level = 3 + floor; a Warden boss appears every 5th floor; each clear drops one armory item you do not own yet.');
w();
w('| Floor | Seal | Map | Enemies | Level | Boss | Jobs |');
w('| :---: | :--- | :--- | :---: | :---: | :---: | :--- |');
for (let f = 1; f <= 15; f++) {
  const t = buildTrialFloor(f);
  const jobsOnFloor = [...new Set(t.enemyRoster.map((e) => jobName(e.jobId)))].join(', ');
  w(`| ${f} | ${t.subtitle} | ${MAPS[t.mapId]().name} | ${t.enemyRoster.length} | ${t.enemyRoster[0].level - (isBossFloor(f) ? 1 : 0)} | ${isBossFloor(f) ? '★' : ''} | ${jobsOnFloor} |`);
}
w();
w('*Floors continue forever; the table shows the first 15.*');
w();

const text = lines.join('\n');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== text) {
    console.error('docs/CONTENT_REFERENCE.md is out of date. Run: npm run docs:gen');
    process.exit(1);
  }
  console.log('docs/CONTENT_REFERENCE.md is up to date.');
} else {
  fs.writeFileSync(OUT, text);
  console.log(`Wrote ${OUT} (${lines.length} lines)`);
}
