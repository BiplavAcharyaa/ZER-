const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PROGRAM_FILES = process.env['ProgramFiles'] || 'C:\\Program Files';
const PROGRAM_FILES_X86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const LOCAL_APP_DATA = process.env['LOCALAPPDATA'] || '';

const BRAVE_CANDIDATES = [
  path.join(PROGRAM_FILES, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  path.join(PROGRAM_FILES_X86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  LOCAL_APP_DATA && path.join(LOCAL_APP_DATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
].filter(Boolean);

const CHROME_CANDIDATES = [
  path.join(PROGRAM_FILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(PROGRAM_FILES_X86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  LOCAL_APP_DATA && path.join(LOCAL_APP_DATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean);

const WHATSAPP_DESKTOP_CANDIDATES = [
  LOCAL_APP_DATA && path.join(LOCAL_APP_DATA, 'WhatsApp', 'WhatsApp.exe'),
].filter(Boolean);

const URLS = {
  youtube: 'https://www.youtube.com',
  whatsappWeb: 'https://web.whatsapp.com',
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai',
  gemini: 'https://gemini.google.com',
};

function findExecutable(candidates) {
  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
}

/**
 * Launches an executable with optional arguments. Uses execFile (never a
 * shell string) so URLs/paths are passed as discrete argv entries and
 * cannot be interpreted as shell commands.
 */
function launch(executablePath, args = []) {
  return new Promise((resolve, reject) => {
    const child = execFile(executablePath, args, { windowsHide: false }, (error) => {
      // Browsers/apps that hand off to an existing process may report a
      // non-zero exit even though the window opened successfully, so we
      // only treat a launch failure (e.g. ENOENT) as a real error.
      if (error && error.code === 'ENOENT') {
        reject(error);
      }
    });
    child.unref();
    resolve();
  });
}

async function openBrave() {
  const bravePath = findExecutable(BRAVE_CANDIDATES);
  if (!bravePath) {
    throw new Error('Brave browser was not found in the expected install locations.');
  }
  await launch(bravePath, []);
  return { app: 'brave' };
}

async function openUrlInBrave(url) {
  const bravePath = findExecutable(BRAVE_CANDIDATES);
  if (!bravePath) {
    throw new Error('Brave browser was not found in the expected install locations.');
  }
  await launch(bravePath, [url]);
  return { app: 'brave', url };
}

async function openUrlInChrome(url) {
  const chromePath = findExecutable(CHROME_CANDIDATES);
  if (!chromePath) {
    throw new Error('Google Chrome was not found in the expected install locations.');
  }
  await launch(chromePath, [url]);
  return { app: 'chrome', url };
}

async function openWhatsAppDesktop() {
  const whatsappPath = findExecutable(WHATSAPP_DESKTOP_CANDIDATES);
  if (!whatsappPath) {
    throw new Error(
      'WhatsApp Desktop was not found at the expected install location. It may not be installed, or may be a Microsoft Store install that this app cannot detect in V1.'
    );
  }
  await launch(whatsappPath, []);
  return { app: 'whatsapp-desktop' };
}

module.exports = {
  URLS,
  openBrave,
  openYouTube: () => openUrlInBrave(URLS.youtube),
  openWhatsAppWeb: () => openUrlInChrome(URLS.whatsappWeb),
  openWhatsAppDesktop,
  openChatGpt: () => openUrlInChrome(URLS.chatgpt),
  openClaude: () => openUrlInChrome(URLS.claude),
  openGemini: () => openUrlInChrome(URLS.gemini),
};
