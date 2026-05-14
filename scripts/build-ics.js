#!/usr/bin/env node
// Generates feeds/*.ics from data/fixtures.json.
// Each VEVENT uses TZID + local clock time so calendar clients render the
// correct kick-off in the viewer's timezone, including DST handling.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'feeds');

const fixtures = JSON.parse(fs.readFileSync(path.join(DATA, 'fixtures.json'), 'utf8'));
const venues   = JSON.parse(fs.readFileSync(path.join(DATA, 'venues.json'), 'utf8'));
const teams    = JSON.parse(fs.readFileSync(path.join(DATA, 'teams.json'), 'utf8'));

fs.mkdirSync(OUT, { recursive: true });

// VTIMEZONE definitions for every IANA zone we use.
const VTZ = {
  'America/New_York': [
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Chicago': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Chicago',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0500',
    'TZNAME:CDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Los_Angeles': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Los_Angeles',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0800',
    'TZOFFSETTO:-0700',
    'TZNAME:PDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0800',
    'TZNAME:PST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Toronto': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Toronto',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Vancouver': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Vancouver',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0800',
    'TZOFFSETTO:-0700',
    'TZNAME:PDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0800',
    'TZNAME:PST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n'),
  // Mexico abolished DST in 2022 — no DST blocks needed.
  'America/Mexico_City': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Mexico_City',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'DTSTART:20221030T020000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n'),
  'America/Monterrey': [
    'BEGIN:VTIMEZONE',
    'TZID:America/Monterrey',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'DTSTART:20221030T020000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n'),
};

function localPartsAt(utcIso, tz) {
  const d = new Date(utcIso);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  // Some browsers/Node return "24" for midnight — normalise to "00".
  if (parts.hour === '24') parts.hour = '00';
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function utcStamp(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function slotLabel(slot) {
  if (slot.team) {
    const t = teams[slot.team];
    return `${t.flag} ${t.name}`;
  }
  return slot.label;
}

function plainSlot(slot) {
  if (slot.team) return teams[slot.team].name;
  return slot.label;
}

function escapeIcs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function fold(line) {
  // RFC 5545: lines >75 octets must be folded with CRLF + space.
  // Approximation by characters is fine for our content.
  if (line.length <= 75) return line;
  const out = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
    i += 73;
  }
  return out.join('\r\n');
}

function buildEvent(f) {
  const v = venues[f.venueId];
  const start = localPartsAt(f.kickoffUTC, v.tz);
  // 2 hour duration
  const endUtc = new Date(new Date(f.kickoffUTC).getTime() + 2 * 60 * 60 * 1000).toISOString();
  const end = localPartsAt(endUtc, v.tz);

  const stageName = {
    GS: f.group ? `Group ${f.group}` : 'Group stage',
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF: 'Quarter-final',
    SF: 'Semi-final',
    '3RD': 'Third-place play-off',
    F: 'Final',
  }[f.stage] || f.stage;

  const summary = `WC26 #${f.id} — ${plainSlot(f.home)} vs ${plainSlot(f.away)} (${stageName})`;
  const location = `${v.name}, ${v.city}, ${v.country}`;
  const description = [
    `Match ${f.id} — ${stageName}`,
    `${slotLabel(f.home)} vs ${slotLabel(f.away)}`,
    `Venue: ${v.name} (${v.fifaName}), ${v.city}`,
    `Kick-off: local time at venue is built into this calendar entry.`,
  ].join('\\n');

  const lines = [
    'BEGIN:VEVENT',
    `UID:wc2026-match-${f.id}@worldcup-calendar`,
    `DTSTAMP:${utcStamp(new Date().toISOString())}`,
    `DTSTART;TZID=${v.tz}:${start}`,
    `DTEND;TZID=${v.tz}:${end}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `CATEGORIES:${escapeIcs('FIFA World Cup 2026,' + stageName)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
  return lines.map(fold).join('\r\n');
}

function buildCalendar(name, list) {
  const usedTz = Array.from(new Set(list.map(f => venues[f.venueId].tz)));
  const head = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//worldcup-calendar//worldcup-2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escapeIcs(name)}`,
    `X-WR-CALNAME:${escapeIcs(name)}`,
    'X-WR-TIMEZONE:UTC',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  const tz = usedTz.map(z => VTZ[z]).filter(Boolean);
  const events = list.map(buildEvent);
  return [...head, ...tz, ...events, 'END:VCALENDAR', ''].join('\r\n');
}

function write(filename, content) {
  const p = path.join(OUT, filename);
  fs.writeFileSync(p, content);
  return p;
}

// All matches
write('all.ics', buildCalendar('FIFA World Cup 2026 — All matches', fixtures));

// Per group
const groups = Array.from(new Set(Object.values(teams).map(t => t.group))).sort();
for (const g of groups) {
  const list = fixtures.filter(f => f.potentialTeams.some(t => teams[t].group === g) || f.group === g);
  write(`group-${g.toLowerCase()}.ics`, buildCalendar(`FIFA World Cup 2026 — Group ${g}`, list));
}

// Per team
let teamCount = 0;
for (const [code, t] of Object.entries(teams)) {
  const list = fixtures.filter(f => f.potentialTeams.includes(code));
  write(`team-${code.toLowerCase()}.ics`, buildCalendar(`FIFA World Cup 2026 — ${t.name}`, list));
  teamCount++;
}

console.log(`Wrote feeds: all + ${groups.length} groups + ${teamCount} teams`);
