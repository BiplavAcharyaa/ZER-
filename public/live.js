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

  const connIndicator = document.getElementById('connIndicator');
  const connLabel = document.getElementById('connLabel');
  const videoEl = document.getElementById('remoteVideo');
  const touchSurface = document.getElementById('touchSurface');
  const startGate = document.getElementById('startGate');
  const startBtn = document.getElementById('startBtn');
  const controlBar = document.getElementById('controlBar');
  const rightClickBtn = document.getElementById('rightClickBtn');
  const dblClickBtn = document.getElementById('dblClickBtn');
  const middleClickBtn = document.getElementById('middleClickBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const liveStage = document.getElementById('liveStage');
  const keyboardToggleBtn = document.getElementById('keyboardToggleBtn');
  const keyboardBar = document.getElementById('keyboardBar');
  const keyboardInput = document.getElementById('keyboardInput');
  const enterKeyBtn = document.getElementById('enterKeyBtn');
  const backspaceKeyBtn = document.getElementById('backspaceKeyBtn');
  const closeKeyboardBtn = document.getElementById('closeKeyboardBtn');

  const socket = io();

  socket.on('connect', () => {
    connIndicator.classList.add('is-online');
    connLabel.textContent = 'Connected';
  });

  socket.on('disconnect', () => {
    connIndicator.classList.remove('is-online');
    connLabel.textContent = 'Disconnected';
  });

  let streamActive = false;
  let videoWatchdog = null;
  let frameSeen = false;

  function clearVideoWatchdog() {
    if (videoWatchdog) {
      clearTimeout(videoWatchdog);
      videoWatchdog = null;
    }
  }

  function armVideoWatchdog() {
    clearVideoWatchdog();
    frameSeen = false;

    videoWatchdog = setTimeout(() => {
      if (!frameSeen) {
        showToast(
          'Still no image from the PC — check the server console for errors.',
          true
        );
      }
    }, 8000);
  }

  videoEl.addEventListener('load', () => {
    frameSeen = true;
    clearVideoWatchdog();

    if (streamActive) {
      hideStartGate();
    }
  });

  videoEl.addEventListener('error', () => {
    if (!streamActive) return;

    showToast(
      'Live screen stream stopped — tap Start to try again.',
      true
    );

    stopStream();
  });

  function hideStartGate() {
    startGate.hidden = true;
    startGate.style.display = 'none';

    controlBar.hidden = false;
    controlBar.style.display = 'flex';
  }

  function showStartGate() {
    startGate.hidden = false;
    startGate.style.display = 'flex';

    controlBar.hidden = true;
    controlBar.style.display = 'none';
  }

  function startStream() {
    streamActive = true;

    hideStartGate();

    videoEl.src = '/api/live-stream?t=' + Date.now();

    armVideoWatchdog();
  }

  function stopStream() {
    streamActive = false;

    clearVideoWatchdog();

    videoEl.removeAttribute('src');

    showStartGate();
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    hideStartGate();
    startStream();
  });

  function getVideoRect() {
    const rect = videoEl.getBoundingClientRect();
    const vw = videoEl.naturalWidth;
    const vh = videoEl.naturalHeight;

    if (!vw || !vh) return rect;

    const rectRatio = rect.width / rect.height;
    const videoRatio = vw / vh;

    let width;
    let height;
    let left;
    let top;

    if (videoRatio > rectRatio) {
      width = rect.width;
      height = rect.width / videoRatio;
      left = rect.left;
      top = rect.top + (rect.height - height) / 2;
    } else {
      height = rect.height;
      width = rect.height * videoRatio;
      top = rect.top;
      left = rect.left + (rect.width - width) / 2;
    }

    return {
      left,
      top,
      width,
      height
    };
  }

  function pointToNormalized(clientX, clientY) {
    const r = getVideoRect();

    let x = (clientX - r.left) / r.width;
    let y = (clientY - r.top) / r.height;

    x = Math.min(1, Math.max(0, x));
    y = Math.min(1, Math.max(0, y));

    return { x, y };
  }

  function sendMove(x, y) {
    socket.emit('input:move', { x, y });
  }

  const activePointers = new Map();

  let dragging = false;
  const dragButton = 'left';
  let dragStart = null;
  let lastMoveSent = 0;

  const MOVE_THROTTLE_MS = 33;
  const DRAG_THRESHOLD = 10;

  let pendingTapTimer = null;
  let lastTapTime = 0;
  let lastTapPos = null;

  const DOUBLE_TAP_MS = 260;
  const DOUBLE_TAP_DIST = 30;

  let twoFingerStart = null;

  function throttledMove(x, y) {
    const now = Date.now();

    if (now - lastMoveSent < MOVE_THROTTLE_MS) return;

    lastMoveSent = now;

    sendMove(x, y);
  }

  touchSurface.addEventListener('pointerdown', (e) => {
    touchSurface.setPointerCapture(e.pointerId);

    activePointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY
    });

    if (activePointers.size === 1) {
      dragging = false;

      dragStart = {
        x: e.clientX,
        y: e.clientY
      };

      const { x, y } = pointToNormalized(
        e.clientX,
        e.clientY
      );

      sendMove(x, y);

    } else if (activePointers.size === 2) {

      if (pendingTapTimer) {
        clearTimeout(pendingTapTimer);
        pendingTapTimer = null;
      }

      if (dragging) {
        socket.emit('input:up', {
          button: dragButton
        });

        dragging = false;
      }

      const pts = Array.from(activePointers.values());

      twoFingerStart = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };
    }
  });

  touchSurface.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;

    const p = activePointers.get(e.pointerId);

    p.x = e.clientX;
    p.y = e.clientY;

    if (activePointers.size === 1) {

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      if (
        !dragging &&
        Math.hypot(dx, dy) > DRAG_THRESHOLD
      ) {
        dragging = true;

        socket.emit('input:down', {
          button: dragButton
        });
      }

      const { x, y } = pointToNormalized(
        e.clientX,
        e.clientY
      );

      throttledMove(x, y);

    } else if (
      activePointers.size === 2 &&
      twoFingerStart
    ) {

      const pts = Array.from(
        activePointers.values()
      );

      const midX =
        (pts[0].x + pts[1].x) / 2;

      const midY =
        (pts[0].y + pts[1].y) / 2;

      const deltaX =
        midX - twoFingerStart.x;

      const deltaY =
        midY - twoFingerStart.y;

      if (
        Math.abs(deltaY) > 6 ||
        Math.abs(deltaX) > 6
      ) {

        socket.emit('input:scroll', {
          deltaX: Math.round(-deltaX * 4),
          deltaY: Math.round(deltaY * 4)
        });

        twoFingerStart = {
          x: midX,
          y: midY
        };
      }
    }
  });

  function endPointer(e) {
    if (!activePointers.has(e.pointerId)) return;

    const wasSingle =
      activePointers.size === 1;

    activePointers.delete(e.pointerId);

    if (activePointers.size < 2) {
      twoFingerStart = null;
    }

    if (wasSingle) {

      if (dragging) {

        socket.emit('input:up', {
          button: dragButton
        });

        dragging = false;

      } else {

        const { x, y } =
          pointToNormalized(
            e.clientX,
            e.clientY
          );

        const now = Date.now();

        const isDoubleTap =
          lastTapPos &&
          now - lastTapTime < DOUBLE_TAP_MS &&
          Math.hypot(
            e.clientX - lastTapPos.x,
            e.clientY - lastTapPos.y
          ) < DOUBLE_TAP_DIST;

        if (isDoubleTap) {

          if (pendingTapTimer) {
            clearTimeout(pendingTapTimer);
            pendingTapTimer = null;
          }

          sendMove(x, y);

          socket.emit(
            'input:doubleclick',
            {
              button: 'left'
            }
          );

          lastTapTime = 0;
          lastTapPos = null;

        } else {

          lastTapTime = now;

          lastTapPos = {
            x: e.clientX,
            y: e.clientY
          };

          pendingTapTimer = setTimeout(() => {

            sendMove(x, y);

            socket.emit(
              'input:click',
              {
                button: 'left'
              }
            );

            pendingTapTimer = null;

          }, DOUBLE_TAP_MS);
        }
      }
    }
  }

  touchSurface.addEventListener(
    'pointerup',
    endPointer
  );

  touchSurface.addEventListener(
    'pointercancel',
    endPointer
  );

  rightClickBtn.addEventListener('click', () => {
    socket.emit('input:click', {
      button: 'right'
    });
  });

  dblClickBtn.addEventListener('click', () => {
    socket.emit('input:doubleclick', {
      button: 'left'
    });
  });

  middleClickBtn.addEventListener('click', () => {
    socket.emit('input:click', {
      button: 'middle'
    });
  });

  fullscreenBtn.addEventListener(
    'click',
    async () => {

      try {

        if (!document.fullscreenElement) {

          if (liveStage.requestFullscreen) {
            await liveStage.requestFullscreen();
          } else if (
            liveStage.webkitRequestFullscreen
          ) {
            liveStage.webkitRequestFullscreen();
          }

          if (
            screen.orientation &&
            screen.orientation.lock
          ) {
            try {
              await screen.orientation.lock(
                'landscape'
              );
            } catch (err) {}
          }

          fullscreenBtn.classList.add(
            'is-active'
          );

        } else {

          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (
            document.webkitExitFullscreen
          ) {
            document.webkitExitFullscreen();
          }

          fullscreenBtn.classList.remove(
            'is-active'
          );
        }

      } catch (err) {
        showToast(
          err.message,
          true
        );
      }
    }
  );

  function openKeyboard() {
    keyboardBar.hidden = false;
    keyboardToggleBtn.classList.add(
      'is-active'
    );

    keyboardInput.value = '';
    keyboardInput.focus();
  }

  function closeKeyboard() {
    keyboardBar.hidden = true;

    keyboardToggleBtn.classList.remove(
      'is-active'
    );

    keyboardInput.blur();
  }

  keyboardToggleBtn.addEventListener(
    'click',
    () => {

      if (keyboardBar.hidden) {
        openKeyboard();
      } else {
        closeKeyboard();
      }
    }
  );

  closeKeyboardBtn.addEventListener(
    'click',
    closeKeyboard
  );

  keyboardInput.addEventListener(
    'input',
    (e) => {

      const inputType =
        e.inputType || '';

      if (
        inputType ===
        'deleteContentBackward'
      ) {

        socket.emit(
          'input:key',
          {
            key: 'Backspace'
          }
        );

        return;
      }

      if (
        inputType.indexOf('insert') === 0 &&
        e.data
      ) {

        socket.emit(
          'input:text',
          {
            text: e.data
          }
        );

        keyboardInput.value = '';

        return;
      }

      if (
        !inputType &&
        keyboardInput.value
      ) {

        socket.emit(
          'input:text',
          {
            text: keyboardInput.value
          }
        );

        keyboardInput.value = '';
      }
    }
  );

  keyboardInput.addEventListener(
    'keydown',
    (e) => {

      if (e.key === 'Enter') {

        e.preventDefault();

        socket.emit(
          'input:key',
          {
            key: 'Enter'
          }
        );

      } else if (
        e.key === 'Backspace' &&
        !keyboardInput.value
      ) {

        socket.emit(
          'input:key',
          {
            key: 'Backspace'
          }
        );

      } else if (e.key === 'Tab') {

        e.preventDefault();

        socket.emit(
          'input:key',
          {
            key: 'Tab'
          }
        );

      } else if (e.key === 'Escape') {

        socket.emit(
          'input:key',
          {
            key: 'Escape'
          }
        );
      }
    }
  );

  enterKeyBtn.addEventListener(
    'click',
    () => {
      socket.emit(
        'input:key',
        {
          key: 'Enter'
        }
      );
    }
  );

  backspaceKeyBtn.addEventListener(
    'click',
    () => {
      socket.emit(
        'input:key',
        {
          key: 'Backspace'
        }
      );
    }
  );

  window.addEventListener(
    'beforeunload',
    () => {
      stopStream();
    }
  );
})();
