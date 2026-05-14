// Frontend logic — vanilla JS, no build step.
// Loads schedule + venues + teams, renders filtered match list and wires the
// "Add to calendar" controls (subscription URLs + per-match .ics download).

const VTZ = {
  // VTIMEZONE blocks for the per-match .ics generated client-side.
  // Mirror of scripts/build-ics.js so single-event downloads carry venue tz too.
  'America/New_York': `BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0400\r\nTZNAME:EDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500\r\nTZNAME:EST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE`,
  'America/Chicago': `BEGIN:VTIMEZONE\r\nTZID:America/Chicago\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0600\r\nTZOFFSETTO:-0500\r\nTZNAME:CDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0600\r\nTZNAME:CST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE`,
  'America/Los_Angeles': `BEGIN:VTIMEZONE\r\nTZID:America/Los_Angeles\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0800\r\nTZOFFSETTO:-0700\r\nTZNAME:PDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0700\r\nTZOFFSETTO:-0800\r\nTZNAME:PST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE`,
  'America/Toronto': `BEGIN:VTIMEZONE\r\nTZID:America/Toronto\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0400\r\nTZNAME:EDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500\r\nTZNAME:EST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE`,
  'America/Vancouver': `BEGIN:VTIMEZONE\r\nTZID:America/Vancouver\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0800\r\nTZOFFSETTO:-0700\r\nTZNAME:PDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0700\r\nTZOFFSETTO:-0800\r\nTZNAME:PST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE`,
  'America/Mexico_City': `BEGIN:VTIMEZONE\r\nTZID:America/Mexico_City\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0600\r\nTZOFFSETTO:-0600\r\nTZNAME:CST\r\nDTSTART:20221030T020000\r\nEND:STANDARD\r\nEND:VTIMEZONE`,
  'America/Monterrey': `BEGIN:VTIMEZONE\r\nTZID:America/Monterrey\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0600\r\nTZOFFSETTO:-0600\r\nTZNAME:CST\r\nDTSTART:20221030T020000\r\nEND:STANDARD\r\nEND:VTIMEZONE`,
};

const STAGE_NAMES = {
  GS: 'Group stage',
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  '3RD': 'Third-place play-off',
  F: 'Final',
};

const state = {
  fixtures: [],
  teams: {},
  venues: {},
  selectedTeams: new Set(),
  group: '',
  stage: '',
  country: '',
};

const els = {
  fixtures:   document.getElementById('fixtures'),
  resultsH:   document.getElementById('results-heading'),
  teamFilter: document.getElementById('team-filter'),
  groupF:     document.getElementById('group-filter'),
  stageF:     document.getElementById('stage-filter'),
  countryF:   document.getElementById('country-filter'),
  clearBtn:   document.getElementById('clear-filters'),
  tzLabel:    document.getElementById('viewer-tz'),
  subTitle:   document.getElementById('subscribe-title'),
  subSummary: document.getElementById('subscribe-summary'),
  btnApple:   document.getElementById('btn-apple'),
  btnGoogle:  document.getElementById('btn-google'),
  btnOutlook: document.getElementById('btn-outlook'),
  btnDownload:document.getElementById('btn-download'),
  btnCopy:    document.getElementById('btn-copy'),
  matchTpl:   document.getElementById('match-tpl'),
};

const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
els.tzLabel.textContent = viewerTz;

(async function init() {
  const [fixtures, teams, venues] = await Promise.all([
    fetch('data/fixtures.json').then(r => r.json()),
    fetch('data/teams.json').then(r => r.json()),
    fetch('data/venues.json').then(r => r.json()),
  ]);
  state.fixtures = fixtures;
  state.teams = teams;
  state.venues = venues;

  buildTeamChips();
  buildGroupOptions();
  bindEvents();
  render();
})();

function buildTeamChips() {
  const groups = {};
  for (const [code, t] of Object.entries(state.teams)) {
    (groups[t.group] ||= []).push(code);
  }
  const frag = document.createDocumentFragment();
  for (const g of Object.keys(groups).sort()) {
    const sub = document.createElement('div');
    sub.className = 'chip-grid__group';
    sub.style.cssText = 'flex-basis: 100%; font-size: .75rem; color: var(--ink-soft); padding: 4px 2px 0;';
    sub.textContent = `Group ${g}`;
    frag.appendChild(sub);
    for (const code of groups[g]) {
      const t = state.teams[code];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.code = code;
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = `<span aria-hidden="true">${t.flag}</span>${t.name}`;
      btn.addEventListener('click', () => {
        if (state.selectedTeams.has(code)) state.selectedTeams.delete(code);
        else state.selectedTeams.add(code);
        btn.setAttribute('aria-pressed', state.selectedTeams.has(code) ? 'true' : 'false');
        render();
      });
      frag.appendChild(btn);
    }
  }
  els.teamFilter.appendChild(frag);
}

function buildGroupOptions() {
  const groups = Array.from(new Set(Object.values(state.teams).map(t => t.group))).sort();
  for (const g of groups) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = `Group ${g}`;
    els.groupF.appendChild(opt);
  }
}

function bindEvents() {
  els.groupF.addEventListener('change', e => { state.group = e.target.value; render(); });
  els.stageF.addEventListener('change', e => { state.stage = e.target.value; render(); });
  els.countryF.addEventListener('change', e => { state.country = e.target.value; render(); });
  els.clearBtn.addEventListener('click', () => {
    state.selectedTeams.clear();
    state.group = ''; state.stage = ''; state.country = '';
    els.groupF.value = ''; els.stageF.value = ''; els.countryF.value = '';
    document.querySelectorAll('.chip[aria-pressed="true"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    render();
  });
  els.btnCopy.addEventListener('click', async () => {
    const url = currentFeedUrl(true);
    try {
      await navigator.clipboard.writeText(url);
      toast('Feed URL copied');
    } catch {
      window.prompt('Copy this URL:', url);
    }
  });
}

function filteredFixtures() {
  return state.fixtures.filter(f => {
    if (state.group && f.group !== state.group && !f.potentialTeams.some(t => state.teams[t].group === state.group)) return false;
    if (state.stage && f.stage !== state.stage) return false;
    if (state.country && state.venues[f.venueId].country !== state.country) return false;
    if (state.selectedTeams.size > 0) {
      const teamMatch = f.potentialTeams.some(t => state.selectedTeams.has(t));
      if (!teamMatch) return false;
    }
    return true;
  });
}

function currentFeedFilename() {
  // Prefer per-team or per-group when exactly one is selected.
  if (state.selectedTeams.size === 1 && !state.group && !state.stage && !state.country) {
    const code = Array.from(state.selectedTeams)[0].toLowerCase();
    return `team-${code}.ics`;
  }
  if (state.selectedTeams.size === 0 && state.group && !state.stage && !state.country) {
    return `group-${state.group.toLowerCase()}.ics`;
  }
  return 'all.ics';
}

function feedAbsoluteUrl(filename) {
  // The feeds/ directory sits next to index.html; build an absolute URL.
  return new URL(`feeds/${filename}`, location.href).toString();
}

function currentFeedUrl(absolute = false) {
  const filename = currentFeedFilename();
  const url = feedAbsoluteUrl(filename);
  return absolute ? url : url;
}

function describeCurrentFilter() {
  const parts = [];
  if (state.selectedTeams.size === 1) {
    const code = Array.from(state.selectedTeams)[0];
    parts.push(`${state.teams[code].flag} ${state.teams[code].name}`);
  } else if (state.selectedTeams.size > 1) {
    parts.push(`${state.selectedTeams.size} teams`);
  }
  if (state.group) parts.push(`Group ${state.group}`);
  if (state.stage) parts.push(STAGE_NAMES[state.stage]);
  if (state.country) parts.push(state.country);
  return parts.length === 0 ? 'all 104 matches' : parts.join(' · ');
}

function updateSubscribePanel(count) {
  const filename = currentFeedFilename();
  const httpsUrl = feedAbsoluteUrl(filename);
  const webcalUrl = httpsUrl.replace(/^https?:/, 'webcal:');
  const description = describeCurrentFilter();

  let title = 'Add to your calendar';
  if (filename.startsWith('team-')) title = `Subscribe to ${description}`;
  else if (filename.startsWith('group-')) title = `Subscribe to ${description}`;
  else title = 'Subscribe to all 104 matches';
  els.subTitle.textContent = title;

  let summary = `Filter: ${description} (${count} match${count === 1 ? '' : 'es'}).`;
  if (filename === 'all.ics' && (state.selectedTeams.size > 1 || state.stage || state.country)) {
    summary += ' Subscribing will add every fixture; use your calendar app to filter further if needed. (Per-team and per-group feeds match a single selection only.)';
  } else {
    summary += ' Knockout placeholders will update automatically as group results are confirmed.';
  }
  els.subSummary.textContent = summary;

  els.btnApple.href = webcalUrl;
  els.btnDownload.href = httpsUrl;
  els.btnDownload.setAttribute('download', filename);
  els.btnGoogle.href = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`;
  els.btnOutlook.href = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(title)}`;
}

function render() {
  const list = filteredFixtures();
  els.resultsH.textContent = `${list.length} ${list.length === 1 ? 'match' : 'matches'}`;
  updateSubscribePanel(list.length);
  els.fixtures.innerHTML = '';

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No matches for the current filters.';
    els.fixtures.appendChild(empty);
    return;
  }

  // Group by viewer-local date.
  const byDate = new Map();
  for (const f of list) {
    const key = formatDateKey(f.kickoffUTC);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(f);
  }
  const sortedKeys = Array.from(byDate.keys()).sort();
  for (const key of sortedKeys) {
    const dayEl = document.createElement('section');
    dayEl.className = 'day-group';
    const head = document.createElement('div');
    head.className = 'day-group__header';
    head.textContent = formatDateHeader(byDate.get(key)[0].kickoffUTC);
    dayEl.appendChild(head);
    for (const f of byDate.get(key)) dayEl.appendChild(renderMatch(f));
    els.fixtures.appendChild(dayEl);
  }
}

function renderMatch(f) {
  const v = state.venues[f.venueId];
  const node = els.matchTpl.content.cloneNode(true);
  const root = node.querySelector('.match');

  const localTime = new Date(f.kickoffUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const venueTime = new Date(f.kickoffUTC).toLocaleString([], {
    timeZone: v.tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  const localTimeEl = node.querySelector('.match__time-local');
  localTimeEl.textContent = localTime;
  localTimeEl.title = `Venue local: ${venueTime}`;
  localTimeEl.setAttribute('datetime', f.kickoffUTC);
  node.querySelector('.match__time-venue').textContent = `Venue: ${venueTime}`;

  node.querySelector('.match__home').innerHTML = slotMarkup(f.home);
  node.querySelector('.match__away').innerHTML = slotMarkup(f.away);

  const stageLabel = f.stage === 'GS' ? `Group ${f.group}` : STAGE_NAMES[f.stage];
  node.querySelector('.match__meta').textContent = `Match ${f.id} · ${stageLabel} · ${v.name}, ${v.city}`;

  const addBtn = node.querySelector('.match__add');
  addBtn.addEventListener('click', () => downloadSingleMatch(f));

  return root;
}

function slotMarkup(slot) {
  if (slot.team) {
    const t = state.teams[slot.team];
    return `<span aria-hidden="true">${t.flag}</span> ${escapeHtml(t.name)}`;
  }
  return `<span class="placeholder">${escapeHtml(slot.label)}</span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function formatDateKey(iso) {
  // Use viewer-local date so matches from a single calendar day group together.
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-CA').format(d); // YYYY-MM-DD in viewer tz
}

function formatDateHeader(iso) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

// ----- Per-match .ics generated client-side --------------------------------

function pad(n) { return String(n).padStart(2, '0'); }

function localPartsAt(utcIso, tz) {
  const d = new Date(utcIso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  if (parts.hour === '24') parts.hour = '00';
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function utcStamp(date = new Date()) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function plainSlot(slot) {
  if (slot.team) return state.teams[slot.team].name;
  return slot.label;
}

function singleMatchIcs(f) {
  const v = state.venues[f.venueId];
  const start = localPartsAt(f.kickoffUTC, v.tz);
  const end = localPartsAt(new Date(new Date(f.kickoffUTC).getTime() + 2*60*60*1000).toISOString(), v.tz);
  const stage = f.stage === 'GS' ? `Group ${f.group}` : STAGE_NAMES[f.stage];
  const summary = `WC26 #${f.id} — ${plainSlot(f.home)} vs ${plainSlot(f.away)} (${stage})`;
  const location = `${v.name}, ${v.city}, ${v.country}`;
  const description = `Match ${f.id} — ${stage}\\nVenue: ${v.name} (${v.fifaName}), ${v.city}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//worldcup-calendar//worldcup-2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    VTZ[v.tz] || '',
    'BEGIN:VEVENT',
    `UID:wc2026-match-${f.id}@worldcup-calendar`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART;TZID=${v.tz}:${start}`,
    `DTEND;TZID=${v.tz}:${end}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].filter(Boolean).join('\r\n');
}

function downloadSingleMatch(f) {
  const ics = singleMatchIcs(f);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wc26-match-${f.id}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}
