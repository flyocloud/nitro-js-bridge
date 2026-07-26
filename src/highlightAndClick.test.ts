import { expect, test, vi, beforeEach, afterEach, describe } from 'vitest';

// Mock the dependencies
vi.mock('./utils', () => ({
  isEmbedded: vi.fn()
}));

vi.mock('./open', () => ({
  default: vi.fn()
}));

import { isEmbedded } from './utils';
import open from './open';

const mockIsEmbedded = vi.mocked(isEmbedded);
const mockOpen = vi.mocked(open);

// ---------------------------------------------------------------------------
// Minimal fake DOM. The bridge runs in browsers, the test suite runs in node
// without jsdom, so everything highlightAndClick touches is stubbed here.
// ---------------------------------------------------------------------------

type Fake = any;

const VIEWPORT = { width: 1024, height: 768 };

function element(tag: string, rect?: { x: number; y: number; w: number; h: number }, css?: Record<string, string>): Fake {
  const r = rect || { x: 0, y: 0, w: 0, h: 0 };
  const listeners: Record<string, Function[]> = {};
  const overflow = css?.overflow || 'visible';
  const node: Fake = {
    tagName: tag.toUpperCase(),
    style: {},
    children: [] as Fake[],
    parentElement: null as Fake,
    parentNode: null as Fake,
    shadowRoot: null as Fake,
    isConnected: true,
    css: {
      position: 'static',
      transform: 'none',
      overflowX: overflow,
      overflowY: overflow,
      ...(css || {}),
    },
    rect: { left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h, width: r.w, height: r.h },
    getBoundingClientRect: () => node.rect,
    setAttribute: vi.fn(),
    attachShadow: vi.fn(() => {
      const shadow: Fake = {
        host: node,
        children: [] as Fake[],
        appendChild: vi.fn((child: Fake) => {
          child.parentNode = shadow;
          shadow.children.push(child);
          return child;
        }),
      };
      node.shadowRoot = shadow;
      return shadow;
    }),
    addEventListener: vi.fn((type: string, fn: Function) => {
      (listeners[type] = listeners[type] || []).push(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Function) => {
      listeners[type] = (listeners[type] || []).filter((l) => l !== fn);
    }),
    appendChild: vi.fn((child: Fake) => {
      child.parentElement = node;
      child.parentNode = node;
      node.children.push(child);
      return child;
    }),
    removeChild: vi.fn((child: Fake) => {
      child.parentElement = null;
      child.parentNode = null;
      node.children = node.children.filter((c: Fake) => c !== child);
      return child;
    }),
    contains: (other: Fake) => other === node || node.children.indexOf(other) !== -1,
    fire: (type: string, event: Fake = {}) => (listeners[type] || []).forEach((fn) => fn(event)),
    listenerTypes: () => Object.keys(listeners),
  };
  return node;
}

/** Puts `child` inside `parent` so the clipping/host walk can see it. */
function nest(parent: Fake, child: Fake): Fake {
  child.parentElement = parent;
  parent.children.push(child);
  return child;
}

interface Harness {
  created: Fake[];
  /** The single node we add to the page; ring and button live in its shadow. */
  mount: Fake;
  sheet: Fake;
  ring: Fake;
  button: Fake;
  doc: Fake;
  win: Fake;
  hover(target: Fake, event?: Fake): void;
  optionsFor(target: 'doc' | 'win', type: string): Fake;
  /** Runs the overlay's pending follow frame(s). */
  frame(): void;
  pendingFrames(): number;
  restore(): void;
}

function installDom(): Harness {
  const created: Fake[] = [];
  const body = element('body');
  const html = element('html');
  const docListeners: Record<string, Function[]> = {};
  const docOptions: Record<string, Fake> = {};
  const winOptions: Record<string, Fake> = {};

  const doc: Fake = {
    body,
    documentElement: html,
    createElement: vi.fn((tag: string) => {
      const node = element(tag);
      created.push(node);
      return node;
    }),
    addEventListener: vi.fn((type: string, fn: Function, options?: Fake) => {
      (docListeners[type] = docListeners[type] || []).push(fn);
      docOptions[type] = options;
    }),
    removeEventListener: vi.fn((type: string, fn: Function) => {
      docListeners[type] = (docListeners[type] || []).filter((l) => l !== fn);
    }),
    listenerCount: (type: string) => (docListeners[type] || []).length,
  };

  const byTag = (tag: string) => created.find((el) => el.tagName === tag);

  const saved = {
    document: (global as any).document,
    window: (global as any).window,
    getComputedStyle: (global as any).getComputedStyle,
    requestAnimationFrame: (global as any).requestAnimationFrame,
    cancelAnimationFrame: (global as any).cancelAnimationFrame,
  };

  const win: Fake = {
    innerWidth: VIEWPORT.width,
    innerHeight: VIEWPORT.height,
    addEventListener: vi.fn((type: string, _fn: Function, options?: Fake) => {
      winOptions[type] = options;
    }),
    removeEventListener: vi.fn(),
    // Forwarded so vi.useFakeTimers() still controls the phase timer.
    setTimeout: (fn: Function, ms?: number) => (globalThis as any).setTimeout(fn, ms),
    ResizeObserver: undefined,
  };

  // Frames are queued, never run on their own: the follow loop only advances
  // when a test asks for it.
  const frames = new Map<number, Function>();
  let frameId = 0;

  (global as any).document = doc;
  (global as any).window = win;
  (global as any).getComputedStyle = (el: Fake) => el?.css;
  (global as any).requestAnimationFrame = (cb: Function) => {
    frames.set(++frameId, cb);
    return frameId;
  };
  (global as any).cancelAnimationFrame = (id: number) => frames.delete(id);

  return {
    created,
    get mount() {
      return byTag('FLYO-EDIT-OVERLAY');
    },
    get sheet() {
      return byTag('STYLE');
    },
    get ring() {
      return byTag('DIV');
    },
    get button() {
      return byTag('BUTTON');
    },
    doc,
    win,
    hover: (target: Fake, event: Fake = {}) =>
      (docListeners.pointerover || []).forEach((fn) => fn({ target, ...event })),
    optionsFor: (which: 'doc' | 'win', type: string) => (which === 'doc' ? docOptions : winOptions)[type],
    frame: () => {
      // Only what is queued now: the loop re-queues itself as it runs.
      const due = Array.from(frames.entries());
      due.forEach(([id, cb]) => {
        frames.delete(id);
        cb();
      });
    },
    pendingFrames: () => frames.size,
    restore: () => {
      (global as any).document = saved.document;
      (global as any).window = saved.window;
      (global as any).getComputedStyle = saved.getComputedStyle;
      (global as any).requestAnimationFrame = saved.requestAnimationFrame;
      (global as any).cancelAnimationFrame = saved.cancelAnimationFrame;
    },
  };
}

let dom: Harness;
let highlightAndClick: typeof import('./highlightAndClick').default;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  dom = installDom();
  // The overlay and the block registry are module state: a fresh module per
  // test keeps them from leaking between tests.
  vi.resetModules();
  highlightAndClick = (await import('./highlightAndClick')).default;
});

afterEach(() => {
  dom.restore();
  vi.useRealTimers();
});

describe('outside the editor', () => {
  test('returns the plain open handler when not embedded', () => {
    mockIsEmbedded.mockReturnValue(false);

    const handler = highlightAndClick('test-uid', element('div', { x: 0, y: 0, w: 200, h: 100 }));

    handler();
    expect(mockOpen).toHaveBeenCalledWith('test-uid');
    // No overlay for a live site.
    expect(dom.doc.createElement).not.toHaveBeenCalled();
  });

  test('returns the plain open handler when no element is given', () => {
    mockIsEmbedded.mockReturnValue(true);

    const handler = highlightAndClick('test-uid');

    handler();
    expect(mockOpen).toHaveBeenCalledWith('test-uid');
    expect(dom.doc.createElement).not.toHaveBeenCalled();
  });
});

describe('inside the editor', () => {
  beforeEach(() => {
    mockIsEmbedded.mockReturnValue(true);
  });

  const block = (x: number, y: number, w: number, h: number) => element('div', { x, y, w, h });

  test('all blocks share one overlay and one set of page listeners', () => {
    const cleanups = [block(0, 0, 300, 200), block(0, 300, 300, 200), block(0, 600, 300, 200)].map((el, i) =>
      highlightAndClick(`uid-${i}`, el)
    );

    // One mount for the whole page, not a pair of nodes per block.
    expect(dom.doc.documentElement.appendChild).toHaveBeenCalledTimes(1);
    expect(dom.doc.documentElement.appendChild).toHaveBeenCalledWith(dom.mount);
    expect(dom.created.filter((el: Fake) => el.tagName === 'BUTTON')).toHaveLength(1);
    expect(dom.doc.listenerCount('pointerover')).toBe(1);

    cleanups.forEach((cleanup) => cleanup());
  });

  test('the overlay sits in its own shadow tree, outside the body', () => {
    const cleanup = highlightAndClick('uid-a', block(0, 0, 300, 200));

    expect(dom.mount.attachShadow).toHaveBeenCalledWith({ mode: 'open' });
    expect(dom.ring.parentNode).toBe(dom.mount.shadowRoot);
    expect(dom.button.parentNode).toBe(dom.mount.shadowRoot);
    // Nothing is added to the body, so `body > :last-child` keeps matching what
    // the site expects.
    expect(dom.doc.body.appendChild).not.toHaveBeenCalled();
    // Site CSS for `div`/`button` cannot match our tag either.
    expect(dom.mount.tagName).toBe('FLYO-EDIT-OVERLAY');

    cleanup();
  });

  test('the mount cannot take part in the site layout', () => {
    const cleanup = highlightAndClick('uid-a', block(0, 0, 300, 200));

    expect(dom.mount.style.all).toBe('initial');
    expect(dom.mount.style.position).toBe('fixed');
    expect(dom.mount.style.width).toBe('0px');
    expect(dom.mount.style.height).toBe('0px');
    expect(dom.mount.style.pointerEvents).toBe('none');

    cleanup();
  });

  test('hides the overlay in print and honours reduced motion', () => {
    const cleanup = highlightAndClick('uid-a', block(0, 0, 300, 200));

    // Without constructable stylesheets (as in this node environment) it falls
    // back to a <style> element inside the shadow tree — never in the site.
    expect(dom.sheet.textContent).toContain('@media print');
    expect(dom.sheet.textContent).toContain('prefers-reduced-motion');
    expect(dom.sheet.parentNode).toBe(dom.mount.shadowRoot);

    cleanup();
  });

  test('prefers a constructable stylesheet, so a strict CSP sees nothing', async () => {
    const adopted: unknown[] = [];
    class FakeSheet {
      css = '';
      replaceSync(text: string) {
        this.css = text;
      }
    }
    (global as any).CSSStyleSheet = FakeSheet;
    vi.resetModules();
    const fresh = (await import('./highlightAndClick')).default;

    const cleanup = fresh('uid-a', block(0, 0, 300, 200));
    const shadow = dom.mount.shadowRoot;
    adopted.push(...(shadow.adoptedStyleSheets || []));

    expect(adopted).toHaveLength(1);
    expect((adopted[0] as FakeSheet).css).toContain('@media print');
    // No <style> element was needed, so no inline-style CSP violation.
    expect(dom.created.some((el: Fake) => el.tagName === 'STYLE')).toBe(false);

    cleanup();
    delete (global as any).CSSStyleSheet;
  });

  test('re-attaches itself if the page throws the mount away', () => {
    const host = block(0, 0, 300, 200);
    const cleanup = highlightAndClick('uid-a', host);

    // e.g. a framework replacing the document, or a stray innerHTML.
    dom.mount.isConnected = false;
    dom.hover(host);

    expect(dom.doc.documentElement.appendChild).toHaveBeenCalledTimes(2);
    expect(dom.ring.style.visibility).toBe('visible');

    cleanup();
  });

  test('the ring never swallows the site clicks', () => {
    const cleanup = highlightAndClick('uid-a', block(10, 10, 300, 200));

    expect(dom.ring.style.pointerEvents).toBe('none');
    expect(dom.button.style.pointerEvents).toBe('auto');

    cleanup();
  });

  test('the host element is never modified', () => {
    const host = block(10, 10, 300, 200);
    host.style.color = 'red'; // the site's own inline style
    const styleBefore = { ...host.style };

    const cleanup = highlightAndClick('uid-a', host);
    dom.hover(host);
    vi.advanceTimersByTime(1000);
    dom.hover(element('div', { x: 0, y: 0, w: 10, h: 10 }));
    vi.runAllTimers();
    cleanup();

    expect(host.style).toEqual(styleBefore);
    expect(host.addEventListener).not.toHaveBeenCalled();
    expect(host.setAttribute).not.toHaveBeenCalled();
    expect(host.appendChild).not.toHaveBeenCalled();
    expect(host.removeChild).not.toHaveBeenCalled();
    expect(host.listenerTypes()).toEqual([]);
    expect(host.children).toEqual([]);
  });

  test('page listeners are passive and never cancel the site events', () => {
    const host = block(0, 0, 300, 200);
    const cleanup = highlightAndClick('uid-a', host);

    expect(dom.optionsFor('doc', 'pointerover')).toEqual({ passive: true, capture: true });
    expect(dom.optionsFor('doc', 'mouseleave')).toEqual({ passive: true });

    const spies = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };
    dom.hover(host, spies);
    dom.hover(element('div', { x: 0, y: 0, w: 10, h: 10 }), spies);

    expect(spies.preventDefault).not.toHaveBeenCalled();
    expect(spies.stopPropagation).not.toHaveBeenCalled();
    expect(spies.stopImmediatePropagation).not.toHaveBeenCalled();

    // Staying aligned is a frame loop, so we add no scroll listener at all —
    // nothing of ours can slow the site's scrolling down.
    const types = dom.win.addEventListener.mock.calls.map((call: Fake[]) => call[0]);
    expect(types).not.toContain('scroll');
    expect(types).not.toContain('resize');

    cleanup();
  });

  test('follows the block while visible, and only writes when it moved', () => {
    const host = block(100, 200, 400, 300);
    const cleanup = highlightAndClick('uid-a', host);

    dom.hover(host);
    expect(dom.ring.style.height).toBe('300px');

    // Nothing moved: the frame must not touch the DOM again.
    const writes = Object.keys(dom.ring.style).length;
    dom.frame();
    expect(Object.keys(dom.ring.style).length).toBe(writes);
    expect(dom.ring.style.height).toBe('300px');

    // The block grows under the pointer — by padding, which a ResizeObserver on
    // the content box would never report — and moves down.
    host.rect = { left: 100, top: 240, right: 500, bottom: 700, width: 400, height: 460 };
    dom.frame();

    expect(dom.ring.style.top).toBe('240px');
    expect(dom.ring.style.height).toBe('460px');
    // The button follows the block's new top edge, too.
    expect(dom.button.style.top).toBe('223px');

    cleanup();
  });

  test('the follow loop runs only while the overlay is up', () => {
    const host = block(0, 0, 300, 200);
    const cleanup = highlightAndClick('uid-a', host);

    expect(dom.pendingFrames()).toBe(0);

    dom.hover(host);
    expect(dom.pendingFrames()).toBe(1);

    dom.frame();
    expect(dom.pendingFrames()).toBe(1); // keeps itself going

    dom.hover(element('div', { x: 0, y: 0, w: 10, h: 10 }));
    vi.runAllTimers();
    expect(dom.pendingFrames()).toBe(0);

    cleanup();
  });

  test('a block that vanishes while followed takes the overlay with it', () => {
    const host = block(0, 0, 300, 200);
    const cleanup = highlightAndClick('uid-a', host);

    dom.hover(host);
    vi.advanceTimersByTime(1000);
    expect(dom.ring.style.visibility).toBe('visible');

    host.isConnected = false;
    dom.frame();

    expect(dom.ring.style.visibility).toBe('hidden');
    expect(dom.pendingFrames()).toBe(0);

    cleanup();
  });

  test('hovering fades in, leaving fades out', () => {
    const host = block(100, 200, 400, 300);
    const cleanup = highlightAndClick('uid-a', host);

    dom.hover(host);

    expect(dom.ring.style.visibility).toBe('visible');
    expect(dom.ring.style.opacity).toBe('1');
    expect(dom.ring.style.left).toBe('100px');
    expect(dom.ring.style.top).toBe('200px');
    expect(dom.ring.style.width).toBe('400px');
    expect(dom.ring.style.height).toBe('300px');
    // Roomy block: the button straddles its top-left edge.
    expect(dom.button.style.left).toBe('108px');
    expect(dom.button.style.top).toBe('183px');
    // The first appearance is delayed (hover intent) and fades.
    expect(dom.ring.style.transition).toMatch(/opacity \d+ms ease 600ms/);

    // Let it finish appearing, then leave the block.
    vi.advanceTimersByTime(1000);
    dom.hover(element('div', { x: 0, y: 0, w: 10, h: 10 }));

    // Fading out, and kept on screen for the grace period + the fade itself so
    // the pointer can still reach the button.
    expect(dom.ring.style.opacity).toBe('0');
    expect(dom.ring.style.transition).toContain('visibility 0s linear 360ms');

    vi.runAllTimers();
    expect(dom.ring.style.visibility).toBe('hidden');

    cleanup();
  });

  test('reaching the button through the gap keeps the overlay alive', () => {
    const host = block(100, 200, 400, 300);
    const cleanup = highlightAndClick('uid-a', host);

    dom.hover(host);
    vi.advanceTimersByTime(1000);

    // Pointer crosses whatever sits between the block and the button.
    dom.hover(element('div', { x: 0, y: 0, w: 10, h: 10 }));
    expect(dom.ring.style.opacity).toBe('0');

    // Arriving on the button revives it without waiting for the hover delay.
    dom.button.fire('mouseenter');
    expect(dom.ring.style.opacity).toBe('1');
    expect(dom.ring.style.transition).toContain('visibility 0s linear 0ms');
    expect(dom.button.style.transform).toBe('scale(1.08)');

    // Leaving the button hides it again.
    dom.button.fire('mouseleave');
    expect(dom.ring.style.opacity).toBe('0');
    vi.runAllTimers();
    expect(dom.ring.style.visibility).toBe('hidden');

    cleanup();
  });

  test('leaving before the overlay appeared cuts it without a fade', () => {
    const host = block(100, 200, 400, 300);
    const cleanup = highlightAndClick('uid-a', host);

    dom.hover(host);
    dom.hover(element('div', { x: 0, y: 0, w: 10, h: 10 }));

    // Nothing had faded in yet, so there is nothing to fade out either.
    expect(dom.ring.style.transition).toBe('none');
    expect(dom.ring.style.visibility).toBe('hidden');

    cleanup();
  });

  test('a tiny block gets the button outside so it stays readable', () => {
    const host = block(300, 400, 2, 2);
    const cleanup = highlightAndClick('uid-tiny', host);

    dom.hover(host);

    // Above the block: y = 400 - 34 - 8
    expect(dom.button.style.left).toBe('300px');
    expect(dom.button.style.top).toBe('358px');

    cleanup();
  });

  test('a block at the viewport edge keeps the button inside the viewport', () => {
    const host = block(0, 0, 4, 4);
    const cleanup = highlightAndClick('uid-corner', host);

    dom.hover(host);

    // Every outside spot is off-screen, so it falls back onto the block itself.
    expect(dom.button.style.left).toBe('8px');
    expect(dom.button.style.top).toBe('8px');

    cleanup();
  });

  test('the click opens whichever block is hovered', () => {
    const a = block(0, 0, 300, 200);
    const b = block(0, 300, 300, 200);
    const cleanups = [highlightAndClick('uid-a', a), highlightAndClick('uid-b', b)];

    dom.hover(a);
    dom.button.fire('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(mockOpen).toHaveBeenLastCalledWith('uid-a');

    dom.hover(b);
    dom.button.fire('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(mockOpen).toHaveBeenLastCalledWith('uid-b');

    cleanups.forEach((cleanup) => cleanup());
  });

  test('the click is kept away from the site underneath', () => {
    const host = block(0, 0, 300, 200);
    const cleanup = highlightAndClick('uid-a', host);
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };

    dom.hover(host);
    dom.button.fire('click', event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();

    cleanup();
  });

  test('the innermost of nested blocks wins', () => {
    const outer = block(0, 0, 600, 400);
    const inner = nest(outer, block(50, 50, 200, 100));
    const leaf = nest(inner, element('span', { x: 60, y: 60, w: 50, h: 20 }));
    const cleanups = [highlightAndClick('uid-outer', outer), highlightAndClick('uid-inner', inner)];

    // Pointer lands on a plain child of the inner block.
    dom.hover(leaf);
    dom.button.fire('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });

    expect(mockOpen).toHaveBeenCalledWith('uid-inner');
    expect(dom.ring.style.width).toBe('200px');

    cleanups.forEach((cleanup) => cleanup());
  });

  test('the ring hugs the visible part of a clipped block', () => {
    const scroller = element('div', { x: 0, y: 100, w: 300, h: 100 }, { overflow: 'auto' });
    const host = nest(scroller, block(0, 150, 300, 400));
    const cleanup = highlightAndClick('uid-clipped', host);

    dom.hover(host);

    expect(dom.ring.style.top).toBe('150px');
    expect(dom.ring.style.height).toBe('50px'); // clipped by the scroll container
    cleanup();
  });

  test('a block scrolled out of its container shows nothing', () => {
    const scroller = element('div', { x: 0, y: 0, w: 300, h: 100 }, { overflow: 'hidden' });
    const host = nest(scroller, block(0, 400, 300, 80));
    const cleanup = highlightAndClick('uid-gone', host);

    dom.hover(host);

    expect(dom.ring.style.visibility).toBe('hidden');
    cleanup();
  });

  test('a block outside the viewport shows nothing', () => {
    const host = block(0, 2000, 300, 100);
    const cleanup = highlightAndClick('uid-far', host);

    dom.hover(host);

    expect(dom.ring.style.visibility).toBe('hidden');
    cleanup();
  });

  test('a detached block shows nothing', () => {
    const host = block(0, 0, 300, 100);
    host.isConnected = false;
    const cleanup = highlightAndClick('uid-detached', host);

    dom.hover(host);

    expect(dom.ring.style.visibility).toBe('hidden');
    cleanup();
  });

  test('cleaning up the hovered block hides the overlay at once', () => {
    const host = block(0, 0, 300, 200);
    const other = block(0, 300, 300, 200);
    const cleanupOther = highlightAndClick('uid-b', other);
    const cleanup = highlightAndClick('uid-a', host);

    dom.hover(host);
    expect(dom.ring.style.visibility).toBe('visible');

    cleanup();
    expect(dom.ring.style.visibility).toBe('hidden');
    // Other blocks are still registered, so the overlay stays around.
    expect(dom.mount.parentNode).toBe(dom.doc.documentElement);

    cleanupOther();
  });

  test('cleaning up the last block leaves nothing behind', () => {
    const host = block(0, 0, 300, 200);
    const cleanup = highlightAndClick('uid-a', host);

    dom.hover(host);
    cleanup();

    expect(dom.doc.documentElement.removeChild).toHaveBeenCalledWith(dom.mount);
    expect(dom.mount.parentNode).toBe(null);
    expect(dom.doc.listenerCount('pointerover')).toBe(0);
    expect(dom.doc.listenerCount('mouseleave')).toBe(0);
    expect(dom.button.removeEventListener).toHaveBeenCalledTimes(3);
  });

  test('cleanup is idempotent', () => {
    const cleanup = highlightAndClick('uid-a', block(0, 0, 300, 200));

    cleanup();
    cleanup();

    expect(dom.doc.documentElement.removeChild).toHaveBeenCalledTimes(1);
  });
});
