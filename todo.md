# Overlay Studio — Editor & Playback Upgrade TODO

Upgrade the `customize.html` overlay layout builder into a full-featured visual design editor and tighten track-change responsiveness.

## Playback, Polling & Transitions
- [x] **Smart Track-End Poll (`durationMs + 200ms`):** Schedule an immediate Spotify API poll ~`0.2s` after the current track's expected end time (`durationMs - progressMs + 200ms`) so song transitions update on the overlay almost instantaneously instead of waiting for the next regular `POLL_MS` tick.
- [x] **Show/Hide Transition Animation Presets:** Let the user pick which entrance/exit animation plays whenever the overlay appears, hides, or triggers (e.g., Fade, Slide Up/Down/Left/Right, Pop/Scale, Blur Dissolve, Wipe, or Instant Cut) with a simple speed/duration preset—clean preset choices without full keyframe timeline complexity.

## Core Controls & Selection
- [x] **Undo / Redo (`Ctrl+Z` / `Ctrl+Y`):** Full history stack + top bar undo/redo buttons.
- [x] **Windows-Style Drag Marquee Select:** Click and drag on empty stage space to draw a selection box and select all elements inside (`Shift+Drag` to add, `Ctrl+A` to select all).
- [x] **Group Moving & Alignment:** Drag multiple selected items together and align them to each other or to the 1920×1080 stage.
- [~] **8-Point Resize Handles & Arrow Nudging:** (done except `Ctrl+D` duplicate; `Delete` hides the element, since the six elements are fixed) Corner/edge resize handles, snap guides, `Arrow` (`1px`) and `Shift+Arrow` (`10px`) nudging, `Ctrl+D` duplicate, `Delete` to remove, and layer lock/unlock.

## Floating Contextual Top Bar (On Element Click)
- [x] **Individual Element Variants & Effects:** Change each element's behavior/style independently—for example, switching *just* the album art into a spinning vinyl disc (with spin speed/pause toggle), toggling scrolling marquee text on long titles, or changing progress bar styles per element.
- [x] **Text Formatting:** Font family (including uploaded custom fonts), font size, text color + chameleon album-art color toggle, bold, italic, underline, uppercase, letter spacing, line height, and text alignment (left / center / right).
- [x] **Text Effects:** Drop shadow, text stroke/outline, and background pill/badge styling.
- [x] **Media & Shape Styling:** Corner radius, opacity, border width/color, drop shadow/glow, and progress bar fill/track colors.
- [x] **Layer & Stage Actions:** Bring forward / send backward, center horizontally/vertically on stage, duplicate, lock, and delete.
- [ ] **Basically everything a modern web graphic design editor can do that's relevant to live broadcast overlays.**


## Still open
- `Ctrl+D` duplicate / adding extra elements (the canvas has six fixed elements today).
- Vinyl variant is a per-element spin on the album art; there is no separate disc shape.
- Extra text-field editing beyond title/artist/label (custom text boxes, shapes, images).
