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
import { ITEMS, STARTING_ARMORY, RARE_DROP_POOL, MERCHANT_ITEMS } from '../src/data/items';
import { CAMP_JP, CAMP_SCENES } from '../src/data/camp';
import { SIGNATURES } from '../src/data/signatures';
import { EARLY_MARKUP, MERCHANT_NAME } from '../src/core/Merchant';
import { MAPS, spawnsFor } from '../src/data/maps';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { TERRAIN_SPELLS } from '../src/core/Geomancy';
import { STATUS_DURATION, BENEFICIAL_STATUSES } from '../src/core/CombatEngine';
import { TRIAL_DEEP_MONSTERS_FROM, TRIAL_MONSTERS_FROM, buildTrialFloor, isBossFloor } from '../src/core/Trials';
import { Ability, EquipmentSlot } from '../src/core/types';
import { gearKind, jobGearText, whoCanUse } from '../src/data/gear-rules';
import { JOB_LEVEL_JP, JOB_MASTERY, VETERAN_JOB_LEVEL, MAX_JOB_LEVEL, masteryLabel } from '../src/core/JobSystem';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../src/core/Difficulty';
import { SKIRMISHES, SKIRMISH_MAX_HEAT, skirmishBonus } from '../src/core/Skirmish';
import { STARTING_GIL, SHOP_PRICE_CAP, UNIQUE_ITEMS, shopStock, ShopProgress, resaleValue } from '../src/core/Economy';
import { CONSUMABLES, MAX_STACK, STARTING_INVENTORY, consumableStock } from '../src/data/consumables';
import { WORLD_NODES, WORLD_ROADS, worldNode } from '../src/core/World';

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
    a.terrainDriven ? 'changes with terrain' : '',
    a.cleanse ? 'cleanses ailments' : '',
    a.drain ? `drains ${Math.round(a.drain * 100)}%` : '',
    a.steal ? 'steals gear' : '',
    a.scalesWith === 'attack' ? 'scales with ATK' : '',
    a.charge ? '**lands next turn**, full force over the area, +30 hit' : '',
    a.rebirth ? `raises the fallen at ${Math.round(a.rebirth * 100)}% HP` : ''
  ].filter(Boolean).join(', ');
  return `| **${a.name}** \`${a.id}\` | ${kind} | ${a.jpCost} | ${isAction ? a.mpCost : '—'} | ${isAction ? a.range : '—'} | ${isAction ? a.heightTolerance : '—'} | ${isAction && a.aoe ? a.aoe : '—'} | ${isAction ? power : '—'} | ${isAction ? a.element : '—'} | ${extras || '—'} | ${a.description.replace(/\|/g, '/')} |`;
}

w('# Content Reference');
w();
w('> **Generated file — do not edit by hand.** Run `npm run docs:gen` after changing anything in `src/data/` or the Trials generator. CI fails if this file is out of date.');
w();
w('Every number here is read straight from the game data, so it always matches what ships.');
w();
w('**Contents:** [Jobs](#jobs) · [Job levels](#job-levels--requirements) · [Job mastery](#job-mastery) · [Abilities](#abilities) · [Monsters](#monsters) · [Status effects](#status-effects) · [Geomancy](#geomancy-terrain-spells) · [Items](#items) · [Supplies](#supplies) · [Shop](#shop--gil) · [World map](#world-map) · [Side battles](#side-battles) · [Difficulty](#difficulty) · [Armory](#armory--drops) · [Battlefields](#battlefields) · [Campaign](#campaign) · [Trials of the Zodiac](#trials-of-the-zodiac)');
w();

// ---------------------------------------------------------------- Jobs
const jobs = Object.values(JOBS).filter((j) => !j.monster);
const monsters = Object.values(JOBS).filter((j) => j.monster);
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

// ---------------------------------------------------------------- Job levels
w('## Job levels & requirements');
w();
w('A job levels up with the lifetime JP a unit earns in it (spending JP never lowers it).');
w();
w(`| Job level | ${JOB_LEVEL_JP.map((_, i) => (i === JOB_LEVEL_JP.length - 1 ? `${i + 1} (Master)` : String(i + 1))).join(' | ')} |`);
w(`| :--- | ${JOB_LEVEL_JP.map(() => '---:').join(' | ')} |`);
w(`| Lifetime JP | ${JOB_LEVEL_JP.join(' | ')} |`);
w();
w('| Job | Requires |');
w('| :--- | :--- |');
for (const j of jobs) w(`| **${j.name}** | ${(j.prerequisites || []).map((p) => `${jobName(p.jobId)} Lv ${p.level}`).join(' + ') || '— (open to everyone)'} |`);
w();
w('Every unit starts at Squire Lv 2. A unit created in an advanced job (a recruit, an enemy) is given the levels that job needs.');
w();

// ---------------------------------------------------------------- Equipment rules
w('## Equipment rules');
w();
w('Each job uses its own weapon types (0.30.0). Shields, heavy armor and helms, and robes belong to some jobs; light clothes, caps, hats, circlets and every accessory suit anyone. Changing job takes off what the new job can\'t use. Tamed beasts wear only beast gear.');
w();
w('| Job | Can use |');
w('| :--- | :--- |');
for (const j of jobs) w(`| **${j.name}** | ${jobGearText(j.id)} |`);
w();

// ---------------------------------------------------------------- Job mastery
w('## Job mastery');
w();
w(`A permanent bonus for sticking with a job. A unit earns the first amount at job level ${VETERAN_JOB_LEVEL} (${JOB_LEVEL_JP[VETERAN_JOB_LEVEL - 1]} lifetime JP) and the second, which replaces it, at level ${MAX_JOB_LEVEL} (Master, ${JOB_LEVEL_JP[MAX_JOB_LEVEL - 1]} JP). It keeps the bonus in every job, and bonuses from different jobs add up. Master also brings the job's **signature**: an action usable in any job, once per battle, for no MP, at +30 hit.`);
w();
w(`| Job | Lv ${VETERAN_JOB_LEVEL} (Veteran) | Lv ${MAX_JOB_LEVEL} (Master) | Signature | What it does | Reach |`);
w('| :--- | :--- | :--- | :--- | :--- | :--- |');
for (const j of jobs) {
  const m = JOB_MASTERY[j.id];
  const sg = SIGNATURES[j.id];
  const reach = !sg ? '' : sg.centered ? `around the user, area ${sg.aoe}` : `range ${sg.range}${sg.aoe ? `, area ${sg.aoe}` : ''}`;
  if (m) w(`| **${j.name}** | ${masteryLabel(m.stat, m.veteran)} | ${masteryLabel(m.stat, m.master)} | ${sg ? `**${sg.name}** \`${sg.id}\`` : '—'} | ${sg?.description || ''} | ${reach} |`);
}
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

// ---------------------------------------------------------------- Monsters (0.26.0)
w('## Monsters');
w();
w(`${monsters.length} monsters: enemies, never a job a squad member can take up, though a Beast Tamer can tame one into the squad (0.28). They wear no gear, know all their actions from level 1, and have innate statuses and immunities instead of gear traits. Met at the Howling Hollow and Briar Barrow side battles, on Trials floors from ${TRIAL_MONSTERS_FROM} up (the Barrow's from ${TRIAL_DEEP_MONSTERS_FROM}), from Chapter II in the story, and in Workshop scenarios.`);
w();
w('| Monster | Kind | Move | Jump | HP | MP | ATK | MAG | SPD | Starts with | Immune to |');
w('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |');
for (const j of monsters) {
  const m = j.statMultipliers;
  w(`| **${j.name}** \`${j.id}\` | ${j.role} | ${j.baseMove} | ${j.baseJump} | ${x(m.hp)} | ${x(m.mp)} | ${x(m.attack)} | ${x(m.magic)} | ${x(m.speed)} | ${(j.innate?.startStatus || []).join(', ') || '—'} | ${(j.innate?.immune || []).join(', ') || '—'} |`);
}
w();
for (const j of monsters) {
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
const statusText: Record<string, string> = {
  haste: 'Speed ×1.5 (bosses get a permanent Haste when enraged)',
  slow: 'Speed ×0.67 (minimum 2)',
  protect: 'Physical damage taken ×0.7',
  immobilize: 'Move becomes 0',
  poison: 'Lose 10% max HP at the start of each turn',
  focus: 'Physical power ×1.25',
  shell: 'Spell damage taken ×0.7',
  regen: 'Recover 8% max HP at the start of each turn (Regen from gear lasts the whole battle)',
  blind: 'Physical accuracy −40',
  silence: 'Abilities that cost MP are sealed',
  sleep: 'Turns pass without acting; any damage wakes the unit, and sleepers cannot dodge (100% hit)',
  breach: 'Physical damage taken ×1.25'
};
w('| Status | Kind | Lasts (turns) | Effect |');
w('| :--- | :--- | :---: | :--- |');
for (const [k, d] of Object.entries(STATUS_DURATION)) w(`| **${k}** | ${BENEFICIAL_STATUSES.includes(k as never) ? 'Buff' : 'Ailment'} | ${d} | ${statusText[k] || ''} |`);
w();
w('Gear with a **guard** trait blocks the ailments it lists; cleansing abilities (Purify, Chakra) remove every ailment.');
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
const fmtStats = (s: Record<string, number | undefined>) => Object.entries(s).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()} ${v! > 0 ? '+' : ''}${v}`).join(', ') || '—';
const fmtTraits = (i: (typeof ITEMS)[string]) => {
  const t = i.traits;
  if (!t) return '—';
  return [
    t.startStatus ? `starts with ${t.startStatus.join(' + ')}` : '',
    t.boost ? `${t.boost.join(', ')} +25%` : '',
    t.guard ? `guards ${t.guard.join(', ')}` : ''
  ].filter(Boolean).join('; ');
};
const source = (id: string) => {
  if (STARTING_ARMORY.includes(id)) return 'Starting gear';
  const ch = Object.values(CAMPAIGN_CHAPTERS).find((c) => c.rewardItemIds?.includes(id));
  const choice = Object.values(CAMPAIGN_CHAPTERS).flatMap((c) => (c.choices || []).map((o) => ({ c, o }))).find(({ o }) => o.rewardItemIds?.includes(id));
  const parts = [];
  if (ch) parts.push(`Win ${ch.title}`);
  if (choice) parts.push(`Choose "${choice.o.text}"`);
  if (RARE_DROP_POOL.includes(id)) parts.push('Trials drop');
  if (MERCHANT_ITEMS.includes(id)) parts.push(`${MERCHANT_NAME} only`);
  const trophy = Object.values(SKIRMISHES).find((d) => d.trophy === id);
  if (trophy) parts.push(`First win at ${trophy.name}`);
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
  w(slot === 'weapon' ? '| Item | Type | Range | Stats | Traits | Price | How to get | Who |' : '| Item | Kind | Stats | Traits | Price | How to get | Who |');
  w(slot === 'weapon' ? '| :--- | :--- | :---: | :--- | :--- | ---: | :--- | :--- |' : '| :--- | :--- | :--- | :--- | ---: | :--- | :--- |');
  for (const i of list) {
    const stats = fmtStats(i.stats as Record<string, number | undefined>);
    const who = whoCanUse(i)?.join(', ') || 'Anyone';
    if (slot === 'weapon') w(`| **${i.name}** \`${i.id}\` | ${i.weaponType} | ${i.range ?? 1} | ${stats} | ${fmtTraits(i)} | ${i.price} | ${source(i.id)} | ${who} |`);
    else w(`| **${i.name}** \`${i.id}\` | ${i.beast ? 'beast' : gearKind(i)} | ${stats} | ${fmtTraits(i)} | ${i.price} | ${source(i.id)} | ${who} |`);
  }
  w();
}

// ---------------------------------------------------------------- Supplies
w('## Supplies');
w();
w(`Used in battle with the **ITEM** command; one is spent each time. The squad shares them and can carry ${MAX_STACK} of each. A new squad starts with ${Object.entries(STARTING_INVENTORY).map(([id, n]) => `${n} × ${CONSUMABLES[id].name}`).join(' and ')}. Items always hit and do a fixed amount.`);
w();
w('| Supply | Effect | Reach | Area | Buy | Sell | Stocked |');
w('| :--- | :--- | :---: | :---: | ---: | ---: | :--- |');
for (const c of consumableStock(3)) {
  const effect = c.heal ? `Restores ${c.heal} HP` : c.mp ? `Restores ${c.mp} MP` : c.cleanse ? 'Cures every ailment' : c.revive ? `Raises a fallen ally at ${Math.round(c.revive * 100)}% HP` : `${c.damage} ${c.element || ''} damage to each foe hit`.replace('  ', ' ');
  w(`| **${c.name}** \`${c.id}\` | ${effect} | ${c.range} | ${c.aoe || '—'} | ${c.price} | ${resaleValue(c)} | ${c.stockedFrom === 0 ? 'Always' : 'After the first victory'} |`);
}
w();

// ---------------------------------------------------------------- Shop
w('## Shop & gil');
w();
w(`A new game starts with **${STARTING_GIL} gil**. A defeated enemy pays 20 + 10 × its level (×3 for a boss); winning adds 150 in the campaign or 100 + 20 × floor in the Trials. Stealing gear you already own fences it for half its price. Workshop battles pay nothing.`);
w();
w('| Stage | Price cap | Items on the shelves |');
w('| :--- | ---: | ---: |');
const stages = ['Before the first victory', 'Chapter I won', 'Chapter II won', 'Campaign cleared / Trials'];
stages.forEach((name, i) => w(`| ${name} | ${Number.isFinite(SHOP_PRICE_CAP[i as ShopProgress]) ? SHOP_PRICE_CAP[i as ShopProgress] : 'none'} | ${shopStock(i as ShopProgress).length} |`));
w();
w(`Never sold (won only): ${UNIQUE_ITEMS.map(itemName).join(', ')}.`);
w();
w('Trading happens at the market on the world map. It buys spare gear and supplies back for half price; gear a unit is wearing and the relics and trophies above can\'t be sold.');
w();
w(`**${MERCHANT_NAME}**, a travelling merchant, sets up at a won battlefield or an open side-battle camp once the first battle is won, and moves to another after every win (story or side battle). She sells two things: one piece from the market's next shelf, early, at ×${EARLY_MARKUP} its price (until every shelf is open), and one of her own goods, which nobody else sells: ${MERCHANT_ITEMS.map(itemName).join(', ')}. A ware bought stays on her blanket as sold until she moves on.`);
w();

// ---------------------------------------------------------------- World map
w('## World map');
w();
w('Where the squad stands between missions. Roads join the places; the squad walks the shortest way along them.');
w();
w('```mermaid');
w('flowchart LR');
for (const n of WORLD_NODES) w(`  ${n.id}["${n.name}${n.chapterId ? `<br/><i>${CAMPAIGN_CHAPTERS[n.chapterId].title}</i>` : n.kind === 'market' ? '<br/><i>buy and sell</i>' : n.kind === 'skirmish' ? '<br/><i>side battle</i>' : '<br/><i>post-game</i>'}"]`);
for (const [a, b] of WORLD_ROADS) w(`  ${a} --- ${b}`);
w('```');
w();
w('| Place | Kind | What happens there | Roads to |');
w('| :--- | :--- | :--- | :--- |');
for (const n of WORLD_NODES) {
  const roads = WORLD_ROADS.filter(([a, b]) => a === n.id || b === n.id).map(([a, b]) => worldNode(a === n.id ? b : a)!.name).join(', ');
  const what = n.kind === 'market' ? 'Buy and sell gear and supplies' : n.kind === 'trials' ? 'Enter the Trials of the Zodiac (after the story)' : n.kind === 'skirmish' ? `Side battle: ${SKIRMISHES[n.skirmishId!].foe}` : `${CAMPAIGN_CHAPTERS[n.chapterId!].title}: ${CAMPAIGN_CHAPTERS[n.chapterId!].subtitle}`;
  w(`| **${n.name}** | ${n.kind} | ${what} | ${roads} |`);
}
w();

w('### Camp scenes');
w();
w(`After each story battle but the last, the squad makes camp on the world map. Sitting by the fire plays a short scene, once per playthrough, and every squad member gains ${CAMP_JP} JP in their current job.`);
w();
w('| After | Scene | Speakers |');
w('| :--- | :--- | :--- |');
for (const sc of Object.values(CAMP_SCENES)) w(`| ${CAMPAIGN_CHAPTERS[sc.chapterId].title} | ${sc.title} | ${[...new Set(sc.lines.map((l) => l.speaker))].join(', ')} |`);
w();

// ---------------------------------------------------------------- Difficulty
w('## Difficulty');
w();
w('Chosen at New Game and changeable from the Menu. Applies to every battle but Workshop scenarios.');
w();
w('| Difficulty | Enemy levels | Boss HP | Enemy raises per battle |');
w('| :--- | :---: | :---: | :---: |');
for (const d of DIFFICULTY_ORDER) { const r = DIFFICULTIES[d]; w(`| **${r.label}** | ${r.levelShift > 0 ? '+' : ''}${r.levelShift} | ×${r.bossHp} | ${r.raiseCap} |`); }
w();

// ---------------------------------------------------------------- Side battles
w('## Side battles');
w();
w(`Optional battles at places on the world map (⚑). They can be fought any number of times and never move the story on. Enemies are the squad's average level (rounded down), one level higher for each earlier win there up to +${SKIRMISH_MAX_HEAT}, with a leader one level above the rest; four of them, five once the place is at full strength. A win pays the usual bounties plus ${skirmishBonus(0)} gil the first time and ${skirmishBonus(1)} after.`);
w();
w('| Place | Trophy (first win) |');
w('| :--- | :--- |');
for (const d of Object.values(SKIRMISHES)) w(`| **${d.name}** | ${itemName(d.trophy)} |`);
w();
w('| Place | Battlefield | Enemies | Drawn from | Goal | Opens after |');
w('| :--- | :--- | :--- | :--- | :--- | :--- |');
for (const d of Object.values(SKIRMISHES)) {
  const goal = d.objective?.type === 'survive' ? `Survive ${d.objective.rounds} rounds` : 'Defeat every enemy';
  w(`| **${d.name}** | ${MAPS[d.mapId]().name} | ${d.foe} | ${d.jobs.map(([job, title]) => `${title} (${jobName(job)})`).join(', ')} | ${goal} | ${d.opensAfter.map((c) => CAMPAIGN_CHAPTERS[c].title).join(' or ')} |`);
}
w();

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
