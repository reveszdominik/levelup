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
    if (!['index.html', 'app.js', 'features.js', 'workflow.js', 'pastel.css', 'manifest.webmanifest', 'icon.svg'].includes(name)) {
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

test('emoji choices open on demand in task and reward editors', async t=>{
  const page=await open(t);
  for(const kind of ['task','reward']){
    await page.evaluate(kind=>kind==='task'?taskModal(state.tasks[0]):rewardModal(state.rewards[0]),kind);
    const form=page.locator(kind==='task'?'#taskForm':'#rewardForm');
    assert.equal(await form.locator('.emoji-grid').isVisible(),false);
    await form.getByRole('button',{name:'Emoji kiválasztása',exact:true}).click();
    assert.equal(await form.locator('.emoji-grid').isVisible(),true);
    await form.locator('[data-emoji="🎨"]').click();
    assert.equal(await form.locator('.emoji-grid').isVisible(),false);
    assert.equal(await form.locator('.selected-emoji').innerText(),'🎨');
    await form.locator('button[type=submit]').click();
    await page.reload();
    assert.equal(await page.evaluate(kind=>kind==='task'?state.tasks[0].emoji:state.rewards[0].emoji,kind),'🎨');
  }
});

test('subtasks can be edited and reordered without losing unchanged daily checks or awarding XP',async t=>{
  const page=await open(t),taskId=await page.evaluate(()=>state.tasks[0].id);
  await page.locator(`[data-action=editTask][data-id="${taskId}"]`).click();
  await page.locator('#subtaskEditor').fill('Porszívózás\nFelmosás');
  await page.locator('#taskForm button[type=submit]').click();
  await page.locator(`[data-action=subtasks][data-id="${taskId}"]`).click();
  await page.locator('[data-sub="0"]').check();
  assert.equal(await page.evaluate(()=>xp()),0);
  await page.locator('[data-action=close]').click();
  await page.locator(`[data-action=editTask][data-id="${taskId}"]`).click();
  await page.locator('#subtaskEditor').fill('Felmosás\nPorszívózás\nFürdő');
  await page.locator('#taskForm button[type=submit]').click();
  await page.reload();
  await page.locator(`[data-action=subtasks][data-id="${taskId}"]`).click();
  assert.equal(await page.locator('[data-sub="1"]').isChecked(),true);
  assert.equal(await page.locator('[data-sub="0"]').isChecked(),false);
  assert.equal(await page.locator('#subtaskProgress').innerText(),'1/3 lépés kész');
  await page.locator('[data-action=close]').click();
  await page.evaluate(()=>{selectedDate=shift(day(),1);render()});
  await page.locator(`[data-action=subtasks][data-id="${taskId}"]`).click();
  assert.equal(await page.locator('[data-sub="1"]').isChecked(),false);
  assert.equal(await page.locator('[data-sub="1"]').isDisabled(),true);
});

test('weekly review compares matching weekdays and respects pauses and weekly targets',async t=>{
  const page=await open(t);
  await page.clock.install({time:new Date('2026-11-04T12:00:00+01:00')});
  await page.evaluate(()=>{
    state=migrate(seed());const daily=state.tasks[0],weekly=state.tasks[2];
    daily.created=weekly.created='2026-10-19';daily.paused=['2026-11-04'];weekly.weeklyTarget=2;
    daily.days=['2026-11-02','2026-11-03','2026-10-29'];weekly.days=['2026-11-02'];state.tasks=[daily,weekly];
    state.history=state.tasks.flatMap(task=>task.days.map(date=>({id:id(),type:'task',taskId:task.id,name:task.name,points:task.points,date})));
    state.history.push({id:id(),type:'task',taskId:'old-task',name:'Korábbi feladat',points:10,date:'2026-10-26'});
    tab='stats';render();
  });
  assert.match(await page.locator('.review-comparison').innerText(),/\+2 teljesítés/);
  assert.match(await page.locator('.review-insight').innerText(),/30 perc olvasás/);
  await page.locator('.weekly-review summary').click();
  assert.match(await page.locator('.review-habit').nth(0).innerText(),/2\/2/);
  assert.match(await page.locator('.review-habit').nth(1).innerText(),/1\/2/);
});

async function showFocus(page){
  await page.locator('[data-action=more]').click();
  await page.locator('#modalRoot [data-tab=focus]').click();
}
test('focus survives reload and pause, settles a closed block once, and resets safely',async t=>{
  const page=await open(t);await showFocus(page);
  await page.locator('[data-action=focusStart]').click();
  await page.waitForFunction(()=>state.focusTimer?.running);
  const session=await page.evaluate(()=>state.focusTimer.sessionId);
  await page.reload();await showFocus(page);
  assert.equal(await page.evaluate(()=>focus.sessionId),session);
  await page.locator('[data-action=focusStart]').click();
  await page.waitForFunction(()=>state.focusTimer?.running===false);
  const paused=await page.evaluate(()=>focus.remaining);
  await page.reload();await showFocus(page);
  assert.equal(await page.evaluate(()=>focus.remaining),paused);
  await page.locator('[data-action=focusStart]').click();
  await page.waitForFunction(()=>state.focusTimer?.running);
  await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem(KEY));saved.focusTimer.end=Date.now()-2000;localStorage.setItem(KEY,JSON.stringify(saved))});
  await page.reload();await page.waitForFunction(()=>state.focusSessions.length===1);
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.focusSessions[0].id]),[15,15,session]);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.focusSessions.length]),[15,15,1]);
  await showFocus(page);await page.locator('[data-action=focusStart]').click();
  await page.waitForFunction(()=>state.focusTimer.running);
  await page.locator('[data-action=focusReset]').click();
  await page.waitForFunction(()=>!state.focusTimer.running);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>[focus.running,focus.remaining,state.focusSessions.length]),[false,1500,1]);
});

test('two tabs settle an expired focus session without duplicate credit',async t=>{
  const page=await open(t);await showFocus(page);await page.locator('[data-action=focusStart]').click();
  await page.waitForFunction(()=>state.focusTimer?.running);
  await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem(KEY));saved.focusTimer.end=Date.now()-1000;localStorage.setItem(KEY,JSON.stringify(saved))});
  const other=await page.context().newPage();
  await Promise.all([page.reload(),other.goto('https://levelup.test/')]);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('levelup-v1')).focusSessions.length===1);
  await other.reload();
  assert.deepEqual(await other.evaluate(()=>[xp(),wallet(),state.history.filter(h=>h.type==='focus').length]),[15,15,1]);
});

test('XP reset preserves completions, confirms intent, and old undo cannot subtract new XP',async t=>{
  const page=await open(t);
  const taskId=await page.evaluate(()=>{toggle(state.tasks[0]);tab='settings';render();return state.tasks[0].id});
  page.once('dialog',d=>d.dismiss());await page.locator('[data-action=resetXP]').click();
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet()]),[20,20]);
  page.once('dialog',d=>d.accept());await page.locator('[data-action=resetXP]').click();
  await page.waitForFunction(()=>xp()===0);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),level(),state.tasks[0].days.length,state.history.length,pointsOn(day())]),[0,0,1,1,1,0]);
  await page.locator(`[data-action=toggle][data-id="${taskId}"]`).click();
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet()]),[0,0]);
  await page.locator(`[data-action=toggle][data-id="${taskId}"]`).click();
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet()]),[20,20]);
});

test('storage failures do not partially reset XP or award a focus block',async t=>{
  const page=await open(t);
  await page.evaluate(()=>{toggle(state.tasks[0]);tab='settings';render();window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('QuotaExceededError')}});
  page.once('dialog',d=>d.accept());await page.locator('[data-action=resetXP]').click();
  await page.getByText('Mentés sikertelen – a korábbi adatok változatlanok.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.history[0].xpReset===true]),[20,20,false]);
  await page.evaluate(()=>{Storage.prototype.setItem=window.realSetItem});
  await showFocus(page);await page.locator('[data-action=focusStart]').click();
  await page.waitForFunction(()=>state.focusTimer?.running);
  await page.evaluate(async()=>{
    state.focusTimer.end=Date.now()-2000;save();focus=normalizeFocus(state.focusTimer);
    Storage.prototype.setItem=()=>{throw Error('QuotaExceededError')};await focusTick();
  });
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.focusSessions.length]),[20,20,0]);
  await page.evaluate(async()=>{Storage.prototype.setItem=window.realSetItem;await focusTick()});
  assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.focusSessions.length]),[35,35,1]);
});

test('compact home has no greeting and search/status filters do not change daily totals',async t=>{
 const page=await open(t);
 assert.equal(await page.locator('.head').isVisible(),false);
 assert.equal(await page.locator('.home-intro').count(),0);
 assert.ok((await page.locator('.level-card').boundingBox()).height<=110);
 const taskId=await page.evaluate(()=>state.tasks[0].id);
 await page.locator(`[data-action=toggle][data-id="${taskId}"]`).click();
 await page.locator('[data-workflow-action=filter][data-value=done]').click();
 assert.equal(await page.locator('#missionResults .task-row').count(),1);
 await page.locator('[data-workflow-action=filter][data-value=pending]').click();
 assert.equal(await page.locator('#missionResults .task-row').count(),3);
 assert.match(await page.locator('.momentum-tasks').innerText(),/1 \/ 4/);
 await page.locator('[data-workflow-action=search]').click();
 await page.locator('#missionSearch').fill('porszivozas');
 assert.equal(await page.locator('#missionResults .task-row').count(),1);
 assert.match(await page.locator('#missionResults').innerText(),/Porszívózás/);
 await page.locator('#missionSearch').fill('nem létezik');
 assert.equal(await page.locator('#missionResults .task-row').count(),0);
 await page.locator('[data-workflow-action=clearFilters]').click();
 assert.equal(await page.locator('#missionResults .task-row').count(),4);
 await page.reload();
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.ui.missionFilter]),[20,20,'all']);
});

test('rescheduling keeps partial steps and completed todo dates cannot be rewritten',async t=>{
 const page=await open(t);
 const taskId=await page.evaluate(()=>{const t=state.tasks.find(t=>t.kind==='todo');t.subtasks=['Első lépés'];state.subtaskChecks[t.id+':'+day()]=[0];save();render();return t.id});
 await page.locator(`[data-workflow-action=reschedule][data-id="${taskId}"]`).click();
 const future=await page.evaluate(()=>shift(day(),10));
 await page.locator('#moveDate').fill(future);await page.locator('#rescheduleForm button[type=submit]').click();
 assert.equal(await page.locator(`[data-action=toggle][data-id="${taskId}"]`).count(),0);
 assert.deepEqual(await page.evaluate(id=>[state.tasks.find(t=>t.id===id).dueDate,state.subtaskChecks[id+':'+shift(day(),10)],xp()],taskId),[future,[0],0]);
 await page.evaluate(date=>{selectedDate=date;render()},future);
 await page.locator(`[data-workflow-action=reschedule][data-id="${taskId}"]`).click();
 const yesterday=await page.evaluate(()=>shift(day(),-1));
 await page.locator('#moveDate').fill(yesterday);await page.locator('#rescheduleForm button[type=submit]').click();
 await page.evaluate(date=>{selectedDate=date;render()},yesterday);
 await page.locator(`[data-action=toggle][data-id="${taskId}"]`).click();
 assert.equal(await page.locator(`[data-workflow-action=reschedule][data-id="${taskId}"]`).count(),0);
 await page.locator(`[data-action=editTask][data-id="${taskId}"]`).click();
 await page.locator('#taskForm [name=dueDate]').fill(future);await page.locator('#taskForm button[type=submit]').click();
 assert.deepEqual(await page.evaluate(id=>[state.tasks.find(t=>t.id===id).dueDate,xp(),state.subtaskChecks[id+':'+shift(day(),-1)]],taskId),[yesterday,10,[0]]);
});

test('planned pause ranges can be added/removed and keep the streak across the break',async t=>{
 const page=await open(t);await page.clock.install({time:new Date('2026-11-02T12:00:00+01:00')});
 const taskId=await page.evaluate(()=>{state=migrate(seed());const t=state.tasks[0];t.created='2026-11-01';t.days=['2026-11-01'];selectedDate=day();save();tab='tasks';render();return t.id});
 for(const mode of ['add','remove','add']){
  await page.locator(`[data-workflow-action=pausePlan][data-id="${taskId}"]`).click();
  await page.locator('#pauseFrom').fill('2026-11-02');await page.locator('#pauseTo').fill('2026-11-04');
  await page.locator(`#pausePlanForm button[value=${mode}]`).click();
  assert.equal(await page.evaluate(id=>state.tasks.find(t=>t.id===id).paused.length,taskId),mode==='remove'?0:3);
 }
 await page.clock.setSystemTime(new Date('2026-11-05T12:00:00+01:00'));
 assert.equal(await page.evaluate(id=>streak(state.tasks.find(t=>t.id===id)).current,taskId),1);
 await page.reload();
 assert.deepEqual(await page.evaluate(id=>state.tasks.find(t=>t.id===id).paused,taskId),['2026-11-02','2026-11-03','2026-11-04']);
});

test('undoing task/reward deletion preserves intervening completions and a new reward goal',async t=>{
 const page=await open(t),taskId=await page.evaluate(()=>state.tasks[0].id);
 await page.locator(`[data-action=editTask][data-id="${taskId}"]`).click();
 page.once('dialog',d=>d.accept());await page.locator('[data-action=deleteTask]').click();
 assert.equal(await page.evaluate(id=>state.tasks.some(t=>t.id===id),taskId),false);
 await page.locator('[data-action=toggle]').first().click();
 const earned=await page.evaluate(()=>xp());
 await page.locator('[data-workflow-action=undoDelete]').click();
 assert.equal(await page.evaluate(id=>state.tasks.some(t=>t.id===id),taskId),true);
 assert.equal(await page.evaluate(()=>xp()),earned);
 const rewardId=await page.evaluate(()=>{state.wishId=state.rewards[0].id;save();rewardModal(state.rewards[0]);return state.rewards[0].id});
 page.once('dialog',d=>d.accept());await page.locator('[data-action=deleteReward]').click();
 const newWish=await page.evaluate(()=>{state.wishId=state.rewards[0].id;save();return state.wishId});
 await page.locator('[data-workflow-action=undoDelete]').click();
 assert.deepEqual(await page.evaluate(id=>[state.rewards.some(r=>r.id===id),state.wishId],rewardId),[true,newWish]);
});

test('local checkpoint survives reload and restores XP/reset and pre-import state',async t=>{
 const page=await open(t);await page.locator('[data-action=toggle]').first().click();
 const original=await page.evaluate(()=>[xp(),wallet(),state.tasks.length]);
 await page.evaluate(()=>{tab='settings';render()});
 page.once('dialog',d=>d.accept());await page.locator('[data-action=resetXP]').click();
 await page.waitForFunction(()=>xp()===0);
 await page.reload();await page.evaluate(()=>{tab='settings';render()});
 page.once('dialog',d=>d.dismiss());await page.locator('[data-workflow-action=restoreCheckpoint]').click();
 assert.equal(await page.evaluate(()=>xp()),0);
 page.once('dialog',d=>d.accept());await page.locator('[data-workflow-action=restoreCheckpoint]').click();
 await page.waitForFunction(()=>xp()>0);
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.tasks.length]),original);
 page.once('dialog',d=>d.accept());await importFile(page,JSON.stringify({tasks:[],rewards:[],ledger:[],history:[]}));
 await page.getByText('Mentés importálva',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>state.tasks.length),0);
 page.once('dialog',d=>d.accept());await page.locator('[data-workflow-action=restoreCheckpoint]').click();
 await page.waitForFunction(()=>state.tasks.length>0);
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.tasks.length]),original);
});

test('a saved checkpoint can recover an unreadable primary save',async t=>{
 const page=await open(t);
 await page.locator('[data-action=toggle]').first().click();const points=await page.evaluate(()=>xp());
 await page.evaluate(()=>{replaceWithCheckpoint(migrate(seed()),'Törlés előtt');localStorage.setItem(KEY,'broken-json')});
 await page.reload();assert.match(await page.locator('#view').innerText(),/A mentés nem tölthető be/);
 page.once('dialog',d=>d.accept());await page.locator('[data-workflow-action=restoreCheckpoint]').click();
 await page.waitForFunction(()=>!recoveryRequired);
 assert.equal(await page.evaluate(()=>xp()),points);
});

test('a failed primary write rolls back checkpoint changes without losing either previous state',async t=>{
 const page=await open(t);
 await page.evaluate(()=>{replaceWithCheckpoint(migrate(seed()),'Első pont');toggle(state.tasks[0])});
 const before=await page.evaluate(()=>[localStorage.getItem(KEY),localStorage.getItem(KEY+'-restore')]);
 const result=await page.evaluate(()=>{
  const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw Error('QuotaExceededError');return original.call(this,key,value)};
  const saved=replaceWithCheckpoint(migrate(seed()),'Második pont');Storage.prototype.setItem=original;
  return [saved,xp(),localStorage.getItem(KEY),localStorage.getItem(KEY+'-restore')];
 });
 assert.deepEqual(result,[false,20,...before]);
});
