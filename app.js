/* ===== ROUTINE OS 2026 ENGINE (FULL VERSION) ===== */
const LS_KEY = 'routineOS_master';
let state = {
  user: { name: 'Rishav', goal: 'minimal', onboarding: false },
  routines: [], history: {}, streak: 0, bestStreak: 0, totalDone: 0, moods: {}, badges: []
};

const TEMPLATES = {
  student: [
    { id: 's1', name: 'Morning Review', time: '07:30', icon: '📚', category: 'morning', days: [1,2,3,4,5] },
    { id: 's2', name: 'Lecture Block', time: '10:00', icon: '🎓', category: 'afternoon', days: [1,2,3,4,5] },
    { id: 's3', name: 'Gym Session', time: '17:00', icon: '💪', category: 'evening', days: [1,3,5] }
  ],
  ceo: [
    { id: 'c1', name: 'Deep Work Block', time: '08:00', icon: '💻', category: 'morning', days: [1,2,3,4,5] },
    { id: 'c2', name: 'Team Sync', time: '11:00', icon: '🤝', category: 'morning', days: [1,2,3,4,5] },
    { id: 'c3', name: 'Market Analysis', time: '16:00', icon: '📈', category: 'afternoon', days: [1,2,3,4,5] }
  ],
  fitness: [
    { id: 'f1', name: 'Yoga Flow', time: '06:30', icon: '🧘', category: 'morning', days: [0,2,4,6] },
    { id: 'f2', name: 'Protein Prep', time: '08:00', icon: '🍳', category: 'morning', days: [1,2,3,4,5,6] },
    { id: 'f3', name: 'HIIT Workout', time: '18:00', icon: '🏃', category: 'evening', days: [1,3,5] }
  ]
};

const QUOTES = [
  "Quality is not an act, it is a habit.",
  "Your daily routine is the foundation of your future self.",
  "Discipline is choosing between what you want now and what you want most.",
  "The secret of your success is found in your daily routine.",
  "Small wins every day lead to giant results over time."
];

/* ===== UTILS ===== */
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `p-4 rounded-2xl glass border border-white/10 shadow-2xl flex items-center gap-3 animate-bounce shadow-indigo-500/10 transition-all duration-500`;
  const icon = type === 'success' ? 'check-circle' : 'info';
  const color = type === 'success' ? 'text-emerald-400' : 'text-indigo-400';
  t.innerHTML = `<i data-lucide="${icon}" class="${color} w-5 h-5"></i><span class="font-bold text-sm">${msg}</span>`;
  container.appendChild(t);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-20px)'; setTimeout(() => t.remove(), 500); }, 3000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/* ===== STATE MANAGEMENT ===== */
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  renderAll();
}

function load() {
  const d = localStorage.getItem(LS_KEY);
  if (d) Object.assign(state, JSON.parse(d));
}

function calcStreaks() {
  const d = new Date();
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const ds = new Date(d); ds.setDate(ds.getDate() - i);
    const key = ds.toISOString().slice(0, 10);
    const tr = state.routines.filter(r => r.days.includes(ds.getDay()));
    if (tr.length === 0) continue;
    const done = state.history[key] || [];
    if (done.length >= tr.length) s++; else break;
  }
  state.streak = s;
  if (s > state.bestStreak) state.bestStreak = s;
  checkBadges();
}

function checkBadges() {
  const newB = [];
  if (state.streak >= 7 && !state.badges.includes('7-day')) newB.push('7-day');
  if (state.totalDone >= 100 && !state.badges.includes('centurion')) newB.push('centurion');
  if (newB.length > 0) {
    state.badges.push(...newB);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    toast('Achievement Unlocked!', 'success');
  }
}

/* ===== NAVIGATION ===== */
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (!view) return;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const target = document.getElementById(`view-${view}`);
      if (target) target.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Auto-refresh specific views
      if (view === 'analytics') renderAnalytics();
      if (view === 'calendar') renderCalendar();
    });
  });
}

/* ===== ONBOARDING ===== */
function initOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (!state.user.onboarding) overlay.classList.remove('hidden');
}

window.nextStep = (n) => {
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`step-${n}`).classList.remove('hidden');
};

window.setGoal = (goal) => {
  state.user.goal = goal;
  state.user.onboarding = true;
  state.routines = JSON.parse(JSON.stringify(TEMPLATES[goal] || []));
  document.getElementById('onboarding-overlay').classList.add('hidden');
  save();
  toast(`Welcome! Loaded your ${goal} pack.`, 'success');
  confetti({ particleCount: 150, spread: 70 });
};

/* ===== FOCUS TIMER ===== */
class FocusTimer {
  constructor() {
    this.timeLeft = 1500;
    this.timerId = null;
    this.subMode = 'focus';
    this.settings = { focus: 25, short: 5, long: 15 };
    this.init();
  }
  init() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.timeLeft = parseInt(btn.dataset.mins) * 60;
        this.updateDisplay();
      });
    });
    const playBtn = document.getElementById('timer-start');
    if (playBtn) playBtn.addEventListener('click', () => this.toggle());
  }
  toggle() {
    if (this.timerId) {
      clearInterval(this.timerId); this.timerId = null;
    } else {
      this.timerId = setInterval(() => this.tick(), 1000);
    }
  }
  tick() {
    if (this.timeLeft > 0) { this.timeLeft--; this.updateDisplay(); }
    else { this.complete(); }
  }
  updateDisplay() {
    const el = document.getElementById('timer-time');
    if (el) el.textContent = formatTime(this.timeLeft);
    const ring = document.getElementById('progress-ring'); // Shared ring or separate
    if (ring) {
       const pct = (this.timeLeft / (this.settings[this.subMode] * 60));
       ring.style.strokeDashoffset = 552 - (552 * pct);
    }
  }
  complete() {
    clearInterval(this.timerId); this.timerId = null;
    toast('Session Complete!', 'success');
    confetti({ particleCount: 100 });
    this.subMode = this.subMode === 'focus' ? 'short' : 'focus';
    this.timeLeft = this.settings[this.subMode] * 60;
    this.updateDisplay();
  }
}

/* ===== UI RENDERING ===== */
function renderAll() {
  renderDashboard();
  renderRoutines();
  lucide.createIcons();
}

function renderDashboard() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const done = state.history[todayKey] || [];
  const tr = state.routines.filter(r => r.days.includes(new Date().getDay()));
  const pct = tr.length ? Math.round((done.length / tr.length) * 100) : 0;
  
  const pctEl = document.getElementById('progress-pct');
  const ringEl = document.getElementById('progress-ring');
  if (pctEl) pctEl.textContent = pct + '%';
  if (ringEl) ringEl.style.strokeDashoffset = 552 - (552 * pct / 100);
  
  document.getElementById('stat-streak').textContent = state.streak;
  document.getElementById('stat-best').textContent = state.bestStreak;
  document.getElementById('stat-total').textContent = state.totalDone;
  
  renderTimeline(tr);
  renderQuickRoutines(tr, done);
}

function renderTimeline(routines) {
  const grid = document.getElementById('timeline-grid');
  if (!grid) return;
  grid.innerHTML = '';
  routines.sort((a,b) => a.time.localeCompare(b.time)).forEach(r => {
    const item = document.createElement('div');
    item.className = 'timeline-item relative flex gap-4 items-start';
    item.innerHTML = `<div class="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative z-10 text-xl">${r.icon}</div><div><div class="font-bold">${r.name}</div><div class="text-xs text-indigo-400 font-bold">${r.time}</div></div>`;
    grid.appendChild(item);
  });
}

function renderQuickRoutines(routines, done) {
  const grid = document.getElementById('routines-grid');
  if (!grid) return;
  grid.innerHTML = '';
  routines.forEach(r => {
    const isDone = done.includes(r.id);
    const card = document.createElement('div');
    card.className = `glass p-6 rounded-[2rem] border transition-all flex justify-between items-center ${isDone ? 'opacity-40' : 'hover:border-indigo-500/30'}`;
    card.innerHTML = `<div class="flex items-center gap-4"><div class="text-3xl">${r.icon}</div><div><div class="font-black text-lg">${r.name}</div><div class="text-xs font-bold uppercase text-gray-400">${r.time}</div></div></div><button onclick="toggleRoutine('${r.id}')" class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 text-white' : 'bg-white/5'}"><i data-lucide="${isDone ? 'check' : 'circle'}"></i></button>`;
    grid.appendChild(card);
  });
}

window.toggleRoutine = (id) => {
  const k = new Date().toISOString().slice(0, 10);
  if (!state.history[k]) state.history[k] = [];
  const i = state.history[k].indexOf(id);
  if (i >= 0) state.history[k].splice(i, 1);
  else {
    state.history[k].push(id);
    state.totalDone++;
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
  }
  calcStreaks();
  save();
};

/* ===== ANALYTICS & CALENDAR ===== */
function renderAnalytics() {
  const container = document.getElementById('streak-heatmap');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();
  for (let i = 365; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    const c = (state.history[k] || []).length;
    if (c > 0) cell.setAttribute('data-level', Math.min(c, 4));
    container.appendChild(cell);
  }
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  load();
  initNavigation();
  
  const authOverlay = document.getElementById('auth-overlay');
  document.getElementById('form-signin').addEventListener('submit', (e) => {
    e.preventDefault();
    authOverlay.classList.add('opacity-0');
    setTimeout(() => {
      authOverlay.classList.add('hidden');
      initOnboarding();
      renderAll();
    }, 500);
  });

  setInterval(() => {
    const n = new Date();
    const clk = document.getElementById('hero-clock');
    if (clk) clk.textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const dte = document.getElementById('header-date');
    if (dte) dte.textContent = n.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }, 1000);

  new FocusTimer();
  renderAll();
});
