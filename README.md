# PC Remote Control (V1)

A LAN-only web app for controlling your Windows PC from your phone's browser —
launch apps/websites, control media playback, adjust system volume, view live
CPU/RAM/uptime, and grab a screenshot.

This is a **V1 trusted-LAN prototype**. It intentionally has **no login,
authentication, passwords, API keys, tokens, `.env` files, or security
middleware**. Anyone on your local network who knows the address can use it.
Only run this on a network you trust (e.g. your home Wi‑Fi).

---

## Requirements

- **Windows 10 or 11**
- **Node.js 24.x** (already installed, per your setup)
- Your phone and PC connected to the **same Wi‑Fi / LAN**
- Optional, for the relevant buttons to work: Brave browser, Google Chrome,
  and/or WhatsApp Desktop installed in their default locations

## Installation

1. Copy the `pc-remote-control` folder onto your Windows PC.
2. Double-click **`start.bat`**.

`start.bat` will:
- Verify Node.js and npm are installed and print the detected version.
- Run `npm install` only if `node_modules` doesn't already exist.
- Start the server.
- Keep the window open if something goes wrong, so you can read the error.

You can also start it manually from a terminal in the project folder:

```
npm install
npm start
```

## Accessing it from your phone

When the server starts, it prints something like:

```
PC Remote Control
-----------------
Server running
Local:   http://localhost:5000
LAN:     http://192.168.1.42:5000
```

On your phone's browser (same Wi‑Fi network), open the **LAN** address shown
in your own terminal — it will differ from the example above and will change
automatically if your router assigns the PC a different address later.

## How LAN IP detection works

On startup, the server scans the network interfaces reported by Windows
(`os.networkInterfaces()`), filters out internal/loopback addresses, and
prefers a normal-looking adapter over virtual ones (VPN, Hyper‑V, VMware,
WSL, etc.). Nothing is hardcoded — if your IP changes, just restart the app
and read the new address from the console.

## Changing the server port

Default port is **5000**. To use a different port, pass `--port` when
starting manually:

```
node src/server.js --port 5050
```

or

```
npm start -- --port 5050
```

(`start.bat` always uses the default port unless you edit it to add `--port`.)

---

## Live Screen Control

Open **Live Screen** on the phone to view the laptop's screen in (near)
real time. Tap the image to click, drag to move/drag the mouse,
double-tap to double-click, use the on-screen buttons for right/middle
click, and use two fingers to scroll (swipe down to scroll down, swipe up
to scroll up — same direction as a laptop trackpad). Tap the keyboard icon
to type into whatever is focused on the laptop, and the fullscreen icon
for a landscape, edge-to-edge view.

**Video only, no audio.** The stream works by repeatedly grabbing a
screenshot (via `screenshot-desktop`, the same library the Screenshot
button uses) and pushing each frame to the phone over a plain HTTP
`multipart/x-mixed-replace` stream at roughly 8 frames per second — the
same technique many IP cameras use. There's no WebRTC, no signaling
negotiation, and no native addon involved, so it works the same way on
every machine with no extra install step and no dependency on your
network having a working peer-to-peer path. The trade-off vs. real video
is a lower frame rate and no system audio, but it is far more reliable.

If the live view stays blank, check the black console window that opened
when you ran `start.bat` — any capture error will be logged there with
the message `[mjpegStream] screenshot capture failed: ...`.

## Mouse Trackpad

Open **Mouse Trackpad** on the phone for a dedicated touchpad-style
controller — no video feed, just cursor control, useful when you don't need
to see the screen (or want lower latency / less battery drain than the
video stream). Drag with one finger to move the cursor (relative movement,
like a laptop trackpad, not tap-to-position), tap to left-click, two-finger
tap to right-click, two-finger drag to scroll, double-tap to double-click,
and press-and-hold then drag to drag-select. On-screen buttons cover
left/right/middle/double click directly, and the ⚡ icon cycles through a
few cursor-speed presets.

## Troubleshooting

### Can't reach the app from my phone (Windows Firewall)

The first time the server starts, Windows may prompt to allow Node.js
through the firewall for private networks — click **Allow access**. If you
missed the prompt or it's still blocked:

1. Open **Windows Security → Firewall & network protection → Allow an app
   through firewall**.
2. Find **Node.js** (or add `node.exe`, typically in
   `C:\Program Files\nodejs\node.exe`).
3. Make sure it's checked for **Private** networks.
4. Restart the app and try again.

Also double-check your phone and PC are on the **same** Wi‑Fi network (not
guest Wi‑Fi, which usually isolates devices from each other).

### Brave / Chrome / WhatsApp buttons say "not found"

The app looks for these apps in their standard install locations:

- **Brave**: `Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`
  (or the `(x86)` / per-user `%LOCALAPPDATA%` equivalents)
- **Chrome**: `Program Files\Google\Chrome\Application\chrome.exe`
  (or the `(x86)` / per-user `%LOCALAPPDATA%` equivalents)
- **WhatsApp Desktop**: `%LOCALAPPDATA%\WhatsApp\WhatsApp.exe`

If you installed one of these somewhere non-standard, or installed WhatsApp
Desktop from the Microsoft Store (which this V1 doesn't detect), the button
will return an error instead of crashing the server. Use **WhatsApp Web**
as a reliable fallback if WhatsApp Desktop isn't detected.

### Screenshot doesn't work

Screenshot capture uses the `screenshot-desktop` package, which works out of
the box on Windows 10/11 with no extra setup. If it fails:

- Make sure you have at least one active display session (the capture will
  fail over Remote Desktop in some configurations, or if the PC is locked).
- Try restarting the app.
- Check the server console for the specific error message.

### Media keys (play/pause/next/previous/stop) don't do anything

These are sent as virtual media-key presses (the same signal a physical
keyboard's media keys send), so they only affect whichever app is currently
registered as the system's active media session (Spotify, browser tab
playing audio, etc.). If nothing is currently playing or "listening" for
media keys, there may be nothing visible to happen. Try starting playback
in an app first, then use the buttons.

If keys seem to do nothing at all:
- Confirm no security software is blocking simulated input.
- Restart the app and try again.

### Volume control doesn't work / shows an error

Volume is read and set via the Windows Core Audio API (through a bundled
PowerShell script). If you see errors:

- Make sure PowerShell execution isn't blocked by an organization policy
  (`start.bat`/the app invoke PowerShell with `-ExecutionPolicy Bypass` for
  just that one script call, which doesn't change your system-wide policy).
- Confirm you have a default playback device set in Windows sound settings.
- Check the server console for the specific PowerShell error message.

---

## Project structure

```
pc-remote-control/
├── package.json
├── package-lock.json
├── start.bat
├── README.md
├── scripts/
│   ├── audio-control.ps1     # Volume/mute get & set (Core Audio API)
│   └── media-keys.ps1        # Virtual media key presses
├── src/
│   ├── server.js             # Express + Socket.IO entrypoint
│   ├── routes/
│   │   └── controlRoutes.js
│   ├── controllers/
│   │   └── controlController.js
│   ├── services/
│   │   ├── browserService.js
│   │   ├── mediaService.js
│   │   ├── volumeService.js
│   │   ├── systemService.js
│   │   ├── screenshotService.js
│   │   └── networkService.js
│   └── utils/
│       └── powershellRunner.js
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## API reference

| Method | Endpoint                    | Description                        |
|--------|------------------------------|-------------------------------------|
| GET    | `/api/status`                | System stats, volume state, LAN IP |
| POST   | `/api/browser/brave`         | Open Brave                         |
| POST   | `/api/browser/youtube`       | Open YouTube in Brave              |
| POST   | `/api/browser/whatsapp-web`  | Open WhatsApp Web in Chrome        |
| POST   | `/api/apps/whatsapp`         | Open WhatsApp Desktop              |
| POST   | `/api/apps/chatgpt`          | Open ChatGPT in Chrome             |
| POST   | `/api/apps/claude`           | Open Claude in Chrome              |
| POST   | `/api/apps/gemini`           | Open Gemini in Chrome              |
| POST   | `/api/media/play-pause`      | Media play/pause key                |
| POST   | `/api/media/next`            | Media next-track key                |
| POST   | `/api/media/previous`        | Media previous-track key            |
| POST   | `/api/media/stop`            | Media stop key                      |
| GET    | `/api/volume`                | Current volume % and mute state    |
| POST   | `/api/volume`                | Set volume (`{ "volume": 0-100 }`) |
| POST   | `/api/volume/up`             | Increase volume                    |
| POST   | `/api/volume/down`           | Decrease volume                    |
| POST   | `/api/volume/mute`           | Mute                                |
| POST   | `/api/volume/unmute`         | Unmute                              |
| GET    | `/api/screenshot`            | Capture primary monitor (base64 PNG) |
| GET    | `/api/live-stream`           | Live screen as an MJPEG stream (used by the Live Screen page) |

Socket.IO emits a `status` event roughly every 3 seconds with the same
system + volume data, so the phone UI updates live without polling or manual
refreshes.

## Why no authentication?

By design. This is a V1 prototype meant to run only on your own trusted home
network. Adding accounts, passwords, tokens, or HTTPS is out of scope for
this version — if you later want to expose this beyond your LAN, that would
need a proper security review and redesign first.
