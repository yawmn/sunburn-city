// Keyboard and Mouse input manager tracking held keys, just-pressed events,
// mouse cursor position, clicks, weapon hotkeys, reload, and directional axes.

export function createInput(targetCanvas = null) {
  const held = new Set();
  const pressed = new Set();

  let canvas = targetCanvas;
  const mousePos = { x: 640, y: 360 };
  let isMouseDown = false;
  let mousePressed = false;

  const ALIASES = {
    // Movement
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    // Actions
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint',
    KeyE: 'interact',
    Space: 'space',
    Enter: 'enter',
    Escape: 'escape',
    KeyP: 'pause',
    // Combat
    Digit1: 'weapon_1',
    Digit2: 'weapon_2',
    Digit3: 'weapon_3',
    KeyQ: 'cycle_weapon',
    KeyR: 'reload',
  };

  const PREVENT_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'Tab',
  ]);

  function updateMouseCoords(e) {
    if (!canvas) {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mousePos.x = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
      mousePos.y = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));
    }
  }

  function onMouseDown(e) {
    updateMouseCoords(e);
    isMouseDown = true;
    mousePressed = true;
  }

  function onMouseMove(e) {
    updateMouseCoords(e);
  }

  function onMouseUp(e) {
    updateMouseCoords(e);
    isMouseDown = false;
  }

  function onContextMenu(e) {
    // Prevent default context menu on right click during gameplay
    if (canvas && (e.target === canvas || canvas.contains(e.target))) {
      e.preventDefault();
    }
  }

  function onKeyDown(e) {
    if (PREVENT_KEYS.has(e.code)) {
      e.preventDefault();
    }
    const alias = ALIASES[e.code] || e.code;
    if (!held.has(alias)) {
      pressed.add(alias);
      pressed.add(e.code);
    }
    held.add(alias);
    held.add(e.code);
  }

  function onKeyUp(e) {
    const alias = ALIASES[e.code] || e.code;
    held.delete(alias);
    held.delete(e.code);
    // If multiple keys map to same alias (e.g. ShiftLeft / ShiftRight), verify neither is held
    if (alias === 'sprint') {
      if (held.has('ShiftLeft') || held.has('ShiftRight')) held.add('sprint');
    }
  }

  function onBlur() {
    held.clear();
    pressed.clear();
    isMouseDown = false;
    mousePressed = false;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
  }

  return {
    setCanvas(c) {
      canvas = c;
    },
    get mousePos() {
      return mousePos;
    },
    get isMouseDown() {
      return isMouseDown;
    },
    takeMousePressed() {
      if (mousePressed) {
        mousePressed = false;
        return true;
      }
      return false;
    },
    isHeld(key) {
      return held.has(key);
    },
    takePressed(key) {
      if (pressed.has(key)) {
        pressed.delete(key);
        return true;
      }
      return false;
    },
    axes() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      if (x !== 0 && y !== 0) {
        const invLen = 1 / Math.hypot(x, y);
        x *= invLen;
        y *= invLen;
      }
      return { x, y };
    },
    get sprint() {
      return held.has('sprint');
    },
    get interact() {
      return held.has('interact');
    },
    get space() {
      return held.has('space');
    },
    get handbrake() {
      return held.has('space');
    },
    reset() {
      held.clear();
      pressed.clear();
      isMouseDown = false;
      mousePressed = false;
    },
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('contextmenu', onContextMenu);
        window.removeEventListener('blur', onBlur);
      }
    },
  };
}
