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
    if (!['index.html', 'app.js', 'pastel.css', 'manifest.webmanifest', 'icon.svg'].includes(name)) {
      return route.abort();
    }
    await route.fulfill({
      body: await fs.readFile(path.join(__dirname, '..', name)),
      contentType: name.endsWith('.js') ? 'application/javascript' :
        name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/json',
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
  assert.equal(await page.locator('#nav button').count(), 5);
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
    if (['tasks', 'focus', 'settings'].includes(tab)) await page.locator('[data-action=more]').click();
    await page.locator(`[data-tab=${tab}]`).click();
    assert.ok((await page.locator('#view').innerText()).length > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
});

test('home preferences, reward shortcut and more menu preserve existing data', async t => {
  const page = await open(t);
  await page.evaluate(() => {
    state.wishId = state.rewards[0].id;
    state.ui.blocks = ['wish', 'tasks', 'level', 'progress', 'quests'];
    state.ui.hidden = ['progress'];
    save(); render();
  });
  const saved = await page.evaluate(() => localStorage.getItem(KEY));
  assert.equal(await page.locator('[data-home-block]').first().getAttribute('data-home-block'), 'wish');
  assert.equal(await page.locator('[data-home-block=progress]').isVisible(), false);
  await page.getByRole('button', { name: 'Jutalombolt megnyitása', exact: true }).click();
  assert.equal(await page.locator('#pageTitle').innerText(), 'Jutalombolt');
  await page.getByRole('button', { name: 'Továbbiak', exact: true }).click();
  await page.locator('#modalRoot [data-tab=focus]').click();
  assert.equal(await page.locator('#modalRoot').innerText(), '');
  assert.equal(await page.locator('#pageTitle').innerText(), 'Fókusz');
  assert.equal(await page.evaluate(() => localStorage.getItem(KEY)), saved);
  await page.reload();
  assert.equal(await page.locator('[data-home-block]').first().getAttribute('data-home-block'), 'wish');
  assert.equal(await page.locator('[data-home-block=progress]').isVisible(), false);
});

test('quick entry creates one dated todo without awarding XP and supports later editing', async t => {
  const page = await open(t);
  const before = await page.evaluate(() => state.tasks.length);
  await page.locator('#quickTaskName').fill('  Bevásárlás  ');
  await page.locator('#quickTaskName').press('Enter');
  assert.deepEqual(await page.evaluate(() => {
    const task = state.tasks.at(-1);
    return [state.tasks.length, task.name, task.kind, task.points, task.dueDate===day(), xp(), wallet()];
  }), [before+1, 'Bevásárlás', 'todo', 10, true, 0, 0]);
  const taskId = await page.evaluate(() => state.tasks.at(-1).id);
  await page.locator(`[data-action=editTask][data-id="${taskId}"]`).click();
  await page.locator('#taskForm [name=points]').fill('25');
  await page.locator('#taskForm button[type=submit]').click();
  await page.reload();
  assert.deepEqual(await page.evaluate(id => {
    const task = state.tasks.find(t=>t.id===id); return [task.name, task.points, task.kind];
  }, taskId), ['Bevásárlás', 25, 'todo']);
  await page.evaluate(() => { selectedDate=shift(day(),1);render(); });
  await page.locator('#quickTaskName').fill('Holnapi teendő');
  await page.locator('#quickTaskName').press('Enter');
  const lastId = await page.evaluate(() => state.tasks.at(-1).id);
  assert.equal(await page.locator(`[data-action=toggle][data-id="${lastId}"]`).isDisabled(), true);
  assert.equal(await page.evaluate(() => state.tasks.at(-1).dueDate===shift(day(),1)), true);
});

test('daily highlight is date-specific, persistent, and gives no extra XP', async t => {
  const page = await open(t);
  const taskId = await page.evaluate(() => state.tasks[0].id);
  await page.locator('[data-action=highlightModal]').click();
  await page.locator(`[data-action=setHighlight][data-id="${taskId}"]`).click();
  assert.equal(await page.locator('.daily-highlight-line').isVisible(), true);
  assert.equal(await page.locator('.task-highlighted').count(), 1);
  assert.deepEqual(await page.evaluate(() => [xp(), wallet()]), [0,0]);
  await page.reload();
  assert.equal(await page.locator('.task-highlighted').count(), 1);
  await page.locator(`[data-action=toggle][data-id="${taskId}"]`).click();
  assert.deepEqual(await page.evaluate(() => [xp(), wallet()]), [20,20]);
  assert.match(await page.locator('.daily-highlight-line').innerText(), /Kész/);
  await page.evaluate(() => { selectedDate=shift(day(),1);render(); });
  assert.equal(await page.locator('.daily-highlight-line').count(), 0);
  await page.locator('[data-action=dateToday]').click();
  await page.locator('.daily-highlight-line').click();
  await page.locator('[data-action=clearHighlight]').click();
  await page.reload();
  assert.equal(await page.locator('.task-highlighted').count(), 0);
});

test('archiving removes a habit from active views without losing history and restores it', async t => {
  const page = await open(t);
  const taskId = await page.evaluate(() => {
    const task=state.tasks[0]; task.subtasks=['Első lépés'];
    state.subtaskChecks[task.id+':'+day()]=[0]; toggle(task); return task.id;
  });
  const original = await page.evaluate(() => JSON.stringify({
    history:state.history, ledger:state.ledger, checks:state.subtaskChecks, days:state.tasks[0].days,
  }));
  await page.locator(`[data-action=editTask][data-id="${taskId}"]`).click();
  page.once('dialog', dialog=>dialog.dismiss());
  await page.locator('[data-action=archiveTask]').click();
  assert.equal(await page.evaluate(() => state.tasks[0].archived), false);
  page.once('dialog', dialog=>dialog.accept());
  await page.locator('[data-action=archiveTask]').click();
  assert.equal(await page.locator(`[data-action=toggle][data-id="${taskId}"]`).count(), 0);
  await page.reload();
  assert.equal(await page.evaluate(() => state.tasks[0].archived), true);
  assert.equal(await page.evaluate(() => JSON.stringify({
    history:state.history, ledger:state.ledger, checks:state.subtaskChecks, days:state.tasks[0].days,
  })), original);
  await page.locator('[data-action=more]').click();
  await page.locator('#modalRoot [data-tab=focus]').click();
  assert.equal(await page.locator(`#focusTask option[value="${taskId}"]`).count(), 0);
  await page.locator('#nav [data-tab=stats]').click();
  assert.match(await page.locator('.habit-stats').first().innerText(), /Archivált/);
  await page.locator('[data-action=more]').click();
  await page.locator('#modalRoot [data-tab=tasks]').click();
  await page.locator('.archived-habits summary').click();
  await page.locator(`[data-action=restoreTask][data-id="${taskId}"]`).click();
  await page.locator('#nav [data-tab=today]').click();
  assert.equal(await page.locator(`[data-action=toggle][data-id="${taskId}"]`).isVisible(), true);
  assert.deepEqual(await page.evaluate(() => [state.tasks[0].archived, xp(), wallet(), state.tasks[0].subtasks]), [false,20,20,['Első lépés']]);
});

test('XP goal shares momentum card and task groups stay compact across categories', async t => {
  const page = await open(t);
  assert.equal(await page.locator('.daily-progress').count(), 1);
  assert.equal(await page.getByText('Napi XP-cél', {exact:true}).count(), 0);
  assert.equal(await page.locator('.mission-group').count(), 2);
  assert.equal(await page.locator('.category-group').count(), 0);
  const taskId = await page.evaluate(() => state.tasks[0].id);
  await page.locator(`[data-action=toggle][data-id="${taskId}"]`).click();
  const bar=page.getByRole('progressbar', {name:'Napi XP-cél',exact:true});
  assert.equal(await bar.getAttribute('aria-valuenow'), '20');
  await page.locator(`[data-action=toggle][data-id="${taskId}"]`).click();
  assert.equal(await bar.getAttribute('aria-valuenow'), '0');
  await page.locator('[data-group="missions:habit"]').click();
  assert.equal(await page.locator('[data-mission-kind=habit] .task-row').count(), 0);
  assert.equal(await page.locator('[data-mission-kind=todo] .task-row').count(), 1);
  await page.locator('[data-group="missions:habit"]').click();
  assert.equal(await page.locator('[data-mission-kind=habit] .task-row').count(), 3);
});
