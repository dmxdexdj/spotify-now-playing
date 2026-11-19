# Spotify Now Playing overlay for OBS

A tiny self-hosted server plus a transparent overlay page that shows what you're playing on Spotify: album art, title, artist and a progress bar. It has a **live customize page** (position, size, colours, font and more), long titles scroll smoothly, and there are **no npm dependencies**.

It's single-user: each person runs their own copy with their own Spotify app, so the overlay only ever shows *your* music.

## Run with Docker (recommended)

1. **Spotify app:** create one at <https://developer.spotify.com/dashboard>, tick *Web API*, and add your Redirect URI (see below). Copy the Client ID and Secret.
2. **Pick how it's reached:**
   - **Local/LAN only:** Redirect URI `http://127.0.0.1:3000/callback` (do the one-time login from a browser on the server, or via `ssh -L 3000:127.0.0.1:3000 user@server`).
   - **HTTPS domain:** Redirect URI `https://YOUR-DOMAIN/callback`. The included compose file uses a **Tailscale sidecar** to give you `https://nowplaying.YOUR-TAILNET.ts.net` (public with Funnel, or tailnet-only).
3. **Configure:** copy `.env.example` to `.env` and fill it in. `ADMIN_KEY` is required; pick a long random string.
4. **Start:** `docker compose up -d`
5. **Log in once:** open `/login?key=YOUR_ADMIN_KEY` and approve. The token is saved in `data/tokens.json`.
6. **Style it:** open `/customize?key=YOUR_ADMIN_KEY`, then Save.
7. **OBS:** Browser Source, URL `https://YOUR-DOMAIN/` (or `http://SERVER-IP:3000/`), width **1920**, height **1080**. Leave the custom CSS empty.

The data folder is written by the container's `node` user (uid 1000): `sudo chown -R 1000:1000 data`.

### Tailscale notes
- Create an auth key at <https://login.tailscale.com/admin/settings/keys> and put it in `TS_AUTHKEY`.
- Your domain is `HOSTNAME.TAILNET.ts.net`. Find the tailnet name in the Tailscale admin console (DNS page).
- `serve.json` enables **Funnel** (public internet). Funnel must be allowed in your tailnet policy. To keep it private to your tailnet, delete the `AllowFunnel` block.
- Public means anyone can load the overlay and see what you're playing. `/login` and `/customize` need your `ADMIN_KEY`.

### Auto-updating image
Pushing to `main` builds and publishes `ghcr.io/<you>/spotify-now-playing:latest` (amd64 + arm64) via GitHub Actions. Set the package to **Public** in GitHub (Packages → Package settings) so servers can pull it. Containers labelled for Watchtower (included) update themselves.

## Run without Docker
Needs Node 18+.
```
cp .env.example .env     # fill in the Spotify values, REDIRECT_URI and ADMIN_KEY
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
| `REDIRECT_URI` | Must exactly match one in the Spotify dashboard. `http://` only works for `127.0.0.1` |
| `ADMIN_KEY` | Protects `/login` and `/customize`. Required when exposed |
| `DATA_DIR` | Where `tokens.json` and `settings.json` live (`/data` in Docker) |
| `PORT`, `HOST` | Default `3000`, `0.0.0.0` |

## Notes
- Spotify can lag a few seconds, and nothing shows during a private session.
- Your Spotify login lasts until you revoke the app; if the overlay ever stops working, visit `/login` again.
- Never commit `.env`, `tokens.json` or `settings.json` (already in `.gitignore`).

MIT licensed.
