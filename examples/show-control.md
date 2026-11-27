# Show control: Bitfocus Companion and QLab

Both send one HTTP request to `/api/trigger` to show or hide the graphic on a scene. Set the scene's **Show the card** mode to *Only when I press Show* (or *On each new track, then hide*) in `/customize` first.

Request:

```
POST http://SERVER-ADDRESS:3000/api/trigger?scene=main
Authorization: Bearer YOUR_ADMIN_KEY
Content-Type: application/json

{"action":"show"}        // or "hide" or "toggle"
```

`scene` is the scene name (`main` for the default link `/`). `ADMIN_KEY` must be set on the server.

## Bitfocus Companion

1. Add the **Generic: HTTP Requests** connection. Leave the base URL empty, or set it to `http://SERVER-ADDRESS:3000`.
2. On a button, add the action **POST**.
3. URL: `http://SERVER-ADDRESS:3000/api/trigger?scene=main`
4. Body: `{"action":"show"}`
5. Header: `{"Authorization":"Bearer YOUR_ADMIN_KEY","Content-Type":"application/json"}`
6. Make a second button with `{"action":"hide"}`, or one button with `toggle`.

## QLab (macOS)

QLab has no HTTP cue, so use a **Script** cue (AppleScript) that runs `curl`:

```applescript
do shell script "curl -s -X POST 'http://SERVER-ADDRESS:3000/api/trigger?scene=main' -H 'Authorization: Bearer YOUR_ADMIN_KEY' -H 'Content-Type: application/json' -d '{\"action\":\"show\"}'"
```

Duplicate the cue with `hide` for the end of the track. Put these cues in your cue list next to the music cue, or use a **Group** cue with a pre-wait.

## Any other tool

Anything that can send an HTTP POST works (Stream Deck "Website" plugins with POST support, Node-RED, cron, a shell script). To send the current track from a local player as well, see `windows-media.py`, `local-player-bridge.py` and `userscript.user.js` in this folder.
