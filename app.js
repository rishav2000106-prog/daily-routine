/* ===== ROUTINE OS 2026 — FULL FEATURED ===== */

const LS_KEY = 'routineOS_master';
const API_URL = 'https://daily-routine-lfw9.onrender.com';
const INBUILT_GEMINI_KEY = ''; // <-- PUT YOUR GOOGLE AI STUDIO KEY HERE
let authMode = 'login'; // 'login' or 'signup'

let state = {
  user: { email: '', password: '', name: 'Rishav', goal: 'minimal', onboarding: false },
  routines: [], history: {}, streak: 0, bestStreak: 0, totalDone: 0, moods: {}, badges: [],
  settings: { notificationsEnabled: false, bgType: 'default', bgValue: '', bgOverlay: 0.6 },
  notes: {},
  health: {},
  period: { dates: [], cycleLength: 28, periodLength: 5 }
};

const TEMPLATES = {
  student: [
    { id: 's1', name: 'Morning Review', time: '07:30', icon: '📚', category: 'morning',   days: [1,2,3,4,5], reminder: true },
    { id: 's2', name: 'Lecture Block',  time: '10:00', icon: '🎓', category: 'afternoon', days: [1,2,3,4,5], reminder: true },
    { id: 's3', name: 'Deep Work',      time: '14:00', icon: '💻', category: 'afternoon', days: [1,2,3,4,5], reminder: true }
  ],
  ceo: [
    { id: 'c1', name: 'Strategic Planning', time: '08:30', icon: '🧠', category: 'morning',   days: [1,2,3,4,5], reminder: true },
    { id: 'c2', name: 'High-Value Sync',    time: '11:00', icon: '🤝', category: 'morning',   days: [1,2,3,4,5], reminder: true },
    { id: 'c3', name: 'Audit & Review',     time: '16:30', icon: '⚖️', category: 'afternoon', days: [1,2,3,4,5], reminder: true }
  ],
  fitness: [
    { id: 'f1', name: 'Morning Run',    time: '06:30', icon: '🏃', category: 'morning', days: [1,2,3,4,5,6,0], reminder: true },
    { id: 'f2', name: 'Strength Train', time: '09:00', icon: '💪', category: 'morning', days: [1,3,5], reminder: true },
    { id: 'f3', name: 'Nutrition Prep', time: '18:00', icon: '🥗', category: 'evening', days: [1,2,3,4,5,6,0], reminder: true }
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
  if (!state.user.email || !state.user.password) return;
  try {
    const res = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: state.user.email, 
        password: state.user.password, 
        state,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
    if (!res.ok) throw new Error('Sync failed');
    console.log('☁️ Cloud Sync Success');
  } catch (e) {
    console.warn('☁️ Cloud Sync Offline', e);
  }
}

async function loadCloud(email, password) {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.state) {
        state = data.state;
        state.user.email = email;
        state.user.password = password; // Save for future syncs
        save(false);
        renderAll();
        return true;
      } else {
        // First time user logged in
        state.user.email = email;
        state.user.password = password;
        save(false);
        return true;
      }
    } else {
      const err = await res.json();
      toast(err.error || 'Login failed', 'error');
    }
  } catch (e) {
    console.error('Failed to load from cloud:', e);
    toast('Server connection failed', 'error');
  }
  return false;
}

async function signupCloud(email, password) {
  try {
    const res = await fetch(`${API_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      state.user.email = email;
      state.user.password = password;
      await syncCloud();
      return true;
    } else {
      const err = await res.json();
      toast(err.error || 'Signup failed', 'error');
    }
  } catch (e) {
    toast('Server connection failed', 'error');
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

const VAPID_PUBLIC_KEY = 'BAhHvsSqeYPU3FBqSCn0lfMNn_yeBpWBTzbb3HYLE8Pd-zld_PT7ypy5dWf72KbBgo6t6hsNcDf2LhLlEI37PrA';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function requestNotificationPermission() {
  if (!('Notification' in window)) { toast('This browser does not support notifications.','error'); return; }
  if (Notification.permission === 'granted') {
    enableNotifications();
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') enableNotifications();
      else toast('Notification permission denied.','warn');
    });
  } else {
    toast('Notifications blocked. Please enable in browser settings.','warn');
  }
}

async function enableNotifications() {
  state.settings.notificationsEnabled = true;
  save();
  startNotificationChecker();
  // Register push subscription with the server
  await subscribeToPush();
  toast('Notifications enabled! You will be alerted at routine time.','success');
  updateNotifUI();
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    // Send subscription to backend
    await fetch(`${API_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.user.email, subscription: subscription.toJSON() })
    });
    console.log('Push subscription registered with server');
  } catch (e) {
    console.error('Push subscription failed:', e);
  }
}

async function sendTestNotification() {
  if (!state.user.email) return toast('Please login first', 'error');
  try {
    toast('Sending test...', 'warn');
    const res = await fetch(`${API_URL}/test-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.user.email })
    });
    if (res.ok) toast('Test notification sent! Check your phone.', 'success');
    else {
      const err = await res.json();
      toast(err.error || 'Test failed. Enable notifications first.', 'error');
    }
  } catch (e) {
    toast('Server connection failed', 'error');
  }
}

function disableNotifications() {
  state.settings.notificationsEnabled = false;
  clearInterval(notifCheckInterval);
  save();
  toast('Notifications disabled.','warn');
  updateNotifUI();
}

function updateNotifUI() {
  const btn = document.getElementById('notif-toggle-btn');
  const badge = document.getElementById('notif-badge');
  const enabled = state.settings.notificationsEnabled;
  if (btn) {
    btn.textContent = enabled ? 'Notifications ON' : 'Enable Notifications';
    btn.style.background = enabled ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)';
    btn.style.color = enabled ? '#34d399' : '#818cf8';
    btn.style.borderColor = enabled ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)';
  }
  if (badge) badge.style.display = enabled ? 'block' : 'none';
}

function startNotificationChecker() {
  clearInterval(notifCheckInterval);
  notifCheckInterval = setInterval(checkRoutineAlarms, 30000);
  checkRoutineAlarms();
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
        if(view==='notes')     renderNotes();
        if(view==='health')    renderHealthDashboard();
        if(view==='period')    renderPeriodTracker();
        if(view==='ai')        renderAIDashboard();
        if(view==='settings')  { 
          updateNotifUI(); 
        }
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
  state.user.goal=goal; 
  state.user.onboarding=true;
  state.routines=JSON.parse(JSON.stringify(TEMPLATES[goal]));
  const o=document.getElementById('onboarding-overlay'); 
  if(o) o.style.display='none';
  save(); 
  toast('🚀 Pack loaded! Your routines are now permanently saved.', 'success');
};

window.nextStep=(step)=>{
  document.querySelectorAll('.onboard-step').forEach(s=>s.classList.add('hidden'));
  const el=document.getElementById('step-'+step); if(el) el.classList.remove('hidden');
};

// Consolidated logout moved to end of file

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
    const reminder=document.getElementById('r-reminder').checked;
    const days=[...document.querySelectorAll('.r-day:checked')].map(cb=>parseInt(cb.value));
    
    if(!name||!time||!days.length){toast('Fill all fields & pick at least one day.','error');return;}
    
    if(reminder && Notification.permission !== 'granted') {
      requestNotificationPermission();
    }

    state.routines.push({id:'r_'+Date.now(),name,time,icon,category,days,reminder});
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
    [{id:'first-ten',icon:'\ud83c\udf31',name:'Getting Started',hint:'Complete 10 routines'},
     {id:'7-day',icon:'\ud83d\udd25',name:'7-Day Warrior',hint:'7-day streak'},
     {id:'30-day',icon:'\u26a1',name:'30-Day Legend',hint:'30-day streak'},
     {id:'centurion',icon:'\ud83d\udcaf',name:'100 Club',hint:'100 routines done'}
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
  // Weekly Completion Chart
  renderWeeklyChart();
}

function renderWeeklyChart() {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const now = new Date();
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString([], { weekday: 'short' }));
    const scheduled = state.routines.filter(r => r.days.includes(d.getDay())).length;
    const completed = (state.history[k] || []).length;
    data.push(scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0);
  }
  // Destroy previous chart if exists
  if (window._weeklyChart) window._weeklyChart.destroy();
  window._weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Completion %',
        data,
        backgroundColor: data.map(v => v >= 80 ? 'rgba(16,185,129,0.6)' : v >= 50 ? 'rgba(99,102,241,0.6)' : 'rgba(239,68,68,0.4)'),
        borderRadius: 8,
        barThickness: 24
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { max: 100, ticks: { color: '#64748b', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#94a3b8', font: { weight: 700 } }, grid: { display: false } }
      }
    }
  });
}

/* ============================================================
   DAILY NOTES / JOURNAL
============================================================ */
function renderNotes() {
  const container = document.getElementById('notes-container');
  if (!container) return;
  const todayKey = new Date().toISOString().slice(0, 10);
  const currentNote = (state.notes && state.notes[todayKey]) || '';
  container.innerHTML = `
    <textarea id="daily-note" placeholder="Write your thoughts for today..." 
      style="width:100%;min-height:120px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:16px;color:#f8fafc;font-family:Inter,sans-serif;font-size:14px;resize:vertical;outline:none">${currentNote}</textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
      <span style="font-size:11px;color:#64748b">${currentNote.length} characters</span>
      <button onclick="saveNote()" style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.3);color:#818cf8;padding:8px 20px;border-radius:12px;font-weight:800;cursor:pointer;font-size:13px">Save Note</button>
    </div>`;
}

window.saveNote = () => {
  const textarea = document.getElementById('daily-note');
  if (!textarea) return;
  const todayKey = new Date().toISOString().slice(0, 10);
  if (!state.notes) state.notes = {};
  state.notes[todayKey] = textarea.value;
  save();
  toast('Note saved!');
};

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
  try{
    const d=localStorage.getItem(LS_KEY);
    if(d){
      const parsed=JSON.parse(d);
      Object.assign(state,parsed);
      if(!state.settings) state.settings={notificationsEnabled:false,bgType:'default',bgValue:'',bgOverlay:0.6};
      
      // Persistent Login: Instant hide if email exists
      if(state.user.email) {
        const auth = document.getElementById('auth-overlay');
        if(auth) auth.style.display = 'none'; // Instant hide for seamless mobile experience
        
        // Background Sync: Refresh data silently
        loadCloud(state.user.email, state.user.password).then(success => {
          if(!success && state.user.email) {
            // Only show auth again if the cloud load failed (e.g. invalid password)
            if(auth) auth.style.display = 'flex';
          } else {
            renderAll();
          }
        });
      }
    }
  }
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

  if(state.settings.notificationsEnabled && Notification.permission==='granted') {
    startNotificationChecker();
    subscribeToPush(); // Re-register push subscription on every load
  }

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
        const success = await loadCloud(email, pass);
        if (success) {
          toast(`Welcome back! Data synced.`, 'success');
          finishAuth();
        } else {
          if(submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Try Again <i data-lucide="rotate-ccw"></i>';
          }
        }
      } else {
        // Signup Mode
        const success = await signupCloud(email, pass);
        if (success) {
          toast('Account created! Data will sync to cloud.', 'success');
          finishAuth();
        } else {
          if(submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Try Again <i data-lucide="rotate-ccw"></i>';
          }
        }
      }

      function finishAuth() {
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
      }
    });
  }
  renderAll();
  updateNotifUI();
  updateInstallBtn(false);
});

function renderAll(){
  renderDashboard();
  applyBackground(); // Ensure background is applied whenever state changes
  if(window.lucide) lucide.createIcons();
}
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

/* ============================================================
   HEALTH TRACKER MODULE (Water + Weight only)
============================================================ */
function getTodayHealth() {
  const k = new Date().toISOString().slice(0, 10);
  if (!state.health) state.health = {};
  if (!state.health[k]) state.health[k] = { water: 0, weight: 0 };
  return state.health[k];
}
window.addWater = () => { const t = getTodayHealth(); t.water = (t.water||0)+1; save(); renderHealthDashboard(); toast('Water logged!','success'); };
window.removeWater = () => { const t = getTodayHealth(); if(t.water>0) t.water--; save(); renderHealthDashboard(); };
window.logWeight = () => {
  const input = document.getElementById('weight-input'); if(!input) return;
  const w = parseFloat(input.value);
  if(isNaN(w)||w<20||w>300){toast('Enter valid weight','error');return;}
  getTodayHealth().weight = w; save(); renderHealthDashboard(); toast('Weight logged!','success');
};

function renderHealthDashboard() {
  const c = document.getElementById('health-dashboard'); if(!c) return;
  const t = getTodayHealth(), wg = 8;
  c.innerHTML = `
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:16px;font-weight:900;margin-bottom:16px">\ud83d\udca7 Water Intake</h3>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        <button onclick="removeWater()" style="width:40px;height:40px;border-radius:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;font-size:20px;font-weight:900;cursor:pointer">-</button>
        <div style="flex:1;text-align:center"><div style="font-size:48px;font-weight:900;line-height:1">${t.water}</div><div style="font-size:11px;color:#64748b;font-weight:700">/ ${wg} glasses</div></div>
        <button onclick="addWater()" style="width:40px;height:40px;border-radius:12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);color:#60a5fa;font-size:20px;font-weight:900;cursor:pointer">+</button>
      </div>
      <div style="display:flex;gap:4px;justify-content:center">${Array.from({length:wg},(_,i)=>`<div style="width:28px;height:36px;border-radius:8px;border:1px solid ${i<t.water?'rgba(59,130,246,0.5)':'rgba(255,255,255,0.1)'};background:${i<t.water?'rgba(59,130,246,0.3)':'rgba(255,255,255,0.02)'};transition:all 0.3s"></div>`).join('')}</div>
    </div>
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:16px;font-weight:900;margin-bottom:16px">\u2696\ufe0f Weight</h3>
      <div style="text-align:center;margin-bottom:16px"><div style="font-size:48px;font-weight:900;line-height:1">${t.weight||'-'}</div><div style="font-size:11px;color:#64748b;font-weight:700">kg today</div></div>
      <div style="display:flex;gap:8px"><input type="number" id="weight-input" min="20" max="300" step="0.1" placeholder="Weight (kg)" value="${t.weight||''}" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;font-weight:700"><button onclick="logWeight()" style="background:rgba(234,179,8,0.2);border:1px solid rgba(234,179,8,0.3);color:#fbbf24;padding:10px 18px;border-radius:12px;font-weight:800;cursor:pointer;font-size:13px">Log</button></div>
    </div>
    <div class="glass p-6 rounded-[2rem] border border-white/5" style="grid-column:1/-1"><h3 style="font-size:16px;font-weight:900;margin-bottom:16px">\ud83d\udcca 7-Day Water</h3><div style="height:180px"><canvas id="health-trend-chart"></canvas></div></div>`;
  renderHealthTrendChart();
}
function renderHealthTrendChart() {
  const cv = document.getElementById('health-trend-chart'); if(!cv) return;
  const now=new Date(),lb=[],dt=[];
  for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);lb.push(d.toLocaleDateString([],{weekday:'short'}));dt.push(((state.health||{})[d.toISOString().slice(0,10)]||{}).water||0);}
  if(window._healthChart) window._healthChart.destroy();
  window._healthChart=new Chart(cv.getContext('2d'),{type:'bar',data:{labels:lb,datasets:[{data:dt,backgroundColor:dt.map(v=>v>=8?'rgba(16,185,129,0.6)':v>=4?'rgba(59,130,246,0.5)':'rgba(239,68,68,0.4)'),borderRadius:8,barThickness:28}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{max:12,ticks:{color:'#64748b'},grid:{color:'rgba(255,255,255,0.05)'}},x:{ticks:{color:'#94a3b8',font:{weight:700}},grid:{display:false}}}}});
}




    DeviceMotionEvent.requestPermission().then(response => {
      if (response === 'granted') initAccelerometer();
      else toast('Motion sensor permission denied', 'error');
    }).catch(() => toast('Motion sensor unavailable', 'error'));
  } else {
    initAccelerometer();
  }
}

function initAccelerometer() {
  stepTrackerActive = true;
  const today = getTodayHealth();
  stepCount = today.steps || 0;

  window.addEventListener('devicemotion', (e) => {
    if (stepCooldown) return;
    const a = e.accelerationIncludingGravity;
    if (!a) return;

    const dx = Math.abs(a.x - lastAccel.x);
    const dy = Math.abs(a.y - lastAccel.y);
    const dz = Math.abs(a.z - lastAccel.z);
    const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);

    lastAccel = { x: a.x, y: a.y, z: a.z };

    if (magnitude > stepThreshold) {
      stepCount++;
      const today = getTodayHealth();
      today.steps = stepCount;
      // Update UI live
      const el = document.getElementById('health-steps-count');
      if (el) el.textContent = stepCount.toLocaleString();
      const cal = document.getElementById('health-calories');
      if (cal) cal.textContent = Math.round(stepCount * 0.04);
      // Debounce saves
      stepCooldown = true;
      setTimeout(() => { stepCooldown = false; }, 300);
      // Save every 50 steps
      if (stepCount % 50 === 0) save(true);
    }
  });

  toast('Step counter active! Keep your phone with you.', 'success');
}

window.addWater = () => {
  const today = getTodayHealth();
  today.water = (today.water || 0) + 1;
  save();
  renderHealthDashboard();
  toast('Water logged! Stay hydrated.', 'success');
};

window.removeWater = () => {
  const today = getTodayHealth();
  if (today.water > 0) today.water--;
  save();
  renderHealthDashboard();
};

window.logSleep = () => {
  const input = document.getElementById('sleep-input');
  if (!input) return;
  const hours = parseFloat(input.value);
  if (isNaN(hours) || hours < 0 || hours > 24) { toast('Enter valid hours (0-24)', 'error'); return; }
  const today = getTodayHealth();
  today.sleep = hours;
  save();
  renderHealthDashboard();
  toast('Sleep logged!', 'success');
};

window.logWeight = () => {
  const input = document.getElementById('weight-input');
  if (!input) return;
  const weight = parseFloat(input.value);
  if (isNaN(weight) || weight < 20 || weight > 300) { toast('Enter valid weight (20-300 kg)', 'error'); return; }
  const today = getTodayHealth();
  today.weight = weight;
  save();
  renderHealthDashboard();
  toast('Weight logged!', 'success');
};

function renderHealthDashboard() {
  const container = document.getElementById('health-dashboard');
  if (!container) return;
  const today = getTodayHealth();
  const todayKey = new Date().toISOString().slice(0, 10);
  const stepGoal = 8000;
  const waterGoal = 8;
  const sleepGoal = 8;
  const stepPct = Math.min(100, Math.round((today.steps / stepGoal) * 100));
  const waterPct = Math.min(100, Math.round((today.water / waterGoal) * 100));
  const sleepPct = today.sleep ? Math.min(100, Math.round((today.sleep / sleepGoal) * 100)) : 0;
  const calories = Math.round(today.steps * 0.04);
  const distance = (today.steps * 0.000762).toFixed(2);

  container.innerHTML = `
    <!-- Step Counter -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:900;display:flex;align-items:center;gap:8px">\ud83d\udeb6 Steps</h3>
        <button onclick="startStepCounter()" id="step-toggle-btn" style="background:${stepTrackerActive ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'};border:1px solid ${stepTrackerActive ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)'};color:${stepTrackerActive ? '#34d399' : '#818cf8'};padding:6px 14px;border-radius:10px;font-weight:800;cursor:pointer;font-size:11px">${stepTrackerActive ? 'TRACKING' : 'START'}</button>
      </div>
      <div style="font-size:48px;font-weight:900;line-height:1" id="health-steps-count">${today.steps.toLocaleString()}</div>
      <div style="font-size:11px;color:#64748b;font-weight:700;margin-top:4px">/ ${stepGoal.toLocaleString()} goal</div>
      <div style="width:100%;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;margin-top:12px;overflow:hidden">
        <div style="height:100%;width:${stepPct}%;background:linear-gradient(90deg,#6366f1,#10b981);border-radius:4px;transition:width 0.5s"></div>
      </div>
      <div style="display:flex;gap:16px;margin-top:16px">
        <div style="flex:1;text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:12px">
          <div style="font-size:18px;font-weight:900" id="health-calories">${calories}</div>
          <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Calories</div>
        </div>
        <div style="flex:1;text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:12px">
          <div style="font-size:18px;font-weight:900">${distance}</div>
          <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">km</div>
        </div>
        <div style="flex:1;text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:12px">
          <div style="font-size:18px;font-weight:900">${Math.round(today.steps * 0.04 / 7.7)}</div>
          <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">Minutes</div>
        </div>
      </div>
    </div>

    <!-- Water Intake -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:16px;font-weight:900;margin-bottom:16px;display:flex;align-items:center;gap:8px">\ud83d\udca7 Water Intake</h3>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        <button onclick="removeWater()" style="width:36px;height:36px;border-radius:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;font-size:18px;font-weight:900;cursor:pointer">-</button>
        <div style="flex:1;text-align:center">
          <div style="font-size:42px;font-weight:900;line-height:1">${today.water}</div>
          <div style="font-size:11px;color:#64748b;font-weight:700">/ ${waterGoal} glasses</div>
        </div>
        <button onclick="addWater()" style="width:36px;height:36px;border-radius:12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);color:#60a5fa;font-size:18px;font-weight:900;cursor:pointer">+</button>
      </div>
      <div style="display:flex;gap:4px;justify-content:center">
        ${Array.from({length: waterGoal}, (_, i) => `<div style="width:24px;height:32px;border-radius:6px;border:1px solid ${i < today.water ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'};background:${i < today.water ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.02)'};transition:all 0.3s"></div>`).join('')}
      </div>
    </div>

    <!-- Sleep -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:16px;font-weight:900;margin-bottom:16px;display:flex;align-items:center;gap:8px">\ud83d\udca4 Sleep</h3>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:42px;font-weight:900;line-height:1;color:${today.sleep >= 7 ? '#34d399' : today.sleep >= 5 ? '#fbbf24' : '#f87171'}">${today.sleep || '-'}</div>
        <div style="font-size:11px;color:#64748b;font-weight:700">hours last night</div>
      </div>
      <div style="display:flex;gap:8px">
        <input type="number" id="sleep-input" min="0" max="24" step="0.5" placeholder="Hours" value="${today.sleep || ''}" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;font-weight:700">
        <button onclick="logSleep()" style="background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.3);color:#a78bfa;padding:10px 18px;border-radius:12px;font-weight:800;cursor:pointer;font-size:13px">Log</button>
      </div>
    </div>

    <!-- Weight -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:16px;font-weight:900;margin-bottom:16px;display:flex;align-items:center;gap:8px">\u2696\ufe0f Weight</h3>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:42px;font-weight:900;line-height:1">${today.weight || '-'}</div>
        <div style="font-size:11px;color:#64748b;font-weight:700">kg today</div>
      </div>
      <div style="display:flex;gap:8px">
        <input type="number" id="weight-input" min="20" max="300" step="0.1" placeholder="Weight (kg)" value="${today.weight || ''}" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;font-weight:700">
        <button onclick="logWeight()" style="background:rgba(234,179,8,0.2);border:1px solid rgba(234,179,8,0.3);color:#fbbf24;padding:10px 18px;border-radius:12px;font-weight:800;cursor:pointer;font-size:13px">Log</button>
      </div>
    </div>

    <!-- 7-Day Steps Chart -->
    <div class="glass p-6 rounded-[2rem] border border-white/5" style="grid-column: span 2">
      <h3 style="font-size:16px;font-weight:900;margin-bottom:16px;display:flex;align-items:center;gap:8px">\ud83d\udcca 7-Day Health Trends</h3>
      <div style="height:200px"><canvas id="health-trend-chart"></canvas></div>
    </div>
  `;

  // Render 7-day trend chart
  renderHealthTrendChart();
}

function renderHealthTrendChart() {
  const canvas = document.getElementById('health-trend-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const now = new Date();
  const labels = [];
  const stepsData = [];
  const waterData = [];
  const sleepData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString([], { weekday: 'short' }));
    const h = (state.health && state.health[k]) || { steps: 0, water: 0, sleep: 0 };
    stepsData.push(Math.round(h.steps / 100)); // Scale down for chart
    waterData.push(h.water || 0);
    sleepData.push(h.sleep || 0);
  }

  if (window._healthChart) window._healthChart.destroy();
  window._healthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Steps (x100)', data: stepsData, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#6366f1' },
        { label: 'Water', data: waterData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#3b82f6' },
        { label: 'Sleep (hrs)', data: sleepData, borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#a78bfa' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10, weight: 700 } } } },
      scales: {
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#94a3b8', font: { weight: 700 } }, grid: { display: false } }
      }
    }
  });
}

/* ============================================================
   PERIOD TRACKER MODULE
============================================================ */
function getPeriodData() {
  if (!state.period) state.period = { dates: [], cycleLength: 28, periodLength: 5 };
  return state.period;
}

function calcCycleStats() {
  const p = getPeriodData();
  const dates = p.dates.map(d => new Date(d)).sort((a, b) => a - b);
  if (dates.length < 2) return { avg: p.cycleLength, cycles: [], irregular: false, gaps: [] };

  const cycles = [];
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    cycles.push(diff);
  }
  const avg = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
  const variance = cycles.length > 1 ? Math.round(Math.sqrt(cycles.map(c => (c - avg) ** 2).reduce((a, b) => a + b, 0) / cycles.length)) : 0;

  const irregular = variance > 7 || cycles.some(c => c > 35 || c < 21);
  const gaps = cycles.filter(c => c > 45);

  return { avg, cycles, irregular, variance, gaps, lastDate: dates[dates.length - 1] };
}

function getCurrentPhase() {
  const p = getPeriodData();
  if (!p.dates.length) return { phase: 'unknown', day: 0, color: '#64748b' };

  const lastDate = new Date(p.dates.sort().reverse()[0]);
  const today = new Date();
  const daysSince = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));
  const cycleLen = p.cycleLength || 28;
  const periodLen = p.periodLength || 5;
  const dayInCycle = ((daysSince % cycleLen) + cycleLen) % cycleLen;

  if (dayInCycle < periodLen) return { phase: 'Menstrual', day: dayInCycle + 1, color: '#ef4444', emoji: '\ud83c\udf39', tip: 'Rest, light yoga, warm foods. Stay hydrated.' };
  if (dayInCycle < 13) return { phase: 'Follicular', day: dayInCycle + 1, color: '#10b981', emoji: '\ud83c\udf3f', tip: 'High energy! Great for intense workouts and new projects.' };
  if (dayInCycle < 16) return { phase: 'Ovulation', day: dayInCycle + 1, color: '#f59e0b', emoji: '\u2728', tip: 'Peak energy and confidence. Best time for social activities.' };
  return { phase: 'Luteal', day: dayInCycle + 1, color: '#8b5cf6', emoji: '\ud83c\udf19', tip: 'Winding down. Focus on self-care, magnesium-rich foods.' };
}

function getPCODIndicators() {
  const stats = calcCycleStats();
  const indicators = [];
  let riskLevel = 'low';

  if (stats.irregular) {
    indicators.push({ icon: '\u26a0\ufe0f', text: 'Irregular cycles detected', severity: 'warning' });
    riskLevel = 'medium';
  }
  if (stats.cycles.some(c => c > 35)) {
    indicators.push({ icon: '\ud83d\udcc5', text: `Long cycles (>35 days) found`, severity: 'warning' });
    riskLevel = 'medium';
  }
  if (stats.cycles.some(c => c < 21)) {
    indicators.push({ icon: '\u23f1\ufe0f', text: 'Very short cycles (<21 days)', severity: 'warning' });
    riskLevel = 'medium';
  }
  if (stats.gaps.length > 0) {
    indicators.push({ icon: '\ud83d\udea8', text: `Missed period(s) detected (${stats.gaps.length} gap >45 days)`, severity: 'danger' });
    riskLevel = 'high';
  }
  if (stats.variance > 10) {
    indicators.push({ icon: '\ud83d\udcc9', text: `High cycle variation (\u00b1${stats.variance} days)`, severity: 'danger' });
    riskLevel = 'high';
  }
  if (!indicators.length) {
    indicators.push({ icon: '\u2705', text: 'Cycles appear regular and healthy', severity: 'good' });
  }

  return { indicators, riskLevel };
}

function getNextPeriodDate() {
  const p = getPeriodData();
  if (!p.dates.length) return null;
  const lastDate = new Date(p.dates.sort().reverse()[0]);
  const next = new Date(lastDate);
  next.setDate(next.getDate() + (p.cycleLength || 28));
  return next;
}

window.addPeriodDate = () => {
  const input = document.getElementById('period-date-input');
  if (!input || !input.value) { toast('Please select a date', 'error'); return; }
  const p = getPeriodData();
  if (!p.dates.includes(input.value)) {
    p.dates.push(input.value);
    p.dates.sort();
    // Recalculate average cycle
    const stats = calcCycleStats();
    if (stats.avg) p.cycleLength = stats.avg;
    save();
    renderPeriodTracker();
    toast('Period date logged!', 'success');
  } else {
    toast('Date already logged', 'warn');
  }
};

window.removePeriodDate = (date) => {
  const p = getPeriodData();
  p.dates = p.dates.filter(d => d !== date);
  save();
  renderPeriodTracker();
  toast('Date removed');
};

function renderPeriodTracker() {
  const container = document.getElementById('period-dashboard');
  if (!container) return;
  const p = getPeriodData();
  const phase = getCurrentPhase();
  const stats = calcCycleStats();
  const pcod = getPCODIndicators();
  const nextDate = getNextPeriodDate();
  const daysUntilNext = nextDate ? Math.max(0, Math.round((nextDate - new Date()) / (1000 * 60 * 60 * 24))) : '?';

  const riskColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
  const riskLabels = { low: 'Low Risk', medium: 'Monitor', high: 'Consult Doctor' };

  container.innerHTML = `
    <!-- Current Phase -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:16px">Current Phase</h3>
      <div style="text-align:center">
        <div style="font-size:56px;margin-bottom:8px">${phase.emoji || '\ud83d\udcc5'}</div>
        <div style="font-size:28px;font-weight:900;color:${phase.color}">${phase.phase}</div>
        <div style="font-size:13px;color:#94a3b8;font-weight:700;margin-top:4px">Day ${phase.day} of cycle</div>
        <div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:14px;font-size:13px;color:#94a3b8;line-height:1.6">${phase.tip || 'Log your first period to start tracking.'}</div>
      </div>
    </div>

    <!-- Next Period & Stats -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:16px">Cycle Overview</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="text-align:center;padding:14px;background:rgba(255,255,255,0.03);border-radius:14px">
          <div style="font-size:28px;font-weight:900;color:#f472b6">${daysUntilNext}</div>
          <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">Days Until Next</div>
        </div>
        <div style="text-align:center;padding:14px;background:rgba(255,255,255,0.03);border-radius:14px">
          <div style="font-size:28px;font-weight:900">${stats.avg || p.cycleLength}</div>
          <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">Avg Cycle (days)</div>
        </div>
        <div style="text-align:center;padding:14px;background:rgba(255,255,255,0.03);border-radius:14px">
          <div style="font-size:28px;font-weight:900">${p.dates.length}</div>
          <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">Periods Logged</div>
        </div>
        <div style="text-align:center;padding:14px;background:rgba(255,255,255,0.03);border-radius:14px">
          <div style="font-size:28px;font-weight:900">${nextDate ? nextDate.toLocaleDateString([], {month:'short', day:'numeric'}) : '-'}</div>
          <div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase">Next Expected</div>
        </div>
      </div>
    </div>

    <!-- PCOD Indicators -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b">PCOD Analysis</h3>
        <span style="padding:4px 12px;border-radius:8px;font-size:11px;font-weight:800;background:${riskColors[pcod.riskLevel]}20;color:${riskColors[pcod.riskLevel]};border:1px solid ${riskColors[pcod.riskLevel]}40">${riskLabels[pcod.riskLevel]}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${pcod.indicators.map(ind => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.05)">
            <span style="font-size:18px">${ind.icon}</span>
            <span style="font-size:13px;font-weight:700;color:${ind.severity === 'good' ? '#34d399' : ind.severity === 'danger' ? '#f87171' : '#fbbf24'}">${ind.text}</span>
          </div>
        `).join('')}
      </div>
      ${pcod.riskLevel === 'high' ? '<div style="margin-top:12px;padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:12px;font-size:12px;color:#fca5a5;font-weight:700">\u26a0\ufe0f Please consult a gynecologist if you notice persistent irregularities.</div>' : ''}
    </div>

    <!-- Log Period -->
    <div class="glass p-6 rounded-[2rem] border border-white/5">
      <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:16px">Log Period Start</h3>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input type="date" id="period-date-input" value="${new Date().toISOString().slice(0,10)}" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;font-weight:700">
        <button onclick="addPeriodDate()" style="background:rgba(244,114,182,0.2);border:1px solid rgba(244,114,182,0.3);color:#f472b6;padding:10px 18px;border-radius:12px;font-weight:800;cursor:pointer;font-size:13px">+ Log</button>
      </div>
      <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px">Recent Dates:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${p.dates.slice(-10).reverse().map(d => `
          <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(244,114,182,0.1);border:1px solid rgba(244,114,182,0.2);border-radius:10px;font-size:12px;font-weight:700;color:#f9a8d4">
            ${new Date(d).toLocaleDateString([], {month:'short', day:'numeric'})}
            <button onclick="removePeriodDate('${d}')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:14px;padding:0">\u00d7</button>
          </span>
        `).join('')}
        ${p.dates.length === 0 ? '<span style="font-size:12px;color:#475569">No dates logged yet</span>' : ''}
      </div>
    </div>

    <!-- AI Recommendation for Period -->
    <div class="glass p-6 rounded-[2rem] border border-white/5 md:col-span-2">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b">\ud83e\udde0 AI Health Insights</h3>
        <button onclick="getAIRecommendation('period')" style="background:linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.3));border:1px solid rgba(168,85,247,0.4);color:#c4b5fd;padding:8px 16px;border-radius:10px;font-weight:800;cursor:pointer;font-size:12px">\u2728 Get AI Advice</button>
      </div>
      <div id="ai-period-result" style="font-size:13px;color:#94a3b8;line-height:1.8;white-space:pre-wrap">${getSmartRecommendation()}</div>
    </div>
  `;
}

/* ============================================================
   AI RECOMMENDATION ENGINE
============================================================ */
function getSmartRecommendation() {
  const phase = getCurrentPhase();
  const today = getTodayHealth();
  const pcod = getPCODIndicators();
  const tips = [];

  // Phase-based recommendations
  if (phase.phase === 'Menstrual') {
    tips.push('\ud83e\uddd8 Recommended: Light yoga, stretching, walking. Avoid intense workouts.');
    tips.push('\ud83c\udf5c Eat: Iron-rich foods (spinach, lentils), warm soups, dark chocolate.');
    tips.push('\ud83d\udca7 Hydration is extra important right now. Aim for 10+ glasses of water.');
  } else if (phase.phase === 'Follicular') {
    tips.push('\ud83c\udfcb\ufe0f Great time for: HIIT, running, strength training. Energy is rising!');
    tips.push('\ud83e\udd57 Eat: Fermented foods, lean proteins, fresh vegetables.');
    tips.push('\ud83d\udca1 Start new projects and creative work during this high-energy phase.');
  } else if (phase.phase === 'Ovulation') {
    tips.push('\ud83d\ude80 Peak performance! Best for: Group workouts, competitions, presentations.');
    tips.push('\ud83e\udd51 Eat: Anti-inflammatory foods, fiber-rich fruits, raw vegetables.');
    tips.push('\ud83d\udc65 Social energy is highest. Great time for networking and collaboration.');
  } else if (phase.phase === 'Luteal') {
    tips.push('\ud83c\udf19 Wind down: Pilates, swimming, moderate cardio. Listen to your body.');
    tips.push('\ud83e\udd5c Eat: Complex carbs, magnesium-rich foods (nuts, seeds, avocado).');
    tips.push('\ud83d\udcdd Focus on organizing, planning, and reflective journaling.');
  }

  // PCOD-specific
  if (pcod.riskLevel === 'high' || pcod.riskLevel === 'medium') {
    tips.push('\u26a0\ufe0f PCOD Alert: Consider 30 min daily exercise, reduce sugar intake, increase fiber.');
    tips.push('\ud83c\udf3f Try: Spearmint tea, cinnamon supplements, and stress-reduction techniques.');
  }

  // Health-based
  if (today.water < 4) tips.push('\ud83d\udca7 You\'re low on water today. Drink at least 4 more glasses!');

  return tips.join('\n\n') || 'Log your period dates and health data to get personalized recommendations.';
}

async function getAIRecommendation(context) {
  const resultEl = document.getElementById(context === 'period' ? 'ai-period-result' : 'ai-general-result');
  if (resultEl) resultEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span class="animate-spin" style="display:inline-block">\ud83e\udde0</span> Generating AI insights...</div>';

  const phase = getCurrentPhase();
  const stats = calcCycleStats();
  const pcod = getPCODIndicators();
  const today = getTodayHealth();
  const todayMood = state.moods[new Date().toISOString().slice(0, 10)];

  const prompt = `You are a women's health and wellness AI assistant integrated into a habit-tracking app called RoutineOS. Based on the user's current data, provide personalized, practical health recommendations in a friendly tone. Use emojis.

User Data:
- Primary Goal: ${state.aiGoal || 'General wellness and building a balanced daily routine'}
- Current menstrual phase: ${phase.phase} (Day ${phase.day})
- Average cycle length: ${stats.avg || 28} days
- Cycle regularity: ${stats.irregular ? 'IRREGULAR' : 'Regular'} (variance: ${stats.variance || 0} days)
- PCOD risk level: ${pcod.riskLevel}
- PCOD indicators: ${pcod.indicators.map(i => i.text).join(', ')}
- Today's water: ${today.water || 0} glasses
- Today's weight: ${today.weight || 'not logged'} kg
- Today's mood: ${todayMood ? ['Tough','Okay','Good','Great'][todayMood-1] : 'not logged'}
- Total periods logged: ${getPeriodData().dates.length}

Provide:
1. Activity recommendation for today based on cycle phase and their primary goal.
2. Nutrition advice for current phase to support their goal.
3. PCOD-related guidance if risk is medium/high.
4. Mental wellness tip based on mood and phase.
5. Daily plan/routine tip specifically tailored to their primary goal.

Keep it concise (under 300 words), warm, and actionable.`;

  try {
    if (INBUILT_GEMINI_KEY) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${INBUILT_GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (res.ok) {
        const data = await res.json();
        if (resultEl && data.candidates && data.candidates[0].content) {
          resultEl.textContent = data.candidates[0].content.parts[0].text;
          return;
        }
      }
    } else {
      // Try backend if no local key
      const res = await fetch(`${API_URL}/ai-recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        if (resultEl) {
          resultEl.textContent = data.text || 'No recommendation available.';
          return;
        }
      }
    }
  } catch (e) {
    console.error('AI error', e);
  }
  if (resultEl) resultEl.textContent = getSmartRecommendation();
}

window.saveAIGoal = () => {
  const input = document.getElementById('ai-goal-input');
  if (input) {
    state.aiGoal = input.value;
    save();
    toast('Goal saved!', 'success');
  }
};

/* ============================================================
   AI DASHBOARD
============================================================ */
function renderAIDashboard() {
  const container = document.getElementById('ai-dashboard');
  if (!container) return;
  const goalInput = document.getElementById('ai-goal-input');
  if (goalInput) goalInput.value = state.aiGoal || '';
  const phase = getCurrentPhase();
  const today = getTodayHealth();
  const todayMood = state.moods[new Date().toISOString().slice(0, 10)];
  const moodLabel = todayMood ? ['\ud83d\ude1e Tough','\ud83d\ude10 Okay','\ud83d\ude0a Good','\ud83d\udd25 Great'][todayMood-1] : 'Not logged';
  const completionToday = state.routines.filter(r => r.days.includes(new Date().getDay())).length;
  const doneToday = (state.history[new Date().toISOString().slice(0,10)] || []).length;
  const pct = completionToday ? Math.round((doneToday / completionToday) * 100) : 0;

  container.innerHTML = `
    <!-- Context Summary -->
    <div class="glass p-6 rounded-[2rem] border border-white/5 md:col-span-2">
      <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:16px">\ud83d\udcca Your Context Today</h3>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        <span style="padding:8px 14px;background:${phase.color}20;border:1px solid ${phase.color}40;border-radius:10px;font-size:12px;font-weight:800;color:${phase.color}">${phase.emoji || ''} ${phase.phase} Phase (Day ${phase.day})</span>
        <span style="padding:8px 14px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:10px;font-size:12px;font-weight:800;color:#60a5fa">\ud83d\udca7 ${today.water || 0} glasses</span>
        <span style="padding:8px 14px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.2);border-radius:10px;font-size:12px;font-weight:800;color:#fbbf24">\u2696\ufe0f ${today.weight || '-'} kg</span>
        <span style="padding:8px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:10px;font-size:12px;font-weight:800;color:#34d399">\u2705 ${pct}% routines done</span>
        <span style="padding:8px 14px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);border-radius:10px;font-size:12px;font-weight:800;color:#fbbf24">${moodLabel}</span>
      </div>
    </div>

    <!-- AI Recommendation -->
    <div class="glass p-6 rounded-[2rem] border border-white/5 md:col-span-2">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b">\ud83e\udde0 AI-Powered Recommendations</h3>
        <button onclick="getAIRecommendation('general')" style="background:linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.3));border:1px solid rgba(168,85,247,0.4);color:#c4b5fd;padding:8px 16px;border-radius:10px;font-weight:800;cursor:pointer;font-size:12px">\u2728 Generate with AI</button>
      </div>
      <div id="ai-general-result" style="font-size:13px;color:#94a3b8;line-height:1.8;white-space:pre-wrap">${getSmartRecommendation()}</div>
    </div>
  `;
}
