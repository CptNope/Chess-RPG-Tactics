/**
 * Browser play-tests: the built game in a real (headless) Chromium, played the way a person
 * would, failing on any page error. Runs in CI after the build, and locally with
 *
 *   npm run build && npm run playtest
 *
 * It serves dist/ with `vite preview` and drives the game through `?debug` (which exposes the
 * game object as window.__tactics) and `?fast` (skips the title, shortens waits). Each check runs
 * in a fresh page. Set CHROME_PATH to use an installed Chrome instead of Playwright's Chromium.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const results = [];

// ------------------------------------------------------------------ server

function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start')), 30000);
    const onData = (d) => { if (String(d).includes(String(PORT))) { clearTimeout(timer); resolve(proc); } };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => reject(new Error(`vite preview exited (${code})`)));
  });
}

// ------------------------------------------------------------------ helpers

async function openPage(browser, query = '?debug&fast', viewport = { width: 1280, height: 720 }, mobile = false) {
  const page = await browser.newPage({ viewport, hasTouch: mobile, isMobile: mobile });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('chess_rpg_tactics_tips_v1', JSON.stringify({ seen: [], off: true })); } catch { /* storage may be blocked */ }
  });
  await page.goto(BASE + '/' + query);
  if (query.includes('debug')) await page.waitForFunction(() => !!window.__tactics, null, { timeout: 20000 });
  return { page, errors };
}

/** Plays the current battle on AUTO for the player until it ends; returns 'victory' | 'defeat'. */
async function autoBattle(page, maxSteps = 900) {
  for (let i = 0; i < maxSteps; i++) {
    const st = await page.evaluate(() => {
      const g = window.__tactics;
      return { mode: g.currentMode, team: g.turnManager.activeUnit?.team, over: g.battleOver };
    });
    if (st.over) break;
    if (st.mode === 'dialogue') await page.keyboard.press('Space');
    else if (st.mode === 'facing') await page.click('#btn-face-confirm').catch(() => {});
    else if (st.mode === 'idle' && st.team === 'player') await page.evaluate(() => window.__tactics.handleAutoCommand());
    await page.waitForTimeout(100);
  }
  await page.waitForSelector('#result-modal:not(.hidden)', { timeout: 20000 });
  const text = await page.locator('#result-modal').innerText();
  if (/VICTORY/.test(text)) return 'victory';
  if (/DEFEAT/.test(text)) return 'defeat';
  throw new Error(`battle ended without a result: ${text.slice(0, 120)}`);
}

async function skipDialogue(page) {
  for (let i = 0; i < 40; i++) {
    if ((await page.evaluate(() => window.__tactics.currentMode)) !== 'dialogue') return;
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
  }
}

function expect(cond, message) {
  if (!cond) throw new Error(message);
}

async function check(browser, name, fn, opts = {}) {
  const started = Date.now();
  const { page, errors } = await openPage(browser, opts.query, opts.viewport, opts.mobile);
  try {
    const note = await fn(page);
    if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
    results.push({ name, ok: true, note, ms: Date.now() - started });
  } catch (e) {
    results.push({ name, ok: false, note: String(e.message || e).slice(0, 400), ms: Date.now() - started });
    await page.screenshot({ path: `playtest-${name.replace(/\W+/g, '-')}.png` }).catch(() => {});
  } finally {
    await page.close();
  }
}

// ------------------------------------------------------------------ the checks

const CHECKS = [
  ['title screen starts a new game', async (page) => {
    await page.waitForSelector('#title-new:not([disabled])', { timeout: 20000 });
    await page.click('#title-new');
    await page.waitForSelector('#result-modal:not(.hidden)');
    await page.locator('#result-modal button', { hasText: 'Normal' }).click();
    await page.waitForFunction(() => window.__tactics?.currentMode === 'dialogue' || window.__tactics?.currentMode === 'idle', null, { timeout: 20000 });
    const n = await page.evaluate(() => window.__tactics.units.length);
    expect(n >= 6, `expected a battle with units, found ${n}`);
    return `${n} units on the field`;
  }, { query: '?debug' }],

  ['Chapter I plays to the end on AUTO', async (page) => {
    await skipDialogue(page);
    const r = await autoBattle(page);
    return r;
  }],

  ['Team screen: jobs, gear and shop tabs', async (page) => {
    await skipDialogue(page);
    await page.evaluate(() => window.__tactics.openTeamFor(window.__tactics.squad[0]));
    await page.waitForSelector('#job-modal:not(.hidden)');
    const jobs = await page.locator('#job-list .job-item').count();
    expect(jobs >= 10, `expected the job list, found ${jobs}`);
    await page.click('#btn-tab-equip');
    expect((await page.locator('.gear-slot-box').count()) === 5, 'expected five gear slots');
    await page.click('#btn-tab-shop');
    expect((await page.locator('.shop-item').count()) > 0, 'expected shop items');
    return `${jobs} jobs`;
  }],

  ['world map, market and side battle', async (page) => {
    await skipDialogue(page);
    await page.evaluate(() => {
      const g = window.__tactics;
      g.clearedChapters = ['chapter_1']; g.campaignChapterId = 'chapter_2a'; g.campSeen = ['chapter_1'];
      g.openWorldMap('ruins');
    });
    await page.waitForSelector('[data-node="market"]');
    await page.click('[data-node="market"]');
    await page.waitForTimeout(800);
    await page.click('[data-node="hollow"]');
    await page.waitForTimeout(800);
    await page.locator('.wm-action', { hasText: 'Fight' }).click();
    await page.waitForFunction(() => window.__tactics.units.some((u) => u.team === 'enemy' && u.jobId === 'wolf'), null, { timeout: 20000 });
    return 'Howling Hollow loaded';
  }],

  ['a later chapter loads with monsters', async (page) => {
    await skipDialogue(page);
    await page.evaluate(() => {
      const g = window.__tactics;
      g.clearedChapters = ['chapter_1', 'chapter_2a', 'chapter_3', 'chapter_4']; g.campSeen = [...g.clearedChapters];
      g.loadChapter('chapter_5');
    });
    await page.waitForFunction(() => window.__tactics.units.some((u) => u.team === 'enemy' && u.jobId === 'wyvern'), null, { timeout: 20000 });
    await skipDialogue(page);
    // a few turns, to exercise the enemy planner with items and caution
    for (let i = 0; i < 120; i++) {
      const st = await page.evaluate(() => ({ mode: window.__tactics.currentMode, team: window.__tactics.turnManager.activeUnit?.team, over: window.__tactics.battleOver }));
      if (st.over) break;
      if (st.mode === 'dialogue') await page.keyboard.press('Space');
      else if (st.mode === 'facing') await page.click('#btn-face-confirm').catch(() => {});
      else if (st.mode === 'idle' && st.team === 'player') await page.evaluate(() => window.__tactics.handleAutoCommand());
      await page.waitForTimeout(100);
    }
    return 'Chapter V ran';
  }],

  ['sail to the Far Shore (Act III)', async (page) => {
    await skipDialogue(page);
    await page.evaluate(() => {
      const g = window.__tactics;
      g.clearedChapters = ['chapter_1', 'chapter_2a', 'chapter_3', 'chapter_4', 'chapter_5', 'chapter_6']; g.campSeen = [...g.clearedChapters];
      g.campaignChapterId = 'chapter_7';
      g.openWorldMap('harbor');
    });
    await page.locator('.wm-action', { hasText: 'Sail to the Far Shore' }).click();
    await page.waitForSelector('[data-node="saltglass"]');
    const title = await page.locator('#world-map h2').textContent();
    expect(title === 'THE FAR SHORE', `map title: ${title}`);
    expect((await page.locator('[data-node="market"]').count()) === 0, 'the realm\'s places should be hidden');
    await page.click('[data-node="saltglass"]');
    await page.waitForTimeout(800);
    await page.locator('.wm-action', { hasText: 'March' }).click();
    await page.waitForFunction(() => window.__tactics.units.some((u) => u.team === 'enemy' && u.jobId === 'basilisk'), null, { timeout: 20000 });
    return 'Saltglass Shore loaded';
  }],

  ['save and load', async (page) => {
    await skipDialogue(page);
    const before = await page.evaluate(() => { const g = window.__tactics; g.gil = 1234; g.saveGame(false); return g.squad.map((u) => u.name).join(','); });
    await page.evaluate(() => { window.__tactics.gil = 0; window.__tactics.loadGame(); });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ gil: window.__tactics.gil, squad: window.__tactics.squad.map((u) => u.name).join(',') }));
    expect(after.gil === 1234, `gil after load: ${after.gil}`);
    expect(after.squad === before, 'squad changed across save and load');
    return 'round trip ok';
  }],

  ['phone: battle and Team screen', async (page) => {
    await skipDialogue(page);
    await page.evaluate(() => window.__tactics.handleAutoCommand());
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__tactics.openTeamFor(window.__tactics.squad[0]));
    await page.waitForSelector('#job-modal:not(.hidden)');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow <= 1, `page scrolls sideways by ${overflow}px`);
    return 'no sideways scroll';
  }, { viewport: { width: 390, height: 844 }, mobile: true }]
];

// ------------------------------------------------------------------ run

const server = await startServer();
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
});
try {
  for (const [name, fn, opts] of CHECKS) await check(browser, name, fn, opts);
} finally {
  await browser.close();
  server.kill();
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${(r.ms / 1000).toFixed(1)}s)  ${r.note || ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} play-tests failed` : `\nAll ${results.length} play-tests passed`);
process.exit(failed ? 1 : 0);
