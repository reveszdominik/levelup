// Run with: node --test tests/regression.cjs (requires Playwright + Chromium).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
});
after(async () => { await browser?.close(); });
async function open(t, stored) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Budapest',
    serviceWorkers: 'block', acceptDownloads: true,
  });
  t.after(() => context.close());
  // Serve repository assets without a network service or external requests.
  await context.route('https://levelup.test/**', async route => {
    const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
    if (!['index.html', 'app.js', 'manifest.webmanifest', 'icon.svg'].includes(name)) {
      return route.abort();
    }
    await route.fulfill({
      body: await fs.readFile(path.join(__dirname, '..', name)),
      contentType: name.endsWith('.js') ? 'application/javascript' :
        name.endsWith('.html') ? 'text/html' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/json',
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto('https://levelup.test/');
  if (stored !== undefined) {
    await page.evaluate(value => localStorage.setItem('levelup-v1', value), stored);
    await page.reload();
  }
  return page;
}
async function importFile(page, value) {
  await page.locator('#importFile').setInputFiles({
    name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(value),
  });
}

test('unreadable saves survive boot, reload and raw export byte for byte', async t => {
  for (const raw of ['broken-json', 'null', '{}', '{"tasks":[null],"rewards":[],"ledger":[],"history":[]}']) {
    const page = await open(t, raw);
    assert.match(await page.locator('#view').innerText(), /A mentés nem tölthető be/);
    assert.equal(await page.evaluate(() => { save(); return localStorage.getItem(KEY); }), raw);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('[data-action=export]').click();
    const download = await downloadEvent;
    assert.equal(await fs.readFile(await download.path(), 'utf8'), raw);
    await page.reload();
    assert.equal(await page.evaluate(() => localStorage.getItem(KEY)), raw);
  }
});

test('recovery rejects invalid import, respects cancel, and accepts a valid old backup', async t => {
  const raw = 'original-broken-data';
  const page = await open(t, raw);
  await importFile(page, '{}');
  await page.getByText('Érvénytelen mentésfájl', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem(KEY)), raw);
  const valid = JSON.stringify({ tasks: [], rewards: [], ledger: [{ amount: 42 }], history: [] });
  page.once('dialog', dialog => dialog.dismiss());
  await importFile(page, valid);
  assert.equal(await page.evaluate(() => localStorage.getItem(KEY)), raw);
  page.once('dialog', dialog => dialog.accept());
  await importFile(page, valid);
  await page.getByText('Mentés importálva', { exact: true }).waitFor();
  assert.equal(await page.locator('#wallet').innerText(), '42');
  await page.reload();
  assert.equal(await page.locator('#wallet').innerText(), '42');
});

test('failed replacement preserves recovery and original data; reset requires confirmation', async t => {
  const page = await open(t, 'broken');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-action=reset]').click();
  assert.equal(await page.evaluate(() => localStorage.getItem(KEY)), 'broken');
  await page.evaluate(() => {
    window.realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
  });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-action=reset]').click();
  assert.equal(await page.evaluate(() => recoveryRequired), true);
  assert.equal(await page.evaluate(() => localStorage.getItem(KEY)), 'broken');
  await page.evaluate(() => { Storage.prototype.setItem = window.realSetItem; });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-action=reset]').click();
  assert.equal(await page.evaluate(() => recoveryRequired), false);
  await page.reload();
  assert.equal(await page.locator('#nav button').count(), 7);
});

test('past completion and undo use the selected date and original awarded XP', async t => {
  const page = await open(t);
  for (const kind of ['habit', 'todo']) {
    await page.evaluate(kind => {
      state = migrate(seed());
      selectedDate = shift(day(), -1);
      const task = state.tasks[0];
      task.kind = kind; task.created = selectedDate; task.dueDate = selectedDate;
      task.paused = [day()]; // Today's pause must not block yesterday.
      task.frequency = 'weekdays'; task.weekdays = [weekday(selectedDate)];
      state.tasks = [task]; render();
    }, kind);
    await page.locator('[data-action=toggle]').click();
    assert.deepEqual(await page.evaluate(() => [xp(), wallet(), state.history.length]), [20, 20, 1]);
    await page.evaluate(() => { state.tasks[0].points = 80; });
    await page.locator('[data-action=toggle]').click();
    assert.deepEqual(await page.evaluate(() => [xp(), wallet(), state.history.length, state.tasks[0].days.length]), [0, 0, 0, 0]);
  }
  await page.evaluate(() => {
    state.tasks[0].paused = [selectedDate]; render(); toggle(state.tasks[0]);
  });
  assert.equal(await page.evaluate(() => xp()), 0);
});

test('editing an old task preserves subtasks and checks through reload', async t => {
  const page = await open(t);
  await page.evaluate(() => {
    const task = state.tasks[0]; task.subtasks = ['Első lépés', 'Második lépés'];
    state.subtaskChecks[task.id + ':' + day()] = [1];
    taskModal(task);
  });
  await page.locator('#taskForm [name=name]').fill('Átnevezett szokás');
  await page.locator('#taskForm button[type=submit]').click();
  await page.reload();
  assert.deepEqual(await page.evaluate(() => ({
    name: state.tasks[0].name, subtasks: state.tasks[0].subtasks,
    checks: state.subtaskChecks[state.tasks[0].id + ':' + day()],
  })), { name: 'Átnevezett szokás', subtasks: ['Első lépés', 'Második lépés'], checks: [1] });
});

test('chart labels align with dates; all seven mobile views load', async t => {
  const page = await open(t);
  const labels = await page.evaluate(() => {
    const root = document.createElement('div'); root.innerHTML = weeklyXPChart();
    return [...root.querySelectorAll('.xp-column small')].map(x => x.textContent);
  });
  const expected = await page.evaluate(() => Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(fromKey(shift(day(), i - 6)))));
  const hu = { Mon: 'H', Tue: 'K', Wed: 'Sze', Thu: 'Cs', Fri: 'P', Sat: 'Szo', Sun: 'V' };
  assert.deepEqual(labels, expected.map(x => hu[x]));
  for (const tab of ['today', 'planner', 'tasks', 'rewards', 'stats', 'focus', 'settings']) {
    await page.locator(`[data-tab=${tab}]`).click();
    assert.ok((await page.locator('#view').innerText()).length > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
});
