import { isEmbedded } from './utils';
import open from './open';

// Minimal, easy-to-reason highlightAndClick. Shows a small edit button in the
// top-left on hover and adds a subtle host stroke. Keeps state minimal and
// avoids trying to mirror computed styles exactly.
function highlightAndClick(blockUid: string, element?: HTMLElement) {
  const openHandler = () => open(blockUid);
  if (!isEmbedded() || !element) return openHandler;

  const originalPosition = element.style.position || '';
  const originalCursor = element.style.cursor || '';
  const originalBoxShadow = element.style.boxShadow || '';
  const originalBorderRadius = element.style.borderRadius || '';

  const needsPosition = getComputedStyle(element).position === 'static';
  if (needsPosition) element.style.position = 'relative';

  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.setAttribute('aria-label', 'Edit block');
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
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
  element.appendChild(overlay);

  const show = () => {
    overlay.style.opacity = '1';
    overlay.style.transform = 'translateY(0)';
    element.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.08)';
    element.style.borderRadius = '6px';
  };
  const hide = () => {
    overlay.style.opacity = '0';
    overlay.style.transform = 'translateY(-4px)';
    element.style.boxShadow = originalBoxShadow;
    element.style.borderRadius = originalBorderRadius;
  };

  const onEnter = () => show();
  const onLeave = () => hide();

  element.addEventListener('mouseenter', onEnter);
  element.addEventListener('mouseleave', onLeave);

  return () => {
    element.removeEventListener('mouseenter', onEnter);
    element.removeEventListener('mouseleave', onLeave);
    overlay.removeEventListener('click', openHandler);
    if (overlay.parentElement === element) element.removeChild(overlay);
    if (needsPosition) element.style.position = originalPosition;
    element.style.cursor = originalCursor;
    element.style.boxShadow = originalBoxShadow;
    element.style.borderRadius = originalBorderRadius;
  };
}

export default highlightAndClick;