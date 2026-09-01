const { runPowerShellScript } = require('../utils/powershellRunner');

async function sendMediaKey(action) {
  const validActions = ['playpause', 'next', 'previous', 'stop'];
  if (!validActions.includes(action)) {
    throw new Error(`Unsupported media action: ${action}`);
  }
  return runPowerShellScript('media-keys.ps1', ['-Action', action]);
}

module.exports = {
  playPause: () => sendMediaKey('playpause'),
  next: () => sendMediaKey('next'),
  previous: () => sendMediaKey('previous'),
  stop: () => sendMediaKey('stop'),
};
