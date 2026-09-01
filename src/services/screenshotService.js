const screenshot = require('screenshot-desktop');
const { runPowerShellScript } = require('../utils/powershellRunner');

/**
 * Captures the primary monitor and returns a PNG buffer along with
 * a ready-to-use base64 data URL for displaying directly in the browser.
 */
async function captureScreenshot() {
  try {
    const imgBuffer = await screenshot({ format: 'png' });
    const base64 = imgBuffer.toString('base64');
    return {
      dataUrl: `data:image/png;base64,${base64}`,
      capturedAt: Date.now(),
    };
  } catch (err) {
    throw new Error(`Screenshot capture failed: ${err.message}`);
  }
}

let screenSizeCache = null;

/**
 * Returns the primary monitor's resolution, used to translate the phone's
 * normalized tap/drag coordinates (0..1) on the Live Screen image into
 * actual pixel coordinates for the mouse. Cached after first successful
 * lookup since it very rarely changes during a session.
 */
async function getScreenSize() {
  if (screenSizeCache) return screenSizeCache;
  const result = await runPowerShellScript('screen-info.ps1');
  screenSizeCache = { width: result.width, height: result.height };
  return screenSizeCache;
}

module.exports = { captureScreenshot, getScreenSize };
