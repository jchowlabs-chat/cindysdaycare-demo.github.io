/**
 * Cindy's Daycare Analytics — Cloudflare Worker
 *
 * Roles:
 *   POST /api/event       → Ingest analytics events from beacon
 *   GET  /api/summary     → Summary cards (visitors, humans, avg time, voice engaged)
 *   GET  /api/visitors    → Daily visitor counts (human vs bot) for bar chart
 *   GET  /api/devices     → Device breakdown
 *   GET  /api/sections    → Section view counts + avg scroll depth
 *   GET  /api/voice       → Voice concierge engagement metrics
 *   GET  /                → Serve dashboard SPA
 */

const ALLOWED_ORIGINS = [
  'https://cindysdaycare.com',
  'https://www.cindysdaycare.com',
  'https://cindysdaycare-demo.github.io',
  'http://localhost',
  'http://localhost:3000',
  'http://127.0.0.1',
];

const VALID_EVENTS = [
  'page_view',
  'section_view',
  'voice_start',
  'voice_end',
  'voice_error',
  'session_end',
  'form_submit',
];

// Rate limiting: 30 events per IP per 60s window
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;
const rateBuckets = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_WINDOW) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  return bucket.count <= RATE_LIMIT;
}

function cleanBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now - bucket.start > RATE_WINDOW * 2) rateBuckets.delete(ip);
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.find(o => origin.startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  });
}

function parseRange(range) {
  const now = Date.now();
  const day = 86400000;
  switch (range) {
    case '1d': return { start: now - day, end: now };
    case '7d': return { start: now - 7 * day, end: now };
    case '30d': return { start: now - 30 * day, end: now };
    case 'all': return { start: 0, end: now };
    default: return { start: now - 7 * day, end: now };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname.startsWith('/api/')) {
      if (Math.random() < 0.05) cleanBuckets();

      if (request.method === 'POST' && url.pathname === '/api/event') {
        return handleEvent(request, env);
      }
      if (request.method === 'GET') {
        const range = url.searchParams.get('range') || '7d';
        const { start, end } = parseRange(range);

        switch (url.pathname) {
          case '/api/summary': return handleSummary(env, start, end, request);
          case '/api/visitors': return handleVisitors(env, start, end, request);
          case '/api/devices': return handleDevices(env, start, end, request);
          case '/api/sections': return handleSections(env, start, end, request);
          case '/api/voice': return handleVoice(env, start, end, request);
          default: return json({ error: 'Not found' }, 404, request);
        }
      }
      return json({ error: 'Method not allowed' }, 405, request);
    }

    return env.ASSETS.fetch(request);
  },
};

// ─── Event Ingestion ──────────────────────────────────────────────────────

async function handleEvent(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!checkRateLimit(ip)) {
    return json({ error: 'Rate limited' }, 429, request);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, request);
  }

  const { event_type, session_id, timestamp } = body;
  if (!event_type || !session_id || !timestamp) {
    return json({ error: 'Missing required fields: event_type, session_id, timestamp' }, 400, request);
  }
  if (!VALID_EVENTS.includes(event_type)) {
    return json({ error: 'Invalid event_type' }, 400, request);
  }
  if (typeof timestamp !== 'number' || timestamp < 1700000000000) {
    return json({ error: 'Invalid timestamp' }, 400, request);
  }
  if (typeof session_id !== 'string' || session_id.length > 100) {
    return json({ error: 'Invalid session_id' }, 400, request);
  }

  const country = (request.cf && request.cf.country) || null;

  const knownFields = ['event_type', 'session_id', 'device_type', 'screen_size',
    'referrer', 'user_agent', 'is_bot', 'timestamp'];
  const extra = {};
  for (const key of Object.keys(body)) {
    if (!knownFields.includes(key)) extra[key] = body[key];
  }
  const payload = Object.keys(extra).length ? JSON.stringify(extra) : null;

  await env.DB.prepare(
    `INSERT INTO events (event_type, session_id, device_type, screen_size, ip_country, referrer, user_agent, is_bot, payload, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    event_type,
    session_id,
    body.device_type || null,
    body.screen_size || null,
    country,
    body.referrer || null,
    body.user_agent || null,
    body.is_bot ? 1 : 0,
    payload,
    timestamp
  ).run();

  return json({ ok: true }, 200, request);
}

// ─── Summary Cards ────────────────────────────────────────────────────────

async function handleSummary(env, start, end, request) {
  const r = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) AS total FROM events
       WHERE event_type = 'page_view' AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) AS humans FROM events
       WHERE event_type = 'page_view' AND is_bot = 0 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) AS bots FROM events
       WHERE event_type = 'page_view' AND is_bot = 1 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT AVG(CAST(json_extract(payload, '$.duration_ms') AS REAL)) AS avg_ms,
              COUNT(*) AS sessions_with_end
       FROM events
       WHERE event_type = 'session_end' AND is_bot = 0 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) AS voice_users FROM events
       WHERE event_type = 'voice_start' AND is_bot = 0 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
  ]);

  const total = r[0].results[0]?.total || 0;
  const humans = r[1].results[0]?.humans || 0;
  const bots = r[2].results[0]?.bots || 0;
  const avgMs = r[3].results[0]?.avg_ms || 0;
  const voiceUsers = r[4].results[0]?.voice_users || 0;

  return json({
    total_visitors: total,
    humans,
    bots,
    avg_time_ms: Math.round(avgMs),
    voice_engaged: voiceUsers,
    voice_rate: humans > 0 ? Math.round((voiceUsers / humans) * 100) : 0,
  }, 200, request);
}

// ─── Visitors by Day ──────────────────────────────────────────────────────

async function handleVisitors(env, start, end, request) {
  const rows = await env.DB.prepare(
    `SELECT
       date(timestamp / 1000, 'unixepoch') AS day,
       COUNT(DISTINCT CASE WHEN is_bot = 0 THEN session_id END) AS humans,
       COUNT(DISTINCT CASE WHEN is_bot = 1 THEN session_id END) AS bots
     FROM events
     WHERE event_type = 'page_view' AND timestamp BETWEEN ? AND ?
     GROUP BY day ORDER BY day`
  ).bind(start, end).all();

  return json({ days: rows.results }, 200, request);
}

// ─── Devices ──────────────────────────────────────────────────────────────

async function handleDevices(env, start, end, request) {
  const types = await env.DB.prepare(
    `SELECT device_type, COUNT(DISTINCT session_id) AS count
     FROM events
     WHERE event_type = 'page_view' AND is_bot = 0 AND timestamp BETWEEN ? AND ?
     GROUP BY device_type ORDER BY count DESC`
  ).bind(start, end).all();

  const devices = await env.DB.prepare(
    `SELECT
       CASE
         WHEN user_agent LIKE '%iPhone%' THEN 'iPhone'
         WHEN user_agent LIKE '%iPad%' THEN 'iPad'
         WHEN user_agent LIKE '%Android%' AND user_agent NOT LIKE '%Mobile%' THEN 'Android Tablet'
         WHEN user_agent LIKE '%Android%' THEN 'Android'
         WHEN user_agent LIKE '%Macintosh%' THEN 'Mac Desktop'
         WHEN user_agent LIKE '%Windows%' THEN 'Windows Desktop'
         WHEN user_agent LIKE '%Linux%' THEN 'Linux Desktop'
         ELSE 'Other'
       END AS device,
       COUNT(DISTINCT session_id) AS count
     FROM events
     WHERE event_type = 'page_view' AND is_bot = 0 AND timestamp BETWEEN ? AND ?
     GROUP BY device ORDER BY count DESC`
  ).bind(start, end).all();

  return json({
    by_type: types.results,
    by_device: devices.results,
  }, 200, request);
}

// ─── Sections ─────────────────────────────────────────────────────────────

async function handleSections(env, start, end, request) {
  const r = await env.DB.batch([
    env.DB.prepare(
      `SELECT json_extract(payload, '$.section_id') AS section_id,
              COUNT(DISTINCT session_id) AS unique_viewers
       FROM events
       WHERE event_type = 'section_view' AND is_bot = 0 AND timestamp BETWEEN ? AND ?
       GROUP BY section_id ORDER BY unique_viewers DESC`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT AVG(CAST(json_extract(payload, '$.max_scroll_pct') AS REAL)) AS avg_scroll
       FROM events
       WHERE event_type = 'session_end' AND is_bot = 0 AND timestamp BETWEEN ? AND ?
         AND json_extract(payload, '$.max_scroll_pct') IS NOT NULL`
    ).bind(start, end),
  ]);

  return json({
    sections: r[0].results,
    avg_scroll_depth: Math.round(r[1].results[0]?.avg_scroll || 0),
  }, 200, request);
}

// ─── Voice ────────────────────────────────────────────────────────────────

async function handleVoice(env, start, end, request) {
  const r = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) AS unique_users FROM events
       WHERE event_type = 'voice_start' AND is_bot = 0 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT COUNT(*) AS total_sessions FROM events
       WHERE event_type = 'voice_start' AND is_bot = 0 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT AVG(CAST(json_extract(payload, '$.duration_ms') AS REAL)) AS avg_ms
       FROM events
       WHERE event_type = 'voice_end' AND is_bot = 0 AND timestamp BETWEEN ? AND ?
         AND json_extract(payload, '$.duration_ms') IS NOT NULL`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT COUNT(*) AS multi_sessions FROM (
         SELECT session_id, COUNT(*) AS cnt FROM events
         WHERE event_type = 'voice_start' AND is_bot = 0 AND timestamp BETWEEN ? AND ?
         GROUP BY session_id HAVING cnt > 1
       )`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT COUNT(*) AS mic_errors FROM events
       WHERE event_type = 'voice_error' AND is_bot = 0 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT session_id) AS humans FROM events
       WHERE event_type = 'page_view' AND is_bot = 0 AND timestamp BETWEEN ? AND ?`
    ).bind(start, end),
  ]);

  const uniqueUsers = r[0].results[0]?.unique_users || 0;
  const totalSessions = r[1].results[0]?.total_sessions || 0;
  const avgMs = r[2].results[0]?.avg_ms || 0;
  const multiSessions = r[3].results[0]?.multi_sessions || 0;
  const micErrors = r[4].results[0]?.mic_errors || 0;
  const humans = r[5].results[0]?.humans || 0;

  return json({
    unique_users: uniqueUsers,
    total_sessions: totalSessions,
    avg_duration_ms: Math.round(avgMs),
    multi_session_visits: multiSessions,
    avg_sessions_per_user: uniqueUsers > 0 ? Math.round((totalSessions / uniqueUsers) * 10) / 10 : 0,
    mic_errors: micErrors,
    engagement_rate: humans > 0 ? Math.round((uniqueUsers / humans) * 100) : 0,
  }, 200, request);
}
