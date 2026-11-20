"""
Feed the overlay from a local player on an offline / isolated network. Standard library only.

  python local-player-bridge.py vlc       # VLC: enable Tools > Preferences > All > Interface > Main interfaces > Web,
                                          # and set a Lua HTTP password
  python local-player-bridge.py foobar    # foobar2000: install the "Beefweb" plugin (foo_beefweb)

Environment:
  NP_URL   overlay server, default http://127.0.0.1:3000
  NP_KEY   your ADMIN_KEY
  VLC_URL  default http://127.0.0.1:8080       VLC_PASSWORD  the Lua HTTP password
  BEEF_URL default http://127.0.0.1:8880
"""
import base64, json, os, sys, time, urllib.request

NP = os.environ.get("NP_URL", "http://127.0.0.1:3000").rstrip("/") + "/api/update"
KEY = os.environ.get("NP_KEY", "")
EVERY, TTL = 3, 12

def get(url, headers=None):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=4))

def send(body):
    req = urllib.request.Request(NP, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    try: urllib.request.urlopen(req, timeout=4).read()
    except Exception as e: print("send failed:", e)

def vlc():
    base = os.environ.get("VLC_URL", "http://127.0.0.1:8080").rstrip("/")
    auth = "Basic " + base64.b64encode((":" + os.environ.get("VLC_PASSWORD", "")).encode()).decode()
    d = get(base + "/requests/status.json", {"Authorization": auth})
    if d.get("state") != "playing": return None
    meta = (d.get("information") or {}).get("category", {}).get("meta", {})
    return {"title": meta.get("title") or meta.get("filename") or "Unknown", "artist": meta.get("artist", ""), "album": meta.get("album", ""),
            "progressMs": int(d.get("time", 0)) * 1000, "durationMs": int(d.get("length", 0)) * 1000}

def foobar():
    base = os.environ.get("BEEF_URL", "http://127.0.0.1:8880").rstrip("/")
    d = get(base + "/api/player?columns=%25artist%25,%25title%25,%25album%25")["player"]
    if d.get("playbackState") != "playing": return None
    item = d["activeItem"]; artist, title, album = (item.get("columns") or ["", "", ""])
    return {"title": title or "Unknown", "artist": artist, "album": album,
            "progressMs": int(max(0, item.get("position", 0)) * 1000), "durationMs": int(max(0, item.get("duration", 0)) * 1000)}

mode = sys.argv[1] if len(sys.argv) > 1 else ""
read = {"vlc": vlc, "foobar": foobar}.get(mode)
if not read: sys.exit(__doc__)
was = False
while True:
    try: t = read()
    except Exception as e: print("player read failed:", e); t = None
    if t: send({**t, "ttl": TTL})
    elif was: send({"isPlaying": False})
    was = bool(t)
    time.sleep(EVERY)
