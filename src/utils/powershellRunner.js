const { execFile } = require('child_process');
const path = require('path');

/**
 * Runs a bundled PowerShell script and resolves with its parsed JSON stdout.
 * Scripts under /scripts are expected to print a single JSON object and
 * exit with code 0 on success, or non-zero with an error message on stderr.
 *
 * Using execFile (not exec) so arguments are passed as an array and never
 * get concatenated into a shell string.
 */
function runPowerShellScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', scriptName);

    const psArgs = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      ...args,
    ];

    execFile(
      'powershell.exe',
      psArgs,
      { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const message = (stderr && stderr.trim()) || error.message;
          reject(new Error(message));
          return;
        }

        const trimmed = (stdout || '').trim();
        if (!trimmed) {
          resolve(null);
          return;
        }

        try {
          resolve(JSON.parse(trimmed));
        } catch (parseError) {
          reject(new Error(`Failed to parse PowerShell output: ${trimmed}`));
        }
      }
    );
  });
}

module.exports = { runPowerShellScript };
