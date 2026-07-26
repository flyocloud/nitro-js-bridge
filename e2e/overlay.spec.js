import { test, expect } from '@playwright/test';

/**
 * End-to-end checks for highlightAndClick() in real Chromium, Firefox and
 * WebKit, driven with a real mouse against the demo editor (`demo/index.html`)
 * and its preview iframe (`demo/iframe.html`).
 *
 * The bulk of it is about NOT disturbing the host site: the overlay may only
 * ever add itself, never change the page it is pointing at.
 */

/** highlightAndClick's own TIMING constants, so the waits stay honest. */
const SHOW_DELAY = 600;
const FADE_IN = 220;
const APPEARED = SHOW_DELAY + FADE_IN + 150;
const GONE = 180 + 180 + 150; // grace + fadeOut + slack

/** The preview document, i.e. the "customer website" inside the editor. */
async function openEditor(page) {
  await page.goto('/');
  const preview = page.frameLocator('#preview');
  await expect(preview.locator('[data-flyo-uid="uid-a"]')).toBeVisible();
  const frame = page.frames().find((f) => f.url().includes('iframe.html'));
  return { preview, frame };
}

const block = (preview, uid) => preview.locator(`[data-flyo-uid="${uid}"]`);

/**
 * Real mouse move onto the element's centre. `force` skips playwright's
 * hit-target check: we want the pointer where we put it, not where playwright
 * thinks it is safe.
 */
const hover = (locator) => locator.hover({ force: true });

/** State of the shared overlay, read from inside the preview document. */
function overlayState(frame) {
  return frame.evaluate(() => {
    const mount = document.querySelector('flyo-edit-overlay');
    if (!mount) {
      return null;
    }
    const root = mount.shadowRoot;
    const ring = root ? root.querySelector('div') : null;
    const btn = root ? root.querySelector('button') : null;
    const read = (el) => {
      const css = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        opacity: Number(css.opacity),
        visibility: css.visibility,
        display: css.display,
        pointerEvents: css.pointerEvents,
        background: css.backgroundImage,
        borderTopWidth: css.borderTopWidth,
        transition: css.transition,
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    return {
      mountParent: mount.parentElement.tagName.toLowerCase(),
      mountDisplay: getComputedStyle(mount).display,
      hasShadowRoot: !!root,
      styleElements: root ? root.querySelectorAll('style').length : 0,
      inBody: !!document.body.querySelector('flyo-edit-overlay'),
      ring: ring ? read(ring) : null,
      btn: btn ? read(btn) : null,
    };
  });
}

/** Everything about the preview page that the bridge must leave alone. */
function pageFingerprint(frame) {
  return frame.evaluate(() => {
    const sample = ['uid-a', 'uid-card-hover', 'uid-nest-3', 'uid-td'].map((uid) => {
      const el = document.querySelector(`[data-flyo-uid="${uid}"]`);
      const css = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        uid,
        markup: el.outerHTML,
        attributes: el.getAttributeNames().sort().join(','),
        cursor: css.cursor,
        outline: css.outlineWidth,
        border: css.borderTopWidth,
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(),
      };
    });
    return {
      sample,
      bodyChildren: document.body.childElementCount,
      bodyLastChild: document.body.lastElementChild.tagName.toLowerCase(),
      divCount: document.querySelectorAll('div').length,
      buttonCount: document.querySelectorAll('button').length,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

test.describe('live edit overlay', () => {
  test('waits for hover intent, then fades in aligned to the block', async ({ page }) => {
    const { preview, frame } = await openEditor(page);
    const target = block(preview, 'uid-a');

    await hover(target);

    // Still nothing while the hover-intent delay runs.
    await page.waitForTimeout(SHOW_DELAY / 3);
    let state = await overlayState(frame);
    expect(state.ring.opacity).toBe(0);
    expect(state.btn.visibility).toBe('hidden');

    await page.waitForTimeout(APPEARED);
    state = await overlayState(frame);
    expect(state.ring.opacity).toBe(1);
    expect(state.ring.visibility).toBe('visible');
    expect(state.btn.opacity).toBe(1);

    // The ring sits exactly on the block.
    const box = await target.boundingBox();
    const hostBox = await frame.evaluate(() => {
      const r = document.querySelector('[data-flyo-uid="uid-a"]').getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(state.ring.x).toBe(hostBox.x);
    expect(state.ring.y).toBe(hostBox.y);
    expect(state.ring.w).toBe(hostBox.w);
    expect(state.ring.h).toBe(hostBox.h);
    expect(box).not.toBeNull();
  });

  test('moving on to the pencil keeps it alive and opens the hovered block', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    await hover(block(preview, 'uid-card-link'));
    await page.waitForTimeout(APPEARED);

    // Walk to the button the way a user does, in steps, over whatever lies between.
    const btn = await overlayState(frame).then((s) => s.btn);
    const iframeBox = await page.locator('#preview').boundingBox();
    await page.mouse.move(iframeBox.x + btn.x + btn.w / 2, iframeBox.y + btn.y + btn.h / 2, { steps: 12 });
    await page.waitForTimeout(100);

    const state = await overlayState(frame);
    expect(state.btn.opacity).toBe(1);

    await page.mouse.down();
    await page.mouse.up();

    // The editor side received openEdit for that block, through postMessage.
    await expect(page.locator('#log')).toContainText('openEdit');
    await expect(page.locator('#log')).toContainText('uid-card-link');
  });

  test('leaving the block fades everything out again', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    await hover(block(preview, 'uid-a'));
    await page.waitForTimeout(APPEARED);
    expect((await overlayState(frame)).ring.opacity).toBe(1);

    await hover(preview.locator('.intro'));
    await page.waitForTimeout(GONE);

    const state = await overlayState(frame);
    expect(state.ring.opacity).toBe(0);
    expect(state.ring.visibility).toBe('hidden');
    expect(state.btn.visibility).toBe('hidden');
  });

  test('never touches the block it points at', async ({ page }) => {
    const { preview, frame } = await openEditor(page);
    const before = await pageFingerprint(frame);

    // uid-a is authored without a style attribute; it has to stay that way.
    expect(before.sample[0].attributes).toBe('class,data-flyo-uid');

    await hover(block(preview, 'uid-a'));
    await page.waitForTimeout(APPEARED);
    await hover(block(preview, 'uid-nest-3'));
    await page.waitForTimeout(APPEARED);
    await hover(preview.locator('.intro'));
    await page.waitForTimeout(GONE);

    expect(await pageFingerprint(frame)).toEqual(before);
  });

  test('adds one node outside <body> and changes no layout', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    // Registration already happened on load, so compare against the authored page.
    const clean = await page.evaluate(async () => {
      const res = await fetch('/demo/iframe.html');
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      return {
        bodyChildren: doc.body.childElementCount,
        bodyLastChild: doc.body.lastElementChild.tagName.toLowerCase(),
      };
    });
    const live = await pageFingerprint(frame);
    expect(live.bodyChildren).toBe(clean.bodyChildren);
    expect(live.bodyLastChild).toBe(clean.bodyLastChild);

    const state = await overlayState(frame);
    expect(state.mountParent).toBe('html');
    expect(state.inBody).toBe(false);
    expect(state.hasShadowRoot).toBe(true);
    // Our nodes are invisible to the site's own selectors and scripts.
    expect(live.divCount).toBe(await frame.evaluate(() => document.querySelectorAll('div').length));

    await hover(block(preview, 'uid-a'));
    await page.waitForTimeout(APPEARED);
    const hovered = await pageFingerprint(frame);
    expect(hovered.scrollWidth).toBe(live.scrollWidth);
    expect(hovered.scrollHeight).toBe(live.scrollHeight);
    expect(hovered.divCount).toBe(live.divCount);
    expect(hovered.buttonCount).toBe(live.buttonCount);
  });

  test('site CSS cannot reach the overlay, not even with !important', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    // Everything a real site plausibly throws at a `div` or a `button`,
    // including a `*` reset that would kill our fades if it reached them.
    await frame.addStyleTag({
      content: `
        button { display: none !important; background: #f00 !important; width: 200px !important;
                 border: 20px solid #0f0 !important; border-radius: 0 !important; }
        div { border: 10px dotted #f00 !important; box-shadow: none !important; }
        svg { display: none !important; }
        [aria-label="Edit block"] { display: none !important; }
        * { transition: none !important; animation: none !important; box-sizing: content-box !important; }
      `,
    });

    await hover(block(preview, 'uid-a'));
    await page.waitForTimeout(APPEARED);

    const state = await overlayState(frame);
    expect(state.btn.display).toBe('flex');
    expect(state.btn.opacity).toBe(1);
    expect(state.btn.visibility).toBe('visible');
    expect(state.btn.background).toContain('gradient');
    expect(state.btn.borderTopWidth).toBe('2px');
    expect(state.btn.w).toBe(34);
    expect(state.ring.borderTopWidth).toBe('2px');
    expect(state.ring.opacity).toBe(1);
  });

  test('keeps the site\'s own hovers, links and cursors', async ({ page }) => {
    const { preview, frame } = await openEditor(page);
    const card = block(preview, 'uid-card-hover');

    await hover(card);
    await page.waitForTimeout(APPEARED);

    // The site's :hover rule still applies underneath the overlay.
    const hoverStyle = await frame.evaluate(() => {
      const el = document.querySelector('[data-flyo-uid="uid-card-hover"]');
      return getComputedStyle(el).transform;
    });
    expect(hoverStyle).not.toBe('none');

    // The ring must not intercept the pointer.
    expect((await overlayState(frame)).ring.pointerEvents).toBe('none');

    // A link inside a block still receives its click. Dismiss from the handler,
    // otherwise the site's alert() blocks the click action itself.
    let alerted = null;
    page.on('dialog', (dialog) => {
      alerted = dialog.message();
      dialog.dismiss();
    });
    await hover(block(preview, 'uid-card-link'));
    await page.waitForTimeout(APPEARED);
    await preview.locator('[data-flyo-uid="uid-card-link"] a').click();
    expect(alerted).toContain('Link clicked');
  });

  test('stays on top of, and clickable above, the highest site layer', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    // That block is fully covered by a site layer with the maximum z-index.
    await hover(block(preview, 'uid-under-layer'));
    await page.waitForTimeout(APPEARED);

    const state = await overlayState(frame);
    expect(state.btn.opacity).toBe(1);

    // Hit testing at the pencil resolves to us, not to the site's layer.
    const onTop = await frame.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.tagName.toLowerCase() : null;
    }, { x: state.btn.x + state.btn.w / 2, y: state.btn.y + state.btn.h / 2 });
    expect(onTop).toBe('flyo-edit-overlay');

    const iframeBox = await page.locator('#preview').boundingBox();
    await page.mouse.move(
      iframeBox.x + state.btn.x + state.btn.w / 2,
      iframeBox.y + state.btn.y + state.btn.h / 2,
      { steps: 8 }
    );
    await page.mouse.down();
    await page.mouse.up();

    await expect(page.locator('#log')).toContainText('uid-under-layer');
  });

  test('follows a block that changes size under the pointer', async ({ page }) => {
    const { preview, frame } = await openEditor(page);
    const grow = block(preview, 'uid-grow');

    const before = await frame.evaluate(
      () => document.querySelector('[data-flyo-uid="uid-grow"]').getBoundingClientRect().height
    );

    // The block's padding grows on :hover — the box changes, the content box
    // does not, which a ResizeObserver alone never notices.
    await hover(grow);
    await page.waitForTimeout(APPEARED);

    const host = await frame.evaluate(() => {
      const r = document.querySelector('[data-flyo-uid="uid-grow"]').getBoundingClientRect();
      return { y: Math.round(r.top), h: Math.round(r.height) };
    });
    expect(host.h).toBeGreaterThan(before + 10); // it really did grow

    const state = await overlayState(frame);
    expect(state.ring.h).toBe(host.h);
    expect(state.ring.y).toBe(host.y);
  });

  test('follows a block that moves under the pointer', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    // This block lifts itself with transform: translateY(-4px) on :hover, which
    // changes no box at all — only the painted position.
    await hover(block(preview, 'uid-lift'));
    await page.waitForTimeout(APPEARED);

    const host = await frame.evaluate(() => {
      const el = document.querySelector('[data-flyo-uid="uid-lift"]');
      const r = el.getBoundingClientRect();
      return { y: Math.round(r.top), transform: getComputedStyle(el).transform };
    });
    expect(host.transform).not.toBe('none');

    const state = await overlayState(frame);
    expect(state.ring.y).toBe(host.y);
  });

  test('the innermost of nested blocks wins', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    await hover(preview.locator('[data-flyo-uid="uid-nest-3"] strong'));
    await page.waitForTimeout(APPEARED);

    const inner = await frame.evaluate(() => {
      const r = document.querySelector('[data-flyo-uid="uid-nest-3"]').getBoundingClientRect();
      return { y: Math.round(r.top), h: Math.round(r.height) };
    });
    const state = await overlayState(frame);
    expect(state.ring.y).toBe(inner.y);
    expect(state.ring.h).toBe(inner.h);
  });

  test('a clipped block gets a clipped ring', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    await hover(block(preview, 'uid-clipped'));
    await page.waitForTimeout(APPEARED);

    // The block is taller than its overflow:hidden container, so whatever the
    // container is scrolled to, the ring must stop at the container's edges.
    const { host, visible } = await frame.evaluate(() => {
      const el = document.querySelector('[data-flyo-uid="uid-clipped"]');
      const h = el.getBoundingClientRect();
      const c = el.closest('.frame').getBoundingClientRect();
      return {
        host: Math.round(h.height),
        visible: Math.round(Math.min(h.bottom, c.bottom) - Math.max(h.top, c.top)),
      };
    });
    const state = await overlayState(frame);
    expect(state.ring.h).toBeLessThan(host);
    expect(Math.abs(state.ring.h - visible)).toBeLessThanOrEqual(2);
  });

  test('a block scrolled out of its container hides the overlay', async ({ page }) => {
    const { preview, frame } = await openEditor(page);
    const inner = block(preview, 'uid-scroll');
    await inner.scrollIntoViewIfNeeded();

    await hover(inner);
    await page.waitForTimeout(APPEARED);
    expect((await overlayState(frame)).ring.opacity).toBe(1);

    await frame.evaluate(() => {
      const scroller = document.querySelector('[data-flyo-uid="uid-scroll"]').closest('.frame');
      scroller.scrollTop = scroller.scrollHeight;
    });
    await page.waitForTimeout(200);

    expect((await overlayState(frame)).ring.visibility).toBe('hidden');
  });

  test('a block inside a shadow root can be hovered', async ({ page }) => {
    const { preview, frame } = await openEditor(page);
    const inner = preview.locator('#shadow-host #inner');
    await inner.scrollIntoViewIfNeeded();

    await hover(inner);
    await page.waitForTimeout(APPEARED);

    const expected = await frame.evaluate(() => {
      const r = document.getElementById('shadow-host').shadowRoot.getElementById('inner').getBoundingClientRect();
      return { y: Math.round(r.top), h: Math.round(r.height) };
    });
    const state = await overlayState(frame);
    expect(state.ring.opacity).toBe(1);
    expect(state.ring.y).toBe(expected.y);
    expect(state.ring.h).toBe(expected.h);
  });

  test('disappears in print and stands down for reduced motion', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await hover(block(preview, 'uid-a'));
    await page.waitForTimeout(APPEARED);

    let state = await overlayState(frame);
    expect(state.ring.opacity).toBe(1);
    expect(state.ring.transition).toMatch(/^(none|all 0s ease 0s)$/);

    await page.emulateMedia({ media: 'print' });
    state = await overlayState(frame);
    expect(state.mountDisplay).toBe('none');

    await page.emulateMedia({ media: null, reducedMotion: null });
  });

  test('stays out of the site tab order', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    await hover(block(preview, 'uid-a'));
    await page.waitForTimeout(APPEARED);

    const tabIndex = await frame.evaluate(
      () => document.querySelector('flyo-edit-overlay').shadowRoot.querySelector('button').tabIndex
    );
    expect(tabIndex).toBe(-1);
  });

  test('cleanup leaves nothing behind', async ({ page }) => {
    const { preview, frame } = await openEditor(page);

    await hover(block(preview, 'uid-a'));
    await page.waitForTimeout(APPEARED);
    expect(await overlayState(frame)).not.toBeNull();

    await frame.evaluate(() => window.flyoDemoCleanups.forEach((cleanup) => cleanup()));

    expect(await overlayState(frame)).toBeNull();
    // Hovering afterwards must not bring it back.
    await hover(block(preview, 'uid-b'));
    await page.waitForTimeout(APPEARED);
    expect(await overlayState(frame)).toBeNull();
  });
});
