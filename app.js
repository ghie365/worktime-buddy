// ===== WorkTime Buddy — App Logic =====

// --- State ---
let state = {
  currentJob: 'sysadmin',
  timer: {
    running: false,
    paused: false,
    jobId: null,
    startTime: null,
    pauseTime: null,
    elapsed: 0, // ms accumulated before current run segment
  },
  selectedMonth: new Date().getMonth(),
  selectedYear: new Date().getFullYear(),
  deleteTarget: null,
};

// --- Constants ---
const JOBS = {
  sysadmin: { name: 'Sr. Sysadmin', color: 'job1' },
  l3engineer: { name: 'L3 Engineer', color: 'job2' },
};

const TIMEZONES = [
  { id: 'jakarta', tz: 'Asia/Jakarta', city: 'Jakarta', flag: '🇮🇩', label: 'WIB', elId: 'clock-jakarta' },
  { id: 'newyork', tz: 'America/New_York', city: 'New York', flag: '🇺🇸', label: 'ET', elId: 'clock-newyork' },
  { id: 'chicago', tz: 'America/Chicago', city: 'Chicago', flag: '🇺🇸', label: 'CT', elId: 'clock-chicago' },
  { id: 'denver', tz: 'America/Denver', city: 'Denver', flag: '🇺🇸', label: 'MT', elId: 'clock-denver' },
  { id: 'la', tz: 'America/Los_Angeles', city: 'Los Angeles', flag: '🇺🇸', label: 'PT', elId: 'clock-la' },
];

const TZ_LABELS = {
  'America/New_York': 'US East (ET)',
  'America/Chicago': 'US Central (CT)',
  'America/Denver': 'US Mountain (MT)',
  'America/Los_Angeles': 'US West (PT)',
};

// --- Storage ---
function loadSessions() {
  try { return JSON.parse(localStorage.getItem('wtb_sessions') || '[]'); }
  catch { return []; }
}

function saveSessions(sessions) {
  localStorage.setItem('wtb_sessions', JSON.stringify(sessions));
}

function loadSettings() {
  const defaults = { salary: 0, rate: 0, exchange: 15800, primaryTz: 'America/New_York' };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('wtb_settings') || '{}') };
  } catch { return defaults; }
}

function saveSettingsData(settings) {
  localStorage.setItem('wtb_settings', JSON.stringify(settings));
}

function loadTimerState() {
  try { return JSON.parse(localStorage.getItem('wtb_timer') || 'null'); }
  catch { return null; }
}

function saveTimerState() {
  localStorage.setItem('wtb_timer', JSON.stringify(state.timer));
}

// --- Init ---
function init() {
  // Restore timer
  const saved = loadTimerState();
  if (saved && saved.running) {
    state.timer = saved;
    state.currentJob = saved.jobId;
  }

  // Restore settings to form
  const settings = loadSettings();
  document.getElementById('set-salary').value = settings.salary || '';
  document.getElementById('set-rate').value = settings.rate || '';
  document.getElementById('set-exchange').value = settings.exchange || '';
  document.getElementById('set-primary-tz').value = settings.primaryTz;

  // Set manual date default
  document.getElementById('manual-date').value = todayStr();

  // Start ticking
  tick();
  setInterval(tick, 1000);

  // Build overlap timeline
  buildOverlapTimeline();

  // Initial update meeting planner
  updateMeetingTime();

  // Render everything
  renderAll();
}

// --- Page Switching ---
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');
}

// --- Clock Tick ---
function tick() {
  const now = new Date();

  // Update all clocks
  TIMEZONES.forEach(tz => {
    const timeEl = document.getElementById(tz.elId);
    const dateEl = document.getElementById(tz.elId + '-date');
    const diffEl = document.getElementById(tz.elId + '-diff');

    const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = now.toLocaleDateString('en-US', { timeZone: tz.tz, weekday: 'short', month: 'short', day: 'numeric' });

    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;

    if (diffEl) {
      const jakartaOffset = getTimezoneOffset('Asia/Jakarta', now);
      const tzOffset = getTimezoneOffset(tz.tz, now);
      const diffHours = (jakartaOffset - tzOffset) / 60;
      diffEl.textContent = diffHours > 0 ? `-${diffHours}h` : `+${Math.abs(diffHours)}h`;
    }
  });

  // Header timezone
  const settings = loadSettings();
  const primaryTz = settings.primaryTz;
  const jakartaTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: true });
  const usTime = now.toLocaleTimeString('en-US', { timeZone: primaryTz, hour: '2-digit', minute: '2-digit', hour12: true });
  document.getElementById('header-tz').innerHTML = `🇮🇩 ${jakartaTime} · 🇺🇸 ${usTime}`;

  // Dashboard tz strip
  document.getElementById('tz-local-time').textContent = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: true });
  document.getElementById('tz-us-time').textContent = now.toLocaleTimeString('en-US', { timeZone: primaryTz, hour: '2-digit', minute: '2-digit', hour12: true });
  document.getElementById('tz-us-label').textContent = TZ_LABELS[primaryTz] || 'US';

  // Overlap indicator
  updateOverlapIndicator(now, primaryTz);

  // Update timer display
  if (state.timer.running && !state.timer.paused) {
    updateTimerDisplay();
  }
}

function getTimezoneOffset(tz, date) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return (tzDate - utcDate) / 60000;
}

function updateOverlapIndicator(now, usTz) {
  const usHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: usTz, hour: '2-digit', hour12: false }));
  const card = document.getElementById('overlap-card');
  const icon = document.getElementById('overlap-icon');
  const text = document.getElementById('overlap-text');

  card.className = 'overlap-card';

  if (usHour >= 9 && usHour < 17) {
    icon.textContent = '🟢';
    text.textContent = 'US team is in working hours — good time to sync!';
  } else if (usHour >= 7 && usHour < 9) {
    icon.textContent = '🟡';
    text.textContent = 'US team starting soon — they may be available.';
    card.classList.add('warning');
  } else if (usHour >= 17 && usHour < 20) {
    icon.textContent = '🟡';
    text.textContent = 'US team wrapping up — catch them before they leave.';
    card.classList.add('warning');
  } else {
    icon.textContent = '🔴';
    text.textContent = 'US team is off hours — async communication recommended.';
    card.classList.add('danger');
  }
}

// --- Timer ---
function selectJob(jobId) {
  if (state.timer.running) {
    showToast('Stop the timer before switching jobs');
    return;
  }
  state.currentJob = jobId;
  document.getElementById('toggle-sysadmin').classList.toggle('active', jobId === 'sysadmin');
  document.getElementById('toggle-l3engineer').classList.toggle('active', jobId === 'l3engineer');
  document.getElementById('timer-job').textContent = JOBS[jobId].name;
}

function startTimer() {
  state.timer = {
    running: true,
    paused: false,
    jobId: state.currentJob,
    startTime: Date.now(),
    pauseTime: null,
    elapsed: 0,
  };
  saveTimerState();
  updateTimerUI();
  showToast(`Timer started — ${JOBS[state.currentJob].name}`);
}

function pauseTimer() {
  state.timer.paused = true;
  state.timer.elapsed += Date.now() - state.timer.startTime;
  state.timer.pauseTime = Date.now();
  saveTimerState();
  updateTimerUI();
}

function resumeTimer() {
  state.timer.paused = false;
  state.timer.startTime = Date.now();
  state.timer.pauseTime = null;
  saveTimerState();
  updateTimerUI();
}

function stopTimer() {
  if (!state.timer.running) return;

  let totalMs = state.timer.elapsed;
  if (!state.timer.paused) {
    totalMs += Date.now() - state.timer.startTime;
  }

  const durationMin = Math.round(totalMs / 60000);
  if (durationMin < 1) {
    showToast('Session too short (< 1 min), discarded');
    resetTimer();
    return;
  }

  // Save session
  const sessions = loadSessions();
  const sessionStart = new Date(Date.now() - totalMs);
  sessions.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    jobId: state.timer.jobId,
    date: todayStr(),
    startTime: sessionStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    endTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    durationMin: durationMin,
    note: '',
  });
  saveSessions(sessions);

  showToast(`Saved: ${formatDuration(durationMin)} for ${JOBS[state.timer.jobId].name}`);
  resetTimer();
  renderAll();
}

function resetTimer() {
  state.timer = { running: false, paused: false, jobId: null, startTime: null, pauseTime: null, elapsed: 0 };
  saveTimerState();
  updateTimerUI();
}

function updateTimerDisplay() {
  let totalMs = state.timer.elapsed;
  if (!state.timer.paused && state.timer.running) {
    totalMs += Date.now() - state.timer.startTime;
  }

  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  document.getElementById('timer-time').textContent =
    `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function updateTimerUI() {
  const { running, paused, jobId } = state.timer;
  const display = document.getElementById('timer-display');
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnStop = document.getElementById('btn-stop');
  const timerStarted = document.getElementById('timer-started');

  display.className = 'timer-display';

  if (running && !paused) {
    display.classList.add('running');
    if (jobId === 'l3engineer') display.classList.add('job2-active');
    btnStart.classList.add('hidden');
    btnPause.classList.remove('hidden');
    btnResume.classList.add('hidden');
    btnStop.classList.remove('hidden');
    const startDate = new Date(state.timer.startTime - state.timer.elapsed);
    timerStarted.textContent = `Started at ${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } else if (running && paused) {
    display.classList.add('paused');
    btnStart.classList.add('hidden');
    btnPause.classList.add('hidden');
    btnResume.classList.remove('hidden');
    btnStop.classList.remove('hidden');
    timerStarted.textContent = 'Paused';
  } else {
    btnStart.classList.remove('hidden');
    btnPause.classList.add('hidden');
    btnResume.classList.add('hidden');
    btnStop.classList.add('hidden');
    document.getElementById('timer-time').textContent = '00:00:00';
    timerStarted.textContent = '';
  }

  // Update dashboard quick buttons
  updateDashQuickButtons();

  // Update timer job label
  document.getElementById('timer-job').textContent = JOBS[state.currentJob]?.name || 'Select a job';

  // Persist selected job toggles
  document.getElementById('toggle-sysadmin').classList.toggle('active', state.currentJob === 'sysadmin');
  document.getElementById('toggle-l3engineer').classList.toggle('active', state.currentJob === 'l3engineer');
}

function updateDashQuickButtons() {
  const { running, paused, jobId } = state.timer;

  ['sysadmin', 'l3engineer'].forEach(jid => {
    const num = jid === 'sysadmin' ? '1' : '2';
    const btnIcon = document.getElementById(`dash-job${num}-btn-icon`);
    const btnText = document.getElementById(`dash-job${num}-btn-text`);
    const btn = btnIcon.closest('.quick-start-btn');

    if (running && jobId === jid) {
      btnIcon.textContent = '⏹';
      btnText.textContent = 'Stop';
      btn.classList.add('running');
    } else {
      btnIcon.textContent = '▶';
      btnText.textContent = 'Start';
      btn.classList.remove('running');
    }
  });
}

function quickStart(jobId) {
  if (state.timer.running && state.timer.jobId === jobId) {
    stopTimer();
    return;
  }
  if (state.timer.running) {
    showToast('Stop current timer first');
    return;
  }
  state.currentJob = jobId;
  startTimer();
}

// --- Manual Entry ---
function toggleManualEntry() {
  document.getElementById('manual-entry').classList.toggle('hidden');
}

function saveManualEntry() {
  const jobId = document.getElementById('manual-job').value;
  const date = document.getElementById('manual-date').value;
  const start = document.getElementById('manual-start').value;
  const end = document.getElementById('manual-end').value;
  const note = document.getElementById('manual-note').value.trim();

  if (!date || !start || !end) {
    showToast('Please fill in date, start and end time');
    return;
  }

  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin <= startMin) endMin += 1440; // overnight
  const durationMin = endMin - startMin;

  if (durationMin < 1) {
    showToast('Duration must be at least 1 minute');
    return;
  }

  const sessions = loadSessions();
  sessions.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    jobId,
    date,
    startTime: start,
    endTime: end,
    durationMin,
    note,
  });
  saveSessions(sessions);

  // Reset form
  document.getElementById('manual-note').value = '';
  document.getElementById('manual-entry').classList.add('hidden');

  showToast(`Added ${formatDuration(durationMin)} for ${JOBS[jobId].name}`);
  renderAll();
}

// --- Delete Session ---
function deleteSession(id) {
  state.deleteTarget = id;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function confirmDelete() {
  if (state.deleteTarget) {
    let sessions = loadSessions();
    sessions = sessions.filter(s => s.id !== state.deleteTarget);
    saveSessions(sessions);
    state.deleteTarget = null;
    closeModal();
    renderAll();
    showToast('Session deleted');
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  state.deleteTarget = null;
}

// --- Settings ---
function saveSettings() {
  const settings = loadSettings();
  settings.salary = parseFloat(document.getElementById('set-salary').value) || 0;
  settings.rate = parseFloat(document.getElementById('set-rate').value) || 0;
  settings.exchange = parseFloat(document.getElementById('set-exchange').value) || 15800;
  saveSettingsData(settings);
  renderAll();
  showToast('Settings saved');
}

function savePrimaryTz() {
  const settings = loadSettings();
  settings.primaryTz = document.getElementById('set-primary-tz').value;
  saveSettingsData(settings);
}

// --- Render ---
function renderAll() {
  const sessions = loadSessions();
  const settings = loadSettings();
  const today = todayStr();

  // --- Dashboard ---
  const todaySessions = sessions.filter(s => s.date === today);
  const job1Mins = todaySessions.filter(s => s.jobId === 'sysadmin').reduce((sum, s) => sum + s.durationMin, 0);
  const job2Mins = todaySessions.filter(s => s.jobId === 'l3engineer').reduce((sum, s) => sum + s.durationMin, 0);

  document.getElementById('dash-job1-hours').textContent = formatDuration(job1Mins);
  document.getElementById('dash-job2-hours').textContent = formatDuration(job2Mins);

  // This month earnings
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const job1MonthMins = monthSessions.filter(s => s.jobId === 'sysadmin').reduce((sum, s) => sum + s.durationMin, 0);
  const job2MonthMins = monthSessions.filter(s => s.jobId === 'l3engineer').reduce((sum, s) => sum + s.durationMin, 0);
  const job2EarningsUsd = (job2MonthMins / 60) * settings.rate;
  const job2EarningsIdr = job2EarningsUsd * settings.exchange;
  const totalIdr = settings.salary + job2EarningsIdr;

  document.getElementById('dash-job1-earning').textContent = formatIDR(settings.salary);
  document.getElementById('dash-job2-earning').textContent = formatUSD(job2EarningsUsd);
  document.getElementById('dash-total-earning').textContent = formatIDR(totalIdr);

  // Recent sessions (last 5)
  const recent = [...sessions].sort((a, b) => {
    const da = new Date(a.date + 'T' + a.startTime);
    const db = new Date(b.date + 'T' + b.startTime);
    return db - da;
  }).slice(0, 5);
  renderSessionsList('dash-recent-sessions', recent, true);

  // --- Timer page sessions ---
  const timerSessions = todaySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
  renderSessionsList('timer-sessions', timerSessions, false);

  // --- Earnings ---
  renderEarnings(sessions, settings);

  // Update timer UI
  updateTimerUI();
}

function renderSessionsList(containerId, sessions, showDate) {
  const container = document.getElementById(containerId);
  if (sessions.length === 0) {
    container.innerHTML = '<div class="empty-state">No sessions yet</div>';
    return;
  }

  container.innerHTML = sessions.map(s => {
    const job = JOBS[s.jobId];
    const dateLabel = showDate ? `<span style="margin-left:4px;color:var(--text-muted)">${formatDate(s.date)}</span>` : '';
    return `
      <div class="session-item">
        <div class="session-dot ${job.color}-dot" style="background:var(--${job.color})"></div>
        <div class="session-info">
          <div class="session-job">${job.name}${dateLabel}</div>
          <div class="session-time">${s.startTime} → ${s.endTime}</div>
          ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
        </div>
        <div class="session-duration">${formatDuration(s.durationMin)}</div>
        <button class="session-delete" onclick="deleteSession('${s.id}')" title="Delete">✕</button>
      </div>
    `;
  }).join('');
}

function renderEarnings(sessions, settings) {
  const month = state.selectedMonth;
  const year = state.selectedYear;

  document.getElementById('earnings-month').textContent =
    new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthSessions = sessions.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const job1Mins = monthSessions.filter(s => s.jobId === 'sysadmin').reduce((sum, s) => sum + s.durationMin, 0);
  const job2Mins = monthSessions.filter(s => s.jobId === 'l3engineer').reduce((sum, s) => sum + s.durationMin, 0);

  const job2Usd = (job2Mins / 60) * settings.rate;
  const job2Idr = job2Usd * settings.exchange;
  const totalIdr = settings.salary + job2Idr;
  const totalUsd = totalIdr / (settings.exchange || 1);

  document.getElementById('earn-job1-salary').textContent = formatIDR(settings.salary);
  document.getElementById('earn-job1-hours').textContent = formatDuration(job1Mins);
  document.getElementById('earn-job2-hours').textContent = formatDuration(job2Mins);
  document.getElementById('earn-job2-rate').textContent = `$${settings.rate}/hr`;
  document.getElementById('earn-job2-usd').textContent = formatUSD(job2Usd);
  document.getElementById('earn-job2-idr').textContent = formatIDR(job2Idr);
  document.getElementById('total-idr').textContent = formatIDR(totalIdr);
  document.getElementById('total-usd').textContent = `≈ ${formatUSD(totalUsd)} USD`;

  // Monthly sessions
  const sorted = [...monthSessions].sort((a, b) => {
    const da = new Date(a.date + 'T' + a.startTime);
    const db = new Date(b.date + 'T' + b.startTime);
    return db - da;
  });
  renderSessionsList('earn-sessions', sorted, true);
}

function changeMonth(dir) {
  state.selectedMonth += dir;
  if (state.selectedMonth > 11) { state.selectedMonth = 0; state.selectedYear++; }
  if (state.selectedMonth < 0) { state.selectedMonth = 11; state.selectedYear--; }
  renderAll();
}

// --- Overlap Timeline ---
function buildOverlapTimeline() {
  const container = document.getElementById('overlap-timeline');

  // Your working hours in WIB (UTC+7): 9AM-5PM = hours 9-17
  // US ET working hours in ET: 9AM-5PM
  // ET is UTC-5 (or UTC-4 DST)
  // 9AM ET = 9PM WIB (same day)
  // 5PM ET = 5AM WIB (next day)
  // So in WIB: US ET works ~9PM-5AM (across midnight)

  // Show 24h timeline in WIB
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Your hours: 9-17 WIB
  const yourStart = 9, yourEnd = 17;

  // US ET in WIB: roughly 9PM-5AM (21-5, wrapping midnight)
  // We'll show ET as the primary
  const usStartWIB = 21, usEndWIB = 5; // wraps midnight

  function isYourHour(h) { return h >= yourStart && h < yourEnd; }
  function isUsHour(h) {
    if (usStartWIB < usEndWIB) return h >= usStartWIB && h < usEndWIB;
    return h >= usStartWIB || h < usEndWIB;
  }

  // Hours row
  const hoursHtml = `
    <div class="timeline-row">
      <div class="timeline-label">Hour</div>
      <div class="timeline-bar">
        ${hours.map(h => `<div class="timeline-cell inactive"><span class="hour-label">${h}</span></div>`).join('')}
      </div>
    </div>
  `;

  // Your hours row
  const yoursHtml = `
    <div class="timeline-row">
      <div class="timeline-label">You</div>
      <div class="timeline-bar">
        ${hours.map(h => `<div class="timeline-cell ${isYourHour(h) ? 'active-yours' : 'inactive'}"></div>`).join('')}
      </div>
    </div>
  `;

  // US hours row
  const usHtml = `
    <div class="timeline-row">
      <div class="timeline-label">US (ET)</div>
      <div class="timeline-bar">
        ${hours.map(h => `<div class="timeline-cell ${isUsHour(h) ? 'active-theirs' : 'inactive'}"></div>`).join('')}
      </div>
    </div>
  `;

  // Overlap row
  const overlapHtml = `
    <div class="timeline-row">
      <div class="timeline-label">Overlap</div>
      <div class="timeline-bar">
        ${hours.map(h => `<div class="timeline-cell ${isYourHour(h) && isUsHour(h) ? 'active-overlap' : 'inactive'}"></div>`).join('')}
      </div>
    </div>
  `;

  container.innerHTML = hoursHtml + yoursHtml + usHtml + overlapHtml;
}

// --- Meeting Planner ---
function updateMeetingTime() {
  const timeInput = document.getElementById('meeting-time').value;
  if (!timeInput) return;

  const [hours, minutes] = timeInput.split(':').map(Number);
  const now = new Date();
  const jakartaDate = new Date(now);
  jakartaDate.setHours(hours, minutes, 0, 0);

  const container = document.getElementById('meeting-results');
  const usTzs = TIMEZONES.filter(tz => tz.id !== 'jakarta');

  container.innerHTML = usTzs.map(tz => {
    const timeStr = jakartaDate.toLocaleTimeString('en-US', {
      timeZone: tz.tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const usHour = parseInt(jakartaDate.toLocaleTimeString('en-US', {
      timeZone: tz.tz,
      hour: '2-digit',
      hour12: false,
    }));

    let status, statusColor;
    if (usHour >= 9 && usHour < 17) {
      status = '✅ Working hours';
      statusColor = 'var(--success)';
    } else if (usHour >= 7 && usHour < 9 || usHour >= 17 && usHour < 20) {
      status = '⚠️ Maybe available';
      statusColor = 'var(--warning)';
    } else {
      status = '😴 Off hours';
      statusColor = 'var(--danger)';
    }

    return `
      <div class="meeting-result-row">
        <span class="meeting-result-city">${tz.flag} ${tz.city}</span>
        <span class="meeting-result-time">${timeStr}</span>
        <span class="meeting-result-status" style="color:${statusColor}">${status}</span>
      </div>
    `;
  }).join('');
}

// --- Utilities ---
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatIDR(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

function formatUSD(amount) {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}

// --- Start ---
document.addEventListener('DOMContentLoaded', init);
