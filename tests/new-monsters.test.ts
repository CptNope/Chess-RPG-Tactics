/**
 * 0.32.0: three more monsters (Basilisk, Bone Knight, Thornling), the Briar Barrow side battle
 * where they live, deeper Trials floors, and taming them.
 */
import { describe, it, expect } from 'vitest';
import { JOBS, isMonsterJob, PLAYER_JOB_IDS } from '../src/data/jobs';
import { ITEMS } from '../src/data/items';
import { UNIQUE_ITEMS } from '../src/core/Economy';
import { SKIRMISHES, buildSkirmish, skirmishOpen } from '../src/core/Skirmish';
import { WORLD_NODES, WORLD_ROADS } from '../src/core/World';
import { TRIAL_DEEP_MONSTERS_FROM, buildTrialFloor } from '../src/core/Trials';
import { JobSystem } from '../src/core/JobSystem';
import { BEAST_NAMES, beastFromTamed, canTame } from '../src/core/Taming';
import { guardsAgainst } from '../src/core/CombatEngine';

const NEW = ['basilisk', 'bone_knight', 'thornling'];

describe('new monsters', () => {
  it('are monster jobs with three actions, natural stats and names to tame them by', () => {
    for (const id of NEW) {
      const j = JOBS[id];
      expect(isMonsterJob(id), id).toBe(true);
      expect(PLAYER_JOB_IDS).not.toContain(id);
      expect(j.abilities.filter((a) => a.type === 'action')).toHaveLength(3);
      expect(j.innate?.stats, id).toBeTruthy();
      expect(BEAST_NAMES[id]?.length, id).toBeGreaterThanOrEqual(5);
    }
  });

  it('shrug off what they should', () => {
    const make = (id: string) => JobSystem.createUnit(id, id, 'enemy', id, 0, 0, 'S', 8);
    expect(guardsAgainst(make('basilisk'), 'immobilize')).toBe(true);
    expect(guardsAgainst(make('bone_knight'), 'poison')).toBe(true);
    expect(guardsAgainst(make('bone_knight'), 'sleep')).toBe(true);
    expect(guardsAgainst(make('thornling'), 'blind')).toBe(true);
    expect(make('thornling').statuses.some((s) => s.type === 'regen') || JOBS.thornling.innate?.startStatus?.includes('regen')).toBe(true);
  });

  it('can be tamed and join the squad', () => {
    const tamer = JobSystem.createUnit('t', 'T', 'player', 'tamer', 0, 0, 'N', 8);
    for (const id of NEW) {
      const m = JobSystem.createUnit(`e-${id}`, id, 'enemy', id, 0, 1, 'S', 7);
      expect(canTame(tamer, m), id).toBe(true);
      const b = beastFromTamed(m, []);
      expect(b.jobId).toBe(id);
      expect(b.name).toBe(BEAST_NAMES[id][0]);
    }
  });
});

describe('the Briar Barrow', () => {
  it('opens after Chapter III, on the map, with the new monsters and a relic', () => {
    const def = SKIRMISHES.barrow;
    expect(def.jobs.every(([j]) => isMonsterJob(j))).toBe(true);
    expect(new Set(def.jobs.slice(0, 3).map(([j]) => j))).toEqual(new Set(NEW));
    expect(skirmishOpen('barrow', ['chapter_1', 'chapter_2a'])).toBe(false);
    expect(skirmishOpen('barrow', ['chapter_3'])).toBe(true);
    expect(UNIQUE_ITEMS).toContain(def.trophy);
    expect(ITEMS.basilisk_eye.traits?.guard).toEqual(['immobilize', 'slow']);
    const node = WORLD_NODES.find((n) => n.skirmishId === 'barrow')!;
    expect(WORLD_ROADS.filter((r) => r.includes(node.id)).length).toBeGreaterThanOrEqual(1);
    // its signature enemies lead every visit
    const ch = buildSkirmish('barrow', [8, 8, 8, 8], 0);
    expect(ch.enemyRoster[0].jobId).toBe('bone_knight');
    expect(ch.enemyRoster[1].jobId).toBe('basilisk');
  });

  it('the Trials meet them from floor 8, and floors above it stay as they were', () => {
    const deep = Array.from({ length: 40 }, (_, i) => buildTrialFloor(TRIAL_DEEP_MONSTERS_FROM + i));
    expect(deep.some((f) => f.enemyRoster.some((e) => NEW.includes(e.jobId)))).toBe(true);
    for (let f = 1; f < TRIAL_DEEP_MONSTERS_FROM; f++) expect(buildTrialFloor(f).enemyRoster.some((e) => NEW.includes(e.jobId)), `floor ${f}`).toBe(false);
  });
});

describe('in the story (0.33.0)', () => {
  it('a Basilisk guards the Greywatch light and a Bone Knight comes up with the Regent', async () => {
    const { CAMPAIGN_CHAPTERS } = await import('../src/data/campaign');
    expect(CAMPAIGN_CHAPTERS.chapter_5.enemyRoster.some((e) => e.jobId === 'basilisk')).toBe(true);
    expect(CAMPAIGN_CHAPTERS.chapter_6.enemyRoster.some((e) => e.jobId === 'bone_knight')).toBe(true);
    // the squad warns you about them
    expect(CAMPAIGN_CHAPTERS.chapter_5.introDialogue.some((l) => /basilisk/i.test(l.text))).toBe(true);
    expect(CAMPAIGN_CHAPTERS.chapter_6.introDialogue.some((l) => /knights/i.test(l.text))).toBe(true);
  });
});
