import { toast } from './utils.js';
import { state, saveState } from './state.js';

const publicVapidKey = 'BAhHvsSqeYPU3FBqSCn0lfMNn_yeBpWBTzbb3HYLE8Pd-zld_PT7ypy5dWf72KbBgo6t6hsNcDf2LhLlEI37PrA';

export function initAuth(onSuccess) {
  const overlay = document.getElementById('auth-overlay');
  if (localStorage.getItem('routineOS_auth') === 'true') {
    overlay.classList.remove('active');
  }

  // Forms switching
  document.querySelectorAll('.auth-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
      document.getElementById(link.dataset.target).style.display = 'block';
    });
  });

  // Login
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
      
      if (!res.ok) return toast(data.error || 'Login failed', 'error');
      
      localStorage.setItem('routineOS_auth', 'true');
      localStorage.setItem('routineOS_email', email);
      
      if (data.routines) {
        state.routines = data.routines;
      }

      overlay.classList.remove('active');
      toast('Welcome back!', 'success');
      subscribeToPush();
      if (onSuccess) onSuccess();
    } catch(err) {
      toast('Server unreachable', 'error');
    }
  });

  // Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.clear();
      overlay.classList.add('active');
      toast('Logged out successfully', 'info');
    });
  }
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  
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
    console.error('Push setup failed:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}
