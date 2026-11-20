// ==UserScript==
// @name         Now Playing bridge (any web player)
// @namespace    spotify-now-playing
// @version      1.0
// @description  Sends the page's media session (title, artist, art, progress) to your overlay server.
// @match        https://music.youtube.com/*
// @match        https://www.youtube.com/*
// @match        https://music.apple.com/*
// @match        https://soundcloud.com/*
// @match        https://*.bandcamp.com/*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==
// Edit the two values below. Tampermonkey will ask once to allow connecting to your server.
// Add more @match lines for other players.
(function () {
  const SERVER = 'http://127.0.0.1:3000';   // your overlay server
  const KEY = 'YOUR_ADMIN_KEY';
  const EVERY = 3000, TTL = 12;
  let was = false;

  function send(body) {
    GM_xmlhttpRequest({
      method: 'POST', url: SERVER.replace(/\/$/, '') + '/api/update',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      data: JSON.stringify(body),
    });
  }
  setInterval(() => {
    const ms = navigator.mediaSession, m = ms && ms.metadata;
    const media = document.querySelector('video, audio');
    const playing = !!(m && m.title && ms.playbackState === 'playing');
    if (playing) {
      const art = (m.artwork || []).slice().sort((a, b) => parseInt(b.sizes) - parseInt(a.sizes))[0];
      send({
        title: m.title, artist: m.artist || '', album: m.album || '', art: art ? art.src : undefined, ttl: TTL,
        progressMs: media ? Math.round(media.currentTime * 1000) : 0,
        durationMs: media && isFinite(media.duration) ? Math.round(media.duration * 1000) : 0,
      });
    } else if (was) send({ isPlaying: false });
    was = playing;
  }, EVERY);
})();
