/* ===== ROUTINE OS 2026 ENGINE ===== */
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
  ]
};

const QUOTES = [
  "Quality is not an act, it is a habit.",
  "Your daily routine is the foundation of your future self.",
  "Discipline is choosing between what you want now and what you want most.",
  "The secret of your success is found in your daily routine."
];

/* ===== UTILS ===== */
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `p-4 rounded-2xl glass border border-white/10 shadow-2xl flex items-center gap-3 animate-bounce shadow-indigo-500/10`;
  const icon = type === 'success' ? 'check-circle' : 'info';
  const color = type === 'success' ? 'text-emerald-400' : 'text-indigo-400';
  t.innerHTML = `<i data-lucide="${icon}" class="${color} w-5 h-5"></i><span class="font-bold text-sm">${msg}</span>`;
  container.appendChild(t);
  lucide.createIcons();
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 3000);
}

/* ===== CORE LOGIC ===== */
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  renderAll();
}

function load() {
  const d = localStorage.getItem(LS_KEY);
  if (d) Object.assign(state, JSON.parse(d));
}

function initOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (!state.user.onboarding) {
    overlay.classList.remove('hidden');
  }
}

window.nextStep = (n) => {
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`step-${n}`).classList.remove('hidden');
};

window.setGoal = (goal) => {
  state.user.goal = goal;
  state.user.onboarding = true;
  state.routines = TEMPLATES[goal] || [];
  document.getElementById('onboarding-overlay').classList.add('hidden');
  save();
  toast(`Welcome! Loaded your ${goal} pack.`, 'success');
  confetti({ particleCount: 150, spread: 70 });
};

/* ===== UI RENDERING ===== */
function renderTimeline() {
  const grid = document.getElementById('timeline-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const now = new Date().getDay();
  const upcoming = state.routines
    .filter(r => r.days.includes(now))
    .sort((a, b) => a.time.localeCompare(b.time));

  upcoming.forEach(r => {
    const item = document.createElement('div');
    item.className = 'timeline-item relative flex gap-4 items-start';
    item.innerHTML = `
      <div class="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative z-10">${r.icon}</div>
      <div>
        <div class="font-bold">${r.name}</div>
        <div class="text-xs text-indigo-400 font-bold">${r.time}</div>
      </div>
    `;
    grid.appendChild(item);
  });
}

function renderRoutines() {
  const grid = document.getElementById('routines-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const todayKey = new Date().toISOString().slice(0, 10);
  const done = state.history[todayKey] || [];
  
  state.routines.forEach(r => {
    const isDone = done.includes(r.id);
    const card = document.createElement('div');
    card.className = `glass p-6 rounded-[2rem] border transition-all flex justify-between items-center ${isDone ? 'opacity-40 border-emerald-500/20' : 'border-white/5 hover:border-indigo-500/30'}`;
    card.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="text-3xl">${r.icon}</div>
        <div>
          <div class="font-black text-lg">${r.name}</div>
          <div class="text-xs font-bold uppercase tracking-widest text-gray-400">${r.time} • ${r.category}</div>
        </div>
      </div>
      <button onclick="toggleRoutine('${r.id}')" class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 hover:bg-indigo-500'}">
        <i data-lucide="${isDone ? 'check' : 'circle'}" class="w-6 h-6"></i>
      </button>
    `;
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
    toast('Routine Completed!', 'success');
  }
  save();
};

function renderStats() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayDone = state.history[todayKey] || [];
  const todayCount = state.routines.filter(r => r.days.includes(new Date().getDay())).length;
  const pct = todayCount ? Math.round((todayDone.length / todayCount) * 100) : 0;
  
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-ring').style.strokeDashoffset = 552 - (552 * pct / 100);
  document.getElementById('stat-streak').textContent = state.streak;
  document.getElementById('stat-best').textContent = state.bestStreak;
  document.getElementById('stat-total').textContent = state.totalDone;
}

function renderAll() {
  renderRoutines();
  renderTimeline();
  renderStats();
  lucide.createIcons();
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', () => {
  load();
  
  // Auth Logic
  const authOverlay = document.getElementById('auth-overlay');
  document.getElementById('form-signin').addEventListener('submit', (e) => {
    e.preventDefault();
    authOverlay.classList.add('opacity-0');
    setTimeout(() => {
      authOverlay.classList.add('hidden');
      initOnboarding();
      renderAll();
    }, 500);
    toast('Logged in as Rishav', 'success');
  });

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Clock & Date
  setInterval(() => {
    const n = new Date();
    document.getElementById('hero-clock').textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('header-date').textContent = n.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }, 1000);

  // Initial Quote
  document.getElementById('hero-quote').textContent = `"${QUOTES[Math.floor(Math.random() * QUOTES.length)]}"`;
  
  renderAll();
});
