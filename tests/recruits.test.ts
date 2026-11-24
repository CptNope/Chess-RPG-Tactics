/**
 * 0.25.0: recruiting at the market, a barracks of ten, and choosing the party of six.
 */
import { describe, it, expect } from 'vitest';
import { JOBS, PLAYER_JOB_IDS } from '../src/data/jobs';
import { CAMPAIGN_CHAPTERS } from '../src/data/campaign';
import { JobSystem } from '../src/core/JobSystem';
import { SaveManager } from '../src/core/SaveManager';
import {
  BOARD_SIZE, LEADER_ID, MAX_SQUAD, PARTY_SIZE, RECRUIT_JOBS, RECRUIT_NAMES, RECRUIT_PITCH,
  chooseParty, hireRecruit, isHired, recruitBoard, recruitJobs, recruitLevel, recruitPrice, sanitizeParty, sanitizeRecruitHires
} from '../src/core/Recruits';
import { Unit } from '../src/core/types';

const squadOf = (n: number, level = 5): Unit[] =>
  Array.from({ length: n }, (_, i) => JobSystem.createUnit(i === 0 ? LEADER_ID : `u${i}`, ['Rowan', 'Maren', 'Tobin', 'Corvin', 'Bria', 'Sable', 'X7', 'X8', 'X9', 'X10'][i], 'player', 'squire', 0, 0, 'N', level));

describe('the recruiting board', () => {
  it('offers three hopefuls, the same for the same visit, different after a win', () => {
    const squad = squadOf(4);
    const a = recruitBoard(3, 2, squad);
    expect(a.length).toBe(BOARD_SIZE);
    expect(recruitBoard(3, 2, squad)).toEqual(a);
    const later = [4, 5, 6].map((v) => recruitBoard(v, 2, squad));
    expect(later.some((b) => JSON.stringify(b.map((r) => [r.name, r.jobId])) !== JSON.stringify(a.map((r) => [r.name, r.jobId])))).toBe(true);
  });

  it('never repeats a job or a name on one board, nor a name already in the squad', () => {
    for (let visit = 0; visit < 60; visit++) {
      const squad = squadOf(4);
      squad[1].name = RECRUIT_NAMES[visit % RECRUIT_NAMES.length];
      const board = recruitBoard(visit, 5, squad);
      expect(new Set(board.map((r) => r.jobId)).size, `visit ${visit}`).toBe(BOARD_SIZE);
      expect(new Set(board.map((r) => r.name)).size, `visit ${visit}`).toBe(BOARD_SIZE);
      for (const r of board) expect(squad.some((u) => u.name === r.name), r.name).toBe(false);
    }
  });

  it('opens more jobs as the story goes on', () => {
    expect(recruitJobs(0)).toEqual(RECRUIT_JOBS[0].jobs);
    expect(recruitJobs(2).length).toBe(RECRUIT_JOBS[0].jobs.length + RECRUIT_JOBS[1].jobs.length);
    expect(recruitJobs(9).length).toBe(PLAYER_JOB_IDS.length);
    for (let visit = 0; visit < 40; visit++) for (const r of recruitBoard(visit, 0, squadOf(4))) expect(RECRUIT_JOBS[0].jobs).toContain(r.jobId);
    for (const id of PLAYER_JOB_IDS) expect(RECRUIT_PITCH[id], id).toBeTruthy();
  });

  it('hopefuls come a level below the squad, priced by level and job', () => {
    expect(recruitLevel([5, 5, 6, 6])).toBe(5);
    expect(recruitLevel([1])).toBe(1);
    expect(recruitLevel([])).toBe(1);
    for (const r of recruitBoard(7, 6, squadOf(4, 8))) {
      expect([7, 8]).toContain(r.level);
      expect(r.price).toBe(recruitPrice(r.jobId, r.level));
    }
    expect(recruitPrice('squire', 4)).toBe(560);
    expect(recruitPrice('paladin', 4)).toBe(700); // a job that needs others first costs a quarter more
  });

  it('marks who was hired from this board only', () => {
    const squad = squadOf(4);
    expect(recruitBoard(3, 2, squad, { visit: 3, slots: [1] }).map((r) => !!r.hired)).toEqual([false, true, false]);
    expect(recruitBoard(4, 2, squad, { visit: 3, slots: [1] }).some((r) => r.hired)).toBe(false);
  });

  it('names belong to nobody in the story', () => {
    const story = new Set<string>();
    for (const ch of Object.values(CAMPAIGN_CHAPTERS)) {
      for (const l of [...ch.introDialogue, ...(ch.victoryDialogue || [])]) story.add(l.speaker);
      for (const e of ch.enemyRoster) story.add(e.name);
      if (ch.recruit) story.add(ch.recruit.name);
    }
    for (const n of RECRUIT_NAMES) expect([...story].some((s) => s.split(' ').includes(n)), n).toBe(false);
    expect(new Set(RECRUIT_NAMES).size).toBe(RECRUIT_NAMES.length);
  });
});

describe('hiring', () => {
  it('a hire arrives in their job with its gear, first ability and JP to spend', () => {
    const offer = recruitBoard(2, 6, squadOf(4, 6))[0];
    const u = hireRecruit(offer);
    expect(u.team).toBe('player');
    expect(u.name).toBe(offer.name);
    expect(u.jobId).toBe(offer.jobId);
    expect(u.level).toBe(offer.level);
    expect(u.unlockedAbilities[JOBS[offer.jobId].abilities[0].id]).toBe(true);
    expect(u.jobPoints[offer.jobId]).toBeGreaterThanOrEqual(200 + offer.level * 40 - 1);
    expect(Object.values(u.equipment).some(Boolean)).toBe(true);
    expect(u.currentHp).toBe(u.maxHp);
    expect(isHired(u)).toBe(true);
    expect(isHired(squadOf(1)[0])).toBe(false);
    // Every job on any board can be hired: prerequisites come with it
    for (const jobId of PLAYER_JOB_IDS) {
      const h = hireRecruit({ ...offer, jobId });
      expect(JobSystem.canChangeJob(h, jobId), jobId).toBe(true);
    }
  });

  it('ids stay unique when a board comes round again (New Game+)', () => {
    const offer = recruitBoard(0, 0, squadOf(4))[0];
    const a = hireRecruit(offer);
    const b = hireRecruit(offer, [a.id]);
    expect(b.id).not.toBe(a.id);
    expect(/^[\w-]{1,24}$/.test(b.id)).toBe(true);
  });
});

describe('the party', () => {
  it('everyone deploys while the squad fits', () => {
    const squad = squadOf(6);
    expect(chooseParty(squad, ['u2'])).toEqual(squad.map((u) => u.id));
  });

  it('with more than six: the leader, anyone required, then the pick, at most six', () => {
    const squad = squadOf(9);
    const party = chooseParty(squad, ['u8', 'u7', 'u3', 'u2', 'u1', 'u4', 'u5']);
    expect(party.length).toBe(PARTY_SIZE);
    expect(party[0]).toBe(LEADER_ID);
    expect(party.slice(1)).toEqual(['u8', 'u7', 'u3', 'u2', 'u1']);
    // a story recruit joining in this battle takes a place
    expect(chooseParty(squad, ['u8', 'u7', 'u3', 'u2', 'u1'], ['u6'])).toEqual([LEADER_ID, 'u6', 'u8', 'u7', 'u3', 'u2']);
    // no pick yet: the squad in order
    expect(chooseParty(squad, undefined)).toEqual(squad.slice(0, 6).map((u) => u.id));
    // a pick naming someone dismissed since, or the leader twice
    expect(chooseParty(squad, ['gone', LEADER_ID, 'u5'])).toEqual([LEADER_ID, 'u5']);
  });

  it('saves keep a sane party, hires and up to ten units', () => {
    expect(sanitizeParty(['p1', 'u2', 'u2', '<script>', 5, 'x'.repeat(30)])).toEqual(['p1', 'u2']);
    expect(sanitizeParty('p1')).toBeUndefined();
    expect(sanitizeRecruitHires({ visit: 4, slots: [0, 2, 2, 7, -1, 'a'] })).toEqual({ visit: 4, slots: [0, 2] });
    expect(sanitizeRecruitHires({ visit: -1, slots: [] })).toBeUndefined();
    const squad = Array.from({ length: 12 }, (_, i) => ({ ...JobSystem.createUnit(`hire-${i}-0`, `Hire ${i}`, 'player', 'knight', 0, 0, 'N', 4) }));
    const d = SaveManager.parseImport(JSON.stringify({ version: '0.25.0', currentChapterId: 'chapter_3', units: squad, party: ['hire-1-0', 'hire-2-0'], recruitHires: { visit: 3, slots: [1] } }));
    expect(d.units.length).toBe(MAX_SQUAD);
    expect(d.units[3].id).toBe('hire-3-0');
    expect(d.party).toEqual(['hire-1-0', 'hire-2-0']);
    expect(d.recruitHires).toEqual({ visit: 3, slots: [1] });
  });
});
