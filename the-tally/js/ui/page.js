// The bare page (design 3.1): a page opens, the game holds, a choice closes it. M1 ships the
// markup only, with no choices; the real pages come with the Tally Room in M3.

export function createPage(root, onClose) {
  const el = root;
  let open = false;

  function show() {
    open = true;
    el.hidden = false;
    const first = el.querySelector('[data-close]');
    if (first) first.focus({ preventScroll: true });
  }

  function hide() {
    if (!open) return;
    open = false;
    el.hidden = true;
    if (onClose) onClose();
  }

  el.addEventListener('click', (e) => {
    const target = e.target.closest('[data-close]');
    if (target) {
      e.preventDefault();
      hide();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space') {
      e.preventDefault();
      hide();
    }
  });

  return {
    show,
    hide,
    get open() { return open; },
  };
}
