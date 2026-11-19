# 🎵 `spotify-now-playing` — v2.0 Roadmap

A lightweight, self-hosted, zero-dependency Spotify Now Playing overlay for OBS. Everything planned for **v2.0** is built:

---

## 🎨 UI, Layouts & Customization

- [x] **Auto-Adaptive Album Art Colors ("Chameleon Mode")** — Progress bar and card accents automatically match the playing track's album art.
- [x] **Background Mode (Full-Screen)** — Full-screen layout with a blurred album-art backdrop (ideal for "Starting Soon" or "BRB" scenes).
- [x] **Multiple Layout Variants / Themes** — *Classic Card*, *Compact Pill*, *Wide Bar*, *Spinning Vinyl* and *Full Screen*, chosen in `/customize`.
- [x] **True Live View in `/customize`** — The preview shows your real track, colours and progress, and falls back to the demo card automatically when nothing is playing.
- [x] **Automatic Demo Fallback** — Falls back to the demo card whenever Spotify is paused, unlinked or errors (switchable to "hide" in `/customize`).
- [x] **Custom Favicons** — Inline SVG favicons on the overlay, `/customize` and the sign-in page.

---

## 🎛️ Optional Streamer Toggles (`/customize`)

- [x] **Track Change Flash** — Pulses the border for 3 seconds when a new song starts.
- [x] **Explicit Tracks Filter** — Show normally, mask the title and art, or hide the overlay for `explicit: true` tracks.

---

## ⚙️ Backend, Security & Performance

- [x] **Proper Login Box for `/customize` Auth** — Password prompt with a signed `HttpOnly` session cookie. Old `?key=` links still work once, then the key is removed from the address bar.
- [x] **Server-Sent Events (`/api/stream`)** — Track changes and `/customize` saves are pushed to OBS instantly. Falls back to polling if a proxy blocks the stream.
- [x] **Keep Default Port on `3000`** — Unchanged; Docker users can still map `-p 80:3000`.

---

## 🔮 Future / Nice-to-Have

- [x] **Universal Player Webhook (`POST /api/update`)** — `ADMIN_KEY`-protected endpoint for Windows media, Last.fm, ListenBrainz or any other player.
