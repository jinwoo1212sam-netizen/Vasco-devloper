const fetch = require('node-fetch');
const { analyzeSequence } = require('../lib/dragonx');

const ENDPOINTS = {
  '1M': [
    'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json',
    'https://draw.ar-lottery02.com/WinGo/WinGo_1M/GetHistoryIssuePage.json'
  ],
  '30S': [
    'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json',
    'https://draw.ar-lottery02.com/WinGo/WinGo_30S/GetHistoryIssuePage.json'
  ]
};

function extractList(json) {
  const candidates = [
    json && json.data && json.data.list,
    json && json.data && json.data.records,
    json && json.data && json.data.history,
    json && json.list,
    json && json.records,
    json && json.history,
    json && json.data && Array.isArray(json.data) && json.data
  ];
  return candidates.find(Array.isArray) || [];
}

function getPeriod(row) {
  return row && (row.issueNumber ?? row.issue ?? row.period ?? row.periodNumber ?? row.issue_no);
}
function getNumber(row) {
  return row && (row.number ?? row.openNumber ?? row.result ?? row.winNumber ?? row.open_num);
}
function getColor(row, number) {
  if (row && row.color != null) return String(row.color);
  const n = Number(number);
  if (n === 0) return 'RED + VIOLET';
  if (n === 5) return 'GREEN + VIOLET';
  if ([1, 3, 7, 9].includes(n)) return 'GREEN';
  if ([2, 4, 6, 8].includes(n)) return 'RED';
  return null;
}
function getSize(number) {
  const n = Number(number);
  return Number.isFinite(n) ? (n >= 5 ? 'BIG' : 'SMALL') : null;
}
function nextIssue(issue) {
  if (issue == null) return null;
  const s = String(issue);
  if (!/^\d+$/.test(s)) return null;
  try { return (BigInt(s) + 1n).toString(); } catch (_) { return null; }
}

async function requestHistory(baseUrl, method) {
  const url = new URL(baseUrl);
  if (url.pathname.includes('30S')) url.searchParams.set('ts', String(Date.now()));
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'DRAGON-X-History-Client/2.0'
  };
  const options = { method, headers, timeout: 9000 };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ pageSize: 120, pageNo: 1 });
  } else {
    url.searchParams.set('pageSize', '120');
    url.searchParams.set('pageNo', '1');
  }
  const response = await fetch(url.toString(), options);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const trimmed = text.trim();
  if (!response.ok) throw new Error(`HTTP ${response.status}; content-type=${contentType}; body=${trimmed.slice(0, 180)}`);
  if (!trimmed || trimmed.startsWith('<') || /text\/html/i.test(contentType)) {
    throw new Error(`HTML/non-JSON response; HTTP ${response.status}; content-type=${contentType}; body=${trimmed.slice(0, 180)}`);
  }
  let json;
  try { json = JSON.parse(trimmed); }
  catch (_) { throw new Error(`Invalid JSON; HTTP ${response.status}; content-type=${contentType}; body=${trimmed.slice(0, 180)}`); }
  const list = extractList(json);
  if (!list.length) throw new Error(`JSON received but history list was empty/unrecognized; keys=${Object.keys(json || {}).join(',')}`);
  return { json, list, source: url.origin + url.pathname, method, status: response.status };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ success: false, error: 'Use GET or POST' });

  const rawType = String((req.query && req.query.type) || '1M').toUpperCase();
  const gameType = ['30S', '30SEC', '30SECONDS'].includes(rawType) ? '30S' : '1M';
  let fetched = null;
  const attempts = [];
  for (const endpoint of ENDPOINTS[gameType]) {
    for (const method of ['GET', 'POST']) {
      try { fetched = await requestHistory(endpoint, method); break; }
      catch (error) { attempts.push({ endpoint: new URL(endpoint).origin, method, error: String(error.message).slice(0, 260) }); }
    }
    if (fetched) break;
  }
  if (!fetched) {
    return res.status(502).json({
      success: false,
      error: 'Unable to fetch WinGo history as JSON. Upstream may be blocking this host or returning an HTML security page.',
      game: gameType === '30S' ? 'WinGo 30Sec' : 'WinGo 1Min',
      attempts
    });
  }

  const history = fetched.list.filter(row => getPeriod(row) != null && getNumber(row) != null);
  if (!history.length) return res.status(502).json({ success: false, error: 'JSON response had no recognizable period/number fields.', source: fetched.source });
  const latest = history[0];
  const latestPeriod = getPeriod(latest);
  const latestNumber = Number(getNumber(latest));
  const chronological = [...history].reverse();
  const valid = chronological.map(row => ({ period: String(getPeriod(row)), number: Number(getNumber(row)), size: getSize(getNumber(row)), color: getColor(row, getNumber(row)) })).filter(row => Number.isFinite(row.number) && row.size);
  const sequence = valid.map(row => row.size);
  const engineResult = analyzeSequence(sequence, { periods: valid.map(row => row.period) });

  const numberCounts = {};
  const sizeCounts = { BIG: 0, SMALL: 0 };
  const colorCounts = {};
  for (const row of valid) {
    numberCounts[row.number] = (numberCounts[row.number] || 0) + 1;
    sizeCounts[row.size]++;
    for (const color of String(row.color || 'UNKNOWN').split(' + ')) colorCounts[color] = (colorCounts[color] || 0) + 1;
  }
  const total = valid.length || 1;
  const toShares = counts => Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, { count, share: Number((count / total).toFixed(4)) }]));

  // Forecast the next not-yet-settled issue using historical frequencies and
  // one-step transitions. This is a heuristic, not a guaranteed prediction.
  const forecastFromHistory = (rows, key, fallbackValues) => {
    const values = rows.map(r => r[key]).filter(v => v !== null && v !== undefined && v !== '');
    if (!values.length) return fallbackValues[0];
    const counts = new Map();
    values.forEach(v => counts.set(String(v), (counts.get(String(v)) || 0) + 1));
    const last = String(values[values.length - 1]);
    const nextCounts = new Map();
    for (let i = 0; i < values.length - 1; i++) {
      if (String(values[i]) === last) {
        const next = String(values[i + 1]);
        nextCounts.set(next, (nextCounts.get(next) || 0) + 1);
      }
    }
    // Blend overall frequency with observed transitions after the latest symbol.
    let best = fallbackValues[0], bestScore = -1;
    const candidates = new Set([...fallbackValues.map(String), ...counts.keys(), ...nextCounts.keys()]);
    for (const candidate of candidates) {
      const score = (counts.get(candidate) || 0) + 2 * (nextCounts.get(candidate) || 0);
      if (score > bestScore) { best = candidate; bestScore = score; }
    }
    return best;
  };
  const predictedNumber = Number(forecastFromHistory(valid, 'number', [0,1,2,3,4,5,6,7,8,9]));
  const safePredictedNumber = Number.isFinite(predictedNumber) && predictedNumber >= 0 && predictedNumber <= 9 ? predictedNumber : 0;
  const predictedColor = getColor(null, safePredictedNumber);
  const predictedSize = getSize(safePredictedNumber);

  return res.status(200).json({
    developer: '@VASCODEVLOPER',
    telegram_channel: 'https://t.me/+KUHxSnrdjl1mNzFl',
    success: true,
    game: gameType === '30S' ? 'WinGo 30Sec' : 'WinGo 1Min',
    lastRound: {
      period: String(latestPeriod),
      number: latestNumber,
      color: getColor(latest, latestNumber),
      size: getSize(latestNumber),
      price: latest.price ?? null
    },
    livePrediction: {
      targetPeriod: nextIssue(latestPeriod),
      size: predictedSize,
      color: predictedColor,
      number: safePredictedNumber,
      patternAnalyzed: engineResult.pattern_count
    },
    engineStats: {
      engine: engineResult.engine,
      version: engineResult.version,
      patternCount: engineResult.pattern_count,
      observationsAnalyzed: valid.length
    }
  });
};
