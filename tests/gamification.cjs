// Run with: node --test tests/gamification.cjs (requires Playwright + Chromium).
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
    if (!['index.html', 'app.js', 'features.js', 'workflow.js', 'gamification.js', 'pastel.css', 'manifest.webmanifest', 'icon.svg'].includes(name)) {
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

async function clickTask(page,button){await button.click();await page.waitForFunction(()=>pendingTaskAwards.size===0)}

async function oneHabit(page,points=20){
 await page.evaluate(points=>{state=migrate(seed());const task=state.tasks[0];task.points=points;state.tasks=[task];save();render()},points);
}
async function miniButton(page,slot){
 if(!await page.locator('.daily-mini-quests').getAttribute('open')){
  if(!await page.locator('.daily-mini-quests').evaluate(e=>e.open))await page.locator('.daily-mini-quests > summary').click();
 }
 return page.locator(`[data-game-action=claimMini][data-slot=${slot}]`);
}

test('legacy save migrates additively into one daily card without awarding or replaying XP',async t=>{
 const page=await open(t);
 const legacy=await page.evaluate(()=>seed());
 legacy.ledger=[{amount:420,type:'task',date:legacy.tasks[0].created}];
 legacy.history=[{id:'old-completion',type:'task',taskId:legacy.tasks[0].id,name:'Korábbi teljesítés',points:420,date:legacy.tasks[0].created}];
 await page.evaluate(raw=>localStorage.setItem(KEY,raw),JSON.stringify(legacy));await page.reload();
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),level(),state.tasks.length,state.history.length]),[420,420,3,4,1]);
 assert.equal(await page.locator('.daily-development').count(),1);
 assert.equal(await page.locator('.level-card').count(),0);
 assert.equal(await page.locator('.game-milestone,.xp-float').count(),0);
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions.length),3);
 await page.reload();assert.equal(await page.locator('.game-milestone,.xp-float').count(),0);
});

test('mini missions use reachable tasks and adapt when a category becomes unavailable',async t=>{
 const page=await open(t);
 assert.deepEqual(await page.evaluate(()=>state.dailyMissions[day()].missions.map(m=>[m.kind,m.target])),[['count',3],['xp',80],['habit',1]]);
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions[2].category),'Egészség');
 await page.evaluate(()=>{state.tasks.find(t=>t.category==='Egészség').archived=true;save();render()});
 assert.notEqual(await page.evaluate(()=>state.dailyMissions[day()].missions[2].category),'Egészség');
 await page.evaluate(()=>{state.tasks.forEach(t=>{t.archived=true});save();render()});
 assert.deepEqual(await page.evaluate(()=>state.dailyMissions[day()].missions.map(m=>m.kind)),['create','xp','focus']);
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions.every(m=>m.target>0)),true);
 await page.locator('#quickTaskName').fill('Elérhető mai teendő');await page.locator('#quickTaskName').press('Enter');
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions[0].completed),true);
});

test('rapid completion and repeated mini claims award once, persist, and preserve reversal accounting',async t=>{
 const page=await open(t);await oneHabit(page);
 await page.evaluate(async()=>{await Promise.all([toggle(state.tasks[0]),toggle(state.tasks[0])])});
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.history.length]),[20,20,1]);
 const button=await miniButton(page,'count');await button.click();await page.waitForFunction(()=>pendingMiniClaims.size===0);
 await page.evaluate(async()=>{await Promise.all([claimMini('count'),claimMini('count')])});
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.questClaims.length]),[40,40,1]);
 await page.reload();assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions[0].claimed),true);
 await page.evaluate(async()=>{await toggle(state.tasks[0])});
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet()]),[20,20]);
 await page.evaluate(async()=>{await toggle(state.tasks[0]);await claimMini('count')});
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.ledger.filter(x=>x.type==='quest').length]),[40,40,1]);
});

test('two tabs cannot duplicate the same completion or the same mini reward',async t=>{
 const page=await open(t);await oneHabit(page);
 const other=await page.context().newPage();await other.goto('https://levelup.test/');
 await page.evaluate(()=>{window.gate=navigator.locks.request(KEY+'-focus',()=>new Promise(resolve=>window.releaseGate=resolve))});
 await page.waitForFunction(()=>!!window.releaseGate);
 const simultaneous=[page.evaluate(()=>toggle(state.tasks[0])),other.evaluate(()=>toggle(state.tasks[0]))];
 await page.waitForFunction(()=>pendingTaskAwards.size===1);await other.waitForFunction(()=>pendingTaskAwards.size===1);
 await page.evaluate(()=>window.releaseGate());await Promise.all(simultaneous);
 await page.reload();
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.history.filter(h=>h.type==='task').length]),[20,20,1]);
 await Promise.all([page.evaluate(()=>claimMini('xp')),other.evaluate(()=>claimMini('xp'))]);
 await page.reload();
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.history.filter(h=>h.type==='quest').length]),[35,35,1]);
});

test('mission bonuses do not advance the XP mission and undo revokes unclaimed eligibility',async t=>{
 const page=await open(t);await oneHabit(page);
 await page.evaluate(async()=>{await toggle(state.tasks[0]);await toggle(state.tasks[0])});
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions[0].completed),false);
 await page.evaluate(()=>claimMini('count'));
 assert.equal(await page.evaluate(()=>xp()),0);
 await page.evaluate(()=>{state.tasks=[];state.dailyMissions={};save();render()});
 await page.locator('#quickTaskName').fill('Új feladat');await page.locator('#quickTaskName').press('Enter');
 await page.evaluate(()=>claimMini('count'));
 assert.equal(await page.evaluate(()=>xp()),20);
 assert.equal(await page.evaluate(()=>missionProgress(state,state.dailyMissions[day()].missions[1],day())),0);
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions[1].completed),false);
});

test('level and daily goal animate once per milestone and never replay on reload',async t=>{
 const page=await open(t);await oneHabit(page);
 await page.evaluate(()=>{
  state.settings.dailyXPGoal=200;state.history.push({id:'previous',type:'focus',name:'Korábbi fókusz',points:190,date:day()});state.ledger.push({amount:190,type:'focus',date:day()});save();render();
 });
 await clickTask(page,page.locator('[data-action=toggle]').first());
 assert.deepEqual(await page.evaluate(()=>[xp(),level(),state.gameFeedback.goalDays[day()]]),[210,2,true]);
 assert.match(await page.locator('.game-milestone').innerText(),/2\. szint/);
 assert.match(await page.locator('.game-milestone').innerText(),/190 XP/);
 assert.equal(await page.locator('#xpEffects').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 await page.reload();assert.equal(await page.locator('.game-milestone,.xp-float').count(),0);
 await page.evaluate(async()=>{await toggle(state.tasks[0]);await toggle(state.tasks[0])});
 assert.equal(await page.locator('.game-milestone').count(),0);
 assert.equal(await page.evaluate(()=>state.gameFeedback.maxLevel),2);
});

test('animation preferences and reduced motion suppress all visual effects and haptics can be disabled',async t=>{
 const page=await open(t);await oneHabit(page);
 await page.evaluate(()=>{window.vibrations=0;navigator.vibrate=()=>{window.vibrations++;return true};tab='settings';render()});
 await page.locator('[data-game-setting=animationsEnabled]').uncheck();await page.locator('[data-game-setting=hapticsEnabled]').uncheck();
 await page.evaluate(()=>{tab='today';render()});await clickTask(page,page.locator('[data-action=toggle]').first());
 assert.equal(await page.locator('.game-milestone,.xp-float').count(),0);
 assert.equal(await page.evaluate(()=>vibrations),0);
 assert.equal(await page.locator('.check.done').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.reload();assert.equal(await page.evaluate(()=>state.settings.animationsEnabled),false);
 await page.evaluate(()=>{state.settings.animationsEnabled=true;save();render()});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{await toggle(state.tasks[0]);await toggle(state.tasks[0])});
 assert.equal(await page.locator('.game-milestone,.xp-float').count(),0);
 assert.equal(await page.evaluate(()=>gameAnimations.size),0);
});

test('write failure awards neither completion nor bonus and produces no XP animation',async t=>{
 const page=await open(t);await oneHabit(page);
 await page.evaluate(async()=>{
  const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('QuotaExceededError')};await toggle(state.tasks[0]);Storage.prototype.setItem=original;
 });
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.tasks[0].days.length]),[0,0,0]);
 assert.equal(await page.locator('.xp-float').count(),0);
 await page.evaluate(()=>toggle(state.tasks[0]));await page.reload();
 await page.evaluate(async()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('QuotaExceededError')};await claimMini('count');Storage.prototype.setItem=original});
 assert.deepEqual(await page.evaluate(()=>[xp(),wallet(),state.questClaims.length]),[20,20,0]);
 assert.equal(await page.locator('.xp-float').count(),0);
});

test('local midnight creates a fresh plan while preserving yesterday claims and activity streak',async t=>{
 const page=await open(t);await page.clock.install({time:new Date('2026-11-07T23:59:50+01:00')});
 await oneHabit(page);await page.evaluate(()=>{activeLocalDate=day();selectedDate=day();render()});
 const yesterday=await page.evaluate(()=>day());await page.evaluate(async()=>{await toggle(state.tasks[0]);await claimMini('count')});
 const earned=await page.evaluate(()=>xp());
 await page.clock.setSystemTime(new Date('2026-11-08T00:00:10+01:00'));await page.evaluate(()=>checkLocalDay());
 assert.deepEqual(await page.evaluate(old=>[day(),selectedDate,state.dailyMissions[old].missions[0].claimed,state.dailyMissions[day()].missions.some(m=>m.claimed),activityStreak(state)],yesterday),['2026-11-08','2026-11-08',true,false,1]);
 await page.evaluate(old=>claimMini('count',old),yesterday);assert.equal(await page.evaluate(()=>xp()),earned);
 await page.reload();assert.equal(await page.locator('.game-milestone,.xp-float').count(),0);
});

test('legacy daily bonus claims and malformed optional mission data cannot create another award',async t=>{
 const page=await open(t);
 await page.evaluate(()=>{
  state.questClaims.push('daily3:'+day());state.dailyMissions[day()]={date:day(),missions:[null,{},{}]};save();render();
 });
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions[0].claimed),true);
 await page.evaluate(()=>claimMini('count'));assert.equal(await page.evaluate(()=>xp()),0);
 assert.equal(await page.evaluate(()=>state.dailyMissions[day()].missions.length),3);
});
