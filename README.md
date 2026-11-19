# Spotify Now Playing overlay for OBS

A tiny self-hosted server plus a transparent overlay page that shows what you're playing on Spotify: album art, title, artist and a progress bar. It has a **live customize page** (position, size, colours, font and more), long titles scroll smoothly, and there are **no npm dependencies**.

It's single-user: each person runs their own copy with their own Spotify app, so the overlay only ever shows *your* music.

## Run with Docker (recommended)

The container is a normal one: it listens on port 3000 and works on **any network**: LAN, a host that's on Tailscale/Headscale, a reverse proxy, a Cloudflare Tunnel, whatever. Nothing network-specific is baked in.

1. **Spotify app:** create one at <https://developer.spotify.com/dashboard>, tick *Web API*, and add a Redirect URI (see "One-time Spotify login" below). Copy the Client ID and Secret.
2. **Configure:** copy `.env.example` to `.env` (or enter the same values as Portainer stack variables). You need `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `ADMIN_KEY` (any long random string).
3. **Data folder:** `mkdir -p data && sudo chown -R 1000:1000 data` (the container runs as uid 1000).
4. **Start:** `docker compose up -d`
5. **Log in to Spotify once** (below), then open `http://SERVER-ADDRESS:3000/customize?key=YOUR_ADMIN_KEY` and style it.
6. **OBS:** Browser Source, URL `http://SERVER-ADDRESS:3000/`, width **1920**, height **1080**, custom CSS empty.

`SERVER-ADDRESS` is whatever reaches the server from OBS: its LAN IP, tailnet IP or name, or your public domain.

### One-time Spotify login
Spotify only allows `https://` redirects, or plain `http://` for `127.0.0.1`. The redirect URI is worked out automatically from the address you open `/login` on, and it has to be added in your Spotify app. Pick whichever suits you:

- **Tunnel (no HTTPS needed):** `ssh -L 3000:127.0.0.1:3000 user@server`, add `http://127.0.0.1:3000/callback` in Spotify, open `http://127.0.0.1:3000/login?key=YOUR_ADMIN_KEY`.
- **HTTPS address** (Cloudflare Tunnel, reverse proxy, Tailscale HTTPS): add `https://your-address/callback` in Spotify and open `https://your-address/login?key=YOUR_ADMIN_KEY`. If the server can't tell it's https, set `REDIRECT_URI`.
- **Log in on your PC:** run `node server.js` locally, log in at `http://127.0.0.1:3000/login`, then copy `tokens.json` into the server's `data/` folder.

If you open `/login` on an address Spotify would reject, the page tells you exactly what to do instead of showing a Spotify error.

### Optional extras (`examples/`)
- `cloudflared.yml`: app plus a Cloudflare Tunnel for a public HTTPS domain.
- `tailscale-sidecar.yml`: gives the app its own tailnet name (works with Headscale via `TS_EXTRA_ARGS`). Not needed if the server host is already on your tailnet.
- `tailscale-funnel.yml` (+ `serve.json`): public HTTPS through Tailscale Funnel (Tailscale only).

Public means anyone can load the overlay and see what you're playing. `/login` and `/customize` always need your `ADMIN_KEY`.

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
`/customize` shows a live preview and lets you change position (9 spots including centre), edge gap, scale, card width, text sizes, corner roundness, background colour and opacity, text and accent colours, font, and what's shown (art, progress bar, label, shadow, blur). Saved changes reach OBS within ~5 seconds with no refresh. Settings are stored in `settings.json` in the data folder.

URL option: `?poll=5000` sets how often the overlay checks Spotify (ms).

## Environment variables
| Variable | Notes |
|---|---|
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | From your Spotify app |
| `REDIRECT_URI` | Optional. Worked out automatically; set only to override. Must match one in the Spotify dashboard |
| `ADMIN_KEY` | Protects `/login` and `/customize`. Required when exposed |
| `DATA_DIR` | Where `tokens.json` and `settings.json` live (`/data` in Docker) |
| `PORT`, `HOST` | Default `3000`, and IPv6 + IPv4 (falls back to IPv4 only if the host has no IPv6) |

## Notes
- Spotify can lag a few seconds, and nothing shows during a private session.
- Your Spotify login lasts until you revoke the app; if the overlay ever stops working, visit `/login` again.
- Never commit `.env`, `tokens.json` or `settings.json` (already in `.gitignore`).

MIT licensed.
