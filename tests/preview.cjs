const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const slug=process.env.LEVELUP_PREVIEW_SLUG||'pr-4';
if(!/^pr-\d+$/.test(slug))throw Error('Invalid preview slug');

test('Pages preview has isolated data, no worker or push access, and leaves production unchanged',async t=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',timezoneId:'Europe/Budapest'});
 await context.route('https://levelup.test/levelup/**',async route=>{
  const name=new URL(route.request().url()).pathname.replace('/levelup/','')||'index.html';
  const resource=name.endsWith('/')?name+'index.html':name;
  if(!new RegExp('^(preview/'+slug+'/)?(index.html|app.js|features.js|workflow.js|gamification.js|pastel.css|icon.svg|manifest.webmanifest)$').test(resource))return route.abort();
  const file=path.join(__dirname,'..',resource);
  const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';
  await route.fulfill({body:await fs.readFile(file),contentType:type});
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('https://levelup.test/levelup/');
 const production=await page.evaluate(()=>{
  state.ledger.push({id:id(),amount:80,type:'task',date:day()});
  state.history.push({id:id(),type:'task',name:'Éles teljesítés',taskId:'prod-task',points:80,date:day()});
  save();localStorage.setItem(KEY+'-restore',JSON.stringify({raw:localStorage.getItem(KEY),savedAt:12345,reason:'Éles visszaállítási pont'}));return [localStorage.getItem(KEY),localStorage.getItem(KEY+'-restore')];
 });
 await page.addInitScript(()=>{
  navigator.serviceWorker.register=()=>{throw Error('Preview must not register service workers')};
  if('Notification'in window)Notification.requestPermission=()=>{throw Error('Preview must not request notification permission')};
 });
 await page.goto('https://levelup.test/levelup/preview/'+slug+'/');
 assert.equal(await page.evaluate(()=>KEY),'levelup-preview-'+slug+'-v1');
 assert.equal(await page.locator('link[rel=manifest]').count(),0);
 assert.equal(await page.getByRole('complementary',{name:'Tesztverzió'}).isVisible(),true);
 await page.locator('#quickTaskName').fill('Csak teszt');await page.locator('#quickTaskName').press('Enter');
 await page.locator('[data-action=toggle]').first().click();await page.waitForFunction(()=>typeof pendingTaskAwards==='undefined'||pendingTaskAwards.size===0);
 await page.locator('[data-action=more]').click();await page.locator('#modalRoot [data-tab=settings]').click();
 for(const action of ['pushDisable','pushEnable','pushTest','notifyPermission','saveReminder'])await page.locator(`[data-action=${action}]`).click();
 page.once('dialog',dialog=>dialog.accept());await page.locator('[data-action=resetXP]').click();
 await page.waitForFunction(()=>xp()===0);
 assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('levelup-v1'),localStorage.getItem('levelup-v1-restore')]),production);
 await page.reload();
 assert.equal(await page.evaluate(()=>state.tasks.some(t=>t.name==='Csak teszt')),true);
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('levelup-v1'),localStorage.getItem('levelup-v1-restore')]),production);
 assert.deepEqual(errors,[]);
});
