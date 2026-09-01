const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const controlRoutes = require('./routes/controlRoutes');
const { getLanIpAddress } = require('./services/networkService');
const { getSystemStatus } = require('./services/systemService');
const { getVolumeState } = require('./services/volumeService');
const inputService = require('./services/inputService');
const screenshotService = require('./services/screenshotService');

// --- Configuration -----------------------------------------------------
// Plain JS config value, overridable with a --port CLI flag.
// No .env files, no secrets — this is a trusted-LAN V1 prototype.
const DEFAULT_PORT = 5000;
const STATUS_BROADCAST_INTERVAL_MS = 3000;

function resolvePort() {
  const args = process.argv.slice(2);
  const portFlagIndex = args.findIndex((arg) => arg === '--port' || arg === '-p');
  if (portFlagIndex !== -1 && args[portFlagIndex + 1]) {
    const parsed = Number(args[portFlagIndex + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  const inlineFlag = args.find((arg) => arg.startsWith('--port='));
  if (inlineFlag) {
    const parsed = Number(inlineFlag.split('=')[1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  return DEFAULT_PORT;
}

const PORT = resolvePort();

// Last-resort safety net: one unexpected error anywhere (e.g. a transient
// screenshot/capture failure) should never take the whole server down and
// disconnect every feature. Log it and keep running.
process.on('uncaughtException', (err) => {
  console.error('[fatal-guard] Uncaught exception (server kept running):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[fatal-guard] Unhandled promise rejection (server kept running):', reason);
});

// --- App setup -----------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // LAN-only trusted prototype — no auth/CORS restrictions by design
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', controlRoutes);

// Basic error handler so a thrown error in a route never crashes the server.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// --- Socket.IO: live system status ---------------------------------------
async function broadcastStatus() {
  try {
    const [system, volume] = await Promise.all([
      getSystemStatus(),
      getVolumeState().catch(() => null),
    ]);
    io.emit('status', { system, volume });
  } catch (err) {
    console.error('Failed to broadcast status:', err.message);
  }
}

inputService.start();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  broadcastStatus(); // send an immediate update to the newly connected client

  socket.on('input:move', async (data) => {
    if (!data) return;
    const size = await screenshotService.getScreenSize();
    const x = Math.round(Math.min(1, Math.max(0, Number(data.x) || 0)) * size.width);
    const y = Math.round(Math.min(1, Math.max(0, Number(data.y) || 0)) * size.height);
    inputService.moveMouse(x, y);
  });

  socket.on('input:move-relative', (data) => {
    if (!data) return;
    const dx = Math.round(Number(data.dx) || 0);
    const dy = Math.round(Number(data.dy) || 0);
    if (!dx && !dy) return;
    inputService.moveMouseRelative(dx, dy);
  });

  socket.on('input:down', (data) => {
    inputService.mouseDown(data && data.button);
  });

  socket.on('input:up', (data) => {
    inputService.mouseUp(data && data.button);
  });

  socket.on('input:click', (data) => {
    inputService.click(data && data.button);
  });

  socket.on('input:doubleclick', (data) => {
    inputService.doubleClick(data && data.button);
  });

  socket.on('input:scroll', (data) => {
    if (!data) return;
    inputService.scroll(Number(data.deltaX) || 0, Number(data.deltaY) || 0);
  });

  socket.on('input:text', (data) => {
    if (!data) return;
    inputService.typeText(String(data.text || ''));
  });

  socket.on('input:key', (data) => {
    if (!data) return;
    inputService.pressKey(data.key);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

setInterval(broadcastStatus, STATUS_BROADCAST_INTERVAL_MS);

// --- Start server ----------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIpAddress() || 'unavailable';

  console.log('');
  console.log('PC Remote Control');
  console.log('-----------------');
  console.log('Server running');
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`LAN:     http://${lanIp}:${PORT}`);
  console.log('');
  console.log('Open the LAN address above from your phone while on the same Wi-Fi/network.');
  console.log('');
});
