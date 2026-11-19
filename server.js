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
  HOST = '',
  DATA_DIR = __dirname,
} = process.env;
const POLL_MS = Math.max(1500, Number(process.env.POLL_MS) || 2500); // how often we ask Spotify while an overlay is open

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// ---- overlay settings (edited at /customize, saved to settings.json) ----
const POSITIONS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const FONTS = ['segoe', 'arial', 'verdana', 'tahoma', 'trebuchet', 'georgia', 'impact', 'consolas', 'comic', 'system'];
const LAYOUTS = ['classic', 'compact', 'wide', 'vinyl', 'fullscreen'];
const IDLE_MODES = ['hide', 'demo'];
const EXPLICIT_MODES = ['show', 'mask', 'hide'];
const DEFAULTS = {
  layout: 'classic', position: 'bottom-left', margin: 32, width: 420, scale: 100,
  bgColor: '#121212', bgOpacity: 82, textColor: '#ffffff', accent: '#1db954', chameleon: false,
  font: 'segoe', titleSize: 20, artistSize: 15, radius: 16, bgDim: 55,
  showArt: true, showProgress: true, showLabel: true, labelText: 'Now playing',
  showPaused: false, shadow: true, blur: true,
  idleMode: 'demo', flashOnChange: false, explicitMode: 'show',
};
function sanitize(inp, base = DEFAULTS) {
  const o = { ...base };
  if (!inp || typeof inp !== 'object') return o;
  const num = (k, min, max) => { const v = Number(inp[k]); if (inp[k] !== undefined && Number.isFinite(v)) o[k] = Math.min(max, Math.max(min, Math.round(v))); };
  const bool = k => { if (typeof inp[k] === 'boolean') o[k] = inp[k]; };
  const hex = k => { if (typeof inp[k] === 'string' && /^#[0-9a-f]{6}$/i.test(inp[k])) o[k] = inp[k].toLowerCase(); };
  const pick = (k, list) => { if (list.includes(inp[k])) o[k] = inp[k]; };
  pick('position', POSITIONS); pick('font', FONTS); pick('layout', LAYOUTS);
  pick('idleMode', IDLE_MODES); pick('explicitMode', EXPLICIT_MODES);
  if (typeof inp.labelText === 'string') o.labelText = inp.labelText.slice(0, 30);
  num('margin', 0, 300); num('width', 240, 800); num('scale', 50, 300); num('bgOpacity', 0, 100);
  num('radius', 0, 48); num('titleSize', 12, 48); num('artistSize', 10, 36); num('bgDim', 0, 90);
  hex('bgColor'); hex('textColor'); hex('accent');
  ['chameleon', 'showArt', 'showProgress', 'showLabel', 'showPaused', 'shadow', 'blur', 'flashOnChange'].forEach(bool);
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

// ---- admin auth: password box -> signed session cookie (the key never has to live in a URL) ----
const SESSION_DAYS = 30;
const hmac = v => crypto.createHmac('sha256', ADMIN_KEY).update(String(v)).digest('hex');
const safeEq = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
const makeSession = () => { const exp = Date.now() + SESSION_DAYS * 864e5; return `${exp}.${hmac(exp)}`; };
const validSession = tok => {
  const [exp, sig] = String(tok || '').split('.');
  return !!(exp && sig && Number(exp) > Date.now() && safeEq(sig, hmac(exp)));
};
const cookieOf = (req, name) => {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return ''; } }
  }
  return '';
};
const isHttps = req => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || !!req.socket.encrypted;
const sessionCookie = (req, tok, maxAge) => `np_session=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;

// For API calls: session cookie, or the key in a header / Bearer token (scripts), or legacy ?key=
function isAdmin(req, url) {
  if (!ADMIN_KEY) return true;
  if (validSession(cookieOf(req, 'np_session'))) return true;
  const h = req.headers['x-admin-key'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (h && safeEq(h, ADMIN_KEY)) return true;
  const k = url.searchParams.get('key');
  return !!(k && safeEq(k, ADMIN_KEY));
}

let loginFails = [];
const tooManyLogins = () => { const now = Date.now(); loginFails = loginFails.filter(t => now - t < 60_000); return loginFails.length >= 8; };

// For pages (/customize, /login): show the password box instead of the page when not signed in
function gate(req, res, url) {
  if (!ADMIN_KEY) return true;
  const k = url.searchParams.get('key');
  if (k && safeEq(k, ADMIN_KEY)) { // old ?key= link: sign in and drop the key from the address bar
    url.searchParams.delete('key');
    const here = url.pathname.replace(/^\/+/, '') + url.search;
    res.writeHead(302, { 'Set-Cookie': sessionCookie(req, makeSession(), SESSION_DAYS * 86400), Location: here || './', 'Cache-Control': 'no-store' });
    res.end();
    return false;
  }
  if (validSession(cookieOf(req, 'np_session'))) return true;
  send(res, 401, loginPage(), 'text/html; charset=utf-8');
  return false;
}

// ---- icons (inline SVG, so no extra files) ----
const ICON_OVERLAY = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231db954'/%3E%3Cpath d='M13 21V9l9-2v12' fill='none' stroke='%23fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='11' cy='21' r='3' fill='%23fff'/%3E%3Ccircle cx='20' cy='19' r='3' fill='%23fff'/%3E%3C/svg%3E";
const ICON_ADMIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2314151a'/%3E%3Cg stroke='%231db954' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='M7 10h18M7 16h18M7 22h18'/%3E%3C/g%3E%3Cg fill='%23fff'%3E%3Ccircle cx='12' cy='10' r='2.6'/%3E%3Ccircle cx='21' cy='16' r='2.6'/%3E%3Ccircle cx='11' cy='22' r='2.6'/%3E%3C/g%3E%3C/svg%3E";
const FAVICON_SVG = decodeURIComponent(ICON_OVERLAY.replace('data:image/svg+xml,', ''));

function loginPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sign in</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" type="image/svg+xml" href="${ICON_ADMIN}">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14151a;color:#e8e9ee;font:15px/1.4 "Segoe UI",system-ui,sans-serif}
  form{background:#1d1f27;border:1px solid #2c2f3a;border-radius:14px;padding:28px;width:min(340px,86vw)}
  h1{font-size:18px;margin:0 0 4px} p{margin:0 0 18px;color:#8b8fa0;font-size:13px}
  input{width:100%;box-sizing:border-box;background:#14151a;color:inherit;border:1px solid #2c2f3a;border-radius:8px;padding:10px 12px;font:inherit}
  button{width:100%;margin-top:12px;background:#1db954;color:#04140a;font-weight:700;border:0;border-radius:8px;padding:10px;font:inherit;font-weight:700;cursor:pointer}
  #msg{min-height:18px;margin-top:10px;color:#ff6b6b;font-size:13px}
</style></head><body>
<form id="f"><h1>Now Playing admin</h1><p>Enter your admin key to continue.</p>
<input id="k" type="password" name="password" autocomplete="current-password" placeholder="Admin key" autofocus>
<button type="submit">Sign in</button><div id="msg"></div></form>
<script>
document.getElementById('f').onsubmit = async function (e) {
  e.preventDefault();
  var msg = document.getElementById('msg'); msg.textContent = '';
  try {
    var r = await fetch('api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: document.getElementById('k').value }) });
    if (r.ok) location.reload();
    else msg.textContent = r.status === 429 ? 'Too many attempts, wait a minute.' : 'Wrong key.';
  } catch (err) { msg.textContent = 'Could not reach the server.'; }
};
</script></body></html>`;
}

// ---- Spotify auth ----
const SCOPE = 'user-read-currently-playing user-read-playback-state';
const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

let refreshToken = null;
let accessToken = null;
let accessExpiresAt = 0;
try { refreshToken = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).refresh_token; } catch {}

// state -> the redirect URI used for that login (must be identical when exchanging the code)
const pendingStates = new Map();

// REDIRECT_URI is optional. If unset, it's worked out from how you reached the server, so it
// works behind Cloudflare Tunnel, reverse proxies, Tailscale, plain LAN, whatever.
function redirectFor(req) {
  if (REDIRECT_URI) return REDIRECT_URI;
  const first = v => String(v || '').split(',')[0].trim();
  const proto = first(req.headers['x-forwarded-proto']) || (req.socket.encrypted ? 'https' : 'http');
  const host = first(req.headers['x-forwarded-host']) || req.headers.host || `127.0.0.1:${PORT}`;
  return `${proto}://${host}/callback`;
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Spotify only accepts https redirects, or http on the loopback IP 127.0.0.1 / [::1]
function spotifyRejects(redirect) {
  try {
    const u = new URL(redirect);
    return u.protocol === 'http:' && !['127.0.0.1', '[::1]'].includes(u.hostname);
  } catch { return true; }
}
function loginHelp(redirect) {
  return `<!doctype html><meta charset="utf-8"><title>Spotify login</title>
<body style="font-family:system-ui;max-width:680px;margin:40px auto;padding:0 16px;line-height:1.5">
<h2>Spotify won't accept this address for login</h2>
<p>You opened <code>${esc(redirect.replace(/\/callback$/, ''))}</code>, which would use the redirect URI <code>${esc(redirect)}</code>.
Spotify only allows plain <code>http</code> for <code>127.0.0.1</code>. The overlay itself works fine on any address; this only affects the one-time login.</p>
<p>Pick one:</p>
<ol>
<li><b>Use 127.0.0.1.</b> From your PC run <code>ssh -L ${PORT}:127.0.0.1:${PORT} user@server</code>, then open <code>http://127.0.0.1:${PORT}/login</code>.</li>
<li><b>Use https.</b> Open /login through an https address (Cloudflare Tunnel, reverse proxy, Tailscale HTTPS). If this page still shows http there, set <code>REDIRECT_URI=https://your-address/callback</code>.</li>
<li><b>Log in elsewhere.</b> Run the server on your PC, log in at <code>http://127.0.0.1:${PORT}/login</code>, then copy <code>tokens.json</code> into this server's data folder.</li>
</ol>
<p>Whichever redirect URI you use must also be added to your app in the Spotify developer dashboard.</p></body>`;
}

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
let inflight = null;
let failures = 0;
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
  if (res.status === 204) return { isPlaying: false, authorized: true };
  if (!res.ok) throw new Error(`Spotify API ${res.status}`);

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
    art: (images[0] || {}).url || null,
    explicit: !!item.explicit,
    progressMs: d.progress_ms || 0,
    durationMs: item.duration_ms || 0,
    url: item.external_urls?.spotify || null,
    fetchedAt: Date.now(),
  };
}

async function spotifyNow() {
  if (Date.now() - cache.at < CACHE_MS) return cache.body;
  if (!inflight) {
    inflight = (async () => {
      try {
        cache = { at: Date.now(), body: await fetchNowPlaying() };
        failures = 0;
      } catch (e) {
        console.error(e.message);
        failures++;
        // keep the last good state through a blip; after 3 failures in a row report an error
        cache = { at: Date.now() - CACHE_MS + 1000, body: failures >= 3 ? { isPlaying: false, authorized: !!refreshToken, error: true } : cache.body };
      } finally { inflight = null; }
    })();
  }
  await inflight;
  return cache.body;
}

// ---- optional "other player" feed: POST /api/update ----
let external = null; // { at, ttlMs, data }
function withExternal(body) {
  if (body.isPlaying || !external || Date.now() - external.at > external.ttlMs) return body;
  const d = external.data;
  const elapsed = Date.now() - external.at;
  return { ...d, authorized: body.authorized, source: 'external', progressMs: d.durationMs ? Math.min(d.durationMs, d.progressMs + elapsed) : d.progressMs, fetchedAt: Date.now() };
}
// make the progress reflect "now", not when we last asked Spotify
function fresh(body) {
  if (!body.isPlaying || !body.fetchedAt || !body.durationMs) return body;
  return { ...body, progressMs: Math.min(body.durationMs, (body.progressMs || 0) + (Date.now() - body.fetchedAt)), fetchedAt: Date.now() };
}
async function nowPlaying() { return fresh(withExternal(await spotifyNow())); }

// ---- live push (Server-Sent Events) ----
const sseClients = new Set();
const sseMsg = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const broadcast = (event, data) => { const m = sseMsg(event, data); for (const c of sseClients) c.write(m); };
let pumping = false, lastSig = '', lastSentAt = 0;
async function pump() {
  if (!sseClients.size) { pumping = false; return; }
  try {
    const b = await nowPlaying();
    const sig = JSON.stringify([b.title, b.artist, b.isPlaying, b.authorized, !!b.error, !!b.explicit, b.source, b.art]);
    if (sig !== lastSig || Date.now() - lastSentAt > 10_000) { // resend every 10s so progress stays in sync
      lastSig = sig; lastSentAt = Date.now();
      broadcast('now', b);
    }
  } catch (e) { console.error(e.message); }
  setTimeout(pump, POLL_MS);
}
const startPump = () => { if (!pumping) { pumping = true; pump(); } };
setInterval(() => { for (const c of sseClients) c.write(': ping\n\n'); }, 15_000).unref(); // keeps proxies from closing the stream

// ---- http ----
const send = (res, code, body, type = 'application/json', extra = {}) => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...extra });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const isJson = req => (req.headers['content-type'] || '').startsWith('application/json');
const page = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); } catch { return send(res, 400, 'Bad request', 'text/plain'); }
  const p = url.pathname;

  try {
    if (p === '/' || p === '/overlay') return send(res, 200, page('overlay.html'), 'text/html; charset=utf-8');
    if (p === '/favicon.svg' || p === '/favicon.ico') return send(res, 200, FAVICON_SVG, 'image/svg+xml', { 'Cache-Control': 'public, max-age=86400' });

    if (p === '/customize') {
      if (!gate(req, res, url)) return;
      return send(res, 200, page('customize.html'), 'text/html; charset=utf-8');
    }

    // ---- admin session ----
    if (p === '/api/login' && req.method === 'POST') {
      if (!ADMIN_KEY) return send(res, 200, { ok: true });
      if (!isJson(req)) return send(res, 415, { error: 'json only' });
      if (tooManyLogins()) return send(res, 429, { error: 'too many attempts' });
      let key = '';
      try { key = String(JSON.parse(await readBody(req)).key || ''); } catch { return send(res, 400, { error: 'bad request' }); }
      if (!safeEq(key, ADMIN_KEY)) { loginFails.push(Date.now()); return send(res, 401, { error: 'wrong key' }); }
      return send(res, 200, { ok: true }, 'application/json', { 'Set-Cookie': sessionCookie(req, makeSession(), SESSION_DAYS * 86400) });
    }
    if (p === '/api/logout' && req.method === 'POST') {
      return send(res, 200, { ok: true }, 'application/json', { 'Set-Cookie': sessionCookie(req, '', 0) });
    }

    // ---- settings ----
    if (p === '/api/settings') {
      if (req.method === 'POST') {
        if (!isAdmin(req, url)) return send(res, 403, { error: 'forbidden' });
        if (!isJson(req)) return send(res, 415, { error: 'json only' });
        try {
          settings = sanitize(JSON.parse(await readBody(req)), DEFAULTS);
          fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
          broadcast('settings', settings); // overlays update instantly
          return send(res, 200, settings);
        } catch { return send(res, 400, { error: 'bad request' }); }
      }
      return send(res, 200, settings);
    }

    // ---- now playing ----
    if (p === '/api/now-playing') return send(res, 200, await nowPlaying());

    if (p === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*',
      });
      res.write('retry: 2000\n\n');
      res.write(sseMsg('settings', settings));
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      res.write(sseMsg('now', await nowPlaying()));
      startPump();
      return;
    }

    // Album art, re-served from this server so the overlay can read its colours (Spotify's CDN only)
    if (p === '/api/art') {
      let t;
      try { t = new URL(url.searchParams.get('u') || ''); } catch { return send(res, 400, 'bad url', 'text/plain'); }
      if (t.protocol !== 'https:' || !/(^|\.)(scdn\.co|spotifycdn\.com)$/.test(t.hostname)) return send(res, 403, 'host not allowed', 'text/plain');
      const r = await fetch(t, { redirect: 'error', signal: AbortSignal.timeout(8000) });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) return send(res, 502, 'upstream error', 'text/plain');
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 5_000_000) return send(res, 502, 'too large', 'text/plain');
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' });
      return res.end(buf);
    }

    // Other players (Windows media, Last.fm bridges, ...) can push what's playing here
    if (p === '/api/update' && req.method === 'POST') {
      if (!ADMIN_KEY) return send(res, 403, { error: 'Set ADMIN_KEY to use this endpoint' });
      if (!isAdmin(req, url)) return send(res, 403, { error: 'forbidden' });
      if (!isJson(req)) return send(res, 415, { error: 'json only' });
      let b;
      try { b = JSON.parse(await readBody(req, 300_000)); } catch { return send(res, 400, { error: 'bad request' }); }
      if (b.isPlaying === false) {
        external = null;
      } else {
        if (typeof b.title !== 'string' || !b.title.trim()) return send(res, 400, { error: 'title is required' });
        const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
        const num = v => (Number.isFinite(Number(v)) ? Math.min(864e5, Math.max(0, Math.round(Number(v)))) : 0);
        const art = typeof b.art === 'string' && (
          (/^https?:\/\//.test(b.art) && b.art.length <= 1000) ||
          (/^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/.test(b.art) && b.art.length <= 250_000)) ? b.art : null;
        external = {
          at: Date.now(),
          ttlMs: Math.min(600, Math.max(5, Number(b.ttl) || 20)) * 1000, // seconds without an update before it disappears
          data: {
            authorized: true, isPlaying: true, title: str(b.title, 200), artist: str(b.artist, 200), album: str(b.album, 200),
            art, explicit: !!b.explicit, progressMs: num(b.progressMs), durationMs: num(b.durationMs), url: null,
          },
        };
      }
      cache.at = 0;
      broadcast('now', await nowPlaying());
      return send(res, 200, { ok: true });
    }

    // ---- Spotify login ----
    if (p === '/login') {
      if (!gate(req, res, url)) return;
      const redirect = redirectFor(req);
      if (spotifyRejects(redirect)) return send(res, 200, loginHelp(redirect), 'text/html; charset=utf-8');
      const state = crypto.randomBytes(16).toString('hex');
      pendingStates.set(state, redirect);
      const auth = new URL('https://accounts.spotify.com/authorize');
      auth.search = new URLSearchParams({
        response_type: 'code', client_id: SPOTIFY_CLIENT_ID, scope: SCOPE, redirect_uri: redirect, state,
      });
      res.writeHead(302, { Location: auth.toString() });
      return res.end();
    }

    if (p === '/callback') {
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const redirect = pendingStates.get(state);
      pendingStates.delete(state);
      if (!code || !redirect) return send(res, 400, 'Bad request. Start again at /login', 'text/plain');
      try {
        const data = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirect });
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
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, 'Server error', 'text/plain'); else res.end();
  }
});

server.on('listening', () => {
  const a = server.address();
  console.log(`Listening on ${a.address}:${a.port}`);
  console.log(`Overlay:   http://localhost:${PORT}/`);
  console.log(`Customize: http://localhost:${PORT}/customize${ADMIN_KEY ? '  (asks for your admin key)' : '  (WARNING: no ADMIN_KEY set, anyone can edit)'}`);
  console.log(refreshToken ? 'Spotify: connected' : 'Spotify: not connected yet, open /login (see README for the login step)');
});

// Listen on IPv6 + IPv4 (dual-stack) by default; fall back to IPv4 only if the host has no IPv6.
function start(host) {
  server.once('error', e => {
    if (!HOST && host === '::' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL', 'EINVAL'].includes(e.code)) return start('0.0.0.0');
    console.error(e.message); process.exit(1);
  });
  server.listen(PORT, host);
}
start(HOST || '::');
