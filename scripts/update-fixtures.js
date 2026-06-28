#!/usr/bin/env node
// Auto-updates data/overrides.json from a live results provider (api-football).
//
// The curated schedule lives in build-data.js (hardcoded). This script never
// touches that base; it only writes a patch layer (data/overrides.json) that
// build-data.js applies on top. That way live data resolves knockout
// placeholders -> real teams, corrects kick-off times, and records scores,
// while the hand-built schedule stays the source of truth for everything else.
//
// Env:
//   API_FOOTBALL_KEY        (required) your api-football key
//   API_FOOTBALL_PROVIDER   'rapidapi' (default) | 'apisports'
//   WC_LEAGUE_ID            league id (default 1 = FIFA World Cup)
//   WC_SEASON              season (default 2026)
//
// Overrides are *merged* with any existing file, so a transient empty/failed
// API response never wipes already-resolved fixtures.

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const teams = JSON.parse(fs.readFileSync(path.join(DATA, 'teams.json'), 'utf8'));
const venues = JSON.parse(fs.readFileSync(path.join(DATA, 'venues.json'), 'utf8'));
const fixtures = JSON.parse(fs.readFileSync(path.join(DATA, 'fixtures.json'), 'utf8'));
const overridesPath = path.join(DATA, 'overrides.json');

const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) {
  console.error('ERROR: API_FOOTBALL_KEY is not set. Add it as a repository secret.');
  process.exit(1);
}
const PROVIDER = (process.env.API_FOOTBALL_PROVIDER || 'rapidapi').toLowerCase();
const LEAGUE = process.env.WC_LEAGUE_ID || '1';
const SEASON = process.env.WC_SEASON || '2026';

const HOUR = 3600 * 1000;

// ---- helpers ------------------------------------------------------------
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const isoZ = (d) => new Date(d).toISOString().replace('.000', '');

// team name -> 3-letter code
const nameToCode = {};
for (const [code, t] of Object.entries(teams)) nameToCode[norm(t.name)] = code;
// provider spellings that differ from teams.json
for (const [name, code] of [
  ['United States', 'USA'], ['United States of America', 'USA'], ['US', 'USA'],
  ['Korea Republic', 'KOR'], ['South Korea', 'KOR'], ['Korea', 'KOR'],
  ['IR Iran', 'IRN'], ['Iran', 'IRN'],
  ["Cote d'Ivoire", 'CIV'], ['Cote d Ivoire', 'CIV'], ['Ivory Coast', 'CIV'],
  ['Cabo Verde', 'CPV'], ['Cape Verde Islands', 'CPV'], ['Cape Verde', 'CPV'],
  ['Congo DR', 'COD'], ['DR Congo', 'COD'], ['Democratic Republic of Congo', 'COD'],
  ['Czech Republic', 'CZE'], ['Czechia', 'CZE'],
  ['Turkey', 'TUR'], ['Turkiye', 'TUR'],
  ['Curacao', 'CUW'],
  ['Bosnia and Herzegovina', 'BIH'], ['Bosnia', 'BIH'],
  ['Saudi Arabia', 'KSA'],
]) nameToCode[norm(name)] = code;

const codeFor = (name) => nameToCode[norm(name)] || null;

// venue name -> venueId
const venueToId = {};
for (const [id, v] of Object.entries(venues)) {
  venueToId[norm(v.name)] = id;
  venueToId[norm(v.fifaName)] = id;
}
const venueIdFor = (name) => venueToId[norm(name)] || null;

function stageFor(round) {
  const r = String(round || '').toLowerCase();
  if (r.includes('group')) return 'GS';
  if (r.includes('round of 32') || r.includes('32')) return 'R32';
  if (r.includes('round of 16') || r.includes('16')) return 'R16';
  if (r.includes('quarter')) return 'QF';
  if (r.includes('semi')) return 'SF';
  if (r.includes('3rd') || r.includes('third')) return '3RD';
  if (r.includes('final')) return 'F';
  return null;
}

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']);
const DONE = new Set(['FT', 'AET', 'PEN']);

// ---- index the curated schedule for matching ----------------------------
const pairKey = (a, b) => [a, b].sort().join('-');
const gsByPair = {};
const koByStage = {};
for (const f of fixtures) {
  if (f.stage === 'GS' && f.home.team && f.away.team) {
    gsByPair[pairKey(f.home.team, f.away.team)] = f;
  } else if (f.stage !== 'GS') {
    (koByStage[f.stage] ||= []).push(f);
  }
}

// ---- fetch --------------------------------------------------------------
function endpoint(page) {
  const q = `league=${LEAGUE}&season=${SEASON}&page=${page}`;
  if (PROVIDER === 'apisports') {
    return {
      url: `https://v3.football.api-sports.io/fixtures?${q}`,
      headers: { 'x-apisports-key': KEY },
    };
  }
  const host = 'api-football-v1.p.rapidapi.com';
  return {
    url: `https://${host}/v3/fixtures?${q}`,
    headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': host },
  };
}

async function fetchAll() {
  const out = [];
  let page = 1;
  let totalPages = 1;
  do {
    const { url, headers } = endpoint(page);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for page ${page}`);
    const json = await res.json();
    if (json.errors && (Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors).length)) {
      console.warn('API reported errors:', JSON.stringify(json.errors));
    }
    out.push(...(json.response || []));
    totalPages = json.paging?.total || 1;
    page += 1;
  } while (page <= totalPages);
  return out;
}

// ---- match one api fixture to a curated fixture id ----------------------
function matchFixture(api, homeCode, awayCode) {
  const stage = stageFor(api.league?.round);
  if (stage === 'GS') {
    if (homeCode && awayCode) {
      const f = gsByPair[pairKey(homeCode, awayCode)];
      return f ? { f, stage } : null;
    }
    return null;
  }
  if (!stage) return null;
  const cands = koByStage[stage] || [];
  if (!cands.length) return null;
  const t = new Date(api.fixture?.date).getTime();
  const vId = venueIdFor(api.fixture?.venue?.name);
  const scored = cands
    .map((f) => ({ f, diff: Math.abs(new Date(f.kickoffUTC).getTime() - t), venueMatch: vId && vId === f.venueId }))
    .sort((a, b) => (a.venueMatch === b.venueMatch ? a.diff - b.diff : a.venueMatch ? -1 : 1));
  const best = scored[0];
  const limit = best.venueMatch ? 6 * 24 * HOUR : 30 * HOUR;
  return best.diff <= limit ? { f: best.f, stage } : null;
}

// ---- build override entry from an api fixture ---------------------------
function buildOverride(api, base, stage, homeCode, awayCode) {
  const ov = {};
  const st = api.fixture?.status?.short;

  if (stage !== 'GS') {
    // Resolve knockout placeholders only once real teams are known.
    if (homeCode) ov.home = homeCode;
    if (awayCode) ov.away = awayCode;
    const vId = venueIdFor(api.fixture?.venue?.name);
    if (vId && vId !== base.venueId) ov.venueId = vId;
  }

  // Kick-off correction (record only when it actually moved).
  if (api.fixture?.date) {
    const newIso = isoZ(api.fixture.date);
    if (newIso !== base.kickoffUTC) ov.kickoffUTC = newIso;
  }

  // Scores once a match is live or finished.
  if ((LIVE.has(st) || DONE.has(st)) && api.goals?.home != null && api.goals?.away != null) {
    ov.homeScore = api.goals.home;
    ov.awayScore = api.goals.away;
  }
  if (st) ov.status = st;

  return Object.keys(ov).length ? ov : null;
}

// ---- main ---------------------------------------------------------------
(async () => {
  let apiFixtures;
  try {
    apiFixtures = await fetchAll();
  } catch (e) {
    console.error('Fetch failed:', e.message);
    process.exit(1);
  }
  console.log(`Fetched ${apiFixtures.length} fixtures from api-football (league ${LEAGUE}, season ${SEASON}).`);

  let existing = {};
  if (fs.existsSync(overridesPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    } catch (e) {
      console.warn('Existing overrides.json unparseable, starting fresh:', e.message);
    }
  }

  const merged = { ...existing };
  const assignedDiff = {}; // id -> diff, so a closer api fixture wins on collision
  let matched = 0;
  let resolved = 0;
  let unmatched = 0;

  for (const api of apiFixtures) {
    const homeCode = codeFor(api.teams?.home?.name);
    const awayCode = codeFor(api.teams?.away?.name);
    const m = matchFixture(api, homeCode, awayCode);
    if (!m) {
      unmatched += 1;
      continue;
    }
    const { f: base, stage } = m;
    const diff = Math.abs(new Date(base.kickoffUTC).getTime() - new Date(api.fixture?.date).getTime());
    if (assignedDiff[base.id] != null && assignedDiff[base.id] <= diff) continue;

    const ov = buildOverride(api, base, stage, homeCode, awayCode);
    if (!ov) continue;
    merged[base.id] = { ...(merged[base.id] || {}), ...ov };
    assignedDiff[base.id] = diff;
    matched += 1;
    if (ov.home || ov.away) resolved += 1;
  }

  // Stable, id-sorted output for clean diffs.
  const sorted = {};
  for (const id of Object.keys(merged).sort((a, b) => Number(a) - Number(b))) sorted[id] = merged[id];

  const next = JSON.stringify(sorted, null, 2) + '\n';
  const prev = fs.existsSync(overridesPath) ? fs.readFileSync(overridesPath, 'utf8') : '';
  fs.writeFileSync(overridesPath, next);

  console.log(`Matched ${matched} fixtures (${resolved} with team assignments), ${unmatched} unmatched.`);
  console.log(next === prev ? 'No changes to overrides.json.' : 'overrides.json updated.');
})();
