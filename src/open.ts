function open(blockUid: String) {
    if (typeof window === "undefined") return;

    const targetWindow = window === window.top ? window : window.parent;
   
    targetWindow.postMessage({
        action: 'openEdit',
        data: JSON.parse(JSON.stringify({item:{uid: blockUid}}))
    }, 'https://flyo.cloud')
}

export default open;