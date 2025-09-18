import { isEmbedded } from './utils';
import open from './open';

/**
 * Enhanced version of open() that provides visual feedback when in preview mode.
 * When embedded in Flyo's preview iframe, this function adds hover effects to
 * indicate clickable elements for better editing experience.
 * 
 * @param blockUid - The unique identifier of the block to open
 * @param element - The DOM element to attach hover effects to (optional)
 */
function highlightAndClick(blockUid: string, element?: HTMLElement) {
    // Always call the regular open function
    const openHandler = () => open(blockUid);

    // If not embedded or no element provided, just return the open handler
    if (!isEmbedded() || !element) {
        return openHandler;
    }

    // Add visual feedback for embedded preview mode
    const originalBorder = element.style.border;
    const originalCursor = element.style.cursor;
    const originalTransition = element.style.transition;

    // Set up hover effects
    const mouseEnterHandler = () => {
        element.style.transition = 'border 0.2s ease';
        element.style.border = '2px dashed #007bff';
        element.style.cursor = 'pointer';
    };

    const mouseLeaveHandler = () => {
        element.style.border = originalBorder;
        element.style.cursor = originalCursor;
        element.style.transition = originalTransition;
    };

    // Add event listeners for hover only. Clicks are handled by the small overlay
    element.addEventListener('mouseenter', mouseEnterHandler);
    element.addEventListener('mouseleave', mouseLeaveHandler);

    // Create a small top-left overlay button that receives the click handler so
    // clicks on the element itself (images, links, cards) are not interfered with.
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.setAttribute('aria-label', 'Edit block');

    // Basic styling: small square in top-left, positioned relative to the element
    // We'll ensure the element has position: relative if it was static so the overlay
    // can be absolutely positioned inside it.
    const originalPosition = (element.style && element.style.position) || '';
    const needsPosition = getComputedStyle(element).position === 'static';
    if (needsPosition) {
        element.style.position = 'relative';
    }

    overlay.style.position = 'absolute';
    overlay.style.top = '6px';
    overlay.style.left = '6px';
    overlay.style.width = '20px';
    overlay.style.height = '20px';
    overlay.style.padding = '0';
    overlay.style.border = 'none';
    overlay.style.borderRadius = '3px';
    overlay.style.background = 'rgba(255,255,255,0.9)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.06)';
    overlay.style.cursor = 'pointer';
    overlay.style.zIndex = '9999';

    // Add a simple pencil/edit SVG inside the button
    overlay.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="#333"/>
            <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#333"/>
        </svg>
    `;

    // Click on overlay should invoke openHandler
    overlay.addEventListener('click', openHandler);

    // Append overlay to element
    element.appendChild(overlay);

    // Return cleanup function
    return () => {
        element.removeEventListener('mouseenter', mouseEnterHandler);
        element.removeEventListener('mouseleave', mouseLeaveHandler);
        overlay.removeEventListener('click', openHandler);
        if (overlay.parentElement === element) {
            element.removeChild(overlay);
        }
        // Restore original position if we changed it
        if (needsPosition) {
            element.style.position = originalPosition;
        }
        element.style.border = originalBorder;
        element.style.cursor = originalCursor;
        element.style.transition = originalTransition;
    };
}

export default highlightAndClick;