// ===== WorkTime Buddy — Complete Logic & Settings Engine =====

// Default Settings
const DEFAULT_SETTINGS = {
  job1: {
    name: 'Sr. Sysadmin',
    type: 'monthly', // 'monthly' | 'hourly'
    currency: 'IDR',
    rate: 15000000,
  },
  job2: {
    name: 'L3 Linux Engineer',
    type: 'hourly',  // 'hourly' | 'monthly'
    currency: 'USD',
    rate: 45,
  },
  exchangeRate: 15800,
  primaryTz: 'America/New_York',
  shiftStart: '09:00',
  shiftEnd: '17:00',
};

// Application State
let state = {
  currentJob: 'job1',
  timer: {
    running: false,
    paused: false,
    jobId: null,
    startTime: null,
    pauseTime: null,
    elapsed: 0,
  },
  selectedMonth: new Date().getMonth(),
  selectedYear: new Date().getFullYear(),
  modalAction: null,
  deleteTarget: null,
};

const TIMEZONES = [
  { id: 'jakarta', tz: 'Asia/Jakarta', city: 'Jakarta', sub: 'WIB · Your Time', flag: '🇮🇩' },
  { id: 'newyork', tz: 'America/New_York', city: 'New York', sub: 'ET · Eastern', flag: '🇺🇸' },
  { id: 'chicago', tz: 'America/Chicago', city: 'Chicago', sub: 'CT · Central', flag: '🇺🇸' },
  { id: 'denver', tz: 'America/Denver', city: 'Denver', sub: 'MT · Mountain', flag: '🇺🇸' },
  { id: 'la', tz: 'America/Los_Angeles', city: 'Los Angeles', sub: 'PT · Pacific', flag: '🇺🇸' },
];

const TZ_SHORT_NAMES = {
  'America/New_York': 'US East (ET)',
  'America/Chicago': 'US Central (CT)',
  'America/Denver': 'US Mountain (MT)',
  'America/Los_Angeles': 'US West (PT)',
};

// --- Storage Handlers ---
function loadSessions() {
  try {
    const raw = JSON.parse(localStorage.getItem('wtb_sessions') || '[]');
    // Normalize older jobId 'sysadmin' -> 'job1', 'l3engineer' -> 'job2'
    return raw.map(s => ({
      ...s,
      jobId: s.jobId === 'sysadmin' ? 'job1' : (s.jobId === 'l3engineer' ? 'job2' : s.jobId),
    }));
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem('wtb_sessions', JSON.stringify(sessions));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('wtb_settings') || '{}');
    // Backward compatibility with older schema
    const settings = { ...DEFAULT_SETTINGS, ...saved };
    if (saved.salary !== undefined) {
      settings.job1.rate = saved.salary;
      settings.job1.type = 'monthly';
    }
    if (saved.rate !== undefined) {
      settings.job2.rate = saved.rate;
      settings.job2.type = 'hourly';
    }
    if (saved.exchange !== undefined) {
      settings.exchangeRate = saved.exchange;
    }
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
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

// --- Initialization ---
function init() {
  // Restore timer if active
  const savedTimer = loadTimerState();
  if (savedTimer && savedTimer.running) {
    state.timer = savedTimer;
    state.currentJob = savedTimer.jobId || 'job1';
  }

  // Populate settings form
  populateSettingsUI();

  // Set today's date in manual modal
  const manualDateInput = document.getElementById('manual-date');
  if (manualDateInput) manualDateInput.value = todayStr();

  // Start clock loop
  tick();
  setInterval(tick, 1000);

  // Render timeline & meeting planner
  buildOverlapTimeline();
  updateMeetingTime();

  // Render all pages
  renderAll();
}

// --- Navigation ---
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Trigger re-render when switching to views with dynamic states
  if (page === 'earnings' || page === 'dashboard' || page === 'timezones') {
    renderAll();
  }
}

// --- Live Clock & Timezone Loop ---
function tick() {
  const now = new Date();
  const settings = loadSettings();

  // Update Clocks in Timezones Tab
  TIMEZONES.forEach(tz => {
    const timeEl = document.getElementById(`clock-${tz.id}`);
    const dateEl = document.getElementById(`clock-${tz.id}-date`);
    const diffEl = document.getElementById(`clock-${tz.id}-diff`);
    const statusEl = document.getElementById(`clock-${tz.id}-status`);

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('en-US', {
        timeZone: tz.tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-US', {
        timeZone: tz.tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    // Offset difference from Jakarta
    if (diffEl && tz.id !== 'jakarta') {
      const jakartaOffset = getTimezoneOffset('Asia/Jakarta', now);
      const tzOffset = getTimezoneOffset(tz.tz, now);
      const diffHours = (jakartaOffset - tzOffset) / 60;
      diffEl.textContent = diffHours > 0 ? `-${diffHours}h` : `+${Math.abs(diffHours)}h`;
    }

    // Status pill (Working / Wrap-up / Off)
    if (statusEl) {
      const localHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: tz.tz, hour: '2-digit', hour12: false }));
      if (localHour >= 9 && localHour < 17) {
        statusEl.className = 'clock-status-pill green';
        statusEl.textContent = '🟢 Working';
      } else if ((localHour >= 7 && localHour < 9) || (localHour >= 17 && localHour < 19)) {
        statusEl.className = 'clock-status-pill yellow';
        statusEl.textContent = '🟡 Available';
      } else {
        statusEl.className = 'clock-status-pill gray';
        statusEl.textContent = '😴 Off hours';
      }
    }
  });

  // Header quick clocks
  const primaryTz = settings.primaryTz || 'America/New_York';
  const jakartaTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: true });
  const usTime = now.toLocaleTimeString('en-US', { timeZone: primaryTz, hour: '2-digit', minute: '2-digit', hour12: true });
  const headerTzEl = document.getElementById('header-tz');
  if (headerTzEl) {
    headerTzEl.innerHTML = `🇮🇩 ${jakartaTime}<br>🇺🇸 ${usTime}`;
  }

  // Dashboard strip
  const dashLocal = document.getElementById('tz-local-time');
  const dashUs = document.getElementById('tz-us-time');
  const dashUsLabel = document.getElementById('tz-us-label');
  if (dashLocal) dashLocal.textContent = jakartaTime;
  if (dashUs) dashUs.textContent = usTime;
  if (dashUsLabel) dashUsLabel.textContent = TZ_SHORT_NAMES[primaryTz] || 'US Team';

  // Dashboard overlap indicator
  updateDashboardOverlapBanner(now, primaryTz);

  // Active Timer display tick
  if (state.timer.running && !state.timer.paused) {
    updateTimerDisplay();
  }
}

function getTimezoneOffset(tz, date) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return (tzDate - utcDate) / 60000;
}

function updateDashboardOverlapBanner(now, usTz) {
  const usHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: usTz, hour: '2-digit', hour12: false }));
  const card = document.getElementById('overlap-card');
  const icon = document.getElementById('overlap-icon');
  const text = document.getElementById('overlap-text');
  if (!card) return;

  card.className = 'overlap-card';

  if (usHour >= 9 && usHour < 17) {
    icon.textContent = '🟢';
    text.textContent = 'US team is in working hours — great time for sync!';
  } else if ((usHour >= 7 && usHour < 9) || (usHour >= 17 && usHour < 20)) {
    icon.textContent = '🟡';
    text.textContent = 'US team wrapping up / starting up soon';
    card.classList.add('warning');
  } else {
    icon.textContent = '🔴';
    text.textContent = 'US team off hours — async messaging recommended';
    card.classList.add('danger');
  }
}

// --- Overlap Timeline Visualizer ---
function buildOverlapTimeline() {
  const settings = loadSettings();
  const [shiftStartH] = (settings.shiftStart || '09:00').split(':').map(Number);
  const [shiftEndH] = (settings.shiftEnd || '17:00').split(':').map(Number);

  // US working hours: 09:00 - 17:00 in primary US zone
  // Convert US 9AM to WIB (approx 21:00 or 22:00)
  const now = new Date();
  const jakartaOffset = getTimezoneOffset('Asia/Jakarta', now);
  const usOffset = getTimezoneOffset(settings.primaryTz, now);
  const diffHours = Math.round((jakartaOffset - usOffset) / 60);

  // US 9AM in WIB = (9 + diffHours) % 24
  const usStartInWIB = (9 + diffHours + 24) % 24;
  const usEndInWIB = (17 + diffHours + 24) % 24;

  const barYours = document.getElementById('bar-yours');
  const barTheirs = document.getElementById('bar-theirs');
  const barOverlap = document.getElementById('bar-overlap');
  const usLabel = document.getElementById('timeline-us-label');
  const syncWindowText = document.getElementById('sync-window-text');

  if (usLabel) usLabel.textContent = `🇺🇸 ${TZ_SHORT_NAMES[settings.primaryTz] || 'US Team'}`;

  function isYourHour(h) {
    return h >= shiftStartH && h < shiftEndH;
  }

  function isUsHourInWIB(h) {
    if (usStartInWIB < usEndInWIB) {
      return h >= usStartInWIB && h < usEndInWIB;
    }
    return h >= usStartInWIB || h < usEndInWIB;
  }

  let yoursHtml = '';
  let theirsHtml = '';
  let overlapHtml = '';

  let overlapHours = [];

  for (let h = 0; h < 24; h++) {
    const yActive = isYourHour(h);
    const tActive = isUsHourInWIB(h);
    const oActive = yActive && tActive;

    if (oActive) overlapHours.push(h);

    yoursHtml += `<div class="timeline-hour-cell ${yActive ? 'yours' : 'off'}"></div>`;
    theirsHtml += `<div class="timeline-hour-cell ${tActive ? 'theirs' : 'off'}"></div>`;
    overlapHtml += `<div class="timeline-hour-cell ${oActive ? 'overlap' : 'off'}"></div>`;
  }

  if (barYours) barYours.innerHTML = yoursHtml;
  if (barTheirs) barTheirs.innerHTML = theirsHtml;
  if (barOverlap) barOverlap.innerHTML = overlapHtml;

  // Update optimal sync banner
  if (syncWindowText) {
    if (overlapHours.length > 0) {
      const startH = overlapHours[0];
      const endH = overlapHours[overlapHours.length - 1] + 1;
      syncWindowText.textContent = `${formatHour(startH)} – ${formatHour(endH)} WIB (${overlapHours.length} hours mutual overlap)`;
    } else {
      // Suggest closest evening sync window
      const usMorningInWIB = usStartInWIB;
      syncWindowText.textContent = `${formatHour(usMorningInWIB)} – ${formatHour((usMorningInWIB + 2) % 24)} WIB (US morning start)`;
    }
  }
}

function formatHour(h) {
  const pad = h.toString().padStart(2, '0');
  return `${pad}:00`;
}

// --- Meeting Planner ---
function updateMeetingTime() {
  const timeInput = document.getElementById('meeting-time');
  if (!timeInput || !timeInput.value) return;

  const [hours, minutes] = timeInput.value.split(':').map(Number);
  const now = new Date();
  const jakartaDate = new Date(now);
  jakartaDate.setHours(hours, minutes, 0, 0);

  const container = document.getElementById('meeting-results');
  if (!container) return;

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
    } else if ((usHour >= 7 && usHour < 9) || (usHour >= 17 && usHour < 20)) {
      status = '⚠️ Maybe available';
      statusColor = 'var(--warning)';
    } else {
      status = '😴 Off hours';
      statusColor = 'var(--danger)';
    }

    return `
      <div class="meeting-result-row">
        <span class="meeting-result-city">${tz.flag} ${tz.city} (${tz.sub.split('·')[0].trim()})</span>
        <span class="meeting-result-time">${timeStr}</span>
        <span class="meeting-result-status" style="color:${statusColor}">${status}</span>
      </div>
    `;
  }).join('');
}

// --- Timer System ---
function selectJob(jobId) {
  if (state.timer.running) {
    showToast('Stop timer before switching jobs');
    return;
  }
  state.currentJob = jobId;
  const settings = loadSettings();
  const jobConfig = settings[jobId] || { name: 'Job' };

  document.getElementById('toggle-job1')?.classList.toggle('active', jobId === 'job1');
  document.getElementById('toggle-job2')?.classList.toggle('active', jobId === 'job2');
  const timerJobEl = document.getElementById('timer-job');
  if (timerJobEl) timerJobEl.textContent = jobConfig.name;
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
  const settings = loadSettings();
  showToast(`Timer started — ${settings[state.currentJob]?.name || 'Job'}`);
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

  const sessions = loadSessions();
  const sessionStart = new Date(Date.now() - totalMs);
  const settings = loadSettings();

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

  showToast(`Logged: ${formatDuration(durationMin)} for ${settings[state.timer.jobId]?.name || 'Job'}`);
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

  const timeEl = document.getElementById('timer-time');
  if (timeEl) {
    timeEl.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }
}

function updateTimerUI() {
  const { running, paused, jobId } = state.timer;
  const display = document.getElementById('timer-display');
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnStop = document.getElementById('btn-stop');
  const timerStarted = document.getElementById('timer-started');
  if (!display) return;

  display.className = 'timer-display';

  if (running && !paused) {
    display.classList.add('running');
    if (jobId === 'job2') display.classList.add('job2-active');
    btnStart?.classList.add('hidden');
    btnPause?.classList.remove('hidden');
    btnResume?.classList.add('hidden');
    btnStop?.classList.remove('hidden');
    const startDate = new Date(state.timer.startTime - state.timer.elapsed);
    if (timerStarted) timerStarted.textContent = `Started at ${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  } else if (running && paused) {
    display.classList.add('paused');
    btnStart?.classList.add('hidden');
    btnPause?.classList.add('hidden');
    btnResume?.classList.remove('hidden');
    btnStop?.classList.remove('hidden');
    if (timerStarted) timerStarted.textContent = 'Paused';
  } else {
    btnStart?.classList.remove('hidden');
    btnPause?.classList.add('hidden');
    btnResume?.classList.add('hidden');
    btnStop?.classList.add('hidden');
    const timeEl = document.getElementById('timer-time');
    if (timeEl) timeEl.textContent = '00:00:00';
    if (timerStarted) timerStarted.textContent = '';
  }

  updateDashQuickButtons();
}

function updateDashQuickButtons() {
  const { running, jobId } = state.timer;

  ['job1', 'job2'].forEach(jid => {
    const num = jid === 'job1' ? '1' : '2';
    const btnIcon = document.getElementById(`dash-job${num}-btn-icon`);
    const btnText = document.getElementById(`dash-job${num}-btn-text`);
    const btn = btnIcon?.closest('.quick-start-btn');

    if (!btnIcon || !btnText || !btn) return;

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
    showToast('Stop current active timer first');
    return;
  }
  state.currentJob = jobId;
  startTimer();
}

// --- Manual Entry Form ---
function toggleManualEntry() {
  document.getElementById('manual-entry')?.classList.toggle('hidden');
}

function saveManualEntry() {
  const jobId = document.getElementById('manual-job').value;
  const date = document.getElementById('manual-date').value;
  const start = document.getElementById('manual-start').value;
  const end = document.getElementById('manual-end').value;
  const note = document.getElementById('manual-note').value.trim();

  if (!date || !start || !end) {
    showToast('Please specify date, start & end time');
    return;
  }

  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin <= startMin) endMin += 1440; // Over midnight
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

  const noteInput = document.getElementById('manual-note');
  if (noteInput) noteInput.value = '';
  document.getElementById('manual-entry')?.classList.add('hidden');

  const settings = loadSettings();
  showToast(`Added ${formatDuration(durationMin)} for ${settings[jobId]?.name || 'Job'}`);
  renderAll();
}

// --- Delete & Modal System ---
function deleteSession(id) {
  state.modalAction = 'deleteSession';
  state.deleteTarget = id;
  const modal = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = 'Delete Session?';
  document.getElementById('modal-text').textContent = 'This entry will be permanently removed.';
  modal?.classList.remove('hidden');
}

function confirmResetAll() {
  state.modalAction = 'resetAll';
  const modal = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = 'Clear All Sessions?';
  document.getElementById('modal-text').textContent = 'All tracked work logs will be erased. Settings will be kept.';
  modal?.classList.remove('hidden');
}

function confirmModalAction() {
  if (state.modalAction === 'deleteSession' && state.deleteTarget) {
    let sessions = loadSessions();
    sessions = sessions.filter(s => s.id !== state.deleteTarget);
    saveSessions(sessions);
    showToast('Session deleted');
  } else if (state.modalAction === 'resetAll') {
    saveSessions([]);
    showToast('All sessions cleared');
  }
  closeModal();
  renderAll();
}

function closeModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
  state.deleteTarget = null;
  state.modalAction = null;
}

// --- Dynamic Settings UI Handlers ---
function populateSettingsUI() {
  const s = loadSettings();

  // Job 1
  setValue('set-j1-name', s.job1.name);
  setValue('set-j1-curr', s.job1.currency);
  setValue('set-j1-rate', s.job1.rate);
  setJobPayTypeUI('job1', s.job1.type);

  // Job 2
  setValue('set-j2-name', s.job2.name);
  setValue('set-j2-curr', s.job2.currency);
  setValue('set-j2-rate', s.job2.rate);
  setJobPayTypeUI('job2', s.job2.type);

  // Exchange rate & timezones
  setValue('set-exchange', s.exchangeRate);
  setValue('set-primary-tz', s.primaryTz);
  setValue('set-shift-start', s.shiftStart);
  setValue('set-shift-end', s.shiftEnd);
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.value = val;
}

function setJobPayType(jobId, type) {
  const s = loadSettings();
  s[jobId].type = type;
  saveSettingsData(s);
  setJobPayTypeUI(jobId, type);
  renderAll();
}

function setJobPayTypeUI(jobId, type) {
  const isMonthly = type === 'monthly';
  const btnMonthly = document.getElementById(`seg-${jobId === 'job1' ? 'j1' : 'j2'}-monthly`);
  const btnHourly = document.getElementById(`seg-${jobId === 'job1' ? 'j1' : 'j2'}-hourly`);
  const lblRate = document.getElementById(`lbl-${jobId === 'job1' ? 'j1' : 'j2'}-rate`);

  if (btnMonthly) btnMonthly.className = `seg-btn ${isMonthly ? 'active' : ''}`;
  if (btnHourly) btnHourly.className = `seg-btn ${!isMonthly ? 'active' : ''}`;

  if (lblRate) {
    lblRate.textContent = isMonthly ? 'Monthly Salary Amount' : 'Hourly Rate Amount';
  }
}

function saveAllSettings() {
  const s = loadSettings();

  // Job 1
  s.job1.name = document.getElementById('set-j1-name')?.value.trim() || 'Job 1';
  s.job1.currency = document.getElementById('set-j1-curr')?.value || 'IDR';
  s.job1.rate = parseFloat(document.getElementById('set-j1-rate')?.value) || 0;

  // Job 2
  s.job2.name = document.getElementById('set-j2-name')?.value.trim() || 'Job 2';
  s.job2.currency = document.getElementById('set-j2-curr')?.value || 'USD';
  s.job2.rate = parseFloat(document.getElementById('set-j2-rate')?.value) || 0;

  // Global settings
  s.exchangeRate = parseFloat(document.getElementById('set-exchange')?.value) || 15800;
  s.primaryTz = document.getElementById('set-primary-tz')?.value || 'America/New_York';
  s.shiftStart = document.getElementById('set-shift-start')?.value || '09:00';
  s.shiftEnd = document.getElementById('set-shift-end')?.value || '17:00';

  saveSettingsData(s);
  buildOverlapTimeline();
  updateMeetingTime();
  renderAll();
  showToast('Settings updated');
}

// --- Data Export ---
function exportData() {
  const data = {
    settings: loadSettings(),
    sessions: loadSessions(),
    exportDate: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `worktime-buddy-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported');
}

// --- Comprehensive Render Engine ---
function renderAll() {
  const sessions = loadSessions();
  const settings = loadSettings();
  const today = todayStr();

  // Update dynamic job names across UI
  updateJobNamesUI(settings);

  // Filter Today Sessions
  const todaySessions = sessions.filter(s => s.date === today);
  const j1TodayMins = todaySessions.filter(s => s.jobId === 'job1').reduce((sum, s) => sum + s.durationMin, 0);
  const j2TodayMins = todaySessions.filter(s => s.jobId === 'job2').reduce((sum, s) => sum + s.durationMin, 0);

  setText('dash-job1-hours', formatDuration(j1TodayMins));
  setText('dash-job2-hours', formatDuration(j2TodayMins));

  // Monthly Calculations
  const month = state.selectedMonth;
  const year = state.selectedYear;
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const j1MonthMins = monthSessions.filter(s => s.jobId === 'job1').reduce((sum, s) => sum + s.durationMin, 0);
  const j2MonthMins = monthSessions.filter(s => s.jobId === 'job2').reduce((sum, s) => sum + s.durationMin, 0);

  // Dynamic Earnings for Job 1
  let j1Earned = 0;
  if (settings.job1.type === 'monthly') {
    j1Earned = settings.job1.rate;
  } else {
    j1Earned = (j1MonthMins / 60) * settings.job1.rate;
  }

  // Dynamic Earnings for Job 2
  let j2Earned = 0;
  if (settings.job2.type === 'monthly') {
    j2Earned = settings.job2.rate;
  } else {
    j2Earned = (j2MonthMins / 60) * settings.job2.rate;
  }

  // Currency Normalization to IDR & USD
  const exchange = settings.exchangeRate || 15800;

  const j1InIDR = settings.job1.currency === 'USD' ? j1Earned * exchange : j1Earned;
  const j2InIDR = settings.job2.currency === 'USD' ? j2Earned * exchange : j2Earned;
  const totalIDR = j1InIDR + j2InIDR;
  const totalUSD = totalIDR / exchange;

  // Format strings
  const j1Formatted = settings.job1.currency === 'USD' ? formatUSD(j1Earned) : formatIDR(j1Earned);
  const j2Formatted = settings.job2.currency === 'USD' ? formatUSD(j2Earned) : formatIDR(j2Earned);

  // Dashboard preview
  setText('dash-job1-earning', j1Formatted);
  setText('dash-job2-earning', j2Formatted);
  setText('dash-total-earning', formatIDR(totalIDR));

  // Recent Sessions (last 5)
  const recent = [...sessions].sort((a, b) => {
    return (b.date + 'T' + b.startTime).localeCompare(a.date + 'T' + a.startTime);
  }).slice(0, 5);
  renderSessionsList('dash-recent-sessions', recent, true, settings);

  // Timer Tab sessions
  renderSessionsList('timer-sessions', todaySessions, false, settings);

  // Earnings Tab Breakdown
  renderEarningsTab(settings, j1Earned, j2Earned, j1MonthMins, j2MonthMins, totalIDR, totalUSD, monthSessions);

  updateTimerUI();
}

function updateJobNamesUI(settings) {
  // Dashboard
  setText('dash-job1-title', settings.job1.name);
  setText('dash-job2-title', settings.job2.name);
  setText('dash-job1-row-label', settings.job1.name);
  setText('dash-job2-row-label', settings.job2.name);

  // Timer
  setText('timer-btn-job1-title', settings.job1.name);
  setText('timer-btn-job2-title', settings.job2.name);
  setText('timer-job', settings[state.currentJob]?.name || 'Job');
  const opt1 = document.getElementById('manual-opt-job1');
  const opt2 = document.getElementById('manual-opt-job2');
  if (opt1) opt1.textContent = settings.job1.name;
  if (opt2) opt2.textContent = settings.job2.name;

  // Earnings breakdown headers
  setText('earn-job1-title', settings.job1.name);
  setText('earn-job2-title', settings.job2.name);
}

function renderEarningsTab(settings, j1Earned, j2Earned, j1Mins, j2Mins, totalIDR, totalUSD, monthSessions) {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  setText('earnings-month', `${monthNames[state.selectedMonth]} ${state.selectedYear}`);

  setText('total-idr', formatIDR(totalIDR));
  setText('total-usd', `≈ ${formatUSD(totalUSD)} USD`);

  // Job 1
  setText('earn-job1-type-badge', settings.job1.type.toUpperCase());
  setText('earn-job1-rate-label', settings.job1.type === 'monthly' ? 'Monthly Salary' : 'Hourly Rate');
  setText('earn-job1-rate-val', formatRateDisplay(settings.job1.rate, settings.job1.currency, settings.job1.type));
  setText('earn-job1-hours', formatDuration(j1Mins));
  setText('earn-job1-total', settings.job1.currency === 'USD' ? formatUSD(j1Earned) : formatIDR(j1Earned));

  // Job 2
  setText('earn-job2-type-badge', settings.job2.type.toUpperCase());
  setText('earn-job2-rate-label', settings.job2.type === 'monthly' ? 'Monthly Salary' : 'Hourly Rate');
  setText('earn-job2-rate-val', formatRateDisplay(settings.job2.rate, settings.job2.currency, settings.job2.type));
  setText('earn-job2-hours', formatDuration(j2Mins));
  setText('earn-job2-primary-total', settings.job2.currency === 'USD' ? formatUSD(j2Earned) : formatIDR(j2Earned));
  setText('earn-job2-idr', formatIDR(settings.job2.currency === 'USD' ? j2Earned * settings.exchangeRate : j2Earned));

  // Sessions list for earnings tab
  const sorted = [...monthSessions].sort((a, b) => (b.date + 'T' + b.startTime).localeCompare(a.date + 'T' + a.startTime));
  renderSessionsList('earn-sessions', sorted, true, settings);
}

function renderSessionsList(containerId, sessions, showDate, settings) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = '<div class="empty-state">No sessions logged yet</div>';
    return;
  }

  container.innerHTML = sessions.map(s => {
    const isJob1 = s.jobId === 'job1';
    const jobConfig = isJob1 ? settings.job1 : settings.job2;
    const dotClass = isJob1 ? 'job1-dot' : 'job2-dot';
    const dateLabel = showDate ? `<span style="margin-left:4px;color:var(--text-muted)">${formatDate(s.date)}</span>` : '';

    return `
      <div class="session-item">
        <div class="session-dot ${dotClass}"></div>
        <div class="session-info">
          <div class="session-job">${escapeHtml(jobConfig?.name || 'Job')}${dateLabel}</div>
          <div class="session-time">${s.startTime} → ${s.endTime}</div>
          ${s.note ? `<div class="session-note">${escapeHtml(s.note)}</div>` : ''}
        </div>
        <div class="session-duration">${formatDuration(s.durationMin)}</div>
        <button class="session-delete" onclick="deleteSession('${s.id}')" title="Delete">✕</button>
      </div>
    `;
  }).join('');
}

function changeMonth(delta) {
  state.selectedMonth += delta;
  if (state.selectedMonth > 11) {
    state.selectedMonth = 0;
    state.selectedYear++;
  } else if (state.selectedMonth < 0) {
    state.selectedMonth = 11;
    state.selectedYear--;
  }
  renderAll();
}

// --- Utilities ---
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
}

function timeToMinutes(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatIDR(amount) {
  return 'Rp ' + Math.round(amount || 0).toLocaleString('id-ID');
}

function formatUSD(amount) {
  return '$' + (amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatRateDisplay(rate, currency, type) {
  const isHourly = type === 'hourly';
  const suffix = isHourly ? '/hr' : '';
  const num = Number(rate) || 0;
  if (currency === 'USD') {
    return isHourly ? `$${num.toFixed(2)}${suffix}` : `$${num.toLocaleString('en-US')}`;
  } else {
    return `${formatIDR(num)}${suffix}`;
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 250);
  }, 2200);
}

// Boot
document.addEventListener('DOMContentLoaded', init);
