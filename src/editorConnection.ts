import { isEmbedded, getEditorOrigin, rememberEditorOrigin } from './utils';

// One registration per document, shared across bundled copies of the bridge.
const WINDOW_FLAG = '__flyoNitroLiveEditHandshake';

/**
 * Register the editor connection handshake: announce this live-edit page to the
 * embedding Flyo editor (`liveEditReady`) and answer the editor's connection
 * probes (`liveEditPing`). The editor uses this to tell a working live-edit
 * preview apart from a blocked frame or a page without live edit, and shows
 * troubleshooting guidance instead of a silent white screen when it is missing.
 *
 * Called automatically by reload(), the canonical live-edit boot function every
 * integration registers. Runs at most once per document and only inside the
 * editor iframe. Custom setups that do not use reload() can call it directly.
 */
export function registerEditorHandshake() {
    if (typeof window === "undefined") return;
    if (!isEmbedded()) return;
    if ((window as any)[WINDOW_FLAG]) return;
    (window as any)[WINDOW_FLAG] = true;

    window.addEventListener("message", (event) => {
        // Only the embedding window is the editor — its event.origin also
        // teaches us the exact targetOrigin for all later outbound messages.
        if (event.data?.action === 'liveEditPing' && event.source === window.parent) {
            rememberEditorOrigin(event.origin || null);
            (event.source as Window).postMessage({ action: 'liveEditReady' }, event.origin || '*');
        }
    });

    // Proactive announcement for editors already listening while this document boots.
    window.parent.postMessage({ action: 'liveEditReady' }, getEditorOrigin());
}
