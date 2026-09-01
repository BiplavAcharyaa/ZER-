const screenshot = require('screenshot-desktop');

// Simple, dependency-light live screen stream: repeatedly grab a JPEG
// screenshot and push it to any connected HTTP client as a
// multipart/x-mixed-replace stream. Every modern browser renders this
// natively in a plain <img> tag with zero client-side JS required for the
// video itself, and there is no WebRTC negotiation, ICE, or native addon
// involved, so it can't get stuck "silently connecting" the way the old
// WebRTC pipeline could.
//
// Trade-off: this is screen-only (no system audio) and runs at a modest
// frame rate, but it is far more reliable across different Windows setups.

const BOUNDARY = 'pcremoteframe';
const TARGET_FPS = 8;
const FRAME_INTERVAL_MS = Math.round(1000 / TARGET_FPS);

const clients = new Set();
let captureTimer = null;
let capturing = false;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 10;

async function captureLoop() {
  if (clients.size === 0) {
    stopCaptureLoop();
    return;
  }

  // screenshot-desktop can reject a returned promise OR, depending on
  // platform/version, invoke its callback with an error in a way that
  // still surfaces as a rejected promise here — but to be safe against any
  // path that might throw synchronously too, this whole call is guarded.
  let imgBuffer = null;
  let captureErr = null;
  try {
    imgBuffer = await screenshot({ format: 'jpg' });
  } catch (err) {
    captureErr = err;
  }

  if (captureErr || !imgBuffer) {
    consecutiveErrors += 1;
    console.error(
      '[mjpegStream] screenshot capture failed:',
      (captureErr && captureErr.message) || 'no image returned'
    );
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error('[mjpegStream] too many consecutive capture failures, stopping stream for all clients.');
      for (const res of clients) {
        try {
          res.end();
        } catch (e) {}
      }
      clients.clear();
      stopCaptureLoop();
    }
    return;
  }

  consecutiveErrors = 0;
  broadcastFrame(imgBuffer);
}

function broadcastFrame(imgBuffer) {
  const header =
    `--${BOUNDARY}\r\n` +
    'Content-Type: image/jpeg\r\n' +
    `Content-Length: ${imgBuffer.length}\r\n\r\n`;

  for (const res of clients) {
    res.write(header);
    res.write(imgBuffer);
    res.write('\r\n');
  }
}

function startCaptureLoop() {
  if (capturing) return;
  capturing = true;
  consecutiveErrors = 0;
  captureTimer = setInterval(captureLoop, FRAME_INTERVAL_MS);
  console.log('[mjpegStream] live screen capture started.');
}

function stopCaptureLoop() {
  if (!capturing) return;
  capturing = false;
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
  console.log('[mjpegStream] live screen capture stopped (no clients).');
}

function attachClient(req, res) {
  res.writeHead(200, {
    'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',
    Pragma: 'no-cache',
    Connection: 'close',
  });

  clients.add(res);
  startCaptureLoop();

  req.on('close', () => {
    clients.delete(res);
    if (clients.size === 0) stopCaptureLoop();
  });
}

function getClientCount() {
  return clients.size;
}

module.exports = { attachClient, getClientCount };
