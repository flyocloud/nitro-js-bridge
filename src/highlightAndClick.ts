import { isEmbedded } from './utils';
import open from './open';

/**
 * Hover affordance for editable blocks while the site runs inside the Flyo
 * live-edit preview: a highlight ring around the hovered block plus a floating
 * pencil button that opens that block in the editor.
 *
 * How it works:
 * - ONE shared overlay for the whole page (ring + button), not a pair of nodes
 *   per block. Nested blocks can therefore never fight over who is hovered, and
 *   a page with 500 blocks still only adds a single DOM node.
 * - Hover is resolved by a single capturing `pointerover` listener: the
 *   innermost registered ancestor of the event target wins. No per-block
 *   listeners, no enter/leave bookkeeping per block.
 * - The site's design is never touched: no style, class, attribute or listener
 *   is put on a host, the overlay lives in its own shadow tree outside <body>,
 *   and the ring is `pointer-events: none`, so the site keeps every hover,
 *   click and cursor it would normally get. See createOverlay() for the details.
 * - Visibility is a small state machine (hidden → showing → visible → hiding).
 *   All fading is done by CSS transitions, including the grace period that lets
 *   you travel from the block to the button; JS only advances the phase.
 * - While it is up, the overlay re-reads the block once per frame, so it follows
 *   scrolling, resizing, hover transitions on the block itself and any reflow
 *   around it — and hides as soon as the block is scrolled out of a clipping
 *   ancestor, detached from the DOM, or gone from the viewport.
 */

/** Every timing knob, in ms. Tune the feel here — nothing else hardcodes time. */
const TIMING = {
  /** Hover intent: how long a block stays hovered before the overlay fades in. */
  showDelay: 600,
  /** Fade-in of ring + button. */
  fadeIn: 220,
  /** Fade-out of ring + button. */
  fadeOut: 180,
  /** Keeps the overlay alive while the pointer travels from block to button. */
  grace: 180,
  /** Ring slide when hopping straight from one block to the next. */
  slide: 140,
};

/** Every measure and colour knob. */
const LOOK = {
  accent: '#7c3aed',
  glow: 'rgba(124, 58, 237, 0.16)',
  /** Flyo master gradient. */
  gradient: 'linear-gradient(135deg, #ec4899 0%, #7c3aed 50%, #2563eb 100%)',
  /** Button diameter. */
  button: 34,
  ringRadius: 8,
  /** Button offset from the block's left edge when it is attached to it. */
  inset: 8,
  /** Distance to the block when the button sits outside it. */
  gap: 8,
  /** Keep the button this far away from the viewport edges. */
  margin: 6,
};

const PENCIL_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="#fff"/>' +
    '<path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#fff"/>' +
  '</svg>';

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * We only ever read events, so every listener is passive: a non-passive pointer
 * listener on a site we do not own can cost it real interaction performance.
 * Capture is used so a site that stops propagation on its own handlers cannot
 * blind us.
 */
const PASSIVE: AddEventListenerOptions = { passive: true };
const PASSIVE_CAPTURE: AddEventListenerOptions = { passive: true, capture: true };

/** Registered blocks: host element → block uid. */
const hosts = new Map<HTMLElement, string>();

let overlay: Overlay | null = null;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const vw = () => window.innerWidth || document.documentElement.clientWidth;
const vh = () => window.innerHeight || document.documentElement.clientHeight;

const intersect = (a: Box, b: Box): Box => ({
  left: Math.max(a.left, b.left),
  top: Math.max(a.top, b.top),
  right: Math.min(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
});

const isEmpty = (b: Box) => b.right - b.left <= 0 || b.bottom - b.top <= 0;

const computed = (el: HTMLElement): Partial<CSSStyleDeclaration> => {
  try {
    return getComputedStyle(el) || {};
  } catch {
    return {};
  }
};

/**
 * The part of the host that is actually painted: its own box, intersected with
 * every clipping ancestor and the viewport.
 *
 * This matters because a block scrolled out of an `overflow: hidden|auto`
 * container still reports a perfectly normal `getBoundingClientRect()` — using
 * that raw rect is what made the overlay show up floating over unrelated
 * content. Containing-block rules are approximated, not fully modelled:
 * absolutely positioned hosts ignore static ancestors, fixed hosts ignore
 * clipping altogether.
 */
function visibleBox(host: HTMLElement): Box | null {
  const rect = host.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }

  // A block can be flat in one axis (a 0px tall wrapper, an empty flex item)
  // and still be worth pointing at, so keep a hairline instead of collapsing to
  // nothing — an empty box in both axes is the only real "nothing to show".
  let box: Box = {
    left: rect.left,
    top: rect.top,
    right: Math.max(rect.right, rect.left + 1),
    bottom: Math.max(rect.bottom, rect.top + 1),
  };
  const position = computed(host).position;
  const escapesStatic = position === 'absolute' || position === 'fixed';

  if (position !== 'fixed') {
    const stop = [document.body, document.documentElement];
    for (let el = host.parentElement; el && stop.indexOf(el) === -1; el = el.parentElement) {
      const css = computed(el);
      // Per axis: the `overflow` shorthand serialises differently across
      // browsers ("hidden" vs "hidden hidden"), and a container may clip in one
      // direction only.
      const clipsX = !!css.overflowX && css.overflowX !== 'visible';
      const clipsY = !!css.overflowY && css.overflowY !== 'visible';
      // Only a positioned or transformed ancestor is a containing block for an
      // absolutely positioned host, so a plain static one cannot clip it.
      const containing = css.position !== 'static' || (!!css.transform && css.transform !== 'none');
      if ((clipsX || clipsY) && (!escapesStatic || containing)) {
        const clip = el.getBoundingClientRect();
        box = intersect(box, {
          left: clipsX ? clip.left : box.left,
          top: clipsY ? clip.top : box.top,
          right: clipsX ? clip.right : box.right,
          bottom: clipsY ? clip.bottom : box.bottom,
        });
        if (isEmpty(box)) {
          return null;
        }
      }
      // A fixed ancestor is not scrolled by anything above it.
      if (css.position === 'fixed') {
        break;
      }
    }
  }

  box = intersect(box, { left: 0, top: 0, right: vw(), bottom: vh() });
  return isEmpty(box) ? null : box;
}

/** Innermost registered block containing `node`, if any. */
function hostOf(node: unknown): HTMLElement | null {
  for (let el = node as HTMLElement | null; el; el = el.parentElement) {
    if (hosts.has(el)) {
      return el;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The shared overlay
// ---------------------------------------------------------------------------

type Phase = 'hidden' | 'showing' | 'visible' | 'hiding';

interface Overlay {
  show(host: HTMLElement, uid: string): void;
  hide(immediate?: boolean): void;
  owns(node: unknown): boolean;
  forget(host: HTMLElement): void;
  destroy(): void;
}

const style = (el: HTMLElement, css: Partial<CSSStyleDeclaration>) => Object.assign(el.style, css);

/**
 * The only rules we cannot express as inline styles: keep the overlay out of
 * print-outs, and stand down when the reader asked for less motion.
 */
const SHADOW_CSS =
  '@media print{:host{display:none!important}}' +
  '@media (prefers-reduced-motion:reduce){*{transition:none!important}}';

/**
 * A constructable stylesheet is CSSOM, so unlike an injected <style> element it
 * is not subject to the site's `style-src` CSP and cannot make a locked-down
 * site report a violation. <style> is only the fallback (Safari < 16.4).
 */
function adoptStyles(shadow: ShadowRoot): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(SHADOW_CSS);
    shadow.adoptedStyleSheets = [sheet];
    return;
  } catch {
    // no constructable stylesheets here
  }
  const el = document.createElement('style');
  el.textContent = SHADOW_CSS;
  shadow.appendChild(el);
}

function createOverlay(): Overlay {
  /*
   * Everything about this mount is chosen so the site cannot notice it:
   * - a custom element name, so site rules for `div`, `button` or `body > div`
   *   cannot match it and scripts querying those tags never see it,
   * - a shadow root, so no site stylesheet — not even `!important` — can restyle
   *   the ring or the button, and our styles cannot leak out either,
   * - `all: initial`, so nothing inherits into the shadow tree,
   * - mounted on <html> instead of <body>, so `body > :last-child` keeps
   *   matching what the site expects, and a transformed, filtered or
   *   `contain`ed <body> cannot break our `position: fixed`,
   * - `position: fixed` with a zero-size box, so page layout, scroll height and
   *   scrollbars stay exactly as they were.
   */
  const mount = document.createElement('flyo-edit-overlay');
  style(mount, {
    all: 'initial',
    position: 'fixed',
    top: '0px',
    left: '0px',
    width: '0px',
    height: '0px',
    zIndex: '2147483647',
    pointerEvents: 'none',
  });

  const shadow = typeof mount.attachShadow === 'function' ? mount.attachShadow({ mode: 'open' }) : null;
  const root: { appendChild(node: Node): unknown } = shadow || mount;

  if (shadow) {
    adoptStyles(shadow);
  }

  const ring = document.createElement('div');
  ring.setAttribute('aria-hidden', 'true');
  style(ring, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '0px',
    height: '0px',
    // Never swallow a hover or click that belongs to the site.
    pointerEvents: 'none',
    boxSizing: 'border-box',
    border: `2px solid ${LOOK.accent}`,
    borderRadius: `${LOOK.ringRadius}px`,
    // White hairline keeps the ring readable on dark blocks, glow on light ones.
    boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.55), 0 0 0 5px ${LOOK.glow}`,
    opacity: '0',
    visibility: 'hidden',
  });

  const btn = document.createElement('button');
  btn.type = 'button';
  // Hover-only affordance: stay out of the site's tab order.
  btn.tabIndex = -1;
  btn.title = 'Edit block';
  btn.setAttribute('aria-label', 'Edit block');
  btn.innerHTML = PENCIL_SVG;
  style(btn, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: `${LOOK.button}px`,
    height: `${LOOK.button}px`,
    padding: '0',
    // Above the ring, and clickable inside the pointer-events-free mount.
    zIndex: '1',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    border: '2px solid rgba(255, 255, 255, 0.9)',
    borderRadius: '9999px',
    background: LOOK.gradient,
    boxShadow: '0 4px 12px rgba(24, 24, 27, 0.28)',
    cursor: 'pointer',
    opacity: '0',
    visibility: 'hidden',
    transform: 'scale(0.85)',
    transformOrigin: 'center',
  });

  root.appendChild(ring);
  root.appendChild(btn);
  (document.documentElement || document.body).appendChild(mount);

  let phase: Phase = 'hidden';
  let timer: number | null = null;
  let host: HTMLElement | null = null;
  let uid = '';
  /** Animate the ring to its new box instead of jumping (block → block hop). */
  let slide = false;
  let overButton = false;
  let frame: number | null = null;
  /** Last box written, so we only touch the DOM when something actually moved. */
  let lastBox = '';

  // -- painting -------------------------------------------------------------

  /** Writes visibility/transition state; fades and delays are pure CSS. */
  function paint(): void {
    const shown = phase === 'showing' || phase === 'visible';
    // Only the first appearance waits for hover intent. Coming back from
    // 'hiding' (pointer returned within the grace period) is instant.
    const delay = phase === 'showing' ? TIMING.showDelay : 0;

    let transition: string;
    if (shown) {
      const move = slide
        ? `, left ${TIMING.slide}ms ease, top ${TIMING.slide}ms ease,` +
          ` width ${TIMING.slide}ms ease, height ${TIMING.slide}ms ease`
        : '';
      transition =
        `opacity ${TIMING.fadeIn}ms ease ${delay}ms,` +
        ` transform ${TIMING.fadeIn}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms,` +
        ` visibility 0s linear ${delay}ms${move}`;
    } else if (phase === 'hiding') {
      transition =
        `opacity ${TIMING.fadeOut}ms ease ${TIMING.grace}ms,` +
        ` transform ${TIMING.fadeOut}ms ease ${TIMING.grace}ms,` +
        ` visibility 0s linear ${TIMING.grace + TIMING.fadeOut}ms`;
    } else {
      transition = 'none';
    }

    // `visibility` flips discretely at the end of its delay, which keeps the
    // button unclickable while it is still invisible — no timers needed.
    for (const el of [ring, btn]) {
      style(el, {
        transition,
        opacity: shown ? '1' : '0',
        visibility: shown ? 'visible' : 'hidden',
      });
    }
    btn.style.transform = shown ? (overButton ? 'scale(1.08)' : 'scale(1)') : 'scale(0.85)';
  }

  /** Position transitions are only wanted between blocks, never while scrolling. */
  function dropSlide(): void {
    if (!slide) {
      return;
    }
    slide = false;
    paint();
  }

  /**
   * Moves ring + button onto the host, and reports whether the box changed so
   * the caller can tell "the user picked another block" from "the block moved
   * on its own". False when there is nothing to show at all.
   */
  function layout(): boolean {
    if (!host || host.isConnected === false) {
      return false;
    }
    const box = visibleBox(host);
    if (!box) {
      return false;
    }

    const left = Math.round(box.left);
    const top = Math.round(box.top);
    const width = Math.round(box.right - box.left);
    const height = Math.round(box.bottom - box.top);
    const key = `${left} ${top} ${width} ${height}`;
    if (key === lastBox) {
      return true; // nothing moved, so nothing to invalidate
    }
    lastBox = key;

    style(ring, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });

    const spot = buttonSpot(box);
    style(btn, { left: `${spot.x}px`, top: `${spot.y}px` });
    return true;
  }

  /**
   * Where the button goes. A roomy block gets it straddling its top-left edge:
   * clearly attached to the ring, but only over the block's own padding instead
   * of its text. Small blocks get it fully outside so nothing is covered at all.
   * Candidates are tried in order and the first one inside the viewport wins.
   */
  function buttonSpot(box: Box): { x: number; y: number } {
    const size = LOOK.button;
    const edge: [number, number] = [box.left + LOOK.inset, box.top - Math.round(size / 2)];
    const above: [number, number] = [box.left, box.top - size - LOOK.gap];
    const right: [number, number] = [box.right + LOOK.gap, box.top];
    const below: [number, number] = [box.left, box.bottom + LOOK.gap];
    const left: [number, number] = [box.left - size - LOOK.gap, box.top];
    const inside: [number, number] = [box.left + LOOK.inset, box.top + LOOK.inset];

    const roomy = box.right - box.left >= size + LOOK.inset * 2 && box.bottom - box.top >= size;
    const spots = roomy ? [edge, above, right, inside] : [above, right, below, left, inside];

    const [x, y] = spots.find(([sx, sy]) => fits(sx, sy)) || spots[0];
    return {
      x: Math.round(Math.max(LOOK.margin, Math.min(x, vw() - size - LOOK.margin))),
      y: Math.round(Math.max(LOOK.margin, Math.min(y, vh() - size - LOOK.margin))),
    };
  }

  const fits = (x: number, y: number) =>
    x >= LOOK.margin &&
    y >= LOOK.margin &&
    x + LOOK.button <= vw() - LOOK.margin &&
    y + LOOK.button <= vh() - LOOK.margin;

  // -- staying aligned ------------------------------------------------------

  const nextFrame = (cb: () => void): number =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : window.setTimeout(cb, 16);

  const cancelFrame = (id: number): void => {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  };

  /**
   * While the overlay is up, re-read the block every frame.
   *
   * This replaced a scroll listener plus a resize listener plus a
   * ResizeObserver, which between them still could not see a block that grows
   * by `padding` (the observed content box does not change) or one that shifts
   * itself with `transform` (no box changes at all) — let alone a lazy image
   * pushing it down or an accordion opening above it. Following every frame
   * covers every cause at once and deletes three moving parts.
   *
   * The cost is one rect read per frame while a block is hovered, and only ever
   * inside the editor preview: on a live site none of this code runs.
   */
  function startFollowing(): void {
    if (frame !== null) {
      return;
    }
    const step = (): void => {
      frame = nextFrame(step);
      const before = lastBox;
      if (!layout()) {
        hide(true);
        return;
      }
      if (lastBox !== before) {
        // The block moved by itself, so stop easing the ring after it.
        dropSlide();
      }
    };
    frame = nextFrame(step);
  }

  function stopFollowing(): void {
    if (frame === null) {
      return;
    }
    cancelFrame(frame);
    frame = null;
  }

  // -- phase machine --------------------------------------------------------

  function arm(ms: number, done: () => void): void {
    disarm();
    timer = window.setTimeout(() => {
      timer = null;
      done();
    }, ms);
  }

  function disarm(): void {
    if (timer === null) {
      return;
    }
    clearTimeout(timer);
    timer = null;
  }

  function show(target: HTMLElement, blockUid: string): void {
    const hopped = target !== host;
    host = target;
    uid = blockUid;

    // A framework that replaces the whole document (or a stray innerHTML) can
    // take our mount with it; putting it back beats silently going dead.
    if (mount.isConnected === false) {
      (document.documentElement || document.body).appendChild(mount);
    }

    // Already tracking this block — the follow loop keeps it aligned, so the
    // pointer wandering over its children costs nothing.
    if (!hopped && (phase === 'showing' || phase === 'visible')) {
      return;
    }

    if (hopped) {
      lastBox = ''; // a different block, so always write its box
    }

    if (phase === 'hidden') {
      phase = 'showing';
      arm(TIMING.showDelay + TIMING.fadeIn, () => {
        phase = 'visible';
        // Re-paint without the show delay so the hover pop stays snappy.
        paint();
      });
    } else if (phase === 'hiding') {
      disarm();
      phase = 'visible';
    }

    slide = hopped && phase === 'visible';
    paint();
    if (!layout()) {
      hide(true);
      return;
    }
    startFollowing();
  }

  function hide(immediate = false): void {
    if (phase === 'hidden') {
      return;
    }

    // Nothing has faded in yet during 'showing', so there is nothing to fade
    // out — dropping straight to hidden avoids a flash.
    if (immediate || phase === 'showing') {
      disarm();
      phase = 'hidden';
      paint();
      settle();
      return;
    }

    phase = 'hiding';
    paint();
    arm(TIMING.grace + TIMING.fadeOut, () => {
      phase = 'hidden';
      paint();
      settle();
    });
  }

  function settle(): void {
    stopFollowing();
    host = null;
    uid = '';
    slide = false;
    lastBox = '';
  }

  // -- our own listeners ----------------------------------------------------

  const onButtonEnter = (): void => {
    overButton = true;
    // Cancels a pending hide when arriving from the block.
    if (host) {
      show(host, uid);
    }
    paint(); // show() short-circuits while already visible; still want the pop
  };

  const onButtonLeave = (): void => {
    overButton = false;
    hide();
  };

  const onClick = (event: Event): void => {
    // Our own click, on our own node: the site must never see it.
    event.preventDefault();
    event.stopPropagation();
    if (uid) {
      open(uid);
    }
  };

  btn.addEventListener('mouseenter', onButtonEnter);
  btn.addEventListener('mouseleave', onButtonLeave);
  btn.addEventListener('click', onClick);

  return {
    show,
    hide,
    // `mount` covers browsers/events without composedPath(), where anything
    // inside the shadow tree is reported as the mount itself.
    owns: (node: unknown) =>
      node === mount || node === btn || node === ring || btn.contains?.(node as Node) === true,
    forget: (gone: HTMLElement) => {
      if (gone === host) {
        hide(true);
      }
    },
    destroy: () => {
      disarm();
      settle();
      btn.removeEventListener('mouseenter', onButtonEnter);
      btn.removeEventListener('mouseleave', onButtonLeave);
      btn.removeEventListener('click', onClick);
      mount.parentNode?.removeChild(mount);
    },
  };
}

// ---------------------------------------------------------------------------
// Page level wiring (one set of listeners, no matter how many blocks)
// ---------------------------------------------------------------------------

/**
 * Read-only: this handler never cancels, stops or redirects the event, so the
 * site's own pointer handling behaves exactly as it would without the bridge.
 */
const onPointerOver = (event: Event): void => {
  if (!overlay) {
    return;
  }
  // composedPath() reaches through shadow roots, where `target` would only ever
  // be the shadow host and inner blocks could never be resolved.
  const path = (event as any).composedPath?.();
  const target = (path && path.length ? path[0] : event.target) as unknown;

  if (overlay.owns(target)) {
    return; // the button keeps itself alive on mouseenter
  }
  const host = hostOf(target);
  if (host) {
    overlay.show(host, hosts.get(host) as string);
  } else {
    overlay.hide();
  }
};

const onLeavePage = (): void => overlay?.hide(true);

function attach(): void {
  if (overlay) {
    return;
  }
  overlay = createOverlay();
  document.addEventListener('pointerover', onPointerOver, PASSIVE_CAPTURE);
  document.addEventListener('mouseleave', onLeavePage, PASSIVE);
  window.addEventListener('blur', onLeavePage, PASSIVE);
}

function detach(): void {
  if (!overlay) {
    return;
  }
  document.removeEventListener('pointerover', onPointerOver, PASSIVE_CAPTURE);
  document.removeEventListener('mouseleave', onLeavePage, PASSIVE);
  window.removeEventListener('blur', onLeavePage, PASSIVE);
  overlay.destroy();
  overlay = null;
}

/**
 * Registers a block for the live-edit hover affordance.
 *
 * @param blockUid uid of the Flyo block behind `hostElement`
 * @param hostElement the block's element; omit it if you only need the handler
 * @returns outside the editor (or without an element) the plain open handler,
 *   so it can be bound to a click; inside the editor a cleanup function that
 *   unregisters the block again (call it when the component unmounts).
 */
function highlightAndClick(blockUid: string, hostElement?: HTMLElement) {
  const openHandler = () => open(blockUid);
  if (!isEmbedded() || !hostElement || typeof document === 'undefined') {
    return openHandler;
  }

  hosts.set(hostElement, blockUid);
  attach();

  return function cleanup(): void {
    if (!hosts.delete(hostElement)) {
      return;
    }
    overlay?.forget(hostElement);
    if (hosts.size === 0) {
      detach();
    }
  };
}

export default highlightAndClick;
