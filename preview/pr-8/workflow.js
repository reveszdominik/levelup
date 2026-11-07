/* Planning and recovery UI. All storage keys derive from the current app/preview KEY. */
let missionSearch='',missionSearchOpen=false,deleteUndo=null,undoTimeout=null;
function missionControls(){
 return `${missionSearchOpen?`<div class="mission-search"><label class="sr-only" for="missionSearch">Keresés a küldetések között</label><input id="missionSearch" type="search" placeholder="Keresés név szerint…" value="${esc(missionSearch)}" autocomplete="off"><button type="button" class="text-action" data-workflow-action="clearSearch" aria-label="Keresés törlése">×</button></div>`:''}<div class="mission-filters" role="group" aria-label="Küldetések szűrése">${[['all','Összes'],['pending','Hátralévő'],['done','Kész']].map(([value,label])=>`<button data-workflow-action="filter" data-value="${value}" aria-pressed="${state.ui.missionFilter===value}">${label}</button>`).join('')}</div>`;
}
function missionResults(items){
 const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('hu-HU');
 const query=normalize(missionSearch.trim()),filter=state.ui.missionFilter;
 const found=items.filter(t=>(!query||normalize(t.name).includes(query))&&(filter==='all'||isDone(t,selectedDate)===(filter==='done')));
 return found.length?compactTasks(found):`<p class="mission-empty">${items.length?'Nincs a keresésnek és szűrőnek megfelelő küldetés.':'Erre a napra még nincs küldetésed.'}</p>${items.length?'<button class="text-action" data-workflow-action="clearFilters">Szűrők törlése</button>':''}`;
}
function updateMissionResults(){
 const target=$('#missionResults');if(target)target.innerHTML=missionResults(state.tasks.filter(t=>!t.archived&&scheduled(t,selectedDate)));
}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&dateKey(fromKey(value))===value}
function rescheduleModal(task){
 if(task.kind!=='todo'||task.days.length)return toast('Csak a még nem teljesített teendők ütemezhetők át.');
 const tomorrow=shift(day(),1),weekend=shift(day(),(5-weekday(day())+7)%7);
 modal(`<h2>${esc(task.name)}</h2><p class="muted">A részfeladatok jelöléseit is átvisszük az új napra.</p><div class="actions"><button class="btn alt" data-workflow-action="moveTodo" data-id="${esc(task.id)}" data-date="${tomorrow}">Holnapra</button><button class="btn alt" data-workflow-action="moveTodo" data-id="${esc(task.id)}" data-date="${weekend}">Hétvégére</button></div><form id="rescheduleForm" data-task="${esc(task.id)}"><div class="field"><label for="moveDate">Választott nap</label><input id="moveDate" type="date" name="date" value="${esc(task.dueDate||task.created)}" required></div><div class="actions"><button class="btn" type="submit">Áthelyezés</button><button class="btn alt" type="button" data-action="close">Mégse</button></div></form>`);
}
function rescheduleTodos(ids,date){
 if(!validDate(date))return toast('Válassz érvényes dátumot.');
 const next=JSON.parse(JSON.stringify(state));let changed=0;
 next.tasks.filter(t=>ids.includes(t.id)&&t.kind==='todo'&&!t.days.length&&!t.archived).forEach(t=>{
  const oldDate=t.dueDate||t.created;if(oldDate===date)return;
  const oldKey=t.id+':'+oldDate,newKey=t.id+':'+date;
  if(next.subtaskChecks[oldKey]){next.subtaskChecks[newKey]=[...new Set([...(next.subtaskChecks[newKey]||[]),...next.subtaskChecks[oldKey]])];delete next.subtaskChecks[oldKey]}
  t.dueDate=date;if(t.created>date)t.created=date;changed++;
 });
 if(!changed)return toast('Nincs áthelyezhető teendő.');
 if(replaceState(next)){close();render();toast('Teendő áthelyezve: '+date)}
}
function pausePlanModal(task){
 const active=state.tasks.filter(t=>t.kind==='habit'&&!t.archived);
 modal(`<h2>Tervezett pihenőnapok</h2><p class="muted">A kijelölt időszakban a szokások szünetelnek, a sorozatod megmarad. A már teljesített napokat kihagyjuk.</p><form id="pausePlanForm"><div class="field"><label for="pauseScope">Melyik szokás?</label><select id="pauseScope" name="taskId"><option value="all">Minden aktív szokás</option>${active.map(t=>`<option value="${esc(t.id)}" ${task?.id===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="date-range"><div class="field"><label for="pauseFrom">Ettől</label><input id="pauseFrom" type="date" name="from" min="${day()}" value="${selectedDate>=day()?selectedDate:day()}" required></div><div class="field"><label for="pauseTo">Eddig (beleértve)</label><input id="pauseTo" type="date" name="to" min="${day()}" value="${selectedDate>=day()?selectedDate:day()}" required></div></div><div class="actions"><button class="btn" type="submit" name="mode" value="add">Szünet beállítása</button><button class="btn alt" type="submit" name="mode" value="remove">Szünet törlése</button><button class="btn alt" type="button" data-action="close">Mégse</button></div></form>`);
}
function applyPausePlan(form,mode){
 const data=new FormData(form),from=String(data.get('from')),to=String(data.get('to')),taskId=data.get('taskId');
 if(!validDate(from)||!validDate(to)||from<day()||to<from)return toast('Ma vagy később kezdődő, helyes dátumtartományt válassz.');
 const dates=[];for(let d=from;d<=to&&dates.length<=366;d=shift(d,1))dates.push(d);
 if(dates.length>366)return toast('Egyszerre legfeljebb 366 pihenőnapot állíts be.');
 const next=JSON.parse(JSON.stringify(state)),tasks=next.tasks.filter(t=>t.kind==='habit'&&!t.archived&&(taskId==='all'||t.id===taskId));
 if(!tasks.length)return toast('Nincs kiválasztott aktív szokás.');
 tasks.forEach(t=>{const paused=new Set(t.paused);dates.forEach(d=>{if(mode==='remove')paused.delete(d);else if(!t.days.includes(d))paused.add(d)});t.paused=[...paused].sort()});
 if(replaceState(next)){close();render();toast(mode==='remove'?'Pihenőnapok törölve.':'Pihenőnapok beállítva.')}
}
function readCheckpoint(){
 try{const point=JSON.parse(localStorage.getItem(KEY+'-restore'));if(point&&typeof point.raw==='string'&&Number.isFinite(point.savedAt))return point}catch{}
 return null;
}
function checkpointHTML(){
 const point=readCheckpoint();
 return `<div class="checkpoint-settings"><h3>Helyi visszaállítási pont</h3><p class="muted">Importálás, XP-nullázás és teljes törlés előtt megőrizzük az előző állapotot. Ez nem helyettesíti a letölthető JSON-mentést; a böngészőadatok törlésével ez is elveszik.</p>${point?`<p class="muted">${esc(point.reason)} · ${new Date(point.savedAt).toLocaleString('hu-HU')}</p><button class="btn alt" data-workflow-action="restoreCheckpoint">Előző állapot visszaállítása</button>`:'<p class="muted">Még nincs visszaállítási pont.</p>'}</div>`;
}
function clearDeleteUndo(){deleteUndo=null;clearTimeout(undoTimeout);$('#undoRoot')?.replaceChildren()}
function replaceWithCheckpoint(incoming,reason){
 const backupKey=KEY+'-restore';let previousBackup,changedBackup=false;
 try{
  const raw=localStorage.getItem(KEY);previousBackup=localStorage.getItem(backupKey);
  // An unreadable primary save must not replace an existing valid checkpoint.
  let valid=false;try{migrate(JSON.parse(raw));valid=true}catch{}
  if(valid){localStorage.setItem(backupKey,JSON.stringify({raw,savedAt:Date.now(),reason}));changedBackup=true}
  if(!replaceState(incoming)){
   if(changedBackup){if(previousBackup===null)localStorage.removeItem(backupKey);else localStorage.setItem(backupKey,previousBackup)}
   return false;
  }
  clearDeleteUndo();return true;
 }catch{toast('Mentés sikertelen – a korábbi adatok változatlanok.');return false}
}
async function restoreCheckpoint(){
 const point=readCheckpoint();if(!point)return toast('Nincs visszaállítási pont.');
 if(!confirm('Visszaállítod az előző teljes állapotot? Az azóta végzett módosításokat ez lecseréli.'))return;
 await withFocusLock(()=>{
  try{const incoming=migrate(JSON.parse(point.raw));if(replaceWithCheckpoint(incoming,'Visszaállítás előtt')){render();focusTick();toast('Az előző állapot visszaállítva.')}}catch{toast('A visszaállítási pont nem olvasható.')}
 });
}
function deleteEntity(kind,entity){
 const isTask=kind==='task',collection=isTask?'tasks':'rewards';
 if(!confirm(isTask?'Törlöd a feladatot? A korábbi XP-k megmaradnak.':'Törlöd a jutalmat?'))return;
 const next=JSON.parse(JSON.stringify(state)),index=next[collection].findIndex(x=>x.id===entity.id),wish=next.wishId===entity.id;
 if(index<0)return;
 next[collection].splice(index,1);if(!isTask&&wish)next.wishId=null;
 if(!replaceState(next))return;
 close();render();clearDeleteUndo();
 const token=id();deleteUndo={token,collection,entity:JSON.parse(JSON.stringify(entity)),index,wish,expires:Date.now()+12000};
 $('#undoRoot').innerHTML='<div class="undo-toast" role="status"><span>Törölve.</span><button data-workflow-action="undoDelete">Visszavonás</button></div>';
 undoTimeout=setTimeout(()=>{if(deleteUndo?.token===token)clearDeleteUndo()},12000);
}
function undoDelete(){
 if(!deleteUndo||Date.now()>deleteUndo.expires){clearDeleteUndo();return}
 const packet=deleteUndo,next=loadSavedState();if(!next)return;
 if(next[packet.collection].some(x=>x.id===packet.entity.id)){clearDeleteUndo();return toast('Az elem már megvan.')}
 next[packet.collection].splice(Math.min(packet.index,next[packet.collection].length),0,packet.entity);
 if(packet.collection==='rewards'&&packet.wish&&!next.wishId)next.wishId=packet.entity.id;
 if(replaceState(next)){clearDeleteUndo();render();toast('Törlés visszavonva.')}
}
document.addEventListener('input',event=>{if(event.target.id==='missionSearch'){missionSearch=event.target.value;updateMissionResults()}});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-workflow-action]');if(!button)return;
 const action=button.dataset.workflowAction,task=state.tasks.find(t=>t.id===button.dataset.id);
 if(action==='filter'){
  const value=button.dataset.value;if(!['all','pending','done'].includes(value))return;
  const next=JSON.parse(JSON.stringify(state));next.ui.missionFilter=value;if(replaceState(next))render();
 }else if(action==='search'){
  missionSearchOpen=!missionSearchOpen;if(!missionSearchOpen)missionSearch='';render();$('#missionSearch')?.focus();
 }else if(action==='clearSearch'){
  missionSearch='';const input=$('#missionSearch');if(input){input.value='';input.focus()}updateMissionResults();
 }else if(action==='clearFilters'){
  missionSearch='';const next=JSON.parse(JSON.stringify(state));next.ui.missionFilter='all';if(replaceState(next))render();
 }else if(action==='reschedule'&&task)rescheduleModal(task);
 else if(action==='moveTodo')rescheduleTodos([button.dataset.id],button.dataset.date);
 else if(action==='pausePlan')pausePlanModal(task);
 else if(action==='restoreCheckpoint')restoreCheckpoint();
 else if(action==='undoDelete')undoDelete();
});
document.addEventListener('submit',event=>{
 if(event.target.id==='rescheduleForm'){event.preventDefault();rescheduleTodos([event.target.dataset.task],event.target.elements.date.value)}
 if(event.target.id==='pausePlanForm'){event.preventDefault();applyPausePlan(event.target,event.submitter?.value||'add')}
});
