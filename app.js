import { state, loadState, saveState, calcStreaks } from './modules/state.js';
import { initAuth } from './modules/auth.js';
import { FocusTimer } from './modules/timer.js';
import { initCharts } from './modules/charts.js';
import { fetchQuote, toast } from './modules/utils.js';

// --- Initialization ---
async function init() {
  loadState();
  initAuth(() => {
    renderAll();
  });
  
  new FocusTimer();
  
  // Dashboard Quote
  const quote = await fetchQuote();
  document.getElementById('quote-text').textContent = `"${quote.text}"`;
  document.getElementById('quote-author').textContent = `— ${quote.author}`;
  
  // Navigation
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');
      
      if (view === 'analytics') initCharts(state.routines);
      renderAll();
    });
  });

  // Clock
  setInterval(updateClock, 1000);
  updateClock();
  
  renderAll();
}

function updateClock() {
  const n = new Date();
  document.getElementById('hero-clock').textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  document.getElementById('hero-seconds').textContent = `:${String(n.getSeconds()).padStart(2, '0')}`;
  document.getElementById('current-date').textContent = n.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  
  const h = n.getHours();
  document.getElementById('greeting').textContent = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

function renderAll() {
  renderDashboard();
  renderRoutines();
}

function renderDashboard() {
  const tr = todayRoutines();
  const todayKey = new Date().toISOString().slice(0, 10);
  const done = state.history[todayKey] || [];
  const pct = tr.length ? Math.round((tr.filter(r => done.includes(r.id)).length / tr.length) * 100) : 0;
  
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-ring').style.strokeDashoffset = 220 - (220 * pct / 100);
  document.getElementById('stat-done-text').textContent = `${tr.filter(r => done.includes(r.id)).length} / ${tr.length} done`;
  document.getElementById('stat-streak').textContent = state.streak + ' days';
  
  // Streak Animation
  if (state.streak > 3) {
    document.getElementById('stat-streak').parentElement.classList.add('animate-bounce');
  }
}

function todayRoutines() {
  const dow = new Date().getDay();
  return state.routines.filter(r => r.days.includes(dow)).sort((a, b) => a.time.localeCompare(b.time));
}

function renderRoutines() {
  const grid = document.getElementById('routines-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  state.routines.forEach(r => {
    const card = document.createElement('div');
    card.className = 'routine-card glass p-4 rounded-2xl border border-white/5 hover:border-primary/50 transition-all';
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="text-2xl">${r.icon}</div>
          <div>
            <div class="font-bold">${r.name}</div>
            <div class="text-xs text-gray-400">${r.time} • ${r.duration}m</div>
          </div>
        </div>
        <button class="w-8 h-8 rounded-full border border-primary flex items-center justify-center transition-all ${isDone(r.id) ? 'bg-primary text-white' : ''}" onclick="window.toggleRoutine('${r.id}')">
          ${isDone(r.id) ? '✓' : ''}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function isDone(id) {
  const todayKey = new Date().toISOString().slice(0, 10);
  return (state.history[todayKey] || []).includes(id);
}

window.toggleRoutine = (id) => {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (!state.history[todayKey]) state.history[todayKey] = [];
  
  const idx = state.history[todayKey].indexOf(id);
  if (idx >= 0) state.history[todayKey].splice(idx, 1);
  else state.history[todayKey].push(id);
  
  calcStreaks();
  renderAll();
  saveState();
};

// Start the app
window.addEventListener('DOMContentLoaded', init);
