# Spotify Now Playing overlay for OBS

A tiny self-hosted server plus a transparent overlay page that shows what you're playing on Spotify. Zero npm dependencies.

- **5 layouts:** Classic card, Compact pill, Wide bar, Spinning vinyl, and a Full-screen background mode.
- **Live `/customize` page** with a real-time preview: position (9 spots incl. centre), size, colours, opacity, font, and more.
- **Chameleon mode:** accents match the album art.
- **Instant updates:** track changes and settings are pushed to OBS over Server-Sent Events (with a polling fallback).
- **Never looks broken:** falls back to a demo card when Spotify is paused, unlinked or erroring (or hides, your choice).
- **Streamer toggles:** flash on a new song, mask or hide explicit tracks.
- **Password box** for admin pages (no key in the URL).
- **Webhook** so other players can feed it too.

It's single-user: each person runs their own copy with their own Spotify app, so the overlay only ever shows *your* music.

## Run with Docker (recommended)

The container is a normal one: it listens on port 3000 and works on **any network**: LAN, a host that's on Tailscale/Headscale, a reverse proxy, a Cloudflare Tunnel, whatever. Nothing network-specific is baked in.

1. **Spotify app:** create one at <https://developer.spotify.com/dashboard>, tick *Web API*, and add a Redirect URI (see "One-time Spotify login" below). Copy the Client ID and Secret.
2. **Configure:** copy `.env.example` to `.env` (or enter the same values as Portainer stack variables). You need `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `ADMIN_KEY` (any long random string).
3. **Data folder:** `mkdir -p data && sudo chown -R 1000:1000 data` (the container runs as uid 1000).
4. **Start:** `docker compose up -d`
5. **Log in to Spotify once** (below), then open `http://SERVER-ADDRESS:3000/customize`, enter your admin key, and style it.
6. **OBS:** Browser Source, URL `http://SERVER-ADDRESS:3000/`, width **1920**, height **1080**, custom CSS empty.

`SERVER-ADDRESS` is whatever reaches the server from OBS: its LAN IP, tailnet IP or name, or your public domain.

### One-time Spotify login
Spotify only allows `https://` redirects, or plain `http://` for `127.0.0.1`. The redirect URI is worked out automatically from the address you open `/login` on, and it has to be added in your Spotify app. Pick whichever suits you:

- **Tunnel (no HTTPS needed):** `ssh -L 3000:127.0.0.1:3000 user@server`, add `http://127.0.0.1:3000/callback` in Spotify, open `http://127.0.0.1:3000/login` (it asks for your admin key).
- **HTTPS address** (Cloudflare Tunnel, reverse proxy, Tailscale HTTPS): add `https://your-address/callback` in Spotify and open `https://your-address/login`. If the server can't tell it's https, set `REDIRECT_URI`.
- **Log in on your PC:** run `node server.js` locally, log in at `http://127.0.0.1:3000/login`, then copy `tokens.json` into the server's `data/` folder.

If you open `/login` on an address Spotify would reject, the page tells you exactly what to do instead of showing a Spotify error.

### Optional extras (`examples/`)
- `cloudflared.yml`: app plus a Cloudflare Tunnel for a public HTTPS domain.
- `tailscale-sidecar.yml`: gives the app its own tailnet name (works with Headscale via `TS_EXTRA_ARGS`). Not needed if the server host is already on your tailnet.
- `tailscale-funnel.yml` (+ `serve.json`): public HTTPS through Tailscale Funnel (Tailscale only).

Public means anyone can load the overlay and see what you're playing. `/login`, `/customize`, `/api/update` and saving settings always need your `ADMIN_KEY`.

### Admin key
`ADMIN_KEY` protects the admin pages with a password box. You sign in once per browser (30-day cookie), so the key never sits in the URL or your history. Scripts can send it as `X-Admin-Key` or `Authorization: Bearer ...`. Old `?key=...` links still work once and then drop the key from the address bar.

### Auto-updating image
Pushing to `main` builds and publishes `ghcr.io/dmxdexdj/spotify-now-playing:latest` (amd64 + arm64) via GitHub Actions. Set the package to **Public** in GitHub (Packages → Package settings) so servers can pull it. Containers labelled for Watchtower (included) update themselves.

## Run without Docker
Needs Node 18+.
```
cp .env.example .env     # fill in the Spotify values and ADMIN_KEY
node server.js
```
Open `http://127.0.0.1:3000/login`, approve, then `/customize`.

## Customize
`/customize` shows a live preview of your real song (it falls back to the demo card automatically when nothing is playing) and lets you change:

- **Layout:** Classic card, Compact pill, Wide bar, Spinning vinyl, Full screen (blurred album-art backdrop, great for *Starting Soon* / *BRB* scenes).
- **Position** (9 spots incl. centre), edge gap, overall scale, card width, text sizes, corner roundness.
- **Colours:** background and opacity, text, accent, or **match the accent to the album art**.
- **Font**, and what's shown: art, progress bar, label, shadow, blur.
- **Behaviour:** what to show when idle (demo card or hide), keep the card up while paused, flash the border on a new song, and how to treat **explicit** songs (show, mask the title and art, or hide).

Saved changes reach OBS instantly. Settings are stored in `settings.json` in the data folder.

URL options: `?poll=5000` sets the fallback polling interval (ms), and `?demo=1` always shows the demo card.

## Feed it from another player
Anything that can send an HTTP request can show up on the overlay (Windows media bridges, Last.fm or ListenBrainz scripts, other players). Spotify wins whenever it's playing; otherwise the latest update is shown until it goes stale.

```
curl -X POST http://SERVER-ADDRESS:3000/api/update \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"title":"Song","artist":"Artist","art":"https://example.com/cover.jpg","durationMs":200000,"progressMs":15000}'
```

PowerShell:
```
Invoke-RestMethod -Method Post http://SERVER-ADDRESS:3000/api/update -ContentType application/json `
  -Headers @{ "X-Admin-Key" = "YOUR_ADMIN_KEY" } -Body '{"title":"Song","artist":"Artist"}'
```

Fields: `title` (required), `artist`, `album`, `art` (http(s) URL or small image data URI), `durationMs`, `progressMs`, `explicit`, and `ttl` (seconds before it disappears if you stop sending updates; default 20, max 600). Send `{"isPlaying": false}` to clear it. Needs `ADMIN_KEY` to be set.

## Environment variables
| Variable | Notes |
|---|---|
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | From your Spotify app |
| `REDIRECT_URI` | Optional. Worked out automatically; set only to override. Must match one in the Spotify dashboard |
| `ADMIN_KEY` | Protects `/login` and `/customize`. Required when exposed |
| `DATA_DIR` | Where `tokens.json` and `settings.json` live (`/data` in Docker) |
| `POLL_MS` | How often (ms) the server asks Spotify while an overlay is open. Default `2500`, minimum `1500` |
| `PORT`, `HOST` | Default `3000`, and IPv6 + IPv4 (falls back to IPv4 only if the host has no IPv6) |

## Notes
- Spotify can lag a few seconds, and nothing shows during a private session.
- Your Spotify login lasts until you revoke the app; if the overlay ever stops working, visit `/login` again.
- Never commit `.env`, `tokens.json` or `settings.json` (already in `.gitignore`).

MIT licensed.
