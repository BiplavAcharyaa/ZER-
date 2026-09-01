const { runPowerShellScript } = require('../utils/powershellRunner');

async function getVolumeState() {
  return runPowerShellScript('audio-control.ps1', ['-Action', 'get']);
}

async function setVolume(percent) {
  const value = Math.round(Number(percent));
  if (Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error('Volume must be a number between 0 and 100.');
  }
  return runPowerShellScript('audio-control.ps1', ['-Action', 'set', '-Value', String(value)]);
}

async function increaseVolume(step = 5) {
  return runPowerShellScript('audio-control.ps1', ['-Action', 'up', '-Value', String(step)]);
}

async function decreaseVolume(step = 5) {
  return runPowerShellScript('audio-control.ps1', ['-Action', 'down', '-Value', String(step)]);
}

async function mute() {
  return runPowerShellScript('audio-control.ps1', ['-Action', 'mute']);
}

async function unmute() {
  return runPowerShellScript('audio-control.ps1', ['-Action', 'unmute']);
}

module.exports = {
  getVolumeState,
  setVolume,
  increaseVolume,
  decreaseVolume,
  mute,
  unmute,
};
