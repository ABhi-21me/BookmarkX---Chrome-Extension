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
    this.interval = setInterval(() => {
      this.updateTime();
      // Re-render calendar at midnight
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        this.renderCalendar();
      }
    }, 1000);
  }

  updateTime() {
    const now = new Date();
    
    // Time
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    // Using a span for the colon to make it darker as per the design
    this.timeEl.innerHTML = `${hours}<span class="clock-colon">:</span>${minutes}`;
    
    // Day and Date
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    this.dayEl.textContent = days[now.getDay()];
    this.dateEl.textContent = `${now.getDate()} ${months[now.getMonth()]}`;
  }

  renderCalendar() {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
    
    // We want a row: MON TUE WED THU FRI SAT SUN
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    
    // Calculate the date for the Monday of the current week
    // If today is Sunday (0), Monday is 6 days ago. Otherwise, it's (currentDay - 1) days ago.
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.clockWidgetInstance = new ClockWidget();
});
