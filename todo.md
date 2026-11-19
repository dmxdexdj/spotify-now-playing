# 🎵 `spotify-now-playing` — v2.0 Roadmap

A lightweight, self-hosted, zero-dependency Spotify Now Playing overlay for OBS. Here is what is planned and in progress for **v2.0**:

---

## 🎨 UI, Layouts & Customization
- [ ] **Auto-Adaptive Album Art Colors ("Chameleon Mode")** — Progress bar and card accents automatically match the playing track's album art.
- [ ] **Background Mode (Full-Screen)** — Add a full-screen background layout option in `/customize` where the overlay fills the entire screen (ideal for "Starting Soon" or "BRB" scenes).
- [ ] **Multiple Layout Variants / Themes** — Add a layout selector in `/customize` to switch between visual styles (e.g., *Classic Card*, *Compact Pill*, *Wide Bottom Bar*, *Spinning Vinyl*) without editing CSS.
- [ ] **True Live View in `/customize`** — Display your actual real-time Spotify track, colors, and progress bar inside the `/customize` preview instead of a static mockup.
- [ ] **Automatic Demo Fallback** — Cleanly fall back to the original demo card whenever Spotify is paused, unlinked, or hits an API error so the overlay never looks broken on stream.
- [ ] **Custom Favicons** — Add clean SVG/PNG favicons to both the main overlay page and the `/customize` dashboard tabs.

---

## 🎛️ Optional Streamer Toggles (`/customize`)
- [ ] **Track Change Toast / "Up Next" Flash** — Toggle to briefly highlight or pulse the border for 3 seconds whenever a new song starts.
- [ ] **Hide Explicit Tracks Filter** — Toggle to automatically hide the overlay (or mask the title) when Spotify flags a track as `explicit: true`.

---

## ⚙️ Backend, Security & Performance
- [ ] **Proper Login Box for `/customize` Auth** — Replace passing the admin key in the URL (`?key=...`) with a clean password prompt on `/customize` (stored via cookie/localStorage) so the key never leaks in browser history or on stream.
- [ ] **Server-Sent Events (`SSE` via `/api/stream`)** — Replace HTTP polling with a persistent, zero-dependency Node.js SSE stream so track changes and `/customize` edits push to OBS in milliseconds.
- [ ] **Keep Default Port on `3000`** — Keep `3000` as the default port so non-Docker users avoid root permission errors on Linux/macOS, while Docker users can still map `-p 80:3000`.

---

## 🔮 Future / Nice-to-Have
- [ ] **Universal Player Webhook (`POST /api/update`)** — Add an `ADMIN_KEY`-protected endpoint to accept track data from Windows SMTC, Last.fm, or ListenBrainz for non-Spotify media players.
