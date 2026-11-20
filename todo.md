# 🛠️ `spotify-now-playing` — QoL & Live Venue Roadmap (`dev`)

All core v2.0 features and the batch below are built. Open items are at the end.

## 📖 Documentation
- [x] **README positioning** — built for live venues/theatres (ATEM, broadcast keyers, house audio) and live streaming (OBS, vMix), with notes for HDMI/SDI keying and isolated show networks.

## 🎭 Live Venue & Blackmagic Broadcast Features
- [x] **Luma / Chroma key background** — Transparent, Black (luma), Chroma green, Chroma blue.
- [x] **Title-safe margin** — 90% safe area option, plus a guide in the preview and snap-to-safe-edge when dragging.
- [x] **Custom header / label text** — with one-click presets (Pre-show music, Intermission, House audio).
- [x] **Manual Show/Hide and auto-dismiss** — Show/Hide/Toggle buttons and `POST /api/trigger`, or pop in for N seconds on each new track.
- [x] **Show-control bridges (`examples/`)** — Companion and QLab (`show-control.md`), VLC and foobar2000 (`local-player-bridge.py`).

## 🎨 Overlay & `/customize` QoL
- [x] **Scenes** — each scene has its own link (`/brb`) and its own settings.
- [x] **Drag-and-drop preview canvas** — free X/Y placement with snap-to-centre and title-safe guides, arrow-key nudge.
- [x] **Custom font upload** — `.ttf` / `.otf` / `.woff` / `.woff2`, stored in `data/fonts/`.
- [x] **Context-aware controls** — settings that don't apply to the chosen layout are hidden.
- [x] **Build-your-own layout** — art left/right/top/bottom/behind, text alignment, art size.
- [x] **Smart marquee** for long titles (was already in v2.0).
- [x] **Copy buttons** — overlay URL, Spotify redirect URI (also on the `/login` help page), and the trigger command.
- [x] **Live status pills** — Spotify connection, active source, connected displays (also per scene).
- [x] **Export / import theme presets** and **Reset to defaults**.
- [x] **Custom CSS box** per scene.
- [x] **Demo card only in the preview** — the real overlay stays hidden when nothing is playing.

## 🔌 Companion Scripts & Self-Hosting QoL
- [x] **Windows media (SMTC) script** — `examples/windows-media.py`.
- [x] **Browser userscript** — `examples/userscript.user.js` (`navigator.mediaSession`).
- [x] **`/health` endpoint** — used by the Docker healthcheck.
- [x] **`dev` branch publishes `:dev`**; `latest` stays on `main`.

## 🔮 Ideas
- [ ] Album art in the Windows media script (read the SMTC thumbnail and send it as a data URI).
- [ ] Rename scenes, and drag to reorder them.
- [ ] Per-scene "hide when this scene isn't the active OBS scene" via OBS WebSocket.
