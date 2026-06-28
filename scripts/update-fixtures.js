#!/usr/bin/env node
// Auto-updates data/overrides.json from FIFA's public match API.
//
// The curated schedule lives in build-data.js (hardcoded). This script never
// touches that base; it only writes a patch layer (data/overrides.json) that
// build-data.js applies on top. Live data resolves knockout placeholders ->
// real teams, corrects kick-off times, and records scores, while the hand-built
// schedule stays the source of truth for everything else.
//
// Source: https://api.fifa.com/api/v3/calendar/matches  (no API key required).
// FIFA's `MatchNumber` (1..104) maps 1:1 to this repo's fixture ids, so matching
// is exact — no fuzzy time/venue heuristics.
//
// Overrides are *merged* with any existing file, so a transient empty/failed
// response never wipes already-resolved fixtures.

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const teams = JSON.parse(fs.readFileSync(path.join(DATA, 'teams.json'), 'utf8'));
const venues = JSON.parse(fs.readFileSync(path.join(DATA, 'venues.json'), 'utf8'));
const fixtures = JSON.parse(fs.readFileSync(path.join(DATA, 'fixtures.json'), 'utf8'));
const overridesPath = path.join(DATA, 'overrides.json');

const COMP = process.env.WC_COMPETITION_ID || '17'; // 17 = FIFA World Cup (men)
const FROM = process.env.WC_FROM || '2026-06-01';
const TO = process.env.WC_TO || '2026-07-31';
const COUNT = process.env.WC_COUNT || '200';
const API = `https://api.fifa.com/api/v3/calendar/matches?idCompetition=${COMP}&from=${FROM}&to=${TO}&count=${COUNT}&language=en`;

// ---- helpers ------------------------------------------------------------
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const isoZ = (d) => new Date(d).toISOString().replace('.000', '');

// FIFA's localized fields are arrays of { Locale, Description }.
const desc = (a) =>
  Array.isArray(a) ? (a.find((x) => /en/i.test(x.Locale)) || a[0] || {}).Description : a;

// team name -> 3-letter code (teams.json names + FIFA's spellings)
const nameToCode = {};
for (const [code, t] of Object.entries(teams)) nameToCode[norm(t.name)] = code;
for (const [name, code] of [
  ['USA', 'USA'], ['United States', 'USA'],
  ['Korea Republic', 'KOR'], ['South Korea', 'KOR'],
  ['IR Iran', 'IRN'], ['Iran', 'IRN'],
  ["Côte d'Ivoire", 'CIV'], ['Ivory Coast', 'CIV'],
  ['Cabo Verde', 'CPV'], ['Cape Verde', 'CPV'],
  ['Congo DR', 'COD'], ['DR Congo', 'COD'],
  ['Czechia', 'CZE'], ['Czech Republic', 'CZE'],
  ['Türkiye', 'TUR'], ['Turkey', 'TUR'],
  ['Curaçao', 'CUW'],
  ['Bosnia and Herzegovina', 'BIH'],
  ['Saudi Arabia', 'KSA'],
]) nameToCode[norm(name)] = code;
const codeFor = (name) => nameToCode[norm(name)] || null;

// FIFA stadium name -> venueId (best-effort; only used to detect venue changes)
const venueToId = {};
for (const [id, v] of Object.entries(venues)) {
  venueToId[norm(v.name)] = id;
  venueToId[norm(v.fifaName)] = id;
}
const venueIdFor = (name) => venueToId[norm(name)] || null;

// FIFA MatchStatus: 0 finished, 1 not started, 3 live (others passed through).
const statusLabel = (m) => {
  switch (m.MatchStatus) {
    case 0:
      return m.HomeTeamPenaltyScore != null && m.AwayTeamPenaltyScore != null ? 'PEN' : 'FT';
    case 1:
      return 'NS';
    case 3:
      return 'LIVE';
    default:
      return String(m.MatchStatus);
  }
};
const hasScore = (m) => [0, 3].includes(m.MatchStatus) && m.HomeTeamScore != null && m.AwayTeamScore != null;

const refereeOf = (m) => {
  const ref = (m.Officials || []).find((o) => o.OfficialType === 1);
  return ref ? desc(ref.NameShort || ref.Name) : null;
};

// Goalscorers come from a per-match timeline endpoint (Type 0 = "Goal!").
async function fetchScorers(m) {
  const url = `https://api.fifa.com/api/v3/timelines/${COMP}/${m.IdSeason}/${m.IdStage}/${m.IdMatch}?language=en`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const out = [];
    for (const e of json.Event || []) {
      if (e.Type !== 0) continue; // 0 = Goal!
      const text = desc(e.EventDescription) || '';
      const name = (text.split(' (')[0] || '').trim();
      if (!name) continue;
      out.push({
        side: e.IdTeam === m.Home?.IdTeam ? 'home' : 'away',
        name,
        minute: String(e.MatchMinute || '').trim(),
        own: /own goal/i.test(text),
      });
    }
    return out;
  } catch (e) {
    console.warn(`Timeline fetch failed for match ${m.MatchNumber}:`, e.message);
    return null;
  }
}

const byId = {};
for (const f of fixtures) byId[f.id] = f;

// ---- build override entry for one FIFA match ----------------------------
function buildOverride(m, base) {
  const ov = {};

  // Resolve knockout placeholders only (group-stage teams are already curated).
  if (base.stage !== 'GS') {
    if (m.Home?.IdTeam) {
      const c = codeFor(desc(m.Home.TeamName));
      if (c) ov.home = c;
      else console.warn(`Unmapped team "${desc(m.Home.TeamName)}" (match ${m.MatchNumber})`);
    }
    if (m.Away?.IdTeam) {
      const c = codeFor(desc(m.Away.TeamName));
      if (c) ov.away = c;
      else console.warn(`Unmapped team "${desc(m.Away.TeamName)}" (match ${m.MatchNumber})`);
    }
    const vId = venueIdFor(desc(m.Stadium?.Name));
    if (vId && vId !== base.venueId) ov.venueId = vId;
  }

  if (m.Date) {
    const iso = isoZ(m.Date);
    if (iso !== base.kickoffUTC) ov.kickoffUTC = iso;
  }

  if (hasScore(m)) {
    ov.homeScore = m.HomeTeamScore;
    ov.awayScore = m.AwayTeamScore;
    if (m.HomeTeamPenaltyScore != null && m.AwayTeamPenaltyScore != null) {
      ov.homePens = m.HomeTeamPenaltyScore;
      ov.awayPens = m.AwayTeamPenaltyScore;
    }
  }
  ov.status = statusLabel(m);

  // Match-day extras (only meaningful once a match is live/finished).
  if ([0, 3].includes(m.MatchStatus)) {
    const ref = refereeOf(m);
    if (ref) ov.referee = ref;
    if (m.Attendance != null) ov.attendance = Number(m.Attendance);
  }

  return ov;
}

// ---- main ---------------------------------------------------------------
(async () => {
  let results;
  try {
    const res = await fetch(API, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    results = json.Results || [];
  } catch (e) {
    console.error('Fetch failed:', e.message);
    process.exit(1);
  }
  console.log(`Fetched ${results.length} matches from FIFA (competition ${COMP}, ${FROM}..${TO}).`);

  let existing = {};
  if (fs.existsSync(overridesPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    } catch (e) {
      console.warn('Existing overrides.json unparseable, starting fresh:', e.message);
    }
  }

  const merged = { ...existing };
  let matched = 0;
  let resolved = 0;
  let scored = 0;

  const FINAL = new Set(['FT', 'AET', 'PEN']);
  for (const m of results) {
    const id = Number(m.MatchNumber);
    const base = byId[id];
    if (!base) continue;
    const ov = buildOverride(m, base);

    // Goalscorers: fetch once a match has goals; skip already-final cached ones
    // (so finished matches aren't re-fetched every run, only live ones).
    const goals = hasScore(m) && (m.HomeTeamScore > 0 || m.AwayTeamScore > 0);
    const cached = existing[id];
    const cachedFinal = cached && FINAL.has(cached.status) && Array.isArray(cached.scorers);
    if (goals && !cachedFinal) {
      const scorers = await fetchScorers(m);
      if (scorers) ov.scorers = scorers;
    }

    if (!Object.keys(ov).length) continue;
    merged[id] = { ...(merged[id] || {}), ...ov };
    matched += 1;
    if (ov.home || ov.away) resolved += 1;
    if (ov.scorers && ov.scorers.length) scored += 1;
  }

  // Stable, id-sorted output for clean diffs.
  const sorted = {};
  for (const id of Object.keys(merged).sort((a, b) => Number(a) - Number(b))) sorted[id] = merged[id];

  const next = JSON.stringify(sorted, null, 2) + '\n';
  const prev = fs.existsSync(overridesPath) ? fs.readFileSync(overridesPath, 'utf8') : '';
  fs.writeFileSync(overridesPath, next);

  console.log(`Updated ${matched} fixtures (${resolved} with resolved knockout teams, ${scored} with goalscorers).`);
  console.log(next === prev ? 'No changes to overrides.json.' : 'overrides.json updated.');
})();
