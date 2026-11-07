/* Additional LevelUp features. Loaded before app.js; functions use its shared state. */
function normalizeFocus(raw){
 const duration=raw?.duration===50?50:25;
 const running=raw?.running===true&&Number.isFinite(raw.end)&&raw.end>0&&typeof raw.sessionId==='string'&&raw.sessionId.length>0;
 return {duration,remaining:running?Math.max(0,Math.ceil((raw.end-Date.now())/1000)):Math.min(duration*60,Math.max(0,Math.round(Number(raw?.remaining??duration*60)||0))),running,end:running?raw.end:0,taskId:typeof raw?.taskId==='string'?raw.taskId:'',sessionId:typeof raw?.sessionId==='string'?raw.sessionId:null};
}
function emojiPicker(value){
 return `<div class="emoji-picker"><button type="button" class="emoji-picker-toggle" aria-label="Emoji kiválasztása" aria-expanded="false"><span class="selected-emoji">${esc(value)}</span><span>Ikon módosítása <span aria-hidden="true">⌄</span></span></button><div class="emoji-grid" role="group" aria-label="Elérhető emojik" hidden>${EMOJIS.map(e=>`<button type="button" class="emoji-option ${e===value?'chosen':''}" data-emoji="${e}" aria-label="${e}" aria-pressed="${e===value}">${e}</button>`).join('')}</div><input type="hidden" name="emoji" value="${esc(value)}"></div>`;
}
function remapSubtasks(oldLabels,newLabels,checks){
 const used=new Set(),indexMap=new Map();
 oldLabels.forEach((label,oldIndex)=>{const next=newLabels.findIndex((text,i)=>text===label&&!used.has(i));if(next>=0){used.add(next);indexMap.set(oldIndex,next)}});
 return checks.filter(i=>indexMap.has(i)).map(i=>indexMap.get(i));
}
function subtaskButton(t){
 if(!t.subtasks.length)return '';
 const checks=state.subtaskChecks[t.id+':'+selectedDate]||[],done=t.subtasks.filter((_,i)=>checks.includes(i)).length;
 return `<button class="subtasks-trigger" data-action="subtasks" data-id="${esc(t.id)}" aria-label="${esc(t.name)} részfeladatai">${done}/${t.subtasks.length} részfeladat <span aria-hidden="true">›</span></button>`;
}
function subtasksModal(t){
 const key=t.id+':'+selectedDate,checks=state.subtaskChecks[key]||[],disabled=t.archived||selectedDate>day();
 modal(`<h2>${esc(t.name)}</h2><p class="muted">A részfeladatok nem adnak külön XP-t. A főfeladatot a listában pipálhatod ki.</p><p class="muted" id="subtaskProgress">${t.subtasks.filter((_,i)=>checks.includes(i)).length}/${t.subtasks.length} lépés kész</p><div class="subtask-list">${t.subtasks.map((text,i)=>`<label class="subtask-check"><input type="checkbox" data-sub="${i}" data-task="${esc(t.id)}" data-date="${selectedDate}" ${checks.includes(i)?'checked':''} ${disabled?'disabled':''}><span>${esc(text)}</span></label>`).join('')}</div><button class="btn alt" data-action="close">Bezárás</button>`);
}
function weeklySummary(){
 const start=weekStart(day()),end=day(),previousStart=shift(start,-7),previousEnd=shift(end,-7);
 const entries=state.history.filter(h=>h.type==='task'),count=(a,b)=>entries.filter(h=>h.date>=a&&h.date<=b).length;
 const total=count(start,end),previous=count(previousStart,previousEnd),delta=total-previous;
 const dates=[];for(let d=start;d<=end;d=shift(d,1))dates.push(d);
 const habits=state.tasks.filter(t=>t.kind==='habit'&&!t.archived).map(t=>{
  const available=dates.filter(d=>d>=t.created&&!isPaused(t,d)&&(t.frequency!=='weekdays'||t.weekdays.includes(weekday(d)))).length;
  const target=t.frequency==='weekly'?Math.min(t.weeklyTarget,available):available;
  const completed=new Set(t.days.filter(d=>d>=start&&d<=end)).size;
  return {task:t,target,completed};
 });
 const strongest=habits.filter(h=>h.target>0&&h.completed>=h.target).sort((a,b)=>b.completed-a.completed)[0];
 const needsAttention=habits.filter(h=>h.target>h.completed).sort((a,b)=>(a.completed/a.target)-(b.completed/b.target))[0];
 const insight=strongest?`Jól ment: ${strongest.task.name} – az eddigi heti célod teljesült.`:total?'Már tettél lépéseket ezen a héten. Építs a kis győzelmekre!':'Még nincs teljesítés ezen a héten. Egy kis lépés is jó kezdet.';
 return `<section class="card weekly-review" aria-label="Heti visszatekintés"><span class="section-kicker">HÉTFŐTŐL MÁIG · ${start} – ${end}</span><div class="review-numbers"><div><strong>${total}</strong><span>teljesítés</span></div><div><strong>${dates.reduce((n,d)=>n+pointsOn(d),0)}</strong><span>megszerzett XP</span></div></div><p class="review-comparison">${previous?`${delta>0?'+':''}${delta} teljesítés az előző hét azonos napjaihoz képest.`:total?'Az előző hét azonos napjain még nem volt teljesítés.':'Az előző hét azonos napjain sem volt teljesítés.'}</p><p class="review-insight">${esc(insight)}</p>${needsAttention?`<p class="muted">Következő kis lépés: ${esc(needsAttention.task.name)} (${needsAttention.completed}/${needsAttention.target} alkalom).</p>`:''}<details><summary>Szokásonkénti áttekintés · ${habits.length}</summary><p class="muted">A célok a hét eddig eltelt, nem szünetelő napjaira vonatkoznak; a heti szokásoknál legfeljebb a heti célra.</p>${habits.map(h=>`<div class="review-habit"><span>${esc(h.task.emoji)} ${esc(h.task.name)}</span><strong>${h.completed}/${h.target}</strong></div>`).join('')||'<p class="muted">Még nincs aktív szokásod.</p>'}</details></section>`;
}
async function resetXP(){
 if(!confirm('Nullázod az összes megszerzett XP-t és az elkölthető egyenleget? A szinted 1-re áll. A feladatok, teljesítések, sorozatok és előzmények megmaradnak.'))return;
 await withFocusLock(()=>{
  const snapshot=loadSavedState();if(!snapshot)return;
  const timer=normalizeFocus(snapshot.focusTimer);
  if(timer.running&&timer.end<=Date.now()&&!completeFocus(snapshot,false))return;
  const next=JSON.parse(JSON.stringify(snapshot));
  next.history.forEach(h=>{if(['task','quest','focus','challenge'].includes(h.type))h.xpReset=true});
  const balance=next.ledger.reduce((sum,entry)=>sum+Number(entry.amount||0),0);
  next.ledger.push({id:id(),amount:-balance,type:'xp-reset',date:day()});next.gameFeedback.maxLevel=1;
  if(replaceWithCheckpoint(next,'XP-nullázás előtt')){render();toast('XP és egyenleg nullázva. A teljesítéseid megmaradtak.')}
 });
}
function loadSavedState(){
 try{return migrate(JSON.parse(localStorage.getItem(KEY)))}catch{toast('A mentés nem olvasható. Az időzítő állapotát nem írtuk felül.');return null}
}
function withFocusLock(callback){
 return navigator.locks?.request?navigator.locks.request(KEY+'-focus',callback):Promise.resolve().then(callback);
}
function completeFocus(snapshot,notify=true){
 const timer=normalizeFocus(snapshot.focusTimer);
 if(!timer.running||timer.end>Date.now())return false;
 prepareGamification(snapshot);const before=gameMetrics(snapshot);
 const points=timer.duration===25?15:35,date=dateKey(new Date(timer.end));
 const credited=snapshot.focusSessions.some(s=>s.id===timer.sessionId);
 if(!credited){
  snapshot.focusSessions.push({id:timer.sessionId,date,minutes:timer.duration,taskId:timer.taskId});
  snapshot.ledger.push({id:id(),amount:points,type:'focus',date});
  snapshot.history.push({id:id(),type:'focus',name:`${timer.duration} perc fókusz`,points,date});
 }
 snapshot.focusTimer={...timer,running:false,remaining:timer.duration*60,end:0,sessionId:null};
 return commitGameState(snapshot,before,{points:credited?0:points,notify});
}
let focusSettlementPending=false;
async function focusTick(){
 if(recoveryRequired||!focus.running)return;
 focus.remaining=Math.max(0,Math.ceil((focus.end-Date.now())/1000));
 const text=$('#timerText');if(text)text.textContent=fmtTime(focus.remaining);
 if(focus.remaining>0||focusSettlementPending)return;
 focusSettlementPending=true;
 try{await withFocusLock(()=>{const snapshot=loadSavedState();if(!snapshot)return;const timer=normalizeFocus(snapshot.focusTimer);if(timer.running&&timer.end<=Date.now())completeFocus(snapshot);else{state=snapshot;focus=timer;render()}})}finally{focusSettlementPending=false}
}
async function controlFocus(action,minutes){
 const chosenTask=$('#focusTask')?.value||'';
 await withFocusLock(()=>{
  const snapshot=loadSavedState();if(!snapshot)return;
  const timer=normalizeFocus(snapshot.focusTimer);
  // A click at the deadline settles the old block without starting another one.
  if(timer.running&&timer.end<=Date.now()){completeFocus(snapshot);return}
  if(action==='duration'){
   if(timer.running){toast('Előbb szüneteltesd az időzítőt.');return}
   if(![25,50].includes(minutes))return;
   Object.assign(timer,{duration:minutes,remaining:minutes*60,sessionId:null,end:0});
  }else if(action==='reset'){
   Object.assign(timer,{running:false,remaining:timer.duration*60,end:0,sessionId:null});
  }else if(timer.running){
   Object.assign(timer,{running:false,remaining:Math.max(0,Math.ceil((timer.end-Date.now())/1000)),end:0});
  }else{
   if(timer.remaining<=0)timer.remaining=timer.duration*60;
   Object.assign(timer,{running:true,end:Date.now()+timer.remaining*1000,taskId:chosenTask,sessionId:timer.sessionId||id()});
  }
  snapshot.focusTimer=timer;if(replaceState(snapshot))render();
 });
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)focusTick()});
window.addEventListener('storage',event=>{
 if(event.key!==KEY||!event.newValue||recoveryRequired)return;
 try{state=migrate(JSON.parse(event.newValue));focus=normalizeFocus(state.focusTimer);render();focusTick()}catch{toast('A másik ablak mentése nem olvasható. Töltsd újra az oldalt.')}
});
document.addEventListener('click',event=>{
 const button=event.target.closest('.emoji-picker-toggle');if(!button)return;
 const grid=button.closest('.emoji-picker').querySelector('.emoji-grid');grid.hidden=!grid.hidden;button.setAttribute('aria-expanded',String(!grid.hidden));
 if(!grid.hidden)grid.querySelector('.chosen,button')?.focus();
});
document.addEventListener('change',event=>{
 const input=event.target;if(!input.matches('[data-sub]'))return;
 const task=state.tasks.find(t=>t.id===input.dataset.task),date=input.dataset.date,index=Number(input.dataset.sub);
 if(!task||task.archived||date>day()||!Number.isInteger(index)||index<0||index>=task.subtasks.length)return;
 const key=task.id+':'+date,old=state.subtaskChecks[key],checks=new Set(old||[]);
 input.checked?checks.add(index):checks.delete(index);state.subtaskChecks[key]=[...checks];
 if(!save()){if(old===undefined)delete state.subtaskChecks[key];else state.subtaskChecks[key]=old;input.checked=!input.checked;return}
 render();const counter=$('#subtaskProgress');if(counter)counter.textContent=`${checks.size}/${task.subtasks.length} lépés kész`;
});
