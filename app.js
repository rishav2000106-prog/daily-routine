/* ===== ROUTINE OS 2026: THE COLLABORATIVE MASTERPIECE ===== */
/* Engineered by: Debugger, Code-Reviewer, Data-Scientist, & Code-Improver */

const LS_KEY = 'routineOS_master';
let state = {
  user: { name: 'Rishav', goal: 'minimal', onboarding: false },
  routines: [], history: {}, streak: 0, bestStreak: 0, totalDone: 0, moods: {}, badges: []
};

/* ===== CSS INJECTIONS ===== */
const STYLES = `
    .heatmap-cell[data-level="1"] { background: #6366f1; }
    .heatmap-cell[data-level="2"] { background: #4f46e5; }
    .heatmap-cell[data-level="3"] { background: #4338ca; }
    .heatmap-cell[data-level="4"] { background: #10b981; }
    .timeline-item::before { content: ''; position: absolute; left: -21px; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,0.1); }
    
    /* Animations */
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .animate-in { animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
    .animate-zoom { animation: zoomIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
`;

const TEMPLATES = {
  student: [
    { id: 's1', name: 'Morning Review', time: '07:30', icon: '📚', category: 'morning', days: [1,2,3,4,5] },
    { id: 's2', name: 'Lecture Block', time: '10:00', icon: '🎓', category: 'afternoon', days: [1,2,3,4,5] },
    { id: 's3', name: 'Deep Work', time: '14:00', icon: '💻', category: 'afternoon', days: [1,2,3,4,5] }
  ],
  ceo: [
    { id: 'c1', name: 'Strategic Planning', time: '08:30', icon: '🧠', category: 'morning', days: [1,2,3,4,5] },
    { id: 'c2', name: 'High-Value Sync', time: '11:00', icon: '🤝', category: 'morning', days: [1,2,3,4,5] },
    { id: 'c3', name: 'Audit & Review', time: '16:30', icon: '⚖️', category: 'afternoon', days: [1,2,3,4,5] }
  ]
};

/* ===== 📊 DATA SCIENTIST: SCHEDULE-AWARE STREAK ALGORITHM ===== */
function calcStreaks() {
  const now = new Date();
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    
    // Get routines specifically scheduled for this day
    const scheduled = state.routines.filter(r => r.days.includes(dayOfWeek));
    if (scheduled.length === 0) continue; // Skip rest days (streak continues)
    
    const completed = state.history[k] || [];
    if (completed.length >= scheduled.length) s++; 
    else if (i === 0) continue; // Don't break streak if today isn't over yet
    else break;
  }
  state.streak = s;
  if (s > state.bestStreak) state.bestStreak = s;
  checkBadges();
  save();
}

/* ===== 🛡️ DEBUGGER: DEFENSIVE CORE ===== */
function safeSet(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el[prop] = val;
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `p-4 rounded-2xl glass border border-white/10 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-10 duration-300`;
  t.innerHTML = `<span class="font-black text-sm ${type === 'success' ? 'text-emerald-400' : 'text-indigo-400'}">${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 3000);
}

/* ===== 🔍 CODE-REVIEWER: MODULAR UI ENGINE ===== */
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (!view) return;
      
      // Hardware-accelerated view switching
      document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
      });
      
      const target = document.getElementById(`view-${view}`);
      if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (view === 'analytics') renderAnalytics();
        if (view === 'routines') renderRoutinesList();
      }
    });
  });
}

/* ===== ✨ CODE-IMPROVER: PREMIUM INTERACTIONS ===== */
function renderDashboard() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const done = state.history[todayKey] || [];
  const tr = state.routines.filter(r => r.days.includes(new Date().getDay()));
  const pct = tr.length ? Math.round((done.length / tr.length) * 100) : 0;
  
  safeSet('progress-pct', 'textContent', pct + '%');
  const ring = document.getElementById('progress-ring');
  if (ring) ring.style.strokeDashoffset = 552 - (552 * pct / 100);
  
  safeSet('stat-streak', 'textContent', state.streak);
  safeSet('stat-best', 'textContent', state.bestStreak);
  safeSet('stat-total', 'textContent', state.totalDone);
  
  renderTimeline(tr);
  renderQuickRoutines(tr, done);
}

function renderTimeline(routines) {
  const grid = document.getElementById('timeline-grid');
  if (!grid) return;
  grid.innerHTML = '';
  routines.sort((a,b) => a.time.localeCompare(b.time)).forEach(r => {
    const item = document.createElement('div');
    item.className = 'timeline-item relative flex gap-4 items-start animate-in fade-in slide-in-from-bottom-2';
    item.innerHTML = `<div class="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center relative z-10 text-xl">${r.icon}</div><div><div class="font-bold">${r.name}</div><div class="text-xs text-indigo-400 font-bold tracking-tighter">${r.time}</div></div>`;
    grid.appendChild(item);
  });
}

function renderQuickRoutines(routines, done) {
  const grid = document.getElementById('routines-grid');
  if (!grid) return;
  grid.innerHTML = '';
  routines.forEach((r, idx) => {
    const isDone = done.includes(r.id);
    const card = document.createElement('div');
    card.style.animationDelay = `${idx * 50}ms`;
    card.className = `glass p-6 rounded-[2.5rem] border transition-all flex justify-between items-center animate-in fade-in zoom-in-95 ${isDone ? 'opacity-40 grayscale-[0.5]' : 'hover:scale-[1.02] hover:border-indigo-500/40'}`;
    card.innerHTML = `<div class="flex items-center gap-4"><div class="text-3xl">${r.icon}</div><div><div class="font-black text-lg">${r.name}</div><div class="text-[10px] font-bold uppercase text-gray-500 tracking-widest">${r.time}</div></div></div><button onclick="toggleRoutine('${r.id}')" class="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${isDone ? 'bg-emerald-500 text-white' : 'bg-white/5 hover:bg-indigo-500'}"><i data-lucide="${isDone ? 'check' : 'circle'}"></i></button>`;
    grid.appendChild(card);
  });
}

/* ===== GLOBAL HANDLERS ===== */
window.toggleRoutine = (id) => {
  const k = new Date().toISOString().slice(0, 10);
  if (!state.history[k]) state.history[k] = [];
  const i = state.history[k].indexOf(id);
  if (i >= 0) state.history[k].splice(i, 1);
  else {
    state.history[k].push(id);
    state.totalDone++;
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 }, colors: ['#4f46e5', '#7c3aed', '#10b981'] });
  }
  calcStreaks();
  save();
};

window.setGoal = (goal) => {
  state.user.goal = goal;
  state.user.onboarding = true;
  state.routines = JSON.parse(JSON.stringify(TEMPLATES[goal] || []));
  document.getElementById('onboarding-overlay').classList.add('hidden');
  save();
  toast('Perfect! Pack Loaded.', 'success');
};

window.logout = () => { if(confirm('Logout?')) { localStorage.clear(); window.location.reload(); } };

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  const d = localStorage.getItem(LS_KEY);
  if (d) Object.assign(state, JSON.parse(d));
  
  initNavigation();
  
  const auth = document.getElementById('auth-overlay');
  const loginForm = document.getElementById('form-signin');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      auth.style.opacity = '0';
      setTimeout(() => {
        auth.classList.add('hidden');
        if (!state.user.onboarding) document.getElementById('onboarding-overlay').classList.remove('hidden');
        renderAll();
      }, 500);
    });
  }

  setInterval(() => {
    const n = new Date();
    safeSet('hero-clock', 'textContent', n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    safeSet('header-date', 'textContent', n.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));
  }, 1000);

  renderAll();
});

function renderAll() {
  renderDashboard();
  if (window.lucide) lucide.createIcons();
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); renderAll(); }
function checkBadges() { /* Logic for achievements */ }
function renderAnalytics() {
  const heatmap = document.getElementById('streak-heatmap');
  if (!heatmap) return;
  heatmap.innerHTML = '';
  const now = new Date();
  for (let i = 365; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    const c = (state.history[k] || []).length;
    if (c > 0) cell.setAttribute('data-level', Math.min(c, 4));
    heatmap.appendChild(cell);
  }
  
  const badges = document.getElementById('badges-grid');
  if (badges) {
    badges.innerHTML = '';
    const list = [{ id: '7-day', icon: '🔥', name: '7 Day Warrior' }, { id: 'centurion', icon: '💯', name: '100 Club' }];
    list.forEach(b => {
      const active = state.badges.includes(b.id);
      const el = document.createElement('div');
      el.className = `glass p-4 rounded-2xl text-center transition-all ${active ? 'border-yellow-500/50' : 'opacity-20 grayscale'}`;
      el.innerHTML = `<div class="text-3xl">${b.icon}</div><div class="text-[10px] font-bold uppercase mt-2">${b.name}</div>`;
      badges.appendChild(el);
    });
  }
}

function renderRoutinesList() {
  const grid = document.getElementById('full-routines-list');
  if (!grid) return;
  grid.innerHTML = '';
  state.routines.forEach(r => {
    const card = document.createElement('div');
    card.className = 'glass p-6 rounded-[2.5rem] border border-white/5 animate-zoom';
    card.innerHTML = `
      <div class="text-4xl mb-4">${r.icon}</div>
      <div class="font-black text-xl mb-1">${r.name}</div>
      <div class="text-xs font-bold text-gray-500 uppercase tracking-widest">${r.time} • ${r.category}</div>
      <div class="mt-6 flex gap-2">
        <button class="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
        <button class="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white p-2 rounded-xl transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    `;
    grid.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}
