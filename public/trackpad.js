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
  const surface = document.getElementById('trackpadSurface');
  const leftClickBtn = document.getElementById('leftClickBtn');
  const rightClickBtn = document.getElementById('rightClickBtn');
  const middleClickBtn = document.getElementById('middleClickBtn');
  const dblClickBtn = document.getElementById('dblClickBtn');
  const sensitivityBtn = document.getElementById('sensitivityBtn');

  const socket = io();

  socket.on('connect', () => {
    connIndicator.classList.add('is-online');
    connLabel.textContent = 'Connected';
  });

  socket.on('disconnect', () => {
    connIndicator.classList.remove('is-online');
    connLabel.textContent = 'Disconnected';
  });

  // Cycle through a few sensitivity presets so trackpad "speed" can be
  // tuned to taste without cluttering the UI with a slider.
  const SENSITIVITY_LEVELS = [1, 1.6, 2.4];
  const SENSITIVITY_LABELS = ['1x', '1.6x', '2.4x'];
  let sensitivityIndex = 1;

  sensitivityBtn.addEventListener('click', () => {
    sensitivityIndex = (sensitivityIndex + 1) % SENSITIVITY_LEVELS.length;
    showToast(`Trackpad speed: ${SENSITIVITY_LABELS[sensitivityIndex]}`);
  });

  function currentSensitivity() {
    return SENSITIVITY_LEVELS[sensitivityIndex];
  }

  function sendMoveRelative(dx, dy) {
    if (!dx && !dy) return;
    socket.emit('input:move-relative', { dx, dy });
  }

  const activePointers = new Map();
  let dragging = false;
  const dragButton = 'left';
  let moved = false;
  let lastMoveSent = 0;
  const MOVE_THROTTLE_MS = 16;

  let pointerDownTime = 0;
  let holdTimer = null;
  const HOLD_TO_DRAG_MS = 350;

  let pendingTapTimer = null;
  let lastTapTime = 0;
  const DOUBLE_TAP_MS = 280;

  let twoFingerStart = null;
  let twoFingerMoved = false;

  // Accumulate sub-pixel movement between throttled sends so slow, precise
  // drags don't lose motion to rounding.
  let accDx = 0;
  let accDy = 0;

  function throttledMove(dx, dy) {
    accDx += dx * currentSensitivity();
    accDy += dy * currentSensitivity();
    const now = Date.now();
    if (now - lastMoveSent < MOVE_THROTTLE_MS) return;
    lastMoveSent = now;
    const outDx = Math.round(accDx);
    const outDy = Math.round(accDy);
    accDx -= outDx;
    accDy -= outDy;
    sendMoveRelative(outDx, outDy);
  }

  function clearHoldTimer() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  surface.addEventListener('pointerdown', (e) => {
    surface.setPointerCapture(e.pointerId);
    surface.classList.add('is-active');
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      moved = false;
      dragging = false;
      pointerDownTime = Date.now();
      accDx = 0;
      accDy = 0;
      clearHoldTimer();
      // Press-and-hold (without moving) starts a drag, mirroring a physical
      // trackpad's "tap and hold" gesture.
      holdTimer = setTimeout(() => {
        if (activePointers.size === 1 && !moved && !dragging) {
          dragging = true;
          socket.emit('input:down', { button: dragButton });
        }
      }, HOLD_TO_DRAG_MS);
    } else if (activePointers.size === 2) {
      if (pendingTapTimer) {
        clearTimeout(pendingTapTimer);
        pendingTapTimer = null;
      }
      clearHoldTimer();
      if (dragging) {
        socket.emit('input:up', { button: dragButton });
        dragging = false;
      }
      twoFingerMoved = false;
      const pts = Array.from(activePointers.values());
      twoFingerStart = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
    }
  });

  surface.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    const p = activePointers.get(e.pointerId);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (activePointers.size === 1) {
      if (!moved) {
        const totalDist = Math.hypot(dx, dy);
        if (totalDist > 1) moved = true;
      }
      if (!dragging && moved) {
        clearHoldTimer();
      }
      throttledMove(dx, dy);
    } else if (activePointers.size === 2 && twoFingerStart) {
      const pts = Array.from(activePointers.values());
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const deltaX = midX - twoFingerStart.x;
      const deltaY = midY - twoFingerStart.y;
      if (Math.abs(deltaY) > 6 || Math.abs(deltaX) > 6) {
        twoFingerMoved = true;
        socket.emit('input:scroll', {
          deltaX: Math.round(-deltaX * 4),
          deltaY: Math.round(deltaY * 4),
        });
        twoFingerStart = { x: midX, y: midY };
      }
    }
  });

  function endPointer(e) {
    if (!activePointers.has(e.pointerId)) return;
    const wasSingle = activePointers.size === 1;
    const wasTwo = activePointers.size === 2;
    activePointers.delete(e.pointerId);
    clearHoldTimer();

    if (activePointers.size < 2) {
      const wasTwoFingerTap = wasTwo && !twoFingerMoved;
      twoFingerStart = null;
      if (wasTwoFingerTap) {
        socket.emit('input:click', { button: 'right' });
      }
    }

    if (activePointers.size === 0) {
      surface.classList.remove('is-active');
    }

    if (wasSingle) {
      if (dragging) {
        socket.emit('input:up', { button: dragButton });
        dragging = false;
      } else if (!moved) {
        const now = Date.now();
        const isDoubleTap = now - lastTapTime < DOUBLE_TAP_MS;

        if (isDoubleTap) {
          if (pendingTapTimer) {
            clearTimeout(pendingTapTimer);
            pendingTapTimer = null;
          }
          socket.emit('input:doubleclick', { button: 'left' });
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          pendingTapTimer = setTimeout(() => {
            socket.emit('input:click', { button: 'left' });
            pendingTapTimer = null;
          }, DOUBLE_TAP_MS);
        }
      }
    }
  }

  surface.addEventListener('pointerup', endPointer);
  surface.addEventListener('pointercancel', endPointer);

  leftClickBtn.addEventListener('click', () => {
    socket.emit('input:click', { button: 'left' });
  });

  rightClickBtn.addEventListener('click', () => {
    socket.emit('input:click', { button: 'right' });
  });

  middleClickBtn.addEventListener('click', () => {
    socket.emit('input:click', { button: 'middle' });
  });

  dblClickBtn.addEventListener('click', () => {
    socket.emit('input:doubleclick', { button: 'left' });
  });
})();
