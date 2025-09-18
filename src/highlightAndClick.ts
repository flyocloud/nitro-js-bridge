import isEmbedded from './utils';
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

    // Add event listeners
    element.addEventListener('mouseenter', mouseEnterHandler);
    element.addEventListener('mouseleave', mouseLeaveHandler);
    element.addEventListener('click', openHandler);

    // Return cleanup function
    return () => {
        element.removeEventListener('mouseenter', mouseEnterHandler);
        element.removeEventListener('mouseleave', mouseLeaveHandler);
        element.removeEventListener('click', openHandler);
        element.style.border = originalBorder;
        element.style.cursor = originalCursor;
        element.style.transition = originalTransition;
    };
}

export default highlightAndClick;