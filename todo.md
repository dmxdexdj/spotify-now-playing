# 🛠️ `spotify-now-playing` — v2.2 Polish & UX Roadmap (`dev`)

All v2.1 multi-scene, drag-to-place, and live venue features are live on `dev`! Here is the next batch of bug fixes and UX upgrades:

---

## 🐛 Bug Fixes & Validation
- [ ] **Reserved Scene Name Errors** — Block and show a clear error message if a user tries to create a scene using a route that already exists (e.g., `customize`, `login`, `logout`, `callback`, `health`, `api`, `fonts`, `assets`, or `static`).
- [ ] **Fix Spinning Vinyl Shadow Rotation** — Separate the drop shadow onto a non-rotating wrapper element so the vinyl disc and album art spin while the shadow stays fixed in place (realistic lighting).

---

## 🎨 Canva-Style "Build Your Own" Designer *(do not use the name "Canva" in the UI or codebase)*
- [ ] **Freeform Element Canvas** — Upgrade the *Build your own* layout into a Canva-style editor where users can independently drag, resize, layer, and style every element (**Album Art**, **Track Title**, **Artist Name**, **Top Label**, and **Progress Bar**) anywhere on the card or screen.
- [ ] **Per-Element Controls** — Click any element in the preview to adjust its exact position, width/height, font size, weight, color, alignment, corner radius, and visibility without writing CSS.

---

## 🖥️ `/customize` UI & UX Polish
- [ ] **Collapsible Accordion Sections** — Turn sidebar sections (*Layout*, *Position*, *Colours*, *Broadcast*, *Graphic Control*, etc.) into clean, clickable dropdown/accordion panels so the sidebar stays compact and easy to scan.
- [ ] **Consistent Dark Theme & Custom Scrollbars** — Style native `<select>` dropdowns, inputs, checkboxes, and custom `::-webkit-scrollbar` / `scrollbar-color` rules so every browser element matches the dashboard's dark UI.
