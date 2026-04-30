/* ===== GLOBAL STATE & UTILS ===== */
const LS_KEY = 'routineOS';
let state = { routines: [], history: {}, streak: 0, bestStreak: 0, totalDone: 0 };
const publicVapidKey = 'BAhHvsSqeYPU3FBqSCn0lfMNn_yeBpWBTzbb3HYLE8Pd-zld_PT7ypy5dWf72KbBgo6t6hsNcDf2LhLlEI37PrA';

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/* ===== STATE MANAGEMENT ===== */
function loadState() {
  try {
    const d = localStorage.getItem(LS_KEY);
    if (d) Object.assign(state, JSON.parse(d));
  } catch (e) {}
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  const email = localStorage.getItem('routineOS_email');
  if (email) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch('https://daily-routine-lfw9.onrender.com/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, timezone: tz, routines: state.routines })
    }).catch(() => {});
  }
}

function calcStreaks() {
  const d = new Date();
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const ds = new Date(d); ds.setDate(ds.getDate() - i);
    const key = ds.toISOString().slice(0, 10);
    const tr = state.routines.filter(r => r.days.includes(ds.getDay()));
    if (tr.length === 0) continue;
    if ((state.history[key] || []).length >= tr.length) s++; else break;
  }
  state.streak = s;
  saveState();
}

/* ===== AUTHENTICATION ===== */
async function initAuth(onSuccess) {
  const overlay = document.getElementById('auth-overlay');
  
  if (localStorage.getItem('routineOS_auth') === 'true') {
    overlay.classList.remove('active');
    const email = localStorage.getItem('routineOS_email');
    if (email) {
      try {
        const res = await fetch(`https://daily-routine-lfw9.onrender.com/get-data?email=${email}`);
        const data = await res.json();
        if (data.routines) state.routines = data.routines;
        if (onSuccess) onSuccess();
      } catch(e) {
        if (onSuccess) onSuccess();
      }
    } else {
       if (onSuccess) onSuccess();
    }
  }

  // Forms switching
  document.querySelectorAll('.auth-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      if (!targetId) return;
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      const target = document.getElementById(targetId);
      if (target) target.classList.add('active');
    });
  });

  // Login Submit
  const loginForm = document.getElementById('form-signin');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
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
        if (!res.ok) return toast(data.error || 'Login failed', 'error');
        
        localStorage.setItem('routineOS_auth', 'true');
        localStorage.setItem('routineOS_email', email);
        if (data.routines) state.routines = data.routines;
        overlay.classList.remove('active');
        toast('Welcome back!', 'success');
        if (onSuccess) onSuccess();
      } catch(err) { toast('Server unreachable', 'error'); }
    });
  }

  // Signup Submit
  const signupForm = document.getElementById('form-signup');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      try {
        const res = await fetch('https://daily-routine-lfw9.onrender.com/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) return toast(data.error || 'Signup failed', 'error');
        
        localStorage.setItem('routineOS_auth', 'true');
        localStorage.setItem('routineOS_email', email);
        overlay.classList.remove('active');
        toast('Account created!', 'success');
        saveState();
        if (onSuccess) onSuccess();
      } catch(err) { toast('Server unreachable', 'error'); }
    });
  }
}

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
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active-preset'));
        btn.classList.add('active-preset');
      });
    });
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.addEventListener('click', () => this.toggle());
    const resetBtn = document.getElementById('timer-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
  }
  toggle() {
    if (this.timerId) {
      clearInterval(this.timerId); this.timerId = null;
      document.getElementById('timer-play-icon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    } else {
      this.timerId = setInterval(() => this.tick(), 1000);
      document.getElementById('timer-play-icon').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    }
  }
  tick() {
    if (this.timeLeft > 0) { this.timeLeft--; this.updateDisplay(); }
    else { this.complete(); }
  }
  updateDisplay() {
    const el = document.getElementById('timer-time');
    if (el) el.textContent = formatTime(this.timeLeft);
    const ring = document.getElementById('timer-ring-fill');
    if (ring) {
      const offset = 754 - (754 * (this.timeLeft / (this.settings[this.subMode] * 60)));
      ring.style.strokeDashoffset = offset;
    }
  }
  complete() {
    clearInterval(this.timerId); this.timerId = null;
    toast('Session complete!', 'success');
    this.subMode = this.subMode === 'focus' ? 'short' : 'focus';
    this.timeLeft = this.settings[this.subMode] * 60;
    this.updateDisplay();
  }
  reset() {
    clearInterval(this.timerId); this.timerId = null;
    this.timeLeft = this.settings[this.subMode] * 60;
    this.updateDisplay();
  }
}

/* ===== DASHBOARD & UI ===== */
function updateClock() {
  const n = new Date();
  const clockEl = document.getElementById('hero-clock');
  const secEl = document.getElementById('hero-seconds');
  const dateEl = document.getElementById('current-date');
  if (clockEl) clockEl.textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (secEl) secEl.textContent = `:${String(n.getSeconds()).padStart(2, '0')}`;
  if (dateEl) dateEl.textContent = n.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function renderAll() {
  const tr = state.routines.filter(r => r.days.includes(new Date().getDay()));
  const todayKey = new Date().toISOString().slice(0, 10);
  const done = state.history[todayKey] || [];
  const pct = tr.length ? Math.round((tr.filter(r => done.includes(r.id)).length / tr.length) * 100) : 0;
  
  const pctEl = document.getElementById('progress-pct');
  const ringEl = document.getElementById('progress-ring');
  const streakEl = document.getElementById('stat-streak');
  
  if (pctEl) pctEl.textContent = pct + '%';
  if (ringEl) ringEl.style.strokeDashoffset = 220 - (220 * pct / 100);
  if (streakEl) streakEl.textContent = (state.streak || 0) + ' days';
  
  const grid = document.getElementById('routines-grid');
  if (grid) {
    grid.innerHTML = '';
    state.routines.forEach(r => {
      const card = document.createElement('div');
      card.className = 'routine-card glass p-4 rounded-2xl border border-white/5';
      const isDone = (state.history[todayKey] || []).includes(r.id);
      card.innerHTML = `<div class="flex justify-between items-center"><div class="flex gap-3"><div>${r.icon}</div><div><div class="font-bold">${r.name}</div></div></div><button class="w-8 h-8 rounded-full border border-primary ${isDone ? 'bg-primary text-white' : ''}" onclick="toggleRoutine('${r.id}')">${isDone ? '✓' : ''}</button></div>`;
      grid.appendChild(card);
    });
  }
}

window.toggleRoutine = (id) => {
  const k = new Date().toISOString().slice(0, 10);
  if (!state.history[k]) state.history[k] = [];
  const i = state.history[k].indexOf(id);
  if (i >= 0) state.history[k].splice(i, 1); else state.history[k].push(id);
  calcStreaks(); renderAll();
};

/* ===== NAVIGATION ===== */
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${view}`).classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.clear();
      window.location.reload();
    });
  }
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  initNavigation();
  initAuth(() => renderAll());
  new FocusTimer();
  setInterval(updateClock, 1000); updateClock();
});
