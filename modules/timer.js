import { formatTime, toast } from './utils.js';

export class FocusTimer {
  constructor() {
    this.timeLeft = 1500;
    this.timerId = null;
    this.mode = 'pomodoro';
    this.subMode = 'focus'; // focus, short, long
    this.settings = { focus: 25, short: 5, long: 15 };
    this.sessionsCompleted = 0;
    
    this.init();
  }

  init() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.mins);
        this.timeLeft = mins * 60;
        this.updateDisplay();
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active-preset'));
        btn.classList.add('active-preset');
      });
    });

    document.getElementById('timer-start').addEventListener('click', () => this.toggle());
    document.getElementById('timer-reset').addEventListener('click', () => this.reset());
    document.getElementById('timer-skip').addEventListener('click', () => this.skip());
  }

  toggle() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      document.getElementById('timer-play-icon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    } else {
      this.timerId = setInterval(() => this.tick(), 1000);
      document.getElementById('timer-play-icon').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    }
  }

  tick() {
    if (this.timeLeft > 0) {
      this.timeLeft--;
      this.updateDisplay();
    } else {
      this.complete();
    }
  }

  updateDisplay() {
    document.getElementById('timer-time').textContent = formatTime(this.timeLeft);
    const ring = document.getElementById('timer-ring-fill');
    const total = this.mode === 'pomodoro' ? this.settings[this.subMode] * 60 : 3600;
    const offset = 754 - (754 * (this.timeLeft / total));
    ring.style.strokeDashoffset = offset;
  }

  complete() {
    clearInterval(this.timerId);
    this.timerId = null;
    
    if (this.subMode === 'focus') {
      this.sessionsCompleted++;
      toast('Focus session complete! Take a break.', 'success');
      this.subMode = 'short';
      this.timeLeft = this.settings.short * 60;
      // Auto-start break
      setTimeout(() => this.toggle(), 1000);
    } else {
      toast('Break over! Back to work?', 'info');
      this.subMode = 'focus';
      this.timeLeft = this.settings.focus * 60;
    }
    
    this.updateDisplay();
    document.getElementById('timer-label').textContent = this.subMode.toUpperCase() + ' SESSION';
  }

  reset() {
    clearInterval(this.timerId);
    this.timerId = null;
    this.timeLeft = this.settings[this.subMode] * 60;
    this.updateDisplay();
  }

  skip() {
    this.complete();
  }
}
