const express = require('express');
const controller = require('../controllers/controlController');
const mjpegStreamService = require('../services/mjpegStreamService');

const router = express.Router();

// Status
router.get('/status', controller.getStatus);

// Browser / apps
router.post('/browser/brave', controller.openBrave);
router.post('/browser/youtube', controller.openYouTube);
router.post('/browser/whatsapp-web', controller.openWhatsAppWeb);
router.post('/apps/whatsapp', controller.openWhatsAppDesktop);
router.post('/apps/chatgpt', controller.openChatGpt);
router.post('/apps/claude', controller.openClaude);
router.post('/apps/gemini', controller.openGemini);

// Media
router.post('/media/play-pause', controller.mediaPlayPause);
router.post('/media/next', controller.mediaNext);
router.post('/media/previous', controller.mediaPrevious);
router.post('/media/stop', controller.mediaStop);

// Volume
router.get('/volume', controller.getVolume);
router.post('/volume', controller.setVolume);
router.post('/volume/up', controller.volumeUp);
router.post('/volume/down', controller.volumeDown);
router.post('/volume/mute', controller.mute);
router.post('/volume/unmute', controller.unmute);

// Screenshot
router.get('/screenshot', controller.getScreenshot);

// Live screen (MJPEG stream — screen only, no audio)
router.get('/live-stream', (req, res) => mjpegStreamService.attachClient(req, res));

module.exports = router;
