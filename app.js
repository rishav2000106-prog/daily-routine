/* ===== ROUTINE OS 2026 — FULLY FIXED ===== */

const LS_KEY = 'routineOS_master';
let state = {
  user: { name: 'Rishav', goal: 'minimal', onboarding: false },
  routines: [], history: {}, streak: 0, bestStreak: 0, totalDone: 0, moods: {}, badges: []
};

const TEMPLATES = {
  student: [
    { id: 's1', name: 'Morning Review', time: '07:30', icon: '📚', category: 'morning',   days: [1,2,3,4,5] },
    { id: 's2', name: 'Lecture Block',  time: '10:00', icon: '🎓', category: 'afternoon', days: [1,2,3,4,5] },
    { id: 's3', name: 'Deep Work',      time: '14:00', icon: '💻', category: 'afternoon', days: [1,2,3,4,5] }
  ],
  ceo: [
    { id: 'c1', name: 'Strategic Planning', time: '08:30', icon: '🧠', category: 'morning',   days: [1,2,3,4,5] },
    { id: 'c2', name: 'High-Value Sync',    time: '11:00', icon: '🤝', category: 'morning',   days: [1,2,3,4,5] },
    { id: 'c3', name: 'Audit & Review',     time: '16:30', icon: '⚖️', category: 'afternoon', days: [1,2,3,4,5] }
  ],
  fitness: [
    { id: 'f1', name: 'Morning Run',    time: '06:30', icon: '🏃', category: 'morning', days: [1,2,3,4,5,6,0] },
    { id: 'f2', name: 'Strength Train', time: '09:00', icon: '💪', category: 'morning', days: [1,3,5] },
    { id: 'f3', name: 'Nutrition Prep', time: '18:00', icon: '🥗', category: 'evening', days: [1,2,3,4,5,6,0] }
  ]
};

function safeSet(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el[prop] = val;
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.style.cssText = 'padding:14px 18px;border-radius:16px;background:rgba(15,23,42,0.97);border:1px solid rgba(255,255,255,0.15);box-shadow:0 20px 40px rgba(0,0,0,0.5);animation:fadeIn 0.3s ease;';
  t.innerHTML = `<span style="font-weight:800;font-size:13px;color:${type==='success'?'#34d399':'#f87171'}">${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.5s'; setTimeout(()=>t.remove(),500); }, 3000);
}

/* FIX 1: Clock — was hardcoded "02:00", now live */
function startClock() {
  function tick() {
    const n = new Date();
    safeSet('hero-clock','textContent', n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}));
    safeSet('header-date','textContent', n.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'}));
  }
  tick();
  setInterval(tick, 1000);
}

/* FIX 2: Streak logic was correct, just never triggered properly */
function calcStreaks() {
  const now = new Date();
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0,10);
    const scheduled = state.routines.filter(r => r.days.includes(d.getDay()));
    if (scheduled.length === 0) continue;
    const completed = state.history[k] || [];
    if (completed.length >= scheduled.length) s++;
    else if (i === 0) continue;
    else break;
  }
  state.streak = s;
  if (s > state.bestStreak) state.bestStreak = s;
  checkBadges();
}

/* FIX 3: checkBadges was empty */
function checkBadges() {
  const earned = [];
  if (state.streak >= 7)      earned.push('7-day');
  if (state.streak >= 30)     earned.push('30-day');
  if (state.totalDone >= 10)  earned.push('first-ten');
  if (state.totalDone >= 100) earned.push('centurion');
  state.badges = earned;
}

/* FIX 4: Navigation — views were broken due to CSS transition conflict with display:none */
function initNavigation() {
  document.querySelectorAll('.view').forEach(v => { v.style.display='none'; v.classList.remove('active'); });
  const dash = document.getElementById('view-dashboard');
  if (dash) { dash.style.display='block'; dash.classList.add('active'); }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (!view) return;
      document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.style.display='none'; });
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const target = document.getElementById('view-'+view);
      if (target) {
        target.style.display='block';
        requestAnimationFrame(()=>requestAnimationFrame(()=>target.classList.add('active')));
        btn.classList.add('active');
        if (view==='analytics') renderAnalytics();
        if (view==='routines')  renderRoutinesList();
        if (view==='calendar')  renderCalendar();
      }
      document.querySelector('.sidebar').classList.remove('open');
    });
  });
}

/* FIX 5: Mobile sidebar toggle — button existed but had no listener */
function initMobileToggle() {
  const btn = document.getElementById('mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && e.target!==btn) sidebar.classList.remove('open');
  });
}

function renderDashboard() {
  const todayKey = new Date().toISOString().slice(0,10);
  const done = state.history[todayKey] || [];
  const tr = state.routines.filter(r => r.days.includes(new Date().getDay()));
  const pct = tr.length ? Math.round((done.length/tr.length)*100) : 0;

  safeSet('progress-pct','textContent', pct+'%');
  const ring = document.getElementById('progress-ring');
  if (ring) ring.style.strokeDashoffset = 552-(552*pct/100);
  safeSet('stat-streak','textContent', state.streak);
  safeSet('stat-best',  'textContent', state.bestStreak);
  safeSet('stat-total', 'textContent', state.totalDone);
  renderTimeline(tr);
  renderQuickRoutines(tr, done);
}

function renderTimeline(routines) {
  const grid = document.getElementById('timeline-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!routines.length) { grid.innerHTML='<p style="color:#64748b;font-size:13px">No routines today. Add one!</p>'; return; }
  routines.sort((a,b)=>a.time.localeCompare(b.time)).forEach(r => {
    const item = document.createElement('div');
    item.className = 'timeline-item relative flex gap-4 items-start';
    item.innerHTML = `<div style="width:40px;height:40px;border-radius:50%;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;position:relative;z-index:1">${r.icon}</div><div><div style="font-weight:800">${r.name}</div><div style="font-size:11px;color:#818cf8;font-weight:700">${r.time}</div></div>`;
    grid.appendChild(item);
  });
}

function renderQuickRoutines(routines, done) {
  const grid = document.getElementById('routines-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!routines.length) { grid.innerHTML='<p style="color:#64748b;font-size:13px;grid-column:span 2">No routines for today. Add one or import a template!</p>'; return; }
  routines.forEach((r,idx) => {
    const isDone = done.includes(r.id);
    const card = document.createElement('div');
    card.className = 'glass p-6 rounded-[2.5rem] border transition-all flex justify-between items-center';
    card.style.cssText = `animation:fadeIn 0.4s ease ${idx*60}ms both; ${isDone?'opacity:0.4':''}`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px">
        <div style="font-size:30px">${r.icon}</div>
        <div><div style="font-weight:900;font-size:17px">${r.name}</div><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em">${r.time}</div></div>
      </div>
      <button onclick="toggleRoutine('${r.id}')" style="width:48px;height:48px;border-radius:14px;border:none;cursor:pointer;font-size:20px;transition:all 0.2s;background:${isDone?'#10b981':'rgba(255,255,255,0.05)'}">
        ${isDone?'✓':'○'}
      </button>`;
    grid.appendChild(card);
  });
}

/* Global handlers */
window.toggleRoutine = (id) => {
  const k = new Date().toISOString().slice(0,10);
  if (!state.history[k]) state.history[k] = [];
  const i = state.history[k].indexOf(id);
  if (i >= 0) { state.history[k].splice(i,1); }
  else {
    state.history[k].push(id);
    state.totalDone++;
    if (typeof confetti==='function') confetti({particleCount:60,spread:50,origin:{y:0.8},colors:['#4f46e5','#7c3aed','#10b981']});
    toast('✅ Routine completed!');
  }
  calcStreaks();
  save();
};

/* FIX 6: setGoal — fitness template was missing, now added above */
window.setGoal = (goal) => {
  if (!TEMPLATES[goal]) { toast('Template not found.','error'); return; }
  state.user.goal = goal;
  state.user.onboarding = true;
  state.routines = JSON.parse(JSON.stringify(TEMPLATES[goal]));
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.style.display='none';
  save();
  toast('🚀 Pack loaded! Your routines are ready.');
};

/* FIX 7: nextStep — was called in HTML but function never existed */
window.nextStep = (step) => {
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById('step-'+step);
  if (el) el.classList.remove('hidden');
};

window.logout = () => {
  if (confirm('Logout and clear data?')) { localStorage.removeItem(LS_KEY); window.location.reload(); }
};

/* FIX 8: logMood — called in HTML but never defined */
window.logMood = (level) => {
  const k = new Date().toISOString().slice(0,10);
  state.moods[k] = level;
  save();
  const labels = {1:'Tough day noted.',2:'Okay day noted.',3:'Great mood! 😊',4:'On fire today! 🔥'};
  toast(labels[level]||'Mood saved!');
};

/* FIX 9: openModal / closeModal — called in HTML but never defined */
window.openModal = () => {
  const m = document.getElementById('add-routine-modal');
  if (m) { m.classList.remove('hidden'); requestAnimationFrame(()=>requestAnimationFrame(()=>m.style.opacity='1')); }
};
window.closeModal = () => {
  const m = document.getElementById('add-routine-modal');
  if (m) { m.style.opacity='0'; setTimeout(()=>m.classList.add('hidden'),300); }
};

function initAddRoutineForm() {
  const form = document.getElementById('form-add-routine');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name     = document.getElementById('r-name').value.trim();
    const time     = document.getElementById('r-time').value;
    const icon     = document.getElementById('r-icon').value.trim() || '⭐';
    const category = document.getElementById('r-category').value;
    const days     = [...document.querySelectorAll('.r-day:checked')].map(cb=>parseInt(cb.value));
    if (!name||!time||days.length===0) { toast('Fill all fields & pick at least one day.','error'); return; }
    state.routines.push({ id:'r_'+Date.now(), name, time, icon, category, days });
    closeModal(); form.reset(); save(); toast('✅ Routine added!');
  });
}

/* FIX 10: Focus Timer — start/pause/reset/preset buttons had zero JS logic */
let timerInterval = null, timerRunning = false, timerSeconds = 25*60;
function fmtTimer(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

function initTimer() {
  safeSet('timer-time','textContent',fmtTimer(timerSeconds));
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      clearInterval(timerInterval); timerRunning=false;
      timerSeconds = parseInt(btn.dataset.mins)*60;
      safeSet('timer-time','textContent',fmtTimer(timerSeconds));
      const sb = document.getElementById('timer-start');
      if (sb) sb.textContent = '▶';
      document.querySelectorAll('.preset-btn').forEach(b=>b.style.boxShadow='');
      btn.style.boxShadow = '0 0 0 2px #6366f1';
    });
  });
  const startBtn = document.getElementById('timer-start');
  if (startBtn) {
    startBtn.textContent = '▶';
    startBtn.addEventListener('click', () => {
      if (timerRunning) {
        clearInterval(timerInterval); timerRunning=false; startBtn.textContent='▶';
      } else {
        timerRunning=true; startBtn.textContent='⏸';
        timerInterval = setInterval(()=>{
          timerSeconds--;
          safeSet('timer-time','textContent',fmtTimer(timerSeconds));
          if (timerSeconds<=0) {
            clearInterval(timerInterval); timerRunning=false; startBtn.textContent='▶';
            toast('🎉 Focus session complete!');
            if(typeof confetti==='function') confetti({particleCount:100,spread:70});
          }
        },1000);
      }
    });
  }
  const resetBtn = document.getElementById('timer-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', ()=>{
      clearInterval(timerInterval); timerRunning=false; timerSeconds=25*60;
      safeSet('timer-time','textContent',fmtTimer(timerSeconds));
      const sb=document.getElementById('timer-start'); if(sb) sb.textContent='▶';
    });
  }
}

/* FIX 11: Analytics heatmap & badges rendered properly */
function renderAnalytics() {
  const heatmap = document.getElementById('streak-heatmap');
  if (heatmap) {
    heatmap.innerHTML='';
    const now=new Date();
    for(let i=365;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i);
      const k=d.toISOString().slice(0,10);
      const cell=document.createElement('div');
      cell.className='heatmap-cell'; cell.title=k;
      const c=(state.history[k]||[]).length;
      if(c>0) cell.setAttribute('data-level',Math.min(c,4));
      heatmap.appendChild(cell);
    }
  }
  const badges = document.getElementById('badges-grid');
  if (badges) {
    badges.innerHTML='';
    [{id:'first-ten',icon:'🌱',name:'Getting Started',hint:'10 done'},{id:'7-day',icon:'🔥',name:'7-Day Warrior',hint:'7-day streak'},{id:'30-day',icon:'⚡',name:'30-Day Legend',hint:'30-day streak'},{id:'centurion',icon:'💯',name:'100 Club',hint:'100 done'}].forEach(b=>{
      const active=state.badges.includes(b.id);
      const el=document.createElement('div');
      el.className='glass p-4 rounded-2xl text-center transition-all';
      el.style.cssText=active?'border:1px solid rgba(234,179,8,0.4)':'opacity:0.25;filter:grayscale(1)';
      el.title=b.hint;
      el.innerHTML=`<div style="font-size:28px">${b.icon}</div><div style="font-size:9px;font-weight:800;text-transform:uppercase;margin-top:6px">${b.name}</div>`;
      badges.appendChild(el);
    });
  }
}

/* FIX 12: My Routines — delete button now works */
function renderRoutinesList() {
  const grid = document.getElementById('full-routines-list');
  if (!grid) return;
  grid.innerHTML='';
  if (!state.routines.length) { grid.innerHTML='<p style="color:#64748b;grid-column:span 3;text-align:center;padding:48px 0">No routines yet. Add one or import a template!</p>'; return; }
  state.routines.forEach(r=>{
    const card=document.createElement('div');
    card.className='glass p-6 rounded-[2.5rem] border border-white/5 transition-all';
    card.innerHTML=`<div style="font-size:36px;margin-bottom:14px">${r.icon}</div><div style="font-weight:900;font-size:19px;margin-bottom:4px">${r.name}</div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">${r.time} · ${r.category}</div><div style="margin-top:20px"><button onclick="deleteRoutine('${r.id}')" style="background:rgba(239,68,68,0.1);color:#f87171;border:none;padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px;transition:all 0.2s">🗑 Delete</button></div>`;
    grid.appendChild(card);
  });
}
window.deleteRoutine = (id) => {
  if(!confirm('Delete this routine?')) return;
  state.routines=state.routines.filter(r=>r.id!==id);
  save(); renderRoutinesList(); toast('Routine deleted.','error');
};

/* FIX 13: Calendar — was static day-headers only, now fully rendered with real dates */
function renderCalendar() {
  const body = document.getElementById('full-calendar-body');
  if (!body) return;
  const now=new Date(), year=now.getFullYear(), month=now.getMonth();
  const title=document.getElementById('calendar-month-title');
  if(title) title.textContent=now.toLocaleDateString([],{month:'long',year:'numeric'});
  body.innerHTML='';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>{
    const h=document.createElement('div');
    h.style.cssText='font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:center;padding:8px 0';
    h.textContent=d; body.appendChild(h);
  });
  const firstDay=new Date(year,month,1).getDay();
  const totalDays=new Date(year,month+1,0).getDate();
  for(let i=0;i<firstDay;i++) body.appendChild(document.createElement('div'));
  for(let day=1;day<=totalDays;day++){
    const k=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const c=(state.history[k]||[]).length;
    const isToday=day===now.getDate();
    const cell=document.createElement('div');
    cell.style.cssText=`border-radius:14px;padding:8px 4px;text-align:center;font-size:13px;font-weight:700;transition:all 0.2s;
      ${isToday?'box-shadow:0 0 0 2px #6366f1;background:rgba(99,102,241,0.2)':''}
      ${c>0?'background:rgba(16,185,129,0.2);color:#34d399':'color:#94a3b8'}`;
    cell.innerHTML=`<div>${day}</div>${c>0?`<div style="font-size:8px;margin-top:2px">${c}✓</div>`:''}`;
    body.appendChild(cell);
  }
}

/* ===== MAIN INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  try { const d=localStorage.getItem(LS_KEY); if(d) Object.assign(state,JSON.parse(d)); }
  catch(e) { localStorage.removeItem(LS_KEY); }

  const style=document.createElement('style');
  style.textContent=`
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:1023px){.sidebar{transform:translateX(-100%);transition:transform 0.3s ease}.sidebar.open{transform:translateX(0)}}
    #add-routine-modal{opacity:0;transition:opacity 0.3s ease}
  `;
  document.head.appendChild(style);

  startClock();
  initNavigation();
  initMobileToggle();
  initTimer();
  initAddRoutineForm();

  const auth=document.getElementById('auth-overlay');
  const loginForm=document.getElementById('form-signin');
  if(loginForm){
    loginForm.addEventListener('submit',(e)=>{
      e.preventDefault();
      if(auth){ auth.style.opacity='0'; auth.style.transition='opacity 0.5s'; setTimeout(()=>{ auth.classList.add('hidden'); if(!state.user.onboarding){const ob=document.getElementById('onboarding-overlay');if(ob)ob.style.display='flex';} renderAll(); },500); }
    });
  }
  renderAll();
});

function renderAll() { renderDashboard(); if(window.lucide) lucide.createIcons(); }
function save() { localStorage.setItem(LS_KEY,JSON.stringify(state)); renderAll(); }
