// Recruit side stories (0.43.0): Bria, Sable and Kestrel each get a chapter of their own.
import { describe, it, expect } from 'vitest';
import { SIDE_STORIES, buildSideStory, sanitizeSideStories, sideFoeLevel, sideStoryOpen, sideStoryStates } from '../src/core/SideStory';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { ITEMS } from '../src/data/items';
import { JOBS } from '../src/data/jobs';
import { MAPS } from '../src/data/maps';
import { UNIQUE_ITEMS, gearSaleBlock } from '../src/core/Economy';
import { WORLD_NODES, WORLD_ROADS, nodeState, worldNode } from '../src/core/World';
import { scenarioFromChapter, validateScenario } from '../src/core/Scenario';

const recruits = Object.values(CAMPAIGN_CHAPTERS).map((c) => c.recruit).filter(Boolean);

describe('recruit side stories (0.43.0)', () => {
  it('one for each story recruit, with a real place, map, relic and chapters', () => {
    const ids = Object.values(SIDE_STORIES).map((s) => s.hero.id).sort();
    expect(ids).toEqual([...new Set(recruits.map((r) => r!.id))].sort());
    for (const s of Object.values(SIDE_STORIES)) {
      expect(recruits.some((r) => r!.id === s.hero.id && r!.name === s.hero.name), s.id).toBe(true);
      expect(MAPS[s.mapId], s.id).toBeTruthy();
      expect(ITEMS[s.relic], s.id).toBeTruthy();
      expect(UNIQUE_ITEMS).toContain(s.relic);
      expect(gearSaleBlock(s.relic, [s.relic], [])).toBe('Relic'); // never sold
      for (const c of s.opensAfter) expect(CAMPAIGN_CHAPTERS[c], c).toBeTruthy();
      for (const f of s.foes) expect(JOBS[f.jobId], f.jobId).toBeTruthy();
      expect(s.foes.filter((f) => f.isBoss).length).toBe(1);
      const node = worldNode(s.id)!;
      expect(node.kind).toBe('story');
      expect(node.storyId).toBe(s.id);
      expect(WORLD_ROADS.some(([a, b]) => a === s.id || b === s.id)).toBe(true);
    }
    expect(WORLD_NODES.filter((n) => n.kind === 'story').length).toBe(Object.keys(SIDE_STORIES).length);
  });

  it('builds a playable battle: every enemy on open ground, off the squad tiles', () => {
    for (const id of Object.keys(SIDE_STORIES)) {
      const ch = buildSideStory(id, [8, 8, 9, 7]);
      expect(ch.recruit?.id).toBe(SIDE_STORIES[id].hero.id); // the hero always fights it
      expect(ch.mapData?.name).toBe(SIDE_STORIES[id].fieldName);
      expect(ch.rewardItemIds).toEqual([SIDE_STORIES[id].relic]);
      const errors = validateScenario(scenarioFromChapter(ch)).filter((i) => i.level === 'error');
      expect(errors, id).toEqual([]);
      // The hero speaks in their own story
      expect(ch.introDialogue.some((l) => l.speaker === SIDE_STORIES[id].hero.name)).toBe(true);
    }
  });

  it('enemies follow the squad, never under the floor, and the boss stands a level above', () => {
    const def = SIDE_STORIES.fenhollow;
    expect(sideFoeLevel(def, [3, 3, 4])).toBe(def.minLevel);
    expect(sideFoeLevel(def, [12, 12, 12])).toBe(12);
    const ch = buildSideStory('fenhollow', [12, 12, 12, 12]);
    const boss = ch.enemyRoster.find((e) => e.isBoss)!;
    expect(boss.level).toBe(13);
    expect(ch.enemyRoster.filter((e) => !e.isBoss).every((e) => e.level === 12)).toBe(true);
  });

  it('opens with its hero in the squad and its chapter won; told once', () => {
    const squad = ['p1', 'p2', 'p5'];
    expect(sideStoryOpen('fenhollow', ['chapter_1', 'chapter_2a'], squad, [])).toBe(false); // too early
    expect(sideStoryOpen('fenhollow', ['chapter_1', 'chapter_2a', 'chapter_3'], ['p1', 'p2'], [])).toBe(false); // no Bria
    expect(sideStoryOpen('fenhollow', ['chapter_1', 'chapter_2a', 'chapter_3'], squad, [])).toBe(true);
    expect(sideStoryOpen('fenhollow', ['chapter_1', 'chapter_2a', 'chapter_3'], squad, ['fenhollow'])).toBe(false);
    const states = sideStoryStates(['chapter_1', 'chapter_2b', 'chapter_3'], squad, []);
    expect(states).toEqual({ fenhollow: 'open', saltmere: 'locked', dunehome: 'locked' });
    expect(nodeState(worldNode('fenhollow')!, 'chapter_4', [], false, states)).toBe('open');
    expect(nodeState(worldNode('saltmere')!, 'chapter_4', [], false, states)).toBe('locked');
    expect(nodeState(worldNode('dunehome')!, 'chapter_4', [], false)).toBe('locked');
    expect(sideStoryStates([], [], ['saltmere']).saltmere).toBe('cleared');
  });

  it('keeps only real stories from a save', () => {
    expect(sanitizeSideStories(['saltmere', 'saltmere', 'nope', 3, '__proto__'])).toEqual(['saltmere']);
    expect(sanitizeSideStories(undefined)).toEqual([]);
  });
});
