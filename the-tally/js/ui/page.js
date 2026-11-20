// The bare page. M1 only needs the shape: the game holds, the book opens, the player closes it.
// The three cards, the seal-marks and the Debt are M3 (design 6).

export function createPage(root, onClose) {
  let open = false;

  if (!root) {
    return { show() {}, hide() {}, close() {}, get open() { return false; } };
  }

  const title = root.querySelector('[data-level]');
  const button = root.querySelector('[data-close]');

  function close() {
    if (!open) return;
    open = false;
    root.hidden = true;
    if (onClose) onClose();
  }

  if (button) button.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      close();
    }
  });

  return {
    show(level) {
      open = true;
      root.hidden = false;
      if (title) title.textContent = `Level ${level}`;
    },
    hide() {
      if (!open) return;
      open = false;
      root.hidden = true;
    },
    close,
    get open() { return open; },
  };
}
