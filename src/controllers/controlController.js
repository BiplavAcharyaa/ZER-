const browserService = require('../services/browserService');
const mediaService = require('../services/mediaService');
const volumeService = require('../services/volumeService');
const systemService = require('../services/systemService');
const screenshotService = require('../services/screenshotService');
const { getLanIpAddress } = require('../services/networkService');

/**
 * Wraps an async service call, sending { ok: true, data } on success or
 * { ok: false, error } with a 500 on failure — so one failing Windows
 * operation (e.g. app not installed) never crashes the server.
 */
function handle(serviceCall) {
  return async (req, res) => {
    try {
      const data = await serviceCall(req);
      res.json({ ok: true, data: data || null });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
    }
  };
}

module.exports = {
  // Status
  getStatus: handle(async () => {
    const [system, volume] = await Promise.all([
      systemService.getSystemStatus(),
      volumeService.getVolumeState().catch(() => null),
    ]);
    return { system, volume, lanIp: getLanIpAddress() };
  }),

  // Browser / app launching
  openBrave: handle(() => browserService.openBrave()),
  openYouTube: handle(() => browserService.openYouTube()),
  openWhatsAppWeb: handle(() => browserService.openWhatsAppWeb()),
  openWhatsAppDesktop: handle(() => browserService.openWhatsAppDesktop()),
  openChatGpt: handle(() => browserService.openChatGpt()),
  openClaude: handle(() => browserService.openClaude()),
  openGemini: handle(() => browserService.openGemini()),

  // Media
  mediaPlayPause: handle(() => mediaService.playPause()),
  mediaNext: handle(() => mediaService.next()),
  mediaPrevious: handle(() => mediaService.previous()),
  mediaStop: handle(() => mediaService.stop()),

  // Volume
  getVolume: handle(() => volumeService.getVolumeState()),
  setVolume: handle((req) => volumeService.setVolume(req.body?.volume)),
  volumeUp: handle(() => volumeService.increaseVolume()),
  volumeDown: handle(() => volumeService.decreaseVolume()),
  mute: handle(() => volumeService.mute()),
  unmute: handle(() => volumeService.unmute()),

  // Screenshot
  getScreenshot: handle(() => screenshotService.captureScreenshot()),
};
