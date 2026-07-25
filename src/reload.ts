import { isEmbedded } from './utils';
import { registerEditorHandshake } from './editorConnection';

function reload() {
    if (typeof window === "undefined") return;

    // Only listen for reload messages if we're embedded in the correct iframe
    if (!isEmbedded()) return;

    window.addEventListener("message", (event) => {
        if (event.data?.action === 'pageRefresh') {
            window.location.reload();
        }
    })

    registerEditorHandshake();
}

export default reload;
