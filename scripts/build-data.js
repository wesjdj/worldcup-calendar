#!/usr/bin/env node
// Generates data/fixtures.json from an inline ET-based schedule.
// All ET times in June/July 2026 are EDT (UTC-4).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const teams = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teams.json'), 'utf8'));

// ---- Group stage --------------------------------------------------------
// Each row: [matchNo, group, home, away, venueId, etDate (YYYY-MM-DD), etTime "HH:MM"]
// etDate is the ET calendar date the match starts on (so 12:00 AM ET June 14 -> "2026-06-14 00:00").
const GS = [
  // Thu Jun 11
  [ 1, 'A', 'MEX', 'RSA', 'azteca',  '2026-06-11', '15:00'],
  [ 2, 'A', 'KOR', 'CZE', 'akron',   '2026-06-11', '22:00'],
  // Fri Jun 12
  [ 3, 'B', 'CAN', 'BIH', 'bmofield','2026-06-12', '15:00'],
  [ 4, 'D', 'USA', 'PAR', 'sofi',    '2026-06-12', '21:00'],
  // Sat Jun 13
  [ 5, 'B', 'QAT', 'SUI', 'levis',   '2026-06-13', '15:00'],
  [ 6, 'C', 'BRA', 'MAR', 'metlife', '2026-06-13', '18:00'],
  [ 7, 'C', 'HAI', 'SCO', 'gillette','2026-06-13', '21:00'],
  // "12 a.m. ET" on the line under June 13 = 00:00 ET on June 14
  [ 8, 'D', 'AUS', 'TUR', 'bcplace', '2026-06-14', '00:00'],
  // Sun Jun 14
  [ 9, 'E', 'GER', 'CUW', 'nrg',     '2026-06-14', '13:00'],
  [10, 'F', 'NED', 'JPN', 'att',     '2026-06-14', '16:00'],
  [11, 'E', 'CIV', 'ECU', 'lincoln', '2026-06-14', '19:00'],
  [12, 'F', 'TUN', 'SWE', 'bbva',    '2026-06-14', '22:00'],
  // Mon Jun 15
  [13, 'H', 'ESP', 'CPV', 'mercedes','2026-06-15', '12:00'],
  [14, 'G', 'BEL', 'EGY', 'lumen',   '2026-06-15', '15:00'],
  [15, 'H', 'KSA', 'URU', 'hardrock','2026-06-15', '18:00'],
  [16, 'G', 'IRN', 'NZL', 'sofi',    '2026-06-15', '21:00'],
  // Tue Jun 16
  [17, 'I', 'FRA', 'SEN', 'metlife', '2026-06-16', '15:00'],
  [18, 'I', 'NOR', 'IRQ', 'gillette','2026-06-16', '18:00'],
  [19, 'J', 'ARG', 'ALG', 'arrowhead','2026-06-16','21:00'],
  [20, 'J', 'AUT', 'JOR', 'levis',   '2026-06-17', '00:00'],
  // Wed Jun 17
  [21, 'K', 'POR', 'COD', 'nrg',     '2026-06-17', '13:00'],
  [22, 'L', 'ENG', 'CRO', 'att',     '2026-06-17', '16:00'],
  [23, 'L', 'GHA', 'PAN', 'bmofield','2026-06-17', '19:00'],
  [24, 'K', 'UZB', 'COL', 'azteca',  '2026-06-17', '22:00'],
  // Thu Jun 18
  [25, 'A', 'RSA', 'CZE', 'mercedes','2026-06-18', '12:00'],
  [26, 'B', 'SUI', 'BIH', 'sofi',    '2026-06-18', '15:00'],
  [27, 'B', 'CAN', 'QAT', 'bcplace', '2026-06-18', '18:00'],
  [28, 'A', 'MEX', 'KOR', 'akron',   '2026-06-18', '21:00'],
  // Fri Jun 19
  [29, 'D', 'USA', 'AUS', 'lumen',   '2026-06-19', '15:00'],
  [30, 'C', 'SCO', 'MAR', 'gillette','2026-06-19', '15:00'],
  [31, 'C', 'BRA', 'HAI', 'lincoln', '2026-06-19', '21:00'],
  [32, 'D', 'PAR', 'TUR', 'levis',   '2026-06-20', '00:00'],
  // Sat Jun 20
  [33, 'F', 'NED', 'SWE', 'nrg',     '2026-06-20', '13:00'],
  [34, 'E', 'GER', 'CIV', 'bmofield','2026-06-20', '16:00'],
  [35, 'E', 'ECU', 'CUW', 'arrowhead','2026-06-20','20:00'],
  [36, 'F', 'TUN', 'JPN', 'bbva',    '2026-06-21', '00:00'],
  // Sun Jun 21
  [37, 'H', 'ESP', 'KSA', 'mercedes','2026-06-21', '12:00'],
  [38, 'G', 'BEL', 'IRN', 'sofi',    '2026-06-21', '15:00'],
  [39, 'H', 'URU', 'CPV', 'hardrock','2026-06-21', '18:00'],
  [40, 'G', 'NZL', 'EGY', 'bcplace', '2026-06-21', '21:00'],
  // Mon Jun 22
  [41, 'J', 'ARG', 'AUT', 'att',     '2026-06-22', '13:00'],
  [42, 'I', 'FRA', 'IRQ', 'lincoln', '2026-06-22', '17:00'],
  [43, 'I', 'NOR', 'SEN', 'metlife', '2026-06-22', '20:00'],
  [44, 'J', 'JOR', 'ALG', 'levis',   '2026-06-22', '23:00'],
  // Tue Jun 23
  [45, 'K', 'POR', 'UZB', 'nrg',     '2026-06-23', '13:00'],
  [46, 'L', 'ENG', 'GHA', 'gillette','2026-06-23', '16:00'],
  [47, 'L', 'PAN', 'CRO', 'bmofield','2026-06-23', '19:00'],
  [48, 'K', 'COL', 'COD', 'akron',   '2026-06-23', '22:00'],
  // Wed Jun 24
  [49, 'B', 'CAN', 'SUI', 'bcplace', '2026-06-24', '15:00'],
  [50, 'B', 'QAT', 'BIH', 'lumen',   '2026-06-24', '15:00'],
  [51, 'C', 'SCO', 'BRA', 'hardrock','2026-06-24', '18:00'],
  [52, 'C', 'MAR', 'HAI', 'mercedes','2026-06-24', '18:00'],
  [53, 'A', 'MEX', 'CZE', 'azteca',  '2026-06-24', '21:00'],
  [54, 'A', 'KOR', 'RSA', 'bbva',    '2026-06-24', '21:00'],
  // Thu Jun 25
  [55, 'E', 'ECU', 'GER', 'metlife', '2026-06-25', '16:00'],
  [56, 'E', 'CUW', 'CIV', 'lincoln', '2026-06-25', '16:00'],
  [57, 'F', 'TUN', 'NED', 'arrowhead','2026-06-25','19:00'],
  [58, 'F', 'JPN', 'SWE', 'att',     '2026-06-25', '19:00'],
  [59, 'D', 'USA', 'TUR', 'sofi',    '2026-06-25', '22:00'],
  [60, 'D', 'PAR', 'AUS', 'levis',   '2026-06-25', '22:00'],
  // Fri Jun 26
  [61, 'I', 'NOR', 'FRA', 'gillette','2026-06-26', '15:00'],
  [62, 'I', 'SEN', 'IRQ', 'bmofield','2026-06-26', '15:00'],
  [63, 'H', 'URU', 'ESP', 'akron',   '2026-06-26', '20:00'],
  [64, 'H', 'CPV', 'KSA', 'nrg',     '2026-06-26', '20:00'],
  [65, 'G', 'NZL', 'BEL', 'bcplace', '2026-06-26', '23:00'],
  [66, 'G', 'EGY', 'IRN', 'lumen',   '2026-06-26', '23:00'],
  // Sat Jun 27
  [67, 'L', 'PAN', 'ENG', 'metlife', '2026-06-27', '17:00'],
  [68, 'L', 'CRO', 'GHA', 'lincoln', '2026-06-27', '17:00'],
  [69, 'K', 'COL', 'POR', 'hardrock','2026-06-27', '19:30'],
  [70, 'K', 'UZB', 'COD', 'mercedes','2026-06-27', '19:30'],
  [71, 'J', 'JOR', 'ARG', 'att',     '2026-06-27', '22:00'],
  [72, 'J', 'ALG', 'AUT', 'arrowhead','2026-06-27','22:00'],
];

// ---- Knockouts ---------------------------------------------------------
// Placeholder string formats parsed by makeSlot():
//   "W:A"   = Winner of Group A
//   "R:A"   = Runner-up of Group A
//   "3:A,B,C,D,F" = Third place from one of those groups
//   "M:74"  = Winner of Match 74
//   "ML:101"= Loser of Match 101 (used for bronze final)

const KO = [
  // [matchNo, stage, homeRef, awayRef, venueId, etDate, etTime]
  // Round of 32 (per soccergraph)
  [73, 'R32', 'R:A', 'R:B',         'sofi',     '2026-06-28', '15:00'],
  [74, 'R32', 'W:E', '3:A,B,C,D,F', 'gillette', '2026-06-29', '16:30'],
  [75, 'R32', 'W:F', 'R:C',         'bbva',     '2026-06-29', '21:00'],
  [76, 'R32', 'W:C', 'R:F',         'nrg',      '2026-06-29', '13:00'],
  [77, 'R32', 'W:I', '3:C,D,F,G,H', 'metlife',  '2026-06-30', '17:00'],
  [78, 'R32', 'R:E', 'R:I',         'att',      '2026-06-30', '13:00'],
  [79, 'R32', 'W:A', '3:C,E,F,H,I', 'azteca',   '2026-06-30', '21:00'],
  [80, 'R32', 'W:L', '3:E,H,I,J,K', 'mercedes', '2026-07-01', '12:00'],
  [81, 'R32', 'W:D', '3:B,E,F,I,J', 'levis',    '2026-07-01', '20:00'],
  [82, 'R32', 'W:G', '3:A,E,H,I,J', 'lumen',    '2026-07-01', '16:00'],
  [83, 'R32', 'R:K', 'R:L',         'bmofield', '2026-07-02', '19:00'],
  [84, 'R32', 'W:H', 'R:J',         'sofi',     '2026-07-02', '15:00'],
  [85, 'R32', 'W:B', '3:E,F,G,I,J', 'bcplace',  '2026-07-02', '23:00'],
  [86, 'R32', 'W:J', 'R:H',         'hardrock', '2026-07-03', '18:00'],
  [87, 'R32', 'W:K', '3:D,E,I,J,L', 'arrowhead','2026-07-03', '21:30'],
  [88, 'R32', 'R:D', 'R:G',         'att',      '2026-07-03', '14:00'],
  // Round of 16
  [89, 'R16', 'M:74', 'M:77', 'lincoln', '2026-07-04', '17:00'],
  [90, 'R16', 'M:73', 'M:75', 'nrg',     '2026-07-04', '13:00'],
  [91, 'R16', 'M:76', 'M:78', 'metlife', '2026-07-05', '16:00'],
  [92, 'R16', 'M:79', 'M:80', 'azteca',  '2026-07-05', '20:00'],
  [93, 'R16', 'M:83', 'M:84', 'att',     '2026-07-06', '15:00'],
  [94, 'R16', 'M:81', 'M:82', 'lumen',   '2026-07-06', '20:00'],
  [95, 'R16', 'M:86', 'M:88', 'mercedes','2026-07-07', '12:00'],
  [96, 'R16', 'M:85', 'M:87', 'bcplace', '2026-07-07', '16:00'],
  // Quarter-finals
  [97,  'QF', 'M:89', 'M:90', 'gillette','2026-07-09', '16:00'],
  [98,  'QF', 'M:93', 'M:94', 'sofi',    '2026-07-10', '15:00'],
  [99,  'QF', 'M:91', 'M:92', 'hardrock','2026-07-11', '17:00'],
  [100, 'QF', 'M:95', 'M:96', 'arrowhead','2026-07-11','21:00'],
  // Semis
  [101, 'SF', 'M:97', 'M:98',  'att',     '2026-07-14', '15:00'],
  [102, 'SF', 'M:99', 'M:100', 'mercedes','2026-07-15', '15:00'],
  // Bronze
  [103, '3RD','ML:101','ML:102','hardrock','2026-07-18', '17:00'],
  // Final
  [104, 'F',  'M:101','M:102', 'metlife', '2026-07-19', '15:00'],
];

// ---- Build --------------------------------------------------------------

function etToUtcIso(date, time) {
  // date "YYYY-MM-DD", time "HH:MM" interpreted as ET (EDT, UTC-4 in Jun/Jul 2026)
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Construct an EDT moment: UTC = ET + 4h
  const dt = new Date(Date.UTC(y, m - 1, d, hh + 4, mm, 0));
  return dt.toISOString().replace('.000', '');
}

const teamsByGroup = {};
for (const [code, t] of Object.entries(teams)) {
  (teamsByGroup[t.group] ||= []).push(code);
}

const fixturesById = {};

// Group stage first
for (const [matchNo, group, home, away, venueId, date, time] of GS) {
  fixturesById[matchNo] = {
    id: matchNo,
    stage: 'GS',
    group,
    home: { team: home },
    away: { team: away },
    venueId,
    kickoffUTC: etToUtcIso(date, time),
  };
}

function makeSlot(ref) {
  // returns { label, potentialTeams: [codes], placeholder: ref }
  if (ref.startsWith('W:') || ref.startsWith('R:')) {
    const g = ref.slice(2);
    const label = (ref[0] === 'W' ? 'Winner Group ' : 'Runner-up Group ') + g;
    return { label, placeholder: ref, potentialTeams: teamsByGroup[g].slice() };
  }
  if (ref.startsWith('3:')) {
    const groups = ref.slice(2).split(',');
    const label = '3rd Group ' + groups.join('/');
    const pt = [];
    for (const g of groups) for (const t of teamsByGroup[g]) pt.push(t);
    return { label, placeholder: ref, potentialTeams: Array.from(new Set(pt)) };
  }
  if (ref.startsWith('ML:') || ref.startsWith('M:')) {
    const isLoser = ref.startsWith('ML:');
    const refMatch = Number(ref.slice(isLoser ? 3 : 2));
    const f = fixturesById[refMatch];
    if (!f) throw new Error('Unresolved match ref ' + ref);
    const homePT = f.home.team ? [f.home.team] : f.home.potentialTeams;
    const awayPT = f.away.team ? [f.away.team] : f.away.potentialTeams;
    const pt = Array.from(new Set([...homePT, ...awayPT]));
    return {
      label: (isLoser ? 'Loser Match ' : 'Winner Match ') + refMatch,
      placeholder: ref,
      potentialTeams: pt,
    };
  }
  throw new Error('Unknown ref ' + ref);
}

for (const [matchNo, stage, h, a, venueId, date, time] of KO) {
  fixturesById[matchNo] = {
    id: matchNo,
    stage,
    group: null,
    home: makeSlot(h),
    away: makeSlot(a),
    venueId,
    kickoffUTC: etToUtcIso(date, time),
  };
}

// ---- Apply live overrides ----------------------------------------------
// data/overrides.json is a patch layer maintained by scripts/update-fixtures.js
// (auto-updated from a live results feed). It resolves knockout placeholders to
// real teams, corrects kick-off times/venues, and records scores. Missing file
// or empty object = pure curated schedule, so the build still works offline.
const overridesPath = path.join(DATA_DIR, 'overrides.json');
if (fs.existsSync(overridesPath)) {
  const venues = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'venues.json'), 'utf8'));
  let overrides = {};
  try {
    overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  } catch (e) {
    console.warn('Skipping overrides.json (unparseable):', e.message);
  }
  let applied = 0;
  for (const [idStr, ov] of Object.entries(overrides)) {
    const f = fixturesById[Number(idStr)];
    if (!f) continue;
    if (ov.home && teams[ov.home]) f.home = { team: ov.home };
    if (ov.away && teams[ov.away]) f.away = { team: ov.away };
    if (ov.venueId && venues[ov.venueId]) f.venueId = ov.venueId;
    if (ov.kickoffUTC) f.kickoffUTC = ov.kickoffUTC;
    if (ov.homeScore != null) f.homeScore = ov.homeScore;
    if (ov.awayScore != null) f.awayScore = ov.awayScore;
    if (ov.homePens != null) f.homePens = ov.homePens;
    if (ov.awayPens != null) f.awayPens = ov.awayPens;
    if (ov.status) f.status = ov.status;
    applied += 1;
  }
  if (applied) console.log(`Applied ${applied} live override(s).`);
}

// Compute potentialTeams for every fixture (group-stage = the two teams)
const fixtures = Object.values(fixturesById).sort((a, b) => a.id - b.id);
for (const f of fixtures) {
  const h = f.home.team ? [f.home.team] : f.home.potentialTeams;
  const a = f.away.team ? [f.away.team] : f.away.potentialTeams;
  f.potentialTeams = Array.from(new Set([...h, ...a])).sort();
}

const out = path.join(DATA_DIR, 'fixtures.json');
fs.writeFileSync(out, JSON.stringify(fixtures, null, 2) + '\n');
console.log(`Wrote ${fixtures.length} fixtures to ${out}`);
