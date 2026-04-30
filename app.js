
const ICONS=['🧘','💪','📖','🏃','🍳','💻','🎯','✍️','🧹','💤','🎵','💊','🥗','🚿','📝','🐕','🧠','☕'];
const QUOTES=["The secret of getting ahead is getting started.","Small daily improvements are the key to staggering long-term results.","You will never always be motivated, so you must learn to be disciplined.","Success is the sum of small efforts repeated day in and day out.","A routine is not a prison, but the pathway to freedom."];
const LS_KEY='routineOS';
let state={routines:[],history:{},streak:0,bestStreak:0,totalDone:0};
let timerState={mode:'pomodoro',running:false,seconds:1500,total:1500,interval:null,session:0,focus:25,short:5,long:15};
let calMonth,calYear;
let fileHandle=null;
let savePending=false;

function load(){try{const d=localStorage.getItem(LS_KEY);if(d)state=JSON.parse(d)}catch(e){}}

// AUTHENTICATION LOGIC
function initAuth() {
  const overlay = document.getElementById('auth-overlay');
  if(localStorage.getItem('routineOS_auth') === 'true') {
    overlay.classList.remove('active');
  }
  
  // Switch forms
  document.querySelectorAll('.auth-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
      document.getElementById(link.dataset.target).style.display = 'block';
    });
  });

  // Handle submissions
  document.getElementById('form-signin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const res = await fetch('https://daily-routine-lfw9.onrender.com/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        return toast(data.error || 'Login failed', 'error');
      }
      
      localStorage.setItem('routineOS_auth', 'true');
      localStorage.setItem('routineOS_email', email);
      overlay.classList.remove('active');
      toast('Successfully signed in!', 'success');
      save(); // Trigger sync
      subscribeToPush();
    } catch(err) {
      toast('Failed to connect to server', 'error');
    }
  });

  document.getElementById('form-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#form-signup input[type="email"]').value;
    const password = document.querySelector('#form-signup input[type="password"]').value;
    
    try {
      const res = await fetch('https://daily-routine-lfw9.onrender.com/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        return toast(data.error || 'Signup failed', 'error');
      }
      
      localStorage.setItem('routineOS_auth', 'true');
      localStorage.setItem('routineOS_email', email);
      overlay.classList.remove('active');
      toast('Account created successfully!', 'success');
      save(); // Trigger sync
      subscribeToPush();
    } catch(err) {
      toast('Failed to connect to server', 'error');
    }
  });

  document.getElementById('form-forgot').addEventListener('submit', (e) => {
    e.preventDefault();
    toast('Password reset link sent to your email!', 'info');
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    document.getElementById('form-signin').style.display = 'block';
  });

  // Logout Logic
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('routineOS_auth');
      localStorage.removeItem('routineOS_email');
      overlay.classList.add('active');
      toast('Logged out successfully', 'info');
    });
  }
}
initAuth();

function save(){
  localStorage.setItem(LS_KEY,JSON.stringify(state));
  if(fileHandle&&!savePending){savePending=true;requestAnimationFrame(()=>{savePending=false;saveToDisk()})}
  
  // Sync to Backend Push Server
  const email = localStorage.getItem('routineOS_email');
  if (email) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch('https://daily-routine-lfw9.onrender.com/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, timezone: tz, routines: state.routines })
    }).catch(e => console.log('Backend not running:', e.message));
  }
}
async function saveToDisk(){
  if(!fileHandle)return;
  try{
    const writable=await fileHandle.createWritable();
    await writable.write(JSON.stringify(state,null,2));
    await writable.close();
    updateDiskStatus(true)
  }catch(e){console.warn('Disk save failed:',e);updateDiskStatus(false)}
}
async function loadFromDisk(){
  if(!fileHandle)return false;
  try{
    const file=await fileHandle.getFile();
    const text=await file.text();
    if(text.trim()){state=JSON.parse(text);localStorage.setItem(LS_KEY,JSON.stringify(state));return true}
  }catch(e){console.warn('Disk load failed:',e)}
  return false
}
async function pickSaveFile(){
  try{
    fileHandle=await window.showSaveFilePicker({suggestedName:'routineOS-data.json',types:[{description:'JSON',accept:{'application/json':['.json']}}]});
    await saveToDisk();
    toast('Linked to file! Auto-saving to disk.','success');updateDiskStatus(true)
  }catch(e){if(e.name!=='AbortError')toast('Could not link file','error')}
}
async function openSaveFile(){
  try{
    const[handle]=await window.showOpenFilePicker({types:[{description:'JSON',accept:{'application/json':['.json']}}]});
    fileHandle=handle;
    const loaded=await loadFromDisk();
    if(loaded){calcStreaks();renderAll();toast('Loaded & linked to file!','success')}else{await saveToDisk();toast('Linked to file!','success')}
    updateDiskStatus(true)
  }catch(e){if(e.name!=='AbortError')toast('Could not open file','error')}
}
function updateDiskStatus(connected){
  const el=document.getElementById('disk-status');
  if(el)el.textContent=connected?'💾 Linked':'💾 Not linked';
  const el2=document.getElementById('disk-status');
  if(el2)el2.className='disk-status '+(connected?'connected':'');
}
function today(){return new Date().toISOString().slice(0,10)}
function todayDow(){return new Date().getDay()}
function getCompletion(date){return state.history[date]||[]}
function isCompletedToday(id){return getCompletion(today()).includes(id)}
function todayRoutines(){const dow=todayDow();return state.routines.filter(r=>r.days.includes(dow)).sort((a,b)=>a.time.localeCompare(b.time))}
function toast(msg,type='info'){const c=document.getElementById('toast-container'),t=document.createElement('div');t.className='toast '+type;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3000)}

function calcStreaks(){const dates=Object.keys(state.history).sort().reverse();let s=0;const d=new Date();
for(let i=0;i<365;i++){const ds=new Date(d);ds.setDate(ds.getDate()-i);const key=ds.toISOString().slice(0,10);const tr=state.routines.filter(r=>r.days.includes(ds.getDay()));
if(tr.length===0)continue;const done=state.history[key]||[];if(done.length>=tr.length)s++;else break}
state.streak=s;let best=0,cur=0;const all=Object.keys(state.history).sort();
all.forEach(k=>{const ds=new Date(k);const tr=state.routines.filter(r=>r.days.includes(ds.getDay()));
if(tr.length>0&&(state.history[k]||[]).length>=tr.length){cur++;if(cur>best)best=cur}else cur=0});
state.bestStreak=Math.max(best,state.bestStreak);state.totalDone=Object.values(state.history).reduce((a,b)=>a+b.length,0);save()}

// NAVIGATION
document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{btn.addEventListener('click',()=>{
document.querySelectorAll('.nav-btn[data-view]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
document.getElementById('view-'+btn.dataset.view).classList.add('active');
if(btn.dataset.view==='analytics')renderAnalytics();if(btn.dataset.view==='calendar')renderCalendar();
document.getElementById('sidebar').classList.remove('open');renderAll()})});

// CLOCK
function updateClock(){const n=new Date();const h=n.getHours(),m=n.getMinutes(),s=n.getSeconds();
document.getElementById('hero-clock').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
document.getElementById('hero-seconds').textContent=`:${String(s).padStart(2,'0')}`;
const gr=h<12?'Good Morning':h<17?'Good Afternoon':h<21?'Good Evening':'Good Night';
document.getElementById('greeting').textContent=gr+'! 👋';
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
document.getElementById('hero-date').textContent=`${days[n.getDay()]}, ${months[n.getMonth()]} ${n.getDate()}`}
setInterval(updateClock,1000);updateClock();
document.getElementById('hero-quote').textContent='"'+QUOTES[Math.floor(Math.random()*QUOTES.length)]+'"';

// THEME
document.getElementById('btn-theme-toggle').addEventListener('click',()=>{
const html=document.documentElement;const dark=html.dataset.theme==='dark';
html.dataset.theme=dark?'light':'dark';
document.querySelector('.icon-moon').style.display=dark?'none':'block';
document.querySelector('.icon-sun').style.display=dark?'block':'none'});

// MOBILE
document.getElementById('hamburger').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('mobile-add-btn').addEventListener('click',()=>openModal());

// ICON PICKER
const picker=document.getElementById('icon-picker');
ICONS.forEach(ic=>{const b=document.createElement('button');b.type='button';b.className='icon-opt';b.textContent=ic;
b.addEventListener('click',()=>{picker.querySelectorAll('.icon-opt').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});picker.appendChild(b)});

// DAY PICKER
document.querySelectorAll('.day-btn').forEach(b=>b.addEventListener('click',()=>b.classList.toggle('active')));

// MODAL
function openModal(routine){const ov=document.getElementById('modal-overlay');ov.classList.add('active');
document.getElementById('modal-title').textContent=routine?'Edit Routine':'Add Routine';
document.getElementById('btn-delete-routine').style.display=routine?'block':'none';
if(routine){document.getElementById('edit-id').value=routine.id;document.getElementById('r-name').value=routine.name;
document.getElementById('r-time').value=routine.time;document.getElementById('r-duration').value=routine.duration;
document.getElementById('r-category').value=routine.category;document.getElementById('r-priority').value=routine.priority;
document.getElementById('r-notes').value=routine.notes||'';document.getElementById('r-reminder').checked=routine.reminder;
document.getElementById('r-sound').checked=routine.sound;
picker.querySelectorAll('.icon-opt').forEach(b=>{b.classList.toggle('selected',b.textContent===routine.icon)});
document.querySelectorAll('.day-btn').forEach(b=>{b.classList.toggle('active',routine.days.includes(parseInt(b.dataset.day)))})}
else{document.getElementById('routine-form').reset();document.getElementById('edit-id').value='';
picker.querySelectorAll('.icon-opt').forEach(b=>b.classList.remove('selected'));picker.querySelector('.icon-opt').classList.add('selected');
document.querySelectorAll('.day-btn').forEach(b=>b.classList.add('active'))}}
document.getElementById('modal-close').addEventListener('click',()=>document.getElementById('modal-overlay').classList.remove('active'));
document.getElementById('modal-overlay').addEventListener('click',e=>{if(e.target.id==='modal-overlay')e.target.classList.remove('active')});
document.getElementById('btn-add-routine').addEventListener('click',()=>openModal());

// SAVE ROUTINE
document.getElementById('routine-form').addEventListener('submit',e=>{e.preventDefault();
const id=document.getElementById('edit-id').value||Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const selIcon=picker.querySelector('.icon-opt.selected');const days=[];
document.querySelectorAll('.day-btn.active').forEach(b=>days.push(parseInt(b.dataset.day)));
if(days.length===0){toast('Select at least one day','error');return}
const routine={id,name:document.getElementById('r-name').value,time:document.getElementById('r-time').value,
duration:parseInt(document.getElementById('r-duration').value)||30,category:document.getElementById('r-category').value,
priority:document.getElementById('r-priority').value,icon:selIcon?selIcon.textContent:'🎯',days,
notes:document.getElementById('r-notes').value,reminder:document.getElementById('r-reminder').checked,
sound:document.getElementById('r-sound').checked};
const idx=state.routines.findIndex(r=>r.id===id);
if(idx>=0)state.routines[idx]=routine;else state.routines.push(routine);
save();document.getElementById('modal-overlay').classList.remove('active');renderAll();toast('Routine saved!','success')});

// DELETE ROUTINE
document.getElementById('btn-delete-routine').addEventListener('click',()=>{
const id=document.getElementById('edit-id').value;state.routines=state.routines.filter(r=>r.id!==id);
Object.keys(state.history).forEach(k=>{state.history[k]=state.history[k].filter(x=>x!==id)});
save();document.getElementById('modal-overlay').classList.remove('active');renderAll();toast('Routine deleted','error')});

// TOGGLE COMPLETION
function toggleComplete(id){const d=today();if(!state.history[d])state.history[d]=[];
const arr=state.history[d];const idx=arr.indexOf(id);
if(idx>=0)arr.splice(idx,1);else{arr.push(id);if(state.routines.find(r=>r.id===id)?.sound)playSound()}
calcStreaks();renderAll()}

function playSound(){try{const ac=new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator();
const g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type='sine';o.frequency.value=800;
g.gain.setValueAtTime(0.3,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+0.3);
o.start(ac.currentTime);o.stop(ac.currentTime+0.3)}catch(e){}}

// FILTER
let currentFilter='all';
document.getElementById('filter-chips').addEventListener('click',e=>{if(!e.target.classList.contains('chip'))return;
document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));e.target.classList.add('active');
currentFilter=e.target.dataset.filter;renderRoutines()});

// RENDER ROUTINES
function renderRoutines(){const grid=document.getElementById('routines-grid');grid.innerHTML='';
let list=state.routines.filter(r=>currentFilter==='all'||r.category===currentFilter);
list.sort((a,b)=>a.time.localeCompare(b.time));
if(!list.length){grid.innerHTML='<p style="color:var(--text3);text-align:center;grid-column:1/-1;padding:60px 20px">No routines yet. Click "Add Routine" to get started!</p>';return}
list.forEach(r=>{const done=isCompletedToday(r.id);const card=document.createElement('div');
card.className='routine-card'+(done?' completed':'');card.draggable=true;
card.innerHTML=`<div class="rc-top"><div class="rc-icon">${r.icon}</div><div class="rc-info"><div class="rc-name">${r.name}</div><div class="rc-meta"><span>${r.time}</span><span>${r.duration}min</span></div></div><button class="rc-check${done?' checked':''}" data-id="${r.id}"></button></div><div class="rc-bottom"><div class="rc-tags"><span class="rc-tag ${r.category}">${r.category}</span><span class="rc-tag ${r.priority}">${r.priority}</span></div><button class="rc-edit" data-id="${r.id}">✏️</button></div>${r.notes?`<div class="rc-notes">${r.notes}</div>`:''}`;
card.querySelector('.rc-check').addEventListener('click',e=>{e.stopPropagation();toggleComplete(r.id)});
card.querySelector('.rc-edit').addEventListener('click',()=>openModal(r));
// Drag
card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',r.id);card.classList.add('dragging')});
card.addEventListener('dragend',()=>card.classList.remove('dragging'));
card.addEventListener('dragover',e=>e.preventDefault());
card.addEventListener('drop',e=>{e.preventDefault();const fromId=e.dataTransfer.getData('text/plain');
const fi=state.routines.findIndex(x=>x.id===fromId);const ti=state.routines.findIndex(x=>x.id===r.id);
if(fi>=0&&ti>=0){const item=state.routines.splice(fi,1)[0];state.routines.splice(ti,0,item);save();renderRoutines()}});
grid.appendChild(card)})}

// RENDER DASHBOARD
function renderDashboard(){const tr=todayRoutines();const done=getCompletion(today());
const doneCount=tr.filter(r=>done.includes(r.id)).length;const total=tr.length;
const pct=total?Math.round(doneCount/total*100):0;
document.getElementById('progress-pct').textContent=pct+'%';
document.getElementById('stat-done-text').textContent=`${doneCount} / ${total} done`;
const ring=document.getElementById('progress-ring');const circ=2*Math.PI*35;
ring.style.strokeDasharray=circ;ring.style.strokeDashoffset=circ-(circ*pct/100);
document.getElementById('stat-streak').textContent=state.streak+' days';
document.getElementById('stat-best-streak').textContent=state.bestStreak+' days';
document.getElementById('stat-total').textContent=state.totalDone+' routines';

// Upcoming
const ul=document.getElementById('upcoming-list');ul.innerHTML='';
const now=new Date();const nowMin=now.getHours()*60+now.getMinutes();
const upcoming=tr.filter(r=>{const[h,m]=r.time.split(':').map(Number);return h*60+m>=nowMin&&!done.includes(r.id)}).slice(0,5);
if(!upcoming.length)ul.innerHTML='<div class="upcoming-empty">All done for now! 🎉</div>';
upcoming.forEach(r=>{const d=document.createElement('div');d.className='upcoming-item';
d.innerHTML=`<span class="upcoming-time">${r.time}</span><span class="upcoming-icon">${r.icon}</span><span class="upcoming-name">${r.name}</span>`;
d.addEventListener('click',()=>toggleComplete(r.id));ul.appendChild(d)});

// Category bars
const cb=document.getElementById('category-bars');cb.innerHTML='';
const cats={morning:{label:'🌅 Morning',color:'#fbbf24'},afternoon:{label:'☀️ Afternoon',color:'#60a5fa'},evening:{label:'🌆 Evening',color:'#fb923c'},night:{label:'🌙 Night',color:'#a855f7'}};
Object.entries(cats).forEach(([k,v])=>{const catR=tr.filter(r=>r.category===k);const catD=catR.filter(r=>done.includes(r.id));
const p=catR.length?Math.round(catD.length/catR.length*100):0;
cb.innerHTML+=`<div class="cat-bar-item"><div class="cat-bar-label"><span>${v.label}</span><span>${catD.length}/${catR.length}</span></div><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${p}%;background:${v.color}"></div></div></div>`})}

function renderAll(){renderDashboard();renderRoutines();calcStreaks()}

// TIMER
const timerEl=document.getElementById('timer-time');const timerLabel=document.getElementById('timer-label');
const timerRing=document.getElementById('timer-ring-fill');const timerStart=document.getElementById('timer-start');
document.querySelectorAll('.timer-tab').forEach(t=>t.addEventListener('click',()=>{
document.querySelectorAll('.timer-tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
timerState.mode=t.dataset.mode;resetTimer();
document.getElementById('pomodoro-settings').style.display=timerState.mode==='pomodoro'?'flex':'none'}));

function resetTimer(){clearInterval(timerState.interval);timerState.running=false;timerStart.textContent='Start';
if(timerState.mode==='pomodoro'){timerState.seconds=timerState.focus*60;timerState.total=timerState.seconds;timerLabel.textContent='Focus Session'}
else{timerState.seconds=0;timerState.total=1;timerLabel.textContent='Stopwatch'}
updateTimerDisplay()}

function updateTimerDisplay(){const m=Math.floor(Math.abs(timerState.seconds)/60);const s=Math.abs(timerState.seconds)%60;
timerEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
const circ=2*Math.PI*120;
if(timerState.mode==='pomodoro'){const pct=timerState.total?timerState.seconds/timerState.total:0;timerRing.style.strokeDashoffset=circ*(1-pct)}
else{timerRing.style.strokeDashoffset=circ*(1-(timerState.seconds%60)/60)}}

timerStart.addEventListener('click',()=>{if(timerState.running){clearInterval(timerState.interval);timerState.running=false;timerStart.textContent='Start'}
else{timerState.running=true;timerStart.textContent='Pause';
timerState.interval=setInterval(()=>{if(timerState.mode==='pomodoro'){timerState.seconds--;if(timerState.seconds<=0){clearInterval(timerState.interval);timerState.running=false;timerStart.textContent='Start';playSound();toast('Timer complete!','success');
timerState.session++;if(timerState.session%4===0){timerState.seconds=timerState.long*60;timerLabel.textContent='Long Break'}
else{timerState.seconds=timerState.short*60;timerLabel.textContent='Short Break'}timerState.total=timerState.seconds;renderPomoDots()}}
else{timerState.seconds++}updateTimerDisplay()},1000)}});

document.getElementById('timer-reset').addEventListener('click',resetTimer);
document.getElementById('timer-skip').addEventListener('click',()=>{if(timerState.mode==='pomodoro'){timerState.session++;resetTimer();renderPomoDots()}});

document.querySelectorAll('.adj-btn').forEach(b=>b.addEventListener('click',()=>{
const key=b.dataset.adj;const dir=parseInt(b.dataset.dir);
if(key==='focus')timerState.focus=Math.max(1,Math.min(60,timerState.focus+dir*5));
if(key==='short')timerState.short=Math.max(1,Math.min(30,timerState.short+dir));
if(key==='long')timerState.long=Math.max(1,Math.min(60,timerState.long+dir*5));
document.getElementById('pomo-focus-val').textContent=timerState.focus;
document.getElementById('pomo-short-val').textContent=timerState.short;
document.getElementById('pomo-long-val').textContent=timerState.long;resetTimer()}));

function renderPomoDots(){const c=document.getElementById('pomo-dots');c.innerHTML='';
for(let i=0;i<4;i++){const d=document.createElement('div');d.className='pomo-dot'+(i<timerState.session%4?' filled':'');c.appendChild(d)}}
renderPomoDots();

// ANALYTICS
function renderAnalytics(){renderWeeklyChart();renderCategoryChart();renderHeatmap()}

function renderWeeklyChart(){const canvas=document.getElementById('weekly-chart');const ctx=canvas.getContext('2d');
canvas.width=canvas.offsetWidth*2;canvas.height=440;ctx.scale(2,2);
const w=canvas.offsetWidth,h=220;ctx.clearRect(0,0,w,h);
const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];const d=new Date();const data=[];
for(let i=6;i>=0;i--){const dt=new Date(d);dt.setDate(dt.getDate()-i);const key=dt.toISOString().slice(0,10);
const tr=state.routines.filter(r=>r.days.includes(dt.getDay())).length;
const done=(state.history[key]||[]).length;data.push({day:days[dt.getDay()],done,total:tr})}
const maxV=Math.max(...data.map(d=>d.total),1);const barW=(w-80)/7;const pad=20;
ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text3');ctx.font='11px Inter';
data.forEach((item,i)=>{const x=40+i*barW;const bh=(item.total/maxV)*(h-60);const dh=(item.done/maxV)*(h-60);
ctx.fillStyle='rgba(124,92,252,0.15)';ctx.beginPath();ctx.roundRect(x+8,h-30-bh,barW-16,bh,4);ctx.fill();
ctx.fillStyle='rgba(124,92,252,0.8)';ctx.beginPath();ctx.roundRect(x+8,h-30-dh,barW-16,dh,4);ctx.fill();
ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text3');ctx.textAlign='center';ctx.fillText(item.day,x+barW/2,h-10)})}

function renderCategoryChart(){const canvas=document.getElementById('category-chart');const ctx=canvas.getContext('2d');
canvas.width=canvas.offsetWidth*2;canvas.height=440;ctx.scale(2,2);
const w=canvas.offsetWidth,h=220;ctx.clearRect(0,0,w,h);
const cats=[{name:'Morning',color:'#fbbf24',key:'morning'},{name:'Afternoon',color:'#60a5fa',key:'afternoon'},{name:'Evening',color:'#fb923c',key:'evening'},{name:'Night',color:'#a855f7',key:'night'}];
const total=state.routines.length||1;let startAngle=-Math.PI/2;const cx=w/2,cy=h/2,r=70;
if(!state.routines.length){ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text3');ctx.textAlign='center';ctx.font='13px Inter';ctx.fillText('No data yet',cx,cy);return}
cats.forEach(cat=>{const count=state.routines.filter(r=>r.category===cat.key).length;if(!count)return;
const angle=(count/total)*2*Math.PI;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,startAngle,startAngle+angle);
ctx.fillStyle=cat.color;ctx.globalAlpha=0.8;ctx.fill();ctx.globalAlpha=1;startAngle+=angle});
let ly=20;cats.forEach(cat=>{const count=state.routines.filter(r=>r.category===cat.key).length;
ctx.fillStyle=cat.color;ctx.beginPath();ctx.arc(20,ly,5,0,Math.PI*2);ctx.fill();
ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text2');ctx.font='12px Inter';ctx.textAlign='left';ctx.fillText(`${cat.name} (${count})`,32,ly+4);ly+=22})}

function renderHeatmap(){const c=document.getElementById('heatmap-30');c.innerHTML='';const d=new Date();
for(let i=29;i>=0;i--){const dt=new Date(d);dt.setDate(dt.getDate()-i);const key=dt.toISOString().slice(0,10);
const tr=state.routines.filter(r=>r.days.includes(dt.getDay())).length;
const done=(state.history[key]||[]).length;const pct=tr?done/tr:0;
const level=pct===0?0:pct<0.25?1:pct<0.5?2:pct<0.75?3:4;
const cell=document.createElement('div');cell.className='heatmap-cell';cell.dataset.level=level;
cell.title=`${key}: ${done}/${tr}`;c.appendChild(cell)}}

// CALENDAR
function renderCalendar(){const now=new Date();if(calMonth===undefined){calMonth=now.getMonth();calYear=now.getFullYear()}
document.getElementById('cal-month-label').textContent=new Date(calYear,calMonth).toLocaleString('default',{month:'long',year:'numeric'});
const grid=document.getElementById('calendar-grid');grid.innerHTML='';
['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>{const h=document.createElement('div');h.className='cal-header-cell';h.textContent=d;grid.appendChild(h)});
const first=new Date(calYear,calMonth,1);const startDay=first.getDay();const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
const prevDays=new Date(calYear,calMonth,0).getDate();
for(let i=startDay-1;i>=0;i--){const c=document.createElement('div');c.className='cal-cell other-month';c.textContent=prevDays-i;grid.appendChild(c)}
for(let d=1;d<=daysInMonth;d++){const cell=document.createElement('div');cell.className='cal-cell';
const key=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const isToday=key===today();if(isToday)cell.classList.add('today');
const tr=state.routines.filter(r=>r.days.includes(new Date(calYear,calMonth,d).getDay())).length;
const done=(state.history[key]||[]).length;
if(tr>0){const dot=document.createElement('div');dot.className='cal-dot';cell.appendChild(dot);
if(done>=tr)cell.classList.add('has-full')}
cell.innerHTML=`<span>${d}</span>`+(tr>0?'<div class="cal-dot'+(done>=tr?' has-full':'')+'"></div>':'');
cell.addEventListener('click',()=>showDayDetail(key,d));grid.appendChild(cell)}
const rem=(startDay+daysInMonth)%7;if(rem)for(let i=1;i<=7-rem;i++){const c=document.createElement('div');c.className='cal-cell other-month';c.textContent=i;grid.appendChild(c)}}

function showDayDetail(key,d){const panel=document.getElementById('cal-day-detail');panel.style.display='block';
document.getElementById('cal-detail-title').textContent=key;
const list=document.getElementById('cal-detail-list');list.innerHTML='';
const dt=new Date(key);const tr=state.routines.filter(r=>r.days.includes(dt.getDay()));
const done=state.history[key]||[];
if(!tr.length){list.innerHTML='<li>No routines scheduled</li>';return}
tr.forEach(r=>{const li=document.createElement('li');li.innerHTML=`<span>${r.icon} ${r.name}</span><span>${done.includes(r.id)?'✅':'❌'}</span>`;list.appendChild(li)})}

document.getElementById('cal-prev').addEventListener('click',()=>{calMonth--;if(calMonth<0){calMonth=11;calYear--}renderCalendar()});
document.getElementById('cal-next').addEventListener('click',()=>{calMonth++;if(calMonth>11){calMonth=0;calYear++}renderCalendar()});

// EXPORT/IMPORT
document.getElementById('btn-export-calendar')?.addEventListener('click', () => {
  if(!state.routines.length){ toast('No routines to export', 'error'); return; }
  const daysMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RoutineOS//EN\n";
  const now = new Date();
  const formatDt = (d) => d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'T'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+String(d.getSeconds()).padStart(2,'0');
  state.routines.forEach(r => {
    if(!r.days||!r.days.length) return;
    const [hh, mm] = r.time.split(':').map(Number);
    let startDt = new Date(now); startDt.setHours(hh, mm, 0, 0);
    let endDt = new Date(startDt); endDt.setMinutes(endDt.getMinutes() + (r.duration||30));
    const byDay = r.days.map(d => daysMap[d]).join(',');
    ics += "BEGIN:VEVENT\nUID:"+r.id+"@routineos\nDTSTAMP:"+formatDt(now)+"\nDTSTART:"+formatDt(startDt)+"\nDTEND:"+formatDt(endDt)+"\nRRULE:FREQ=WEEKLY;BYDAY="+byDay+"\nSUMMARY:"+r.icon+" "+r.name+"\n";
    if(r.notes) ics += "DESCRIPTION:"+r.notes.replace(/\n/g, '\\n')+"\n";
    if(r.reminder) ics += "BEGIN:VALARM\nACTION:DISPLAY\nDESCRIPTION:Reminder\nTRIGGER:-PT0M\nEND:VALARM\n";
    ics += "END:VEVENT\n";
  });
  ics += "END:VCALENDAR";
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'routines.ics'; a.click();
  toast('Calendar exported! Open on phone to get notifications.', 'success');
});
document.getElementById('btn-export').addEventListener('click',()=>{
const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='routineOS-backup.json';a.click();toast('Data exported!','success')});
document.getElementById('btn-import').addEventListener('click',()=>document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;
const reader=new FileReader();reader.onload=ev=>{try{state=JSON.parse(ev.target.result);save();renderAll();toast('Data imported!','success')}catch(er){toast('Invalid file','error')}};reader.readAsText(f)});

// DISK AUTO-SAVE
if(window.showSaveFilePicker){
  const diskDiv=document.createElement('div');diskDiv.style.cssText='padding:8px 10px;display:flex;flex-direction:column;gap:4px';
  diskDiv.innerHTML=`<span id="disk-status" class="disk-status" style="font-size:.7rem;color:var(--text3);text-align:center">💾 Not linked</span><button class="nav-btn" id="btn-disk-new"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>New Save File</span></button><button class="nav-btn" id="btn-disk-open"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>Open Save File</span></button>`;
  document.querySelector('.sidebar-footer').prepend(diskDiv);
  document.getElementById('btn-disk-new').addEventListener('click',pickSaveFile);
  document.getElementById('btn-disk-open').addEventListener('click',openSaveFile);
}

// NOTIFICATIONS & ALARM
// Web Push Public Key (Matches Server)
const publicVapidKey = 'BAhHvsSqeYPU3FBqSCn0lfMNn_yeBpWBTzbb3HYLE8Pd-zld_PT7ypy5dWf72KbBgo6t6hsNcDf2LhLlEI37PrA';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

async function subscribeToPush() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }
      const email = localStorage.getItem('routineOS_email');
      if (email) {
        await fetch('https://daily-routine-lfw9.onrender.com/subscribe', {
          method: 'POST',
          body: JSON.stringify({ subscription: sub, email }),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch(e) {
      console.log('Push subscription failed:', e);
    }
  }
}

// NOTIFICATIONS & ALARM
const btnEnableNotif = document.getElementById('btn-enable-notif');
if ('Notification' in window) {
  if (Notification.permission === 'granted') {
    if(btnEnableNotif) btnEnableNotif.style.display = 'none';
    subscribeToPush(); // Attempt to subscribe on load if granted
  } else {
    btnEnableNotif?.addEventListener('click', async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        btnEnableNotif.style.display = 'none';
        toast('Notifications enabled!', 'success');
        subscribeToPush();
      }
    });
  }
} else {
  if(btnEnableNotif) btnEnableNotif.style.display = 'none';
}

let currentAlarmInterval = null;
let currentAlarmRoutineId = null;
const alarmOverlay = document.getElementById('alarm-overlay');

function triggerAlarm(r) {
  if(!alarmOverlay) return;
  document.getElementById('alarm-title').textContent = r.name;
  document.getElementById('alarm-icon').textContent = r.icon;
  document.getElementById('alarm-desc').textContent = "It's time to start!";
  alarmOverlay.classList.add('active');
  currentAlarmRoutineId = r.id;
  
  if (currentAlarmInterval) clearInterval(currentAlarmInterval);
  playSound();
  currentAlarmInterval = setInterval(playSound, 2000);
}

document.getElementById('btn-stop-alarm')?.addEventListener('click', () => {
  alarmOverlay.classList.remove('active');
  if (currentAlarmInterval) clearInterval(currentAlarmInterval);
  if (currentAlarmRoutineId && !isCompletedToday(currentAlarmRoutineId)) {
    toggleComplete(currentAlarmRoutineId);
  }
  currentAlarmRoutineId = null;
});

document.getElementById('btn-snooze-alarm')?.addEventListener('click', () => {
  alarmOverlay.classList.remove('active');
  if (currentAlarmInterval) clearInterval(currentAlarmInterval);
  toast('Snoozed! (Will alert again if page reloads)', 'info');
  currentAlarmRoutineId = null;
});

let lastCheckedMinute = -1;
function checkReminders(){
  const now=new Date();
  const min = now.getMinutes();
  if (min === lastCheckedMinute) return; // Only trigger once per minute
  lastCheckedMinute = min;
  
  const h=String(now.getHours()).padStart(2,'0');
  const m=String(now.getMinutes()).padStart(2,'0');
  const timeStr=h+':'+m;
  
  const dueRoutines = todayRoutines().filter(r=>r.reminder&&r.time===timeStr&&!isCompletedToday(r.id));
  if (dueRoutines.length > 0) {
    // Show full screen alarm for the first due routine
    triggerAlarm(dueRoutines[0]);
    // Native notification
    dueRoutines.forEach(r=>{
      if(Notification.permission==='granted') new Notification('RoutineOS',{body:`Time for: ${r.icon} ${r.name}`,icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>'});
    });
  }
}
setInterval(checkReminders, 10000); // Check every 10 seconds to not miss the minute mark

// PWA INSTALL PROMPT
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btnInstall = document.getElementById('btn-install-pwa');
  if (btnInstall) btnInstall.style.display = 'flex';
});

document.getElementById('btn-install-pwa')?.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      toast('Installing app...', 'success');
    }
    deferredPrompt = null;
    document.getElementById('btn-install-pwa').style.display = 'none';
  }
});

// INIT
load();calcStreaks();renderAll();resetTimer();
