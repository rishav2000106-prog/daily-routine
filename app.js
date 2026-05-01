/* ===== ROUTINE OS 2026 — FULL FEATURED ===== */

const LS_KEY = 'routineOS_master';
const API_URL = 'https://daily-routine-lfw9.onrender.com';
let authMode = 'login'; // 'login' or 'signup'

let state = {
  user: { email: '', name: 'Rishav', goal: 'minimal', onboarding: false },
  routines: [], history: {}, streak: 0, bestStreak: 0, totalDone: 0, moods: {}, badges: [],
  settings: { notificationsEnabled: false, bgType: 'default', bgValue: '', bgOverlay: 0.6 }
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

/* ============================================================
   HELPERS
============================================================ */
function safeSet(id, prop, val) { const el=document.getElementById(id); if(el) el[prop]=val; }

function toast(msg, type='success', duration=3500) {
  const c=document.getElementById('toast-container'); if(!c) return;
  const t=document.createElement('div');
  t.style.cssText=`padding:14px 20px;border-radius:18px;background:rgba(10,10,20,0.97);border:1px solid rgba(255,255,255,0.15);box-shadow:0 24px 48px rgba(0,0,0,0.6);animation:slideInRight 0.35s cubic-bezier(.22,1,.36,1) both;display:flex;align-items:center;gap:10px;pointer-events:all;max-width:320px`;
  t.innerHTML=`<span style="font-weight:800;font-size:13px;color:${type==='success'?'#34d399':type==='warn'?'#fbbf24':'#f87171'}">${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='all 0.4s ease'; setTimeout(()=>t.remove(),400); }, duration);
}

/* ============================================================
   CLOUD SYNC
============================================================ */
async function syncCloud() {
  if (!state.user.email) return;
  try {
    const res = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.user.email, state })
    });
    if (!res.ok) throw new Error('Sync failed');
    console.log('☁️ Cloud Sync Success');
  } catch (e) {
    console.warn('☁️ Cloud Sync Offline', e);
  }
}

async function loadCloud(email) {
  try {
    const res = await fetch(`${API_URL}/load?email=${email}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.state) {
        state = data.state;
        save(false); // Save locally but don't sync back immediately
        renderAll();
        return true;
      }
    }
  } catch (e) {
    console.error('Failed to load from cloud:', e);
  }
  return false;
}

/* ============================================================
   CLOCK
============================================================ */
function startClock() {
  function tick() {
    const n=new Date();
    safeSet('hero-clock','textContent',n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}));
    safeSet('header-date','textContent',n.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'}));
  }
  tick(); setInterval(tick,1000);
}

/* ============================================================
   NOTIFICATION + ALARM SYSTEM
============================================================ */
let notifCheckInterval = null;
let alarmAudio = null;
const notifiedToday = new Set(); // track which routine IDs we already notified today

function createAlarmSound() {
  // Web Audio API — generates a pleasant chime ring
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  function playTone(freq, startTime, duration, vol=0.4) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, startTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime); osc.stop(startTime + duration);
  }
  // Chime sequence: C5 E5 G5 C6
  const t = ctx.currentTime;
  playTone(523.25, t,       0.5);
  playTone(659.25, t+0.25,  0.5);
  playTone(783.99, t+0.5,   0.5);
  playTone(1046.5, t+0.75,  0.9, 0.6);
  playTone(783.99, t+1.1,   0.4);
  playTone(659.25, t+1.4,   0.4);
  playTone(523.25, t+1.7,   0.8, 0.5);
}

function requestNotificationPermission() {
  if (!('Notification' in window)) { toast('❌ This browser does not support notifications.','error'); return; }
  if (Notification.permission === 'granted') {
    enableNotifications();
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') enableNotifications();
      else toast('🔕 Notification permission denied.','warn');
    });
  } else {
    toast('🔕 Notifications blocked. Please enable in browser settings.','warn');
  }
}

function enableNotifications() {
  state.settings.notificationsEnabled = true;
  save();
  startNotificationChecker();
  toast('🔔 Notifications enabled! You\'ll be alerted at routine time.','success');
  updateNotifUI();
}

function disableNotifications() {
  state.settings.notificationsEnabled = false;
  clearInterval(notifCheckInterval);
  save();
  toast('🔕 Notifications disabled.','warn');
  updateNotifUI();
}

function updateNotifUI() {
  const btn = document.getElementById('notif-toggle-btn');
  const badge = document.getElementById('notif-badge');
  const enabled = state.settings.notificationsEnabled;
  if (btn) {
    btn.textContent = enabled ? '🔔 Notifications ON' : '🔕 Enable Notifications';
    btn.style.background = enabled ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)';
    btn.style.color = enabled ? '#34d399' : '#818cf8';
    btn.style.borderColor = enabled ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)';
  }
  if (badge) badge.style.display = enabled ? 'block' : 'none';
}

function startNotificationChecker() {
  clearInterval(notifCheckInterval);
  notifCheckInterval = setInterval(checkRoutineAlarms, 30000); // check every 30s
  checkRoutineAlarms(); // check immediately
}

function checkRoutineAlarms() {
  if (!state.settings.notificationsEnabled) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const currentTime = `${hh}:${mm}`;
  const todayKey = now.toISOString().slice(0,10);
  const dayOfWeek = now.getDay();
  const done = state.history[todayKey] || [];

  state.routines.forEach(r => {
    if (!r.days.includes(dayOfWeek)) return;
    if (done.includes(r.id)) return; // already done
    if (r.time !== currentTime) return; // not time yet
    const notifKey = `${todayKey}_${r.id}`;
    if (notifiedToday.has(notifKey)) return; // already notified

    notifiedToday.add(notifKey);
    fireRoutineAlert(r);
  });
}

function fireRoutineAlert(routine) {
  // Play chime sound
  try { createAlarmSound(); } catch(e) { console.warn('Audio failed:', e); }

  // Show in-app alert banner
  showAlarmBanner(routine);

  // Browser/OS notification via Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'ROUTINE_ALERT',
      id: routine.id,
      name: routine.name,
      body: `${routine.icon} Time for: ${routine.name} (${routine.time})`
    });
  } else if (Notification.permission === 'granted') {
    // Fallback: direct notification
    new Notification(`⏰ ${routine.name}`, {
      body: `${routine.icon} It's ${routine.time} — time for your routine!`,
      icon: '/daily-routine/icon.svg',
      tag: 'routine-' + routine.id,
      renotify: true
    });
  }

  // Vibrate if on mobile
  if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 800, 200, 800]);
}

function showAlarmBanner(routine) {
  const existing = document.getElementById('alarm-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'alarm-banner';
  banner.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:linear-gradient(135deg,rgba(79,70,229,0.98),rgba(124,58,237,0.98));border:1px solid rgba(255,255,255,0.25);border-radius:24px;padding:20px 28px;box-shadow:0 32px 64px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.1);min-width:300px;max-width:420px;text-align:center;animation:alarmPop 0.5s cubic-bezier(.22,1,.36,1) both;backdrop-filter:blur(20px);`;
  banner.innerHTML = `
    <div style="font-size:48px;margin-bottom:8px;animation:ringBell 0.5s ease infinite alternate">${routine.icon}</div>
    <div style="font-size:11px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:4px">⏰ Routine Time!</div>
    <div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:4px">${routine.name}</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:20px">${routine.time}</div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button onclick="markDoneFromBanner('${routine.id}')" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:#fff;padding:10px 22px;border-radius:14px;font-weight:800;cursor:pointer;font-size:14px;transition:all 0.2s">✅ Done</button>
      <button onclick="snoozeBanner('${routine.id}','${routine.name}','${routine.time}','${routine.icon}')" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);padding:10px 22px;border-radius:14px;font-weight:800;cursor:pointer;font-size:14px;transition:all 0.2s">⏱ Snooze 5m</button>
      <button onclick="document.getElementById('alarm-banner').remove()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);padding:10px 16px;border-radius:14px;font-weight:800;cursor:pointer;font-size:14px">✕</button>
    </div>`;
  document.body.appendChild(banner);
  // Auto-dismiss after 60s
  setTimeout(() => { if(document.getElementById('alarm-banner')) banner.remove(); }, 60000);
}

window.markDoneFromBanner = (id) => {
  const banner = document.getElementById('alarm-banner');
  if (banner) banner.remove();
  toggleRoutine(id);
};

window.snoozeBanner = (id, name, time, icon) => {
  const banner = document.getElementById('alarm-banner');
  if (banner) banner.remove();
  toast(`⏱ Snoozed "${name}" for 5 minutes.`, 'warn');
  setTimeout(() => {
    fireRoutineAlert({ id, name, time, icon, days: [] });
  }, 5 * 60 * 1000);
};

/* ============================================================
   PWA INSTALL
============================================================ */
let deferredInstallPrompt = null;

function initPWA() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/daily-routine/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(e => console.warn('SW failed:', e));
  }

  // Capture the install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner();
    updateInstallBtn(true);
  });

  // Detect already installed
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallBanner();
    updateInstallBtn(false);
    toast('🎉 RoutineOS installed on your device!', 'success');
  });

  // iOS Safari — no beforeinstallprompt, show manual instructions
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isInStandaloneMode) {
    setTimeout(() => showIOSInstallHint(), 3000);
  }
}

function showInstallBanner() {
  const b = document.getElementById('install-banner');
  if (b) { b.style.display='flex'; b.style.animation='slideUp 0.4s cubic-bezier(.22,1,.36,1) both'; }
}
function hideInstallBanner() {
  const b = document.getElementById('install-banner');
  if (b) b.style.display='none';
}
function updateInstallBtn(show) {
  const btn = document.getElementById('install-app-btn');
  if (btn) btn.style.display = show ? 'flex' : 'none';
}

window.triggerInstall = async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') toast('🎉 Installing RoutineOS!', 'success');
    deferredInstallPrompt = null;
    hideInstallBanner();
  } else {
    showIOSInstallHint();
  }
};

function showIOSInstallHint() {
  toast('📱 To install: tap Share → "Add to Home Screen"', 'warn', 6000);
}

/* ============================================================
   CUSTOM BACKGROUND
============================================================ */
const BG_PRESETS = [
  { label: 'Default Dark', type: 'color', value: '#020617' },
  { label: 'Midnight Blue', type: 'gradient', value: 'linear-gradient(135deg,#0a0a2e,#1a1a4e,#0d0d1a)' },
  { label: 'Deep Forest', type: 'gradient', value: 'linear-gradient(135deg,#0a1a0a,#0d2b0d,#051205)' },
  { label: 'Volcano', type: 'gradient', value: 'linear-gradient(135deg,#1a0505,#2d0808,#1a0a00)' },
  { label: 'Galaxy', type: 'gradient', value: 'linear-gradient(135deg,#0d0d2b,#1a0a2e,#0a1a2e)' },
  { label: 'Aurora', type: 'gradient', value: 'linear-gradient(135deg,#041a14,#0a1a2e,#1a0a2e,#0a1a14)' },
];

function applyBackground() {
  const s = state.settings;
  const body = document.body;
  const overlay = document.getElementById('bg-overlay');

  if (s.bgType === 'image' && s.bgValue) {
    body.style.background = `url(${s.bgValue}) center/cover no-repeat fixed`;
    if (overlay) { overlay.style.display='block'; overlay.style.opacity=s.bgOverlay; }
  } else if (s.bgType === 'gradient') {
    body.style.background = s.bgValue;
    if (overlay) overlay.style.display='none';
  } else if (s.bgType === 'color') {
    body.style.background = s.bgValue;
    if (overlay) overlay.style.display='none';
  } else {
    body.style.background = '#020617';
    if (overlay) overlay.style.display='none';
  }
}

function initBgSettings() {
  // Preset buttons
  const grid = document.getElementById('bg-presets-grid');
  if (grid) {
    BG_PRESETS.forEach((p,i) => {
      const btn = document.createElement('button');
      btn.style.cssText=`width:100%;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight:700;cursor:pointer;background:${p.type==='gradient'?p.value:p.value};color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8);transition:all 0.2s;text-align:left`;
      btn.textContent = p.label;
      btn.onclick = () => {
        state.settings.bgType = p.type;
        state.settings.bgValue = p.value;
        applyBackground(); save();
        toast('🎨 Background applied!');
        document.querySelectorAll('#bg-presets-grid button').forEach(b=>b.style.outline='none');
        btn.style.outline = '2px solid #6366f1';
      };
      grid.appendChild(btn);
    });
  }

  // Image URL input
  const urlInput = document.getElementById('bg-url-input');
  const urlBtn = document.getElementById('bg-url-btn');
  if (urlBtn && urlInput) {
    urlBtn.onclick = () => {
      const url = urlInput.value.trim();
      if (!url) { toast('Enter an image URL first.','error'); return; }
      state.settings.bgType = 'image';
      state.settings.bgValue = url;
      applyBackground(); save();
      toast('🖼 Background set from URL!');
    };
  }

  // File upload
  const fileInput = document.getElementById('bg-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB).','error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.settings.bgType = 'image';
        state.settings.bgValue = ev.target.result;
        applyBackground(); save();
        toast('🖼 Custom background applied!');
      };
      reader.readAsDataURL(file);
    });
  }

  // Overlay opacity
  const overlaySlider = document.getElementById('bg-overlay-slider');
  if (overlaySlider) {
    overlaySlider.value = state.settings.bgOverlay || 0.6;
    overlaySlider.oninput = () => {
      state.settings.bgOverlay = parseFloat(overlaySlider.value);
      applyBackground(); save();
    };
  }

  // Reset background
  const resetBtn = document.getElementById('bg-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      state.settings.bgType = 'default'; state.settings.bgValue = '';
      applyBackground(); save(); toast('Background reset.');
    };
  }
}

/* ============================================================
   STREAK + BADGES
============================================================ */
function calcStreaks() {
  const now=new Date(); let s=0;
  for(let i=0;i<365;i++){
    const d=new Date(now); d.setDate(d.getDate()-i);
    const k=d.toISOString().slice(0,10);
    const scheduled=state.routines.filter(r=>r.days.includes(d.getDay()));
    if(!scheduled.length) continue;
    const completed=state.history[k]||[];
    if(completed.length>=scheduled.length) s++;
    else if(i===0) continue;
    else break;
  }
  state.streak=s; if(s>state.bestStreak) state.bestStreak=s;
  checkBadges();
}

function checkBadges() {
  const earned=[];
  if(state.streak>=7)      earned.push('7-day');
  if(state.streak>=30)     earned.push('30-day');
  if(state.totalDone>=10)  earned.push('first-ten');
  if(state.totalDone>=100) earned.push('centurion');
  state.badges=earned;
}

/* ============================================================
   NAVIGATION
============================================================ */
function initNavigation() {
  document.querySelectorAll('.view').forEach(v=>{v.style.display='none';v.classList.remove('active');});
  const dash=document.getElementById('view-dashboard');
  if(dash){dash.style.display='block'; requestAnimationFrame(()=>requestAnimationFrame(()=>dash.classList.add('active')));}

  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const view=btn.dataset.view; if(!view) return;
      document.querySelectorAll('.view').forEach(v=>{v.classList.remove('active');v.style.display='none';});
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      const target=document.getElementById('view-'+view);
      if(target){
        target.style.display='block';
        requestAnimationFrame(()=>requestAnimationFrame(()=>target.classList.add('active')));
        btn.classList.add('active');
        if(view==='analytics') renderAnalytics();
        if(view==='routines')  renderRoutinesList();
        if(view==='calendar')  renderCalendar();
        if(view==='settings')  { updateNotifUI(); }
      }
      document.querySelector('.sidebar').classList.remove('open');
    });
  });
}

function initMobileToggle() {
  const btn=document.getElementById('mobile-toggle'), sidebar=document.querySelector('.sidebar');
  if(!btn||!sidebar) return;
  btn.addEventListener('click',(e)=>{e.stopPropagation();sidebar.classList.toggle('open');});
  document.addEventListener('click',(e)=>{if(!sidebar.contains(e.target)&&e.target!==btn)sidebar.classList.remove('open');});
}

/* ============================================================
   DASHBOARD
============================================================ */
function renderDashboard() {
  const todayKey=new Date().toISOString().slice(0,10);
  const done=state.history[todayKey]||[];
  const tr=state.routines.filter(r=>r.days.includes(new Date().getDay()));
  const pct=tr.length?Math.round((done.length/tr.length)*100):0;

  safeSet('progress-pct','textContent',pct+'%');
  const ring=document.getElementById('progress-ring');
  if(ring) ring.style.strokeDashoffset=552-(552*pct/100);
  safeSet('stat-streak','textContent',state.streak);
  safeSet('stat-best',  'textContent',state.bestStreak);
  safeSet('stat-total', 'textContent',state.totalDone);
  renderTimeline(tr);
  renderQuickRoutines(tr,done);
}

function renderTimeline(routines) {
  const grid=document.getElementById('timeline-grid'); if(!grid) return;
  grid.innerHTML='';
  if(!routines.length){grid.innerHTML='<p style="color:#64748b;font-size:13px">No routines today.</p>';return;}
  routines.sort((a,b)=>a.time.localeCompare(b.time)).forEach(r=>{
    const el=document.createElement('div'); el.className='timeline-item relative flex gap-4 items-start';
    el.innerHTML=`<div style="width:40px;height:40px;border-radius:50%;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;position:relative;z-index:1">${r.icon}</div><div><div style="font-weight:800">${r.name}</div><div style="font-size:11px;color:#818cf8;font-weight:700">${r.time}</div></div>`;
    grid.appendChild(el);
  });
}

function renderQuickRoutines(routines, done) {
  const grid=document.getElementById('routines-grid'); if(!grid) return;
  grid.innerHTML='';
  if(!routines.length){grid.innerHTML='<p style="color:#64748b;font-size:13px;grid-column:span 2">No routines for today. Add one or import a template!</p>';return;}
  routines.forEach((r,idx)=>{
    const isDone=done.includes(r.id);
    const card=document.createElement('div');
    card.className='glass p-6 rounded-[2.5rem] border transition-all flex justify-between items-center';
    card.style.cssText=`animation:fadeIn 0.4s ease ${idx*60}ms both;${isDone?'opacity:0.45':''}`;
    card.innerHTML=`
      <div style="display:flex;align-items:center;gap:16px">
        <div style="font-size:30px">${r.icon}</div>
        <div><div style="font-weight:900;font-size:17px">${r.name}</div><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em">${r.time}</div></div>
      </div>
      <button onclick="toggleRoutine('${r.id}')" style="width:48px;height:48px;border-radius:14px;border:none;cursor:pointer;font-size:20px;transition:all 0.2s;background:${isDone?'#10b981':'rgba(255,255,255,0.06)'}">
        ${isDone?'✓':'○'}
      </button>`;
    grid.appendChild(card);
  });
}

/* ============================================================
   GLOBAL HANDLERS
============================================================ */
window.toggleRoutine = (id) => {
  const k=new Date().toISOString().slice(0,10);
  if(!state.history[k]) state.history[k]=[];
  const i=state.history[k].indexOf(id);
  if(i>=0){state.history[k].splice(i,1);}
  else{
    state.history[k].push(id); state.totalDone++;
    if(typeof confetti==='function') confetti({particleCount:70,spread:60,origin:{y:0.8},colors:['#4f46e5','#7c3aed','#10b981']});
    toast('✅ Routine completed!');
  }
  calcStreaks(); save();
};

window.setGoal=(goal)=>{
  if(!TEMPLATES[goal]){toast('Template not found.','error');return;}
  state.user.goal=goal; state.user.onboarding=true;
  state.routines=JSON.parse(JSON.stringify(TEMPLATES[goal]));
  const o=document.getElementById('onboarding-overlay'); if(o) o.style.display='none';
  save(); toast('🚀 Pack loaded! Routines are ready.');
};

window.nextStep=(step)=>{
  document.querySelectorAll('.onboard-step').forEach(s=>s.classList.add('hidden'));
  const el=document.getElementById('step-'+step); if(el) el.classList.remove('hidden');
};

window.logout=()=>{ if(confirm('Logout and clear all data?')){localStorage.removeItem(LS_KEY);window.location.reload();} };

window.logMood=(level)=>{
  state.moods[new Date().toISOString().slice(0,10)]=level; save();
  toast({1:'💙 Tough day noted.',2:'😐 Okay day noted.',3:'😊 Great mood!',4:'🔥 On fire!'}[level]||'Mood saved!');
};

window.openModal=()=>{
  const m=document.getElementById('add-routine-modal');
  if(m){m.classList.remove('hidden');requestAnimationFrame(()=>requestAnimationFrame(()=>m.style.opacity='1'));}
};
window.closeModal=()=>{
  const m=document.getElementById('add-routine-modal');
  if(m){m.style.opacity='0';setTimeout(()=>m.classList.add('hidden'),300);}
};

function initAddRoutineForm() {
  const form=document.getElementById('form-add-routine'); if(!form) return;
  form.addEventListener('submit',(e)=>{
    e.preventDefault();
    const name=document.getElementById('r-name').value.trim();
    const time=document.getElementById('r-time').value;
    const icon=document.getElementById('r-icon').value.trim()||'⭐';
    const category=document.getElementById('r-category').value;
    const days=[...document.querySelectorAll('.r-day:checked')].map(cb=>parseInt(cb.value));
    if(!name||!time||!days.length){toast('Fill all fields & pick at least one day.','error');return;}
    state.routines.push({id:'r_'+Date.now(),name,time,icon,category,days});
    closeModal(); form.reset(); save(); toast('✅ Routine added!');
  });
}

/* ============================================================
   FOCUS TIMER
============================================================ */
let timerInterval=null,timerRunning=false,timerSeconds=25*60;
function fmtTimer(s){return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

function initTimer() {
  safeSet('timer-time','textContent',fmtTimer(timerSeconds));
  document.querySelectorAll('.preset-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      clearInterval(timerInterval);timerRunning=false;
      timerSeconds=parseInt(btn.dataset.mins)*60;
      safeSet('timer-time','textContent',fmtTimer(timerSeconds));
      const sb=document.getElementById('timer-start'); if(sb) sb.textContent='▶';
      document.querySelectorAll('.preset-btn').forEach(b=>b.style.outline='');
      btn.style.outline='2px solid #6366f1';
    });
  });
  const startBtn=document.getElementById('timer-start');
  if(startBtn){
    startBtn.textContent='▶';
    startBtn.addEventListener('click',()=>{
      if(timerRunning){clearInterval(timerInterval);timerRunning=false;startBtn.textContent='▶';}
      else{
        timerRunning=true;startBtn.textContent='⏸';
        timerInterval=setInterval(()=>{
          timerSeconds--;safeSet('timer-time','textContent',fmtTimer(timerSeconds));
          if(timerSeconds<=0){
            clearInterval(timerInterval);timerRunning=false;startBtn.textContent='▶';
            toast('🎉 Focus session complete!');
            try{createAlarmSound();}catch(e){}
            if(typeof confetti==='function') confetti({particleCount:120,spread:80});
          }
        },1000);
      }
    });
  }
  const resetBtn=document.getElementById('timer-reset');
  if(resetBtn) resetBtn.addEventListener('click',()=>{
    clearInterval(timerInterval);timerRunning=false;timerSeconds=25*60;
    safeSet('timer-time','textContent',fmtTimer(timerSeconds));
    const sb=document.getElementById('timer-start');if(sb) sb.textContent='▶';
  });
}

/* ============================================================
   ANALYTICS
============================================================ */
function renderAnalytics() {
  const heatmap=document.getElementById('streak-heatmap');
  if(heatmap){
    heatmap.innerHTML=''; const now=new Date();
    for(let i=365;i>=0;i--){
      const d=new Date(now);d.setDate(d.getDate()-i);
      const k=d.toISOString().slice(0,10);
      const cell=document.createElement('div');
      cell.className='heatmap-cell';cell.title=k;
      const c=(state.history[k]||[]).length;
      if(c>0) cell.setAttribute('data-level',Math.min(c,4));
      heatmap.appendChild(cell);
    }
  }
  const badges=document.getElementById('badges-grid');
  if(badges){
    badges.innerHTML='';
    [{id:'first-ten',icon:'🌱',name:'Getting Started',hint:'Complete 10 routines'},
     {id:'7-day',icon:'🔥',name:'7-Day Warrior',hint:'7-day streak'},
     {id:'30-day',icon:'⚡',name:'30-Day Legend',hint:'30-day streak'},
     {id:'centurion',icon:'💯',name:'100 Club',hint:'100 routines done'}
    ].forEach(b=>{
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

/* ============================================================
   MY ROUTINES
============================================================ */
function renderRoutinesList() {
  const grid=document.getElementById('full-routines-list'); if(!grid) return;
  grid.innerHTML='';
  if(!state.routines.length){grid.innerHTML='<p style="color:#64748b;grid-column:span 3;text-align:center;padding:48px 0">No routines yet. Add one or import a template!</p>';return;}
  state.routines.forEach(r=>{
    const card=document.createElement('div');
    card.className='glass p-6 rounded-[2.5rem] border border-white/5 transition-all';
    card.innerHTML=`<div style="font-size:36px;margin-bottom:14px">${r.icon}</div><div style="font-weight:900;font-size:19px;margin-bottom:4px">${r.name}</div><div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">${r.time} · ${r.category}</div><div style="margin-top:20px"><button onclick="deleteRoutine('${r.id}')" style="background:rgba(239,68,68,0.1);color:#f87171;border:none;padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px">🗑 Delete</button></div>`;
    grid.appendChild(card);
  });
}
window.deleteRoutine=(id)=>{
  if(!confirm('Delete this routine?')) return;
  state.routines=state.routines.filter(r=>r.id!==id);
  save(); renderRoutinesList(); toast('Routine deleted.','error');
};

/* ============================================================
   CALENDAR
============================================================ */
function renderCalendar() {
  const body=document.getElementById('full-calendar-body'); if(!body) return;
  const now=new Date(),year=now.getFullYear(),month=now.getMonth();
  const title=document.getElementById('calendar-month-title');
  if(title) title.textContent=now.toLocaleDateString([],{month:'long',year:'numeric'});
  body.innerHTML='';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>{
    const h=document.createElement('div');
    h.style.cssText='font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:center;padding:8px 0';
    h.textContent=d;body.appendChild(h);
  });
  const firstDay=new Date(year,month,1).getDay();
  const totalDays=new Date(year,month+1,0).getDate();
  for(let i=0;i<firstDay;i++) body.appendChild(document.createElement('div'));
  for(let day=1;day<=totalDays;day++){
    const k=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const c=(state.history[k]||[]).length;
    const isToday=day===now.getDate();
    const cell=document.createElement('div');
    cell.style.cssText=`border-radius:14px;padding:8px 4px;text-align:center;font-size:13px;font-weight:700;transition:all 0.2s;${isToday?'box-shadow:0 0 0 2px #6366f1;background:rgba(99,102,241,0.2)':''}${c>0?';background:rgba(16,185,129,0.2);color:#34d399':';color:#94a3b8'}`;
    cell.innerHTML=`<div>${day}</div>${c>0?`<div style="font-size:8px;margin-top:2px">${c}✓</div>`:''}`;
    body.appendChild(cell);
  }
}

/* ============================================================
   MAIN INIT
============================================================ */
window.addEventListener('DOMContentLoaded',()=>{
  try{const d=localStorage.getItem(LS_KEY);if(d){const parsed=JSON.parse(d);Object.assign(state,parsed);if(!state.settings) state.settings={notificationsEnabled:false,bgType:'default',bgValue:'',bgOverlay:0.6};}}
  catch(e){localStorage.removeItem(LS_KEY);}

  // Inject global styles
  const style=document.createElement('style');
  style.textContent=`
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideInRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes alarmPop{from{opacity:0;transform:translateX(-50%) scale(0.85)}to{opacity:1;transform:translateX(-50%) scale(1)}}
    @keyframes ringBell{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
    @media(max-width:1023px){.sidebar{transform:translateX(-100%);transition:transform 0.3s ease}.sidebar.open{transform:translateX(0)}}
    #add-routine-modal{opacity:0;transition:opacity 0.3s ease}
    #install-banner{animation:slideUp 0.4s cubic-bezier(.22,1,.36,1) both}
    .notif-pulse{animation:pulse 2s ease infinite}
  `;
  document.head.appendChild(style);

  applyBackground();
  startClock();
  initNavigation();
  initMobileToggle();
  initTimer();
  initAddRoutineForm();
  initPWA();
  initBgSettings();

  if(state.settings.notificationsEnabled && Notification.permission==='granted') startNotificationChecker();

  // Settings page notification button
  const notifBtn=document.getElementById('notif-toggle-btn');
  if(notifBtn) notifBtn.onclick=()=>{
    if(state.settings.notificationsEnabled) disableNotifications();
    else requestNotificationPermission();
  };

  // Auth
  const auth=document.getElementById('auth-overlay');
  const loginForm=document.getElementById('form-signin');
  if(loginForm){
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      
      if (!email || !pass) return;
      
      const submitBtn = document.getElementById('auth-submit-btn');
      if(submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin">🌀</span> Processing...';
      }

      if (authMode === 'login') {
        const loaded = await loadCloud(email);
        if (loaded) {
          toast(`Welcome back! Data synced.`, 'success');
        } else {
          // If login fails (no cloud data), we still let them in but notify
          state.user.email = email;
          toast('Logged in (Local mode)', 'warn');
        }
      } else {
        // Signup Mode
        state.user.email = email;
        await syncCloud();
        toast('Account created! Data will sync to cloud.', 'success');
      }

      if(auth){
        auth.style.opacity='0';
        auth.style.transition='opacity 0.5s';
        setTimeout(()=>{
          auth.classList.add('hidden');
          if(!state.user.onboarding){
            const ob=document.getElementById('onboarding-overlay');
            if(ob) ob.style.display='flex';
          }
          renderAll();
        },500);
      }
    });
  }
  renderAll();
  updateNotifUI();
  updateInstallBtn(false);
});

function renderAll(){renderDashboard();if(window.lucide)lucide.createIcons();}
function save(doSync = true){
  localStorage.setItem(LS_KEY,JSON.stringify(state));
  renderAll();
  if(doSync) syncCloud();
}

window.logout = () => {
  if(confirm('Sign out of RoutineOS? (Your data is safe in the cloud)')) {
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  }
};

window.toggleAuthMode = () => {
  authMode = (authMode === 'login') ? 'signup' : 'login';
  const title = document.getElementById('auth-title') || { textContent: '' };
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const toggleMsg = document.getElementById('auth-toggle-msg');
  
  if (authMode === 'signup') {
    if(title) title.textContent = 'Create Account';
    if(submitBtn) submitBtn.innerHTML = 'Start My Journey <i data-lucide="sparkles"></i>';
    if(toggleBtn) toggleBtn.textContent = 'Back to Login';
    if(toggleMsg) toggleMsg.textContent = 'Already have an account?';
  } else {
    if(title) title.textContent = 'RoutineOS';
    if(submitBtn) submitBtn.innerHTML = 'Unlock My Day <i data-lucide="arrow-right"></i>';
    if(toggleBtn) toggleBtn.textContent = 'Create New Account';
    if(toggleMsg) toggleMsg.textContent = "Don't have an account?";
  }
  if(window.lucide) lucide.createIcons();
};

// Update existing Login Form Handler in DOMContentLoaded
// (I will add a second replace for the login logic specifically)
