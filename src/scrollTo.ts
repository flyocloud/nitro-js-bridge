import { isEmbedded } from './utils';

function scrollTo() {
    if (typeof window === "undefined") return;

    // Only listen for scrollTo messages if we're embedded in the correct iframe
    if (!isEmbedded()) return;

    window.addEventListener("message", (event) => {
        if (event.data?.action === 'scrollTo') {
            const uid = event.data?.data?.item?.uid;
            if (!uid) return;
            const element = document.querySelector(`[data-flyo-uid="${CSS.escape(uid)}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    })
}

export default scrollTo;
