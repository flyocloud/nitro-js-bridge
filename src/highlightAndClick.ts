import { isEmbedded } from './utils';
import open from './open';

// Minimal, easy-to-reason highlightAndClick. Shows a small edit button in the
// top-left on hover and adds a subtle host stroke. Keeps state minimal and
// avoids trying to mirror computed styles exactly.
function highlightAndClick(blockUid: string, element?: HTMLElement) {
  const openHandler = () => open(blockUid);
  if (!isEmbedded() || !element) return openHandler;
  const target = element as HTMLElement;
  const originalCursor = target.style.cursor || '';
  const originalBoxShadow = target.style.boxShadow || '';
  const originalBorderRadius = target.style.borderRadius || '';

  // Create overlay as a fixed element in the document body so it can't be
  // clipped by overflow or transformed parents.
  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.setAttribute('aria-label', 'Edit block');
  overlay.style.position = 'fixed';
  overlay.style.top = '0px';
  overlay.style.left = '0px';
  overlay.style.width = '34px';
  overlay.style.height = '34px';
  overlay.style.padding = '0';
  overlay.style.border = 'none';
  overlay.style.background = 'rgba(255,255,255,0.9)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.cursor = 'pointer';
  overlay.style.zIndex = '9999';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 120ms ease, transform 120ms ease';
  overlay.style.transform = 'translateY(-4px)';
  overlay.style.borderTopLeftRadius = '6px';

  overlay.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="#333"/>' +
    '<path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#333"/>' +
    '</svg>';

  overlay.addEventListener('click', openHandler);
  document.body.appendChild(overlay);

  // Track hover state for element and overlay so the overlay stays visible
  // when hovering either.
  let isOverElement = false;
  let isOverOverlay = false;

  // Throttle repositioning with RAF
  let rafId = 0;
  const schedulePosition = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      positionOverlay();
    });
  };

  const OVERLAY_SIZE = 34;
  const PROXIMITY = 12; // px tolerance to show overlay for tiny elements

  function isRectVisible(rect: DOMRect) {
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return !(rect.bottom < 0 || rect.right < 0 || rect.top > vh || rect.left > vw || (rect.width === 0 && rect.height === 0));
  }

  function positionOverlay() {
    try {
      const rect = target.getBoundingClientRect();
      if (!isRectVisible(rect)) {
        // place offscreen but keep in DOM
        overlay.style.display = 'none';
        return;
      }
      overlay.style.display = 'flex';
      // Align to the element's top-left in viewport coordinates. If the
      // element is very small, prefer placing the overlay slightly offset
      // so it's easier to hit and doesn't overlap the element content.
      let left = Math.round(rect.left);
      let top = Math.round(rect.top);
      const elW = Math.round(rect.width);
      const elH = Math.round(rect.height);
      // If element is tiny, offset overlay above the element when possible
      if (elW < OVERLAY_SIZE || elH < OVERLAY_SIZE) {
        // position so overlay's bottom-left aligns with element's top-left
        left = Math.round(rect.left);
        top = Math.round(rect.top) - OVERLAY_SIZE - 6;
      }
      // Clamp to viewport so overlay doesn't go offscreen
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      left = Math.max(6, Math.min(left, vw - OVERLAY_SIZE - 6));
      top = Math.max(6, Math.min(top, vh - OVERLAY_SIZE - 6));
      overlay.style.left = `${left}px`;
      overlay.style.top = `${top}px`;
      // Mirror border radius and other subtle visuals from the element
      const elStyle = getComputedStyle(target);
      overlay.style.borderTopLeftRadius = elStyle.borderTopLeftRadius || '6px';
    } catch (e) {
      // If element isn't available anymore, leave it hidden — cleanup will
      // remove the overlay when mutation observer notices removal.
      overlay.style.display = 'none';
    }
  }


  const show = () => {
    positionOverlay();
    overlay.style.opacity = '1';
    overlay.style.transform = 'translateY(0)';
    target.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.08)';
    target.style.borderRadius = '6px';
  };
  const hide = () => {
    overlay.style.opacity = '0';
    overlay.style.transform = 'translateY(-4px)';
    target.style.boxShadow = originalBoxShadow;
    target.style.borderRadius = originalBorderRadius;
  };

  const onElementEnter = () => {
    isOverElement = true;
    show();
  };
  const onElementLeave = () => {
    // If moving into overlay, don't hide
    isOverElement = false;
    requestAnimationFrame(() => {
      if (!isOverOverlay && !isOverElement) hide();
    });
  };
  const onOverlayEnter = () => {
    isOverOverlay = true;
    show();
  };
  const onOverlayLeave = () => {
    isOverOverlay = false;
    requestAnimationFrame(() => {
      if (!isOverOverlay && !isOverElement) hide();
    });
  };

  target.addEventListener('mouseenter', onElementEnter);
  target.addEventListener('mouseleave', onElementLeave);
  overlay.addEventListener('mouseenter', onOverlayEnter);
  overlay.addEventListener('mouseleave', onOverlayLeave);

  // Show overlay when the pointer is near the element (helps with tiny elements)
  let pointerRaf = 0;
  const onPointerMove = (ev: MouseEvent) => {
    if (pointerRaf) return;
    pointerRaf = requestAnimationFrame(() => {
      pointerRaf = 0;
      try {
        const rect = target.getBoundingClientRect();
        const x = ev.clientX;
        const y = ev.clientY;
        const expanded = {
          left: rect.left - PROXIMITY,
          top: rect.top - PROXIMITY,
          right: rect.right + PROXIMITY,
          bottom: rect.bottom + PROXIMITY,
        };
        const isNear = x >= expanded.left && x <= expanded.right && y >= expanded.top && y <= expanded.bottom;
        if (isNear) {
          show();
          schedulePosition();
        } else {
          // hide only if not over element/overlay
          if (!isOverElement && !isOverOverlay) hide();
        }
      } catch (e) {}
    });
  };
  document.addEventListener('mousemove', onPointerMove, true);

  // Keep overlay positioned during scroll/resize and element resize
  const onScroll = schedulePosition;
  const onResize = schedulePosition;
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);

  // ResizeObserver to reposition when element size changes (guarded)
  let resizeObserver: ResizeObserver | null = null;
  const ResizeObserverCtor = (window as any).ResizeObserver;
  if (typeof ResizeObserverCtor === 'function') {
    try {
      resizeObserver = new ResizeObserverCtor(() => schedulePosition());
      if (resizeObserver) {
        try {
          resizeObserver.observe(target);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore if ResizeObserver can't observe
      resizeObserver = null;
    }
  }

  // MutationObserver to detect element removal from DOM (guarded)
  let mutationObserver: MutationObserver | null = null;
  const MutationObserverCtor = (window as any).MutationObserver;
  if (typeof MutationObserverCtor === 'function') {
    try {
      mutationObserver = new MutationObserverCtor((mutations: MutationRecord[]) => {
        for (const m of mutations) {
          for (const node of Array.from(m.removedNodes || [])) {
            if (node === target || (node instanceof HTMLElement && node.contains(target))) {
              // element removed — cleanup
              cleanup();
              return;
            }
          }
        }
      });
      if (mutationObserver) {
        try {
          mutationObserver.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
      }
    } catch (e) {
      mutationObserver = null;
    }
  }

  // Initial placement
  schedulePosition();

  function cleanup() {
    target.removeEventListener('mouseenter', onElementEnter);
    target.removeEventListener('mouseleave', onElementLeave);
    overlay.removeEventListener('mouseenter', onOverlayEnter);
    overlay.removeEventListener('mouseleave', onOverlayLeave);
    overlay.removeEventListener('click', openHandler);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    try {
      resizeObserver?.disconnect();
    } catch (e) {}
    try {
      if (mutationObserver) mutationObserver.disconnect();
    } catch (e) {}
    try {
      document.removeEventListener('mousemove', onPointerMove, true);
    } catch (e) {}
    if (overlay.parentElement === document.body) document.body.removeChild(overlay);
    target.style.cursor = originalCursor;
    target.style.boxShadow = originalBoxShadow;
    target.style.borderRadius = originalBorderRadius;
  }

  return cleanup;
}

export default highlightAndClick;