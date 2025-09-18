import isEmbedded from './utils';

function open(blockUid: String) {
    if (typeof window === "undefined") return;

    const targetWindow = isEmbedded() ? window.parent : window;
   
    targetWindow.postMessage({
        action: 'openEdit',
        data: JSON.parse(JSON.stringify({item:{uid: blockUid}}))
    }, 'https://flyo.cloud')
}

export default open;