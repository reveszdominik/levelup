/* LevelUp 8.0: additive save fields, local missions and non-blocking feedback. */
function gameXP(s,date=null,baseOnly=false){
 return s.history.filter(h=>!h.xpReset&&(!date||h.date===date)&&(baseOnly?['task','focus','challenge']:['task','quest','focus','challenge']).includes(h.type)).reduce((n,h)=>n+Number(h.points||0),0);
}
function gameLevel(s){return Math.floor(gameXP(s)/200)+1}
function normalizeGame(s){
 s.settings.animationsEnabled=s.settings.animationsEnabled!==false;
 s.settings.hapticsEnabled=s.settings.hapticsEnabled!==false;
 s.dailyMissions=s.dailyMissions&&typeof s.dailyMissions==='object'&&!Array.isArray(s.dailyMissions)?s.dailyMissions:{};
 const feedback=s.gameFeedback&&typeof s.gameFeedback==='object'?s.gameFeedback:{};
 s.gameFeedback={maxLevel:Math.max(gameLevel(s),Number.isFinite(Number(feedback.maxLevel))?Number(feedback.maxLevel):1),goalDays:feedback.goalDays&&typeof feedback.goalDays==='object'&&!Array.isArray(feedback.goalDays)?feedback.goalDays:{}};
 s.ui.miniQuestsOpen=s.ui.miniQuestsOpen===true;
 s.ui.blocks=[...new Set(s.ui.blocks.filter(key=>key!=='level'))];
 if(!s.ui.blocks.includes('progress'))s.ui.blocks.unshift('progress');
 if(!s.ui.gameLayoutV8&&s.ui.blocks.join(',')==='progress,tasks,quests,wish')s.ui.blocks=['progress','quests','tasks','wish'];
 s.ui.gameLayoutV8=true;
 if(!s.ui.challengeLayoutV1){
  s.ui.blocks=['progress','quests','calendar','tasks',...s.ui.blocks.filter(key=>!['progress','quests','calendar','tasks'].includes(key))];
  s.ui.challengeLayoutV1=true;
 }
 s.ui.blocks=s.ui.blocks.filter(key=>!['quests','calendar'].includes(key));
 return s;
}
function taskDoneIds(s,date){
 return new Set([...s.history.filter(h=>h.type==='task'&&h.date===date).map(h=>h.taskId),...s.tasks.filter(t=>t.days.includes(date)).map(t=>t.id)].filter(Boolean));
}
function dailyAvailable(s,date){
 const done=taskDoneIds(s,date);
 return s.tasks.filter(t=>{
  if(done.has(t.id))return true;
  if(t.archived||t.created>date||t.paused.includes(date))return false;
  if(t.kind==='todo')return !t.days.length&&(t.dueDate||t.created)===date;
  if(t.frequency==='weekdays')return t.weekdays.includes(weekday(date));
  if(t.frequency==='weekly')return t.days.filter(d=>d>=weekStart(date)&&d<=shift(weekStart(date),6)).length<t.weeklyTarget;
  return true;
 });
}
function missionDefinitions(s,date){
 const available=dailyAvailable(s,date),done=taskDoneIds(s,date),capacity=new Set([...available.map(t=>t.id),...done]).size;
 const habits=available.filter(t=>t.kind==='habit');
 const categories=[...new Set(habits.map(t=>t.category))].sort((a,b)=>a.localeCompare(b,'hu'));
 const category=categories.includes('Egészség')?'Egészség':categories[Number(date.replaceAll('-',''))%Math.max(1,categories.length)];
 const possible=Math.max(gameXP(s,date,true),available.reduce((n,t)=>n+Math.max(0,Number(t.points)||0),0));
 return [
  capacity?{slot:'count',kind:'count',target:Math.min(3,capacity),points:20}:{slot:'count',kind:'create',target:1,points:20},
  {slot:'xp',kind:'xp',target:possible>0?Math.min(100,possible):15,points:15},
  habits.length?{slot:'habit',kind:'habit',target:1,category,taskIds:habits.filter(t=>t.category===category).map(t=>t.id),points:10}:{slot:'habit',kind:'createHabit',target:1,points:10},
 ];
}
function missionProgress(s,mission,date){
 const done=taskDoneIds(s,date);
 if(mission.kind==='count')return done.size;
 if(mission.kind==='xp')return gameXP(s,date,true);
 if(mission.kind==='habit')return (mission.taskIds||[]).filter(id=>done.has(id)).length;
 if(mission.kind==='createHabit')return s.tasks.filter(t=>t.kind==='habit'&&!t.archived&&t.created===date).length;
 if(mission.kind==='create')return s.tasks.filter(t=>t.kind==='todo'&&t.created===date&&(t.dueDate||t.created)===date).length;
 return new Set(s.focusSessions.filter(f=>f.date===date).map(f=>f.id)).size;
}
function missionKey(date,slot){return slot==='count'?'daily3:'+date:'mini8:'+date+':'+slot}
function prepareGamification(s,date=day()){
 normalizeGame(s);
 const definitions=missionDefinitions(s,date),old=s.dailyMissions[date];
 const valid=old&&old.date===date&&Array.isArray(old.missions)&&old.missions.length===3&&old.missions.every((m,i)=>m&&typeof m==='object'&&(m.kind!=='habit'||(typeof m.category==='string'&&Array.isArray(m.taskIds)&&m.taskIds.every(id=>typeof id==='string')))&&m.slot===definitions[i].slot&&['count','xp','habit','create','createHabit','focus'].includes(m.kind)&&Number.isFinite(m.target)&&m.target>0&&m.target<=(m.kind==='count'?3:m.kind==='xp'?100:1));
 const plan=valid?old:{date,missions:definitions};
 plan.missions=plan.missions.map((previous,i)=>{
  const key=missionKey(date,previous.slot),claimed=s.questClaims.includes(key)||s.history.some(h=>h.missionKey===key);
  const progress=missionProgress(s,previous,date);let mission={...previous,points:definitions[i].points};
  if(!claimed&&progress<previous.target){
   if(previous.kind==='count'||previous.kind==='xp')mission={...definitions[i],target:Math.min(previous.target,definitions[i].target)};
   else if(previous.kind==='focus')mission=definitions[i];
   else if(previous.kind==='habit'){
    const matching=dailyAvailable(s,date).filter(t=>t.kind==='habit'&&t.category===previous.category).map(t=>t.id);
    mission=matching.length?{...mission,taskIds:matching}:definitions[i];
   }
  }
  return {...mission,key,claimed,completed:claimed||missionProgress(s,mission,date)>=mission.target};
 });
 s.dailyMissions[date]=plan;return plan;
}
function missionTitle(m){
 if(m.kind==='count')return `Teljesíts ${m.target} feladatot`;
 if(m.kind==='xp')return `Szerezz ${m.target} XP-t`;
 if(m.kind==='habit')return `Teljesíts egy ${m.category.toLocaleLowerCase('hu-HU')} szokást`;
 if(m.kind==='createHabit')return 'Adj hozzá egy szokást';
 if(m.kind==='create')return 'Adj hozzá egy mai teendőt';
 return 'Teljesíts egy fókuszblokkot';
}
function activityStreak(s,date=day()){
 const days=new Set([...s.history.filter(h=>['task','focus'].includes(h.type)).map(h=>h.date),...s.tasks.flatMap(t=>t.days)]);
 let current=days.has(date)?date:shift(date,-1),count=0;
 while(days.has(current)&&count<=days.size){count++;current=shift(current,-1)}return count;
}
function streakBadgeHTML(date=day()){
 const series=activityStreak(state,date);
 return `<span class="development-streak" aria-label="${series} napos aktivitási sorozat"><span aria-hidden="true">⚡</span> ${series} nap</span>`;
}
function dailyDevelopmentHTML(visible,{compact=false,date=selectedDate}={}){
 const n=Math.max(0,gameXP(state,date)),goal=state.settings.dailyXPGoal,currentLevel=gameLevel(state);
 const done=visible.filter(t=>isDone(t,date)).length;

 return `<section class="card daily-progress daily-development ${compact?'daily-summary':'level-development'}" data-date="${date}" aria-label="${compact?'Napi fejlődés':'Szint és napi fejlődés'}">${compact?'':`<div class="development-top"><div class="development-level"><button type="button" class="development-star" data-action="xpDetail" aria-label="XP részletezése"><span aria-hidden="true">✦</span></button><strong>${currentLevel}. szint</strong></div>${streakBadgeHTML(date)}</div>`}<div class="development-score"><div><strong>${n}</strong><span> / ${goal} XP</span></div><span class="goal-status">${n>=goal?'✓ Napi cél':'Napi fejlődés'}</span></div><div class="progress" role="progressbar" aria-label="Napi XP-cél" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(n,goal)}" aria-valuetext="${n} a ${goal} XP-ből"><div class="bar" style="width:${Math.min(100,n/goal*100)}%"></div></div><div class="development-footer"><span class="momentum-tasks">${done} / ${visible.length} feladat kész</span><span>${wallet()} elkölthető pont</span></div></section>`;
}
function miniMissionsHTML(){
 const plan=state.dailyMissions[day()],complete=plan.missions.filter(m=>m.completed).length;
 const weeklyQuest=quests().find(q=>q.key.startsWith('weekly10:'));
 const weekly=weeklyQuest&&(weeklyQuest.progress>0||state.questClaims.includes(weeklyQuest.key))?weeklyQuest:null;
 const challenges=weekChallenges();
 const weeklyHTML=challenges||weekly?`<section class="challenge-group challenge-group-weekly" aria-labelledby="weeklyChallengesTitle"><h3 id="weeklyChallengesTitle">Heti kihívások</h3>${challenges}${weekly?`<div class="item weekly-bonus"><div class="grow"><div class="name">Aktív hét</div><div class="muted">${Math.min(weekly.progress,weekly.target)} / ${weekly.target} teljesítés · +${weekly.points} XP</div><div class="progress" role="progressbar" aria-label="Aktív hét" aria-valuemin="0" aria-valuemax="${weekly.target}" aria-valuenow="${Math.min(weekly.progress,weekly.target)}"><div class="bar" style="width:${Math.min(100,100*weekly.progress/weekly.target)}%"></div></div></div><button class="btn small" data-action="claim" data-id="${weekly.key}" ${weekly.progress<weekly.target||state.questClaims.includes(weekly.key)?'disabled':''}>${state.questClaims.includes(weekly.key)?'Átvéve':weekly.progress>=weekly.target?'Átveszem':'Folyamatban'}</button></div>`:''}</section>`:'';
 return `<section class="card daily-mini-quests" aria-labelledby="challengesTitle"><header class="challenges-heading"><h2 id="challengesTitle">Kihívások</h2><span class="mini-count">${complete}/3 ma</span></header>${weeklyHTML}<section class="challenge-group challenge-group-daily" aria-labelledby="dailyMissionsTitle"><h3 id="dailyMissionsTitle">Mai küldetések</h3><div class="mini-quest-list">${plan.missions.map(m=>{
  const progress=m.claimed?m.target:Math.min(m.target,missionProgress(state,m,day()));
  return `<div class="mini-quest" data-mini-slot="${m.slot}"><div class="mini-quest-body"><div class="mini-quest-heading"><strong>${esc(missionTitle(m))}</strong><span>+${m.points} XP</span></div><div class="mini-quest-progress"><div class="progress" role="progressbar" aria-label="${esc(missionTitle(m))}" aria-valuemin="0" aria-valuemax="${m.target}" aria-valuenow="${progress}"><div class="bar" style="width:${Math.min(100,progress/m.target*100)}%"></div></div><span>${progress}/${m.target}${m.kind==='xp'?' XP':''}</span></div>${m.kind==='xp'?'<small class="mini-quest-note">Bónusz XP nélkül</small>':''}</div><button class="btn small" data-game-action="claimMini" data-slot="${m.slot}" data-date="${day()}" ${!m.completed||m.claimed?'disabled':''}>${m.claimed?'✓ Átvéve':m.completed?'Átveszem':'Folyamatban'}</button></div>`;
 }).join('')}</div></section></section>`;
}

function levelPageHTML(){
 const today=day(),visible=state.tasks.filter(t=>!t.archived&&scheduled(t,today));
 return `<div class="level-page">${dailyDevelopmentHTML(visible,{date:today})}${miniMissionsHTML()}</div>`;
}

function gameMetrics(s){return {level:gameLevel(s),xp:gameXP(s),daily:gameXP(s,day()),goal:s.settings.dailyXPGoal,maxLevel:s.gameFeedback.maxLevel,goalShown:!!s.gameFeedback.goalDays[day()]}}
function animationsAllowed(){return state.settings.animationsEnabled&&!matchMedia('(prefers-reduced-motion: reduce)').matches}
const gameAnimations=new Set();
function syncMotionPreference(){
 const enabled=animationsAllowed();document.body.dataset.motion=enabled?'on':'off';
 if(!enabled){document.getElementById('xpEffects')?.replaceChildren();for(const animation of gameAnimations)animation.cancel();gameAnimations.clear()}
}
function trackAnimation(element,frames,options){
 if(!element?.animate)return;
 const animation=element.animate(frames,options);gameAnimations.add(animation);animation.finished.catch(()=>{}).finally(()=>gameAnimations.delete(animation));
}
function showGameFeedback(before,meta,flags){
 const now=gameMetrics(state),announcements=[];
 if(meta.points>0)announcements.push(`+${meta.points} XP`);
 if(flags.levelUp)announcements.push(`${now.level}. szint. Még ${200-now.xp%200} XP a következő szintig.`);
 if(flags.goalReached)announcements.push('A napi XP-célod teljesült!');
 const announcer=$('#gameAnnounce');if(announcer)announcer.textContent=announcements.join(' ');
 if(meta.haptic&&state.settings.hapticsEnabled&&navigator.vibrate){try{navigator.vibrate(10)}catch{}}
 if(!animationsAllowed())return;
 const card=document.querySelector('.daily-development[data-date="'+day()+'"]');
 if(card)trackAnimation(card.querySelector('.bar'),[{width:Math.min(100,before.daily/before.goal*100)+'%'},{width:Math.min(100,now.daily/now.goal*100)+'%'}],{duration:450,easing:'cubic-bezier(.2,.8,.2,1)'});
 const host=$('#xpEffects');if(!host)return;
 if(meta.points>0){
  while(host.querySelectorAll('.xp-float').length>=3)host.querySelector('.xp-float').remove();
  const pop=document.createElement('span');pop.className='xp-float';pop.textContent=`+${meta.points} XP`;
  const rect=meta.rect,x=rect?Math.min(innerWidth-50,Math.max(50,rect.left+rect.width/2)):innerWidth/2,y=rect&&rect.top>=0&&rect.top<innerHeight?rect.top:110;
  pop.style.left=x+'px';pop.style.top=y+'px';host.append(pop);setTimeout(()=>pop.remove(),950);
 }
 if(flags.goalReached)trackAnimation(card,[{boxShadow:'0 0 0 0 #96b78600'},{boxShadow:'0 0 0 8px #96b78644'},{boxShadow:'0 0 0 0 #96b78600'}],{duration:900});
 if(flags.levelUp||flags.goalReached){
  host.querySelector('.game-milestone')?.remove();const banner=document.createElement('div');banner.className='game-milestone '+(flags.levelUp?'level-up':'goal-up');
  const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=flags.levelUp?`✦ ${now.level}. szint!`:'✦ Napi cél teljesítve!';
  detail.textContent=flags.levelUp?`Még ${200-now.xp%200} XP a következő szintig`:'Szép munka, ma is tettél magadért.';
  banner.append(title,detail);host.append(banner);setTimeout(()=>banner.remove(),1900);
 }
}
function commitGameState(next,before,meta){
 prepareGamification(next);const now=gameMetrics(next);
 const flags={levelUp:now.level>Math.max(before.level,before.maxLevel),goalReached:before.daily<before.goal&&now.daily>=now.goal&&!before.goalShown};
 next.gameFeedback.maxLevel=Math.max(before.maxLevel,now.level);
 if(flags.goalReached)next.gameFeedback.goalDays[day()]=true;
 if(!replaceState(next))return false;
 render();if(meta.notify!==false)showGameFeedback(before,meta,flags);return true;
}
const pendingTaskAwards=new Set(),pendingMiniClaims=new Set();
async function toggle(t){
 const date=selectedDate,expected=isDone(t,date),taskId=t.id;
 if(pendingTaskAwards.has(taskId))return;
 const button=[...document.querySelectorAll('[data-action=toggle]')].find(b=>b.dataset.id===taskId),rect=button?.getBoundingClientRect();
 pendingTaskAwards.add(taskId);if(button)button.disabled=true;
 try{await withFocusLock(()=>{
  const next=loadSavedState();if(!next)return;prepareGamification(next);
  const task=next.tasks.find(t=>t.id===taskId);if(!task||task.archived||date>day())return;
  const actual=task.kind==='todo'?task.days.length>0&&(task.dueDate||task.created)===date:task.days.includes(date);
  if(actual!==expected){state=next;focus=normalizeFocus(next.focusTimer);render();return}
  const before=gameMetrics(next);let points=Number(task.points)||0;
  if(actual){
   const index=next.history.findIndex(h=>h.type==='task'&&h.taskId===taskId&&(task.kind==='todo'||h.date===date));
   if(index<0)return toast('Nem vonható vissza');const previous=next.history[index];next.history.splice(index,1);
   task.days=task.kind==='todo'?[]:task.days.filter(d=>d!==date);
   if(!previous.xpReset)next.ledger.push({id:id(),amount:-previous.points,type:'reversal',date});points=0;
  }else{
   const done=taskDoneIds(next,date);
   if(task.paused.includes(date))return toast('Ez a szokás ma szünetel.');
   if(!dailyAvailable(next,date).some(t=>t.id===taskId)||done.has(taskId))return;
   if(!Number.isInteger(points)||points<1||points>1000)return toast('Ellenőrizd a feladat XP-értékét a szerkesztőben.');
   task.days.push(date);next.ledger.push({id:id(),amount:points,type:'task',date});
   next.history.push({id:id(),type:'task',taskId,name:task.name,points,date});
  }
  if(commitGameState(next,before,{points,rect,haptic:!actual})&&actual)toast('Teljesítés visszavonva');
 })}finally{pendingTaskAwards.delete(taskId);if(button?.isConnected)button.disabled=date>day()}
}
async function claimMini(slot,date=day()){
 if(date!==day()||pendingMiniClaims.has(slot))return;
 pendingMiniClaims.add(slot);
 try{await withFocusLock(()=>{
  if(date!==day())return;const next=loadSavedState();if(!next)return;
  const plan=prepareGamification(next,date),mission=plan.missions.find(m=>m.slot===slot);
  if(!mission||mission.claimed||missionProgress(next,mission,date)<mission.target)return;
  const before=gameMetrics(next);next.questClaims.push(mission.key);
  next.ledger.push({id:id(),amount:mission.points,type:'quest',date,missionKey:mission.key});
  next.history.push({id:id(),type:'quest',name:missionTitle(mission),points:mission.points,date,missionKey:mission.key});
  commitGameState(next,before,{points:mission.points,haptic:true});
 })}finally{pendingMiniClaims.delete(slot)}
}
async function claim(key){
 if(key==='daily3:'+day())return claimMini('count');
 await withFocusLock(()=>{
  const next=loadSavedState();if(!next)return;prepareGamification(next);
  if(key!=='weekly10:'+weekStart(day())||next.questClaims.includes(key))return;
  if(next.history.filter(h=>h.type==='task'&&h.date>=weekStart(day())&&h.date<=day()).length<10)return;
  const before=gameMetrics(next);next.questClaims.push(key);next.ledger.push({id:id(),amount:75,type:'quest',date:day()});
  next.history.push({id:id(),type:'quest',name:'Aktív hét',points:75,date:day()});commitGameState(next,before,{points:75,haptic:true});
 });
}
async function claimChallenge(taskId){
 await withFocusLock(()=>{
  const next=loadSavedState();if(!next)return;prepareGamification(next);
  const challenge=next.weeklyChallenges.find(c=>c.id===taskId),week=weekStart(day()),task=next.tasks.find(t=>t.id===challenge?.taskId);
  if(!challenge||!task||task.archived||(challenge.claimed||[]).includes(week)||new Set(task.days.filter(d=>d>=week&&d<=shift(week,6))).size<challenge.target)return;
  const before=gameMetrics(next);challenge.claimed=[...(challenge.claimed||[]),week];
  next.ledger.push({id:id(),amount:challenge.bonus,type:'challenge',date:day()});next.history.push({id:id(),type:'challenge',name:'Heti kihívás: '+task.name,points:challenge.bonus,date:day()});
  commitGameState(next,before,{points:challenge.bonus,haptic:true});
 });
}
let activeLocalDate=null,dayRolloverPending=false;
async function checkLocalDay(){
 const today=day();if(activeLocalDate===null){activeLocalDate=today;return}if(activeLocalDate===today||dayRolloverPending||recoveryRequired)return;
 dayRolloverPending=true;
 try{await withFocusLock(()=>{const next=loadSavedState();if(!next)return;prepareGamification(next,today);if(!replaceState(next))return;if(selectedDate===activeLocalDate)selectedDate=today;activeLocalDate=today;render()})}finally{dayRolloverPending=false}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkLocalDay()});
document.addEventListener('click',event=>{const button=event.target.closest('[data-game-action=claimMini]');if(button)claimMini(button.dataset.slot,button.dataset.date)});
document.addEventListener('change',event=>{
 if(!event.target.matches('[data-game-setting]'))return;
 const key=event.target.dataset.gameSetting;if(!['animationsEnabled','hapticsEnabled'].includes(key))return;
 const next=JSON.parse(JSON.stringify(state));next.settings[key]=event.target.checked;if(replaceState(next)){syncMotionPreference();render()}
});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>syncMotionPreference());
