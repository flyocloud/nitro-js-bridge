import { isEmbedded } from './utils';
import open from './open';

/**
 * Hover-only ghost edit button with "hover pad":
 * - Visible only while hovering host, the button, or an invisible pad around the host.
 * - Pad enlarges the effective hover area so tiny elements are easy to target.
 * - Slight delay before hiding to allow moving from host → button.
 * - Button anchors to host's top-left (outside-above for tiny hosts if possible).
 * - Repositions on scroll/resize and host resize while visible.
 * - No mutations to host styles.
 */
function highlightAndClick(blockUid: string, hostElement?: HTMLElement) {
  const openHandler = () => open(blockUid);
  if (!isEmbedded() || !hostElement) {
    return openHandler;
  }

  const host: HTMLElement = hostElement;

  // --- Create ghost button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Edit block');
  btn.style.position = 'fixed';
  btn.style.top = '0px';
  btn.style.left = '0px';
  btn.style.zIndex = '9999';
  btn.style.width = '44px';
  btn.style.height = '44px';
  btn.style.display = 'none'; // hidden until hover
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.border = '0px solid #000';     // solid black border (no shadow)
  btn.style.borderRadius = '9999px';
  btn.style.boxSizing = 'border-box';
  btn.style.cursor = 'pointer';
  btn.style.background = '#FFD466';
  btn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="#111"/>' +
      '<path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#111"/>' +
    '</svg>';

  // --- Transparent hover pad to enlarge hitbox around tiny hosts
  const pad = document.createElement('div');
  pad.style.position = 'fixed';
  pad.style.top = '0px';
  pad.style.left = '0px';
  pad.style.zIndex = '9998';           // just under the button
  pad.style.display = 'none';          // shown only while hovering
  pad.style.pointerEvents = 'auto';    // must receive hover/clicks
  pad.style.background = 'transparent';
  pad.style.border = 'none';
  // (No outline; stays invisible)

  btn.addEventListener('click', openHandler);
  document.body.appendChild(pad);
  document.body.appendChild(btn);

  // --- Layout constants
  const SIZE = 44;     // button size
  const INSET = 6;     // offset inside host (for larger hosts)
  const GAP = 6;       // gap when placed outside the host
  const MARGIN = 6;    // viewport margin
  const PAD = 10;      // how much to expand the hover pad around the host (px on each side)
  const HIDE_DELAY = 180; // ms hide delay so you can move to the button

  const vw = () => window.innerWidth || document.documentElement.clientWidth;
  const vh = () => window.innerHeight || document.documentElement.clientHeight;

  const isRectVisible = (r: DOMRect) =>
    !(r.bottom < 0 || r.right < 0 || r.top > vh() || r.left > vw() || (r.width === 0 && r.height === 0));

  const fitsViewport = (x: number, y: number) =>
    x >= MARGIN && y >= MARGIN && x + SIZE <= vw() - MARGIN && y + SIZE <= vh() - MARGIN;

  const clamp = (x: number, y: number) => ({
    x: Math.max(MARGIN, Math.min(x, vw() - SIZE - MARGIN)),
    y: Math.max(MARGIN, Math.min(y, vh() - SIZE - MARGIN)),
  });

  function position(): void {
    const rect = host.getBoundingClientRect();
    const tiny = rect.width < SIZE || rect.height < SIZE;

    // Button position: prefer outside-above for tiny targets, else inside top-left
    const candX = Math.round(rect.left);
    const candY = Math.round(rect.top) - SIZE - GAP;
    const altX  = Math.round(rect.left) + INSET;
    const altY  = Math.round(rect.top) + INSET;

    let x: number;
    let y: number;
    if (tiny && fitsViewport(candX, candY)) {
      x = candX; y = candY;
    } else if (fitsViewport(altX, altY)) {
      x = altX; y = altY;
    } else if (fitsViewport(candX, candY)) {
      x = candX; y = candY;
    } else {
      const a = clamp(candX, candY);
      const b = clamp(altX, altY);
      const dA = Math.abs(a.x - rect.left) + Math.abs(a.y - rect.top);
      const dB = Math.abs(b.x - rect.left) + Math.abs(b.y - rect.top);
      ({ x, y } = dA <= dB ? a : b);
    }

    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;

    // Pad position: expand the host rect to create an easy hover bridge to the button
    const padLeft   = Math.max(MARGIN, Math.round(rect.left) - PAD);
    const padTop    = Math.max(MARGIN, Math.round(rect.top) - PAD);
    const padRight  = Math.min(vw() - MARGIN, Math.round(rect.right) + PAD);
    const padBottom = Math.min(vh() - MARGIN, Math.round(rect.bottom) + PAD);
    pad.style.left   = `${padLeft}px`;
    pad.style.top    = `${padTop}px`;
    pad.style.width  = `${Math.max(0, padRight - padLeft)}px`;
    pad.style.height = `${Math.max(0, padBottom - padTop)}px`;
  }

  // --- Hover state + delayed hide
  let overHost = false;
  let overBtn = false;
  let overPad = false;
  let watching = false;
  let hideTimer: number | null = null;

  const clearHideTimer = () => {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const show = (): void => {
    clearHideTimer();
    try {
      const rect = host.getBoundingClientRect();
      if (!isRectVisible(rect)) { hide(true); return; }
      position();
      btn.style.display = 'flex';
      pad.style.display = 'block';
      startWatch();
    } catch {
      hide(true);
    }
  };

  const hide = (immediate = false): void => {
    if (immediate) {
      clearHideTimer();
      btn.style.display = 'none';
      pad.style.display = 'none';
      stopWatch();
      return;
    }
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      if (!overHost && !overBtn && !overPad) {
        btn.style.display = 'none';
        pad.style.display = 'none';
        stopWatch();
      }
      hideTimer = null;
    }, HIDE_DELAY);
  };

  // Keep aligned while visible
  const onScroll = (): void => { if (btn.style.display !== 'none') position(); };
  const onResize = onScroll;

  let ro: ResizeObserver | null = null;
  const ROCtor: typeof ResizeObserver | undefined = (window as any).ResizeObserver;

  const startWatch = (): void => {
    if (watching) return;
    watching = true;
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    if (typeof ROCtor === 'function') {
      ro = new ROCtor(() => {
        if (btn.style.display !== 'none') position();
      });
      ro?.observe(host);
    }
  };

  const stopWatch = (): void => {
    if (!watching) return;
    watching = false;
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    try { ro?.disconnect(); } catch {}
    ro = null;
  };

  // --- Hover wiring
  const onHostEnter = (): void => { overHost = true; show(); };
  const onHostLeave = (): void => { overHost = false; if (!overBtn && !overPad) hide(); };
  const onBtnEnter  = (): void => { overBtn = true; show(); };
  const onBtnLeave  = (): void => { overBtn = false; if (!overHost && !overPad) hide(); };
  const onPadEnter  = (): void => { overPad = true; show(); };
  const onPadLeave  = (): void => { overPad = false; if (!overHost && !overBtn) hide(); };

  host.addEventListener('mouseenter', onHostEnter);
  host.addEventListener('mouseleave', onHostLeave);
  btn.addEventListener('mouseenter', onBtnEnter);
  btn.addEventListener('mouseleave', onBtnLeave);
  pad.addEventListener('mouseenter', onPadEnter);
  pad.addEventListener('mouseleave', onPadLeave);
  btn.addEventListener('click', openHandler);

  function cleanup(): void {
    clearHideTimer();
    stopWatch();
    btn.removeEventListener('click', openHandler);
    host.removeEventListener('mouseenter', onHostEnter);
    host.removeEventListener('mouseleave', onHostLeave);
    btn.removeEventListener('mouseenter', onBtnEnter);
    btn.removeEventListener('mouseleave', onBtnLeave);
    pad.removeEventListener('mouseenter', onPadEnter);
    pad.removeEventListener('mouseleave', onPadLeave);
    if (btn.parentElement === document.body) document.body.removeChild(btn);
    if (pad.parentElement === document.body) document.body.removeChild(pad);
  }

  return cleanup;
}

export default highlightAndClick;
