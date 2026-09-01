const { spawn } = require('child_process');
const path = require('path');

let proc = null;
let stopped = false;

function spawnHost() {
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'input-host.ps1');

  proc = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    { windowsHide: true }
  );

  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  proc.on('error', () => {
    proc = null;
  });
  proc.on('exit', () => {
    proc = null;
    if (!stopped) {
      setTimeout(spawnHost, 1000);
    }
  });
}

function send(command) {
  if (!proc || !proc.stdin || !proc.stdin.writable) return;
  try {
    proc.stdin.write(`${JSON.stringify(command)}\n`);
  } catch (err) {}
}

function start() {
  stopped = false;
  if (!proc) spawnHost();
}

function stop() {
  stopped = true;
  if (proc) {
    proc.kill();
    proc = null;
  }
}

function moveMouse(x, y) {
  send({ type: 'move', x, y });
}

function moveMouseRelative(dx, dy) {
  send({ type: 'moveRelative', dx, dy });
}

function mouseDown(button = 'left') {
  send({ type: 'down', button });
}

function mouseUp(button = 'left') {
  send({ type: 'up', button });
}

function click(button = 'left') {
  send({ type: 'click', button });
}

function doubleClick(button = 'left') {
  send({ type: 'doubleclick', button });
}

function scroll(deltaX = 0, deltaY = 0) {
  send({ type: 'scroll', deltaX, deltaY });
}

function typeText(text) {
  if (!text) return;
  send({ type: 'text', text });
}

function pressKey(key) {
  if (!key) return;
  send({ type: 'key', key });
}

module.exports = {
  start,
  stop,
  moveMouse,
  moveMouseRelative,
  mouseDown,
  mouseUp,
  click,
  doubleClick,
  scroll,
  typeText,
  pressKey,
};
