"""
Send whatever Windows is playing (YouTube Music, Apple Music, VLC, browsers, ...) to the overlay.
It reads the Windows system media controls, so it needs no player-specific setup.

  pip install winsdk
  set NP_URL=http://SERVER-ADDRESS:3000    (default http://127.0.0.1:3000)
  set NP_KEY=YOUR_ADMIN_KEY
  python windows-media.py

Works on an isolated show network: the server only has to be reachable from this PC.
Album art is not sent by this script; the overlay shows its placeholder instead.
"""
import asyncio, json, os, urllib.request

URL = os.environ.get("NP_URL", "http://127.0.0.1:3000").rstrip("/") + "/api/update"
KEY = os.environ.get("NP_KEY", "")
EVERY = 3  # seconds between updates
TTL = 12   # the overlay hides the track this long after the last update

from winsdk.windows.media.control import (
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
)

def post(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    try:
        urllib.request.urlopen(req, timeout=4).read()
    except Exception as e:
        print("send failed:", e)

async def main():
    mgr = await Manager.request_async()
    was_playing = False
    while True:
        s = mgr.get_current_session()
        playing = bool(s) and s.get_playback_info().playback_status == Status.PLAYING
        if playing:
            props = await s.try_get_media_properties_async()
            tl = s.get_timeline_properties()
            post({
                "title": props.title or "Unknown", "artist": props.artist or "", "album": props.album_title or "",
                "progressMs": int(tl.position.total_seconds() * 1000),
                "durationMs": int((tl.end_time - tl.start_time).total_seconds() * 1000),
                "ttl": TTL,
            })
        elif was_playing:
            post({"isPlaying": False})
        was_playing = playing
        await asyncio.sleep(EVERY)

asyncio.run(main())
