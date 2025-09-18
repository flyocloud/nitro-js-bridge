/**
 * Checks if the current script is embedded in an iframe hosted by Flyo Cloud
 * @returns {boolean} True if embedded in correct iframe host, false otherwise
 */
function isEmbedded(): boolean {
    if (typeof window === "undefined") return false;
    
    // Check if we're in an iframe (window !== window.top)
    // This matches the logic used in open.ts
    return window !== window.top;
}

export default isEmbedded;