/**
 * Checks if the current script is embedded in an iframe hosted by Flyo Cloud
 * @returns {boolean} True if embedded in correct iframe host, false otherwise
 */
export function isEmbedded(): boolean {
    if (typeof window === "undefined") return false;

    // Check if we're in an iframe (window !== window.top)
    return window !== window.top;
}

export function resolveWindow() {
    if (typeof window === "undefined") return false;
    return isEmbedded() ? window.parent : window;
}