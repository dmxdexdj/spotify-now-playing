# Spotify Now Playing overlay

A tiny self-hosted server plus an overlay page that shows what's playing. Zero npm dependencies.

Built for **live streaming** (OBS, vMix) and for **live venues and theatres** (Blackmagic ATEM luma/chroma keying over HDMI/SDI, broadcast keyers, house audio, local show networks). It runs happily on an isolated network with no internet if you feed it from a local player (see `examples/`).

- **6 layouts:** Classic card, Compact pill, Wide bar, Spinning vinyl, Full-screen background, and **Build your own** (art left/right/top/bottom/behind the text, text alignment, art size).
- **Scenes:** every scene has its own link and its own look (`/`, `/brb`, `/intermission`, ...).
- **Live `/customize` page** with a real-time preview, **drag-to-place** with snap and title-safe guides, custom fonts, custom CSS, theme export/import and a live status bar.
- **Graphic control:** always on, **Show/Hide on demand**, or pop in for a few seconds on each new track. Works from Bitfocus Companion, QLab or any script.
- **Broadcast options:** transparent, black (luma key), chroma green or chroma blue background; 90% title-safe area.
- **Chameleon mode:** accents match the album art.
- **Instant updates:** track changes and settings are pushed to the overlay over Server-Sent Events (with a polling fallback).
- **Hides when idle:** the real overlay stays empty when nothing is playing. The demo card only appears in the `/customize` preview and at `?demo=1`.
- **Streamer toggles:** flash on a new song, mask or hide explicit tracks.
- **Password box** for admin pages (no key in the URL).
- **Webhook** so other players can feed it too, and a `/health` endpoint for Docker and monitoring.

It's single-user: each person runs their own copy with their own Spotify app, so the overlay only ever shows *your* music.


## Run with Docker (recommended)

The container is a normal one: it listens on port 3000 and works on **any network**: LAN, a host that's on Tailscale/Headscale, a reverse proxy, a Cloudflare Tunnel, whatever. Nothing network-specific is baked in.

1. **Spotify app:** create one at <https://developer.spotify.com/dashboard>, tick *Web API*, and add a Redirect URI (see "One-time Spotify login" below). Copy the Client ID and Secret.
2. **Configure:** copy `.env.example` to `.env` (or enter the same values as Portainer stack variables). You need `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `ADMIN_KEY` (any long random string).
3. **Data folder:** `mkdir -p data && sudo chown -R 1000:1000 data` (the container runs as uid 1000).
4. **Start:** `docker compose up -d`
5. **Log in to Spotify once** (below), then open `http://SERVER-ADDRESS:3000/customize`, enter your admin key, and style it.
6. **OBS:** Browser Source, URL `http://SERVER-ADDRESS:3000/`, width **1920**, height **1080**, custom CSS empty. Other scenes use `http://SERVER-ADDRESS:3000/scene-name`.
7. **Venue / hardware keyer:** open the same URL full screen in a browser on the playout machine and set **Broadcast → Background** to black or chroma in `/customize`.

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
Pushing to `main` builds and publishes `ghcr.io/dmxdexdj/spotify-now-playing:latest` (amd64 + arm64) via GitHub Actions. Pushing to `dev` publishes `:dev` instead and leaves `latest` alone, so you can test on a spare container first (`IMAGE=ghcr.io/dmxdexdj/spotify-now-playing:dev`). Set the package to **Public** in GitHub (Packages → Package settings) so servers can pull it. Containers labelled for Watchtower (included) update themselves.

## Run without Docker
Needs Node 18+.
```
cp .env.example .env     # fill in the Spotify values and ADMIN_KEY
node server.js
```
Open `http://127.0.0.1:3000/login`, approve, then `/customize`.

## Customize

`/customize` shows a live preview of your real song (a demo card appears in the preview only when nothing is playing) and lets you change:

- **Layout:** Classic card, Compact pill, Wide bar, Spinning vinyl, Full screen (blurred album-art backdrop, great for *Starting Soon* / *BRB* scenes), or **Build your own**, a freeform canvas where you drag, resize, layer and style the album art, title, artist, top label, progress bar and card background anywhere on the screen. Click an element in the preview, then fine-tune its position, size, font size, weight, colour, alignment, corner radius and visibility in the sidebar.
- **Position:** nine preset spots, or **Free**: drag the card anywhere in the preview. It snaps to the centre and to the title-safe edges (hold Alt to turn snapping off, arrow keys nudge).
- **Size and colours:** edge gap, scale, card width, text sizes, corners, background and opacity, text, accent, or **match the accent to the album art**.
- **Font:** ten built-ins, or upload your own `.ttf`, `.otf`, `.woff` or `.woff2` (saved in `data/fonts/`, shared by all scenes).
- **Show:** art, progress bar, label (with quick presets such as *Intermission* and *House audio*), shadow, blur.
- **Graphic control** and **Broadcast** options (below).
- **Behaviour:** keep the card up while paused, flash the border on a new song, and how to treat **explicit** songs (show, mask the title and art, or hide).
- **Custom CSS** per scene, and **theme presets**: export, copy, import and reset.

Controls that don't apply to the chosen layout are hidden. The status bar shows whether Spotify is connected, what the active source is (Spotify or webhook) and how many displays are connected. Copy buttons give you the overlay URL and the Spotify redirect URI.

Saved changes reach the overlay instantly. Settings are stored per scene in `settings.json` in the data folder.

URL options: `?poll=5000` sets the fallback polling interval (ms), and `?demo=1` always shows the demo card.

### Scenes

Every scene has its own link and its own settings. Add one in `/customize` ("Add scene" copies the scene you're on). The default scene is served at `/`; a scene called `brb` is served at `/brb`. Names use lowercase letters, numbers and dashes. Names the server already uses (`api`, `login`, `logout`, `callback`, `customize`, `health`, `fonts`, `assets`, `static`, ...) are rejected with an error. In OBS, add a Browser Source per scene and point it at that scene's link.

### Graphic control (show and hide on demand)

Under **Graphic control**, pick how the card appears:

- **Always, while music plays** (default).
- **Only when I press Show:** the card stays hidden until you show it.
- **On each new track, then hide:** the card pops in for a few seconds whenever the song changes.

The Show / Hide / Toggle buttons in `/customize` control the live overlay. Show-control software can do the same with one HTTP request:

```
curl -X POST "http://SERVER-ADDRESS:3000/api/trigger?scene=brb" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"action":"show"}'      # or "hide" / "toggle"
```

See `examples/show-control.md` for Bitfocus Companion and QLab setups.

### Live venues and keyers

**Broadcast → Background** can be transparent (OBS, vMix), solid black (Blackmagic ATEM *luma key*), chroma green or chroma blue, for hardware keyers that have no alpha channel. **Keep the card inside the title-safe area** holds everything inside the central 90% so projectors and LED walls never clip it. The preview's *Title-safe guide* shows the edge while you place the card.

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

- `GET /health` returns `{"ok":true}` for Docker healthchecks and monitoring (no login needed). `GET /api/status` (admin) feeds the status bar.
- The "connected displays" count covers overlays using the live stream. Overlays that fell back to polling aren't counted.
- Spotify can lag a few seconds, and nothing shows during a private session.
- Your Spotify login lasts until you revoke the app; if the overlay ever stops working, visit `/login` again.
- Never commit `.env`, `tokens.json`, `settings.json` or the `data/` folder (already in `.gitignore`).

MIT licensed.
