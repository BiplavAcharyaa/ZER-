(function () {
  'use strict';

  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.toggle('is-error', Boolean(isError));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3000);
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Invalid server response' }));
    if (!json.ok) {
      throw new Error(json.error || 'Request failed');
    }
    return json.data;
  }

  async function getJson(url) {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({ ok: false, error: 'Invalid server response' }));
    if (!json.ok) {
      throw new Error(json.error || 'Request failed');
    }
    return json.data;
  }

  // ---------- Generic action buttons (Apps & Websites, Media) ----------
  document.querySelectorAll('[data-action="post"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-url');
      btn.classList.add('is-loading');
      try {
        await postJson(url);
        showToast(`${btn.textContent.replace(/\s+/g, ' ').trim()} — sent`);
      } catch (err) {
        showToast(err.message, true);
      } finally {
        btn.classList.remove('is-loading');
      }
    });
  });

  // ---------- Volume ----------
  const volumeValueEl = document.getElementById('volumeValue');
  const muteTagEl = document.getElementById('muteTag');
  const volumeSlider = document.getElementById('volumeSlider');
  const volUpBtn = document.getElementById('volUpBtn');
  const volDownBtn = document.getElementById('volDownBtn');
  const muteBtn = document.getElementById('muteBtn');
  const unmuteBtn = document.getElementById('unmuteBtn');

  let sliderDebounce = null;
  let userIsDraggingSlider = false;

  function renderVolume(state) {
    if (!state) return;
    volumeValueEl.textContent = state.volume;
    muteTagEl.hidden = !state.muted;
    if (!userIsDraggingSlider) {
      volumeSlider.value = state.volume;
    }
  }

  volumeSlider.addEventListener('input', () => {
    userIsDraggingSlider = true;
    volumeValueEl.textContent = volumeSlider.value;
    clearTimeout(sliderDebounce);
    sliderDebounce = setTimeout(async () => {
      try {
        const data = await postJson('/api/volume', { volume: Number(volumeSlider.value) });
        renderVolume(data);
      } catch (err) {
        showToast(err.message, true);
      } finally {
        userIsDraggingSlider = false;
      }
    }, 250);
  });

  volUpBtn.addEventListener('click', async () => {
    try {
      renderVolume(await postJson('/api/volume/up'));
    } catch (err) {
      showToast(err.message, true);
    }
  });

  volDownBtn.addEventListener('click', async () => {
    try {
      renderVolume(await postJson('/api/volume/down'));
    } catch (err) {
      showToast(err.message, true);
    }
  });

  muteBtn.addEventListener('click', async () => {
    try {
      renderVolume(await postJson('/api/volume/mute'));
    } catch (err) {
      showToast(err.message, true);
    }
  });

  unmuteBtn.addEventListener('click', async () => {
    try {
      renderVolume(await postJson('/api/volume/unmute'));
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // ---------- System readouts ----------
  const cpuValueEl = document.getElementById('cpuValue');
  const ramValueEl = document.getElementById('ramValue');
  const uptimeValueEl = document.getElementById('uptimeValue');
  const lanIpValueEl = document.getElementById('lanIpValue');

  function renderSystem(system) {
    if (!system) return;
    cpuValueEl.textContent = `${system.cpu.usagePercent}%`;
    ramValueEl.textContent = `${system.memory.usedPercent}%`;
    uptimeValueEl.textContent = system.uptime.formatted;
  }

  // ---------- Screenshot ----------
  const screenshotBtn = document.getElementById('screenshotBtn');
  const screenshotWrap = document.getElementById('screenshotWrap');
  const screenshotImg = document.getElementById('screenshotImg');
  const screenshotDownload = document.getElementById('screenshotDownload');

  screenshotBtn.addEventListener('click', async () => {
    screenshotBtn.classList.add('is-loading');
    screenshotBtn.textContent = 'Capturing…';
    try {
      const data = await getJson('/api/screenshot');
      screenshotImg.src = data.dataUrl;
      screenshotDownload.href = data.dataUrl;
      screenshotWrap.hidden = false;
      showToast('Screenshot captured');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      screenshotBtn.classList.remove('is-loading');
      screenshotBtn.textContent = 'Capture Screenshot';
    }
  });

  // ---------- Connection status + live updates via Socket.IO ----------
  const connIndicator = document.getElementById('connIndicator');
  const connDot = document.getElementById('connDot');
  const connLabel = document.getElementById('connLabel');

  const socket = io();

  socket.on('connect', () => {
    connIndicator.classList.add('is-online');
    connLabel.textContent = 'Connected';
  });

  socket.on('disconnect', () => {
    connIndicator.classList.remove('is-online');
    connLabel.textContent = 'Disconnected';
  });

  socket.on('status', (payload) => {
    renderSystem(payload.system);
    renderVolume(payload.volume);
  });

  // ---------- Initial load (LAN IP + first status snapshot) ----------
  (async function init() {
    try {
      const data = await getJson('/api/status');
      lanIpValueEl.textContent = data.lanIp || 'unknown';
      renderSystem(data.system);
      renderVolume(data.volume);
    } catch (err) {
      showToast('Could not load initial status', true);
    }
  })();
})();
