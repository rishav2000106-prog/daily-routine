export const LS_KEY = 'routineOS';

export let state = {
  routines: [],
  history: {},
  streak: 0,
  bestStreak: 0,
  totalDone: 0
};

export function loadState() {
  try {
    const d = localStorage.getItem(LS_KEY);
    if (d) {
      const parsed = JSON.parse(d);
      Object.assign(state, parsed);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

export function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  
  // Sync to Backend
  const email = localStorage.getItem('routineOS_email');
  if (email) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch('https://daily-routine-lfw9.onrender.com/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, timezone: tz, routines: state.routines })
    }).catch(e => console.log('Sync failed:', e.message));
  }
}

export function calcStreaks() {
  const dates = Object.keys(state.history).sort().reverse();
  let s = 0;
  const d = new Date();
  
  for (let i = 0; i < 365; i++) {
    const ds = new Date(d);
    ds.setDate(ds.getDate() - i);
    const key = ds.toISOString().slice(0, 10);
    const tr = state.routines.filter(r => r.days.includes(ds.getDay()));
    
    if (tr.length === 0) continue;
    const done = state.history[key] || [];
    if (done.length >= tr.length) s++;
    else break;
  }
  
  state.streak = s;
  let best = 0, cur = 0;
  const all = Object.keys(state.history).sort();
  
  all.forEach(k => {
    const ds = new Date(k);
    const tr = state.routines.filter(r => r.days.includes(ds.getDay()));
    if (tr.length > 0 && (state.history[k] || []).length >= tr.length) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 0;
  });
  
  state.bestStreak = Math.max(best, state.bestStreak);
  state.totalDone = Object.values(state.history).reduce((a, b) => a + b.length, 0);
  saveState();
}
