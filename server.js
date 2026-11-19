// Spotify "now playing" server for stream overlays. Zero dependencies (Node 18+).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- tiny .env loader ----
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  REDIRECT_URI,
  ADMIN_KEY = '',
  PORT = 3000,
  HOST = '0.0.0.0',
  DATA_DIR = __dirname,
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !REDIRECT_URI) {
  console.error('Missing SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET or REDIRECT_URI. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// ---- overlay settings (edited at /customize, saved to settings.json) ----
const POSITIONS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const FONTS = ['segoe', 'arial', 'verdana', 'tahoma', 'trebuchet', 'georgia', 'impact', 'consolas', 'comic', 'system'];
const DEFAULTS = {
  position: 'bottom-left', margin: 32, width: 420, scale: 100,
  bgColor: '#121212', bgOpacity: 82, textColor: '#ffffff', accent: '#1db954',
  font: 'segoe', titleSize: 20, artistSize: 15, radius: 16,
  showArt: true, showProgress: true, showLabel: true, labelText: 'Now playing',
  showPaused: false, shadow: true, blur: true,
};
function sanitize(inp, base = DEFAULTS) {
  const o = { ...base };
  if (!inp || typeof inp !== 'object') return o;
  const num = (k, min, max) => { const v = Number(inp[k]); if (inp[k] !== undefined && Number.isFinite(v)) o[k] = Math.min(max, Math.max(min, Math.round(v))); };
  const bool = k => { if (typeof inp[k] === 'boolean') o[k] = inp[k]; };
  const hex = k => { if (typeof inp[k] === 'string' && /^#[0-9a-f]{6}$/i.test(inp[k])) o[k] = inp[k].toLowerCase(); };
  if (POSITIONS.includes(inp.position)) o.position = inp.position;
  if (FONTS.includes(inp.font)) o.font = inp.font;
  if (typeof inp.labelText === 'string') o.labelText = inp.labelText.slice(0, 30);
  num('margin', 0, 300); num('width', 240, 800); num('scale', 50, 300); num('bgOpacity', 0, 100);
  num('radius', 0, 48); num('titleSize', 12, 48); num('artistSize', 10, 36);
  hex('bgColor'); hex('textColor'); hex('accent');
  ['showArt', 'showProgress', 'showLabel', 'showPaused', 'shadow', 'blur'].forEach(bool);
  return o;
}
let settings = DEFAULTS;
try { settings = sanitize(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))); } catch {}

const readBody = (req, limit = 10_000) => new Promise((resolve, reject) => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > limit) { reject(new Error('too big')); req.destroy(); } });
  req.on('end', () => resolve(b));
  req.on('error', reject);
});
const SCOPE = 'user-read-currently-playing user-read-playback-state';
const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

let refreshToken = null;
let accessToken = null;
let accessExpiresAt = 0;
try { refreshToken = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).refresh_token; } catch {}

const pendingStates = new Set();

async function tokenRequest(params) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data;
}

async function getAccessToken() {
  if (accessToken && Date.now() < accessExpiresAt - 30_000) return accessToken;
  if (!refreshToken) return null;
  const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  accessToken = data.access_token;
  accessExpiresAt = Date.now() + data.expires_in * 1000;
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    refreshToken = data.refresh_token;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: refreshToken }), { mode: 0o600 });
  }
  return accessToken;
}

// ---- now playing, cached briefly so many viewers don't hammer Spotify ----
let cache = { at: 0, body: { isPlaying: false, authorized: !!refreshToken } };
let blockedUntil = 0; // rate-limit backoff
const CACHE_MS = 2000;

async function fetchNowPlaying() {
  if (Date.now() < blockedUntil) return cache.body;
  const token = await getAccessToken();
  if (!token) return { isPlaying: false, authorized: false };

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    blockedUntil = Date.now() + (Number(res.headers.get('retry-after')) || 5) * 1000;
    return cache.body;
  }
  if (res.status === 401) { accessToken = null; return cache.body; }
  if (res.status === 204 || !res.ok) return { isPlaying: false, authorized: true };

  const d = await res.json();
  const item = d.item;
  if (!item) return { isPlaying: false, authorized: true };

  const isEpisode = d.currently_playing_type === 'episode';
  const images = (isEpisode ? item.show?.images : item.album?.images) || item.images || [];
  return {
    authorized: true,
    isPlaying: !!d.is_playing,
    title: item.name,
    artist: isEpisode ? item.show?.publisher : (item.artists || []).map(a => a.name).join(', '),
    album: isEpisode ? item.show?.name : item.album?.name,
    art: (images[1] || images[0] || {}).url || null,
    progressMs: d.progress_ms || 0,
    durationMs: item.duration_ms || 0,
    url: item.external_urls?.spotify || null,
    fetchedAt: Date.now(),
  };
}

async function nowPlaying() {
  if (Date.now() - cache.at < CACHE_MS) return cache.body;
  try {
    cache = { at: Date.now(), body: await fetchNowPlaying() };
  } catch (e) {
    console.error(e.message);
    cache = { at: Date.now() - CACHE_MS + 1000, body: cache.body }; // retry in ~1s
  }
  return cache.body;
}

// ---- http ----
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/overlay') {
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'overlay.html'), 'utf8'), 'text/html; charset=utf-8');
  }

  const isAdmin = () => !ADMIN_KEY || url.searchParams.get('key') === ADMIN_KEY || req.headers['x-admin-key'] === ADMIN_KEY;

  if (url.pathname === '/customize') {
    if (!isAdmin()) return send(res, 403, 'Forbidden. Open /customize?key=YOUR_ADMIN_KEY', 'text/plain');
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'customize.html'), 'utf8'), 'text/html; charset=utf-8');
  }

  if (url.pathname === '/api/settings') {
    if (req.method === 'POST') {
      if (!isAdmin()) return send(res, 403, { error: 'forbidden' });
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'json only' });
      try {
        settings = sanitize(JSON.parse(await readBody(req)), DEFAULTS);
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        return send(res, 200, settings);
      } catch (e) { return send(res, 400, { error: 'bad request' }); }
    }
    return send(res, 200, settings);
  }

  if (url.pathname === '/api/now-playing') return send(res, 200, await nowPlaying());

  if (url.pathname === '/login') {
    if (ADMIN_KEY && url.searchParams.get('key') !== ADMIN_KEY) return send(res, 403, 'Forbidden', 'text/plain');
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.add(state);
    const auth = new URL('https://accounts.spotify.com/authorize');
    auth.search = new URLSearchParams({
      response_type: 'code', client_id: SPOTIFY_CLIENT_ID, scope: SCOPE, redirect_uri: REDIRECT_URI, state,
    });
    res.writeHead(302, { Location: auth.toString() });
    return res.end();
  }

  if (url.pathname === '/callback') {
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!code || !pendingStates.delete(state)) return send(res, 400, 'Bad request. Start again at /login', 'text/plain');
    try {
      const data = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
      refreshToken = data.refresh_token;
      accessToken = data.access_token;
      accessExpiresAt = Date.now() + data.expires_in * 1000;
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: refreshToken }), { mode: 0o600 });
      cache.at = 0;
      return send(res, 200, '<h2>Connected to Spotify ✅</h2><p>You can close this tab and add the overlay to OBS.</p>', 'text/html; charset=utf-8');
    } catch (e) {
      console.error(e.message);
      return send(res, 500, 'Auth failed, check the server console.', 'text/plain');
    }
  }

  send(res, 404, 'Not found', 'text/plain');
}).listen(PORT, HOST, () => {
  console.log(`Overlay:   http://localhost:${PORT}/`);
  console.log(`Customize: http://localhost:${PORT}/customize${ADMIN_KEY ? '?key=YOUR_ADMIN_KEY' : ''}`);
  console.log(refreshToken ? 'Spotify: connected' : `Spotify: not connected yet, open ${REDIRECT_URI.replace(/\/callback$/, '')}/login${ADMIN_KEY ? '?key=YOUR_ADMIN_KEY' : ''}`);
});
