class ClockWidget {
  constructor() {
    this.el = document.getElementById('clockWidget');
    this.timeEl = document.getElementById('clockTime');
    this.dayEl = document.getElementById('clockDay');
    this.dateEl = document.getElementById('clockDate');
    this.calendarEl = document.getElementById('clockCalendar');
    this.interval = null;

    if (!this.el) return;
    this.init();
  }

  init() {
    this.updateTime();
    this.renderCalendar();
    this.applySettings();
    
    this.interval = setInterval(() => {
      this.updateTime();
      // Re-render calendar at midnight
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        this.renderCalendar();
      }
    }, 1000);

    // Listen to settings changes from store
    if (window.appStore) {
      window.appStore.subscribe('settings', () => {
        this.applySettings();
        this.updateTime(); // Re-render immediately on format change
      });
    }
  }

  applySettings() {
    const s = window.appStore ? window.appStore.state.settings : (window.state ? window.state.settings : {});
    
    // Position classes
    const posClass = s.clockPos ? `clock-position-${s.clockPos}` : 'clock-position-center';
    const layoutClass = s.clockLayout ? `layout-${s.clockLayout}` : 'layout-time-above-date';
    const styleClass = s.clockStyle ? `style-${s.clockStyle}` : 'style-minimal';
    const animClass = s.clockAnim ? `anim-${s.clockAnim}` : 'anim-fade';

    const isHidden = this.el.classList.contains('hidden');
    this.el.className = `clock-widget ${posClass} ${layoutClass} ${styleClass} ${animClass} ${isHidden ? 'hidden' : ''}`;
  }

  updateTime() {
    const now = new Date();
    const s = window.appStore ? window.appStore.state.settings : {};
    
    // Time
    let hours = now.getHours();
    const is12hr = s.clock24hr === false;
    const ampm = is12hr ? (hours >= 12 ? ' PM' : ' AM') : '';
    
    if (is12hr) {
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
    }
    
    const hoursStr = hours.toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = s.clockShowSeconds ? `<span class="clock-sec">:${now.getSeconds().toString().padStart(2, '0')}</span>` : '';
    
    this.timeEl.innerHTML = `${hoursStr}<span class="clock-colon">:</span>${minutes}${seconds}<span class="clock-ampm">${ampm}</span>`;
    
    // Day and Date
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    this.dayEl.textContent = days[now.getDay()];
    
    // Format Date
    let dateStr = `${now.getDate()} ${months[now.getMonth()]}`;
    const format = s.dateFormat || 'dd-mm-yyyy';
    
    const dd = now.getDate().toString().padStart(2, '0');
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    
    if (format === 'dd/mm/yyyy') dateStr = `${dd}/${mm}/${yyyy}`;
    else if (format === 'mm/dd/yyyy') dateStr = `${mm}/${dd}/${yyyy}`;
    else if (format === 'day-month-date') dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
    else if (format === 'full') dateStr = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    else if (format === 'short') dateStr = `${dd}/${mm}`;
    else dateStr = `${now.getDate()} ${months[now.getMonth()]}`;

    this.dateEl.textContent = dateStr;
  }

  renderCalendar() {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
    
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);

    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      
      const isToday = d.toDateString() === now.toDateString();
      const dayName = dayNames[i];
      const dateNum = d.getDate();
      
      html += `
        <div class="cal-day-col ${isToday ? 'is-today' : ''}">
          <div class="cal-day-name">${dayName}</div>
          <div class="cal-day-num">${dateNum}</div>
        </div>
      `;
    }
    
    this.calendarEl.innerHTML = html;
  }
}

// Initialize when DOM is ready, but wait for store to have settings loaded
document.addEventListener('DOMContentLoaded', () => {
  function initClock() {
    window.clockWidgetInstance = new ClockWidget();
    window.clockWidget = window.clockWidgetInstance; // alias used in newtab.js
  }

  // If store is already ready (e.g. fast load), init immediately
  if (window._bxStoreReady) {
    initClock();
  } else {
    // Wait for the storeReady event from newtab.js init()
    window.addEventListener('bookmarkx:storeReady', () => {
      initClock();
    }, { once: true });
    
    // Safety fallback: if event never fires within 3s, init anyway
    setTimeout(() => {
      if (!window.clockWidgetInstance) {
        initClock();
      }
    }, 3000);
  }
});
