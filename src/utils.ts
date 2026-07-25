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

const FLYO_EDITOR_ORIGIN = 'https://flyo.cloud';

let knownEditorOrigin: string | null = null;

/**
 * Remember the editor origin learned from a trusted message event: the editor's
 * liveEditPing carries its authoritative, browser-set event.origin. Subsequent
 * getEditorOrigin() calls prefer it over the heuristics below, which keeps
 * outbound messages working on any editor host (staging, localhost) and across
 * in-site navigations.
 */
export function rememberEditorOrigin(origin: string | null) {
    knownEditorOrigin = origin || null;
}

/**
 * Origin of the embedding editor to use as postMessage targetOrigin, in order
 * of reliability:
 * 1. the origin learned from the editor's own ping (see rememberEditorOrigin),
 * 2. location.ancestorOrigins (not implemented in Firefox),
 * 3. the referrer, but only while it points to a foreign origin (after an
 *    in-site navigation the referrer is this site itself, not the editor),
 * 4. the Flyo production editor as the safe default.
 * @returns {string} The editor origin
 */
export function getEditorOrigin(): string {
    if (typeof window === "undefined") return FLYO_EDITOR_ORIGIN;

    if (knownEditorOrigin) return knownEditorOrigin;

    const ancestorOrigin = window.location?.ancestorOrigins?.[0];
    if (ancestorOrigin) return ancestorOrigin;

    if (typeof document !== "undefined" && document.referrer) {
        try {
            const referrerOrigin = new URL(document.referrer).origin;
            if (referrerOrigin !== window.location?.origin) {
                return referrerOrigin;
            }
        } catch {
            // invalid referrer, fall through to the default
        }
    }

    return FLYO_EDITOR_ORIGIN;
}